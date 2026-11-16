import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const FESTIVALS_FILE = path.join(DATA_DIR, 'festivals.json');

interface StoredFestival {
  id: string;
  name: string;
  creator: string;
  environment: string;
  timeOfDay: string;
  stageItems: unknown[];
  lighting: Record<string, unknown>;
  crowd: Record<string, unknown>;
  cameraSequence: unknown[];
  remixedFrom?: string;
  allowRemix: boolean;
  createdAt: number;
  updatedAt: number;
  isCommunity?: boolean;
}

function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(FESTIVALS_FILE)) {
    fs.writeFileSync(FESTIVALS_FILE, JSON.stringify([], null, 2));
  }
}

function readFestivals(): StoredFestival[] {
  ensureDataStore();
  try {
    const raw = fs.readFileSync(FESTIVALS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFestivals(list: StoredFestival[]) {
  ensureDataStore();
  fs.writeFileSync(FESTIVALS_FILE, JSON.stringify(list.slice(0, 100), null, 2));
}

interface RoomParticipantServer {
  clientId: string;
  ws: WebSocket;
  avatar: Record<string, unknown>;
  isHost: boolean;
  muted: boolean;
}

interface ActiveRoom {
  roomId: string;
  isPublic: boolean;
  hostId: string;
  lockedEdits: boolean;
  emotesEnabled: boolean;
  project: Record<string, unknown> | null;
  participants: Map<string, RoomParticipantServer>;
  messages: Array<{
    id: string;
    clientId: string;
    sender: string;
    text: string;
    timestamp: number;
    color: string;
  }>;
}

const rooms = new Map<string, ActiveRoom>();

function broadcastRoom(room: ActiveRoom, payload: unknown, excludeClientId?: string) {
  const data = JSON.stringify(payload);
  for (const [cid, p] of room.participants.entries()) {
    if (excludeClientId && cid === excludeClientId) continue;
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(data);
    }
  }
}

function serializeParticipants(room: ActiveRoom) {
  return Array.from(room.participants.values()).map((p) => ({
    clientId: p.clientId,
    avatar: p.avatar,
    isHost: p.isHost,
    muted: p.muted,
  }));
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, activeRooms: rooms.size });
  });

  app.get('/api/festivals', (_req, res) => {
    res.json({ festivals: readFestivals() });
  });

  app.get('/api/festivals/:id', (req, res) => {
    const found = readFestivals().find((f) => f.id === req.params.id);
    if (!found) {
      res.status(404).json({ error: 'Festival not found' });
      return;
    }
    res.json({ festival: found });
  });

  app.post('/api/festivals', (req, res) => {
    const incoming = req.body as StoredFestival;
    if (!incoming || !incoming.id || !incoming.name) {
      res.status(400).json({ error: 'Invalid festival payload' });
      return;
    }
    const existing = readFestivals().filter((f) => f.id !== incoming.id);
    const updated = [{ ...incoming, updatedAt: Date.now() }, ...existing];
    writeFestivals(updated);
    res.json({ ok: true, festival: incoming });
  });

  app.get('/api/rooms', (_req, res) => {
    const publicRooms = Array.from(rooms.values())
      .filter((r) => r.isPublic)
      .map((r) => ({
        roomId: r.roomId,
        participantCount: r.participants.size,
        environment: (r.project?.environment as string) || 'neon-cyberpunk',
        name: (r.project?.name as string) || `Room ${r.roomId}`,
      }));
    res.json({ rooms: publicRooms });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host}`);
    if (reqUrl.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    let currentRoomId: string | null = null;
    const clientId = `user-${Math.random().toString(36).slice(2, 8)}`;

    const leaveCurrentRoom = () => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (room) {
        room.participants.delete(clientId);
        if (room.participants.size === 0) {
          rooms.delete(currentRoomId);
        } else {
          if (room.hostId === clientId) {
            const nextHost = room.participants.values().next().value;
            if (nextHost) {
              nextHost.isHost = true;
              room.hostId = nextHost.clientId;
            }
          }
          broadcastRoom(room, {
            type: 'room:presence',
            participants: serializeParticipants(room),
            hostId: room.hostId,
          });
        }
      }
      currentRoomId = null;
    };

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          roomId?: string;
          isPublic?: boolean;
          avatar?: Record<string, unknown>;
          project?: Record<string, unknown>;
          emote?: string;
          text?: string;
          lockedEdits?: boolean;
          emotesEnabled?: boolean;
          targetClientId?: string;
        };

        if (msg.type === 'room:join' && msg.roomId) {
          leaveCurrentRoom();
          const roomId = msg.roomId.trim().toUpperCase().slice(0, 16);
          let room = rooms.get(roomId);
          const isNew = !room;
          if (!room) {
            room = {
              roomId,
              isPublic: msg.isPublic ?? true,
              hostId: clientId,
              lockedEdits: false,
              emotesEnabled: true,
              project: msg.project ?? null,
              participants: new Map(),
              messages: [],
            };
            rooms.set(roomId, room);
          }

          room.participants.set(clientId, {
            clientId,
            ws,
            avatar: msg.avatar ?? {},
            isHost: isNew,
            muted: false,
          });
          currentRoomId = roomId;

          ws.send(
            JSON.stringify({
              type: 'room:joined',
              clientId,
              roomId,
              isHost: isNew,
              isPublic: room.isPublic,
              lockedEdits: room.lockedEdits,
              emotesEnabled: room.emotesEnabled,
              project: room.project,
              participants: serializeParticipants(room),
              messages: room.messages,
            })
          );

          broadcastRoom(
            room,
            {
              type: 'room:presence',
              participants: serializeParticipants(room),
              hostId: room.hostId,
            },
            clientId
          );
          return;
        }

        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;
        const sender = room.participants.get(clientId);
        if (!sender) return;

        if (msg.type === 'avatar:update' && msg.avatar) {
          sender.avatar = msg.avatar;
          broadcastRoom(
            room,
            {
              type: 'room:presence',
              participants: serializeParticipants(room),
              hostId: room.hostId,
            },
            clientId
          );
        } else if (msg.type === 'project:sync' && msg.project) {
          if (room.lockedEdits && !sender.isHost) return;
          room.project = msg.project;
          broadcastRoom(
            room,
            { type: 'project:sync', project: msg.project },
            clientId
          );
        } else if (msg.type === 'emote:send' && msg.emote) {
          if (!room.emotesEnabled) return;
          broadcastRoom(room, {
            type: 'emote:broadcast',
            clientId,
            emote: msg.emote,
            timestamp: Date.now(),
          });
        } else if (msg.type === 'chat:send' && msg.text) {
          if (sender.muted) return;
          const chatMsg = {
            id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
            clientId,
            sender: String(sender.avatar?.displayName || 'Guest'),
            text: msg.text.slice(0, 220),
            timestamp: Date.now(),
            color: String(sender.avatar?.outfitColor || '#00E5FF'),
          };
          room.messages = [...room.messages.slice(-49), chatMsg];
          broadcastRoom(room, { type: 'chat:message', message: chatMsg });
        } else if (msg.type === 'host:moderate' && sender.isHost) {
          if (typeof msg.lockedEdits === 'boolean') room.lockedEdits = msg.lockedEdits;
          if (typeof msg.emotesEnabled === 'boolean') room.emotesEnabled = msg.emotesEnabled;
          if (msg.targetClientId) {
            const target = room.participants.get(msg.targetClientId);
            if (target && !target.isHost) {
              target.muted = !target.muted;
            }
          }
          broadcastRoom(room, {
            type: 'room:moderation',
            lockedEdits: room.lockedEdits,
            emotesEnabled: room.emotesEnabled,
            participants: serializeParticipants(room),
          });
        }
      } catch {
        // ignore malformed frame
      }
    });

    ws.on('close', leaveCurrentRoom);
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`CrowdStage server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start CrowdStage server:', err);
  process.exit(1);
});
