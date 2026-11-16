import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff } from 'lucide-react';
import { useFestivalStore } from '../store/useFestivalStore';

const PALETTE_PAIRS: Array<[string, string]> = [
  ['#00E5FF', '#FF3CAC'],
  ['#2162F5', '#00E5FF'],
  ['#8B5CF6', '#FFB703'],
  ['#FF3CAC', '#FFB703'],
  ['#10B981', '#00E5FF'],
];

export function HandGestureController() {
  const enabled = useFestivalStore((s) => s.gestureControlEnabled);
  const setEnabled = useFestivalStore((s) => s.setGestureControlEnabled);
  const updateLighting = useFestivalStore((s) => s.updateLighting);
  const showToast = useFestivalStore((s) => s.showToast);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const [status, setStatus] = useState<'idle' | 'active' | 'denied'>('idle');
  const [motionSide, setMotionSide] = useState<'none' | 'left' | 'right' | 'both'>('none');
  const cooldownRef = useRef(0);
  const colorIdxRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      setMotionSide('none');
      return;
    }

    let stream: MediaStream | null = null;
    let rafId = 0;
    let cancelled = false;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 160, height: 120, facingMode: 'user' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('active');

        const analyze = () => {
          if (cancelled) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video && canvas && video.readyState >= 2) {
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, 64, 48);
              const data = ctx.getImageData(0, 0, 64, 48).data;
              const prev = prevFrameRef.current;

              if (prev) {
                let leftMotion = 0;
                let rightMotion = 0;
                for (let y = 0; y < 48; y++) {
                  for (let x = 0; x < 64; x++) {
                    const idx = (y * 64 + x) * 4;
                    const diff =
                      Math.abs(data[idx] - prev[idx]) +
                      Math.abs(data[idx + 1] - prev[idx + 1]) +
                      Math.abs(data[idx + 2] - prev[idx + 2]);
                    if (diff > 65) {
                      if (x < 32) rightMotion++; // mirrored webcam
                      else leftMotion++;
                    }
                  }
                }

                const now = performance.now();
                const threshold = 95;
                if (leftMotion > threshold && rightMotion > threshold) {
                  setMotionSide('both');
                  if (now - cooldownRef.current > 900) {
                    cooldownRef.current = now;
                    updateLighting({ spotlightIntensity: 1.7, laserSpread: 1.35 });
                    showToast('Gesture Drop: Peak Spotlight Boost');
                  }
                } else if (leftMotion > threshold) {
                  setMotionSide('left');
                  if (now - cooldownRef.current > 850) {
                    cooldownRef.current = now;
                    colorIdxRef.current = (colorIdxRef.current + 1) % PALETTE_PAIRS.length;
                    const [p, sec] = PALETTE_PAIRS[colorIdxRef.current];
                    updateLighting({ primaryColor: p, secondaryColor: sec });
                  }
                } else if (rightMotion > threshold) {
                  setMotionSide('right');
                  if (now - cooldownRef.current > 850) {
                    cooldownRef.current = now;
                    const presets = ['spectrum', 'plasma', 'mandala', 'waveform'] as const;
                    const nextPreset = presets[Math.floor(Math.random() * presets.length)];
                    updateLighting({ ledPreset: nextPreset });
                  }
                } else {
                  setMotionSide('none');
                }
              }
              prevFrameRef.current = new Uint8ClampedArray(data);
            }
          }
          rafId = requestAnimationFrame(analyze);
        };
        rafId = requestAnimationFrame(analyze);
      } catch {
        setStatus('denied');
        setEnabled(false);
        showToast('Camera permission declined or unavailable');
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      prevFrameRef.current = null;
    };
  }, [enabled, setEnabled, updateLighting, showToast]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-slate-100">
          Camera Hand-Gesture Effects
        </div>
        <div className="text-[11px] text-slate-400">
          {status === 'active'
            ? `Active (${motionSide === 'none' ? 'wave left/right or both hands' : `detected: ${motionSide}`}) · local only`
            : 'Wave left to shift palette, right to switch LED visuals, both for peak boost'}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setEnabled(!enabled)}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 min-h-[40px] ${
          enabled
            ? 'bg-[#00E5FF] text-[#080B1D]'
            : 'bg-white/10 text-slate-200 hover:bg-white/15'
        }`}
      >
        {enabled ? <CameraOff className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
        {enabled ? 'Stop Camera' : 'Enable Camera'}
      </button>

      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} width={64} height={48} className="hidden" />
    </div>
  );
}
