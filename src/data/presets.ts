import {
  EnvironmentId,
  FestivalProject,
  StageItem,
  StageItemBlueprintType,
  StageItemCategory,
  TimeOfDay,
} from '../types/festival';

export interface EnvironmentMeta {
  id: EnvironmentId;
  name: string;
  subtitle: string;
  defaultTime: TimeOfDay;
  primaryColor: string;
  secondaryColor: string;
  skyTop: string;
  skyHorizon: string;
  fogColor: string;
  groundColor: string;
  accentGlow: string;
}

export const ENVIRONMENTS: EnvironmentMeta[] = [
  {
    id: 'neon-cyberpunk',
    name: 'Neon Cyberpunk City',
    subtitle: 'Rain-slicked holographic plaza & skyline monoliths',
    defaultTime: 'midnight',
    primaryColor: '#00E5FF',
    secondaryColor: '#FF3CAC',
    skyTop: '#060818',
    skyHorizon: '#17123B',
    fogColor: '#0C0F29',
    groundColor: '#0A0D1E',
    accentGlow: '#2162F5',
  },
  {
    id: 'desert-festival',
    name: 'Desert Music Festival',
    subtitle: 'Sandstone canyon amphitheater under twilight dunes',
    defaultTime: 'sunset',
    primaryColor: '#FF7B29',
    secondaryColor: '#FF3CAC',
    skyTop: '#1A1130',
    skyHorizon: '#A63A48',
    fogColor: '#3A1C33',
    groundColor: '#5B3726',
    accentGlow: '#F59E0B',
  },
  {
    id: 'floating-island',
    name: 'Floating Sky Island',
    subtitle: 'Suspended crystal archipelago & iridescent cloud deck',
    defaultTime: 'sunrise',
    primaryColor: '#38BDF8',
    secondaryColor: '#8B5CF6',
    skyTop: '#16295A',
    skyHorizon: '#5E68B8',
    fogColor: '#2B3A7A',
    groundColor: '#233258',
    accentGlow: '#00E5FF',
  },
  {
    id: 'futuristic-indian',
    name: 'Futuristic Indian Cultural Festival',
    subtitle: 'Luminous mandala arches, lotus canopies & sky lanterns',
    defaultTime: 'futuristic',
    primaryColor: '#FFB703',
    secondaryColor: '#FF3CAC',
    skyTop: '#120826',
    skyHorizon: '#42164D',
    fogColor: '#200D36',
    groundColor: '#190E2B',
    accentGlow: '#FB8500',
  },
  {
    id: 'underwater-concert',
    name: 'Underwater Fantasy Concert',
    subtitle: 'Bioluminescent coral bowl with solar caustic rays',
    defaultTime: 'midnight',
    primaryColor: '#00E5FF',
    secondaryColor: '#10B981',
    skyTop: '#021526',
    skyHorizon: '#063C5A',
    fogColor: '#042840',
    groundColor: '#062033',
    accentGlow: '#00F5D4',
  },
];

export interface CatalogBlueprint {
  type: StageItemBlueprintType;
  category: StageItemCategory;
  label: string;
  defaultScale: number;
  defaultPrimary: string;
  defaultSecondary: string;
}

