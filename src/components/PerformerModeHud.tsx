import {
  Camera,
  Clapperboard,
  Disc3,
  Flame,
  Hand,
  Sparkles,
  Tv,
  Zap,
} from 'lucide-react';
import { useFestivalStore } from '../store/useFestivalStore';
import { FaceTextureMode, PerformerActionType } from '../types/festival';

const PERFORMER_ACTIONS: Array<{
  type: PerformerActionType;
  keyNum: string;
  label: string;
  icon: typeof Disc3;
  color: string;
}> = [
  {
    type: 'scratch',
    keyNum: '1',
    label: 'DJ Scratch',
    icon: Disc3,
    color: '#00E5FF',
  },
  {
    type: 'hands-up',
    keyNum: '2',
    label: 'Hands-Up Hype',
    icon: Hand,
    color: '#FF3CAC',
  },
  {
    type: 'laser-drop',
    keyNum: '3',
    label: 'Laser Drop',
    icon: Zap,
    color: '#8B5CF6',
  },
  {
    type: 'pyro-burst',
    keyNum: '4',
    label: 'Pyro & Confetti',
    icon: Flame,
    color: '#FFB703',
  },
];

export function PerformerModeHud() {
  const hudCollapsed = useFestivalStore((s) => s.hudCollapsed);
  const avatar = useFestivalStore((s) => s.avatar);
  const updateAvatar = useFestivalStore((s) => s.updateAvatar);
  const lighting = useFestivalStore((s) => s.project.lighting);
  const updateLighting = useFestivalStore((s) => s.updateLighting);
  const activeAction = useFestivalStore((s) => s.activePerformerAction);
  const triggerPerformerAction = useFestivalStore((s) => s.triggerPerformerAction);
  const autoDirectorEnabled = useFestivalStore((s) => s.autoDirectorEnabled);
  const setAutoDirectorEnabled = useFestivalStore((s) => s.setAutoDirectorEnabled);
  const setAvatarScannerOpen = useFestivalStore((s) => s.setAvatarScannerOpen);
  const triggerBeamToStage = useFestivalStore((s) => s.triggerBeamToStage);
  const showToast = useFestivalStore((s) => s.showToast);

  if (hudCollapsed || !avatar.webcamStageEnabled) return null;

  const isLiveCamOnLed = lighting.ledPreset === 'live-cam';
  const currentFaceMode: FaceTextureMode = avatar.faceTextureMode || 'snapshot';

  const handleToggleFaceMode = () => {
    const next: FaceTextureMode =
      currentFaceMode === 'snapshot' ? 'live-video' : 'snapshot';
    updateAvatar({ faceTextureMode: next, hasScannedFace: true });
    showToast(
      next === 'live-video'
        ? '3D Avatar Head switched to Live Video Face Stream'
        : '3D Avatar Head switched to Captured 3D Facial Snapshot'
    );
  };

  const handleToggleLedBroadcast = () => {
    const nextPreset = isLiveCamOnLed ? 'spectrum' : 'live-cam';
    updateLighting({ ledPreset: nextPreset });
    showToast(
      nextPreset === 'live-cam'
        ? 'Live Camera Stream projected onto Stage LED Walls'
        : 'Stage LED Walls switched back to Audio Spectrum'
    );
  };

  return (
    <aside
      aria-label="Stage Performer Live Controls"
      className="pointer-events-auto fixed top-16 right-3 z-20 flex w-[min(310px,92vw)] flex-col gap-2 rounded-2xl border border-[#00E5FF]/35 bg-[#080B1D]/92 p-3 text-xs shadow-2xl"
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#00E5FF] animate-pulse" />
          <span className="font-display font-bold text-white tracking-wide">
            PERFORMER MODE · ON STAGE
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAvatarScannerOpen(true)}
          className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-medium text-[#00E5FF] hover:bg-white/15"
          title="Re-scan 3D Avatar face & colors"
        >
          <Camera className="h-3 w-3" />
          <span>3D Scan</span>
        </button>
      </div>

      {/* Live DJ Performance Hotkeys (1-4) */}
      <div className="grid grid-cols-2 gap-1.5">
        {PERFORMER_ACTIONS.map((act) => {
          const Icon = act.icon;
          const isRecent =
            activeAction?.type === act.type &&
            Date.now() - activeAction.timestamp < 2400;
          return (
            <button
              key={act.type}
              type="button"
              onClick={() => triggerPerformerAction(act.type)}
              className={`flex items-center justify-between gap-1.5 rounded-xl border px-2.5 py-2 text-left font-semibold transition-all min-h-[38px] ${
                isRecent
                  ? 'border-[#00E5FF] bg-[#00E5FF]/20 text-white scale-[1.02]'
                  : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.1]'
              }`}
            >
              <span className="flex items-center gap-1.5 truncate">
                <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: act.color }} />
                <span className="truncate text-[11px]">{act.label}</span>
              </span>
              <kbd className="rounded bg-black/50 px-1.5 py-0.5 font-mono-tabular text-[10px] text-slate-400">
                {act.keyNum}
              </kbd>
            </button>
          );
        })}
      </div>

      {/* Quick Stage Switches: Face Mode, LED Broadcast, Auto-Director, Re-Beam */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-white/10">
        <button
          type="button"
          onClick={handleToggleFaceMode}
          className="inline-flex items-center gap-1 rounded-lg bg-white/8 px-2 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-white/14"
          title="Switch between Captured 3D Snapshot UV and Live Video Face"
        >
          <Camera className="h-3 w-3 text-[#00E5FF]" />
          <span>
            {currentFaceMode === 'live-video' ? 'Face: Live Video' : 'Face: 3D Snapshot'}
          </span>
        </button>

        <button
          type="button"
          onClick={handleToggleLedBroadcast}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium ${
            isLiveCamOnLed
              ? 'bg-[#FF3CAC]/25 text-[#FF3CAC] border border-[#FF3CAC]/40'
              : 'bg-white/8 text-slate-300 hover:bg-white/14'
          }`}
          title="Project live camera feed onto the giant stage LED screens"
        >
          <Tv className="h-3 w-3" />
          <span>{isLiveCamOnLed ? 'LED Cam: ON' : 'LED Cam: OFF'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const next = !autoDirectorEnabled;
            setAutoDirectorEnabled(next);
            showToast(
              next
                ? 'AI Auto-Stage Director enabled — synced camera cuts active'
                : 'AI Auto-Stage Director paused'
            );
          }}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold ${
            autoDirectorEnabled
              ? 'bg-[#2162F5] text-white'
              : 'bg-white/8 text-slate-300 hover:bg-white/14'
          }`}
        >
          <Clapperboard className="h-3 w-3" />
          <span>{autoDirectorEnabled ? 'Auto-Director: ON' : 'Auto-Director'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerBeamToStage();
            showToast('Beamed to Main Stage DJ Deck!');
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-[#00E5FF]/15 px-2 py-1.5 text-[11px] font-semibold text-[#00E5FF] hover:bg-[#00E5FF]/25"
          title="Trigger Beam-to-Stage light pillar & focus camera"
        >
          <Sparkles className="h-3 w-3" />
          <span>Beam FX</span>
        </button>
      </div>
    </aside>
  );
}
