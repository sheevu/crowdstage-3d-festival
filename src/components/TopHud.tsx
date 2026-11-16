import {
  Eye,
  EyeOff,
  FolderKanban,
  Pause,
  Play,
  Redo2,
  Save,
  Undo2,
  Volume2,
} from 'lucide-react';
import { useFestivalStore } from '../store/useFestivalStore';
import { sharedAudioEngine } from '../audio/AudioEngine';
import { GraphicsProfile } from '../types/festival';

export function TopHud() {
  const project = useFestivalStore((s) => s.project);
  const pastCount = useFestivalStore((s) => s.past.length);
  const futureCount = useFestivalStore((s) => s.future.length);
  const undo = useFestivalStore((s) => s.undo);
  const redo = useFestivalStore((s) => s.redo);

  const hudCollapsed = useFestivalStore((s) => s.hudCollapsed);
  const setHudCollapsed = useFestivalStore((s) => s.setHudCollapsed);
  const setDashboardOpen = useFestivalStore((s) => s.setDashboardOpen);
  const saveCurrentProject = useFestivalStore((s) => s.saveCurrentProject);

  const audio = useFestivalStore((s) => s.audio);
  const setAudioMetrics = useFestivalStore((s) => s.setAudioMetrics);

  const graphicsProfile = useFestivalStore((s) => s.graphicsProfile);
  const setGraphicsProfile = useFestivalStore((s) => s.setGraphicsProfile);
  const measuredFps = useFestivalStore((s) => s.measuredFps);

  const liveInteractions = useFestivalStore((s) => s.liveInteractions);
  const simulatedEnergy = useFestivalStore((s) => s.simulatedEnergy);
  const room = useFestivalStore((s) => s.room);

  const handleToggleAudio = () => {
    const playing = sharedAudioEngine.togglePlayPause();
    setAudioMetrics({ isPlaying: playing });
  };

  if (hudCollapsed) {
    return (
      <div className="pointer-events-none fixed top-3 right-3 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setHudCollapsed(false)}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#080B1D]/90 px-3 py-2 text-xs font-medium text-white hover:bg-[#0F1636] min-h-[40px]"
        >
          <Eye className="h-3.5 w-3.5 text-[#00E5FF]" />
          Show HUD
        </button>
      </div>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-white/10 bg-[#080B1D]/88 px-3 sm:px-5">
      {/* Zone 1: Single-line Brand Title */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-display text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          CrowdStage
        </span>
        <span className="hidden lg:inline-block truncate max-w-[180px] text-xs text-slate-400">
          {project.name}
        </span>
      </div>

      {/* Zone 2: Essential Workspace Controls (No cluttered pill islands) */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={handleToggleAudio}
          title={audio.isPlaying ? 'Pause festival audio' : 'Play festival synth'}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 min-h-[38px] ${
            audio.isPlaying
              ? 'bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/40'
              : 'bg-white/8 text-slate-200 hover:bg-white/12 border border-white/10'
          }`}
        >
          {audio.isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{audio.isPlaying ? 'Audio Live' : 'Play Beat'}</span>
        </button>

        <div className="hidden md:flex items-center gap-1 border-l border-white/10 pl-2">
          <button
            type="button"
            onClick={undo}
            disabled={pastCount === 0}
            aria-label="Undo"
            title="Undo"
            className="inline-flex items-center justify-center rounded-lg p-2 text-slate-300 hover:bg-white/10 disabled:opacity-35 min-h-[38px] min-w-[38px]"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={futureCount === 0}
            aria-label="Redo"
            title="Redo"
            className="inline-flex items-center justify-center rounded-lg p-2 text-slate-300 hover:bg-white/10 disabled:opacity-35 min-h-[38px] min-w-[38px]"
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </div>

        <div className="hidden xl:flex items-center gap-2 border-l border-white/10 pl-2.5 text-xs text-slate-300 font-mono-tabular whitespace-nowrap">
          <Volume2 className="h-3.5 w-3.5 text-[#00E5FF]" />
          <span>Energy {Math.min(100, Math.round(simulatedEnergy * 0.65 + liveInteractions * 0.35))}%</span>
          <span className="text-slate-600">/</span>
          <span>{measuredFps} FPS</span>
          {room.connected && (
            <>
              <span className="text-slate-600">/</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Room {room.roomId}
              </span>
            </>
          )}
        </div>

        <select
          aria-label="Graphics Profile"
          value={graphicsProfile}
          onChange={(e) => setGraphicsProfile(e.target.value as GraphicsProfile)}
          className="hidden sm:block rounded-lg border border-white/12 bg-[#0F142B] px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-[#00E5FF] min-h-[38px]"
        >
          <option value="low">Low GFX</option>
          <option value="balanced">Balanced GFX</option>
          <option value="ultra">Ultra GFX</option>
        </select>
      </div>

      {/* Zone 3: Primary Action & Dashboard */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          type="button"
          onClick={() => void saveCurrentProject()}
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-[#2162F5] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3170FF] transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </button>

        <button
          type="button"
          onClick={() => setDashboardOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-white hover:bg-white/14 transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
        >
          <FolderKanban className="h-3.5 w-3.5 text-[#00E5FF]" />
          <span>Studio</span>
        </button>

        <button
          type="button"
          onClick={() => setHudCollapsed(true)}
          title="Cinema Mode (Hide HUD)"
          aria-label="Hide HUD"
          className="inline-flex items-center justify-center rounded-lg border border-white/12 bg-white/6 p-2 text-slate-300 hover:bg-white/12 hover:text-white min-h-[38px] min-w-[38px]"
        >
          <EyeOff className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