export const STAGE_CATALOG: CatalogBlueprint[] = [
  {
    type: 'cyber-arch-stage',
    category: 'stage',
    label: 'Cyber Arch Stage',
    defaultScale: 1,
    defaultPrimary: '#00E5FF',
    defaultSecondary: '#8B5CF6',
  },
  {
    type: 'mandala-lotus-stage',
    category: 'stage',
    label: 'Mandala Lotus Canopy',
    defaultScale: 1,
    defaultPrimary: '#FFB703',
    defaultSecondary: '#FF3CAC',
  },
  {
    type: 'crystal-dome-stage',
    category: 'stage',
    label: 'Crystal Dome Stage',
    defaultScale: 1,
    defaultPrimary: '#38BDF8',
    defaultSecondary: '#00F5D4',
  },
  {
    type: 'truss-megastage',
    category: 'stage',
    label: 'Truss Megastage',
    defaultScale: 1,
    defaultPrimary: '#2162F5',
    defaultSecondary: '#FF3CAC',
  },
  {
    type: 'holo-dj-booth',
    category: 'dj-booth',
    label: 'Holo DJ Console',
    defaultScale: 1,
    defaultPrimary: '#00E5FF',
    defaultSecondary: '#FF3CAC',
  },
  {
    type: 'elevated-dj-riser',
    category: 'dj-booth',
    label: 'Elevated DJ Riser',
    defaultScale: 1,
    defaultPrimary: '#8B5CF6',
    defaultSecondary: '#00E5FF',
  },
  {
    type: 'curved-led-wall',
    category: 'led-wall',
    label: 'Curved LED Screen',
    defaultScale: 1,
    defaultPrimary: '#00E5FF',
    defaultSecondary: '#FF3CAC',
  },
  {
    type: 'led-monolith',
    category: 'led-wall',
    label: 'LED Totem Wall',
    defaultScale: 1,
    defaultPrimary: '#2162F5',
    defaultSecondary: '#00E5FF',
  },
  {
    type: 'line-array-tower',
    category: 'speaker',
    label: 'Line-Array Tower',
    defaultScale: 1,
    defaultPrimary: '#00E5FF',
    defaultSecondary: '#2162F5',
  },
  {
    type: 'sub-stack',
    category: 'speaker',
    label: 'Subwoofer Stack',
    defaultScale: 1,
    defaultPrimary: '#FF3CAC',
    defaultSecondary: '#8B5CF6',
  },
  {
    type: 'laser-rig',
    category: 'laser',
    label: 'Sweeping Laser Rig',
    defaultScale: 1,
    defaultPrimary: '#00E5FF',
    defaultSecondary: '#FF3CAC',
  },
  {
    type: 'sky-beam-turret',
    category: 'laser',
    label: 'Sky Beam Turret',
    defaultScale: 1,
    defaultPrimary: '#8B5CF6',
    defaultSecondary: '#00E5FF',
  },
  {
    type: 'holo-totem',
    category: 'decor',
    label: 'Holographic Totem',
    defaultScale: 1,
    defaultPrimary: '#00E5FF',
    defaultSecondary: '#8B5CF6',
  },
  {
    type: 'lotus-lantern',
    category: 'decor',
    label: 'Glowing Lotus Pillar',
    defaultScale: 1,
    defaultPrimary: '#FFB703',
    defaultSecondary: '#FF3CAC',
  },
  {
    type: 'geo-sculpture',
    category: 'decor',
    label: 'Audio-Pulse Sculpture',
    defaultScale: 1,
    defaultPrimary: '#FF3CAC',
    defaultSecondary: '#00E5FF',
  },
  {
    type: 'crowd-barrier',
    category: 'barrier',
    label: 'LED Crowd Barrier',
    defaultScale: 1,
    defaultPrimary: '#2162F5',
    defaultSecondary: '#00E5FF',
  },
  {
    type: 'vip-walkway',
    category: 'barrier',
    label: 'Illuminated Walkway',
    defaultScale: 1,
    defaultPrimary: '#8B5CF6',
    defaultSecondary: '#00E5FF',
  },
  {
    type: 'portal-gate',
    category: 'portal',
    label: 'Stage Portal Gate',
    defaultScale: 1,
    defaultPrimary: '#00E5FF',
    defaultSecondary: '#FF3CAC',
  },
];

