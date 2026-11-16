import { create } from 'zustand';
import {
  AudioMetrics,
  AvatarConfig,
  CameraKeyframe,
  CameraMode,
  ChatMessage,
  CrowdConfig,
  DockTab,
  EmoteType,
  EnvironmentId,
  FestivalProject,
  GraphicsProfile,
  LightingConfig,
  PerformerActionType,
  RemoteParticipant,
  RoomState,
  StageItem,
  StageItemBlueprintType,
  TimeOfDay,
  VisualFxBurstEvent,
  VisualFxConfig,
} from '../types/festival';
import {
  buildDefaultStageItems,
  createDefaultFestival,
  ENVIRONMENTS,
  STAGE_CATALOG,
} from '../data/presets';

const AUTOSAVE_KEY = 'crowdstage_autosave_v1';
const SAVED_FESTIVALS_KEY = 'crowdstage_saved_projects_v1';

interface HistorySnapshot {
  project: FestivalProject;
}

interface FestivalStoreState {
  project: FestivalProject;
  savedProjects: FestivalProject[];
  communityProjects: FestivalProject[];
  past: HistorySnapshot[];
  future: HistorySnapshot[];

  selectedItemId: string | null;
  activeTab: DockTab;
  hudCollapsed: boolean;
  dashboardOpen: boolean;
  avatarScannerOpen: boolean;

  cameraMode: CameraMode;
  isPlayingSequence: boolean;
  autoDirectorEnabled: boolean;

  graphicsProfile: GraphicsProfile;
  batterySaver: boolean;
  measuredFps: number;
  webglSupported: boolean;
  webglContextLost: boolean;

  audio: AudioMetrics;
  avatar: AvatarConfig;
  liveInteractions: number;
  simulatedEnergy: number;
  localEmoteBurst: { type: EmoteType; timestamp: number } | null;
  beamEffectTimestamp: number;
  activePerformerAction: { type: PerformerActionType; timestamp: number } | null;
  visualFxConfig: VisualFxConfig;
  lastVisualFxBurst: VisualFxBurstEvent | null;
  gestureControlEnabled: boolean;

  room: RoomState;
  toastMessage: string | null;

  // Actions
  setProject: (project: FestivalProject, recordHistory?: boolean) => void;
  updateProjectMeta: (partial: Partial<Pick<FestivalProject, 'name' | 'creator' | 'allowRemix'>>) => void;
  switchEnvironment: (env: EnvironmentId, replaceStage?: boolean) => void;
  setTimeOfDay: (time: TimeOfDay) => void;

  selectItem: (id: string | null) => void;
  addStageItem: (type: StageItemBlueprintType, position?: [number, number, number]) => StageItem;
  updateStageItem: (id: string, patch: Partial<StageItem>, recordHistory?: boolean) => void;
  removeStageItem: (id: string) => void;
  duplicateSelectedItem: () => void;

  updateLighting: (patch: Partial<LightingConfig>) => void;
  updateCrowd: (patch: Partial<CrowdConfig>) => void;
  updateAvatar: (patch: Partial<AvatarConfig>) => void;

  setCameraMode: (mode: CameraMode) => void;
  addCameraKeyframe: (kf: CameraKeyframe) => void;
  removeCameraKeyframe: (id: string) => void;
  setPlayingSequence: (playing: boolean) => void;
  setAutoDirectorEnabled: (enabled: boolean) => void;

  setActiveTab: (tab: DockTab) => void;
  setHudCollapsed: (collapsed: boolean) => void;
  setDashboardOpen: (open: boolean) => void;
  setAvatarScannerOpen: (open: boolean) => void;

  setGraphicsProfile: (profile: GraphicsProfile) => void;
  setBatterySaver: (enabled: boolean) => void;
  setMeasuredFps: (fps: number) => void;
  setWebglStatus: (supported: boolean, lost: boolean) => void;

  setAudioMetrics: (metrics: Partial<AudioMetrics>) => void;
  triggerEmote: (type: EmoteType) => void;
  triggerBeamToStage: () => void;
  triggerPerformerAction: (type: PerformerActionType) => void;
  updateVisualFxConfig: (patch: Partial<VisualFxConfig>) => void;
  triggerVisualFxBurst: (override?: Partial<VisualFxConfig>) => void;
  bumpLiveInteraction: (amount?: number) => void;
  setSimulatedEnergy: (val: number) => void;
  setGestureControlEnabled: (enabled: boolean) => void;

