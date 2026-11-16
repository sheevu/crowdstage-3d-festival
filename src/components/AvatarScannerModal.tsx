import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  RefreshCw,
  Sparkles,
  Tv,
  UserCheck,
  Video,
  X,
} from 'lucide-react';
import { useFestivalStore } from '../store/useFestivalStore';
import { sharedWebcamBridge } from '../engine/webcamBridge';
import { FaceTextureMode } from '../types/festival';
import { sharedRoomClient } from '../realtime/roomClient';

export function AvatarScannerModal() {
  const open = useFestivalStore((s) => s.avatarScannerOpen);
  const setOpen = useFestivalStore((s) => s.setAvatarScannerOpen);
  const avatar = useFestivalStore((s) => s.avatar);
  const updateAvatar = useFestivalStore((s) => s.updateAvatar);
  const lighting = useFestivalStore((s) => s.project.lighting);
  const updateLighting = useFestivalStore((s) => s.updateLighting);
  const triggerBeamToStage = useFestivalStore((s) => s.triggerBeamToStage);
  const room = useFestivalStore((s) => s.room);
  const showToast = useFestivalStore((s) => s.showToast);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'connecting' | 'live' | 'simulated'>('connecting');
  const [skinColor, setSkinColor] = useState(avatar.skinColor || '#E2B897');
  const [hairColor, setHairColor] = useState(avatar.hairColor || '#1E1B4B');
  const [outfitColor, setOutfitColor] = useState(avatar.outfitColor || '#00E5FF');
  const [faceMode, setFaceMode] = useState<FaceTextureMode>(avatar.faceTextureMode || 'snapshot');
  const [projectOnLedWalls, setProjectOnLedWalls] = useState(lighting.ledPreset === 'live-cam');
  const [snapshotPreviewUrl, setSnapshotPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let rafId = 0;

    setSkinColor(avatar.skinColor || '#E2B897');
    setHairColor(avatar.hairColor || '#1E1B4B');
    setOutfitColor(avatar.outfitColor || '#00E5FF');
    setFaceMode(avatar.faceTextureMode || 'snapshot');
    setProjectOnLedWalls(lighting.ledPreset === 'live-cam');

    setCameraStatus('connecting');
    void sharedWebcamBridge.startLiveWebcam().then((res) => {
      if (cancelled) return;
      setCameraStatus(res.simulated ? 'simulated' : 'live');
    });

    const renderPreview = () => {
      if (cancelled) return;
      const canvas = previewCanvasRef.current;
      const video = sharedWebcamBridge.getVideoElement();
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (video && video.readyState >= 2 && !sharedWebcamBridge.pose.usingSimulatedFeed) {
            ctx.save();
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            ctx.restore();
          } else {
            // Draw procedural cyber-scanner silhouette preview if camera is unavailable
            const grad = ctx.createRadialGradient(160, 110, 15, 160, 120, 160);
            grad.addColorStop(0, '#172554');
            grad.addColorStop(1, '#080B1D');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Demo avatar silhouette inside framing guide
            ctx.fillStyle = outfitColor;
            ctx.beginPath();
            ctx.arc(160, 225, 68, Math.PI, 0);
            ctx.fill();

            ctx.fillStyle = skinColor;
            ctx.beginPath();
            ctx.ellipse(160, 118, 38, 46, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = hairColor;
            ctx.beginPath();
            ctx.arc(160, 102, 40, Math.PI, 0);
            ctx.fill();

            // Expressive eyes
            ctx.fillStyle = '#00E5FF';
            ctx.fillRect(140, 110, 12, 5);
            ctx.fillRect(168, 110, 12, 5);
          }

          // Framing guide overlay (Hair, Face UV, Outfit sample zones)
          ctx.strokeStyle = 'rgba(0, 229, 255, 0.78)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.ellipse(160, 116, 48, 58, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Target brackets
          ctx.strokeStyle = '#FF3CAC';
          ctx.lineWidth = 2;
          // Hair sample box
          ctx.strokeRect(130, 48, 60, 22);
          // Outfit sample box
          ctx.strokeRect(110, 186, 100, 34);
        }
      }
      rafId = requestAnimationFrame(renderPreview);
    };

    rafId = requestAnimationFrame(renderPreview);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [open]);

  if (!open) return null;

  const handleSampleColorsNow = () => {
    const res = sharedWebcamBridge.scanAndExtractAvatarColors(
      lighting.primaryColor,
      lighting.secondaryColor
    );
    setSkinColor(res.skinColor);
    setHairColor(res.hairColor);
    setOutfitColor(res.outfitColor);
    setSnapshotPreviewUrl(res.snapshotDataUrl);
    showToast(
      res.simulated
        ? 'Sampled cyber-avatar palette & 3D facial UV map'
        : 'Extracted skin tone, hair & outfit colors from live camera!'
    );
  };

  const handleGenerateAndBeamToStage = () => {
    const res = sharedWebcamBridge.scanAndExtractAvatarColors(
      lighting.primaryColor,
      lighting.secondaryColor
    );

    const finalSkin = snapshotPreviewUrl ? skinColor : res.skinColor;
    const finalHair = snapshotPreviewUrl ? hairColor : res.hairColor;
    const finalOutfit = snapshotPreviewUrl ? outfitColor : res.outfitColor;

    updateAvatar({
      skinColor: finalSkin,
      hairColor: finalHair,
      outfitColor: finalOutfit,
      faceTextureMode: faceMode,
      hasScannedFace: true,
      webcamStageEnabled: true,
      stagePlacement: 'both',
    });

    if (projectOnLedWalls) {
      updateLighting({ ledPreset: 'live-cam' });
    }

    triggerBeamToStage();
    if (room.connected) {
      window.setTimeout(() => sharedRoomClient.sendAvatarUpdate(), 30);
    }

    setOpen(false);
    showToast('3D Avatar reconstructed & beamed onto Main Stage! Performer Mode active.');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan and Generate 3D Stage Avatar"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <div className="flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-[#00E5FF]/35 bg-[#080B1D] p-4 sm:p-5 text-xs text-slate-200 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00E5FF]/15 text-[#00E5FF]">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-white">
                Camera-to-3D Avatar Reconstruction & Stage Teleport
              </h2>
              <p className="text-[11px] text-slate-400">
                Align your face in the guide to extract skin, hair, and outfit colors and wrap your face onto a sculpted 3D humanoid avatar.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Close scanner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Main Scanner Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Left: Live Webcam Framing Guide */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-full overflow-hidden rounded-xl border border-white/15 bg-[#050714]">
              <canvas
                ref={previewCanvasRef}
                width={320}
                height={240}
                className="h-52 w-full object-cover"
              />
              <div className="pointer-events-none absolute top-2 left-2 rounded-md bg-[#080B1D]/90 px-2 py-1 text-[10px] font-semibold text-[#00E5FF] border border-[#00E5FF]/30">
                {cameraStatus === 'live'
                  ? 'LIVE WEBCAM FEED'
                  : cameraStatus === 'simulated'
                    ? 'DEMO CYBER-SCANNER READY'
                    : 'CONNECTING CAMERA...'}
              </div>
              <div className="pointer-events-none absolute bottom-2 inset-x-2 flex justify-between text-[10px] text-slate-300 bg-[#080B1D]/85 px-2.5 py-1 rounded">
                <span>Top Box: Hair</span>
                <span>Oval: 3D Face UV</span>
                <span>Bottom: Outfit</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSampleColorsNow}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#00E5FF]/40 bg-[#00E5FF]/15 px-3 py-2 text-xs font-semibold text-[#00E5FF] hover:bg-[#00E5FF]/25 min-h-[38px]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Capture Frame & Extract Colors
            </button>
          </div>

          {/* Right: Extracted 3D Avatar Attributes & Face Mode */}
          <div className="flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="space-y-2.5">
              <div className="font-semibold text-white">
                Extracted 3D Avatar Pigments (Editable)
              </div>

              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1 rounded-lg border border-white/10 bg-[#0F142B] p-2">
                  <span className="text-[10px] text-slate-400">3D Skin Tone</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={skinColor}
                      onChange={(e) => setSkinColor(e.target.value)}
                      className="h-6 w-6 cursor-pointer rounded border border-white/20 bg-transparent"
                    />
                    <span className="font-mono-tabular text-[11px] text-white">
                      {skinColor}
                    </span>
                  </div>
                </label>

                <label className="flex flex-col gap-1 rounded-lg border border-white/10 bg-[#0F142B] p-2">
                  <span className="text-[10px] text-slate-400">3D Hair Mesh</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={hairColor}
                      onChange={(e) => setHairColor(e.target.value)}
                      className="h-6 w-6 cursor-pointer rounded border border-white/20 bg-transparent"
                    />
                    <span className="font-mono-tabular text-[11px] text-white">
                      {hairColor}
                    </span>
                  </div>
                </label>

                <label className="flex flex-col gap-1 rounded-lg border border-white/10 bg-[#0F142B] p-2">
                  <span className="text-[10px] text-slate-400">Stage Outfit</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={outfitColor}
                      onChange={(e) => setOutfitColor(e.target.value)}
                      className="h-6 w-6 cursor-pointer rounded border border-white/20 bg-transparent"
                    />
                    <span className="font-mono-tabular text-[11px] text-white">
                      {outfitColor}
                    </span>
                  </div>
                </label>
              </div>

              {/* Switchable 3D Head Reconstruction Mode */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-300">
                  3D Sculpted Head Face Mapping Mode
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ['snapshot', '3D Face Snapshot'],
                      ['live-video', 'Live Video Face'],
                      ['stylized', 'Stylized 3D Eyes'],
                    ] as Array<[FaceTextureMode, string]>
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setFaceMode(mode)}
                      className={`rounded-lg px-2 py-2 text-[11px] font-medium transition-colors ${
                        faceMode === mode
                          ? 'bg-[#2162F5] text-white border border-white/25'
                          : 'bg-white/6 text-slate-300 hover:bg-white/12'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Live LED Wall Broadcast Toggle */}
              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#0F142B] px-3 py-2">
                <div className="flex items-center gap-2">
                  <Tv className="h-4 w-4 text-[#FF3CAC]" />
                  <div>
                    <div className="text-xs font-medium text-white">
                      Also Broadcast Camera on Stage LED Screens
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Maps your live stream onto the giant LED walls behind your 3D DJ avatar
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={projectOnLedWalls}
                  onChange={(e) => setProjectOnLedWalls(e.target.checked)}
                  className="h-4 w-4 accent-[#00E5FF]"
                />
              </label>
            </div>

            {snapshotPreviewUrl && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1.5 text-[11px] text-emerald-300">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <span>3D Facial UV Snapshot & Pigments Ready</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Video className="h-3.5 w-3.5 text-[#00E5FF]" />
            <span>Real-time head tilt & hand pose tracking remain active on stage</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl bg-white/8 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-white/14 min-h-[40px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerateAndBeamToStage}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#2162F5] px-4 py-2 text-xs font-bold text-[#080B1D] shadow-lg hover:brightness-110 min-h-[40px]"
            >
              <UserCheck className="h-4 w-4" />
              <span>Generate 3D Avatar & Beam to Stage</span>
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