export function buildDefaultStageItems(env: EnvironmentId): StageItem[] {
  const meta = ENVIRONMENTS.find((e) => e.id === env) ?? ENVIRONMENTS[0];
  const stageType: StageItemBlueprintType =
    env === 'futuristic-indian'
      ? 'mandala-lotus-stage'
      : env === 'underwater-concert' || env === 'floating-island'
        ? 'crystal-dome-stage'
        : env === 'desert-festival'
          ? 'truss-megastage'
          : 'cyber-arch-stage';

  const portalTarget: EnvironmentId =
    env === 'neon-cyberpunk'
      ? 'futuristic-indian'
      : env === 'futuristic-indian'
        ? 'underwater-concert'
        : env === 'underwater-concert'
          ? 'floating-island'
          : env === 'floating-island'
            ? 'desert-festival'
            : 'neon-cyberpunk';

  return [
    {
      id: 'main-stage-1',
      type: stageType,
      category: 'stage',
      label: 'Main Stage',
      position: [0, 0, -14],
      rotationY: 0,
      scale: 1,
      primaryColor: meta.primaryColor,
      secondaryColor: meta.secondaryColor,
      intensity: 1,
    },
    {
      id: 'dj-booth-1',
      type: 'holo-dj-booth',
      category: 'dj-booth',
      label: 'Main DJ Console',
      position: [0, 0, -10.2],
      rotationY: 0,
      scale: 1,
      primaryColor: meta.primaryColor,
      secondaryColor: meta.secondaryColor,
      intensity: 1,
    },
    {
      id: 'led-wall-center',
      type: 'curved-led-wall',
      category: 'led-wall',
      label: 'Center Backdrop LED',
      position: [0, 0, -17.5],
      rotationY: 0,
      scale: 1.05,
      primaryColor: meta.primaryColor,
      secondaryColor: meta.secondaryColor,
      intensity: 1,
    },
    {
      id: 'speaker-left',
      type: 'line-array-tower',
      category: 'speaker',
      label: 'Left Line Array',
      position: [-10.5, 0, -12.5],
      rotationY: 0.25,
      scale: 1,
      primaryColor: meta.primaryColor,
      secondaryColor: meta.secondaryColor,
      intensity: 1,
    },
    {
      id: 'speaker-right',
      type: 'line-array-tower',
      category: 'speaker',
      label: 'Right Line Array',
      position: [10.5, 0, -12.5],
      rotationY: -0.25,
      scale: 1,
      primaryColor: meta.primaryColor,
      secondaryColor: meta.secondaryColor,
      intensity: 1,
    },
    {
      id: 'laser-left',
      type: 'laser-rig',
      category: 'laser',
      label: 'Left Laser Array',
      position: [-6.5, 0, -11.5],
      rotationY: 0.15,
      scale: 1,
      primaryColor: meta.primaryColor,
      secondaryColor: meta.secondaryColor,
      intensity: 1,
    },
    {
      id: 'laser-right',
      type: 'laser-rig',
      category: 'laser',
      label: 'Right Laser Array',
      position: [6.5, 0, -11.5],
      rotationY: -0.15,
      scale: 1,
      primaryColor: meta.secondaryColor,
      secondaryColor: meta.primaryColor,
      intensity: 1,
    },
    {
      id: 'decor-left',
      type: env === 'futuristic-indian' ? 'lotus-lantern' : 'geo-sculpture',
      category: 'decor',
      label: env === 'futuristic-indian' ? 'Lotus Lantern Left' : 'Pulse Sculpture Left',
      position: [-13, 0, -3],
      rotationY: 0.4,
      scale: 1,
      primaryColor: meta.primaryColor,
      secondaryColor: meta.secondaryColor,
      intensity: 1,
    },
    {
      id: 'decor-right',
      type: env === 'futuristic-indian' ? 'lotus-lantern' : 'geo-sculpture',
      category: 'decor',
      label: env === 'futuristic-indian' ? 'Lotus Lantern Right' : 'Pulse Sculpture Right',
      position: [13, 0, -3],
      rotationY: -0.4,
      scale: 1,
      primaryColor: meta.secondaryColor,
      secondaryColor: meta.primaryColor,
      intensity: 1,
    },
    {
      id: 'barrier-center',
      type: 'crowd-barrier',
      category: 'barrier',
      label: 'Front Crowd Barrier',
      position: [0, 0, -6.5],
      rotationY: 0,
      scale: 1.2,
      primaryColor: meta.primaryColor,
      secondaryColor: meta.secondaryColor,
      intensity: 0.9,
    },
    {
      id: 'walkway-center',
      type: 'vip-walkway',
      category: 'barrier',
      label: 'Center Runway',
      position: [0, 0, 2],
      rotationY: 0,
      scale: 1,
      primaryColor: meta.primaryColor,
      secondaryColor: meta.secondaryColor,
      intensity: 0.85,
    },
    {
      id: 'portal-1',
      type: 'portal-gate',
      category: 'portal',
      label: 'Stage Portal Gate',
      position: [14.5, 0, 5],
      rotationY: -0.6,
      scale: 1,
      primaryColor: meta.primaryColor,
      secondaryColor: meta.secondaryColor,
      intensity: 1,
      portalTargetEnv: portalTarget,
    },
  ];
}

