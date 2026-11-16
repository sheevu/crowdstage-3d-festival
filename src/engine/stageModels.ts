import * as THREE from 'three';
import { StageFloorMaterial, StageItem } from '../types/festival';
import {
  createLedWallMaterial,
  createPortalShaderMaterial,
  createSharpLaserMaterial,
} from './shaders';
import { sharedWebcamBridge } from './webcamBridge';
import { createFloorMaterialTexture } from './environmentBuilder';

export interface BuiltStageObject {
  itemId: string;
  group: THREE.Group;
  hitbox: THREE.Mesh;
  ledMaterials: THREE.ShaderMaterial[];
  portalMaterials: THREE.ShaderMaterial[];
  laserMaterials: THREE.ShaderMaterial[];
  laserBeams: THREE.Group[];
  strobeMeshes: THREE.Mesh[];
  speakerCones: THREE.Mesh[];
  pulsingParts: THREE.Object3D[];
  selectionRing: THREE.Mesh;
  dispose: () => void;
}

export function buildStageItemGroup(
  item: StageItem,
  spectrumTex: THREE.DataTexture,
  floorMaterial: StageFloorMaterial = 'gridded-cyber-neon'
): BuiltStageObject {
  const group = new THREE.Group();
  group.position.set(item.position[0], item.position[1], item.position[2]);
  group.rotation.y = item.rotationY;
  group.scale.setScalar(item.scale);

  const ledMaterials: THREE.ShaderMaterial[] = [];
  const portalMaterials: THREE.ShaderMaterial[] = [];
  const laserMaterials: THREE.ShaderMaterial[] = [];
  const laserBeams: THREE.Group[] = [];
  const strobeMeshes: THREE.Mesh[] = [];
  const speakerCones: THREE.Mesh[] = [];
  const pulsingParts: THREE.Object3D[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  const primary = new THREE.Color(item.primaryColor);
  const secondary = new THREE.Color(item.secondaryColor);

  const darkMetal = new THREE.MeshStandardMaterial({
    color: '#111629',
    roughness: 0.22,
    metalness: 0.88,
  });

  // Stage Deck Surface Material driven by the CreatorDashboard Texture Selector
  const deckSpec = createFloorMaterialTexture(floorMaterial, 'neon-cyberpunk', 8);
  deckSpec.tex.repeat.set(4, 2);
  disposables.push(deckSpec.tex);

  const matteDeck = new THREE.MeshPhysicalMaterial({
    map: deckSpec.tex,
    roughnessMap: deckSpec.tex,
    color:
      floorMaterial === 'reflective-water'
        ? '#0D4B6E'
        : floorMaterial === 'polished-obsidian'
          ? '#0B0D18'
          : '#121936',
    roughness: deckSpec.roughness,
    metalness: deckSpec.metalness,
    clearcoat: 1.0,
    clearcoatRoughness: deckSpec.clearcoatRoughness,
    reflectivity: 1.0,
  });

  const glowPrimary = new THREE.MeshStandardMaterial({
    color: primary,
    emissive: primary,
    emissiveIntensity: 1.35,
    roughness: 0.18,
    metalness: 0.3,
  });
  const glowSecondary = new THREE.MeshStandardMaterial({
    color: secondary,
    emissive: secondary,
    emissiveIntensity: 1.3,
    roughness: 0.18,
    metalness: 0.3,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: primary,
    roughness: 0.1,
    metalness: 0.15,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.65,
  });
  disposables.push(darkMetal, matteDeck, glowPrimary, glowSecondary, glassMat);

  let hitW = 3;
  let hitH = 4;
  let hitD = 3;

  const addGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };

  const webcamTex = sharedWebcamBridge.getTexture();

  // Helper to attach Xenon Strobe Blinder Bars to main stages
  const addStrobeBlinderArray = (yPos: number, zPos: number, widthSpan: number, count: number) => {
    const housingGeo = addGeo(new THREE.BoxGeometry(widthSpan, 0.28, 0.32));
    const housing = new THREE.Mesh(housingGeo, darkMetal);
    housing.position.set(0, yPos, zPos);
    group.add(housing);

    const bulbGeo = addGeo(new THREE.BoxGeometry(0.52, 0.22, 0.14));
    for (let i = 0; i < count; i++) {
      const bx = ((i - (count - 1) / 2) / Math.max(1, count - 1)) * (widthSpan * 0.86);
      const bulbMat = new THREE.MeshBasicMaterial({
        color: '#FFFFFF',
        transparent: true,
        opacity: 0.25,
      });
      disposables.push(bulbMat);
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(bx, yPos, zPos + 0.16);
      group.add(bulb);
      strobeMeshes.push(bulb);
    }
  };

  if (item.type === 'cyber-arch-stage' || item.type === 'truss-megastage') {
    hitW = 19;
    hitH = 10.5;
    hitD = 9.5;
    // 1. Primary tiered stage deck with selected floor texture
    const deck = new THREE.Mesh(addGeo(new THREE.BoxGeometry(17.6, 1.4, 8.4)), matteDeck);
    deck.position.y = 0.7;
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);

    // 2. Front illuminated apron step + Lollapalooza Thrust Catwalk Lip
    const step = new THREE.Mesh(addGeo(new THREE.BoxGeometry(15.4, 0.4, 1.6)), glowPrimary);
    step.position.set(0, 0.2, 4.7);
    group.add(step);

    // 3. Left & Right vertical truss towers
    const towerGeo = addGeo(new THREE.BoxGeometry(1.1, 9.4, 1.1));
    [-7.8, 7.8].forEach((x, idx) => {
      const tower = new THREE.Mesh(towerGeo, darkMetal);
      tower.position.set(x, 4.7, 0);
      tower.castShadow = true;
      group.add(tower);

      const trim = new THREE.Mesh(
        addGeo(new THREE.BoxGeometry(0.22, 9.0, 0.22)),
        idx === 0 ? glowPrimary : glowSecondary
      );
      trim.position.set(x, 4.7, 0.58);
      group.add(trim);
    });

    // 4. Overhead curved / angled arch canopy
    const archGeo = addGeo(new THREE.TorusGeometry(8.0, 0.42, 12, 40, Math.PI));
    const arch = new THREE.Mesh(archGeo, darkMetal);
    arch.position.set(0, 4.5, 0);
    group.add(arch);

    const archNeon = new THREE.Mesh(
      addGeo(new THREE.TorusGeometry(7.55, 0.14, 8, 40, Math.PI)),
      glowPrimary
    );
    archNeon.position.set(0, 4.5, 0.22);
    group.add(archNeon);

    // 5. Rear truss header bar + Strobe Blinder Pod Array
    const header = new THREE.Mesh(addGeo(new THREE.BoxGeometry(16.4, 0.75, 0.85)), darkMetal);
    header.position.set(0, 9.2, -2.5);
    group.add(header);

    addStrobeBlinderArray(9.15, -2.0, 14.2, 10);
    addStrobeBlinderArray(1.32, 4.22, 13.6, 8);

    // 6. Lollapalooza Dual I-MAG Wing Screens
    [-9.8, 9.8].forEach((x) => {
      const wingMat = createLedWallMaterial(
        spectrumTex,
        item.primaryColor,
        item.secondaryColor,
        webcamTex
      );
      ledMaterials.push(wingMat);
      disposables.push(wingMat);
      const wing = new THREE.Mesh(addGeo(new THREE.PlaneGeometry(2.8, 6.6)), wingMat);
      wing.position.set(x, 4.7, 0.65);
      wing.rotation.y = x < 0 ? 0.32 : -0.32;
      group.add(wing);
    });
  } else if (item.type === 'mandala-lotus-stage') {
    hitW = 18;
    hitH = 10.5;
    hitD = 10;
    const deck = new THREE.Mesh(addGeo(new THREE.CylinderGeometry(8.5, 9.4, 1.3, 8)), matteDeck);
    deck.position.y = 0.65;
    deck.receiveShadow = true;
    group.add(deck);

    const trimRing = new THREE.Mesh(addGeo(new THREE.TorusGeometry(8.7, 0.14, 8, 32)), glowPrimary);
    trimRing.rotation.x = Math.PI / 2;
    trimRing.position.y = 1.28;
    group.add(trimRing);

    addStrobeBlinderArray(8.6, -1.2, 11.0, 8);

    const petalGeo = addGeo(new THREE.ConeGeometry(1.7, 6.2, 5));
    for (let i = 0; i < 7; i++) {
      const a = ((i - 3) / 6) * Math.PI * 0.85;
      const petal = new THREE.Mesh(petalGeo, i % 2 === 0 ? glowPrimary : glowSecondary);
      petal.position.set(Math.sin(a) * 6.8, 5.2 + Math.cos(a) * 2.8, -1.5);
      petal.rotation.z = -a * 0.85;
      petal.scale.set(1, 1, 0.25);
      group.add(petal);
      pulsingParts.push(petal);
    }

    const haloMat = createLedWallMaterial(
      spectrumTex,
      item.primaryColor,
      item.secondaryColor,
      webcamTex
    );
    haloMat.uniforms.uPreset.value = 2;
    ledMaterials.push(haloMat);
    disposables.push(haloMat);
    const haloDisc = new THREE.Mesh(addGeo(new THREE.CircleGeometry(4.4, 36)), haloMat);
    haloDisc.position.set(0, 5.2, -1.8);
    group.add(haloDisc);
  } else if (item.type === 'crystal-dome-stage') {
    hitW = 17;
    hitH = 10;
    hitD = 10;
    const deck = new THREE.Mesh(addGeo(new THREE.CylinderGeometry(8.0, 9.0, 1.2, 12)), matteDeck);
    deck.position.y = 0.6;
    deck.receiveShadow = true;
    group.add(deck);

    addStrobeBlinderArray(8.2, -0.6, 10.5, 8);

    const dome = new THREE.Mesh(
      addGeo(new THREE.IcosahedronGeometry(7.2, 1)),
      glassMat
    );
    dome.position.set(0, 4.6, -1.0);
    dome.scale.set(1.15, 0.85, 0.7);
    group.add(dome);
    pulsingParts.push(dome);

    const frame = new THREE.Mesh(
      addGeo(new THREE.TorusGeometry(6.5, 0.18, 8, 32)),
      glowPrimary
    );
    frame.position.set(0, 5.2, -0.5);
    group.add(frame);
  } else if (item.type === 'holo-dj-booth' || item.type === 'elevated-dj-riser') {
    hitW = 4.6;
    hitH = 3.2;
    hitD = 3.0;
    const isElevated = item.type === 'elevated-dj-riser';
    const baseH = isElevated ? 1.8 : 0.9;
    const riser = new THREE.Mesh(addGeo(new THREE.BoxGeometry(4.2, baseH, 2.5)), matteDeck);
    riser.position.y = baseH / 2;
    riser.castShadow = true;
    group.add(riser);

    const desk = new THREE.Mesh(addGeo(new THREE.BoxGeometry(3.4, 0.9, 1.1)), darkMetal);
    desk.position.set(0, baseH + 0.45, 0.25);
    group.add(desk);

    const platterGeo = addGeo(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 24));
    [-0.85, 0.85].forEach((px, i) => {
      const platter = new THREE.Mesh(platterGeo, i === 0 ? glowPrimary : glowSecondary);
      platter.position.set(px, baseH + 0.94, 0.25);
      group.add(platter);
      pulsingParts.push(platter);
    });

    const frontMat = createLedWallMaterial(
      spectrumTex,
      item.primaryColor,
      item.secondaryColor,
      webcamTex
    );
    ledMaterials.push(frontMat);
    disposables.push(frontMat);
    const frontScreen = new THREE.Mesh(addGeo(new THREE.PlaneGeometry(3.6, baseH + 0.6)), frontMat);
    frontScreen.position.set(0, (baseH + 0.6) / 2 + 0.15, 1.3);
    group.add(frontScreen);
  } else if (item.type === 'curved-led-wall' || item.type === 'led-monolith') {
    const isCurved = item.type === 'curved-led-wall';
    hitW = isCurved ? 13 : 4.2;
    hitH = isCurved ? 7.8 : 7.2;
    hitD = 2.4;

    const frame = new THREE.Mesh(
      addGeo(new THREE.BoxGeometry(isCurved ? 12.6 : 3.8, isCurved ? 6.8 : 6.6, 0.5)),
      darkMetal
    );
    frame.position.y = isCurved ? 4.4 : 3.6;
    frame.castShadow = true;
    group.add(frame);

    const screenMat = createLedWallMaterial(
      spectrumTex,
      item.primaryColor,
      item.secondaryColor,
      webcamTex
    );
    ledMaterials.push(screenMat);
    disposables.push(screenMat);

    const screen = new THREE.Mesh(
      addGeo(new THREE.PlaneGeometry(isCurved ? 11.8 : 3.3, isCurved ? 6.1 : 6.0)),
      screenMat
    );
    screen.position.set(0, isCurved ? 4.4 : 3.6, 0.28);
    group.add(screen);

    const legGeo = addGeo(new THREE.BoxGeometry(0.45, 1.4, 1.4));
    [-1, 1].forEach((side) => {
      const leg = new THREE.Mesh(legGeo, darkMetal);
      leg.position.set(side * (isCurved ? 4.6 : 1.2), 0.7, 0);
      group.add(leg);
    });
  } else if (item.type === 'line-array-tower' || item.type === 'sub-stack') {
    const isTower = item.type === 'line-array-tower';
    hitW = 2.8;
    hitH = isTower ? 7.6 : 3.6;
    hitD = 2.6;

    const subCab = new THREE.Mesh(addGeo(new THREE.BoxGeometry(2.3, 2.2, 2.0)), darkMetal);
    subCab.position.y = 1.1;
    subCab.castShadow = true;
    group.add(subCab);

    const coneGeo = addGeo(new THREE.CylinderGeometry(0.55, 0.35, 0.2, 20));
    coneGeo.rotateX(Math.PI / 2);
    [-0.55, 0.55].forEach((x) => {
      const cone = new THREE.Mesh(coneGeo, glowPrimary);
      cone.position.set(x, 1.1, 0.98);
      group.add(cone);
      speakerCones.push(cone);
    });

    if (isTower) {
      const mast = new THREE.Mesh(addGeo(new THREE.BoxGeometry(0.45, 6.8, 0.45)), darkMetal);
      mast.position.set(0, 3.4, -0.5);
      group.add(mast);

      const modGeo = addGeo(new THREE.BoxGeometry(1.9, 0.65, 1.1));
      for (let i = 0; i < 4; i++) {
        const mod = new THREE.Mesh(modGeo, matteDeck);
        mod.position.set(0, 4.3 + i * 0.76, 0.1 + i * 0.08);
        mod.rotation.x = 0.15 - i * 0.05;
        group.add(mod);
        const strip = new THREE.Mesh(addGeo(new THREE.BoxGeometry(1.75, 0.1, 0.1)), glowSecondary);
        strip.position.set(0, 4.3 + i * 0.76, 0.66 + i * 0.08);
        group.add(strip);
      }
    }
  } else if (item.type === 'laser-rig' || item.type === 'sky-beam-turret') {
    hitW = 2.8;
    hitH = 3.6;
    hitD = 2.8;

    const pedestal = new THREE.Mesh(addGeo(new THREE.CylinderGeometry(0.65, 0.9, 1.1, 14)), darkMetal);
    pedestal.position.y = 0.55;
    group.add(pedestal);

    const head = new THREE.Mesh(addGeo(new THREE.BoxGeometry(1.55, 0.58, 0.85)), darkMetal);
    head.position.y = 1.38;
    group.add(head);

    // Emitter aperture lens flare core
    const lensMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
    disposables.push(lensMat);
    const lens = new THREE.Mesh(addGeo(new THREE.SphereGeometry(0.14, 12, 12)), lensMat);
    lens.position.set(0, 1.52, 0.28);
    group.add(lens);

    const beamGroup = new THREE.Group();
    beamGroup.position.set(0, 1.52, 0.15);

    // 1. Razor-sharp coherent outer laser sheath (custom high-exponent GLSL shader)
    const sheathGeo = addGeo(new THREE.CylinderGeometry(0.018, 0.055, 38, 10, 1, true));
    sheathGeo.translate(0, 19, 0);
    const sharpLaserMat = createSharpLaserMaterial(item.primaryColor, item.secondaryColor);
    laserMaterials.push(sharpLaserMat);
    disposables.push(sharpLaserMat);

    // 2. Pinpoint white-hot coherent laser center needle for unmatched optical sharpness
    const coreNeedleGeo = addGeo(new THREE.CylinderGeometry(0.007, 0.014, 38, 8, 1, true));
    coreNeedleGeo.translate(0, 19, 0);
    const coreNeedleMat = new THREE.MeshBasicMaterial({
      color: '#FFFFFF',
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    disposables.push(coreNeedleMat);

    const count = item.type === 'laser-rig' ? 9 : 5;
    for (let i = 0; i < count; i++) {
      const fanSpread = (i - (count - 1) / 2) * (item.type === 'laser-rig' ? 0.14 : 0.18);
      const singleRayGroup = new THREE.Group();
      singleRayGroup.rotation.z = fanSpread;
      singleRayGroup.rotation.x = -0.38 + (i % 2 === 0 ? 0.03 : -0.03);

      const sheathMesh = new THREE.Mesh(sheathGeo, sharpLaserMat);
      const needleMesh = new THREE.Mesh(coreNeedleGeo, coreNeedleMat);
      singleRayGroup.add(sheathMesh, needleMesh);
      beamGroup.add(singleRayGroup);
    }

    group.add(beamGroup);
    laserBeams.push(beamGroup);
  } else if (item.type === 'holo-totem' || item.type === 'lotus-lantern' || item.type === 'geo-sculpture') {
    hitW = 2.8;
    hitH = 5.5;
    hitD = 2.8;

    const plinth = new THREE.Mesh(addGeo(new THREE.CylinderGeometry(0.85, 1.1, 1.1, 8)), matteDeck);
    plinth.position.y = 0.55;
    group.add(plinth);

    const core = new THREE.Mesh(
      addGeo(
        item.type === 'lotus-lantern'
          ? new THREE.OctahedronGeometry(1.05, 1)
          : new THREE.TorusKnotGeometry(0.85, 0.24, 48, 10)
      ),
      glowPrimary
    );
    core.position.y = 3.1;
    group.add(core);
    pulsingParts.push(core);

    const ring = new THREE.Mesh(addGeo(new THREE.TorusGeometry(1.45, 0.08, 8, 32)), glowSecondary);
    ring.position.y = 3.1;
    ring.rotation.x = Math.PI / 3;
    group.add(ring);
    pulsingParts.push(ring);
  } else if (item.type === 'crowd-barrier' || item.type === 'vip-walkway') {
    const isWalkway = item.type === 'vip-walkway';
    hitW = isWalkway ? 3.2 : 8.5;
    hitH = isWalkway ? 1.0 : 1.8;
    hitD = isWalkway ? 10 : 1.5;

    if (isWalkway) {
      const deck = new THREE.Mesh(addGeo(new THREE.BoxGeometry(2.8, 0.22, 9.6)), matteDeck);
      deck.position.y = 0.11;
      deck.receiveShadow = true;
      group.add(deck);

      [-1.32, 1.32].forEach((x) => {
        const rail = new THREE.Mesh(addGeo(new THREE.BoxGeometry(0.12, 0.28, 9.6)), glowPrimary);
        rail.position.set(x, 0.16, 0);
        group.add(rail);
      });
    } else {
      const bar = new THREE.Mesh(addGeo(new THREE.BoxGeometry(8.2, 0.95, 0.25)), darkMetal);
      bar.position.y = 0.55;
      group.add(bar);
      const neonTop = new THREE.Mesh(addGeo(new THREE.BoxGeometry(8.2, 0.14, 0.3)), glowPrimary);
      neonTop.position.y = 1.06;
      group.add(neonTop);
    }
  } else if (item.type === 'portal-gate') {
    hitW = 5.2;
    hitH = 6.2;
    hitD = 2.0;

    const ringFrame = new THREE.Mesh(addGeo(new THREE.TorusGeometry(2.5, 0.26, 12, 36)), darkMetal);
    ringFrame.position.y = 2.9;
    group.add(ringFrame);

    const ringGlow = new THREE.Mesh(addGeo(new THREE.TorusGeometry(2.25, 0.1, 8, 36)), glowSecondary);
    ringGlow.position.y = 2.9;
    group.add(ringGlow);

    const portalMat = createPortalShaderMaterial(item.primaryColor, item.secondaryColor);
    portalMaterials.push(portalMat);
    disposables.push(portalMat);

    const portalDisc = new THREE.Mesh(addGeo(new THREE.CircleGeometry(2.2, 36)), portalMat);
    portalDisc.position.y = 2.9;
    group.add(portalDisc);

    const base = new THREE.Mesh(addGeo(new THREE.BoxGeometry(4.2, 0.4, 1.6)), matteDeck);
    base.position.y = 0.2;
    group.add(base);
  }

  // Ground selection halo (hidden until selected)
  const selRadius = Math.max(hitW, hitD) * 0.58;
  const selGeo = addGeo(new THREE.RingGeometry(selRadius - 0.18, selRadius, 36));
  selGeo.rotateX(-Math.PI / 2);
  const selMat = new THREE.MeshBasicMaterial({
    color: '#00E5FF',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.95,
  });
  disposables.push(selMat);
  const selectionRing = new THREE.Mesh(selGeo, selMat);
  selectionRing.position.y = 0.05;
  selectionRing.visible = false;
  group.add(selectionRing);

  // Invisible simplified proxy hitbox on Layer 1 for effortless mobile tap & drag raycasting
  const hitboxGeo = addGeo(new THREE.BoxGeometry(hitW, hitH, hitD));
  const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
  disposables.push(hitboxMat);
  const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
  hitbox.position.y = hitH / 2;
  hitbox.layers.set(1);
  hitbox.userData.itemId = item.id;
  group.add(hitbox);

  return {
    itemId: item.id,
    group,
    hitbox,
    ledMaterials,
    portalMaterials,
    laserMaterials,
    laserBeams,
    strobeMeshes,
    speakerCones,
    pulsingParts,
    selectionRing,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
