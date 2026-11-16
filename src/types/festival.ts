export type EnvironmentId =
  | 'neon-cyberpunk'
  | 'desert-festival'
  | 'floating-island'
  | 'futuristic-indian'
  | 'underwater-concert';

export type TimeOfDay = 'sunrise' | 'sunset' | 'midnight' | 'futuristic';

export type GraphicsProfile = 'low' | 'balanced' | 'ultra';

export type StageItemCategory =
  | 'stage'
  | 'dj-booth'
  | 'led-wall'
  | 'speaker'
  | 'laser'
  | 'decor'
  | 'barrier'
  | 'portal';

export type StageItemBlueprintType =
  | 'cyber-arch-stage'
  | 'mandala-lotus-stage'
  | 'crystal-dome-stage'
  | 'truss-megastage'
  | 'holo-dj-booth'
  | 'elevated-dj-riser'
  | 'led-monolith'
  | 'curved-led-wall'
  | 'line-array-tower'
  | 'sub-stack'
  | 'laser-rig'
  | 'sky-beam-turret'
  | 'holo-totem'
  | 'lotus-lantern'
  | 'geo-sculpture'
  | 'crowd-barrier'
  | 'vip-walkway'
  | 'portal-gate';

export interface StageItem {
  id: string;
  type: StageItemBlueprintType;
  category: StageItemCategory;
  label: string;
  position: [number, number, number];
  rotationY: number;
  scale: number;
  primaryColor: string;
  secondaryColor: string;
  intensity: number;
  portalTargetEnv?: EnvironmentId;
}

export type LedPreset =
  | 'spectrum'
  | 'plasma'
  | 'mandala'
  | 'waveform'
  | 'strobe-grid'
  | 'live-cam';

export type LightingChoreography = 'auto-dj' | 'pulse' | 'sweep' | 'chill';

export type StageFloorMaterial =
  | 'reflective-water'
  | 'polished-obsidian'
  | 'gridded-cyber-neon';

export type MainEventStyle =
  | 'dj'
  | 'rock-band'
  | 'break-dancer'
  | 'acrobats'
  | 'lolla-headliner';

export type StrobeMode = 'off' | 'beat-strobe' | 'hyper-blinder' | 'color-strobe';

export interface LightingConfig {
  primaryColor: string;
  secondaryColor: string;
  spotlightIntensity: number;
  laserSpeed: number;
  laserSpread: number;
  laserSharpness?: number;
  strobeFrequency: number;
  strobeMode?: StrobeMode;
  strobeIntensity?: number;
  stageFloorMaterial?: StageFloorMaterial;
  mainEventStyle?: MainEventStyle;
  fogDensity: number;
  ledPreset: LedPreset;
  choreography: LightingChoreography;
  beatSync: boolean;
  autoDj: boolean;
  reducedFlashing: boolean;
  bloomEnabled?: boolean;
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  chromaticAberration?: boolean;
  cameraShake?: boolean;
  volumetricBeams?: boolean;
}

export type CameraMode = 'orbit' | 'drone' | 'crowd-pov' | 'dj-booth' | 'wide-stage' | 'stage-closeup';

export interface CameraKeyframe {
  id: string;
  name: string;
  position: [number, number, number];
  target: [number, number, number];
  duration: number;
}

export type DanceStyle = 'bounce' | 'wave' | 'rave' | 'sway';
export type HairStyle = 'fade' | 'mohawk' | 'bob' | 'crown';
export type AvatarAccessory = 'visor' | 'halo' | 'headphones' | 'none';
export type AvatarStagePlacement = 'stage-dj' | 'crowd-front' | 'both';
export type FaceTextureMode = 'snapshot' | 'live-video' | 'stylized';
export type PerformerActionType = 'scratch' | 'hands-up' | 'laser-drop' | 'pyro-burst' | 'strobe-blinder';

export type VisualFxType = 'confetti' | 'pyrotechnics' | 'laser-burst' | 'spark-fountain' | 'strobe-storm';

