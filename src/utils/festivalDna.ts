import { FestivalProject } from '../types/festival';

export interface FestivalDnaSignature {
  code: string;
  archetype: string;
  palette: [string, string, string, string];
  geometryCount: number;
  symmetryScore: number;
  energyTier: string;
  seedValues: number[];
}

export function computeFestivalDna(project: FestivalProject): FestivalDnaSignature {
  const { environment, lighting, stageItems, timeOfDay } = project;

  const raw = `${environment}|${timeOfDay}|${lighting.primaryColor}|${lighting.secondaryColor}|${lighting.ledPreset}|${stageItems.length}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const unsigned = hash >>> 0;
  const code = `CS-${unsigned.toString(16).toUpperCase().padStart(8, '0')}`;

  const envMap: Record<string, string> = {
    'neon-cyberpunk': 'Cybernetic Resonance',
    'desert-festival': 'Solar Mirage',
    'floating-island': 'Aether Archipelago',
    'futuristic-indian': 'Luminous Mandala',
    'underwater-concert': 'Abyssal Biolume',
  };

  const seedValues: number[] = [];
  for (let i = 0; i < 6; i++) {
    seedValues.push((((unsigned >> (i * 4)) & 0xf) + 2) / 17);
  }

  // Compute spatial left/right balance as symmetry indicator
  const xSum = stageItems.reduce((acc, item) => acc + item.position[0], 0);
  const symmetryScore = Math.max(0, Math.min(100, Math.round(100 - Math.abs(xSum) * 2.5)));

  const energyTier =
    lighting.spotlightIntensity > 1.3 && lighting.laserSpeed > 1.2
      ? 'High-Voltage'
      : lighting.choreography === 'chill'
        ? 'Ambient Drift'
        : 'Balanced Pulse';

  return {
    code,
    archetype: envMap[environment] || 'Custom Stage',
    palette: [
      lighting.primaryColor,
      lighting.secondaryColor,
      '#2162F5',
      '#8B5CF6',
    ],
    geometryCount: stageItems.length,
    symmetryScore,
    energyTier,
    seedValues,
  };
}
