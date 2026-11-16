import { useMemo, useRef, useState } from 'react';
import {
  AudioLines,
  BatteryCharging,
  Box,
  Camera,
  ChevronDown,
  ChevronUp,
  Copy,
  Flame,
  Globe,
  Hand,
  Heart,
  Lock,
  Mic,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCw,
  Send,
  Shield,
  Sliders,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Unlock,
  Upload,
  Users,
  Video,
  Zap,
} from 'lucide-react';
import { useFestivalStore } from '../store/useFestivalStore';
import { ENVIRONMENTS, STAGE_CATALOG } from '../data/presets';
import {
  AvatarAccessory,
  AvatarStagePlacement,
  CameraMode,
  CrowdModelStyle,
  DanceStyle,
  DockTab,
  EmoteType,
  EnvironmentId,
  HairStyle,
  LedPreset,
  LightingChoreography,
  MainEventStyle,
  StageFloorMaterial,
  StageItemCategory,
  StrobeMode,
  TimeOfDay,
} from '../types/festival';
import { sharedAudioEngine } from '../audio/AudioEngine';
import { AudioSpectrumCanvas } from './AudioSpectrumCanvas';
import { HandGestureController } from './HandGestureController';
import { sharedRoomClient } from '../realtime/roomClient';
import { sharedWebcamBridge } from '../engine/webcamBridge';

interface BottomDockProps {
  onCaptureCameraKeyframe: () => void;
}

const TABS: Array<{ id: DockTab; label: string; icon: typeof Globe }> = [
  { id: 'environments', label: 'Worlds', icon: Globe },
  { id: 'builder', label: 'Build', icon: Box },
  { id: 'lighting', label: 'Lights', icon: Zap },
  { id: 'audio', label: 'Audio', icon: AudioLines },
  { id: 'camera', label: 'Camera', icon: Video },
  { id: 'crowd', label: 'Crowd', icon: Users },
  { id: 'multiplayer', label: 'Rooms', icon: Radio },
];

const COLOR_SWATCHES = [
  '#00E5FF',
  '#FF3CAC',
  '#2162F5',
  '#8B5CF6',
  '#FFB703',
  '#10B981',
  '#F43F5E',
  '#FF7B29',
];