export interface VisualFxConfig {
  effectType: VisualFxType;
  density: number; // 0.2 to 2.0
  primaryColor: string;
  secondaryColor: string;
  spread: number; // 0.3 to 2.0
  velocity: number; // 0.5 to 2.0
  autoBeatTrigger: boolean;
}

export interface VisualFxBurstEvent extends VisualFxConfig {
  id: string;
  timestamp: number;
}

export interface AvatarConfig {
  displayName: string;
  skinColor?: string;
  hairColor?: string;
  outfitColor: string;
  accentColor: string;
  hairStyle: HairStyle;
  accessory: AvatarAccessory;
  danceStyle: DanceStyle;
  position: [number, number, number];
  rotationY: number;
  webcamStageEnabled?: boolean;
  stagePlacement?: AvatarStagePlacement;
  faceTextureMode?: FaceTextureMode;
  hasScannedFace?: boolean;
  surrealAura?: boolean;
}

export interface WebcamPoseMetrics {
  active: boolean;
  usingSimulatedFeed: boolean;
  headX: number; // -1 to 1
  headY: number; // -1 to 1
  leftArmRaise: number; // 0 to 1
  rightArmRaise: number; // 0 to 1
  motionEnergy: number; // 0 to 1
}

export type CrowdModelStyle =
  | 'poly-festival'
  | 'streetwear-lowpoly'
  | 'cyber-raver'
  | 'lolla-mix';

export type CrowdAggressionLevel =
  | 'chill-grooving'
  | 'upbeat-bouncing'
  | 'hype-jumping'
  | 'mosh-frenzy';

export interface CrowdConfig {
  density: number; // 0 to 1
  choreography: DanceStyle;
  glowIntensity: number;
  modelStyle?: CrowdModelStyle;
  afrSensitivity?: number; // 0.4 to 2.2 (Audio Frequency Response gain)
  bpmOverride?: number | null; // null = live audio BPM, or 70..180 manual BPM
  propDensity?: number; // 0 to 1 (Smartphones, Festival Totems, Glow Wands)
}

export interface FestivalProject {
  id: string;
  name: string;
  creator: string;
  environment: EnvironmentId;
  timeOfDay: TimeOfDay;
  stageItems: StageItem[];
  lighting: LightingConfig;
  crowd: CrowdConfig;
  cameraSequence: CameraKeyframe[];
  remixedFrom?: string;
  allowRemix: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AudioMetrics {
  subBass?: number; // 20-60 Hz
  bass: number; // 60-250 Hz
  lowMid?: number; // 250-500 Hz
  mid: number; // 500-2000 Hz
  highMid?: number; // 2000-4000 Hz
  treble: number; // 4000-16000 Hz
  presence?: number; // 4000-8000 Hz
  brilliance?: number; // 8000-16000 Hz
  amplitude: number;
  beatIntensity: number;
  spectralFlux: number;
  bpmEstimate: number;
  crowdIntensity?: number; // 0 to 1
  danceSpeedMultiplier?: number; // 0.6x to 2.4x
  aggressionLevel?: CrowdAggressionLevel;
  isPlaying: boolean;
  sourceType: 'none' | 'synth' | 'file' | 'mic';
  trackName: string;
}

export type EmoteType = 'heart' | 'fire' | 'hands' | 'star';

export interface RemoteParticipant {
  clientId: string;
  avatar: AvatarConfig;
  lastEmote?: {
    type: EmoteType;
    timestamp: number;
  };
  isHost?: boolean;
  muted?: boolean;
}

export interface ChatMessage {
  id: string;
  clientId: string;
  sender: string;
  text: string;
  timestamp: number;
  color: string;
}

export interface RoomState {
  connected: boolean;
  roomId: string | null;
  isPublic: boolean;
  isHost: boolean;
  lockedEdits: boolean;
  emotesEnabled: boolean;
  clientId: string | null;
  participants: RemoteParticipant[];
  messages: ChatMessage[];
}

export type DockTab =
  | 'environments'
  | 'builder'
  | 'lighting'
  | 'audio'
  | 'camera'
  | 'crowd'
  | 'multiplayer';
