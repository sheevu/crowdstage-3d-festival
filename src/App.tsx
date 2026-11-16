import { useEffect, useRef } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { CrowdStageEngine } from './engine/CrowdStageEngine';
import { useFestivalStore } from './store/useFestivalStore';
import { TopHud } from './components/TopHud';
import { BottomDock } from './components/BottomDock';
import { CreatorDashboard } from './components/CreatorDashboard';
import { AvatarScannerModal } from './components/AvatarScannerModal';
import { PerformerModeHud } from './components/PerformerModeHud';
import { sharedRoomClient } from './realtime/roomClient';
import { FestivalProject } from './types/festival';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CrowdStageEngine | null>(null);

  const webglSupported = useFestivalStore((s) => s.webglSupported);
  const webglContextLost = useFestivalStore((s) => s.webglContextLost);
  const toastMessage = useFestivalStore((s) => s.toastMessage);

  // Mount Three.js WebGL2 engine once in an isolated ref container
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new CrowdStageEngine(container);
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Load shared festival or multiplayer room from URL parameters on startup
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedFestId = params.get('festival');
    const roomCode = params.get('room');

    if (sharedFestId) {
      fetch(`/api/festivals/${encodeURIComponent(sharedFestId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.festival) {
            useFestivalStore
              .getState()
              .setProject(data.festival as FestivalProject, false);
            useFestivalStore
              .getState()
              .showToast(`Loaded shared festival "${data.festival.name}"`);
          }
        })
        .catch(() => {
          // ignore fetch error
        });
    }

    if (roomCode) {
      sharedRoomClient.joinRoom(roomCode, true);
      useFestivalStore.getState().setActiveTab('multiplayer');
    }
  }, []);

  // Global keyboard shortcuts (Cinema Mode, Undo/Redo, Delete selected, Performer Hotkeys 1-4)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT';
      if (isTyping) return;

      const store = useFestivalStore.getState();
      if (e.key.toLowerCase() === 'h') {
        store.setHudCollapsed(!store.hudCollapsed);
      } else if (e.key === '1') {
        store.triggerPerformerAction('scratch');
      } else if (e.key === '2') {
        store.triggerPerformerAction('hands-up');
      } else if (e.key === '3') {
        store.triggerPerformerAction('laser-drop');
      } else if (e.key === '4') {
        store.triggerPerformerAction('pyro-burst');
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      } else if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        store.selectedItemId
      ) {
        store.removeStageItem(store.selectedItemId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleCaptureCameraKeyframe = () => {
    if (!engineRef.current) return;
    const count = useFestivalStore.getState().project.cameraSequence.length;
    const kf = engineRef.current.captureCurrentKeyframe(`Angle ${count + 1}`);
    useFestivalStore.getState().addCameraKeyframe(kf);
    useFestivalStore.getState().showToast(`Recorded ${kf.name}`);
  };

  const handleCaptureSnapshot = (): string | null => {
    if (!engineRef.current) return null;
    return engineRef.current.captureSnapshotDataUrl();
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#080B1D] select-none">
      {/* Dedicated WebGL2 Canvas Mount */}
      <div
        ref={canvasMountRef}
        className="fixed inset-0 h-full w-full"
        aria-label="CrowdStage 3D Festival Viewport"
      />

      {/* Graceful WebGL2 Fallback / Context Recovery */}
      {(!webglSupported || webglContextLost) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080B1D] p-6 text-center">
          <div className="max-w-md space-y-4 rounded-2xl border border-white/15 bg-[#0F142B] p-6">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-400" />
            <h1 className="font-display text-xl font-bold text-white">
              {webglContextLost
                ? '3D Graphics Context Paused'
                : 'WebGL2 Hardware Context Unavailable'}
            </h1>
            <p className="text-sm text-slate-300">
              {webglContextLost
                ? 'Your device temporarily paused the 3D GPU context to save memory.'
                : 'Your browser or device does not currently expose WebGL2 rendering. Enable hardware acceleration to enter the 3D festival.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2162F5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3170FF]"
            >
              <RotateCcw className="h-4 w-4" />
              Reload Viewport
            </button>
          </div>
        </div>
      )}

      {/* Semantic HUD Overlays */}
      <TopHud />
      <PerformerModeHud />

      {toastMessage && (
        <div
          role="status"
          className="pointer-events-none fixed top-16 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-[#00E5FF]/40 bg-[#080B1D]/92 px-4 py-2 text-xs font-medium text-white shadow-lg"
        >
          {toastMessage}
        </div>
      )}

      <BottomDock onCaptureCameraKeyframe={handleCaptureCameraKeyframe} />
      <CreatorDashboard onCaptureSnapshot={handleCaptureSnapshot} />
      <AvatarScannerModal />
    </div>
  );
}
