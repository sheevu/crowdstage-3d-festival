import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Copy,
  Disc,
  Download,
  ExternalLink,
  Flame,
  FolderOpen,
  Globe,
  Guitar,
  Layers,
  PartyPopper,
  Play,
  Share2,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { useFestivalStore } from '../store/useFestivalStore';
import { STAGE_TEMPLATES } from '../data/presets';
import { computeFestivalDna } from '../utils/festivalDna';
import { sharedAudioEngine } from '../audio/AudioEngine';
import { AudioSpectrumCanvas } from './AudioSpectrumCanvas';
import {
  CrowdModelStyle,
  FestivalProject,
  MainEventStyle,
  StageFloorMaterial,
  StrobeMode,
  VisualFxType,
} from '../types/festival';

interface CreatorDashboardProps {
  onCaptureSnapshot: () => string | null;
}

const VFX_PRESETS: Array<{
  type: VisualFxType;
  title: string;
  subtitle: string;
  icon: typeof Flame;
  defaultPrimary: string;
  defaultSecondary: string;
  baseParticles: number;
}> = [
  {
    type: 'confetti',
    title: 'Confetti Cannons',
    subtitle: 'Fluttering metallic stadium confetti shower across stage & crowd',
    icon: PartyPopper,
    defaultPrimary: '#00E5FF',
    defaultSecondary: '#FF3CAC',
    baseParticles: 44,
  },
  {
    type: 'pyrotechnics',
    title: 'Stage Pyrotechnics',
    subtitle: 'Quad-nozzle front stage flame jets & golden mortar embers',
    icon: Flame,
    defaultPrimary: '#FF7B29',
    defaultSecondary: '#FFB703',
    baseParticles: 48,
  },
  {
    type: 'laser-burst',
    title: 'Laser Nova Burst',
    subtitle: '360° razor-sharp coherent laser needles & fan sweep',
    icon: Zap,
    defaultPrimary: '#00E5FF',
    defaultSecondary: '#8B5CF6',
    baseParticles: 30,
  },
  {
    type: 'spark-fountain',
    title: 'Cryo Spark Fountain',
    subtitle: 'High-velocity diamond sparkler geysers flanking the stage',
    icon: Sparkles,
    defaultPrimary: '#38BDF8',
    defaultSecondary: '#F43F5E',
    baseParticles: 42,
  },
  {
    type: 'strobe-storm',
    title: 'Strobe & Laser Storm',
    subtitle: 'High-power Xenon strobe blinders + white-hot laser barrage',
    icon: Zap,
    defaultPrimary: '#FFFFFF',
    defaultSecondary: '#00E5FF',
    baseParticles: 34,
  },
];

const STAGE_FLOOR_MATERIALS: Array<{
  id: StageFloorMaterial;
  title: string;
  subtitle: string;
  specBadge: string;
  accent: string;
  bgPreview: string;
}> = [
  {
    id: 'reflective-water',
    title: 'Reflective Water',
    subtitle: 'Mirror-smooth aquatic deck with bass ripple caustics & specular sheen',
    specBadge: 'Roughness 0.05 · Clearcoat 1.0',
    accent: '#00E5FF',
    bgPreview: 'radial-gradient(circle at 50% 50%, #093B5A 0%, #041626 100%)',
  },
  {
    id: 'polished-obsidian',
    title: 'Polished Obsidian',
    subtitle: 'Volcanic mirror-black stone slabs with golden mineral veins',
    specBadge: 'Roughness 0.09 · Metalness 0.88',
    accent: '#FFB703',
    bgPreview: 'linear-gradient(135deg, #07080F 0%, #15192E 50%, #080912 100%)',
  },
  {
    id: 'gridded-cyber-neon',
    title: 'Gridded Cyber-Neon',
    subtitle: 'High-contrast carbon deck with razor-sharp synthwave perspective grid',
    specBadge: 'Roughness 0.22 · Neon Circuit Grid',
    accent: '#FF3CAC',
    bgPreview: 'repeating-linear-gradient(90deg, #070B1A 0px, #070B1A 14px, #00E5FF33 15px)',
  },
];

const MAIN_EVENT_ACTS: Array<{
  id: MainEventStyle;
  title: string;
  subtitle: string;
  badge: string;
  accent: string;
  icon: typeof Guitar;
}> = [
  {
    id: 'lolla-headliner',
    title: 'Lollapalooza All-Star Headliner',
    subtitle: 'Full festival mainstage: Live Rock Band + DJ + Breakdancer + Aerial Acrobats',
    badge: 'FULL ENSEMBLE',
    accent: '#FF3CAC',
    icon: Sparkles,
  },
  {
    id: 'rock-band',
    title: 'Live Rock Band',
    subtitle: 'Lead Guitarist, Bassist, Drummer on 3D drum kit & Front Stage Vocalist',
    badge: '4-PIECE BAND',
    accent: '#F43F5E',
    icon: Guitar,
  },
  {
    id: 'break-dancer',
    title: 'Break Dancer Cypher Crew',
    subtitle: 'Center stage B-Boy doing 3D windmills & headspins with hype crew',
    badge: '3D CYPHER',
    accent: '#10B981',
    icon: Users,
  },
  {
    id: 'acrobats',
    title: 'Cirque Aerial Acrobats',
    subtitle: 'High-flying aerialists spinning on glowing silks & lyra hoops under the arch',
    badge: 'AERIAL SHOW',
    accent: '#00E5FF',
    icon: Wand2,
  },
  {
    id: 'dj',
    title: 'Headliner DJ & Turntables',
    subtitle: 'Solo superstar DJ commanding the Holo Console & giant LED screens',
    badge: 'SOLO DECK',
    accent: '#FFB703',
    icon: Disc,
  },
];

