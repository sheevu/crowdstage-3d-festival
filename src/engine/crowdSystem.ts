import * as THREE from 'three';
import {
  AudioMetrics,
  AvatarConfig,
  CrowdAggressionLevel,
  CrowdConfig,
  DanceStyle,
  GraphicsProfile,
  MainEventStyle,
  PerformerActionType,
  RemoteParticipant,
  WebcamPoseMetrics,
} from '../types/festival';
import { sharedWebcamBridge } from './webcamBridge';
import {
  buildPolyPizzaArmGeometry,
  buildPolyPizzaCrowdPropGeometry,
  buildPolyPizzaHatGeometry,
  buildPolyPizzaHeadGeometry,
  buildPolyPizzaLegGeometry,
  buildPolyPizzaShadesGeometry,
  buildPolyPizzaTorsoGeometry,
  PolyPizzaGltfManager,
} from './polyPizzaAssets';

interface DancerSeed {
  x: number;
  z: number;
  phase: number;
  speed: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  facingY: number;
  outfitColor: THREE.Color;
  glowColor: THREE.Color;
  skinColor: THREE.Color;
  hatColor: THREE.Color;
  hasHat: boolean;
  hasProp: boolean;
}

interface ArticulatedAvatarRefs {
  group: THREE.Group;
  hash: string;
  torsoGroup: THREE.Group;
  neckPivot: THREE.Group;
  headPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftHandMesh: THREE.Mesh;
  rightHandMesh: THREE.Mesh;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  auraRing: THREE.Mesh;
  auraOuterRing: THREE.Mesh;
  holoBillboardMesh: THREE.Mesh | null;
}

interface MainEventEnsembleRefs {
  root: THREE.Group;
  guitarist: ArticulatedAvatarRefs;
  bassist: ArticulatedAvatarRefs;
  drummer: ArticulatedAvatarRefs;
  drumKitGroup: THREE.Group;
  cymbalLeft: THREE.Mesh;
  cymbalRight: THREE.Mesh;
  kickDrumFront: THREE.Mesh;
  micStandGroup: THREE.Group;
  breakdancer: ArticulatedAvatarRefs;
  breakCypherPad: THREE.Mesh;
  bboyCrewLeft: ArticulatedAvatarRefs;
  bboyCrewRight: ArticulatedAvatarRefs;
  acrobatLeftPivot: THREE.Group;
  acrobatRightPivot: THREE.Group;
  acrobatLeft: ArticulatedAvatarRefs;
  acrobatRight: ArticulatedAvatarRefs;
}

const CROWD_COLORS = [
  '#00E5FF',
  '#FF3CAC',
  '#8B5CF6',
  '#2162F5',
  '#FFB703',
  '#10B981',
  '#F43F5E',
  '#F97316',
  '#38BDF8',
];

const SKIN_TONES = [
  '#F5D0B5',
  '#E2B897',
  '#D49B72',
  '#C68642',
  '#8D5524',
  '#F1C27D',
];

export class CrowdSystem {
  public readonly group = new THREE.Group();

  private readonly maxDancers = 380;
  private activeCount = 260;

  private leftLegMesh: THREE.InstancedMesh;
  private rightLegMesh: THREE.InstancedMesh;
  private torsoMesh: THREE.InstancedMesh;
  private headMesh: THREE.InstancedMesh;
  private hatMesh: THREE.InstancedMesh;
  private visorMesh: THREE.InstancedMesh;
  private stickLeftMesh: THREE.InstancedMesh;
  private stickRightMesh: THREE.InstancedMesh;
  private wristLeftMesh: THREE.InstancedMesh;
  private wristRightMesh: THREE.InstancedMesh;
  private propMesh: THREE.InstancedMesh;
  private haloMesh: THREE.InstancedMesh;

  private seeds: DancerSeed[] = [];
  private dummy = new THREE.Object3D();

  // Continuous BPM-driven phase integrator so dance speed changes smoothly without frame jumps
  private dancePhase = 0;
  private lastTime = 0;

  private localCrowdAvatar: ArticulatedAvatarRefs | null = null;
  private stagePerformerAvatar: ArticulatedAvatarRefs | null = null;
  private ensemble: MainEventEnsembleRefs | null = null;
  private remoteAvatars = new Map<string, ArticulatedAvatarRefs>();
  private gltfManager = new PolyPizzaGltfManager();

  private disposables: Array<{ dispose: () => void }> = [];

  constructor() {
    // 1. Poly Pizza Stylized Festival Hoodie / Jacket + Hydration Backpack Torso
    const torsoGeo = buildPolyPizzaTorsoGeometry();
    const torsoMat = new THREE.MeshStandardMaterial({
      roughness: 0.34,
      metalness: 0.25,
      flatShading: true,
    });

    // 2. Poly Pizza Independent Articulated Left & Right Legs + Festival Sneakers
    const legGeo = buildPolyPizzaLegGeometry();
    const legsMat = new THREE.MeshStandardMaterial({
      color: '#1E293B',
      roughness: 0.48,
      metalness: 0.35,
      flatShading: true,
    });

    // 3. Poly Pizza Sculpted Low-Poly Head with 3D Nose, Jawline & Ears
    const headGeo = buildPolyPizzaHeadGeometry();
    const headMat = new THREE.MeshStandardMaterial({
      roughness: 0.42,
      metalness: 0.08,
      flatShading: true,
    });

    // 4. Poly Pizza Festival Bucket Hat / Snapback Cap / Rave Headgear
    const hatGeo = buildPolyPizzaHatGeometry();
    const hatMat = new THREE.MeshStandardMaterial({
      roughness: 0.32,
      metalness: 0.28,
      flatShading: true,
    });

    // 5. Poly Pizza Shutter Shades / Pixel Sunglasses / Cyber Visors
    const visorGeo = buildPolyPizzaShadesGeometry();
    const visorMat = new THREE.MeshBasicMaterial({
      color: '#FFFFFF',
    });

    // 6. Poly Pizza Articulated Arms + Forearms + Rock-On Hands
    const stickGeo = buildPolyPizzaArmGeometry();
    const stickMat = new THREE.MeshStandardMaterial({
      roughness: 0.35,
      metalness: 0.22,
      flatShading: true,
    });

    // 7. Reactive LED Crowd Wristbands (Xyloband-style glowing torus bands on both wrists)
    const wristGeo = new THREE.TorusGeometry(0.058, 0.022, 6, 14);
    wristGeo.rotateX(Math.PI / 2);
    wristGeo.translate(0, 0.44, 0.02);
    const wristMat = new THREE.MeshBasicMaterial({
      color: '#FFFFFF',
    });

    // 8. Poly Pizza Handheld Festival Props (Smartphones recording stage, Totems, Rave Wands)
    const propGeo = buildPolyPizzaCrowdPropGeometry();
    const propMat = new THREE.MeshBasicMaterial({
      color: '#FFFFFF',
    });

    // 9. Floating Crystalline Beat Halo above Dancers
    const haloGeo = new THREE.TorusGeometry(0.22, 0.018, 6, 20);
    haloGeo.rotateX(Math.PI / 2);
    const haloMat = new THREE.MeshBasicMaterial({
      color: '#00E5FF',
      transparent: true,
      opacity: 0.78,
    });

    this.disposables.push(
      torsoGeo,
      torsoMat,
      legGeo,
      legsMat,
      headGeo,
      headMat,
      hatGeo,
      hatMat,
      visorGeo,
      visorMat,
      stickGeo,
      stickMat,
      wristGeo,
      wristMat,
      propGeo,
      propMat,
      haloGeo,
      haloMat
    );

    this.leftLegMesh = new THREE.InstancedMesh(legGeo, legsMat, this.maxDancers);
    this.rightLegMesh = new THREE.InstancedMesh(legGeo, legsMat, this.maxDancers);
    this.torsoMesh = new THREE.InstancedMesh(torsoGeo, torsoMat, this.maxDancers);
    this.headMesh = new THREE.InstancedMesh(headGeo, headMat, this.maxDancers);
    this.hatMesh = new THREE.InstancedMesh(hatGeo, hatMat, this.maxDancers);
    this.visorMesh = new THREE.InstancedMesh(visorGeo, visorMat, this.maxDancers);
    this.stickLeftMesh = new THREE.InstancedMesh(stickGeo, stickMat, this.maxDancers);
    this.stickRightMesh = new THREE.InstancedMesh(stickGeo, stickMat, this.maxDancers);
    this.wristLeftMesh = new THREE.InstancedMesh(wristGeo, wristMat, this.maxDancers);
    this.wristRightMesh = new THREE.InstancedMesh(wristGeo, wristMat, this.maxDancers);
    this.propMesh = new THREE.InstancedMesh(propGeo, propMat, this.maxDancers);
    this.haloMesh = new THREE.InstancedMesh(haloGeo, haloMat, this.maxDancers);

    [
      this.leftLegMesh,
      this.rightLegMesh,
      this.torsoMesh,
      this.headMesh,
      this.hatMesh,
      this.visorMesh,
      this.stickLeftMesh,
      this.stickRightMesh,
      this.wristLeftMesh,
      this.wristRightMesh,
      this.propMesh,
      this.haloMesh,
    ].forEach((m) => {
      m.frustumCulled = false;
      this.group.add(m);
    });

    // Deterministic polar crowd distribution facing the stage at (0, 0, -12)
    for (let i = 0; i < this.maxDancers; i++) {
      const r = 4.2 + Math.sqrt((i + 1) / this.maxDancers) * 14.8;
      const theta = ((i * 137.508) % 360) * (Math.PI / 180);
      const x = Math.cos(theta) * r * 1.15;
      const z = Math.sin(theta) * r * 0.72 + 4.5;

      const adjustedX =
        Math.abs(x) < 1.9 && z > -4 && z < 8 ? (x < 0 ? -2.3 : 2.3) : x;

      const facingY = Math.atan2(-adjustedX, -12 - z);

      const c1 = new THREE.Color(CROWD_COLORS[i % CROWD_COLORS.length]);
      const c2 = new THREE.Color(CROWD_COLORS[(i + 2) % CROWD_COLORS.length]);
      const wristColor = new THREE.Color(CROWD_COLORS[(i + 4) % CROWD_COLORS.length]);
      const skinColor = new THREE.Color(SKIN_TONES[i % SKIN_TONES.length]);
      const hatColor = new THREE.Color(CROWD_COLORS[(i + 3) % CROWD_COLORS.length]);
      const pantsColor = new THREE.Color(
        i % 3 === 0 ? '#1E293B' : i % 3 === 1 ? '#0F172A' : '#312E81'
      );

      const baseScale = 0.85 + (i % 9) * 0.036;
      const silhouetteWidth = baseScale * (0.92 + ((i * 3) % 5) * 0.05);
      const heightVar = baseScale * (0.92 + ((i * 7) % 6) * 0.045);

      this.seeds.push({
        x: adjustedX,
        z,
        phase: (i * 0.73) % (Math.PI * 2),
        speed: 0.92 + (i % 5) * 0.06,
        scaleX: silhouetteWidth,
        scaleY: heightVar,
        scaleZ: silhouetteWidth,
        facingY,
        outfitColor: c1,
        glowColor: c2,
        skinColor,
        hatColor,
        hasHat: i % 5 !== 0,
        hasProp: i % 3 === 0,
      });

      this.leftLegMesh.setColorAt(i, pantsColor);
      this.rightLegMesh.setColorAt(i, pantsColor);
      this.torsoMesh.setColorAt(i, c1);
      this.headMesh.setColorAt(i, skinColor);
      this.hatMesh.setColorAt(i, hatColor);
      this.visorMesh.setColorAt(i, c2);
      this.stickLeftMesh.setColorAt(i, c1);
      this.stickRightMesh.setColorAt(i, c1);
      this.wristLeftMesh.setColorAt(i, wristColor);
      this.wristRightMesh.setColorAt(i, wristColor);
      this.propMesh.setColorAt(i, c2);
      this.haloMesh.setColorAt(i, c1);
    }

    [
      this.leftLegMesh,
      this.rightLegMesh,
      this.torsoMesh,
      this.headMesh,
      this.hatMesh,
      this.visorMesh,
      this.stickLeftMesh,
      this.stickRightMesh,
      this.wristLeftMesh,
      this.wristRightMesh,
      this.propMesh,
      this.haloMesh,
    ].forEach((m) => {
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });

    // Build Main Event Stage Ensemble (Rock Band, Breakdancer Crew, Aerial Acrobats)
    this.ensemble = this.buildMainEventEnsemble();
    this.group.add(this.ensemble.root);

    // Load Three.js Official CC0 GLTF Animated Characters & Flying Mascots
    this.gltfManager.loadOfficialThreeJsCharacters(this.group);
  }

