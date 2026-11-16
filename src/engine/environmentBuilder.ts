import * as THREE from 'three';
import { EnvironmentId, StageFloorMaterial } from '../types/festival';

export interface EnvironmentSceneResult {
  group: THREE.Group;
  groundMat: THREE.MeshPhysicalMaterial;
  animatedProps: Array<{
    mesh: THREE.Object3D;
    kind: 'float' | 'lantern' | 'jellyfish' | 'crystal' | 'flag' | 'sphere';
    baseY: number;
    phase: number;
    speed: number;
  }>;
  dispose: () => void;
}

export function createFloorMaterialTexture(
  floorMaterial: StageFloorMaterial,
  env: EnvironmentId,
  maxAnisotropy: number
): {
  tex: THREE.CanvasTexture;
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  if (floorMaterial === 'reflective-water') {
    const grad = ctx.createRadialGradient(256, 256, 24, 256, 256, 360);
    grad.addColorStop(0, '#09344F');
    grad.addColorStop(0.55, '#062338');
    grad.addColorStop(1, '#041626');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Caustic ripple rings & specular water wave bands
    for (let i = 0; i < 18; i++) {
      const cx = ((i * 97) % 440) + 36;
      const cy = ((i * 151) % 440) + 36;
      const r = 28 + (i % 4) * 22;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(0, 229, 255, 0.24)' : 'rgba(56, 189, 248, 0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (floorMaterial === 'polished-obsidian') {
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#07080F');
    grad.addColorStop(0.5, '#101322');
    grad.addColorStop(1, '#06070D');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Architectural stone slab joints
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    // Subtle volcanic gold & violet mineral veins
    ctx.strokeStyle = 'rgba(255, 183, 3, 0.22)';
    ctx.lineWidth = 1.6;
    for (let v = 0; v < 8; v++) {
      ctx.beginPath();
      const startY = v * 64 + 24;
      ctx.moveTo(0, startY);
      ctx.bezierCurveTo(170, startY - 38, 340, startY + 42, 512, startY - 12);
      ctx.stroke();
    }
  } else {
    // 'gridded-cyber-neon'
    ctx.fillStyle = env === 'desert-festival' ? '#17101C' : '#070B1A';
    ctx.fillRect(0, 0, 512, 512);

    // Fine sub-grid
    ctx.strokeStyle = 'rgba(33, 98, 245, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 512; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    // Primary high-contrast neon grid + corner crosshairs
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.52)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i <= 512; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 60, 172, 0.55)';
    for (let x = 64; x < 512; x += 128) {
      for (let y = 64; y < 512; y += 128) {
        ctx.fillRect(x - 4, y - 4, 8, 8);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);

  if (floorMaterial === 'reflective-water') {
    return {
      tex,
      roughness: 0.05,
      metalness: 0.78,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    };
  }
  if (floorMaterial === 'polished-obsidian') {
    return {
      tex,
      roughness: 0.09,
      metalness: 0.88,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
    };
  }
  return {
    tex,
    roughness: 0.22,
    metalness: 0.62,
    clearcoat: 0.9,
    clearcoatRoughness: 0.14,
  };
}

export function buildEnvironmentScenery(
  env: EnvironmentId,
  maxAnisotropy: number,
  floorMaterial: StageFloorMaterial = 'gridded-cyber-neon'
): EnvironmentSceneResult {
  const group = new THREE.Group();
  const animatedProps: EnvironmentSceneResult['animatedProps'] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  const floorSpec = createFloorMaterialTexture(floorMaterial, env, maxAnisotropy);
  disposables.push(floorSpec.tex);

  // Extended terrain ground disk with custom StageFloorMaterial PBR properties
  const groundGeo = new THREE.CircleGeometry(140, 64);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshPhysicalMaterial({
    map: floorSpec.tex,
    roughnessMap: floorSpec.tex,
    roughness: floorSpec.roughness,
    metalness: floorSpec.metalness,
    clearcoat: floorSpec.clearcoat,
    clearcoatRoughness: floorSpec.clearcoatRoughness,
    reflectivity: 1.0,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.receiveShadow = true;
  groundMesh.position.y = 0;
  group.add(groundMesh);
  disposables.push(groundGeo, groundMat);

  // Dancefloor central plaza ring (grounded at y = 0.02 to prevent coplanar z-fighting)
  const plazaGeo = new THREE.RingGeometry(15.5, 16.2, 64);
  plazaGeo.rotateX(-Math.PI / 2);
  const plazaMat = new THREE.MeshStandardMaterial({
    color: env === 'futuristic-indian' ? '#FFB703' : '#00E5FF',
    emissive: env === 'futuristic-indian' ? '#FFB703' : '#00E5FF',
    emissiveIntensity: 0.9,
    roughness: 0.25,
  });
  const plazaRing = new THREE.Mesh(plazaGeo, plazaMat);
  plazaRing.position.set(0, 0.02, -2);
  group.add(plazaRing);
  disposables.push(plazaGeo, plazaMat);

  // LOLLAPALOOZA FESTIVAL PARK SIGNATURE ELEMENTS (Pennant Flag Towers, Festival Archway & Crowd Beach Spheres)
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.11, 8.8, 8);
  const poleMat = new THREE.MeshStandardMaterial({
    color: '#CBD5E1',
    roughness: 0.3,
    metalness: 0.85,
  });
  const flagGeo = new THREE.PlaneGeometry(1.9, 0.95, 6, 2);
  flagGeo.translate(0.95, 0, 0);
  const flagColors = ['#FF3CAC', '#00E5FF', '#FFB703', '#10B981', '#8B5CF6', '#F43F5E'];
  disposables.push(poleGeo, poleMat, flagGeo);

  // Boulevard of Lollapalooza Festival Flags flanking the crowd park
  [-17.5, 17.5].forEach((sideX, sideIdx) => {
    for (let f = 0; f < 5; f++) {
      const zPos = -6 + f * 6.2;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(sideX, 4.4, zPos);
      group.add(pole);

      const fMat = new THREE.MeshStandardMaterial({
        color: flagColors[(f + sideIdx * 2) % flagColors.length],
        emissive: flagColors[(f + sideIdx * 2) % flagColors.length],
        emissiveIntensity: 0.45,
        side: THREE.DoubleSide,
        roughness: 0.4,
      });
      disposables.push(fMat);

      const flag = new THREE.Mesh(flagGeo, fMat);
      flag.position.set(sideX, 8.2, zPos);
      flag.rotation.y = sideX < 0 ? 0.2 : Math.PI - 0.2;
      group.add(flag);
      animatedProps.push({
        mesh: flag,
        kind: 'flag',
        baseY: 8.2,
        phase: f * 0.9 + sideIdx,
        speed: 3.6,
      });
    }
  });

  // Bouncing Giant Festival Crowd Spheres (Lollapalooza / Coachella crowd inflatables)
  const ballGeo = new THREE.SphereGeometry(0.95, 18, 18);
  disposables.push(ballGeo);
  [
    [-7.5, 3.6, 5.5, '#FF3CAC'],
    [8.2, 4.1, 4.2, '#FFB703'],
    [-3.8, 3.9, 11.2, '#00E5FF'],
    [5.4, 3.7, 9.8, '#10B981'],
  ].forEach(([bx, by, bz, col], idx) => {
    const ballMat = new THREE.MeshPhysicalMaterial({
      color: col as string,
      emissive: col as string,
      emissiveIntensity: 0.35,
      roughness: 0.15,
      clearcoat: 1.0,
    });
    disposables.push(ballMat);
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ball.position.set(bx as number, by as number, bz as number);
    group.add(ball);
    animatedProps.push({
      mesh: ball,
      kind: 'sphere',
      baseY: by as number,
      phase: idx * 1.4,
      speed: 2.8,
    });
  });

  // Grand Festival Park Entrance Archway at Rear of Arena (z = 22.5)
  const archGroup = new THREE.Group();
  archGroup.position.set(0, 0, 22.5);
  const archPillarGeo = new THREE.CylinderGeometry(0.45, 0.55, 7.5, 12);
  const archCrossGeo = new THREE.BoxGeometry(13.5, 1.1, 0.8);
  const archNeonMat = new THREE.MeshStandardMaterial({
    color: '#FF3CAC',
    emissive: '#FF3CAC',
    emissiveIntensity: 1.1,
    roughness: 0.2,
  });
  disposables.push(archPillarGeo, archCrossGeo, archNeonMat);

  [-5.8, 5.8].forEach((px) => {
    const col = new THREE.Mesh(archPillarGeo, poleMat);
    col.position.set(px, 3.75, 0);
    archGroup.add(col);
  });
  const headerBanner = new THREE.Mesh(archCrossGeo, archNeonMat);
  headerBanner.position.set(0, 7.2, 0);
  archGroup.add(headerBanner);
  group.add(archGroup);

  if (env === 'neon-cyberpunk') {
    // Perimeter futuristic skyline towers with glowing neon edge strips
    const towerMat = new THREE.MeshStandardMaterial({
      color: '#0D132B',
      roughness: 0.35,
      metalness: 0.7,
    });
    const stripMatCyan = new THREE.MeshBasicMaterial({ color: '#00E5FF' });
    const stripMatMag = new THREE.MeshBasicMaterial({ color: '#FF3CAC' });
    disposables.push(towerMat, stripMatCyan, stripMatMag);

    const towerGeo = new THREE.BoxGeometry(1, 1, 1);
    const stripGeo = new THREE.BoxGeometry(0.16, 1, 0.16);
    disposables.push(towerGeo, stripGeo);

    for (let i = 0; i < 22; i++) {
      const angle = (i / 22) * Math.PI * 2;
      if (Math.abs(angle - Math.PI / 2) < 0.25) continue;
      const radius = 38 + (i % 3) * 11;
      const h = 16 + ((i * 7) % 24);
      const w = 4 + (i % 3) * 2.2;
      const tower = new THREE.Group();
      tower.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);

      const body = new THREE.Mesh(towerGeo, towerMat);
      body.scale.set(w, h, w);
      body.position.y = h / 2;
      tower.add(body);

      const strip = new THREE.Mesh(stripGeo, i % 2 === 0 ? stripMatCyan : stripMatMag);
      strip.scale.set(1, h * 0.85, 1);
      strip.position.set(0, h * 0.5, w * 0.51);
      tower.lookAt(0, 0, 0);
      tower.add(strip);

      group.add(tower);
    }
  } else if (env === 'desert-festival') {
    // Sandstone canyon mesas & desert art totems around perimeter
    const rockGeo = new THREE.CylinderGeometry(3.2, 6.2, 1, 7);
    const rockMat = new THREE.MeshStandardMaterial({
      color: '#6E3B28',
      roughness: 0.92,
      metalness: 0.05,
      flatShading: true,
    });
    const ringMat = new THREE.MeshBasicMaterial({ color: '#FF7B29' });
    const ringGeo = new THREE.TorusGeometry(1.4, 0.08, 8, 24);
    disposables.push(rockGeo, rockMat, ringMat, ringGeo);

    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const radius = 36 + (i % 3) * 10;
      const h = 7 + ((i * 5) % 14);
      const mesa = new THREE.Mesh(rockGeo, rockMat);
      mesa.scale.set(1.2 + (i % 3) * 0.4, h, 1.1);
      mesa.position.set(Math.cos(angle) * radius, h / 2 - 0.1, Math.sin(angle) * radius);
      mesa.rotation.y = i * 0.7;
      group.add(mesa);

      if (i % 3 === 0) {
        const sunTotem = new THREE.Mesh(ringGeo, ringMat);
        sunTotem.position.set(Math.cos(angle) * 26, 2.8, Math.sin(angle) * 26);
        sunTotem.lookAt(0, 2.8, 0);
        group.add(sunTotem);
      }
    }
  } else if (env === 'floating-island') {
    // Island rim rock ledges + orbiting floating crystal spires
    const crystalGeo = new THREE.OctahedronGeometry(1.4, 0);
    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: '#38BDF8',
      emissive: '#2162F5',
      emissiveIntensity: 0.45,
      roughness: 0.15,
      metalness: 0.2,
      clearcoat: 1.0,
    });
    const isletGeo = new THREE.ConeGeometry(4.5, 6.5, 6);
    const isletMat = new THREE.MeshStandardMaterial({
      color: '#253563',
      roughness: 0.85,
      flatShading: true,
    });
    disposables.push(crystalGeo, crystalMat, isletGeo, isletMat);

    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const radius = 28 + (i % 3) * 9;
      const crystal = new THREE.Mesh(crystalGeo, crystalMat);
      const baseY = 3.5 + (i % 4) * 2.2;
      crystal.scale.set(0.9, 1.8 + (i % 2) * 0.7, 0.9);
      crystal.position.set(Math.cos(angle) * radius, baseY, Math.sin(angle) * radius);
      group.add(crystal);
      animatedProps.push({
        mesh: crystal,
        kind: 'crystal',
        baseY,
        phase: i * 0.9,
        speed: 1.1,
      });

      if (i % 2 === 0) {
        const islet = new THREE.Mesh(isletGeo, isletMat);
        islet.rotation.x = Math.PI;
        islet.position.set(Math.cos(angle) * (radius + 10), -1.5, Math.sin(angle) * (radius + 10));
        group.add(islet);
      }
    }
  } else if (env === 'futuristic-indian') {
    // Ornate glowing brass/gold perimeter pillars + floating warm sky lanterns
    const pillarGeo = new THREE.CylinderGeometry(0.45, 0.65, 8.5, 8);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: '#4D2359',
      roughness: 0.35,
      metalness: 0.75,
    });
    const capGeo = new THREE.ConeGeometry(1.1, 1.4, 8);
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#FFB703',
      emissive: '#FB8500',
      emissiveIntensity: 0.5,
      roughness: 0.25,
      metalness: 0.85,
    });
    const lanternGeo = new THREE.CylinderGeometry(0.42, 0.3, 0.85, 8);
    const lanternMat = new THREE.MeshBasicMaterial({
      color: '#FFB703',
      transparent: true,
      opacity: 0.9,
    });
    disposables.push(pillarGeo, pillarMat, capGeo, goldMat, lanternGeo, lanternMat);

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const radius = 25;
      const archGroup2 = new THREE.Group();
      archGroup2.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);

      const p = new THREE.Mesh(pillarGeo, pillarMat);
      p.position.y = 4.25;
      const cap = new THREE.Mesh(capGeo, goldMat);
      cap.position.y = 9.1;
      archGroup2.add(p, cap);
      group.add(archGroup2);
    }

    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const radius = 14 + (i % 4) * 5.5;
      const baseY = 5 + (i % 5) * 2.4;
      const lantern = new THREE.Mesh(lanternGeo, lanternMat);
      lantern.position.set(Math.cos(angle) * radius, baseY, Math.sin(angle) * radius);
      group.add(lantern);
      animatedProps.push({
        mesh: lantern,
        kind: 'lantern',
        baseY,
        phase: i * 0.7,
        speed: 0.75,
      });
    }
  } else {
    // underwater-concert: Coral amphitheater pillars + drifting bioluminescent jellyfish
    const coralGeo = new THREE.ConeGeometry(1.1, 7.5, 7);
    const coralMat = new THREE.MeshStandardMaterial({
      color: '#0D5C75',
      emissive: '#00F5D4',
      emissiveIntensity: 0.28,
      roughness: 0.55,
      flatShading: true,
    });
    const domeGeo = new THREE.SphereGeometry(1.0, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const jellyMat = new THREE.MeshPhysicalMaterial({
      color: '#00E5FF',
      emissive: '#FF3CAC',
      emissiveIntensity: 0.65,
      roughness: 0.15,
      transparent: true,
      opacity: 0.78,
    });
    disposables.push(coralGeo, coralMat, domeGeo, jellyMat);

    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const radius = 26 + (i % 3) * 5;
      const coral = new THREE.Mesh(coralGeo, coralMat);
      coral.scale.set(1 + (i % 2) * 0.5, 0.8 + (i % 3) * 0.4, 1);
      coral.position.set(Math.cos(angle) * radius, 3.0, Math.sin(angle) * radius);
      coral.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.15;
      group.add(coral);
    }

    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const radius = 14 + (i % 3) * 6;
      const baseY = 5.5 + (i % 4) * 2.1;
      const jelly = new THREE.Mesh(domeGeo, jellyMat);
      jelly.position.set(Math.cos(angle) * radius, baseY, Math.sin(angle) * radius);
      group.add(jelly);
      animatedProps.push({
        mesh: jelly,
        kind: 'jellyfish',
        baseY,
        phase: i * 1.1,
        speed: 1.25,
      });
    }
  }

  return {
    group,
    groundMat,
    animatedProps,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