export function createDefaultFestival(env: EnvironmentId = 'neon-cyberpunk'): FestivalProject {
  const meta = ENVIRONMENTS.find((e) => e.id === env) ?? ENVIRONMENTS[0];
  const now = Date.now();
  return {
    id: `fest-${now.toString(36)}`,
    name: `${meta.name} Live`,
    creator: 'You',
    environment: env,
    timeOfDay: meta.defaultTime,
    stageItems: buildDefaultStageItems(env),
    lighting: {
      primaryColor: meta.primaryColor,
      secondaryColor: meta.secondaryColor,
      spotlightIntensity: 1.25,
      laserSpeed: 1.2,
      laserSpread: 0.9,
      laserSharpness: 1.0,
      strobeFrequency: 0.35,
      strobeMode: 'beat-strobe',
      strobeIntensity: 1.0,
      stageFloorMaterial:
        env === 'underwater-concert'
          ? 'reflective-water'
          : env === 'desert-festival' || env === 'futuristic-indian'
            ? 'polished-obsidian'
            : 'gridded-cyber-neon',
      mainEventStyle: 'lolla-headliner',
      fogDensity: 0.012,
      ledPreset: env === 'futuristic-indian' ? 'mandala' : 'spectrum',
      choreography: 'auto-dj',
      beatSync: true,
      autoDj: true,
      reducedFlashing: false,
      bloomEnabled: false,
      chromaticAberration: true,
      cameraShake: true,
      volumetricBeams: true,
    },
    crowd: {
      density: 0.78,
      choreography: 'bounce',
      glowIntensity: 1.0,
      modelStyle: 'lolla-mix',
      afrSensitivity: 1.2,
      bpmOverride: null,
      propDensity: 0.75,
    },
    cameraSequence: [
      {
        id: 'cam-1',
        name: 'Hero Wide',
        position: [0, 8.5, 22],
        target: [0, 3.5, -10],
        duration: 3.5,
      },
      {
        id: 'cam-2',
        name: 'Sweep Left',
        position: [-18, 7, 10],
        target: [0, 4, -12],
        duration: 4.0,
      },
      {
        id: 'cam-3',
        name: 'DJ Over-Shoulder',
        position: [2.5, 4.2, -13.5],
        target: [0, 2.5, 6],
        duration: 3.5,
      },
    ],
    allowRemix: true,
    createdAt: now,
    updatedAt: now,
  };
}

export const STAGE_TEMPLATES: FestivalProject[] = [
  createDefaultFestival('neon-cyberpunk'),
  createDefaultFestival('futuristic-indian'),
  createDefaultFestival('desert-festival'),
  createDefaultFestival('floating-island'),
  createDefaultFestival('underwater-concert'),
];