  // History
  undo: () => void;
  redo: () => void;

  // Persistence
  saveCurrentProject: () => Promise<FestivalProject>;
  loadSavedProjects: () => void;
  duplicateProject: (id: string) => void;
  deleteSavedProject: (id: string) => void;
  setCommunityProjects: (projects: FestivalProject[]) => void;
  remixProject: (source: FestivalProject) => void;

  // Multiplayer room state
  setRoomState: (patch: Partial<RoomState>) => void;
  setParticipants: (participants: RemoteParticipant[]) => void;
  appendChatMessage: (msg: ChatMessage) => void;

  showToast: (msg: string) => void;
}

function loadInitialProject(): FestivalProject {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FestivalProject;
      if (parsed && parsed.stageItems && parsed.lighting) {
        return parsed;
      }
    }
  } catch {
    // ignore storage parse failure
  }
  return createDefaultFestival('neon-cyberpunk');
}

function loadLocalSaved(): FestivalProject[] {
  try {
    const raw = localStorage.getItem(SAVED_FESTIVALS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FestivalProject[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function detectInitialProfile(): GraphicsProfile {
  if (typeof navigator === 'undefined') return 'balanced';
  const cores = navigator.hardwareConcurrency || 4;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile && cores <= 4) return 'low';
  if (isMobile || cores <= 6) return 'balanced';
  return 'ultra';
}

function persistAutosave(project: FestivalProject) {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
  } catch {
    // ignore quota errors
  }
}

export const useFestivalStore = create<FestivalStoreState>((set, get) => ({
  project: loadInitialProject(),
  savedProjects: loadLocalSaved(),
  communityProjects: [],
  past: [],
  future: [],

  selectedItemId: null,
  activeTab: 'environments',
  hudCollapsed: false,
  dashboardOpen: false,
  avatarScannerOpen: false,

  cameraMode: 'orbit',
  isPlayingSequence: false,
  autoDirectorEnabled: false,

  graphicsProfile: detectInitialProfile(),
  batterySaver: false,
  measuredFps: 60,
  webglSupported: true,
  webglContextLost: false,

  audio: {
    subBass: 0,
    bass: 0,
    lowMid: 0,
    mid: 0,
    highMid: 0,
    treble: 0,
    presence: 0,
    brilliance: 0,
    amplitude: 0,
    beatIntensity: 0,
    spectralFlux: 0,
    bpmEstimate: 124,
    crowdIntensity: 0.22,
    danceSpeedMultiplier: 1.0,
    aggressionLevel: 'upbeat-bouncing',
    isPlaying: false,
    sourceType: 'none',
    trackName: 'No track active',
  },
  avatar: {
    displayName: 'Festival Creator',
    outfitColor: '#00E5FF',
    accentColor: '#FF3CAC',
    skinColor: '#E2B897',
    hairColor: '#1E1B4B',
    hairStyle: 'fade',
    accessory: 'visor',
    danceStyle: 'bounce',
    position: [0, 0, 7],
    rotationY: Math.PI,
    webcamStageEnabled: false,
    stagePlacement: 'both',
    surrealAura: true,
    faceTextureMode: 'snapshot',
    hasScannedFace: false,
  },
  liveInteractions: 0,
  simulatedEnergy: 38,
  localEmoteBurst: null,
  beamEffectTimestamp: 0,
  activePerformerAction: null,
  visualFxConfig: {
    effectType: 'confetti',
    density: 1.0,
    primaryColor: '#00E5FF',
    secondaryColor: '#FF3CAC',
    spread: 1.0,
    velocity: 1.0,
    autoBeatTrigger: false,
  },
  lastVisualFxBurst: null,
  gestureControlEnabled: false,

  room: {
    connected: false,
    roomId: null,
    isPublic: true,
    isHost: false,
    lockedEdits: false,
    emotesEnabled: true,
    clientId: null,
    participants: [],
    messages: [],
  },
  toastMessage: null,

  setProject: (project, recordHistory = true) => {
    const prev = get().project;
    const next = { ...project, updatedAt: Date.now() };
    persistAutosave(next);
    set((state) => ({
      project: next,
      past: recordHistory ? [...state.past.slice(-24), { project: prev }] : state.past,
      future: recordHistory ? [] : state.future,
      selectedItemId: null,
    }));
  },

  updateProjectMeta: (partial) => {
    const prev = get().project;
    const next = { ...prev, ...partial, updatedAt: Date.now() };
    persistAutosave(next);
    set({ project: next });
  },

  switchEnvironment: (env, replaceStage = true) => {
    const prev = get().project;
    const meta = ENVIRONMENTS.find((e) => e.id === env) ?? ENVIRONMENTS[0];
    const next: FestivalProject = {
      ...prev,
      environment: env,
      timeOfDay: meta.defaultTime,
      stageItems: replaceStage ? buildDefaultStageItems(env) : prev.stageItems,
      lighting: {
        ...prev.lighting,
        primaryColor: meta.primaryColor,
        secondaryColor: meta.secondaryColor,
        ledPreset: env === 'futuristic-indian' ? 'mandala' : prev.lighting.ledPreset,
      },
      updatedAt: Date.now(),
    };
    persistAutosave(next);
    set((state) => ({
      project: next,
      past: [...state.past.slice(-24), { project: prev }],
      future: [],
      selectedItemId: null,
    }));
  },

  setTimeOfDay: (timeOfDay) => {
    const prev = get().project;
    const next = { ...prev, timeOfDay, updatedAt: Date.now() };
    persistAutosave(next);
    set((state) => ({
      project: next,
      past: [...state.past.slice(-24), { project: prev }],
      future: [],
    }));
  },

  selectItem: (id) => set({ selectedItemId: id }),

  addStageItem: (type, position) => {
    const blueprint = STAGE_CATALOG.find((b) => b.type === type) ?? STAGE_CATALOG[0];
    const prev = get().project;
    const count = prev.stageItems.length;
    const angle = (count * 0.85) % (Math.PI * 2);
    const defaultPos: [number, number, number] = position ?? [
      Math.round(Math.sin(angle) * 6 * 10) / 10,
      0,
      Math.round((Math.cos(angle) * 5 - 3) * 10) / 10,
    ];
    const item: StageItem = {
      id: `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      type: blueprint.type,
      category: blueprint.category,
      label: blueprint.label,
      position: defaultPos,
      rotationY: 0,
      scale: blueprint.defaultScale,
      primaryColor: prev.lighting.primaryColor || blueprint.defaultPrimary,
      secondaryColor: prev.lighting.secondaryColor || blueprint.defaultSecondary,
      intensity: 1,
      portalTargetEnv: blueprint.category === 'portal' ? 'futuristic-indian' : undefined,
    };
    const next = {
      ...prev,
      stageItems: [...prev.stageItems, item],
      updatedAt: Date.now(),
    };
    persistAutosave(next);
    set((state) => ({
      project: next,
      selectedItemId: item.id,
      past: [...state.past.slice(-24), { project: prev }],
      future: [],
    }));
    get().bumpLiveInteraction(4);
    return item;
  },

  updateStageItem: (id, patch, recordHistory = false) => {
    const prev = get().project;
    const next = {
      ...prev,
      stageItems: prev.stageItems.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      updatedAt: Date.now(),
    };
    persistAutosave(next);
    set((state) => ({
      project: next,
      past: recordHistory ? [...state.past.slice(-24), { project: prev }] : state.past,
      future: recordHistory ? [] : state.future,
    }));
  },

  removeStageItem: (id) => {
    const prev = get().project;
    const next = {
      ...prev,
      stageItems: prev.stageItems.filter((it) => it.id !== id),
      updatedAt: Date.now(),
    };
    persistAutosave(next);
    set((state) => ({
      project: next,
      selectedItemId: state.selectedItemId === id ? null : state.selectedItemId,
      past: [...state.past.slice(-24), { project: prev }],
      future: [],
    }));
  },

  duplicateSelectedItem: () => {
    const { selectedItemId, project } = get();
    const source = project.stageItems.find((it) => it.id === selectedItemId);
    if (!source) return;
    const clone: StageItem = {
      ...source,
      id: `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      label: `${source.label} Copy`,
      position: [source.position[0] + 2.5, source.position[1], source.position[2] + 1.5],
    };
    const next = {
      ...project,
      stageItems: [...project.stageItems, clone],
      updatedAt: Date.now(),
    };
    persistAutosave(next);
    set((state) => ({
      project: next,
      selectedItemId: clone.id,
      past: [...state.past.slice(-24), { project }],
      future: [],
    }));
  },

  updateLighting: (patch) => {
    const prev = get().project;
    const next = {
      ...prev,
      lighting: { ...prev.lighting, ...patch },
      updatedAt: Date.now(),
    };
    persistAutosave(next);
    set({ project: next });
  },

  updateCrowd: (patch) => {
    const prev = get().project;
    const next = {
      ...prev,
      crowd: { ...prev.crowd, ...patch },
      updatedAt: Date.now(),
    };
    persistAutosave(next);
    set({ project: next });
  },

  updateAvatar: (patch) => {
    set((state) => ({
      avatar: { ...state.avatar, ...patch },
    }));
  },

  setCameraMode: (cameraMode) => set({ cameraMode, isPlayingSequence: false }),

  addCameraKeyframe: (kf) => {
    const prev = get().project;
    const next = {
      ...prev,
      cameraSequence: [...prev.cameraSequence, kf],
      updatedAt: Date.now(),
    };
    persistAutosave(next);
    set({ project: next });
  },

  removeCameraKeyframe: (id) => {
    const prev = get().project;
    const next = {
      ...prev,
      cameraSequence: prev.cameraSequence.filter((k) => k.id !== id),
      updatedAt: Date.now(),
    };
    persistAutosave(next);
    set({ project: next });
  },

  setPlayingSequence: (isPlayingSequence) => set({ isPlayingSequence }),
  setAutoDirectorEnabled: (autoDirectorEnabled) =>
    set((state) => ({
      autoDirectorEnabled,
      isPlayingSequence: false,
      cameraMode: autoDirectorEnabled ? 'stage-closeup' : state.cameraMode,
    })),

  setActiveTab: (activeTab) => set({ activeTab, hudCollapsed: false }),
  setHudCollapsed: (hudCollapsed) => set({ hudCollapsed }),
  setDashboardOpen: (dashboardOpen) => set({ dashboardOpen }),
  setAvatarScannerOpen: (avatarScannerOpen) => set({ avatarScannerOpen }),

  setGraphicsProfile: (graphicsProfile) => set({ graphicsProfile }),
  setBatterySaver: (batterySaver) =>
    set((state) => ({
      batterySaver,
      graphicsProfile: batterySaver ? 'low' : state.graphicsProfile,
    })),
  setMeasuredFps: (measuredFps) => set({ measuredFps }),
  setWebglStatus: (webglSupported, webglContextLost) =>
    set({ webglSupported, webglContextLost }),

  setAudioMetrics: (metrics) =>
    set((state) => ({ audio: { ...state.audio, ...metrics } })),

  triggerEmote: (type) => {
    const burst = { type, timestamp: Date.now() };
    set((state) => ({
      localEmoteBurst: burst,
      liveInteractions: Math.min(100, state.liveInteractions + 6),
    }));
  },

  triggerBeamToStage: () => {
    const now = Date.now();
    set((state) => ({
      beamEffectTimestamp: now,
      cameraMode: 'stage-closeup',
      isPlayingSequence: false,
      avatar: {
        ...state.avatar,
        webcamStageEnabled: true,
        stagePlacement: 'both',
      },
      liveInteractions: Math.min(100, state.liveInteractions + 15),
    }));
  },

  triggerPerformerAction: (type) => {
    const now = Date.now();
    set((state) => ({
      activePerformerAction: { type, timestamp: now },
      liveInteractions: Math.min(100, state.liveInteractions + 10),
    }));
  },

  updateVisualFxConfig: (patch) =>
    set((state) => ({
      visualFxConfig: { ...state.visualFxConfig, ...patch },
    })),

  triggerVisualFxBurst: (override) => {
    const now = Date.now();
    const cfg = { ...get().visualFxConfig, ...override };
    const burst: VisualFxBurstEvent = {
      ...cfg,
      id: `vfx-${now.toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      timestamp: now,
    };
    set((state) => ({
      visualFxConfig: cfg,
      lastVisualFxBurst: burst,
      liveInteractions: Math.min(100, state.liveInteractions + 12),
    }));
  },

  bumpLiveInteraction: (amount = 3) =>
    set((state) => ({
      liveInteractions: Math.min(100, state.liveInteractions + amount),
    })),

  setSimulatedEnergy: (simulatedEnergy) => set({ simulatedEnergy }),
  setGestureControlEnabled: (gestureControlEnabled) => set({ gestureControlEnabled }),

  undo: () => {
    const { past, project, future } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    persistAutosave(previous.project);
    set({
      project: previous.project,
      past: past.slice(0, -1),
      future: [{ project }, ...future.slice(0, 24)],
      selectedItemId: null,
    });
  },

  redo: () => {
    const { past, project, future } = get();
    if (future.length === 0) return;
    const next = future[0];
    persistAutosave(next.project);
    set({
      project: next.project,
      past: [...past, { project }],
      future: future.slice(1),
      selectedItemId: null,
    });
  },

  saveCurrentProject: async () => {
    const current = { ...get().project, updatedAt: Date.now() };
    const existing = get().savedProjects.filter((p) => p.id !== current.id);
    const updatedList = [current, ...existing];
    try {
      localStorage.setItem(SAVED_FESTIVALS_KEY, JSON.stringify(updatedList));
    } catch {
      // ignore quota
    }
    set({ savedProjects: updatedList, project: current });

    try {
      await fetch('/api/festivals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(current),
      });
    } catch {
      // offline/fallback gracefully to localStorage
    }
    get().showToast('Festival saved');
    return current;
  },

  loadSavedProjects: () => {
    set({ savedProjects: loadLocalSaved() });
  },

  duplicateProject: (id) => {
    const list = get().savedProjects;
    const source = list.find((p) => p.id === id) ?? get().project;
    const now = Date.now();
    const copy: FestivalProject = {
      ...JSON.parse(JSON.stringify(source)),
      id: `fest-${now.toString(36)}`,
      name: `${source.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };
    const updatedList = [copy, ...list];
    try {
      localStorage.setItem(SAVED_FESTIVALS_KEY, JSON.stringify(updatedList));
    } catch {
      // ignore
    }
    set({ savedProjects: updatedList, project: copy });
    get().showToast('Project duplicated');
  },

  deleteSavedProject: (id) => {
    const updatedList = get().savedProjects.filter((p) => p.id !== id);
    try {
      localStorage.setItem(SAVED_FESTIVALS_KEY, JSON.stringify(updatedList));
    } catch {
      // ignore
    }
    set({ savedProjects: updatedList });
  },

  setCommunityProjects: (communityProjects) => set({ communityProjects }),

  remixProject: (source) => {
    const now = Date.now();
    const remixed: FestivalProject = {
      ...JSON.parse(JSON.stringify(source)),
      id: `fest-${now.toString(36)}`,
      name: `${source.name} Remix`,
      creator: get().avatar.displayName || 'You',
      remixedFrom: source.creator,
      createdAt: now,
      updatedAt: now,
    };
    persistAutosave(remixed);
    set((state) => ({
      project: remixed,
      past: [...state.past.slice(-24), { project: state.project }],
      future: [],
      dashboardOpen: false,
    }));
    get().showToast(`Remixed from ${source.creator}`);
  },

  setRoomState: (patch) =>
    set((state) => ({
      room: { ...state.room, ...patch },
    })),

  setParticipants: (participants) =>
    set((state) => ({
      room: { ...state.room, participants },
    })),

  appendChatMessage: (msg) =>
    set((state) => ({
      room: {
        ...state.room,
        messages: [...state.room.messages.slice(-49), msg],
      },
    })),

  showToast: (toastMessage) => {
    set({ toastMessage });
    window.setTimeout(() => {
      if (get().toastMessage === toastMessage) {
        set({ toastMessage: null });
      }
    }, 2600);
  },
}));
