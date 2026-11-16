import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CameraKeyframe,
  CameraMode,
  EmoteType,
  EnvironmentId,
  GraphicsProfile,
  StageFloorMaterial,
  TimeOfDay,
  VisualFxBurstEvent,
  VisualFxConfig,
} from '../types/festival';
import { ENVIRONMENTS } from '../data/presets';
import { sharedAudioEngine } from '../audio/AudioEngine';
import { useFestivalStore } from '../store/useFestivalStore';
import {
  createFloorOverlayMaterial,
  createSkyDomeMaterial,
  createVolumetricConeMaterial,
} from './shaders';
import { buildEnvironmentScenery, EnvironmentSceneResult } from './environmentBuilder';
import { buildStageItemGroup, BuiltStageObject } from './stageModels';
import { CrowdSystem } from './crowdSystem';
import { sharedWebcamBridge } from './webcamBridge';

// Reusable module-scope math helpers (zero GC inside animation loop)
const _vec3 = new THREE.Vector3();
const _targetVec3 = new THREE.Vector3();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _ndc = new THREE.Vector2();
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
const _strobeColor = new THREE.Color('#FFFFFF');

function detectSoftwareWebGL(): { supported: boolean; isSoftwareGl: boolean } {
  try {
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
    if (!gl) return { supported: false, isSoftwareGl: true };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const isSoftware = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return { supported: true, isSoftwareGl: isSoftware };
  } catch {
    return { supported: false, isSoftwareGl: true };
  }
}

export class CrowdStageEngine {
  private container: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;

  private isSoftwareGl = false;
  private frameId = 0;
  private disposed = false;
  private clock = new THREE.Clock();

  private skyMesh!: THREE.Mesh;
  private skyMat!: THREE.ShaderMaterial;
  private floorOverlayMat!: THREE.ShaderMaterial;
  private floorOverlayMesh!: THREE.Mesh;

  private hemiLight!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private spotLeft!: THREE.SpotLight;
  private spotRight!: THREE.SpotLight;
  private stagePointLight!: THREE.PointLight;
  private strobeLight!: THREE.PointLight;

  // Volumetric Spotlight Cones
  private volConeLeft!: THREE.Mesh;
  private volConeRight!: THREE.Mesh;
  private volConeMatLeft!: THREE.ShaderMaterial;
  private volConeMatRight!: THREE.ShaderMaterial;

  // "Beam to Stage" Teleportation Pillar & Shockwave
  private beamPillarMesh!: THREE.Mesh;
  private beamRingMesh!: THREE.Mesh;
  private beamActiveUntil = 0;
  private strobeBurstUntil = 0;
  private lastBeamTimestamp = 0;
  private lastActionTimestamp = 0;
  private lastVisualFxTimestamp = 0;
  private lastAutoBeatFxTime = 0;

  private spectrumData = new Uint8Array(64 * 4);
  private spectrumTex!: THREE.DataTexture;

  private envResult: EnvironmentSceneResult | null = null;
  private currentEnvId: EnvironmentId | null = null;
  private currentFloorMat: StageFloorMaterial | null = null;

  private stageObjects = new Map<string, { itemHash: string; built: BuiltStageObject }>();
  private stageRoot = new THREE.Group();

  private crowdSystem!: CrowdSystem;

  private particles!: THREE.Points;
  private particlePositions!: Float32Array;
  private maxParticles = 1100;
  private activeParticles = 550;

  private emoteParticles: Array<{
    mesh: THREE.Mesh;
    vx: number;
    vy: number;
    vz: number;
    gravity: number;
    spinSpeed: number;
    scaleGrowth: number;
    life: number;
    maxLife: number;
  }> = [];
  private lastEmoteTimestamp = 0;

  private raycaster = new THREE.Raycaster();
  private draggingItemId: string | null = null;
  private dragOffset = new THREE.Vector3();
  private pointerDownPos = new THREE.Vector2();
  private didDragMove = false;

  // Camera director state
  private cameraTargetPos = new THREE.Vector3(0, 9.5, 24);
  private cameraTargetLook = new THREE.Vector3(0, 3.2, -9);
  private cameraTransitionActive = false;
  private lastCameraMode: CameraMode = 'orbit';
  private seqIndex = 0;
  private seqTimer = 0;
  private autoDirectorTimer = 0;
  private autoDirectorShotIndex = 0;