export function BottomDock({ onCaptureCameraKeyframe }: BottomDockProps) {
  const activeTab = useFestivalStore((s) => s.activeTab);
  const setActiveTab = useFestivalStore((s) => s.setActiveTab);
  const hudCollapsed = useFestivalStore((s) => s.hudCollapsed);

  const [drawerMinimized, setDrawerMinimized] = useState(false);
  const [buildCategory, setBuildCategory] = useState<'all' | StageItemCategory>('all');
  const [synthBpm, setSynthBpm] = useState(124);
  const [volume, setVolume] = useState(0.85);
  const [roomCodeInput, setRoomCodeInput] = useState('STAGE01');
  const [roomIsPublic, setRoomIsPublic] = useState(true);
  const [chatInput, setChatInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const project = useFestivalStore((s) => s.project);
  const selectedItemId = useFestivalStore((s) => s.selectedItemId);
  const selectItem = useFestivalStore((s) => s.selectItem);
  const addStageItem = useFestivalStore((s) => s.addStageItem);
  const updateStageItem = useFestivalStore((s) => s.updateStageItem);
  const removeStageItem = useFestivalStore((s) => s.removeStageItem);
  const duplicateSelectedItem = useFestivalStore((s) => s.duplicateSelectedItem);

  const switchEnvironment = useFestivalStore((s) => s.switchEnvironment);
  const setTimeOfDay = useFestivalStore((s) => s.setTimeOfDay);
  const updateLighting = useFestivalStore((s) => s.updateLighting);
  const updateCrowd = useFestivalStore((s) => s.updateCrowd);
  const updateAvatar = useFestivalStore((s) => s.updateAvatar);

  const cameraMode = useFestivalStore((s) => s.cameraMode);
  const setCameraMode = useFestivalStore((s) => s.setCameraMode);
  const isPlayingSequence = useFestivalStore((s) => s.isPlayingSequence);
  const setPlayingSequence = useFestivalStore((s) => s.setPlayingSequence);
  const removeCameraKeyframe = useFestivalStore((s) => s.removeCameraKeyframe);

  const audio = useFestivalStore((s) => s.audio);
  const setAudioMetrics = useFestivalStore((s) => s.setAudioMetrics);

  const avatar = useFestivalStore((s) => s.avatar);
  const triggerEmote = useFestivalStore((s) => s.triggerEmote);
  const liveInteractions = useFestivalStore((s) => s.liveInteractions);
  const simulatedEnergy = useFestivalStore((s) => s.simulatedEnergy);

  const batterySaver = useFestivalStore((s) => s.batterySaver);
  const setBatterySaver = useFestivalStore((s) => s.setBatterySaver);

  const room = useFestivalStore((s) => s.room);
  const showToast = useFestivalStore((s) => s.showToast);

  const selectedItem = useMemo(
    () => project.stageItems.find((i) => i.id === selectedItemId) ?? null,
    [project.stageItems, selectedItemId]
  );

  const filteredCatalog = useMemo(
    () =>
      buildCategory === 'all'
        ? STAGE_CATALOG
        : STAGE_CATALOG.filter((b) => b.category === buildCategory),
    [buildCategory]
  );

  if (hudCollapsed) return null;

  const handleAudioUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      await sharedAudioEngine.loadFile(file);
      setAudioMetrics({
        isPlaying: true,
        sourceType: 'file',
        trackName: file.name.replace(/\.[^/.]+$/, ''),
      });
      showToast(`Loaded "${file.name}"`);
    } catch {
      showToast('Could not play audio file — check format');
    }
  };

  const handleStartSynth = async (bpm: number) => {
    setSynthBpm(bpm);
    await sharedAudioEngine.startSynth(bpm);
    setAudioMetrics({
      isPlaying: true,
      sourceType: 'synth',
      trackName: `CrowdStage Live Synth (${bpm} BPM)`,
      bpmEstimate: bpm,
    });
  };

  const handleStartMic = async () => {
    try {
      await sharedAudioEngine.startMicrophone();
      setAudioMetrics({
        isPlaying: true,
        sourceType: 'mic',
        trackName: 'Live Microphone Input',
      });
      showToast('Live Mic reactive mode enabled');
    } catch {
      showToast('Microphone permission declined or unavailable');
    }
  };

  const handleSendEmote = (type: EmoteType) => {
    triggerEmote(type);
    if (room.connected) {
      sharedRoomClient.sendEmote(type);
    }
  };

  const handleAvatarPatch = (patch: Partial<typeof avatar>) => {
    updateAvatar(patch);
    if (room.connected) {
      window.setTimeout(() => sharedRoomClient.sendAvatarUpdate(), 20);
    }
  };

  const handleToggleWebcamStage = async () => {
    if (avatar.webcamStageEnabled) {
      sharedWebcamBridge.stop();
      handleAvatarPatch({ webcamStageEnabled: false });
      showToast('Left Main Stage DJ Deck');
    } else {
      const res = await sharedWebcamBridge.startLiveWebcam();
      if (!avatar.hasScannedFace) {
        const scan = sharedWebcamBridge.scanAndExtractAvatarColors(
          project.lighting.primaryColor,
          project.lighting.secondaryColor
        );
        handleAvatarPatch({
          skinColor: scan.skinColor,
          hairColor: scan.hairColor,
          hasScannedFace: true,
        });
      }
      useFestivalStore.getState().triggerBeamToStage();
      showToast(
        res.simulated
          ? 'Beamed 3D Avatar onto Main Stage (Demo Pose Tracking Active)'
          : 'Beamed your 3D Avatar onto Main Stage! Performer Mode HUD active.'
      );
    }
  };

  const handleActivateSimulatedPerformer = () => {
    sharedWebcamBridge.startSimulatedPerformer();
    const scan = sharedWebcamBridge.scanAndExtractAvatarColors(
      project.lighting.primaryColor,
      project.lighting.secondaryColor
    );
    handleAvatarPatch({
      skinColor: scan.skinColor,
      hairColor: scan.hairColor,
      hasScannedFace: true,
      webcamStageEnabled: true,
      stagePlacement: 'both',
    });
    useFestivalStore.getState().triggerBeamToStage();
    showToast('Beamed 3D Demo Performer onto Main Stage!');
  };

  const handleJoinRoom = () => {
    const code = roomCodeInput.trim().toUpperCase() || 'STAGE01';
    sharedRoomClient.joinRoom(code, roomIsPublic);
  };

  const handleCopyRoomInvite = async () => {
    if (!room.roomId) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(room.roomId)}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Room invite link copied');
    } catch {
      showToast(`Share code: ${room.roomId}`);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sharedRoomClient.sendChat(chatInput);
    setChatInput('');
  };

  return (
    <div className="pointer-events-none fixed bottom-3 left-1/2 z-20 flex w-[min(940px,96vw)] -translate-x-1/2 flex-col items-center gap-2">
      {/* Contextual Selected Stage Element Bar */}
      {selectedItem && (
        <div className="pointer-events-auto flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-[#00E5FF]/35 bg-[#080B1D]/92 px-3 py-2 text-xs shadow-lg">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-[#00E5FF] truncate max-w-[140px]">
              {selectedItem.label}
            </span>
            <span className="hidden sm:inline text-slate-400">
              Drag in 3D to move
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                updateStageItem(selectedItem.id, {
                  rotationY: selectedItem.rotationY + Math.PI / 12,
                })
              }
              className="inline-flex items-center gap-1 rounded-lg bg-white/8 px-2.5 py-1.5 text-slate-200 hover:bg-white/14 min-h-[36px]"
              title="Rotate 15°"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>Rotate</span>
            </button>

            <label className="flex items-center gap-1.5 rounded-lg bg-white/8 px-2 py-1 text-slate-300 min-h-[36px]">
              <span>Scale</span>
              <input
                type="range"
                min={0.5}
                max={1.8}
                step={0.05}
                value={selectedItem.scale}
                onChange={(e) =>
                  updateStageItem(selectedItem.id, { scale: Number(e.target.value) })
                }
                className="crowd-slider w-16"
              />
            </label>

            <input
              type="color"
              aria-label="Element Primary Color"
              value={selectedItem.primaryColor}
              onChange={(e) =>
                updateStageItem(selectedItem.id, { primaryColor: e.target.value })
              }
              className="h-8 w-8 cursor-pointer rounded border border-white/15 bg-transparent"
            />
            <input
              type="color"
              aria-label="Element Secondary Color"
              value={selectedItem.secondaryColor}
              onChange={(e) =>
                updateStageItem(selectedItem.id, { secondaryColor: e.target.value })
              }
              className="h-8 w-8 cursor-pointer rounded border border-white/15 bg-transparent"
            />

            {selectedItem.category === 'portal' && (
              <div className="flex items-center gap-1">
                <select
                  aria-label="Portal Destination"
                  value={selectedItem.portalTargetEnv || 'futuristic-indian'}
                  onChange={(e) =>
                    updateStageItem(selectedItem.id, {
                      portalTargetEnv: e.target.value as EnvironmentId,
                    })
                  }
                  className="rounded-lg border border-white/15 bg-[#0F142B] px-2 py-1.5 text-xs text-white min-h-[36px]"
                >
                  {ENVIRONMENTS.map((env) => (
                    <option key={env.id} value={env.id}>
                      → {env.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    switchEnvironment(
                      selectedItem.portalTargetEnv || 'futuristic-indian',
                      true
                    )
                  }
                  className="rounded-lg bg-[#8B5CF6] px-2.5 py-1.5 font-semibold text-white hover:bg-[#9D74FA] min-h-[36px]"
                >
                  Enter Portal
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={duplicateSelectedItem}
              className="inline-flex items-center gap-1 rounded-lg bg-white/8 px-2 py-1.5 text-slate-200 hover:bg-white/14 min-h-[36px]"
              title="Duplicate"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => removeStageItem(selectedItem.id)}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 px-2 py-1.5 text-rose-300 hover:bg-rose-500/30 min-h-[36px]"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => selectItem(null)}
              className="rounded-lg px-2 py-1.5 text-slate-400 hover:text-white min-h-[36px]"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Collapse / Expand Dock Handle */}
      <button
        type="button"
        onClick={() => setDrawerMinimized(!drawerMinimized)}
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-t-xl border border-b-0 border-white/12 bg-[#080B1D]/92 px-4 py-1.5 text-[11px] font-medium text-slate-300 hover:text-white"
      >
        {drawerMinimized ? (
          <>
            <ChevronUp className="h-3.5 w-3.5 text-[#00E5FF]" />
            Expand Studio Dock
          </>
        ) : (
          <>
            <ChevronDown className="h-3.5 w-3.5 text-[#00E5FF]" />
            Collapse Dock
          </>
        )}
      </button>

      {/* Main Dock Container */}
      <div className="pointer-events-auto w-full rounded-2xl border border-white/12 bg-[#080B1D]/92 shadow-2xl overflow-hidden">
        {/* Drawer Content */}
        {!drawerMinimized && (
          <div className="crowd-scroll max-h-[38vh] sm:max-h-[255px] overflow-y-auto border-b border-white/10 p-3 sm:p-4">
            {/* TAB 1: ENVIRONMENTS & TIME MACHINE */}
            {activeTab === 'environments' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-200">
                    Festival Worlds
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 mr-1">
                      <Sun className="h-3.5 w-3.5 text-amber-400" />
                      Time Machine:
                    </span>
                    {(['sunrise', 'sunset', 'midnight', 'futuristic'] as TimeOfDay[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTimeOfDay(t)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors min-h-[34px] ${
                          project.timeOfDay === t
                            ? 'bg-[#2162F5] text-white'
                            : 'bg-white/6 text-slate-300 hover:bg-white/12'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setBatterySaver(!batterySaver)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium min-h-[34px] ${
                        batterySaver
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-white/6 text-slate-300 hover:bg-white/12'
                      }`}
                    >
                      <BatteryCharging className="h-3.5 w-3.5" />
                      Battery Saver
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                  {ENVIRONMENTS.map((env) => {
                    const active = project.environment === env.id;
                    return (
                      <button
                        key={env.id}
                        type="button"
                        onClick={() => {
                          switchEnvironment(env.id, true);
                          if (room.connected) {
                            window.setTimeout(
                              () => sharedRoomClient.sendProjectSync(useFestivalStore.getState().project),
                              40
                            );
                          }
                        }}
                        className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-colors min-h-[68px] ${
                          active
                            ? 'border-[#00E5FF] bg-[#00E5FF]/10'
                            : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white truncate">
                            {env.name}
                          </span>
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: env.primaryColor }}
                          />
                        </div>
                        <span className="text-[11px] leading-snug text-slate-400 line-clamp-2">
                          {env.subtitle}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: INTERACTIVE STAGE BUILDER */}
            {activeTab === 'builder' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    {(
                      [
                        ['all', 'All'],
                        ['stage', 'Stages'],
                        ['dj-booth', 'DJ Booth'],
                        ['led-wall', 'LED'],
                        ['speaker', 'Speakers'],
                        ['laser', 'Lasers'],
                        ['decor', 'Decor'],
                        ['barrier', 'Barriers'],
                        ['portal', 'Portals'],
                      ] as const
                    ).map(([cat, label]) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setBuildCategory(cat)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 min-h-[34px] ${
                          buildCategory === cat
                            ? 'bg-[#2162F5] text-white'
                            : 'bg-white/6 text-slate-300 hover:bg-white/12'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Tap to add · Tap & drag in 3D to reposition
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {filteredCatalog.map((bp) => (
                    <button
                      key={bp.type}
                      type="button"
                      disabled={room.connected && room.lockedEdits && !room.isHost}
                      onClick={() => {
                        addStageItem(bp.type);
                        if (room.connected) {
                          window.setTimeout(
                            () => sharedRoomClient.sendProjectSync(useFestivalStore.getState().project),
                            40
                          );
                        }
                      }}
                      className="flex flex-col justify-between gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-left hover:border-[#00E5FF]/50 hover:bg-white/[0.08] disabled:opacity-40 min-h-[64px]"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[11px] font-medium text-slate-400 capitalize">
                          {bp.category.replace('-', ' ')}
                        </span>
                        <Plus className="h-3.5 w-3.5 text-[#00E5FF]" />
                      </div>
                      <span className="text-xs font-semibold text-white leading-tight">
                        {bp.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: SMART FESTIVAL LIGHTING CONSOLE */}
            {activeTab === 'lighting' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Colors & LED Presets */}
                  <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                      <span>Palette & LED Shader</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          aria-label="Primary Lighting Color"
                          value={project.lighting.primaryColor}
                          onChange={(e) => updateLighting({ primaryColor: e.target.value })}
                          className="h-6 w-6 cursor-pointer rounded border border-white/15 bg-transparent"
                        />
                        <input
                          type="color"
                          aria-label="Secondary Lighting Color"
                          value={project.lighting.secondaryColor}
                          onChange={(e) => updateLighting({ secondaryColor: e.target.value })}
                          className="h-6 w-6 cursor-pointer rounded border border-white/15 bg-transparent"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {COLOR_SWATCHES.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          aria-label={`Color ${hex}`}
                          onClick={() => updateLighting({ primaryColor: hex })}
                          className={`h-6 w-6 rounded-md border ${
                            project.lighting.primaryColor === hex
                              ? 'border-white scale-110'
                              : 'border-white/20'
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {(
                        [
                          ['spectrum', 'Spectrum'],
                          ['plasma', 'Plasma'],
                          ['mandala', 'Mandala'],
                          ['waveform', 'Wave'],
                          ['strobe-grid', 'Matrix'],
                          ['live-cam', 'Live Cam LED'],
                        ] as Array<[LedPreset, string]>
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={async () => {
                            if (id === 'live-cam' && !sharedWebcamBridge.pose.active) {
                              await sharedWebcamBridge.startLiveWebcam();
                            }
                            updateLighting({ ledPreset: id });
                          }}
                          className={`rounded-md px-2 py-1 text-[11px] font-medium min-h-[30px] ${
                            project.lighting.ledPreset === id
                              ? 'bg-[#00E5FF] text-[#080B1D]'
                              : 'bg-white/8 text-slate-300 hover:bg-white/14'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Beams, Sharp Lasers & Stage Flooring */}
                  <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-2.5 text-xs">
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-slate-300">Spotlight Intensity</span>
                      <input
                        type="range"
                        min={0.2}
                        max={2.0}
                        step={0.05}
                        value={project.lighting.spotlightIntensity}
                        onChange={(e) =>
                          updateLighting({ spotlightIntensity: Number(e.target.value) })
                        }
                        className="crowd-slider w-28"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-slate-300">Laser Speed</span>
                      <input
                        type="range"
                        min={0.1}
                        max={2.6}
                        step={0.1}
                        value={project.lighting.laserSpeed}
                        onChange={(e) =>
                          updateLighting({ laserSpeed: Number(e.target.value) })
                        }
                        className="crowd-slider w-28"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-slate-300">Laser Sharpness</span>
                      <input
                        type="range"
                        min={0.4}
                        max={1.5}
                        step={0.05}
                        value={project.lighting.laserSharpness ?? 1.0}
                        onChange={(e) =>
                          updateLighting({ laserSharpness: Number(e.target.value) })
                        }
                        className="crowd-slider w-28"
                      />
                    </label>
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="text-slate-300">Stage Flooring</span>
                      <select
                        value={project.lighting.stageFloorMaterial ?? 'gridded-cyber-neon'}
                        onChange={(e) =>
                          updateLighting({
                            stageFloorMaterial: e.target.value as StageFloorMaterial,
                          })
                        }
                        className="rounded-lg border border-white/15 bg-[#0F142B] px-2 py-1 text-xs text-white min-h-[32px]"
                      >
                        <option value="reflective-water">Reflective Water</option>
                        <option value="polished-obsidian">Polished Obsidian</option>
                        <option value="gridded-cyber-neon">Gridded Cyber-Neon</option>
                      </select>
                    </div>
                  </div>

                  {/* Strobe Blinders, Choreography & Stage FX */}
                  <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-300">Strobe Blinder</span>
                      <select
                        value={project.lighting.strobeMode ?? 'beat-strobe'}
                        onChange={(e) =>
                          updateLighting({
                            strobeMode: e.target.value as StrobeMode,
                            reducedFlashing: false,
                          })
                        }
                        className="rounded-lg border border-white/15 bg-[#0F142B] px-2 py-1 text-xs text-white min-h-[34px]"
                      >
                        <option value="beat-strobe">Beat-Synced Strobe</option>
                        <option value="hyper-blinder">Hyper Xenon Blinder</option>
                        <option value="color-strobe">Dual-Color Strobe</option>
                        <option value="off">Strobe Off</option>
                      </select>
                    </div>

                    <label className="flex items-center justify-between gap-2">
                      <span className="text-slate-300">
                        Strobe Rate {project.lighting.reducedFlashing ? '(Locked Off)' : ''}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        disabled={project.lighting.reducedFlashing}
                        value={project.lighting.reducedFlashing ? 0 : project.lighting.strobeFrequency}
                        onChange={(e) =>
                          updateLighting({ strobeFrequency: Number(e.target.value) })
                        }
                        className="crowd-slider w-28 disabled:opacity-40"
                      />
                    </label>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateLighting({
                            reducedFlashing: !project.lighting.reducedFlashing,
                            strobeFrequency: !project.lighting.reducedFlashing ? 0 : project.lighting.strobeFrequency,
                          })
                        }
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium min-h-[32px] ${
                          project.lighting.reducedFlashing
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-amber-500/15 text-amber-200 border border-amber-500/30'
                        }`}
                      >
                        <Shield className="h-3.5 w-3.5" />
                        {project.lighting.reducedFlashing
                          ? 'Reduced-Flashing On'
                          : 'Reduce Flashing'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          useFestivalStore
                            .getState()
                            .triggerVisualFxBurst({ effectType: 'strobe-storm' });
                          showToast('Fired Xenon Strobe Blinder & Sharp Laser Barrage!');
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#00E5FF] px-2.5 py-1 text-[11px] font-bold text-[#080B1D] hover:bg-[#33ECFF] min-h-[32px]"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        Trigger Strobe Burst
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateLighting({
                            volumetricBeams: project.lighting.volumetricBeams === false,
                          })
                        }
                        className={`rounded-lg px-2 py-1 text-[11px] font-medium min-h-[32px] ${
                          project.lighting.volumetricBeams !== false
                            ? 'bg-[#8B5CF6]/25 text-violet-200 border border-[#8B5CF6]/40'
                            : 'bg-white/8 text-slate-400'
                        }`}
                      >
                        Volumetric Cones
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateLighting({
                            cameraShake: project.lighting.cameraShake === false,
                          })
                        }
                        className={`rounded-lg px-2 py-1 text-[11px] font-medium min-h-[32px] ${
                          project.lighting.cameraShake !== false
                            ? 'bg-[#2162F5]/25 text-blue-200 border border-[#2162F5]/40'
                            : 'bg-white/8 text-slate-400'
                        }`}
                      >
                        Bass Shake
                      </button>
                    </div>
                  </div>
                </div>

                <HandGestureController />
              </div>
            )}

            {/* TAB 4: AUDIO-REACTIVE ENGINE & FREQUENCY RESPONSE ANALYZER */}
            {activeTab === 'audio' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => void handleAudioUpload(e.target.files?.[0])}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#2162F5] px-3 py-2 text-xs font-semibold text-white hover:bg-[#3170FF] min-h-[38px]"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload Track
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleStartSynth(synthBpm)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium min-h-[38px] ${
                        audio.sourceType === 'synth' && audio.isPlaying
                          ? 'bg-[#00E5FF] text-[#080B1D]'
                          : 'bg-white/10 text-slate-200 hover:bg-white/15'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Live Synth ({synthBpm} BPM)
                    </button>

                    <select
                      aria-label="Synth Tempo Preset"
                      value={synthBpm}
                      onChange={(e) => {
                        const nextBpm = Number(e.target.value);
                        setSynthBpm(nextBpm);
                        updateCrowd({ bpmOverride: nextBpm });
                        if (audio.sourceType === 'synth' && audio.isPlaying) {
                          void handleStartSynth(nextBpm);
                        }
                      }}
                      className="rounded-lg border border-white/12 bg-[#0F142B] px-2 py-1.5 text-xs text-slate-200 min-h-[38px]"
                    >
                      <option value={88}>88 BPM (Chill Groove)</option>
                      <option value={110}>110 BPM (Festival Bounce)</option>
                      <option value={124}>124 BPM (House Set)</option>
                      <option value={138}>138 BPM (Mainstage Rave)</option>
                      <option value={155}>155 BPM (Hard Dance)</option>
                      <option value={174}>174 BPM (DnB Mosh Overdrive)</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => void handleStartMic()}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium min-h-[38px] ${
                        audio.sourceType === 'mic' && audio.isPlaying
                          ? 'bg-[#FF3CAC] text-white'
                          : 'bg-white/10 text-slate-200 hover:bg-white/15'
                      }`}
                    >
                      <Mic className="h-3.5 w-3.5" />
                      Live Mic
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const playing = sharedAudioEngine.togglePlayPause();
                        setAudioMetrics({ isPlaying: playing });
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/12 bg-white/8 px-3 py-2 text-xs text-white min-h-[38px]"
                    >
                      {audio.isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      {audio.isPlaying ? 'Pause' : 'Play'}
                    </button>
                  </div>

                  {/* Interactive BPM Tempo Drive & AFR Sensitivity Controls */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                    <label className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-300">
                        BPM Drive ({project.crowd.bpmOverride ?? audio.bpmEstimate})
                      </span>
                      <input
                        type="range"
                        min={75}
                        max={180}
                        step={1}
                        value={project.crowd.bpmOverride ?? audio.bpmEstimate}
                        onChange={(e) => {
                          const nextBpm = Number(e.target.value);
                          setSynthBpm(nextBpm);
                          updateCrowd({ bpmOverride: nextBpm });
                          if (audio.sourceType === 'synth' && audio.isPlaying) {
                            void handleStartSynth(nextBpm);
                          }
                        }}
                        className="crowd-slider w-24"
                      />
                    </label>

                    <label className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-300">AFR Gain</span>
                      <input
                        type="range"
                        min={0.5}
                        max={2.2}
                        step={0.05}
                        value={project.crowd.afrSensitivity ?? 1.2}
                        onChange={(e) =>
                          updateCrowd({ afrSensitivity: Number(e.target.value) })
                        }
                        className="crowd-slider w-20"
                      />
                    </label>

                    <label className="flex items-center gap-1.5">
                      <span>Vol</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={volume}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setVolume(v);
                          sharedAudioEngine.setVolume(v);
                        }}
                        className="crowd-slider w-20"
                      />
                    </label>
                  </div>
                </div>

                <AudioSpectrumCanvas />
              </div>
            )}

            {/* TAB 5: FESTIVAL DIRECTOR CAMERA MODE */}
            {activeTab === 'camera' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        ['orbit', 'Free Orbit'],
                        ['stage-closeup', 'Stage Avatar Close-Up'],
                        ['crowd-pov', 'Crowd POV'],
                        ['dj-booth', 'DJ Booth Cam'],
                        ['wide-stage', 'Wide Stage'],
                        ['drone', 'Drone Flyover'],
                      ] as Array<[CameraMode, string]>
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          useFestivalStore.getState().setAutoDirectorEnabled(false);
                          setCameraMode(mode);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium min-h-[38px] ${
                          cameraMode === mode && !isPlayingSequence && !useFestivalStore.getState().autoDirectorEnabled
                            ? 'bg-[#00E5FF] text-[#080B1D]'
                            : 'bg-white/8 text-slate-200 hover:bg-white/14'
                        }`}
                      >
                        <Camera className="h-3.5 w-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !useFestivalStore.getState().autoDirectorEnabled;
                        useFestivalStore.getState().setAutoDirectorEnabled(next);
                        showToast(
                          next
                            ? 'AI Auto-Stage Director enabled'
                            : 'AI Auto-Stage Director paused'
                        );
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold min-h-[38px] ${
                        useFestivalStore.getState().autoDirectorEnabled
                          ? 'bg-[#FF3CAC] text-white'
                          : 'border border-white/15 bg-white/8 text-slate-200 hover:bg-white/15'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Auto-Director
                    </button>
                    <button
                      type="button"
                      onClick={onCaptureCameraKeyframe}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-xs font-medium text-white hover:bg-white/15 min-h-[38px]"
                    >
                      <Plus className="h-3.5 w-3.5 text-[#00E5FF]" />
                      Record Angle
                    </button>
                    <button
                      type="button"
                      disabled={project.cameraSequence.length === 0}
                      onClick={() => setPlayingSequence(!isPlayingSequence)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold min-h-[38px] ${
                        isPlayingSequence
                          ? 'bg-[#FF3CAC] text-white'
                          : 'bg-[#2162F5] text-white hover:bg-[#3170FF]'
                      }`}
                    >
                      {isPlayingSequence ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      {isPlayingSequence ? 'Stop Sequence' : 'Play Sequence'}
                    </button>
                  </div>
                </div>

                {/* True Camera-to-3D Avatar Reconstruction & Stage Teleportation */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#00E5FF]/35 bg-[#00E5FF]/[0.06] px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white">
                      True Camera-to-3D Avatar Reconstruction & Live LED Broadcast
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Scan your face & outfit via webcam to build your sculpted 3D humanoid avatar, beam onto the Main Stage DJ deck, and project your live video onto the LED walls.
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => useFestivalStore.getState().setAvatarScannerOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#00E5FF] px-3 py-2 text-xs font-bold text-[#080B1D] hover:bg-[#33ECFF] min-h-[38px]"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Scan & Generate My 3D Avatar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleWebcamStage()}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors min-h-[38px] ${
                        avatar.webcamStageEnabled
                          ? 'bg-[#FF3CAC] text-white'
                          : 'border border-white/15 bg-white/10 text-white hover:bg-white/15'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {avatar.webcamStageEnabled
                        ? 'Leave Stage'
                        : 'Quick Beam to Stage'}
                    </button>
                    {!avatar.webcamStageEnabled && (
                      <button
                        type="button"
                        onClick={handleActivateSimulatedPerformer}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/14 min-h-[38px]"
                      >
                        Demo 3D Performer
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {project.cameraSequence.map((kf, idx) => (
                    <div
                      key={kf.id}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs shrink-0"
                    >
                      <span className="font-mono-tabular text-slate-400">0{idx + 1}.</span>
                      <span className="text-slate-100">{kf.name}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${kf.name}`}
                        onClick={() => removeCameraKeyframe(kf.id)}
                        className="text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: VIRTUAL AUDIENCE & AVATAR STUDIO */}
            {activeTab === 'crowd' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Crowd Simulation, Poly Pizza Assets & AFR BPM Drive */}
                <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100">
                      Poly Pizza Crowd & AFR Beat Intensity
                    </span>
                    <span className="font-mono-tabular text-[11px] text-[#00E5FF]">
                      {project.crowd.bpmOverride ?? audio.bpmEstimate} BPM ·{' '}
                      {(audio.danceSpeedMultiplier ?? 1.0).toFixed(2)}x Speed
                    </span>
                  </div>

                  {/* Distinct Live vs Simulated Meter */}
                  <div className="space-y-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10 flex">
                      <div
                        className="h-full bg-[#00E5FF] transition-all"
                        style={{ width: `${Math.min(100, liveInteractions * 0.5)}%` }}
                      />
                      <div
                        className="h-full bg-[#8B5CF6] transition-all"
                        style={{ width: `${Math.min(100 - liveInteractions * 0.5, simulatedEnergy * 0.5)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Cyan: Actual User Interactions ({liveInteractions}%)</span>
                      <span>
                        Violet: AFR Crowd Intensity (
                        {Math.round((audio.crowdIntensity ?? 0.25) * 100)}%)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <select
                      aria-label="Poly Pizza Crowd Archetype"
                      value={project.crowd.modelStyle ?? 'lolla-mix'}
                      onChange={(e) => {
                        updateCrowd({ modelStyle: e.target.value as CrowdModelStyle });
                        showToast(`Crowd Style: ${e.target.selectedOptions[0]?.text}`);
                      }}
                      className="rounded-lg border border-[#00E5FF]/40 bg-[#0F142B] px-2 py-1.5 text-xs font-semibold text-white min-h-[34px]"
                    >
                      <option value="lolla-mix">Poly Pizza: Lolla Mix</option>
                      <option value="poly-festival">Poly Pizza: Totems & Props</option>
                      <option value="streetwear-lowpoly">Poly Pizza: Streetwear Hats</option>
                      <option value="cyber-raver">Three.js: Cyber Ravers</option>
                    </select>

                    <select
                      aria-label="Crowd Choreography"
                      value={project.crowd.choreography}
                      onChange={(e) =>
                        updateCrowd({ choreography: e.target.value as DanceStyle })
                      }
                      className="rounded-lg border border-white/15 bg-[#0F142B] px-2 py-1.5 text-xs text-white min-h-[34px]"
                    >
                      <option value="bounce">Choreo: Bounce</option>
                      <option value="wave">Choreo: Wave</option>
                      <option value="rave">Choreo: Rave</option>
                      <option value="sway">Choreo: Sway</option>
                    </select>

                    <select
                      aria-label="Main Event Stage Lineup"
                      value={project.lighting.mainEventStyle ?? 'lolla-headliner'}
                      onChange={(e) => {
                        updateLighting({
                          mainEventStyle: e.target.value as MainEventStyle,
                        });
                        showToast(`Stage Lineup: ${e.target.selectedOptions[0]?.text}`);
                      }}
                      className="col-span-2 sm:col-span-1 rounded-lg border border-[#FF3CAC]/40 bg-[#0F142B] px-2 py-1.5 text-xs font-semibold text-[#FF3CAC] min-h-[34px]"
                    >
                      <option value="lolla-headliner">Act: Lollapalooza All-Star</option>
                      <option value="rock-band">Act: Live Rock Band</option>
                      <option value="break-dancer">Act: Break Dancer Crew</option>
                      <option value="acrobats">Act: Cirque Aerial Acrobats</option>
                      <option value="dj">Act: Solo Headliner DJ</option>
                    </select>
                  </div>

                  {/* Density, BPM Tempo Override & AFR Sensitivity Sliders */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <label className="flex items-center gap-1.5 text-slate-300">
                      <span>Density</span>
                      <input
                        type="range"
                        min={0.15}
                        max={1}
                        step={0.05}
                        value={project.crowd.density}
                        onChange={(e) => updateCrowd({ density: Number(e.target.value) })}
                        className="crowd-slider w-16"
                      />
                    </label>

                    <label className="flex items-center gap-1.5 text-slate-300">
                      <span>BPM ({project.crowd.bpmOverride ?? audio.bpmEstimate})</span>
                      <input
                        type="range"
                        min={75}
                        max={180}
                        step={1}
                        value={project.crowd.bpmOverride ?? audio.bpmEstimate}
                        onChange={(e) => {
                          const nextBpm = Number(e.target.value);
                          setSynthBpm(nextBpm);
                          updateCrowd({ bpmOverride: nextBpm });
                          if (audio.sourceType === 'synth' && audio.isPlaying) {
                            void handleStartSynth(nextBpm);
                          }
                        }}
                        className="crowd-slider w-20"
                      />
                    </label>

                    <label className="flex items-center gap-1.5 text-slate-300">
                      <span>AFR Gain</span>
                      <input
                        type="range"
                        min={0.5}
                        max={2.2}
                        step={0.05}
                        value={project.crowd.afrSensitivity ?? 1.2}
                        onChange={(e) =>
                          updateCrowd({ afrSensitivity: Number(e.target.value) })
                        }
                        className="crowd-slider w-16"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-slate-400 mr-1">Emotes:</span>
                    {(
                      [
                        ['heart', 'Love', Heart],
                        ['fire', 'Hype', Flame],
                        ['hands', 'Hands Up', Hand],
                        ['star', 'Star', Star],
                      ] as const
                    ).map(([id, label, Icon]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleSendEmote(id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-white/8 px-2.5 py-1.5 text-slate-100 hover:bg-[#FF3CAC]/25 min-h-[34px]"
                      >
                        <Icon className="h-3.5 w-3.5 text-[#FF3CAC]" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visitor 3D Avatar Reconstruction Studio */}
                <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-100">Your 3D Festival Avatar</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => useFestivalStore.getState().setAvatarScannerOpen(true)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#00E5FF] px-2.5 py-1 text-[11px] font-bold text-[#080B1D] hover:bg-[#33ECFF]"
                      >
                        <Camera className="h-3 w-3" />
                        <span>Scan & Generate My 3D Avatar</span>
                      </button>
                      <input
                        type="text"
                        maxLength={20}
                        value={avatar.displayName}
                        onChange={(e) => handleAvatarPatch({ displayName: e.target.value })}
                        placeholder="Display Name"
                        className="w-28 rounded-lg border border-white/15 bg-[#0F142B] px-2 py-1 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5">
                      <span className="text-slate-300">3D Hair</span>
                      <select
                        value={avatar.hairStyle}
                        onChange={(e) =>
                          handleAvatarPatch({ hairStyle: e.target.value as HairStyle })
                        }
                        className="bg-transparent text-white outline-none"
                      >
                        <option value="fade" className="bg-[#080B1D]">Fade</option>
                        <option value="mohawk" className="bg-[#080B1D]">Mohawk</option>
                        <option value="bob" className="bg-[#080B1D]">Bob</option>
                        <option value="crown" className="bg-[#080B1D]">Crown</option>
                      </select>
                    </label>

                    <label className="flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5">
                      <span className="text-slate-300">Gear</span>
                      <select
                        value={avatar.accessory}
                        onChange={(e) =>
                          handleAvatarPatch({ accessory: e.target.value as AvatarAccessory })
                        }
                        className="bg-transparent text-white outline-none"
                      >
                        <option value="visor" className="bg-[#080B1D]">Cyber Visor</option>
                        <option value="halo" className="bg-[#080B1D]">Neon Halo</option>
                        <option value="headphones" className="bg-[#080B1D]">DJ Cans</option>
                        <option value="none" className="bg-[#080B1D]">None</option>
                      </select>
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-300 text-[11px]">Outfit/Accent/Skin/Hair</span>
                      <input
                        type="color"
                        aria-label="Outfit Color"
                        title="Outfit Color"
                        value={avatar.outfitColor}
                        onChange={(e) => handleAvatarPatch({ outfitColor: e.target.value })}
                        className="h-6 w-6 cursor-pointer rounded border border-white/15 bg-transparent"
                      />
                      <input
                        type="color"
                        aria-label="Accent Color"
                        title="Accent Color"
                        value={avatar.accentColor}
                        onChange={(e) => handleAvatarPatch({ accentColor: e.target.value })}
                        className="h-6 w-6 cursor-pointer rounded border border-white/15 bg-transparent"
                      />
                      <input
                        type="color"
                        aria-label="Skin Tone"
                        title="3D Skin Tone"
                        value={avatar.skinColor || '#E2B897'}
                        onChange={(e) => handleAvatarPatch({ skinColor: e.target.value })}
                        className="h-6 w-6 cursor-pointer rounded border border-white/15 bg-transparent"
                      />
                      <input
                        type="color"
                        aria-label="Hair Color"
                        title="3D Hair Color"
                        value={avatar.hairColor || '#1E1B4B'}
                        onChange={(e) => handleAvatarPatch({ hairColor: e.target.value })}
                        className="h-6 w-6 cursor-pointer rounded border border-white/15 bg-transparent"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <select
                        aria-label="Avatar Stage Placement"
                        value={avatar.stagePlacement ?? 'both'}
                        onChange={(e) =>
                          handleAvatarPatch({
                            stagePlacement: e.target.value as AvatarStagePlacement,
                          })
                        }
                        className="rounded bg-[#0F142B] border border-white/15 px-2 py-1 text-slate-200 text-[11px]"
                      >
                        <option value="both">On Stage + Crowd</option>
                        <option value="stage-dj">Main Stage DJ</option>
                        <option value="crowd-front">Crowd Floor</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (!avatar.webcamStageEnabled) {
                            void sharedWebcamBridge.startLiveWebcam().then(() => {
                              useFestivalStore.getState().triggerBeamToStage();
                            });
                          } else {
                            void handleToggleWebcamStage();
                          }
                        }}
                        className={`rounded px-2.5 py-1 text-[11px] font-semibold ${
                          avatar.webcamStageEnabled
                            ? 'bg-[#FF3CAC] text-white'
                            : 'bg-[#00E5FF] text-[#080B1D]'
                        }`}
                      >
                        {avatar.webcamStageEnabled ? 'On Stage' : 'Beam to Stage'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: LIVE MULTIPLAYER ROOMS */}
            {activeTab === 'multiplayer' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  {!room.connected ? (
                    <>
                      <div className="font-semibold text-slate-100">
                        Live Festival Room (WebSocket Sync)
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={roomCodeInput}
                          onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                          placeholder="Room Code"
                          maxLength={14}
                          className="w-28 rounded-lg border border-white/15 bg-[#0F142B] px-2.5 py-2 font-mono-tabular text-white uppercase"
                        />
                        <button
                          type="button"
                          onClick={() => setRoomIsPublic(!roomIsPublic)}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/6 px-2.5 py-2 text-slate-200 min-h-[38px]"
                        >
                          {roomIsPublic ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                          {roomIsPublic ? 'Public' : 'Private'}
                        </button>
                        <button
                          type="button"
                          onClick={handleJoinRoom}
                          className="rounded-lg bg-[#2162F5] px-3 py-2 font-semibold text-white hover:bg-[#3170FF] min-h-[38px]"
                        >
                          Create / Join
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Syncs avatars, stage edits, emotes, and live chat across connected browsers.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-emerald-400">
                          Room {room.roomId} ({room.participants.length + 1} online)
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleCopyRoomInvite()}
                            className="rounded-lg bg-white/10 px-2.5 py-1.5 text-slate-200 hover:bg-white/15"
                          >
                            Invite Link
                          </button>
                          <button
                            type="button"
                            onClick={() => sharedRoomClient.leaveRoom()}
                            className="rounded-lg bg-rose-500/20 px-2.5 py-1.5 text-rose-300 hover:bg-rose-500/30"
                          >
                            Leave
                          </button>
                        </div>
                      </div>

                      {room.isHost && (
                        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-2">
                          <span className="text-slate-400">Host Controls:</span>
                          <button
                            type="button"
                            onClick={() =>
                              sharedRoomClient.sendModeration({ lockedEdits: !room.lockedEdits })
                            }
                            className={`rounded-lg px-2.5 py-1 ${
                              room.lockedEdits
                                ? 'bg-amber-500/20 text-amber-200'
                                : 'bg-white/8 text-slate-300'
                            }`}
                          >
                            {room.lockedEdits ? 'Edits Locked' : 'Lock Guest Edits'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              sharedRoomClient.sendModeration({ emotesEnabled: !room.emotesEnabled })
                            }
                            className={`rounded-lg px-2.5 py-1 ${
                              room.emotesEnabled
                                ? 'bg-white/8 text-slate-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {room.emotesEnabled ? 'Emotes Allowed' : 'Emotes Muted'}
                          </button>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="text-slate-300">You ({avatar.displayName})</span>
                        {room.participants.map((p) => (
                          <button
                            key={p.clientId}
                            type="button"
                            disabled={!room.isHost}
                            onClick={() =>
                              room.isHost && sharedRoomClient.sendModeration({ targetClientId: p.clientId })
                            }
                            className="text-slate-400 hover:text-white"
                            title={room.isHost ? 'Click to toggle mute' : undefined}
                          >
                            · {p.avatar.displayName || 'Guest'} {p.muted ? '(Muted)' : ''}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Live Room Text Chat */}
                <div className="flex flex-col justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="crowd-scroll h-20 overflow-y-auto space-y-1">
                    {room.messages.length === 0 ? (
                      <div className="text-[11px] text-slate-500">
                        {room.connected
                          ? 'No messages yet. Say hello to the crowd!'
                          : 'Join a room to chat with visitors in real time.'}
                      </div>
                    ) : (
                      room.messages.map((m) => (
                        <div key={m.id} className="text-[11px] leading-snug">
                          <span className="font-semibold" style={{ color: m.color }}>
                            {m.sender}:{' '}
                          </span>
                          <span className="text-slate-200">{m.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={handleSendChat} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      disabled={!room.connected}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={room.connected ? 'Send message to room...' : 'Connect to a room to chat'}
                      className="flex-1 rounded-lg border border-white/12 bg-[#0F142B] px-2.5 py-1.5 text-xs text-white disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!room.connected || !chatInput.trim()}
                      className="inline-flex items-center justify-center rounded-lg bg-[#00E5FF] px-3 py-1.5 text-[#080B1D] font-semibold disabled:opacity-40 min-h-[34px]"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Tab Strip (Large Touch Targets >= 44px) */}
        <nav
          aria-label="Festival Studio Controls"
          className="flex items-center justify-between sm:justify-center gap-1 overflow-x-auto px-2 py-1.5"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id && !drawerMinimized;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (activeTab === tab.id && !drawerMinimized) {
                    setDrawerMinimized(true);
                  } else {
                    setActiveTab(tab.id);
                    setDrawerMinimized(false);
                  }
                }}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
                  isActive
                    ? 'bg-[#2162F5] text-white'
                    : 'text-slate-300 hover:bg-white/8 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => useFestivalStore.getState().setDashboardOpen(true)}
            className="hidden md:flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/8 hover:text-white whitespace-nowrap shrink-0 min-h-[44px]"
          >
            <Sliders className="h-4 w-4 text-[#00E5FF]" />
            <span>DNA & Save</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
