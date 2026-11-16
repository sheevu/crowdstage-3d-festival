import { useEffect, useRef } from 'react';
import { sharedAudioEngine } from '../audio/AudioEngine';
import { useFestivalStore } from '../store/useFestivalStore';
import { CrowdAggressionLevel } from '../types/festival';

const AGGRESSION_META: Record<
  CrowdAggressionLevel,
  { label: string; color: string; bg: string }
> = {
  'chill-grooving': {
    label: 'CHILL GROOVE',
    color: '#38BDF8',
    bg: 'rgba(56, 189, 248, 0.16)',
  },
  'upbeat-bouncing': {
    label: 'FESTIVAL BOUNCE',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.16)',
  },
  'hype-jumping': {
    label: 'HIGH-HYPE JUMP',
    color: '#FFB703',
    bg: 'rgba(255, 183, 3, 0.18)',
  },
  'mosh-frenzy': {
    label: 'MOSH OVERDRIVE',
    color: '#FF3CAC',
    bg: 'rgba(255, 60, 172, 0.22)',
  },
};

export function AudioSpectrumCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const primaryColor = useFestivalStore((s) => s.project.lighting.primaryColor);
  const secondaryColor = useFestivalStore((s) => s.project.lighting.secondaryColor);
  const afrSensitivity = useFestivalStore((s) => s.project.crowd.afrSensitivity ?? 1.2);
  const bpmOverride = useFestivalStore((s) => s.project.crowd.bpmOverride ?? null);
  const audio = useFestivalStore((s) => s.audio);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          const { freqBins, waveBins, metrics } = sharedAudioEngine.sample(
            0.016,
            afrSensitivity,
            bpmOverride
          );

          // Subtle frequency grid lines
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
          ctx.lineWidth = 1;
          [0.25, 0.5, 0.75].forEach((ratio) => {
            ctx.beginPath();
            ctx.moveTo(0, h * ratio);
            ctx.lineTo(w, h * ratio);
            ctx.stroke();
          });

          // 48-Bin Real-Time FFT Spectrum Bars
          const barCount = 48;
          const barW = w / barCount;
          const grad = ctx.createLinearGradient(0, 0, w, 0);
          grad.addColorStop(0, primaryColor);
          grad.addColorStop(0.55, '#8B5CF6');
          grad.addColorStop(1, secondaryColor);
          ctx.fillStyle = grad;

          for (let i = 0; i < barCount; i++) {
            const rawVal = metrics.isPlaying
              ? (freqBins[i * 3] / 255) * Math.min(1.5, afrSensitivity)
              : 0.08 + Math.sin(performance.now() * 0.004 + i * 0.35) * 0.04;
            const val = Math.min(1, rawVal);
            const bh = Math.max(3, val * (h * 0.78));
            ctx.fillRect(i * barW + 1, h - bh, Math.max(2, barW - 2), bh);
          }

          // Smooth Frequency Response Envelope Curve + Time-Domain Waveform
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
          ctx.lineWidth = 1.6;
          const step = Math.floor(waveBins.length / 64);
          for (let i = 0; i < 64; i++) {
            const v = metrics.isPlaying ? waveBins[i * step] / 128.0 : 1.0;
            const y = (v * h) / 2;
            const x = (i / 63) * w;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [primaryColor, secondaryColor, afrSensitivity, bpmOverride]);

  const aggr: CrowdAggressionLevel = audio.aggressionLevel ?? 'upbeat-bouncing';
  const aggrMeta = AGGRESSION_META[aggr];
  const bands = [
    {
      id: 'sub',
      label: 'SUB 20-90Hz',
      kinetic: 'Jump Height',
      val: audio.subBass ?? audio.bass,
      color: '#FF3CAC',
    },
    {
      id: 'bass',
      label: 'BASS 90-340Hz',
      kinetic: 'Leg Stomp',
      val: audio.bass,
      color: '#F43F5E',
    },
    {
      id: 'lowMid',
      label: 'L-MID 350-860Hz',
      kinetic: 'Hip & Mosh',
      val: audio.lowMid ?? audio.mid * 0.8,
      color: '#FFB703',
    },
    {
      id: 'mid',
      label: 'MID 860-2.4kHz',
      kinetic: 'Arm Pump',
      val: audio.mid,
      color: '#10B981',
    },
    {
      id: 'highMid',
      label: 'H-MID 2.4-4.5k',
      kinetic: 'Headbang',
      val: audio.highMid ?? audio.treble * 0.9,
      color: '#00E5FF',
    },
    {
      id: 'presence',
      label: 'PRES 4.5-8kHz',
      kinetic: 'Totem Wave',
      val: audio.presence ?? audio.treble,
      color: '#38BDF8',
    },
    {
      id: 'brilliance',
      label: 'BRIL 8-14kHz',
      kinetic: 'LED Flash',
      val: audio.brilliance ?? audio.treble * 0.85,
      color: '#8B5CF6',
    },
  ];

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-[#050714]/90 p-2.5">
      {/* Header Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">
            Audio Frequency Response (AFR) → Crowd Kinetics
          </span>
          <span
            className="rounded px-2 py-0.5 text-[10px] font-mono-tabular font-bold"
            style={{ color: aggrMeta.color, backgroundColor: aggrMeta.bg }}
          >
            {aggrMeta.label}
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono-tabular text-slate-300">
          <span>
            Tempo:{' '}
            <strong className="text-[#00E5FF]">
              {bpmOverride ?? audio.bpmEstimate} BPM
            </strong>
          </span>
          <span>
            Avatar Speed:{' '}
            <strong className="text-[#FF3CAC]">
              {(audio.danceSpeedMultiplier ?? 1.0).toFixed(2)}x
            </strong>
          </span>
          <span>
            Intensity:{' '}
            <strong className="text-emerald-300">
              {Math.round((audio.crowdIntensity ?? 0.22) * 100)}%
            </strong>
          </span>
        </div>
      </div>

      {/* Live FFT & Time-Domain Waveform Canvas */}
      <canvas
        ref={canvasRef}
        width={480}
        height={64}
        className="h-[58px] w-full rounded-lg border border-white/10 bg-[#040611]"
      />

      {/* 7-Band Audio Frequency Response → Limb Kinetic Mapping Matrix */}
      <div className="grid grid-cols-7 gap-1.5 pt-0.5">
        {bands.map((b) => {
          const pct = Math.min(100, Math.round(b.val * 100));
          return (
            <div
              key={b.id}
              className="flex flex-col justify-between rounded-lg border border-white/8 bg-white/[0.02] p-1.5"
            >
              <div className="flex items-center justify-between text-[9px] font-mono-tabular text-slate-400">
                <span className="truncate">{b.label.split(' ')[0]}</span>
                <span className="text-white">{pct}%</span>
              </div>
              <div className="my-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full transition-all duration-75"
                  style={{
                    width: `${Math.max(8, pct)}%`,
                    backgroundColor: b.color,
                  }}
                />
              </div>
              <div
                className="truncate text-[9px] font-semibold"
                style={{ color: b.color }}
              >
                → {b.kinetic}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
