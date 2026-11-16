import { EmoteType, FestivalProject, RemoteParticipant } from '../types/festival';
import { useFestivalStore } from '../store/useFestivalStore';

class RoomClient {
  private ws: WebSocket | null = null;
  private activeRoomId: string | null = null;
  private isPublic = true;
  private reconnectTimer: number | null = null;
  private shouldReconnect = false;

  public joinRoom(roomId: string, isPublic = true) {
    this.activeRoomId = roomId.trim().toUpperCase();
    this.isPublic = isPublic;
    this.shouldReconnect = true;
    this.connect();
  }

  public leaveRoom() {
    this.shouldReconnect = false;
    this.activeRoomId = null;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    useFestivalStore.getState().setRoomState({
      connected: false,
      roomId: null,
      isHost: false,
      clientId: null,
      participants: [],
      messages: [],
    });
  }

  private connect() {
    if (!this.activeRoomId) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.ws.close();
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    this.ws = ws;

    ws.onopen = () => {
      const state = useFestivalStore.getState();
      ws.send(
        JSON.stringify({
          type: 'room:join',
          roomId: this.activeRoomId,
          isPublic: this.isPublic,
          avatar: state.avatar,
          project: state.project,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const store = useFestivalStore.getState();

        if (msg.type === 'room:joined') {
          store.setRoomState({
            connected: true,
            roomId: msg.roomId,
            isHost: Boolean(msg.isHost),
            isPublic: Boolean(msg.isPublic),
            lockedEdits: Boolean(msg.lockedEdits),
            emotesEnabled: msg.emotesEnabled !== false,
            clientId: msg.clientId,
            participants: (msg.participants as RemoteParticipant[]).filter(
              (p) => p.clientId !== msg.clientId
            ),
            messages: msg.messages || [],
          });
          if (!msg.isHost && msg.project) {
            store.setProject(msg.project as FestivalProject, false);
          }
          store.showToast(`Joined Room ${msg.roomId}`);
        } else if (msg.type === 'room:presence') {
          const cid = store.room.clientId;
          store.setParticipants(
            ((msg.participants as RemoteParticipant[]) || []).filter(
              (p) => p.clientId !== cid
            )
          );
          if (msg.hostId && cid) {
            store.setRoomState({ isHost: msg.hostId === cid });
          }
        } else if (msg.type === 'project:sync' && msg.project) {
          store.setProject(msg.project as FestivalProject, false);
        } else if (msg.type === 'emote:broadcast') {
          store.bumpLiveInteraction(4);
        } else if (msg.type === 'chat:message' && msg.message) {
          store.appendChatMessage(msg.message);
        } else if (msg.type === 'room:moderation') {
          const cid = store.room.clientId;
          store.setRoomState({
            lockedEdits: Boolean(msg.lockedEdits),
            emotesEnabled: Boolean(msg.emotesEnabled),
            participants: ((msg.participants as RemoteParticipant[]) || []).filter(
              (p) => p.clientId !== cid
            ),
          });
        }
      } catch {
        // ignore malformed incoming messages
      }
    };

    ws.onclose = () => {
      useFestivalStore.getState().setRoomState({ connected: false });
      if (this.shouldReconnect && this.activeRoomId) {
        this.reconnectTimer = window.setTimeout(() => this.connect(), 2500);
      }
    };
  }

  public sendAvatarUpdate() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'avatar:update',
          avatar: useFestivalStore.getState().avatar,
        })
      );
    }
  }

  public sendProjectSync(project: FestivalProject) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'project:sync', project }));
    }
  }

  public sendEmote(emote: EmoteType) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'emote:send', emote }));
    }
  }

  public sendChat(text: string) {
    if (this.ws?.readyState === WebSocket.OPEN && text.trim()) {
      this.ws.send(JSON.stringify({ type: 'chat:send', text: text.trim() }));
    }
  }

  public sendModeration(patch: {
    lockedEdits?: boolean;
    emotesEnabled?: boolean;
    targetClientId?: string;
  }) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'host:moderate', ...patch }));
    }
  }
}

export const sharedRoomClient = new RoomClient();