  // Performance monitor
  private fpsFrames = 0;
  private fpsAccum = 0;
  private lowFpsStrikes = 0;
  private lastUiAudioSync = 0;
  private lastProfileApplied: GraphicsProfile | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    const probe = detectSoftwareWebGL();
    if (!probe.supported) {
      useFestivalStore.getState().setWebglStatus(false, false);
      return;
    }
    this.isSoftwareGl = probe.isSoftwareGl;
    this.initRendererAndScene();
    this.bindEvents();
    this.syncFromStore(true);
    this.startLoop();
  }

  private initRendererAndScene() {
    const width = Math.max(300, this.container.clientWidth);
    const height = Math.max(240, this.container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true, // supports snapshot capture / sharing
    });
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2('#0C0F29', 0.012);

    // Procedural Studio Reflection Environment
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(56, width / height, 0.25, 260);
    this.camera.position.set(0, 9.5, 24);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI * 0.485;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 68;
    this.controls.target.set(0, 3.2, -9);

    this.controls.addEventListener('start', () => {
      this.cameraTransitionActive = false;
      const st = useFestivalStore.getState();
      if (st.autoDirectorEnabled) {
        st.setAutoDirectorEnabled(false);
      }
      if (st.cameraMode !== 'orbit') {
        st.setCameraMode('orbit');
      }
    });

    // Spectrum DataTexture (64x1 RGBA) for custom GLSL shaders
    for (let i = 0; i < 64; i++) {
      this.spectrumData[i * 4 + 3] = 255;
    }
    this.spectrumTex = new THREE.DataTexture(this.spectrumData, 64, 1, THREE.RGBAFormat);
    this.spectrumTex.needsUpdate = true;

    // Sky Dome
    this.skyMat = createSkyDomeMaterial();
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(145, 32, 24), this.skyMat);
    this.scene.add(this.skyMesh);

    // Floor Audio-Reactive Overlay
    this.floorOverlayMat = createFloorOverlayMaterial('#00E5FF', '#FF3CAC');
    const overlayGeo = new THREE.PlaneGeometry(110, 110);
    overlayGeo.rotateX(-Math.PI / 2);
    this.floorOverlayMesh = new THREE.Mesh(overlayGeo, this.floorOverlayMat);
    this.floorOverlayMesh.position.y = 0.03;
    this.scene.add(this.floorOverlayMesh);

    // Lighting Rig
    this.hemiLight = new THREE.HemisphereLight('#7DD3FC', '#1E1B4B', 0.72);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight('#FFEAD5', 1.2);
    this.keyLight.position.set(18, 28, 22);
    if (!this.isSoftwareGl) {
      this.keyLight.castShadow = true;
      this.keyLight.shadow.mapSize.set(1024, 1024);
      this.keyLight.shadow.camera.left = -26;
      this.keyLight.shadow.camera.right = 26;
      this.keyLight.shadow.camera.top = 26;
      this.keyLight.shadow.camera.bottom = -26;
      this.keyLight.shadow.bias = -0.0005;
      this.keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.keyLight);

    this.spotLeft = new THREE.SpotLight('#00E5FF', 48, 65, Math.PI / 6, 0.45, 1.3);
    this.spotLeft.position.set(-10, 12, -10);
    this.spotLeft.target.position.set(0, 0, 2);
    this.scene.add(this.spotLeft, this.spotLeft.target);

    this.spotRight = new THREE.SpotLight('#FF3CAC', 48, 65, Math.PI / 6, 0.45, 1.3);
    this.spotRight.position.set(10, 12, -10);
    this.spotRight.target.position.set(0, 0, 2);
    this.scene.add(this.spotRight, this.spotRight.target);

    this.stagePointLight = new THREE.PointLight('#8B5CF6', 20, 38, 1.4);
    this.stagePointLight.position.set(0, 5, -10);
    this.scene.add(this.stagePointLight);

    // Dedicated High-Power Stage Strobe Blinder Light
    this.strobeLight = new THREE.PointLight('#FFFFFF', 0, 95, 1.1);
    this.strobeLight.position.set(0, 9.8, -8.5);
    this.scene.add(this.strobeLight);

    // Volumetric Spotlight Cones (Fresnel-faded additive volumetric beams)
    const coneGeo = new THREE.ConeGeometry(4.4, 22, 24, 1, true);
    coneGeo.translate(0, -11, 0);
    coneGeo.rotateX(-Math.PI / 2);

    this.volConeMatLeft = createVolumetricConeMaterial('#00E5FF');
    this.volConeMatRight = createVolumetricConeMaterial('#FF3CAC');
    this.volConeLeft = new THREE.Mesh(coneGeo, this.volConeMatLeft);
    this.volConeRight = new THREE.Mesh(coneGeo, this.volConeMatRight);
    this.volConeLeft.position.copy(this.spotLeft.position);
    this.volConeRight.position.copy(this.spotRight.position);
    this.scene.add(this.volConeLeft, this.volConeRight);

    // "Beam to Stage" Teleportation Light Pillar & Shockwave Ring at Stage DJ Booth (0, y, -11.2)
    const beamPillarGeo = new THREE.CylinderGeometry(1.1, 1.8, 18, 28, 1, true);
    beamPillarGeo.translate(0, 9, 0);
    const beamPillarMat = new THREE.MeshBasicMaterial({
      color: '#00E5FF',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.beamPillarMesh = new THREE.Mesh(beamPillarGeo, beamPillarMat);
    this.beamPillarMesh.position.set(0, 0.5, -11.2);
    this.beamPillarMesh.visible = false;
    this.scene.add(this.beamPillarMesh);

    const beamRingGeo = new THREE.RingGeometry(0.8, 1.35, 36);
    beamRingGeo.rotateX(-Math.PI / 2);
    const beamRingMat = new THREE.MeshBasicMaterial({
      color: '#FF3CAC',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.beamRingMesh = new THREE.Mesh(beamRingGeo, beamRingMat);
    this.beamRingMesh.position.set(0, 1.25, -11.2);
    this.beamRingMesh.visible = false;
    this.scene.add(this.beamRingMesh);

    this.scene.add(this.stageRoot);

    // Crowd System + Main Event Ensemble
    this.crowdSystem = new CrowdSystem();
    this.scene.add(this.crowdSystem.group);

    // Procedural Atmospheric Particles
    const pGeo = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(this.maxParticles * 3);
    for (let i = 0; i < this.maxParticles; i++) {
      this.particlePositions[i * 3] = (Math.random() - 0.5) * 60;
      this.particlePositions[i * 3 + 1] = Math.random() * 20 + 0.5;
      this.particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: '#00E5FF',
      size: 0.2,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.particles = new THREE.Points(pGeo, pMat);
    this.scene.add(this.particles);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private bindEvents() {
    window.addEventListener('resize', this.handleResize);
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.handlePointerDown);
    dom.addEventListener('pointermove', this.handlePointerMove);
    dom.addEventListener('pointerup', this.handlePointerUp);
    dom.addEventListener('webglcontextlost', this.handleContextLost);
    dom.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    useFestivalStore.getState().setWebglStatus(true, true);
  };

  private handleContextRestored = () => {
    useFestivalStore.getState().setWebglStatus(true, false);
  };

  private handleResize = () => {
    if (this.disposed || !this.container) return;
    const width = Math.max(300, this.container.clientWidth);
    const height = Math.max(240, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private updateNdc(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  private handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this.pointerDownPos.set(e.clientX, e.clientY);
    this.didDragMove = false;
    this.updateNdc(e.clientX, e.clientY);

    this.raycaster.layers.set(1);
    this.raycaster.setFromCamera(_ndc, this.camera);

    const hitboxes: THREE.Object3D[] = [];
    this.stageObjects.forEach((entry) => hitboxes.push(entry.built.hitbox));
    const hits = this.raycaster.intersectObjects(hitboxes, false);

    const store = useFestivalStore.getState();
    if (hits.length > 0) {
      const hitId = hits[0].object.userData.itemId as string;
      const item = store.project.stageItems.find((i) => i.id === hitId);
      if (item && store.selectedItemId === hitId && !store.room.lockedEdits) {
        this.draggingItemId = hitId;
        this.controls.enabled = false;
        if (this.raycaster.ray.intersectPlane(_groundPlane, _vec3)) {
          this.dragOffset.set(
            item.position[0] - _vec3.x,
            0,
            item.position[2] - _vec3.z
          );
        }
      }
    }
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.draggingItemId) return;
    const dist = Math.hypot(
      e.clientX - this.pointerDownPos.x,
      e.clientY - this.pointerDownPos.y
    );
    if (dist > 4) this.didDragMove = true;

    this.updateNdc(e.clientX, e.clientY);
    this.raycaster.setFromCamera(_ndc, this.camera);
    if (this.raycaster.ray.intersectPlane(_groundPlane, _vec3)) {
      const nx = Math.max(-32, Math.min(32, Math.round((_vec3.x + this.dragOffset.x) * 4) / 4));
      const nz = Math.max(-32, Math.min(24, Math.round((_vec3.z + this.dragOffset.z) * 4) / 4));
      useFestivalStore.getState().updateStageItem(this.draggingItemId, {
        position: [nx, 0, nz],
      });
    }
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (this.draggingItemId) {
      this.draggingItemId = null;
      this.controls.enabled = true;
      if (this.didDragMove) {
        useFestivalStore.getState().bumpLiveInteraction(2);
        return;
      }
    }

    const moveDist = Math.hypot(
      e.clientX - this.pointerDownPos.x,
      e.clientY - this.pointerDownPos.y
    );
    if (moveDist > 7) return;

    this.updateNdc(e.clientX, e.clientY);
    this.raycaster.layers.set(1);
    this.raycaster.setFromCamera(_ndc, this.camera);
    const hitboxes: THREE.Object3D[] = [];
    this.stageObjects.forEach((entry) => hitboxes.push(entry.built.hitbox));
    const hits = this.raycaster.intersectObjects(hitboxes, false);

    const store = useFestivalStore.getState();
    if (hits.length > 0) {
      const hitId = hits[0].object.userData.itemId as string;
      const item = store.project.stageItems.find((i) => i.id === hitId);
      if (item?.category === 'portal' && store.selectedItemId === hitId && item.portalTargetEnv) {
        store.switchEnvironment(item.portalTargetEnv, true);
        store.showToast(`Entered Portal → ${item.portalTargetEnv.replace('-', ' ')}`);
        return;
      }
      store.selectItem(hitId);
    } else if (store.selectedItemId) {
      store.selectItem(null);
    }
  };

  public captureCurrentKeyframe(name: string): CameraKeyframe {
    return {
      id: `cam-${Date.now().toString(36)}`,
      name,
      position: [
        Math.round(this.camera.position.x * 10) / 10,
        Math.round(this.camera.position.y * 10) / 10,
        Math.round(this.camera.position.z * 10) / 10,
      ],
      target: [
        Math.round(this.controls.target.x * 10) / 10,
        Math.round(this.controls.target.y * 10) / 10,
        Math.round(this.controls.target.z * 10) / 10,
      ],
      duration: 3.5,
    };
  }

  public captureSnapshotDataUrl(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  private applyTimeOfDayAndEnvironment(env: EnvironmentId, timeOfDay: TimeOfDay) {
    const meta = ENVIRONMENTS.find((e) => e.id === env) ?? ENVIRONMENTS[0];

    let topCol = meta.skyTop;
    let horCol = meta.skyHorizon;
    let fogCol = meta.fogColor;
    let starInt = 0.95;
    let sunElev = -0.05;
    let keyInt = 1.05;

    if (timeOfDay === 'sunrise') {
      topCol = '#1D2B64';
      horCol = '#F89B6C';
      fogCol = '#6A4E6E';
      starInt = 0.25;
      sunElev = 0.14;
      keyInt = 1.45;
    } else if (timeOfDay === 'sunset') {
      topCol = '#1F1235';
      horCol = '#DF4B57';
      fogCol = '#47213E';
      starInt = 0.45;
      sunElev = 0.06;
      keyInt = 1.3;
    } else if (timeOfDay === 'futuristic') {
      topCol = '#090D2E';
      horCol = '#2A1859';
      fogCol = '#151238';
      starInt = 1.0;
      sunElev = 0.22;
      keyInt = 1.25;
    }

    this.skyMat.uniforms.uTopColor.value.set(topCol);
    this.skyMat.uniforms.uHorizonColor.value.set(horCol);
    this.skyMat.uniforms.uStarIntensity.value = starInt;
    this.skyMat.uniforms.uSunElevation.value = sunElev;

    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.set(fogCol);
    }
    this.keyLight.intensity = keyInt;
  }

  private setCameraShotTarget(mode: CameraMode) {
    if (mode === 'wide-stage') {
      this.cameraTargetPos.set(0, 11, 26);
      this.cameraTargetLook.set(0, 3.5, -11);
      this.cameraTransitionActive = true;
    } else if (mode === 'crowd-pov') {
      this.cameraTargetPos.set(0, 2.1, 8.5);
      this.cameraTargetLook.set(0, 4.2, -13);
      this.cameraTransitionActive = true;
    } else if (mode === 'dj-booth') {
      this.cameraTargetPos.set(2.8, 3.6, -13.2);
      this.cameraTargetLook.set(0, 1.8, 6);
      this.cameraTransitionActive = true;
    } else if (mode === 'stage-closeup') {
      this.cameraTargetPos.set(0, 3.35, -5.8);
      this.cameraTargetLook.set(0, 2.75, -11.2);
      this.cameraTransitionActive = true;
    } else if (mode === 'drone') {
      this.cameraTransitionActive = false;
    }
  }

  private syncFromStore(forceEnv = false) {
    const state = useFestivalStore.getState();
    const { project, selectedItemId, graphicsProfile, cameraMode } = state;
    const floorMaterial: StageFloorMaterial =
      project.lighting.stageFloorMaterial || 'gridded-cyber-neon';

    // 1. Graphics profile & crowd/particle limits
    if (this.lastProfileApplied !== graphicsProfile) {
      this.lastProfileApplied = graphicsProfile;
      this.activeParticles =
        graphicsProfile === 'low' ? 220 : graphicsProfile === 'balanced' ? 550 : 1100;
      this.particles.geometry.setDrawRange(0, this.activeParticles);
      if (!this.isSoftwareGl) {
        const pr =
          graphicsProfile === 'low'
            ? 1
            : graphicsProfile === 'balanced'
              ? Math.min(window.devicePixelRatio, 1.5)
              : Math.min(window.devicePixelRatio, 2);
        this.renderer.setPixelRatio(pr);
      }
    }
    this.crowdSystem.setProfileAndDensity(graphicsProfile, project.crowd.density);

    // 2. Environment scenery & StageFloorMaterial rebuild when environment or floor material changes
    if (
      forceEnv ||
      this.currentEnvId !== project.environment ||
      this.currentFloorMat !== floorMaterial
    ) {
      if (this.envResult) {
        this.scene.remove(this.envResult.group);
        this.envResult.dispose();
      }
      this.envResult = buildEnvironmentScenery(
        project.environment,
        this.renderer.capabilities.getMaxAnisotropy(),
        floorMaterial
      );
      this.scene.add(this.envResult.group);
      this.currentEnvId = project.environment;
      this.currentFloorMat = floorMaterial;

      const envIndex = [
        'neon-cyberpunk',
        'desert-festival',
        'floating-island',
        'futuristic-indian',
        'underwater-concert',
      ].indexOf(project.environment);
      this.floorOverlayMat.uniforms.uMode.value = Math.max(0, envIndex);

      const floorStyleIdx =
        floorMaterial === 'reflective-water'
          ? 0
          : floorMaterial === 'polished-obsidian'
            ? 1
            : 2;
      this.floorOverlayMat.uniforms.uFloorStyle.value = floorStyleIdx;
    }

    this.applyTimeOfDayAndEnvironment(project.environment, project.timeOfDay);

    // Update shader colors & fog density
    this.skyMat.uniforms.uAccentColor.value.set(project.lighting.primaryColor);
    this.skyMat.uniforms.uSecondaryColor.value.set(project.lighting.secondaryColor);
    this.floorOverlayMat.uniforms.uPrimary.value.set(project.lighting.primaryColor);
    this.floorOverlayMat.uniforms.uSecondary.value.set(project.lighting.secondaryColor);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = project.lighting.fogDensity;
    }

    // 3. Diff stage items (including floorMaterial hash so stage deck updates immediately)
    const activeIds = new Set(project.stageItems.map((i) => i.id));
    for (const [id, entry] of this.stageObjects.entries()) {
      if (!activeIds.has(id)) {
        this.stageRoot.remove(entry.built.group);
        entry.built.dispose();
        this.stageObjects.delete(id);
      }
    }

    for (const item of project.stageItems) {
      const styleHash = `${item.type}|${item.primaryColor}|${item.secondaryColor}|${floorMaterial}`;
      const existing = this.stageObjects.get(item.id);
      if (!existing || existing.itemHash !== styleHash) {
        if (existing) {
          this.stageRoot.remove(existing.built.group);
          existing.built.dispose();
        }
        const built = buildStageItemGroup(item, this.spectrumTex, floorMaterial);
        this.stageRoot.add(built.group);
        this.stageObjects.set(item.id, { itemHash: styleHash, built });
      }
      const entry = this.stageObjects.get(item.id)!;
      entry.built.group.position.set(item.position[0], item.position[1], item.position[2]);
      entry.built.group.rotation.y = item.rotationY;
      entry.built.group.scale.setScalar(item.scale);
      entry.built.selectionRing.visible = item.id === selectedItemId;
    }

    // 4. Camera Mode target transitions
    if (cameraMode !== this.lastCameraMode) {
      this.lastCameraMode = cameraMode;
      this.setCameraShotTarget(cameraMode);
    }
  }

  private spawnEmoteBurst(type: EmoteType) {
    const colorMap: Record<EmoteType, string> = {
      heart: '#FF3CAC',
      fire: '#FF7B29',
      hands: '#00E5FF',
      star: '#FFB703',
    };
    const geo =
      type === 'star'
        ? new THREE.OctahedronGeometry(0.28, 0)
        : type === 'fire'
          ? new THREE.ConeGeometry(0.22, 0.45, 6)
          : new THREE.SphereGeometry(0.22, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: colorMap[type],
      transparent: true,
      opacity: 0.95,
    });

    const avatarPos = useFestivalStore.getState().avatar.position;
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(
        avatarPos[0] + (Math.random() - 0.5) * 1.4,
        1.8 + Math.random() * 0.5,
        avatarPos[2] + (Math.random() - 0.5) * 1.4
      );
      this.scene.add(m);
      this.emoteParticles.push({
        mesh: m,
        vx: (Math.random() - 0.5) * 0.6,
        vy: 1.6 + Math.random() * 1.2,
        vz: (Math.random() - 0.5) * 0.6,
        gravity: 0.4,
        spinSpeed: 3.0,
        scaleGrowth: 0,
        life: 1.5,
        maxLife: 1.5,
      });
    }
  }

  private spawnStagePyroOrTeleportBurst(mode: 'beam' | 'pyro', primaryHex: string, secondaryHex: string) {
    this.spawnCustomVisualFxBurst({
      effectType: mode === 'pyro' ? 'pyrotechnics' : 'spark-fountain',
      density: mode === 'pyro' ? 1.15 : 0.9,
      primaryColor: primaryHex,
      secondaryColor: secondaryHex,
      spread: 1.0,
      velocity: 1.15,
      autoBeatTrigger: false,
    });
  }

  private spawnCustomVisualFxBurst(cfg: VisualFxConfig | VisualFxBurstEvent, elapsedNow = 0) {
    // Cap total active transient particles for steady 60 FPS
    if (this.emoteParticles.length > 260) {
      const excess = this.emoteParticles.splice(0, 60);
      excess.forEach((p) => this.scene.remove(p.mesh));
    }

    const palette = [cfg.primaryColor, cfg.secondaryColor, '#FFFFFF', '#FFB703'];
    const density = Math.max(0.2, Math.min(2.0, cfg.density));
    const spread = Math.max(0.3, Math.min(2.0, cfg.spread));
    const velocity = Math.max(0.5, Math.min(2.0, cfg.velocity));

    if (cfg.effectType === 'strobe-storm') {
      this.strobeBurstUntil = elapsedNow + 2.4;
    }

    if (cfg.effectType === 'confetti') {
      const count = Math.round(44 * density);
      const confettiGeo = new THREE.PlaneGeometry(0.32, 0.16);
      for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: palette[i % palette.length],
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.96,
        });
        const m = new THREE.Mesh(confettiGeo, mat);
        const cannonX = (i % 2 === 0 ? -5.5 : 5.5) + (Math.random() - 0.5) * 8 * spread;
        m.position.set(
          cannonX,
          5.5 + Math.random() * 4.5,
          -8.0 + (Math.random() - 0.3) * 12 * spread
        );
        m.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        );
        this.scene.add(m);
        this.emoteParticles.push({
          mesh: m,
          vx: (Math.random() - 0.5) * 4.8 * spread,
          vy: (2.8 + Math.random() * 3.8) * velocity,
          vz: (1.5 + Math.random() * 5.2) * spread,
          gravity: 1.85,
          spinSpeed: 6.5 + Math.random() * 5.0,
          scaleGrowth: 0,
          life: 2.8,
          maxLife: 2.8,
        });
      }
    } else if (cfg.effectType === 'pyrotechnics') {
      const count = Math.round(48 * density);
      const flameGeo = new THREE.ConeGeometry(0.22, 0.65, 6);
      const emberGeo = new THREE.OctahedronGeometry(0.18, 0);
      const nozzlesX = [-6.8, -2.6, 2.6, 6.8];

      for (let i = 0; i < count; i++) {
        const isEmber = i % 2 === 0;
        const mat = new THREE.MeshBasicMaterial({
          color: palette[i % palette.length],
          transparent: true,
          opacity: 1.0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const m = new THREE.Mesh(isEmber ? emberGeo : flameGeo, mat);
        const nozzleX = nozzlesX[i % nozzlesX.length];
        m.position.set(
          nozzleX + (Math.random() - 0.5) * 0.8 * spread,
          1.2 + Math.random() * 0.6,
          -8.4 + (Math.random() - 0.5) * 0.8
        );
        this.scene.add(m);
        this.emoteParticles.push({
          mesh: m,
          vx: (Math.random() - 0.5) * 3.8 * spread,
          vy: (6.2 + Math.random() * 6.5) * velocity,
          vz: (Math.random() - 0.5) * 3.8 * spread,
          gravity: 4.2,
          spinSpeed: 4.5,
          scaleGrowth: 0.2,
          life: 1.75,
          maxLife: 1.75,
        });
      }
    } else if (cfg.effectType === 'laser-burst' || cfg.effectType === 'strobe-storm') {
      // Razor-sharp coherent laser needles shooting from stage roof and turrets
      const count = Math.round(30 * density);
      const needleGeo = new THREE.CylinderGeometry(0.012, 0.032, 14.0, 8);
      needleGeo.rotateX(Math.PI / 2);

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const elevation = (Math.random() - 0.1) * 0.5 * spread;
        const mat = new THREE.MeshBasicMaterial({
          color:
            i % 3 === 0
              ? '#FFFFFF'
              : i % 2 === 0
                ? cfg.primaryColor
                : cfg.secondaryColor,
          transparent: true,
          opacity: 0.98,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const m = new THREE.Mesh(needleGeo, mat);
        m.position.set((i % 2 === 0 ? -1 : 1) * 2.5, 5.2, -10.8);
        const dirX = Math.cos(angle) * Math.cos(elevation);
        const dirY = Math.sin(elevation) + 0.16;
        const dirZ = Math.sin(angle) * Math.cos(elevation) + 0.72;
        m.lookAt(
          m.position.x + dirX * 12,
          m.position.y + dirY * 12,
          m.position.z + dirZ * 12
        );
        this.scene.add(m);
        const speed = (18.0 + Math.random() * 7.0) * velocity;
        this.emoteParticles.push({
          mesh: m,
          vx: dirX * speed,
          vy: dirY * speed,
          vz: dirZ * speed,
          gravity: 0,
          spinSpeed: 0,
          scaleGrowth: 0.35,
          life: 1.25,
          maxLife: 1.25,
        });
      }
    } else {
      // 'spark-fountain': Cryo diamond sparkler fountains flanking the DJ booth
      const count = Math.round(42 * density);
      const sparkGeo = new THREE.OctahedronGeometry(0.15, 0);
      for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: palette[i % palette.length],
          transparent: true,
          opacity: 1,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const m = new THREE.Mesh(sparkGeo, mat);
        const sideX = i % 2 === 0 ? -3.2 : 3.2;
        m.position.set(
          sideX + (Math.random() - 0.5) * 0.6,
          1.3,
          -10.6 + (Math.random() - 0.5) * 0.6
        );
        this.scene.add(m);
        this.emoteParticles.push({
          mesh: m,
          vx: (Math.random() - 0.5) * 2.6 * spread,
          vy: (5.5 + Math.random() * 5.2) * velocity,
          vz: (Math.random() - 0.5) * 2.6 * spread,
          gravity: 3.6,
          spinSpeed: 6.0,
          scaleGrowth: -0.2,
          life: 1.5,
          maxLife: 1.5,
        });
      }
    }
  }

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;

      const dt = Math.min(0.08, this.clock.getDelta());
      const elapsed = this.clock.getElapsedTime();

      this.syncFromStore(false);
      const state = useFestivalStore.getState();
      const { project, audio: prevAudio, batterySaver } = state;

      // Sample Web Audio FFT + 7-Band Audio Frequency Response & BPM-to-Crowd Mapper
      const { metrics, freqBins } = sharedAudioEngine.sample(
        dt,
        project.crowd.afrSensitivity ?? 1.2,
        project.crowd.bpmOverride ?? null
      );
      for (let i = 0; i < 64; i++) {
        const val = freqBins[i * 3] || 0;
        this.spectrumData[i * 4] = val;
        this.spectrumData[i * 4 + 1] = val;
        this.spectrumData[i * 4 + 2] = val;
      }
      this.spectrumTex.needsUpdate = true;

      // Throttle Zustand audio HUD metric updates (~15Hz)
      if (elapsed - this.lastUiAudioSync > 0.065) {
        this.lastUiAudioSync = elapsed;
        if (
          metrics.isPlaying !== prevAudio.isPlaying ||
          Math.abs(metrics.bass - prevAudio.bass) > 0.015 ||
          metrics.bpmEstimate !== prevAudio.bpmEstimate ||
          metrics.aggressionLevel !== prevAudio.aggressionLevel ||
          metrics.sourceType !== prevAudio.sourceType
        ) {
          state.setAudioMetrics(metrics);
        }
        const targetSim = metrics.isPlaying
          ? Math.round(
              38 +
                (metrics.crowdIntensity ?? metrics.amplitude) * 48 +
                metrics.beatIntensity * 14
            )
          : 28 + Math.round(Math.sin(elapsed * 0.8) * 5);
        state.setSimulatedEnergy(Math.min(100, targetSim));
      }

      // Check local emote burst
      if (state.localEmoteBurst && state.localEmoteBurst.timestamp > this.lastEmoteTimestamp) {
        this.lastEmoteTimestamp = state.localEmoteBurst.timestamp;
        this.spawnEmoteBurst(state.localEmoteBurst.type);
      }

      // Check "Beam to Stage" teleportation trigger
      if (state.beamEffectTimestamp > this.lastBeamTimestamp) {
        this.lastBeamTimestamp = state.beamEffectTimestamp;
        this.beamActiveUntil = elapsed + 2.2;
        this.spawnStagePyroOrTeleportBurst(
          'beam',
          project.lighting.primaryColor,
          project.lighting.secondaryColor
        );
      }

      // Check Performer Action triggers
      if (
        state.activePerformerAction &&
        state.activePerformerAction.timestamp > this.lastActionTimestamp
      ) {
        this.lastActionTimestamp = state.activePerformerAction.timestamp;
        if (state.activePerformerAction.type === 'pyro-burst') {
          this.spawnStagePyroOrTeleportBurst(
            'pyro',
            project.lighting.primaryColor,
            project.lighting.secondaryColor
          );
        } else if (state.activePerformerAction.type === 'laser-drop') {
          this.spawnCustomVisualFxBurst(
            {
              ...state.visualFxConfig,
              effectType: 'laser-burst',
              primaryColor: project.lighting.primaryColor,
              secondaryColor: project.lighting.secondaryColor,
            },
            elapsed
          );
        } else if (state.activePerformerAction.type === 'strobe-blinder') {
          this.strobeBurstUntil = elapsed + 2.5;
        }
      }

      // Check Visual FX Console custom burst trigger
      if (
        state.lastVisualFxBurst &&
        state.lastVisualFxBurst.timestamp > this.lastVisualFxTimestamp
      ) {
        this.lastVisualFxTimestamp = state.lastVisualFxBurst.timestamp;
        this.spawnCustomVisualFxBurst(state.lastVisualFxBurst, elapsed);
      }

      const bass = metrics.bass;
      const mid = metrics.mid;
      const treble = metrics.treble;
      const beat = metrics.beatIntensity;

      // Auto-fire Visual FX Console burst on heavy beat drops when enabled
      if (
        state.visualFxConfig.autoBeatTrigger &&
        (bass > 0.64 || beat > 0.58) &&
        elapsed - this.lastAutoBeatFxTime > 1.8
      ) {
        this.lastAutoBeatFxTime = elapsed;
        this.spawnCustomVisualFxBurst(state.visualFxConfig, elapsed);
      }

      const isLaserDropAction =
        (state.activePerformerAction?.type === 'laser-drop' &&
          Date.now() - state.activePerformerAction.timestamp < 3200) ||
        (state.lastVisualFxBurst?.effectType === 'laser-burst' &&
          Date.now() - state.lastVisualFxBurst.timestamp < 2400);

      // Lighting & Strobe Blinder Console Dynamics
      const lighting = project.lighting;
      const presetIdx = [
        'spectrum',
        'plasma',
        'mandala',
        'waveform',
        'strobe-grid',
        'live-cam',
      ].indexOf(lighting.ledPreset);

      const strobeMode = lighting.strobeMode ?? 'beat-strobe';
      const strobeRate = lighting.strobeFrequency ?? 0.35;
      const strobeStrength = lighting.strobeIntensity ?? 1.0;
      const isBurstStrobe = elapsed < this.strobeBurstUntil;

      let strobeFlash = 0;
      if (!lighting.reducedFlashing && (strobeMode !== 'off' || isBurstStrobe || strobeRate > 0)) {
        const freqHz = isBurstStrobe ? 18.0 : 4.0 + strobeRate * 16.0;
        const rawWave = Math.sin(elapsed * freqHz * Math.PI * 2);
        if (isBurstStrobe || strobeMode === 'hyper-blinder') {
          strobeFlash = rawWave > 0.15 ? 1.0 : 0.0;
        } else if (strobeMode === 'color-strobe') {
          strobeFlash = rawWave > 0.25 ? 0.9 : 0.0;
        } else if (strobeMode === 'beat-strobe') {
          // Beat-synced strobe + slider frequency
          strobeFlash =
            beat > 0.38 || bass > 0.58 || (strobeRate > 0.15 && rawWave > 0.55)
              ? Math.min(1.0, (0.55 + beat * 0.6) * strobeStrength)
              : 0.0;
        }
      }

      const strobePulse = 1.0 + strobeFlash * 1.15 * strobeStrength;

      const autoHueShift =
        lighting.autoDj && metrics.isPlaying ? (elapsed * 0.08 + beat * 0.1) % 1 : 0;
      _c1.set(lighting.primaryColor);
      _c2.set(lighting.secondaryColor);
      if (autoHueShift > 0) {
        _c1.offsetHSL(autoHueShift * 0.15, 0, 0);
      }

      // Drive Overhead Xenon Strobe Light
      if (strobeMode === 'color-strobe') {
        _strobeColor.copy(Math.floor(elapsed * 14) % 2 === 0 ? _c1 : _c2);
      } else {
        _strobeColor.set('#FFFFFF');
      }
      this.strobeLight.color.copy(_strobeColor);
      this.strobeLight.intensity = strobeFlash * 115 * strobeStrength;

      this.spotLeft.color.copy(_c1);
      this.spotRight.color.copy(_c2);
      const laserDropMult = isLaserDropAction ? 1.65 : 1.0;
      this.spotLeft.intensity =
        (28 + bass * 65 + beat * 35) * lighting.spotlightIntensity * strobePulse * laserDropMult;
      this.spotRight.intensity =
        (28 + mid * 65 + beat * 35) * lighting.spotlightIntensity * strobePulse * laserDropMult;
      this.spotLeft.target.position.set(
        Math.sin(elapsed * lighting.laserSpeed) * 10 * lighting.laserSpread,
        0,
        2 + Math.cos(elapsed * 0.8) * 5
      );
      this.spotRight.target.position.set(
        -Math.sin(elapsed * lighting.laserSpeed) * 10 * lighting.laserSpread,
        0,
        2 + Math.sin(elapsed * 0.7) * 5
      );
      this.stagePointLight.color.copy(_c1);
      this.stagePointLight.intensity = 14 + beat * 26 + strobeFlash * 35;

      // Update Volumetric Spotlight Cones
      const showVolumetric = lighting.volumetricBeams !== false && !batterySaver;
      this.volConeLeft.visible = showVolumetric;
      this.volConeRight.visible = showVolumetric;
      if (showVolumetric) {
        this.volConeLeft.lookAt(this.spotLeft.target.position);
        this.volConeRight.lookAt(this.spotRight.target.position);
        this.volConeMatLeft.uniforms.uColor.value.copy(_c1);
        this.volConeMatRight.uniforms.uColor.value.copy(_c2);
        this.volConeMatLeft.uniforms.uTime.value = elapsed;
        this.volConeMatRight.uniforms.uTime.value = elapsed;
        const coneInt =
          (0.32 + bass * 0.45 + beat * 0.25 + strobeFlash * 0.35) *
          Math.min(1.5, lighting.spotlightIntensity) *
          laserDropMult;
        this.volConeMatLeft.uniforms.uIntensity.value = coneInt;
        this.volConeMatRight.uniforms.uIntensity.value = coneInt;
      }

      // Animate "Beam to Stage" Teleportation Pillar & Shockwave
      if (elapsed < this.beamActiveUntil) {
        const rem = (this.beamActiveUntil - elapsed) / 2.2;
        const prog = 1 - rem;
        this.beamPillarMesh.visible = true;
        this.beamRingMesh.visible = true;

        const pillarMat = this.beamPillarMesh.material as THREE.MeshBasicMaterial;
        pillarMat.color.copy(_c1);
        pillarMat.opacity = Math.sin(rem * Math.PI) * 0.78;
        this.beamPillarMesh.scale.set(0.4 + rem * 1.1, 1, 0.4 + rem * 1.1);
        this.beamPillarMesh.rotation.y = elapsed * 4;

        const ringMat = this.beamRingMesh.material as THREE.MeshBasicMaterial;
        ringMat.color.copy(_c2);
        ringMat.opacity = rem * 0.9;
        this.beamRingMesh.scale.setScalar(1 + prog * 6.5);
      } else {
        this.beamPillarMesh.visible = false;
        this.beamRingMesh.visible = false;
      }

      // Update sky & floor shaders
      this.skyMat.uniforms.uTime.value = elapsed;
      this.skyMat.uniforms.uBass.value = bass;
      this.floorOverlayMat.uniforms.uTime.value = elapsed;
      this.floorOverlayMat.uniforms.uBass.value = bass;
      this.floorOverlayMat.uniforms.uBeat.value = beat;
      this.floorOverlayMat.uniforms.uStrobe.value = strobeFlash;

      // Update stage items (LED shaders, razor-sharp lasers, strobe blinders, speaker cones, portals)
      const sharpness = lighting.laserSharpness ?? 1.0;
      this.stageObjects.forEach(({ built }) => {
        for (const mat of built.ledMaterials) {
          mat.uniforms.uTime.value = elapsed;
          mat.uniforms.uBass.value = bass;
          mat.uniforms.uMid.value = mid;
          mat.uniforms.uTreble.value = treble;
          mat.uniforms.uBeat.value = beat;
          mat.uniforms.uPreset.value = Math.max(0, presetIdx);
          mat.uniforms.uReducedFlashing.value = lighting.reducedFlashing ? 1 : 0;
        }
        for (const pMat of built.portalMaterials) {
          pMat.uniforms.uTime.value = elapsed;
          pMat.uniforms.uBass.value = bass;
        }
        for (const lMat of built.laserMaterials) {
          lMat.uniforms.uTime.value = elapsed;
          lMat.uniforms.uBass.value = bass;
          lMat.uniforms.uSharpness.value = sharpness;
          lMat.uniforms.uStrobe.value = strobeFlash;
        }
        built.strobeMeshes.forEach((bulb, bIdx) => {
          const bMat = bulb.material as THREE.MeshBasicMaterial;
          const chase = Math.sin(elapsed * 26 + bIdx * 0.9) > 0 ? 1 : 0.25;
          bMat.color.copy(_strobeColor);
          bMat.opacity = 0.18 + strobeFlash * 0.82 * chase;
          bulb.scale.setScalar(1 + strobeFlash * 0.45 * chase);
        });
        built.laserBeams.forEach((beamGrp, idx) => {
          const speed =
            lighting.laserSpeed *
            (lighting.choreography === 'chill' ? 0.5 : isLaserDropAction ? 2.8 : 1.5);
          beamGrp.rotation.y =
            Math.sin(elapsed * speed + idx * 1.3) *
            0.68 *
            lighting.laserSpread *
            (isLaserDropAction ? 1.4 : 1);
          beamGrp.rotation.x = Math.cos(elapsed * speed * 0.75) * 0.24;
        });
        built.speakerCones.forEach((cone) => {
          const s = 1 + bass * 0.28 + beat * 0.14;
          cone.scale.set(s, s, 1 + bass * 0.45);
        });
        built.pulsingParts.forEach((part, idx) => {
          const pScale = 1 + (idx % 2 === 0 ? bass : treble) * 0.18;
          part.scale.setScalar(pScale);
          part.rotation.y += dt * (0.4 + mid * 1.4);
        });
      });

      // Animate environment props (including Lollapalooza flags & bouncing crowd spheres)
      if (this.envResult) {
        for (const prop of this.envResult.animatedProps) {
          if (prop.kind === 'flag') {
            prop.mesh.rotation.y =
              (prop.mesh.position.x < 0 ? 0.2 : Math.PI - 0.2) +
              Math.sin(elapsed * prop.speed + prop.phase) * 0.28;
            prop.mesh.rotation.z = Math.cos(elapsed * prop.speed * 0.8 + prop.phase) * 0.08;
          } else if (prop.kind === 'sphere') {
            prop.mesh.position.y =
              prop.baseY + Math.abs(Math.sin(elapsed * prop.speed + prop.phase)) * (1.8 + bass * 1.6);
            prop.mesh.rotation.y += dt * 1.2;
          } else {
            prop.mesh.position.y =
              prop.baseY + Math.sin(elapsed * prop.speed + prop.phase) * (0.55 + bass * 0.6);
            if (prop.kind === 'crystal') {
              prop.mesh.rotation.y += dt * 0.45;
            }
          }
        }
      }

      // Animate atmospheric particles
      if (!batterySaver) {
        const pMat = this.particles.material as THREE.PointsMaterial;
        pMat.color.copy(_c1);
        for (let i = 0; i < this.activeParticles; i++) {
          const idx = i * 3 + 1;
          this.particlePositions[idx] += dt * (0.45 + bass * 2.2);
          if (this.particlePositions[idx] > 22) {
            this.particlePositions[idx] = 0.5;
          }
        }
        this.particles.geometry.attributes.position.needsUpdate = true;
      }

      // Animate emote, confetti, pyrotechnic, and laser burst particles
      for (let i = this.emoteParticles.length - 1; i >= 0; i--) {
        const ep = this.emoteParticles[i];
        ep.mesh.position.x += ep.vx * dt;
        ep.mesh.position.y += ep.vy * dt;
        ep.mesh.position.z += ep.vz * dt;
        ep.vy -= ep.gravity * dt;
        if (ep.spinSpeed !== 0) {
          ep.mesh.rotation.y += dt * ep.spinSpeed;
          ep.mesh.rotation.x += dt * ep.spinSpeed * 0.7;
          ep.mesh.rotation.z += dt * ep.spinSpeed * 0.5;
        }
        if (ep.scaleGrowth !== 0) {
          const nextScale = Math.max(0.1, ep.mesh.scale.x + ep.scaleGrowth * dt);
          ep.mesh.scale.setScalar(nextScale);
        }
        ep.life -= dt;
        const m = ep.mesh.material as THREE.MeshBasicMaterial;
        m.opacity = Math.max(0, ep.life / ep.maxLife);
        if (ep.life <= 0 || ep.mesh.position.y < -0.5) {
          this.scene.remove(ep.mesh);
          this.emoteParticles.splice(i, 1);
        }
      }

      // Update Live Webcam Stage Bridge
      const webcamPose = sharedWebcamBridge.update(
        elapsed,
        bass,
        beat,
        lighting.primaryColor,
        lighting.secondaryColor
      );

      // Update GPU-instanced Poly Pizza crowd + 7-Band Audio Frequency Response & Main Event Ensemble
      this.crowdSystem.update(
        elapsed,
        bass,
        beat,
        project.crowd.choreography,
        state.avatar,
        state.room.participants,
        webcamPose,
        state.activePerformerAction,
        lighting.mainEventStyle ?? 'lolla-headliner',
        metrics,
        project.crowd
      );

      // AI Auto-Stage Director
      if (state.autoDirectorEnabled) {
        this.autoDirectorTimer += dt;
        const phraseDuration = bass > 0.65 ? 3.6 : 5.2;
        if (this.autoDirectorTimer >= phraseDuration) {
          this.autoDirectorTimer = 0;
          const directorShots: CameraMode[] = [
            'stage-closeup',
            'crowd-pov',
            'dj-booth',
            'wide-stage',
          ];
          this.autoDirectorShotIndex =
            (this.autoDirectorShotIndex + 1) % directorShots.length;
          const nextShot = directorShots[this.autoDirectorShotIndex];
          this.setCameraShotTarget(nextShot);
        }
      }

      // Camera Director Logic
      if (state.isPlayingSequence && project.cameraSequence.length > 0) {
        const kf = project.cameraSequence[this.seqIndex % project.cameraSequence.length];
        _vec3.set(kf.position[0], kf.position[1], kf.position[2]);
        _targetVec3.set(kf.target[0], kf.target[1], kf.target[2]);
        this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _vec3.x, 2.5, dt);
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _vec3.y, 2.5, dt);
        this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _vec3.z, 2.5, dt);
        this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, _targetVec3.x, 3, dt);
        this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, _targetVec3.y, 3, dt);
        this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, _targetVec3.z, 3, dt);
        this.seqTimer += dt;
        if (this.seqTimer >= kf.duration) {
          this.seqTimer = 0;
          this.seqIndex = (this.seqIndex + 1) % project.cameraSequence.length;
        }
      } else if (state.cameraMode === 'drone' && !state.autoDirectorEnabled) {
        const angle = elapsed * 0.24;
        const targetX = Math.sin(angle) * 23;
        const targetZ = Math.cos(angle) * 21 - 2;
        const targetY = 10 + Math.sin(elapsed * 0.5) * 3.5;
        this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetX, 2.2, dt);
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetY, 2.2, dt);
        this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetZ, 2.2, dt);
        this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, 0, 3, dt);
        this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, 3.2, 3, dt);
        this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, -8, 3, dt);
      } else if (this.cameraTransitionActive || state.autoDirectorEnabled) {
        const swayX = state.autoDirectorEnabled ? Math.sin(elapsed * 0.9) * 0.85 : 0;
        const swayY = state.autoDirectorEnabled ? Math.cos(elapsed * 0.7) * 0.25 : 0;
        this.camera.position.x = THREE.MathUtils.damp(
          this.camera.position.x,
          this.cameraTargetPos.x + swayX,
          3.8,
          dt
        );
        this.camera.position.y = THREE.MathUtils.damp(
          this.camera.position.y,
          this.cameraTargetPos.y + swayY,
          3.8,
          dt
        );
        this.camera.position.z = THREE.MathUtils.damp(
          this.camera.position.z,
          this.cameraTargetPos.z,
          3.8,
          dt
        );
        this.controls.target.x = THREE.MathUtils.damp(
          this.controls.target.x,
          this.cameraTargetLook.x,
          4.2,
          dt
        );
        this.controls.target.y = THREE.MathUtils.damp(
          this.controls.target.y,
          this.cameraTargetLook.y,
          4.2,
          dt
        );
        this.controls.target.z = THREE.MathUtils.damp(
          this.controls.target.z,
          this.cameraTargetLook.z,
          4.2,
          dt
        );
        if (
          !state.autoDirectorEnabled &&
          this.camera.position.distanceTo(this.cameraTargetPos) < 0.12
        ) {
          this.cameraTransitionActive = false;
        }
      }

      this.controls.update();

      // Subtle Camera Shake on heavy sub-bass drops
      if (
        lighting.cameraShake !== false &&
        !lighting.reducedFlashing &&
        bass > 0.56
      ) {
        const shakeAmt = (bass - 0.56) * 0.18 + beat * 0.06;
        this.camera.position.x += Math.sin(elapsed * 47.0) * shakeAmt;
        this.camera.position.y += Math.cos(elapsed * 53.0) * shakeAmt * 0.75;
      }

      // Direct crisp rendering (Bloom Effect removed as requested)
      this.renderer.render(this.scene, this.camera);

      // FPS monitoring & auto-profile fallback
      this.fpsFrames++;
      this.fpsAccum += dt;
      if (this.fpsAccum >= 1.0) {
        const fps = Math.round(this.fpsFrames / this.fpsAccum);
        state.setMeasuredFps(fps);
        if (!this.isSoftwareGl && fps < 22 && state.graphicsProfile === 'ultra') {
          this.lowFpsStrikes++;
          if (this.lowFpsStrikes >= 3) {
            state.setGraphicsProfile('balanced');
            state.showToast('Graphics auto-tuned to Balanced for smoother FPS');
          }
        } else {
          this.lowFpsStrikes = 0;
        }
        this.fpsFrames = 0;
        this.fpsAccum = 0;
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    this.frameId = requestAnimationFrame(tick);
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (status === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    if (this.renderer) {
      const dom = this.renderer.domElement;
      dom.removeEventListener('pointerdown', this.handlePointerDown);
      dom.removeEventListener('pointermove', this.handlePointerMove);
      dom.removeEventListener('pointerup', this.handlePointerUp);
      dom.removeEventListener('webglcontextlost', this.handleContextLost);
      dom.removeEventListener('webglcontextrestored', this.handleContextRestored);
    }

    if (this.envResult) this.envResult.dispose();
    this.stageObjects.forEach((e) => e.built.dispose());
    this.crowdSystem?.dispose();
    this.spectrumTex?.dispose();
    this.skyMat?.dispose();
    this.floorOverlayMat?.dispose();
    this.volConeMatLeft?.dispose();
    this.volConeMatRight?.dispose();
    this.renderer?.dispose();
  }
}