const VFX_COLOR_DUOS: Array<{ label: string; primary: string; secondary: string }> = [
  { label: 'Cyber Neon', primary: '#00E5FF', secondary: '#FF3CAC' },
  { label: 'Solar Pyro', primary: '#FF7B29', secondary: '#FFB703' },
  { label: 'Ultraviolet', primary: '#8B5CF6', secondary: '#00E5FF' },
  { label: 'Emerald Rave', primary: '#10B981', secondary: '#38BDF8' },
  { label: 'Crimson Gold', primary: '#F43F5E', secondary: '#FFB703' },
];

export function CreatorDashboard({ onCaptureSnapshot }: CreatorDashboardProps) {
  const open = useFestivalStore((s) => s.dashboardOpen);
  const setOpen = useFestivalStore((s) => s.setDashboardOpen);
  const project = useFestivalStore((s) => s.project);
  const setProject = useFestivalStore((s) => s.setProject);
  const updateProjectMeta = useFestivalStore((s) => s.updateProjectMeta);
  const updateLighting = useFestivalStore((s) => s.updateLighting);
  const updateCrowd = useFestivalStore((s) => s.updateCrowd);
  const audio = useFestivalStore((s) => s.audio);
  const savedProjects = useFestivalStore((s) => s.savedProjects);
  const saveCurrentProject = useFestivalStore((s) => s.saveCurrentProject);
  const duplicateProject = useFestivalStore((s) => s.duplicateProject);
  const deleteSavedProject = useFestivalStore((s) => s.deleteSavedProject);

  const communityProjects = useFestivalStore((s) => s.communityProjects);
  const setCommunityProjects = useFestivalStore((s) => s.setCommunityProjects);
  const remixProject = useFestivalStore((s) => s.remixProject);
  const measuredFps = useFestivalStore((s) => s.measuredFps);
  const showToast = useFestivalStore((s) => s.showToast);

  const visualFxConfig = useFestivalStore((s) => s.visualFxConfig);
  const updateVisualFxConfig = useFestivalStore((s) => s.updateVisualFxConfig);
  const triggerVisualFxBurst = useFestivalStore((s) => s.triggerVisualFxBurst);

  const [tab, setTab] = useState<'vfx' | 'stage-style' | 'my' | 'templates' | 'community' | 'dna'>('vfx');
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [loadingCommunity, setLoadingCommunity] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const dna = useMemo(() => computeFestivalDna(project), [project]);

  useEffect(() => {
    if (!open) return;
    setLoadingCommunity(true);
    fetch('/api/festivals')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.festivals)) {
          setCommunityProjects(data.festivals);
        }
      })
      .catch(() => {
        // fallback gracefully
      })
      .finally(() => setLoadingCommunity(false));
  }, [open, setCommunityProjects]);

  // Live 2D Particle Simulation Preview inside the Visual FX Console
  useEffect(() => {
    if (!open || tab !== 'vfx') return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const count = Math.min(80, Math.round(28 * visualFxConfig.density));
    const particles = Array.from({ length: count }, (_, i) => ({
      x: canvas.width * 0.5 + ((i % 3) - 1) * 55,
      y:
        visualFxConfig.effectType === 'confetti'
          ? Math.random() * canvas.height
          : canvas.height - 14,
      vx: (Math.random() - 0.5) * 2.8 * visualFxConfig.spread,
      vy:
        visualFxConfig.effectType === 'confetti'
          ? 0.9 + Math.random() * 1.6 * visualFxConfig.velocity
          : -(2.2 + Math.random() * 3.2) * visualFxConfig.velocity,
      angle: (i / count) * Math.PI * 2,
      size: 3 + (i % 4),
      color: i % 2 === 0 ? visualFxConfig.primaryColor : visualFxConfig.secondaryColor,
    }));

    const renderLoop = () => {
      const isStrobe =
        visualFxConfig.effectType === 'strobe-storm' && Math.sin(Date.now() * 0.045) > 0.3;
      ctx.fillStyle = isStrobe ? 'rgba(255, 255, 255, 0.25)' : 'rgba(8, 11, 29, 0.32)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Stage horizon baseline
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(16, canvas.height - 14);
      ctx.lineTo(canvas.width - 16, canvas.height - 14);
      ctx.stroke();

      particles.forEach((p, idx) => {
        p.color =
          idx % 2 === 0 ? visualFxConfig.primaryColor : visualFxConfig.secondaryColor;

        if (
          visualFxConfig.effectType === 'laser-burst' ||
          visualFxConfig.effectType === 'strobe-storm'
        ) {
          p.angle += 0.018 * visualFxConfig.velocity;
          const len =
            42 +
            ((Date.now() * 0.09 * visualFxConfig.velocity + idx * 9) %
              (85 * visualFxConfig.spread));
          const cx = canvas.width * 0.5;
          const cy = canvas.height * 0.55;
          const ex = cx + Math.cos(p.angle) * len;
          const ey = cy + Math.sin(p.angle) * len * 0.65;
          // Outer neon sheath
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          // Razor-sharp white-hot core
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        } else if (visualFxConfig.effectType === 'confetti') {
          p.x += Math.sin(Date.now() * 0.004 + idx) * 0.9 * visualFxConfig.spread;
          p.y += p.vy;
          if (p.y > canvas.height - 12) {
            p.y = 6;
            p.x = canvas.width * 0.5 + (Math.random() - 0.5) * 210 * visualFxConfig.spread;
          }
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Date.now() * 0.005 + idx);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
          ctx.restore();
        } else {
          // Pyrotechnics or Cryo Spark Fountain
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.09;
          if (p.y > canvas.height - 12 || p.y < 6) {
            const nozzleOffset =
              visualFxConfig.effectType === 'pyrotechnics'
                ? ((idx % 4) - 1.5) * 58
                : ((idx % 2) - 0.5) * 90;
            p.x = canvas.width * 0.5 + nozzleOffset;
            p.y = canvas.height - 16;
            p.vx = (Math.random() - 0.5) * 2.8 * visualFxConfig.spread;
            p.vy = -(2.4 + Math.random() * 2.8) * visualFxConfig.velocity;
          }
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.85, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [open, tab, visualFxConfig]);

  if (!open) return null;

  const activePresetMeta =
    VFX_PRESETS.find((p) => p.type === visualFxConfig.effectType) ?? VFX_PRESETS[0];
  const estimatedParticles = Math.round(
    activePresetMeta.baseParticles * visualFxConfig.density
  );
  const currentFloorMaterial: StageFloorMaterial =
    project.lighting.stageFloorMaterial || 'gridded-cyber-neon';
  const currentMainEvent: MainEventStyle =
    project.lighting.mainEventStyle || 'lolla-headliner';
  const currentStrobeMode: StrobeMode =
    project.lighting.strobeMode || 'beat-strobe';

  const handleTriggerGrandFinale = () => {
    triggerVisualFxBurst({ effectType: 'pyrotechnics' });
    window.setTimeout(() => {
      triggerVisualFxBurst({ effectType: 'strobe-storm' });
    }, 120);
    window.setTimeout(() => {
      triggerVisualFxBurst({ effectType: 'confetti' });
    }, 260);
    showToast('Lollapalooza Grand Finale: Pyro + Strobe Lasers + Confetti!');
  };

  const handleShareUrl = async () => {
    const saved = await saveCurrentProject();
    const shareUrl = `${window.location.origin}${window.location.pathname}?festival=${encodeURIComponent(saved.id)}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Shareable festival URL copied');
    } catch {
      showToast(`Share URL ready: ?festival=${saved.id}`);
    }
  };

  const handlePublishToCommunity = async () => {
    const saved = await saveCurrentProject();
    try {
      await fetch('/api/festivals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...saved, isCommunity: true }),
      });
      setCommunityProjects([
        saved,
        ...communityProjects.filter((c) => c.id !== saved.id),
      ]);
      showToast('Published to Community Showcase');
    } catch {
      showToast('Saved locally; could not reach community server');
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '-')}.crowdstage.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as FestivalProject;
        if (parsed && parsed.stageItems && parsed.lighting) {
          setProject(parsed);
          setOpen(false);
          showToast(`Imported "${parsed.name}"`);
        }
      } catch {
        showToast('Invalid CrowdStage JSON file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#040612]/80 p-3 sm:p-6">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0A0E24] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              Creator Studio, Visual FX Console & Lollapalooza Stage Director
            </h2>
            <p className="text-xs text-slate-400">
              Customize stage flooring textures, main event performers (Rock Band, Breakdancers, Acrobats, DJ), strobe blinders, and particle FX
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close Studio"
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-white/10 px-5 py-2.5">
          {(
            [
              ['vfx', 'Visual FX Console', Wand2],
              ['stage-style', 'Floor Textures & Main Event', Guitar],
              ['my', 'My Festivals', FolderOpen],
              ['templates', 'Stage Templates', Layers],
              ['community', 'Explore Community', Globe],
              ['dna', 'Festival DNA & Analytics', Sparkles],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap shrink-0 min-h-[38px] ${
                tab === id
                  ? 'bg-[#2162F5] text-white'
                  : 'text-slate-300 hover:bg-white/8 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="crowd-scroll flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: VISUAL FX CONSOLE + FLOOR TEXTURE SELECTOR */}
          {tab === 'vfx' && (
            <div className="space-y-4">
              {/* Stage Flooring Material Selector directly inside Visual FX Console */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-white">
                      Stage Flooring Material & Texture Selector
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Switch the physical 3D stage deck & arena surface material in real time
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('stage-style')}
                    className="rounded-lg border border-[#00E5FF]/40 bg-[#00E5FF]/10 px-2.5 py-1 text-[11px] font-semibold text-[#00E5FF] hover:bg-[#00E5FF]/20"
                  >
                    Switch Main Event Act ({MAIN_EVENT_ACTS.find((a) => a.id === currentMainEvent)?.title}) →
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {STAGE_FLOOR_MATERIALS.map((mat) => {
                    const active = currentFloorMaterial === mat.id;
                    return (
                      <button
                        key={mat.id}
                        type="button"
                        onClick={() => {
                          updateLighting({ stageFloorMaterial: mat.id });
                          showToast(`Stage Flooring set to ${mat.title}`);
                        }}
                        className={`flex flex-col justify-between gap-2 rounded-xl border p-3 text-left transition-all ${
                          active
                            ? 'border-[#00E5FF] bg-[#00E5FF]/12 shadow-md'
                            : 'border-white/10 bg-[#080B1D]/70 hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="h-6 w-12 rounded-md border border-white/20"
                            style={{ background: mat.bgPreview }}
                          />
                          <span
                            className="rounded px-2 py-0.5 text-[10px] font-mono-tabular font-semibold"
                            style={{
                              backgroundColor: `${mat.accent}22`,
                              color: mat.accent,
                            }}
                          >
                            {active ? 'ACTIVE' : 'SELECT'}
                          </span>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{mat.title}</div>
                          <div className="mt-0.5 text-[11px] leading-snug text-slate-400">
                            {mat.subtitle}
                          </div>
                          <div className="mt-1 text-[10px] font-mono-tabular text-slate-300">
                            {mat.specBadge}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Particle Effect Type Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                {VFX_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  const active = visualFxConfig.effectType === preset.type;
                  return (
                    <button
                      key={preset.type}
                      type="button"
                      onClick={() =>
                        updateVisualFxConfig({
                          effectType: preset.type,
                          primaryColor: preset.defaultPrimary,
                          secondaryColor: preset.defaultSecondary,
                        })
                      }
                      className={`flex flex-col justify-between gap-2 rounded-xl border p-3 text-left transition-all ${
                        active
                          ? 'border-[#00E5FF] bg-[#00E5FF]/12 shadow-md'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                          <Icon
                            className="h-4 w-4"
                            style={{ color: preset.defaultPrimary }}
                          />
                        </span>
                        <span
                          className="rounded-md px-2 py-0.5 text-[10px] font-mono-tabular font-semibold"
                          style={{
                            backgroundColor: `${preset.defaultPrimary}22`,
                            color: preset.defaultPrimary,
                          }}
                        >
                          {Math.round(preset.baseParticles * visualFxConfig.density)} pts
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">
                          {preset.title}
                        </div>
                        <div className="mt-0.5 text-[11px] leading-snug text-slate-400">
                          {preset.subtitle}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Parameters & Live Preview Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Density, Velocity, Spread, Strobe & Laser Sharpness */}
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                      <Sliders className="h-3.5 w-3.5 text-[#00E5FF]" />
                      Particle, Strobe & Sharp Laser Controls
                    </span>
                    <span className="font-mono-tabular text-[11px] text-[#00E5FF]">
                      ~{estimatedParticles} 3D Meshes / Burst
                    </span>
                  </div>

                  {/* Density Slider */}
                  <label className="block space-y-1">
                    <div className="flex justify-between text-slate-300">
                      <span>Burst Density</span>
                      <span className="font-mono-tabular text-white">
                        {Math.round(visualFxConfig.density * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.2}
                      max={2.0}
                      step={0.1}
                      value={visualFxConfig.density}
                      onChange={(e) =>
                        updateVisualFxConfig({ density: Number(e.target.value) })
                      }
                      className="crowd-slider w-full"
                    />
                  </label>

                  {/* Launch Velocity Slider */}
                  <label className="block space-y-1">
                    <div className="flex justify-between text-slate-300">
                      <span>Launch Velocity & Height</span>
                      <span className="font-mono-tabular text-white">
                        {Math.round(visualFxConfig.velocity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      value={visualFxConfig.velocity}
                      onChange={(e) =>
                        updateVisualFxConfig({ velocity: Number(e.target.value) })
                      }
                      className="crowd-slider w-full"
                    />
                  </label>

                  {/* Arena Spread Slider */}
                  <label className="block space-y-1">
                    <div className="flex justify-between text-slate-300">
                      <span>Stage & Arena Spread</span>
                      <span className="font-mono-tabular text-white">
                        {Math.round(visualFxConfig.spread * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.3}
                      max={2.0}
                      step={0.1}
                      value={visualFxConfig.spread}
                      onChange={(e) =>
                        updateVisualFxConfig({ spread: Number(e.target.value) })
                      }
                      className="crowd-slider w-full"
                    />
                  </label>

                  {/* Strobe Light Mode & Laser Sharpness */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-white/10">
                    <label className="block space-y-1">
                      <span className="text-slate-300">Strobe Blinder Mode</span>
                      <select
                        value={currentStrobeMode}
                        onChange={(e) =>
                          updateLighting({
                            strobeMode: e.target.value as StrobeMode,
                            reducedFlashing: false,
                          })
                        }
                        className="w-full rounded-lg border border-white/15 bg-[#080B1D] px-2.5 py-1.5 text-xs text-white"
                      >
                        <option value="beat-strobe">Beat-Synced Strobe</option>
                        <option value="hyper-blinder">Hyper Xenon Blinder</option>
                        <option value="color-strobe">Dual-Color Strobe</option>
                        <option value="off">Strobe Off</option>
                      </select>
                    </label>

                    <label className="block space-y-1">
                      <div className="flex justify-between text-slate-300">
                        <span>Laser Focus Sharpness</span>
                        <span className="font-mono-tabular text-white">
                          {Math.round((project.lighting.laserSharpness ?? 1.0) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.4}
                        max={1.5}
                        step={0.05}
                        value={project.lighting.laserSharpness ?? 1.0}
                        onChange={(e) =>
                          updateLighting({ laserSharpness: Number(e.target.value) })
                        }
                        className="crowd-slider w-full mt-2"
                      />
                    </label>
                  </div>

                  {/* Custom Color Pickers + Swatch Duos */}
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Custom FX Colors</span>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#080B1D] px-2 py-1">
                          <input
                            type="color"
                            aria-label="Primary FX Color"
                            value={visualFxConfig.primaryColor}
                            onChange={(e) =>
                              updateVisualFxConfig({ primaryColor: e.target.value })
                            }
                            className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent"
                          />
                          <span className="font-mono-tabular text-[11px] text-slate-200">
                            {visualFxConfig.primaryColor}
                          </span>
                        </label>
                        <label className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#080B1D] px-2 py-1">
                          <input
                            type="color"
                            aria-label="Secondary FX Color"
                            value={visualFxConfig.secondaryColor}
                            onChange={(e) =>
                              updateVisualFxConfig({ secondaryColor: e.target.value })
                            }
                            className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent"
                          />
                          <span className="font-mono-tabular text-[11px] text-slate-200">
                            {visualFxConfig.secondaryColor}
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {VFX_COLOR_DUOS.map((duo) => (
                        <button
                          key={duo.label}
                          type="button"
                          onClick={() =>
                            updateVisualFxConfig({
                              primaryColor: duo.primary,
                              secondaryColor: duo.secondary,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: duo.primary }}
                          />
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: duo.secondary }}
                          />
                          <span>{duo.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Beat-Sync Auto-Fire Toggle */}
                  <label className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-[#080B1D] px-3 py-2 mt-1">
                    <div>
                      <div className="font-semibold text-white">
                        Auto-Trigger FX on Heavy Bass Drops
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Automatically fires this particle system whenever audio bass peaks
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={visualFxConfig.autoBeatTrigger}
                      onChange={(e) =>
                        updateVisualFxConfig({ autoBeatTrigger: e.target.checked })
                      }
                      className="h-4 w-4 accent-[#00E5FF]"
                    />
                  </label>
                </div>

                {/* Right: Live FX Telemetry Canvas & Trigger Pads */}
                <div className="flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">
                        Real-Time Trajectory & Palette Preview
                      </span>
                      <span className="rounded bg-[#00E5FF]/15 px-2 py-0.5 text-[10px] font-semibold text-[#00E5FF] uppercase">
                        {activePresetMeta.title}
                      </span>
                    </div>
                    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#080B1D]">
                      <canvas
                        ref={previewCanvasRef}
                        width={360}
                        height={155}
                        className="h-36 w-full block"
                      />
                    </div>
                  </div>

                  {/* Primary Trigger Buttons */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          triggerVisualFxBurst();
                          showToast(`Fired ${activePresetMeta.title} (${estimatedParticles} particles)`);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#2162F5] px-4 py-2.5 text-xs font-bold text-[#080B1D] shadow-lg hover:brightness-110 min-h-[42px]"
                      >
                        <Play className="h-4 w-4 fill-current" />
                        Trigger FX Burst Now
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          triggerVisualFxBurst();
                          setOpen(false);
                          showToast(`Launched ${activePresetMeta.title} on 3D Stage!`);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#00E5FF]/40 bg-[#00E5FF]/15 px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#00E5FF]/25 min-h-[42px]"
                      >
                        <Sparkles className="h-4 w-4 text-[#00E5FF]" />
                        Trigger & Watch in 3D
                      </button>
                    </div>

                    {/* Quick Multi-Cue Launch Pad */}
                    <div className="pt-2 border-t border-white/10">
                      <div className="text-[11px] text-slate-400 mb-1.5">
                        Instant Lollapalooza Show Cues:
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            triggerVisualFxBurst({ effectType: 'strobe-storm' });
                            showToast('Xenon Strobe Blinders & Laser Storm Fired!');
                          }}
                          className="rounded-lg bg-white/10 px-2.5 py-2 text-[11px] font-semibold text-white hover:bg-white/20"
                        >
                          Strobe Blinder
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            triggerVisualFxBurst({ effectType: 'pyrotechnics' });
                            showToast('Stage Pyro Jets Fired!');
                          }}
                          className="rounded-lg bg-white/8 px-2.5 py-2 text-[11px] font-medium text-slate-200 hover:bg-white/15"
                        >
                          Pyro Mortars
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            triggerVisualFxBurst({ effectType: 'laser-burst' });
                            showToast('Razor-Sharp Laser Nova Fired!');
                          }}
                          className="rounded-lg bg-white/8 px-2.5 py-2 text-[11px] font-medium text-slate-200 hover:bg-white/15"
                        >
                          Sharp Lasers
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleTriggerGrandFinale();
                            setOpen(false);
                          }}
                          className="rounded-lg bg-[#FF3CAC] px-2.5 py-2 text-[11px] font-bold text-white hover:bg-[#FF55B6]"
                        >
                          Grand Finale!
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FLOOR TEXTURES & LOLLAPALOOZA MAIN EVENT LINEUP */}
          {tab === 'stage-style' && (
            <div className="space-y-5">
              {/* Main Event Headliner Lineup Selector */}
              <div className="space-y-2.5">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Lollapalooza Main Event Performer Lineup
                  </h3>
                  <p className="text-xs text-slate-400">
                    Choose the live 3D performance act on the Main Stage (Rock Band with 3D guitars & drum kit, Breakdancer Cypher Crew, Cirque Aerial Acrobats, or DJ)
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {MAIN_EVENT_ACTS.map((act) => {
                    const Icon = act.icon;
                    const active = currentMainEvent === act.id;
                    return (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => {
                          updateLighting({ mainEventStyle: act.id });
                          showToast(`Main Event switched to ${act.title}`);
                        }}
                        className={`flex flex-col justify-between gap-2.5 rounded-xl border p-3.5 text-left transition-all ${
                          active
                            ? 'border-[#00E5FF] bg-[#00E5FF]/12 shadow-lg'
                            : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                            <Icon className="h-4 w-4" style={{ color: act.accent }} />
                          </span>
                          <span
                            className="rounded-md px-2 py-0.5 text-[10px] font-mono-tabular font-bold"
                            style={{
                              backgroundColor: `${act.accent}24`,
                              color: act.accent,
                            }}
                          >
                            {act.badge}
                          </span>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{act.title}</div>
                          <div className="mt-1 text-[11px] leading-snug text-slate-300">
                            {act.subtitle}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stage Flooring Material Selector */}
              <div className="space-y-2.5 pt-3 border-t border-white/10">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Stage Flooring Material Texture
                  </h3>
                  <p className="text-xs text-slate-400">
                    Select between Reflective Water, Polished Obsidian, and Gridded Cyber-Neon PBR surfaces
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {STAGE_FLOOR_MATERIALS.map((mat) => {
                    const active = currentFloorMaterial === mat.id;
                    return (
                      <button
                        key={mat.id}
                        type="button"
                        onClick={() => {
                          updateLighting({ stageFloorMaterial: mat.id });
                          showToast(`Floor Material set to ${mat.title}`);
                        }}
                        className={`flex flex-col justify-between gap-3 rounded-xl border p-4 text-left transition-all ${
                          active
                            ? 'border-[#00E5FF] bg-[#00E5FF]/12 shadow-lg'
                            : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
                        }`}
                      >
                        <div
                          className="h-14 w-full rounded-lg border border-white/15"
                          style={{ background: mat.bgPreview }}
                        />
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">{mat.title}</span>
                            {active && (
                              <span className="text-[10px] font-bold text-[#00E5FF]">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400">{mat.subtitle}</p>
                          <div className="mt-2 text-[10px] font-mono-tabular text-slate-300">
                            {mat.specBadge}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Poly Pizza Crowd Character Style & Real-Time Audio Frequency Response Analyzer */}
              <div className="space-y-3 pt-3 border-t border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Poly Pizza Crowd Assets & Audio Frequency Response (AFR) Analyzer
                    </h3>
                    <p className="text-xs text-slate-400">
                      Maps live 7-band audio frequencies & BPM directly to crowd jump height, leg stomp speed, arm pump, and mosh aggression
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={project.crowd.modelStyle ?? 'lolla-mix'}
                      onChange={(e) => {
                        updateCrowd({ modelStyle: e.target.value as CrowdModelStyle });
                        showToast(`Crowd Archetype: ${e.target.selectedOptions[0]?.text}`);
                      }}
                      className="rounded-lg border border-[#00E5FF]/40 bg-[#080B1D] px-3 py-1.5 text-xs font-semibold text-[#00E5FF]"
                    >
                      <option value="lolla-mix">Poly Pizza: Lollapalooza Mix</option>
                      <option value="poly-festival">Poly Pizza: Totems & Smartphones</option>
                      <option value="streetwear-lowpoly">Poly Pizza: Streetwear & Hats</option>
                      <option value="cyber-raver">Three.js: Cyber Ravers</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <label className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1.5">
                    <div className="flex justify-between text-slate-300">
                      <span>Music Tempo / BPM Drive</span>
                      <span className="font-mono-tabular font-bold text-[#00E5FF]">
                        {project.crowd.bpmOverride ?? audio.bpmEstimate} BPM
                      </span>
                    </div>
                    <input
                      type="range"
                      min={75}
                      max={180}
                      step={1}
                      value={project.crowd.bpmOverride ?? audio.bpmEstimate}
                      onChange={(e) => {
                        const nextBpm = Number(e.target.value);
                        updateCrowd({ bpmOverride: nextBpm });
                        if (audio.sourceType === 'synth' && audio.isPlaying) {
                          void sharedAudioEngine.startSynth(nextBpm);
                        }
                      }}
                      className="crowd-slider w-full"
                    />
                    <div className="text-[10px] text-slate-400">
                      Higher BPM accelerates avatar step rate & triggers Mosh Overdrive at 144+ BPM
                    </div>
                  </label>

                  <label className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1.5">
                    <div className="flex justify-between text-slate-300">
                      <span>AFR Frequency Gain</span>
                      <span className="font-mono-tabular font-bold text-[#FF3CAC]">
                        {Math.round((project.crowd.afrSensitivity ?? 1.2) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={2.2}
                      step={0.05}
                      value={project.crowd.afrSensitivity ?? 1.2}
                      onChange={(e) =>
                        updateCrowd({ afrSensitivity: Number(e.target.value) })
                      }
                      className="crowd-slider w-full"
                    />
                    <div className="text-[10px] text-slate-400">
                      Amplifies how strongly Sub-Bass, Mid & High-Mid drive avatar limbs
                    </div>
                  </label>

                  <label className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1.5">
                    <div className="flex justify-between text-slate-300">
                      <span>Poly Pizza Handheld Props</span>
                      <span className="font-mono-tabular font-bold text-emerald-300">
                        {Math.round((project.crowd.propDensity ?? 0.75) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={project.crowd.propDensity ?? 0.75}
                      onChange={(e) =>
                        updateCrowd({ propDensity: Number(e.target.value) })
                      }
                      className="crowd-slider w-full"
                    />
                    <div className="text-[10px] text-slate-400">
                      Smartphones filming stage, festival totems & glowing rave wands
                    </div>
                  </label>
                </div>

                <AudioSpectrumCanvas />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#00E5FF] px-4 py-2.5 text-xs font-bold text-[#080B1D] hover:bg-[#33ECFF]"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Watch Main Event on 3D Stage
                </button>
              </div>
            </div>
          )}

          {tab === 'my' && (
            <div className="space-y-5">
              {/* Current Project Metadata & Share */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Festival Title
                    </label>
                    <input
                      type="text"
                      value={project.name}
                      onChange={(e) => updateProjectMeta({ name: e.target.value })}
                      className="w-full rounded-lg border border-white/15 bg-[#080B1D] px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Creator Handle
                      </label>
                      <input
                        type="text"
                        value={project.creator}
                        onChange={(e) => updateProjectMeta({ creator: e.target.value })}
                        className="w-full rounded-lg border border-white/15 bg-[#080B1D] px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <label className="flex items-center gap-2 pt-5 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={project.allowRemix}
                        onChange={(e) => updateProjectMeta({ allowRemix: e.target.checked })}
                        className="accent-[#00E5FF]"
                      />
                      Allow Remixing
                    </label>
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void saveCurrentProject()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#2162F5] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#3170FF] min-h-[40px]"
                    >
                      Save Project
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleShareUrl()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#00E5FF] px-3.5 py-2 text-xs font-semibold text-[#080B1D] hover:bg-[#33ECFF] min-h-[40px]"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Copy Share URL
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePublishToCommunity()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-xs font-medium text-white hover:bg-white/14 min-h-[40px]"
                    >
                      <Globe className="h-3.5 w-3.5 text-[#FF3CAC]" />
                      Publish
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const url = onCaptureSnapshot();
                        if (url) setSnapshotUrl(url);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/6 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/12 min-h-[36px]"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Capture Preview
                    </button>
                    <button
                      type="button"
                      onClick={handleExportJson}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/6 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/12 min-h-[36px]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export JSON
                    </button>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/12 bg-white/6 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/12 min-h-[36px]">
                      <Upload className="h-3.5 w-3.5" />
                      Import JSON
                      <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={(e) => handleImportJson(e.target.files?.[0])}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {snapshotUrl && (
                <div className="rounded-xl border border-[#00E5FF]/30 bg-black/40 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">Captured 3D Festival Preview</span>
                    <a
                      href={snapshotUrl}
                      download={`${project.name.toLowerCase().replace(/\s+/g, '-')}-preview.png`}
                      className="inline-flex items-center gap-1 text-[#00E5FF] hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download PNG
                    </a>
                  </div>
                  <img
                    src={snapshotUrl}
                    alt="Captured 3D Festival Preview"
                    className="max-h-52 w-full rounded-lg object-cover"
                  />
                </div>
              )}

              {/* Saved Festivals List */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-300">
                  Saved Festivals ({savedProjects.length})
                </h3>
                {savedProjects.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-xs text-slate-400">
                    No saved festivals yet. Click "Save Project" above to store your current stage.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {savedProjects.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">
                            {p.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {p.environment.replace('-', ' ')} · {p.stageItems.length} objects
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setProject(p);
                              setOpen(false);
                              showToast(`Opened "${p.name}"`);
                            }}
                            className="rounded-lg bg-[#2162F5] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#3170FF]"
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateProject(p.id)}
                            title="Duplicate"
                            className="rounded-lg bg-white/8 p-1.5 text-slate-300 hover:text-white"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSavedProject(p.id)}
                            title="Delete"
                            className="rounded-lg bg-rose-500/15 p-1.5 text-rose-300 hover:bg-rose-500/25"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'templates' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STAGE_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.environment}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">{tpl.name}</h3>
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: tpl.lighting.primaryColor }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {tpl.stageItems.length} stage elements · {tpl.timeOfDay} lighting · {tpl.lighting.ledPreset} visuals
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProject(tpl);
                      setOpen(false);
                      showToast(`Loaded ${tpl.name}`);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#2162F5] px-3 py-2 text-xs font-semibold text-white hover:bg-[#3170FF]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Load Template
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'community' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">
                  Community Festivals & Remixable Templates
                </span>
                <button
                  type="button"
                  onClick={() => void handlePublishToCommunity()}
                  className="rounded-lg bg-[#FF3CAC] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#FF55B6]"
                >
                  Publish Current Stage
                </button>
              </div>
              {loadingCommunity ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Loading community creations...
                </div>
              ) : communityProjects.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-xs text-slate-400">
                  No community stages published yet. Publish your current festival to share it here!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {communityProjects.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">{c.name}</div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          By {c.creator} · {c.environment.replace('-', ' ')}
                          {c.remixedFrom ? ` · Remixed from ${c.remixedFrom}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setProject(c);
                            setOpen(false);
                          }}
                          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15"
                        >
                          Preview
                        </button>
                        {c.allowRemix !== false && (
                          <button
                            type="button"
                            onClick={() => remixProject(c)}
                            className="rounded-lg bg-[#8B5CF6] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#9D74FA]"
                          >
                            Remix with Attribution
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'dna' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Procedural Festival DNA Emblem */}
              <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0">
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke={dna.palette[0]}
                    strokeWidth="2"
                    strokeOpacity="0.5"
                  />
                  {dna.seedValues.map((val, i) => {
                    const angle = (i / dna.seedValues.length) * Math.PI * 2;
                    const r = 18 + val * 28;
                    const x = 60 + Math.cos(angle) * r;
                    const y = 60 + Math.sin(angle) * r;
                    return (
                      <g key={i}>
                        <line
                          x1="60"
                          y1="60"
                          x2={x}
                          y2={y}
                          stroke={dna.palette[i % 2]}
                          strokeWidth="2"
                        />
                        <circle
                          cx={x}
                          cy={y}
                          r={3 + val * 4}
                          fill={dna.palette[(i + 1) % 2]}
                        />
                      </g>
                    );
                  })}
                  <circle cx="60" cy="60" r="7" fill="#FFFFFF" />
                </svg>

                <div className="space-y-1.5 min-w-0">
                  <div className="text-[11px] font-mono-tabular text-[#00E5FF]">
                    DNA {dna.code}
                  </div>
                  <div className="font-display text-base font-bold text-white">
                    {dna.archetype}
                  </div>
                  <div className="text-xs text-slate-400">
                    Tier: {dna.energyTier} · Symmetry {dna.symmetryScore}%
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    {dna.palette.map((c, idx) => (
                      <span
                        key={idx}
                        className="h-4 w-4 rounded border border-white/20"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Real Scene Analytics */}
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs">
                <div>
                  <div className="text-slate-400">Placed Stage Objects</div>
                  <div className="mt-1 font-mono-tabular text-xl font-bold text-white">
                    {project.stageItems.length}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Render Frame Rate</div>
                  <div className="mt-1 font-mono-tabular text-xl font-bold text-[#00E5FF]">
                    {measuredFps} FPS
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Crowd Density</div>
                  <div className="mt-1 font-mono-tabular text-xl font-bold text-white">
                    {Math.round(project.crowd.density * 100)}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Camera Keyframes</div>
                  <div className="mt-1 font-mono-tabular text-xl font-bold text-white">
                    {project.cameraSequence.length}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