  private buildGuitarMesh(primaryHex: string, accentHex: string, isBass = false): THREE.Group {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: primaryHex,
      emissive: primaryHex,
      emissiveIntensity: 0.45,
      roughness: 0.16,
      metalness: 0.65,
      clearcoat: 1.0,
    });
    const neckMat = new THREE.MeshStandardMaterial({
      color: '#1E293B',
      roughness: 0.35,
      metalness: 0.7,
    });
    const glowMat = new THREE.MeshBasicMaterial({ color: accentHex });

    // Sculpted double-cutaway electric guitar body
    const lowerBout = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.06, 16), bodyMat);
    lowerBout.rotation.x = Math.PI / 2;
    g.add(lowerBout);

    const upperBout = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.06, 14), bodyMat);
    upperBout.rotation.x = Math.PI / 2;
    upperBout.position.set(0.14, 0.08, 0);
    g.add(upperBout);

    const pickup = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.075), glowMat);
    pickup.position.set(0.05, 0.02, 0);
    g.add(pickup);

    // Fretboard neck & headstock
    const neckLen = isBass ? 0.68 : 0.56;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(neckLen, 0.055, 0.035), neckMat);
    neck.position.set(0.22 + neckLen * 0.5, 0.12, 0.01);
    neck.rotation.z = 0.22;
    g.add(neck);

    const headstock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.035), glowMat);
    headstock.position.set(0.22 + neckLen + 0.04, 0.12 + neckLen * 0.22, 0.01);
    headstock.rotation.z = 0.35;
    g.add(headstock);

    return g;
  }

  private buildMainEventEnsemble(): MainEventEnsembleRefs {
    const root = new THREE.Group();

    // 1. ROCK BAND — Lead Guitarist (Stage Left)
    const guitarist = this.buildArticulatedAvatar(
      {
        displayName: 'Lead Guitar',
        outfitColor: '#F43F5E',
        accentColor: '#FFB703',
        skinColor: '#E2B897',
        hairColor: '#111827',
        hairStyle: 'mohawk',
        accessory: 'visor',
        danceStyle: 'rave',
        position: [-4.2, 1.35, -11.2],
        rotationY: 0.18,
      },
      'remote',
      'rock-guitarist'
    );
    guitarist.group.scale.setScalar(1.32);
    const electricGuitar = this.buildGuitarMesh('#F43F5E', '#00E5FF', false);
    electricGuitar.position.set(0.02, 0.28, 0.26);
    electricGuitar.rotation.z = -0.25;
    guitarist.torsoGroup.add(electricGuitar);
    root.add(guitarist.group);

    // 2. ROCK BAND — Bassist (Stage Right)
    const bassist = this.buildArticulatedAvatar(
      {
        displayName: 'Bass Guitarist',
        outfitColor: '#8B5CF6',
        accentColor: '#00E5FF',
        skinColor: '#C68642',
        hairColor: '#0F172A',
        hairStyle: 'crown',
        accessory: 'visor',
        danceStyle: 'bounce',
        position: [4.2, 1.35, -11.2],
        rotationY: -0.18,
      },
      'remote',
      'rock-bassist'
    );
    bassist.group.scale.setScalar(1.32);
    const bassGuitar = this.buildGuitarMesh('#8B5CF6', '#FF3CAC', true);
    bassGuitar.position.set(0.02, 0.28, 0.26);
    bassGuitar.rotation.z = -0.2;
    bassist.torsoGroup.add(bassGuitar);
    root.add(bassist.group);

    // 3. ROCK BAND — Drummer + Full 3D Drum Kit on Rear Stage Riser
    const drumKitGroup = new THREE.Group();
    drumKitGroup.position.set(0, 1.4, -14.2);

    const riserMat = new THREE.MeshStandardMaterial({
      color: '#0F172A',
      roughness: 0.3,
      metalness: 0.8,
    });
    const shellMat = new THREE.MeshPhysicalMaterial({
      color: '#FF3CAC',
      emissive: '#FF3CAC',
      emissiveIntensity: 0.4,
      roughness: 0.18,
      metalness: 0.7,
      clearcoat: 1.0,
    });
    const cymbalMat = new THREE.MeshStandardMaterial({
      color: '#FFB703',
      emissive: '#FFB703',
      emissiveIntensity: 0.35,
      roughness: 0.15,
      metalness: 0.92,
    });
    const drumHeadMat = new THREE.MeshBasicMaterial({ color: '#00E5FF' });

    const drumRiser = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.55, 2.6), riserMat);
    drumRiser.position.y = 0.275;
    drumKitGroup.add(drumRiser);

    // Kick drum
    const kick = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.55, 20), shellMat);
    kick.rotation.x = Math.PI / 2;
    kick.position.set(0, 1.1, 0.35);
    drumKitGroup.add(kick);

    const kickDrumFront = new THREE.Mesh(new THREE.CircleGeometry(0.52, 20), drumHeadMat);
    kickDrumFront.position.set(0, 1.1, 0.63);
    drumKitGroup.add(kickDrumFront);

    // Snare & Rack Toms
    [-0.45, 0.45].forEach((tx) => {
      const tom = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.28, 16), shellMat);
      tom.position.set(tx, 1.65, 0.25);
      tom.rotation.x = 0.35;
      drumKitGroup.add(tom);
    });

    // Crash & Ride Cymbals on Stands
    const standGeo = new THREE.CylinderGeometry(0.025, 0.035, 1.6, 8);
    const cymbalGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.02, 20);
    const standL = new THREE.Mesh(standGeo, riserMat);
    standL.position.set(-1.15, 1.35, 0.2);
    const cymbalLeft = new THREE.Mesh(cymbalGeo, cymbalMat);
    cymbalLeft.position.set(-1.15, 2.15, 0.2);
    cymbalLeft.rotation.x = 0.22;

    const standR = new THREE.Mesh(standGeo, riserMat);
    standR.position.set(1.15, 1.35, 0.2);
    const cymbalRight = new THREE.Mesh(cymbalGeo, cymbalMat);
    cymbalRight.position.set(1.15, 2.15, 0.2);
    cymbalRight.rotation.x = 0.22;

    drumKitGroup.add(standL, cymbalLeft, standR, cymbalRight);
    root.add(drumKitGroup);

    const drummer = this.buildArticulatedAvatar(
      {
        displayName: 'Drummer',
        outfitColor: '#FFB703',
        accentColor: '#00E5FF',
        skinColor: '#E2B897',
        hairColor: '#1E1B4B',
        hairStyle: 'fade',
        accessory: 'headphones',
        danceStyle: 'rave',
        position: [0, 1.95, -14.65],
        rotationY: 0,
      },
      'remote',
      'rock-drummer'
    );
    drummer.group.scale.setScalar(1.22);
    // Add glowing drumsticks in drummer hands
    const stickGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.48, 6);
    stickGeo.rotateX(Math.PI / 2);
    stickGeo.translate(0, 0, 0.22);
    const stickMat = new THREE.MeshBasicMaterial({ color: '#00E5FF' });
    drummer.leftHandMesh.add(new THREE.Mesh(stickGeo, stickMat));
    drummer.rightHandMesh.add(new THREE.Mesh(stickGeo, stickMat));
    root.add(drummer.group);

    // Lead Vocalist Stage Microphone Stand at front apron
    const micStandGroup = new THREE.Group();
    micStandGroup.position.set(0, 1.35, -9.85);
    const micBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.06, 14), riserMat);
    const micPole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 1.48, 8), riserMat);
    micPole.position.y = 0.74;
    const micHead = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), drumHeadMat);
    micHead.position.set(0, 1.5, -0.05);
    micStandGroup.add(micBase, micPole, micHead);
    root.add(micStandGroup);

    // 4. BREAK DANCER CREW — Center Cypher Spinner + 2 Flanking B-Boy Crew Members
    const padGeo = new THREE.RingGeometry(1.1, 1.95, 36);
    padGeo.rotateX(-Math.PI / 2);
    const padMat = new THREE.MeshBasicMaterial({
      color: '#00E5FF',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const breakCypherPad = new THREE.Mesh(padGeo, padMat);
    breakCypherPad.position.set(0, 1.42, -9.2);
    root.add(breakCypherPad);

    const breakdancer = this.buildArticulatedAvatar(
      {
        displayName: 'B-Boy Spinner',
        outfitColor: '#10B981',
        accentColor: '#00E5FF',
        skinColor: '#E2B897',
        hairColor: '#0F172A',
        hairStyle: 'fade',
        accessory: 'visor',
        danceStyle: 'rave',
        position: [0, 1.95, -9.2],
        rotationY: 0,
      },
      'remote',
      'bboy-spinner'
    );
    breakdancer.group.scale.setScalar(1.28);
    root.add(breakdancer.group);

    const bboyCrewLeft = this.buildArticulatedAvatar(
      {
        displayName: 'B-Girl Left',
        outfitColor: '#FF3CAC',
        accentColor: '#FFB703',
        skinColor: '#C68642',
        hairColor: '#1E1B4B',
        hairStyle: 'bob',
        accessory: 'visor',
        danceStyle: 'bounce',
        position: [-2.8, 1.35, -9.8],
        rotationY: 0.45,
      },
      'remote',
      'bboy-crew-left'
    );
    bboyCrewLeft.group.scale.setScalar(1.24);
    root.add(bboyCrewLeft.group);

    const bboyCrewRight = this.buildArticulatedAvatar(
      {
        displayName: 'B-Boy Right',
        outfitColor: '#2162F5',
        accentColor: '#00E5FF',
        skinColor: '#E2B897',
        hairColor: '#1E1B4B',
        hairStyle: 'mohawk',
        accessory: 'headphones',
        danceStyle: 'bounce',
        position: [2.8, 1.35, -9.8],
        rotationY: -0.45,
      },
      'remote',
      'bboy-crew-right'
    );
    bboyCrewRight.group.scale.setScalar(1.24);
    root.add(bboyCrewRight.group);

    // 5. AERIAL ACROBATS — Suspended on Glowing Silks & Aerial Lyra Hoops under Stage Arch
    const silkGeo = new THREE.CylinderGeometry(0.035, 0.035, 5.2, 8);
    silkGeo.translate(0, 2.6, 0);
    const hoopGeo = new THREE.TorusGeometry(0.88, 0.045, 10, 32);

    const silkMatL = new THREE.MeshBasicMaterial({
      color: '#00E5FF',
      transparent: true,
      opacity: 0.85,
    });
    const silkMatR = new THREE.MeshBasicMaterial({
      color: '#FF3CAC',
      transparent: true,
      opacity: 0.85,
    });

    const acrobatLeftPivot = new THREE.Group();
    acrobatLeftPivot.position.set(-4.6, 5.2, -11.4);
    const silkL = new THREE.Mesh(silkGeo, silkMatL);
    const hoopL = new THREE.Mesh(hoopGeo, silkMatL);
    acrobatLeftPivot.add(silkL, hoopL);

    const acrobatLeft = this.buildArticulatedAvatar(
      {
        displayName: 'Aerialist Left',
        outfitColor: '#00E5FF',
        accentColor: '#FF3CAC',
        skinColor: '#E2B897',
        hairColor: '#F8FAFC',
        hairStyle: 'crown',
        accessory: 'halo',
        danceStyle: 'sway',
        position: [0, -0.65, 0],
        rotationY: 0,
      },
      'remote',
      'aerial-left'
    );
    acrobatLeft.group.scale.setScalar(1.18);
    acrobatLeftPivot.add(acrobatLeft.group);
    root.add(acrobatLeftPivot);

    const acrobatRightPivot = new THREE.Group();
    acrobatRightPivot.position.set(4.6, 5.2, -11.4);
    const silkR = new THREE.Mesh(silkGeo, silkMatR);
    const hoopR = new THREE.Mesh(hoopGeo, silkMatR);
    acrobatRightPivot.add(silkR, hoopR);

    const acrobatRight = this.buildArticulatedAvatar(
      {
        displayName: 'Aerialist Right',
        outfitColor: '#FF3CAC',
        accentColor: '#FFB703',
        skinColor: '#E2B897',
        hairColor: '#F8FAFC',
        hairStyle: 'crown',
        accessory: 'halo',
        danceStyle: 'sway',
        position: [0, -0.65, 0],
        rotationY: 0,
      },
      'remote',
      'aerial-right'
    );
    acrobatRight.group.scale.setScalar(1.18);
    acrobatRightPivot.add(acrobatRight.group);
    root.add(acrobatRightPivot);

    return {
      root,
      guitarist,
      bassist,
      drummer,
      drumKitGroup,
      cymbalLeft,
      cymbalRight,
      kickDrumFront,
      micStandGroup,
      breakdancer,
      breakCypherPad,
      bboyCrewLeft,
      bboyCrewRight,
      acrobatLeftPivot,
      acrobatRightPivot,
      acrobatLeft,
      acrobatRight,
    };
  }

  public setProfileAndDensity(profile: GraphicsProfile, density: number) {
    const profileCap =
      profile === 'low' ? 110 : profile === 'balanced' ? 240 : this.maxDancers;
    this.activeCount = Math.max(
      16,
      Math.round(profileCap * Math.max(0.1, Math.min(1, density)))
    );
    this.leftLegMesh.count = this.activeCount;
    this.rightLegMesh.count = this.activeCount;
    this.torsoMesh.count = this.activeCount;
    this.headMesh.count = this.activeCount;
    this.hatMesh.count = this.activeCount;
    this.visorMesh.count = this.activeCount;
    this.stickLeftMesh.count = this.activeCount;
    this.stickRightMesh.count = this.activeCount;
    this.wristLeftMesh.count = this.activeCount;
    this.wristRightMesh.count = this.activeCount;
    this.propMesh.count = this.activeCount;
    this.haloMesh.count = this.activeCount;
  }

  public update(
    time: number,
    bass: number,
    beat: number,
    choreography: DanceStyle,
    localAvatar: AvatarConfig,
    participants: RemoteParticipant[],
    webcamPose?: WebcamPoseMetrics,
    activeAction?: { type: PerformerActionType; timestamp: number } | null,
    mainEventStyle: MainEventStyle = 'lolla-headliner',
    audioMetrics?: AudioMetrics,
    crowdConfig?: CrowdConfig
  ) {
    const dt = this.lastTime > 0 ? Math.min(0.08, Math.max(0.001, time - this.lastTime)) : 0.016;
    this.lastTime = time;

    // 7-Band Audio Frequency Response + BPM Telemetry
    const subBass = audioMetrics?.subBass ?? bass;
    const lowMid = audioMetrics?.lowMid ?? bass * 0.7;
    const mid = audioMetrics?.mid ?? bass * 0.6;
    const highMid = audioMetrics?.highMid ?? beat * 0.6;
    const presence = audioMetrics?.presence ?? beat * 0.5;
    const brilliance = audioMetrics?.brilliance ?? beat * 0.5;

    const bpm = crowdConfig?.bpmOverride ?? audioMetrics?.bpmEstimate ?? 124;
    const afrSens = crowdConfig?.afrSensitivity ?? 1.2;
    const modelStyle = crowdConfig?.modelStyle ?? 'lolla-mix';
    const propDensity = crowdConfig?.propDensity ?? 0.75;

    const crowdIntensity = Math.min(
      1.3,
      (audioMetrics?.crowdIntensity ?? (subBass * 0.35 + bass * 0.35 + beat * 0.3)) *
        (afrSens / 1.1)
    );

    const danceSpeedMult =
      audioMetrics?.danceSpeedMultiplier ??
      Math.max(0.55, Math.min(2.45, (bpm / 120) * (0.78 + crowdIntensity * 0.58)));

    const aggressionLevel: CrowdAggressionLevel =
      audioMetrics?.aggressionLevel ??
      (bpm >= 144 || crowdIntensity >= 0.85
        ? 'mosh-frenzy'
        : bpm >= 124 || crowdIntensity >= 0.55
          ? 'hype-jumping'
          : bpm >= 100
            ? 'upbeat-bouncing'
            : 'chill-grooving');

    // Integrate continuous dance phase proportional to live BPM & danceSpeedMultiplier
    const beatsPerSec = (bpm / 60) * Math.max(0.65, danceSpeedMult * 0.92);
    this.dancePhase += dt * beatsPerSec * Math.PI * 2;

    // Update Three.js GLTF animated characters timeScale with BPM multiplier
    this.gltfManager.update(dt, danceSpeedMult);

    const now = Date.now();
    const actionAge = activeAction ? (now - activeAction.timestamp) / 1000 : 999;
    const isHandsUpDrop =
      (activeAction?.type === 'hands-up' && actionAge < 3.2) ||
      (subBass > 0.58 && beat > 0.42) ||
      aggressionLevel === 'mosh-frenzy';
    const isChorusJump =
      (activeAction?.type === 'pyro-burst' && actionAge < 3.0) ||
      subBass > 0.66 ||
      aggressionLevel === 'hype-jumping' ||
      aggressionLevel === 'mosh-frenzy';

    // Aggression multiplier scales jump height, leg kick angle, headbanging & lateral mosh movement
    const aggrMult =
      aggressionLevel === 'mosh-frenzy'
        ? 1.55
        : aggressionLevel === 'hype-jumping'
          ? 1.22
          : aggressionLevel === 'upbeat-bouncing'
            ? 1.0
            : 0.65;

    // Sub-Bass (20-90Hz) + Beat drives vertical jump height
    const bounceMult =
      (0.05 + subBass * 0.32 + bass * 0.18 + beat * 0.22 + (isChorusJump ? 0.16 : 0)) *
      aggrMult;

    for (let i = 0; i < this.activeCount; i++) {
      const s = this.seeds[i];
      const dancerPhase =
        choreography === 'wave'
          ? s.x * 0.45 + this.dancePhase * 0.85
          : choreography === 'rave' || aggressionLevel === 'mosh-frenzy'
            ? this.dancePhase * 1.45 * s.speed + s.phase
            : choreography === 'sway'
              ? this.dancePhase * 0.48 + s.phase
              : this.dancePhase * s.speed + s.phase;

      const syncJump = isChorusJump
        ? Math.abs(Math.sin(this.dancePhase * 1.15 + (i % 3) * 0.22)) * 0.24 * aggrMult
        : 0;
      const yBounce = Math.abs(Math.sin(dancerPhase)) * bounceMult + syncJump;

      // Low-Mid (350-860Hz) drives lateral hip sway & circle-pit mosh surge
      const moshSurgeX =
        aggressionLevel === 'mosh-frenzy'
          ? Math.sin(this.dancePhase * 0.75 + i * 0.9) * (0.18 + lowMid * 0.26)
          : 0;
      const swayX =
        (choreography === 'sway'
          ? Math.sin(dancerPhase) * 0.18
          : Math.sin(dancerPhase * 0.5) * (0.05 + lowMid * 0.12)) + moshSurgeX;

      const torsoLeanZ = Math.sin(dancerPhase) * (0.08 + lowMid * 0.14) * aggrMult;

      // High-Mid (2.4-4.5kHz) drives aggressive headbang & nod velocity
      const headNodX =
        Math.sin(dancerPhase * 2) * (0.08 + highMid * 0.32 + bass * 0.15) * aggrMult;

      // Bass (90-340Hz) drives alternating Left & Right leg stomp / high-knee kick
      const legStride =
        Math.sin(dancerPhase * 1.0) * (0.18 + bass * 0.46) * aggrMult;
      const leftKneeLift = Math.max(0, legStride) * 0.16;
      const rightKneeLift = Math.max(0, -legStride) * 0.16;

      const cosF = Math.cos(s.facingY);
      const sinF = Math.sin(s.facingY);
      const hipOffset = 0.095 * s.scaleX;

      // 1A. Articulated Left Leg + Sneaker
      this.dummy.position.set(
        s.x + swayX * 0.65 - cosF * hipOffset,
        yBounce * 0.65 + leftKneeLift,
        s.z + sinF * hipOffset
      );
      this.dummy.rotation.set(legStride, s.facingY, torsoLeanZ * 0.3);
      this.dummy.scale.set(s.scaleX, s.scaleY, s.scaleZ);
      this.dummy.updateMatrix();
      this.leftLegMesh.setMatrixAt(i, this.dummy.matrix);

      // 1B. Articulated Right Leg + Sneaker
      this.dummy.position.set(
        s.x + swayX * 0.65 + cosF * hipOffset,
        yBounce * 0.65 + rightKneeLift,
        s.z - sinF * hipOffset
      );
      this.dummy.rotation.set(-legStride, s.facingY, torsoLeanZ * 0.3);
      this.dummy.scale.set(s.scaleX, s.scaleY, s.scaleZ);
      this.dummy.updateMatrix();
      this.rightLegMesh.setMatrixAt(i, this.dummy.matrix);

      // 2. Poly Pizza Hoodie/Jacket Torso + Hydration Backpack
      const moshSpinY =
        aggressionLevel === 'mosh-frenzy' && i % 7 === 0
          ? s.facingY + Math.sin(this.dancePhase * 0.5 + i) * 0.75
          : s.facingY + Math.sin(dancerPhase * 0.5) * (0.1 + lowMid * 0.16);

      this.dummy.position.set(s.x + swayX, yBounce, s.z);
      this.dummy.rotation.set(headNodX * 0.38, moshSpinY, torsoLeanZ);
      this.dummy.scale.set(s.scaleX, s.scaleY, s.scaleZ);
      this.dummy.updateMatrix();
      this.torsoMesh.setMatrixAt(i, this.dummy.matrix);

      // 3. Poly Pizza Sculpted Head + Bucket Hat/Cap + Shutter Shades
      const headY = yBounce + 1.42 * s.scaleY;
      this.dummy.position.set(s.x + swayX, headY, s.z);
      this.dummy.rotation.set(
        headNodX,
        moshSpinY + Math.sin(dancerPhase * 0.5) * 0.2,
        torsoLeanZ * 0.55
      );
      this.dummy.scale.setScalar(s.scaleY);
      this.dummy.updateMatrix();
      this.headMesh.setMatrixAt(i, this.dummy.matrix);
      this.visorMesh.setMatrixAt(i, this.dummy.matrix);

      // Hat visibility depends on CrowdModelStyle
      const showHat =
        modelStyle === 'streetwear-lowpoly'
          ? true
          : modelStyle === 'cyber-raver'
            ? i % 3 === 0
            : s.hasHat;
      this.dummy.scale.setScalar(showHat ? s.scaleY : 0.0001);
      this.dummy.updateMatrix();
      this.hatMesh.setMatrixAt(i, this.dummy.matrix);

      // 4. Mid (860-2400Hz) + Presence (4.5-8kHz) drives Left & Right Arm Pumping & Held Props
      const armRaise =
        isHandsUpDrop || choreography === 'rave'
          ? 1.18 + Math.sin(dancerPhase * 1.5 + (i % 4) * 0.25) * (0.22 + mid * 0.24)
          : 0.94 + Math.sin(dancerPhase) * (0.24 + mid * 0.26);

      const armPitch = isHandsUpDrop
        ? -0.22 + Math.sin(dancerPhase * 1.5 + s.phase) * (0.32 + mid * 0.35) * aggrMult
        : -0.45 + Math.cos(dancerPhase) * (0.35 + mid * 0.3) * aggrMult;

      // Brilliance (8-14kHz) + Beat drives LED Wristband pulse scale
      const wristPulseScale =
        s.scaleY * (1.0 + beat * 0.36 + brilliance * 0.32 + (isHandsUpDrop ? 0.22 : 0));

      const shoulderOffset = 0.28 * s.scaleX;

      // Left Arm + Wristband
      this.dummy.position.set(
        s.x + swayX - cosF * shoulderOffset,
        yBounce + armRaise * s.scaleY,
        s.z + sinF * shoulderOffset
      );
      this.dummy.rotation.set(
        armPitch,
        moshSpinY,
        isHandsUpDrop ? 0.16 : 0.36 + Math.sin(dancerPhase) * (0.42 + mid * 0.28)
      );
      this.dummy.scale.setScalar(s.scaleY);
      this.dummy.updateMatrix();
      this.stickLeftMesh.setMatrixAt(i, this.dummy.matrix);

      this.dummy.scale.setScalar(wristPulseScale);
      this.dummy.updateMatrix();
      this.wristLeftMesh.setMatrixAt(i, this.dummy.matrix);

      // Right Arm + Wristband + Held Festival Prop (Smartphone / Totem / Glow Wand)
      this.dummy.position.set(
        s.x + swayX + cosF * shoulderOffset,
        yBounce + armRaise * s.scaleY,
        s.z - sinF * shoulderOffset
      );
      this.dummy.rotation.set(
        armPitch - presence * 0.25,
        moshSpinY,
        isHandsUpDrop ? -0.16 : -0.36 - Math.sin(dancerPhase) * (0.42 + mid * 0.28)
      );
      this.dummy.scale.setScalar(s.scaleY);
      this.dummy.updateMatrix();
      this.stickRightMesh.setMatrixAt(i, this.dummy.matrix);

      this.dummy.scale.setScalar(wristPulseScale);
      this.dummy.updateMatrix();
      this.wristRightMesh.setMatrixAt(i, this.dummy.matrix);

      const propCutoff = Math.round(propDensity * 10);
      const showProp = (i % 10) < propCutoff && (s.hasProp || modelStyle === 'poly-festival');
      this.dummy.scale.setScalar(
        showProp ? s.scaleY * (0.95 + presence * 0.35 + beat * 0.2) : 0.0001
      );
      this.dummy.updateMatrix();
      this.propMesh.setMatrixAt(i, this.dummy.matrix);

      // 5. Surreal Floating Aura Halo (pulses on beat & brilliance)
      const showHalo =
        modelStyle === 'cyber-raver'
          ? i % 2 === 0
          : modelStyle === 'streetwear-lowpoly'
            ? i % 6 === 0
            : i % 3 === 0;
      this.dummy.position.set(
        s.x + swayX,
        headY + (0.32 + beat * 0.16) * s.scaleY,
        s.z
      );
      this.dummy.rotation.set(Math.sin(time * 2 + i) * 0.2, time * 1.8 * danceSpeedMult, 0);
      this.dummy.scale.setScalar(
        showHalo ? s.scaleY * (0.85 + subBass * 0.4 + brilliance * 0.25) : 0.0001
      );
      this.dummy.updateMatrix();
      this.haloMesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.leftLegMesh.instanceMatrix.needsUpdate = true;
    this.rightLegMesh.instanceMatrix.needsUpdate = true;
    this.torsoMesh.instanceMatrix.needsUpdate = true;
    this.headMesh.instanceMatrix.needsUpdate = true;
    this.hatMesh.instanceMatrix.needsUpdate = true;
    this.visorMesh.instanceMatrix.needsUpdate = true;
    this.stickLeftMesh.instanceMatrix.needsUpdate = true;
    this.stickRightMesh.instanceMatrix.needsUpdate = true;
    this.wristLeftMesh.instanceMatrix.needsUpdate = true;
    this.wristRightMesh.instanceMatrix.needsUpdate = true;
    this.propMesh.instanceMatrix.needsUpdate = true;
    this.haloMesh.instanceMatrix.needsUpdate = true;

    // Update Main Event Ensemble Actors (scaled by danceSpeedMult so band & breakdancers speed up with BPM!)
    if (this.ensemble) {
      this.updateMainEventEnsemble(
        this.ensemble,
        mainEventStyle,
        this.dancePhase * 0.18,
        bass,
        beat
      );
    }

    const placement = localAvatar.stagePlacement ?? 'both';
    const localHash = JSON.stringify([
      localAvatar.outfitColor,
      localAvatar.accentColor,
      localAvatar.skinColor,
      localAvatar.hairColor,
      localAvatar.hairStyle,
      localAvatar.accessory,
      localAvatar.faceTextureMode,
      Boolean(localAvatar.hasScannedFace),
      Boolean(localAvatar.webcamStageEnabled),
      placement,
    ]);

    // 1. Visitor Avatar in the Crowd (reacts to BPM dancePhase & subBass)
    if (!this.localCrowdAvatar || this.localCrowdAvatar.hash !== localHash) {
      if (this.localCrowdAvatar) this.group.remove(this.localCrowdAvatar.group);
      this.localCrowdAvatar = this.buildArticulatedAvatar(
        localAvatar,
        'crowd',
        localHash
      );
      this.group.add(this.localCrowdAvatar.group);
    }
    this.localCrowdAvatar.group.visible =
      placement === 'crowd-front' || placement === 'both';
    if (this.localCrowdAvatar.group.visible) {
      const localBounce =
        Math.abs(Math.sin(this.dancePhase)) * (0.06 + subBass * 0.34) * aggrMult;
      this.localCrowdAvatar.group.position.set(
        localAvatar.position[0],
        localBounce,
        localAvatar.position[2]
      );
      this.localCrowdAvatar.group.rotation.y = localAvatar.rotationY;
      this.animateAvatarLimbs(
        this.localCrowdAvatar,
        this.dancePhase * 0.2,
        bass,
        beat,
        localAvatar.webcamStageEnabled ? webcamPose : undefined,
        activeAction
      );
    }

    // 2. On-Stage Sculpted 3D Headliner Avatar (Elevated on Main Stage Deck)
    if (!this.stagePerformerAvatar || this.stagePerformerAvatar.hash !== localHash) {
      if (this.stagePerformerAvatar) {
        this.group.remove(this.stagePerformerAvatar.group);
      }
      this.stagePerformerAvatar = this.buildArticulatedAvatar(
        localAvatar,
        'stage-performer',
        localHash
      );
      this.group.add(this.stagePerformerAvatar.group);
    }

    const showOnStage =
      Boolean(localAvatar.webcamStageEnabled) ||
      placement === 'stage-dj' ||
      placement === 'both';
    this.stagePerformerAvatar.group.visible = showOnStage;

    if (showOnStage) {
      const stageBounce =
        Math.abs(Math.sin(this.dancePhase)) * (0.08 + subBass * 0.34) * aggrMult +
        (isChorusJump ? Math.abs(Math.sin(this.dancePhase * 1.5)) * 0.22 : 0);
      const leanX = webcamPose?.active
        ? webcamPose.headX * 1.15
        : Math.sin(time * 1.2 * danceSpeedMult) * 0.45;
      const stageZ = mainEventStyle === 'rock-band' ? -10.35 : -11.2;
      this.stagePerformerAvatar.group.position.set(
        leanX,
        1.15 + stageBounce,
        stageZ
      );
      this.stagePerformerAvatar.group.rotation.y = 0;
      this.stagePerformerAvatar.group.scale.setScalar(
        localAvatar.webcamStageEnabled ? 1.48 : 1.28
      );
      this.animateAvatarLimbs(
        this.stagePerformerAvatar,
        this.dancePhase * 0.2,
        bass,
        beat,
        webcamPose,
        activeAction
      );
    }

    // 3. Remote Multiplayer Avatars
    const activeIds = new Set(participants.map((p) => p.clientId));
    for (const [id, entry] of this.remoteAvatars.entries()) {
      if (!activeIds.has(id)) {
        this.group.remove(entry.group);
        this.remoteAvatars.delete(id);
      }
    }

    participants.forEach((p, idx) => {
      const hash = JSON.stringify([
        p.avatar.outfitColor,
        p.avatar.accentColor,
        p.avatar.skinColor,
        p.avatar.hairColor,
        p.avatar.hairStyle,
        p.avatar.accessory,
      ]);
      let entry = this.remoteAvatars.get(p.clientId);
      if (!entry || entry.hash !== hash) {
        if (entry) this.group.remove(entry.group);
        entry = this.buildArticulatedAvatar(p.avatar, 'remote', hash);
        this.remoteAvatars.set(p.clientId, entry);
        this.group.add(entry.group);
      }
      const b = Math.abs(Math.sin(this.dancePhase + idx)) * (0.06 + subBass * 0.28) * aggrMult;
      entry.group.position.set(p.avatar.position[0], b, p.avatar.position[2]);
      entry.group.rotation.y = p.avatar.rotationY;
      this.animateAvatarLimbs(entry, this.dancePhase * 0.2 + idx * 0.8, bass, beat);
    });
  }

  private updateMainEventEnsemble(
    ens: MainEventEnsembleRefs,
    style: MainEventStyle,
    time: number,
    bass: number,
    beat: number
  ) {
    const showBand = style === 'rock-band' || style === 'lolla-headliner';
    const showBreak = style === 'break-dancer' || style === 'lolla-headliner';
    const showAcrobats = style === 'acrobats' || style === 'lolla-headliner';

    // 1. ROCK BAND ANIMATIONS
    ens.guitarist.group.visible = showBand;
    ens.bassist.group.visible = showBand;
    ens.drummer.group.visible = showBand;
    ens.drumKitGroup.visible = showBand;
    ens.micStandGroup.visible = style === 'rock-band';

    if (showBand) {
      const rockJump = Math.abs(Math.sin(time * 7.2)) * (0.12 + bass * 0.32);
      // Lead Guitarist strumming & rock headbanging
      ens.guitarist.group.position.set(
        -4.3 + Math.sin(time * 1.4) * 0.7,
        1.35 + rockJump,
        -10.8
      );
      ens.guitarist.torsoGroup.rotation.x = 0.18 + Math.sin(time * 11) * (0.12 + bass * 0.15);
      ens.guitarist.torsoGroup.rotation.z = -0.15 + Math.cos(time * 3.5) * 0.14;
      ens.guitarist.headPivot.rotation.x = Math.sin(time * 14) * (0.28 + bass * 0.25);
      // Left hand fretting neck, right hand strumming fast
      ens.guitarist.leftArmPivot.rotation.set(-0.85, 0, -0.55);
      ens.guitarist.rightArmPivot.rotation.set(
        -0.75 + Math.sin(time * 28) * (0.25 + beat * 0.25),
        0,
        0.35
      );
      ens.guitarist.leftLegPivot.rotation.x = Math.sin(time * 7.2) * 0.35;
      ens.guitarist.rightLegPivot.rotation.x = -Math.sin(time * 7.2) * 0.35;

      // Bassist grooving
      const bassGroove = Math.abs(Math.cos(time * 5.6)) * (0.09 + bass * 0.28);
      ens.bassist.group.position.set(
        4.3 + Math.cos(time * 1.2) * 0.65,
        1.35 + bassGroove,
        -10.8
      );
      ens.bassist.torsoGroup.rotation.x = 0.14 + Math.sin(time * 8) * 0.1;
      ens.bassist.headPivot.rotation.x = Math.sin(time * 10) * (0.22 + bass * 0.2);
      ens.bassist.leftArmPivot.rotation.set(-0.85, 0, -0.52);
      ens.bassist.rightArmPivot.rotation.set(-0.7 + Math.cos(time * 18) * 0.22, 0, 0.35);

      // Drummer striking snare, toms & cymbals at high speed
      ens.drummer.headPivot.rotation.x = Math.sin(time * 14) * 0.26;
      ens.drummer.torsoGroup.rotation.x = 0.12 + Math.abs(Math.sin(time * 12)) * 0.1;
      ens.drummer.leftArmPivot.rotation.set(
        -1.05 + Math.sin(time * 24) * (0.45 + beat * 0.35),
        0,
        0.25
      );
      ens.drummer.rightArmPivot.rotation.set(
        -1.05 + Math.cos(time * 24) * (0.45 + beat * 0.35),
        0,
        -0.25
      );
      ens.kickDrumFront.scale.setScalar(1 + bass * 0.26 + beat * 0.18);
      ens.cymbalLeft.rotation.z = Math.sin(time * 18) * (0.08 + beat * 0.22);
      ens.cymbalRight.rotation.z = -Math.cos(time * 18) * (0.08 + beat * 0.22);
    }

    // 2. BREAK DANCER CREW ANIMATIONS
    ens.breakdancer.group.visible = showBreak;
    ens.breakCypherPad.visible = showBreak;
    ens.bboyCrewLeft.group.visible = style === 'break-dancer';
    ens.bboyCrewRight.group.visible = style === 'break-dancer';

    if (showBreak) {
      const cypherZ = style === 'lolla-headliner' ? -7.8 : -9.4;
      ens.breakCypherPad.position.set(0, 1.42, cypherZ);
      ens.breakCypherPad.scale.setScalar(1 + bass * 0.22 + beat * 0.15);

      // Switch between headspin and flare/windmill every 4 seconds
      const cycle = Math.floor(time * 0.25) % 2;
      if (cycle === 0) {
        // High-speed 3D Windmill / Flare spin
        ens.breakdancer.group.position.set(
          Math.cos(time * 6) * 0.35,
          1.78 + Math.abs(Math.sin(time * 10)) * 0.18,
          cypherZ + Math.sin(time * 6) * 0.35
        );
        ens.breakdancer.group.rotation.set(Math.PI * 0.65, time * 11.5, Math.sin(time * 8) * 0.45);
        ens.breakdancer.leftLegPivot.rotation.set(0.55, 0, 0.85);
        ens.breakdancer.rightLegPivot.rotation.set(-0.55, 0, -0.85);
        ens.breakdancer.leftArmPivot.rotation.set(-0.9, 0, 1.3);
        ens.breakdancer.rightArmPivot.rotation.set(-0.9, 0, -1.3);
      } else {
        // Inverted B-Boy Headspin with wide V-legs
        ens.breakdancer.group.position.set(0, 2.38, cypherZ);
        ens.breakdancer.group.rotation.set(Math.PI, time * 14.0, Math.sin(time * 5) * 0.14);
        ens.breakdancer.leftLegPivot.rotation.set(0, 0, 0.95 + Math.sin(time * 8) * 0.25);
        ens.breakdancer.rightLegPivot.rotation.set(0, 0, -0.95 - Math.sin(time * 8) * 0.25);
        ens.breakdancer.leftArmPivot.rotation.set(-0.4, 0, 1.6);
        ens.breakdancer.rightArmPivot.rotation.set(-0.4, 0, -1.6);
      }

      if (style === 'break-dancer') {
        this.animateAvatarLimbs(ens.bboyCrewLeft, time * 1.35, bass, beat);
        this.animateAvatarLimbs(ens.bboyCrewRight, time * 1.35 + 1.5, bass, beat);
      }
    }

    // 3. CIRQUE AERIAL ACROBATS ANIMATIONS
    ens.acrobatLeftPivot.visible = showAcrobats;
    ens.acrobatRightPivot.visible = showAcrobats;

    if (showAcrobats) {
      const swingL = Math.sin(time * 1.8) * (0.32 + bass * 0.18);
      const swingR = -Math.sin(time * 1.8) * (0.32 + bass * 0.18);
      const verticalBob = Math.sin(time * 2.6) * (0.45 + beat * 0.25);

      ens.acrobatLeftPivot.position.set(-4.8, 5.4 + verticalBob, -11.4);
      ens.acrobatLeftPivot.rotation.z = swingL;
      ens.acrobatLeftPivot.rotation.y = time * 2.4;

      ens.acrobatRightPivot.position.set(4.8, 5.4 - verticalBob, -11.4);
      ens.acrobatRightPivot.rotation.z = swingR;
      ens.acrobatRightPivot.rotation.y = -time * 2.4;

      // Graceful aerial somersault & split pose inside hoop
      ens.acrobatLeft.group.rotation.x = Math.sin(time * 2.2) * 0.85;
      ens.acrobatLeft.leftArmPivot.rotation.z = 2.6;
      ens.acrobatLeft.rightArmPivot.rotation.z = -2.6;
      ens.acrobatLeft.leftLegPivot.rotation.x = 0.85;
      ens.acrobatLeft.rightLegPivot.rotation.x = -0.85;

      ens.acrobatRight.group.rotation.x = -Math.sin(time * 2.2) * 0.85;
      ens.acrobatRight.leftArmPivot.rotation.z = 2.6;
      ens.acrobatRight.rightArmPivot.rotation.z = -2.6;
      ens.acrobatRight.leftLegPivot.rotation.x = -0.85;
      ens.acrobatRight.rightLegPivot.rotation.x = 0.85;
    }
  }

  private animateAvatarLimbs(
    refs: ArticulatedAvatarRefs,
    time: number,
    bass: number,
    beat: number,
    webcamPose?: WebcamPoseMetrics,
    activeAction?: { type: PerformerActionType; timestamp: number } | null
  ) {
    const actionAge = activeAction ? (Date.now() - activeAction.timestamp) / 1000 : 999;
    const isActionActive = actionAge < 2.8;

    if (isActionActive && activeAction) {
      if (activeAction.type === 'scratch') {
        refs.torsoGroup.rotation.x = 0.22;
        refs.torsoGroup.rotation.z = Math.sin(time * 12) * 0.08;
        refs.neckPivot.rotation.y = Math.sin(time * 6) * 0.18;
        refs.headPivot.rotation.x = 0.25 + Math.abs(Math.sin(time * 10)) * 0.14;

        refs.leftArmPivot.rotation.x = -1.35;
        refs.leftArmPivot.rotation.z = 0.55;
        refs.rightArmPivot.rotation.x = -0.95 + Math.sin(time * 24) * 0.22;
        refs.rightArmPivot.rotation.z = -0.25 + Math.cos(time * 24) * 0.28;
        refs.rightHandMesh.rotation.y = Math.sin(time * 28) * 0.6;
      } else if (activeAction.type === 'hands-up' || activeAction.type === 'strobe-blinder') {
        const pump = Math.abs(Math.sin(time * 11)) * 0.35;
        refs.torsoGroup.rotation.x = -0.08 + pump * 0.2;
        refs.torsoGroup.rotation.z = Math.sin(time * 5.5) * 0.12;
        refs.headPivot.rotation.x = -0.15 + pump * 0.25;

        refs.leftArmPivot.rotation.z = 2.65 + pump * 0.4;
        refs.leftArmPivot.rotation.x = -0.25;
        refs.rightArmPivot.rotation.z = -2.65 - pump * 0.4;
        refs.rightArmPivot.rotation.x = -0.25;
      } else if (activeAction.type === 'laser-drop') {
        refs.torsoGroup.rotation.x = -0.12;
        refs.headPivot.rotation.y = Math.sin(time * 4) * 0.35;
        refs.leftArmPivot.rotation.z = 1.65 + Math.sin(time * 7) * 0.65;
        refs.leftArmPivot.rotation.x = -0.6;
        refs.rightArmPivot.rotation.z = -1.65 - Math.sin(time * 7) * 0.65;
        refs.rightArmPivot.rotation.x = -0.6;
      } else if (activeAction.type === 'pyro-burst') {
        refs.torsoGroup.rotation.x = -0.18;
        refs.headPivot.rotation.x = -0.22;
        refs.leftArmPivot.rotation.z = 2.85;
        refs.rightArmPivot.rotation.z = -2.85;
      }
    } else if (webcamPose && webcamPose.active) {
      refs.torsoGroup.rotation.z = -webcamPose.headX * 0.28;
      refs.torsoGroup.rotation.x = webcamPose.headY * 0.2 + beat * 0.08;
      refs.neckPivot.rotation.z = -webcamPose.headX * 0.18;
      refs.headPivot.rotation.y = webcamPose.headX * 0.6;
      refs.headPivot.rotation.x =
        -webcamPose.headY * 0.42 + Math.sin(time * 6) * 0.06;

      refs.leftArmPivot.rotation.z =
        0.35 + webcamPose.leftArmRaise * 2.15 + Math.sin(time * 5) * 0.15;
      refs.leftArmPivot.rotation.x = -0.35 - webcamPose.leftArmRaise * 0.5;

      refs.rightArmPivot.rotation.z =
        -0.35 - webcamPose.rightArmRaise * 2.15 - Math.cos(time * 5) * 0.15;
      refs.rightArmPivot.rotation.x = -0.35 - webcamPose.rightArmRaise * 0.5;
    } else {
      const groove = time * 5.2;
      refs.torsoGroup.rotation.z = Math.sin(groove * 0.5) * 0.1;
      refs.torsoGroup.rotation.x =
        Math.abs(Math.sin(groove)) * (0.06 + bass * 0.12);
      refs.neckPivot.rotation.z = Math.sin(groove * 0.5) * 0.06;

      refs.headPivot.rotation.y = Math.sin(groove * 0.5) * 0.22;
      refs.headPivot.rotation.x = Math.sin(groove) * (0.1 + bass * 0.18);

      refs.leftArmPivot.rotation.z =
        0.55 + Math.sin(groove) * (0.65 + bass * 0.55) + beat * 0.35;
      refs.leftArmPivot.rotation.x = -0.45 + Math.cos(groove * 0.5) * 0.25;

      refs.rightArmPivot.rotation.z =
        -0.55 - Math.cos(groove) * (0.65 + bass * 0.55) - beat * 0.35;
      refs.rightArmPivot.rotation.x = -0.45 + Math.sin(groove * 0.5) * 0.25;
    }

    refs.leftLegPivot.rotation.x = Math.sin(time * 5.2) * 0.24;
    refs.rightLegPivot.rotation.x = -Math.sin(time * 5.2) * 0.24;

    refs.auraRing.rotation.z = time * 1.4;
    refs.auraRing.scale.setScalar(1 + bass * 0.25 + beat * 0.15);
    refs.auraOuterRing.rotation.y = -time * 1.1;
    refs.auraOuterRing.rotation.x = Math.PI / 3 + Math.sin(time) * 0.2;

    if (refs.holoBillboardMesh) {
      refs.holoBillboardMesh.position.y = 3.35 + Math.sin(time * 2.4) * 0.12;
      refs.holoBillboardMesh.scale.setScalar(1 + bass * 0.16 + beat * 0.12);
    }
  }

  private buildArticulatedAvatar(
    cfg: AvatarConfig,
    role: 'crowd' | 'stage-performer' | 'remote',
    hash: string
  ): ArticulatedAvatarRefs {
    const group = new THREE.Group();
    group.position.set(cfg.position[0], cfg.position[1], cfg.position[2]);
    group.rotation.y = cfg.rotationY;

    const skinHex = cfg.skinColor || '#E2B897';
    const hairHex = cfg.hairColor || '#1E1B4B';
    const faceMode = cfg.faceTextureMode || 'snapshot';

    const outfitMat = new THREE.MeshPhysicalMaterial({
      color: cfg.outfitColor,
      emissive: cfg.outfitColor,
      emissiveIntensity: role === 'stage-performer' ? 0.55 : 0.32,
      roughness: 0.22,
      metalness: 0.45,
      clearcoat: 1.0,
      iridescence: 0.75,
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: cfg.accentColor,
      emissive: cfg.accentColor,
      emissiveIntensity: 1.4,
      roughness: 0.18,
      metalness: 0.3,
    });

    const darkSuitMat = new THREE.MeshStandardMaterial({
      color: '#0D1326',
      roughness: 0.32,
      metalness: 0.78,
    });

    const skinMat = new THREE.MeshPhysicalMaterial({
      color: skinHex,
      roughness: 0.36,
      metalness: 0.08,
      clearcoat: 0.35,
      sheen: 0.25,
    });

    const hairMat = new THREE.MeshStandardMaterial({
      color: hairHex,
      roughness: 0.42,
      metalness: 0.25,
    });

    // 1. Left & Right Articulated Legs + Cyber Boots
    const legGeo = new THREE.CapsuleGeometry(0.095, 0.46, 6, 10);
    legGeo.translate(0, -0.25, 0);

    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.14, 0.62, 0);
    const leftLeg = new THREE.Mesh(legGeo, darkSuitMat);
    const leftBoot = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.11, 0.25),
      accentMat
    );
    leftBoot.position.set(0, -0.52, 0.04);
    leftLegPivot.add(leftLeg, leftBoot);
    group.add(leftLegPivot);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.14, 0.62, 0);
    const rightLeg = new THREE.Mesh(legGeo, darkSuitMat);
    const rightBoot = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.11, 0.25),
      accentMat
    );
    rightBoot.position.set(0, -0.52, 0.04);
    rightLegPivot.add(rightLeg, rightBoot);
    group.add(rightLegPivot);

    // 2. Sculpted Torso Group + Chest Reactor Heart + Shoulder Pauldrons
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 0.62, 0);

    const torsoPoints = [
      new THREE.Vector2(0.01, 0),
      new THREE.Vector2(0.18, 0.05),
      new THREE.Vector2(0.15, 0.28),
      new THREE.Vector2(0.27, 0.62),
      new THREE.Vector2(0.21, 0.72),
      new THREE.Vector2(0.09, 0.76),
    ];
    const torsoMesh = new THREE.Mesh(
      new THREE.LatheGeometry(torsoPoints, 16),
      outfitMat
    );
    torsoMesh.castShadow = true;
    torsoGroup.add(torsoMesh);

    const coreMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.11, 0),
      accentMat
    );
    coreMesh.position.set(0, 0.48, 0.22);
    coreMesh.scale.set(1, 1.2, 0.45);
    torsoGroup.add(coreMesh);

    const shoulderGeo = new THREE.SphereGeometry(0.13, 12, 10);
    shoulderGeo.scale(1.2, 0.65, 1.0);
    [-0.29, 0.29].forEach((sx) => {
      const pad = new THREE.Mesh(shoulderGeo, accentMat);
      pad.position.set(sx, 0.64, 0);
      torsoGroup.add(pad);
    });

    // 3. Articulated Left & Right Arms + Sculpted Hands + LED Wristbands
    const armGeo = new THREE.CapsuleGeometry(0.068, 0.42, 6, 10);
    armGeo.translate(0, -0.21, 0);

    const wristBandGeo = new THREE.TorusGeometry(0.065, 0.02, 8, 18);
    wristBandGeo.rotateX(Math.PI / 2);

    const handGeo = new THREE.SphereGeometry(0.072, 10, 10);
    handGeo.scale(0.85, 1.15, 0.65);

    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.31, 0.62, 0);
    const leftArm = new THREE.Mesh(armGeo, outfitMat);
    const leftWristBand = new THREE.Mesh(wristBandGeo, accentMat);
    leftWristBand.position.set(0, -0.42, 0);
    const leftHandMesh = new THREE.Mesh(handGeo, skinMat);
    leftHandMesh.position.set(0, -0.49, 0.02);
    leftArmPivot.add(leftArm, leftWristBand, leftHandMesh);
    torsoGroup.add(leftArmPivot);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.31, 0.62, 0);
    const rightArm = new THREE.Mesh(armGeo, outfitMat);
    const rightWristBand = new THREE.Mesh(wristBandGeo, accentMat);
    rightWristBand.position.set(0, -0.42, 0);
    const rightHandMesh = new THREE.Mesh(handGeo, skinMat);
    rightHandMesh.position.set(0, -0.49, 0.02);
    rightArmPivot.add(rightArm, rightWristBand, rightHandMesh);
    torsoGroup.add(rightArmPivot);

    // 4. Articulated Neck + True Sculpted 3D Head Reconstruction
    const neckPivot = new THREE.Group();
    neckPivot.position.set(0, 0.76, 0);

    const neckMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.078, 0.092, 0.14, 12),
      skinMat
    );
    neckMesh.position.y = 0.05;
    neckPivot.add(neckMesh);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.1, 0);

    const headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.225, 24, 24),
      skinMat
    );
    headMesh.scale.set(0.92, 1.08, 0.98);
    headMesh.position.y = 0.18;
    headPivot.add(headMesh);

    const noseGeo = new THREE.ConeGeometry(0.036, 0.095, 6);
    noseGeo.rotateX(Math.PI * 0.42);
    const noseMesh = new THREE.Mesh(noseGeo, skinMat);
    noseMesh.position.set(0, 0.175, 0.225);
    headPivot.add(noseMesh);

    const earGeo = new THREE.SphereGeometry(0.048, 8, 8);
    earGeo.scale(0.45, 1.15, 0.75);
    [-0.21, 0.21].forEach((ex) => {
      const ear = new THREE.Mesh(earGeo, skinMat);
      ear.position.set(ex, 0.18, 0);
      headPivot.add(ear);
    });

    if (
      role !== 'remote' &&
      (cfg.hasScannedFace || cfg.webcamStageEnabled) &&
      faceMode !== 'stylized'
    ) {
      const faceShellGeo = new THREE.SphereGeometry(
        0.229,
        24,
        20,
        Math.PI * 0.16,
        Math.PI * 0.68,
        Math.PI * 0.22,
        Math.PI * 0.58
      );
      faceShellGeo.rotateY(-Math.PI * 0.5);

      const uvAttr = faceShellGeo.attributes.uv;
      for (let i = 0; i < uvAttr.count; i++) {
        const u = uvAttr.getX(i);
        const v = uvAttr.getY(i);
        uvAttr.setXY(
          i,
          THREE.MathUtils.clamp((u - 0.08) / 0.84, 0, 1),
          THREE.MathUtils.clamp((v - 0.2) / 0.6, 0, 1)
        );
      }
      uvAttr.needsUpdate = true;

      const faceMat = new THREE.MeshStandardMaterial({
        map: sharedWebcamBridge.getFaceTexture(faceMode),
        roughness: 0.34,
        metalness: 0.05,
        emissive: '#FFFFFF',
        emissiveMap: sharedWebcamBridge.getFaceTexture(faceMode),
        emissiveIntensity: faceMode === 'live-video' ? 0.42 : 0.24,
      });
      const faceShellMesh = new THREE.Mesh(faceShellGeo, faceMat);
      faceShellMesh.scale.set(0.92, 1.08, 0.98);
      faceShellMesh.position.y = 0.18;
      headPivot.add(faceShellMesh);
    } else {
      const eyeWhiteGeo = new THREE.SphereGeometry(0.032, 10, 10);
      const eyePupilGeo = new THREE.SphereGeometry(0.018, 8, 8);
      const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: '#F8FAFC' });
      [-0.072, 0.072].forEach((ex) => {
        const eyeW = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
        eyeW.scale.set(1.2, 0.85, 0.6);
        eyeW.position.set(ex, 0.21, 0.198);
        const pupil = new THREE.Mesh(eyePupilGeo, accentMat);
        pupil.position.set(ex, 0.21, 0.214);
        headPivot.add(eyeW, pupil);
      });
    }

    // 5. Layered 3D Hair Geometry
    if (cfg.hairStyle === 'mohawk') {
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.055, 0.18 + (2 - Math.abs(i - 2)) * 0.04, 6),
          i % 2 === 0 ? hairMat : accentMat
        );
        spike.position.set(0, 0.41 - Math.abs(i - 2) * 0.03, 0.12 - i * 0.07);
        spike.rotation.x = (2 - i) * 0.22;
        headPivot.add(spike);
      }
    } else if (cfg.hairStyle === 'crown') {
      const baseCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.228, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.46),
        hairMat
      );
      baseCap.position.set(0, 0.2, 0);
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.23, 0.18, 0.15, 8),
        accentMat
      );
      crown.position.set(0, 0.42, 0);
      headPivot.add(baseCap, crown);
    } else if (cfg.hairStyle === 'bob') {
      const hairCap = new THREE.Mesh(
        new THREE.SphereGeometry(
          0.242,
          18,
          14,
          Math.PI * 0.18,
          Math.PI * 1.64,
          0,
          Math.PI * 0.68
        ),
        hairMat
      );
      hairCap.rotation.y = Math.PI * 0.5;
      hairCap.position.set(0, 0.2, -0.01);
      headPivot.add(hairCap);
    } else {
      const fadeCap = new THREE.Mesh(
        new THREE.SphereGeometry(
          0.232,
          18,
          12,
          0,
          Math.PI * 2,
          0,
          Math.PI * 0.42
        ),
        hairMat
      );
      fadeCap.scale.set(0.94, 1.08, 1.02);
      fadeCap.position.set(0, 0.2, -0.01);
      headPivot.add(fadeCap);
    }

    // 6. Accessories
    if (
      cfg.accessory === 'visor' &&
      !cfg.hasScannedFace &&
      !cfg.webcamStageEnabled
    ) {
      const visor = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.225,
          0.225,
          0.085,
          16,
          1,
          false,
          -Math.PI * 0.35,
          Math.PI * 0.7
        ),
        accentMat
      );
      visor.rotation.y = Math.PI;
      visor.position.set(0, 0.21, 0.02);
      headPivot.add(visor);
    } else if (cfg.accessory === 'halo') {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.3, 0.03, 8, 28),
        accentMat
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.set(0, 0.54, 0);
      headPivot.add(halo);
    } else if (cfg.accessory === 'headphones' || role === 'stage-performer') {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.245, 0.03, 8, 24, Math.PI),
        accentMat
      );
      band.position.set(0, 0.2, 0);
      const earCupGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 14);
      earCupGeo.rotateZ(Math.PI / 2);
      [-0.235, 0.235].forEach((cx) => {
        const cup = new THREE.Mesh(earCupGeo, accentMat);
        cup.position.set(cx, 0.18, 0);
        headPivot.add(cup);
      });
      headPivot.add(band);
    }

    neckPivot.add(headPivot);
    torsoGroup.add(neckPivot);
    group.add(torsoGroup);

    // 7. Surreal Orbital Energy Rings around Avatar
    const auraRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.02, 8, 36),
      accentMat
    );
    auraRing.rotation.x = Math.PI / 2;
    auraRing.position.y = 0.06;
    group.add(auraRing);

    const auraOuterRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.015, 8, 36),
      outfitMat
    );
    auraOuterRing.position.y = 1.05;
    group.add(auraOuterRing);

    let holoBillboardMesh: THREE.Mesh | null = null;
    if (role === 'stage-performer' && cfg.webcamStageEnabled) {
      const frameRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.35, 0.035, 10, 40),
        accentMat
      );
      frameRing.position.set(0, 2.2, -0.45);
      holoBillboardMesh = frameRing;
      group.add(frameRing);
    }

    return {
      group,
      hash,
      torsoGroup,
      neckPivot,
      headPivot,
      leftArmPivot,
      rightArmPivot,
      leftHandMesh,
      rightHandMesh,
      leftLegPivot,
      rightLegPivot,
      auraRing,
      auraOuterRing,
      holoBillboardMesh,
    };
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
