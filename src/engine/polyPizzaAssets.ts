import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function normalizeGeometryForMerge(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const nonIndexed = geo.index ? geo.toNonIndexed() : geo.clone();
  // Ensure only position and normal attributes remain so mergeGeometries succeeds cleanly
  const keep = new Set(['position', 'normal']);
  for (const key of Object.keys(nonIndexed.attributes)) {
    if (!keep.has(key)) {
      nonIndexed.deleteAttribute(key);
    }
  }
  if (!nonIndexed.attributes.normal) {
    nonIndexed.computeVertexNormals();
  }
  return nonIndexed;
}

/**
 * Poly Pizza Stylized Articulated Leg + Chunky Festival Sneaker Geometry
 * Pivot is at the hip (0, 0.60, 0) extending down to the sole at (0, 0, 0)
 * or local origin at ground (0, 0, 0) up to hip (0, 0.62, 0).
 */
export function buildPolyPizzaLegGeometry(): THREE.BufferGeometry {
  // Upper thigh (faceted low-poly rounded box)
  const thigh = new RoundedBoxGeometry(0.13, 0.3, 0.14, 2, 0.03);
  thigh.translate(0, 0.45, 0);

  // Lower calf / shin
  const calf = new RoundedBoxGeometry(0.11, 0.28, 0.12, 2, 0.025);
  calf.translate(0, 0.2, 0);

  // Chunky Poly Pizza Low-Poly Festival Sneaker / Boot
  const sneakerUpper = new RoundedBoxGeometry(0.135, 0.11, 0.24, 2, 0.03);
  sneakerUpper.translate(0, 0.06, 0.045);

  const sneakerSole = new THREE.BoxGeometry(0.148, 0.035, 0.26);
  sneakerSole.translate(0, 0.018, 0.045);

  const parts = [thigh, calf, sneakerUpper, sneakerSole].map(normalizeGeometryForMerge);
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

/**
 * Poly Pizza Stylized Festival Hoodie / Bomber Jacket Torso + Hydration Backpack
 */
export function buildPolyPizzaTorsoGeometry(): THREE.BufferGeometry {
  // Main low-poly faceted jacket chest & waist
  const pelvis = new RoundedBoxGeometry(0.33, 0.16, 0.21, 2, 0.035);
  pelvis.translate(0, 0.66, 0);

  const chest = new RoundedBoxGeometry(0.42, 0.44, 0.24, 2, 0.05);
  chest.translate(0, 0.94, 0);

  // Hoodie / Bomber Collar Ring
  const collar = new THREE.TorusGeometry(0.13, 0.042, 6, 10);
  collar.rotateX(Math.PI / 2);
  collar.scale(1.15, 1.0, 0.95);
  collar.translate(0, 1.18, -0.01);

  // Poly Pizza Festival Hydration Backpack on back
  const backpack = new RoundedBoxGeometry(0.27, 0.32, 0.13, 2, 0.035);
  backpack.translate(0, 0.94, -0.16);

  const pocket = new THREE.BoxGeometry(0.2, 0.14, 0.05);
  pocket.translate(0, 0.88, -0.22);

  const parts = [pelvis, chest, collar, backpack, pocket].map(normalizeGeometryForMerge);
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

/**
 * Poly Pizza Stylized Sculpted Low-Poly Head with 3D Nose, Jawline & Ears
 */
export function buildPolyPizzaHeadGeometry(): THREE.BufferGeometry {
  // Rounded low-poly head block (signature Poly Pizza / Quaternius character look)
  const cranium = new RoundedBoxGeometry(0.31, 0.34, 0.3, 3, 0.09);

  // Sculpted 3D nose bridge
  const nose = new THREE.ConeGeometry(0.036, 0.085, 5);
  nose.rotateX(Math.PI * 0.42);
  nose.translate(0, -0.01, 0.165);

  // Left & Right Ears
  const earL = new RoundedBoxGeometry(0.045, 0.09, 0.06, 1, 0.015);
  earL.translate(-0.165, 0, 0);

  const earR = new RoundedBoxGeometry(0.045, 0.09, 0.06, 1, 0.015);
  earR.translate(0.165, 0, 0);

  // Neck cylinder
  const neck = new THREE.CylinderGeometry(0.075, 0.088, 0.12, 8);
  neck.translate(0, -0.19, 0);

  const parts = [cranium, nose, earL, earR, neck].map(normalizeGeometryForMerge);
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

/**
 * Poly Pizza Festival Bucket Hat / Snapback Cap / Rave Headgear Geometry
 */
export function buildPolyPizzaHatGeometry(): THREE.BufferGeometry {
  // Bucket hat / cap crown
  const crown = new THREE.CylinderGeometry(0.155, 0.175, 0.13, 10);
  crown.translate(0, 0.16, 0);

  // Slanted festival brim / visor bill
  const brim = new THREE.CylinderGeometry(0.24, 0.25, 0.025, 12);
  brim.rotateX(0.08);
  brim.translate(0, 0.105, 0.02);

  // Top button / rave crest fin
  const crest = new RoundedBoxGeometry(0.05, 0.07, 0.18, 1, 0.015);
  crest.translate(0, 0.23, 0);

  const parts = [crown, brim, crest].map(normalizeGeometryForMerge);
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

/**
 * Poly Pizza Festival Shutter Shades / Deal-With-It Pixel Sunglasses
 */
export function buildPolyPizzaShadesGeometry(): THREE.BufferGeometry {
  const frameBar = new THREE.BoxGeometry(0.31, 0.032, 0.04);
  frameBar.translate(0, 0.035, 0.152);

  const lensL = new RoundedBoxGeometry(0.12, 0.075, 0.035, 1, 0.01);
  lensL.translate(-0.075, 0.015, 0.152);

  const lensR = new RoundedBoxGeometry(0.12, 0.075, 0.035, 1, 0.01);
  lensR.translate(0.075, 0.015, 0.152);

  const templeL = new THREE.BoxGeometry(0.022, 0.025, 0.16);
  templeL.translate(-0.155, 0.025, 0.07);

  const templeR = new THREE.BoxGeometry(0.022, 0.025, 0.16);
  templeR.translate(0.155, 0.025, 0.07);

  const parts = [frameBar, lensL, lensR, templeL, templeR].map(normalizeGeometryForMerge);
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

/**
 * Poly Pizza Articulated Arm + Forearm + Rock-On Hand Silhouette
 */
export function buildPolyPizzaArmGeometry(): THREE.BufferGeometry {
  const upperArm = new RoundedBoxGeometry(0.092, 0.24, 0.092, 2, 0.025);
  upperArm.translate(0, 0.12, 0);

  const forearm = new RoundedBoxGeometry(0.082, 0.24, 0.082, 2, 0.02);
  forearm.translate(0, 0.34, 0.02);

  const palm = new RoundedBoxGeometry(0.085, 0.095, 0.055, 1, 0.015);
  palm.translate(0, 0.48, 0.02);

  // Index & pinky "Rock On" horns silhouette
  const fingerL = new THREE.BoxGeometry(0.022, 0.065, 0.022);
  fingerL.translate(-0.026, 0.545, 0.02);

  const fingerR = new THREE.BoxGeometry(0.022, 0.065, 0.022);
  fingerR.translate(0.026, 0.545, 0.02);

  const parts = [upperArm, forearm, palm, fingerL, fingerR].map(normalizeGeometryForMerge);
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

/**
 * Poly Pizza Crowd Handheld Festival Prop (Smartphone recording stage + Totem Star + Lightstick)
 */
export function buildPolyPizzaCrowdPropGeometry(): THREE.BufferGeometry {
  const handle = new THREE.CylinderGeometry(0.018, 0.022, 0.32, 6);
  handle.translate(0, 0.68, 0.02);

  // Glowing Smartphone / Festival Totem Sign at top of raised hand
  const screen = new RoundedBoxGeometry(0.18, 0.26, 0.028, 2, 0.01);
  screen.translate(0, 0.88, 0.02);

  const starTop = new THREE.OctahedronGeometry(0.09, 0);
  starTop.translate(0, 1.06, 0.02);

  const parts = [handle, screen, starTop].map(normalizeGeometryForMerge);
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

/**
 * Poly Pizza & Three.js CC0 GLTF Character & Mascot Loader
 * Loads official Three.js / Poly Pizza CC0 GLTF models (RobotExpressive, Flamingo, Parrot)
 * and custom .glb URLs with AnimationMixer playback, while providing instant low-poly
 * Poly Pizza Totem Mascots so the scene never blocks on network latency.
 */
export interface LoadedGltfCharacter {
  group: THREE.Group;
  mixer: THREE.AnimationMixer | null;
}

export class PolyPizzaGltfManager {
  private loader = new GLTFLoader();
  private loadedCharacters: LoadedGltfCharacter[] = [];

  /**
   * Attempts to load official Three.js CC0 GLTF animated characters & flying festival mascots
   * into the provided target group. Fails silently if offline or blocked by CORS.
   */
  public loadOfficialThreeJsCharacters(targetGroup: THREE.Group) {
    THREE.Cache.enabled = true;

    const catalog = [
      {
        url: 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
        position: new THREE.Vector3(-7.4, 1.35, -9.6),
        rotationY: 0.38,
        scale: 0.48,
        preferredClip: 'Dance',
      },
      {
        url: 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
        position: new THREE.Vector3(7.4, 1.35, -9.6),
        rotationY: -0.38,
        scale: 0.48,
        preferredClip: 'Jump',
      },
      {
        url: 'https://threejs.org/examples/models/gltf/Flamingo.glb',
        position: new THREE.Vector3(-9.5, 9.2, -4.0),
        rotationY: 0.4,
        scale: 0.032,
        preferredClip: '',
      },
      {
        url: 'https://threejs.org/examples/models/gltf/Parrot.glb',
        position: new THREE.Vector3(9.5, 9.6, -4.0),
        rotationY: -0.4,
        scale: 0.036,
        preferredClip: '',
      },
    ];

    catalog.forEach((entry) => {
      this.loader.load(
        entry.url,
        (gltf) => {
          const model = gltf.scene;
          model.position.copy(entry.position);
          model.rotation.y = entry.rotationY;
          model.scale.setScalar(entry.scale);

          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          let mixer: THREE.AnimationMixer | null = null;
          if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(model);
            const clip =
              (entry.preferredClip
                ? THREE.AnimationClip.findByName(gltf.animations, entry.preferredClip)
                : null) || gltf.animations[0];
            if (clip) {
              const action = mixer.clipAction(clip);
              action.play();
            }
          }

          targetGroup.add(model);
          this.loadedCharacters.push({ group: model, mixer });
        },
        undefined,
        () => {
          // Graceful silent fallback if offline/sandboxed; procedural Poly Pizza characters are always active
        }
      );
    });
  }

  public update(dt: number, danceSpeedMultiplier: number) {
    for (const item of this.loadedCharacters) {
      if (item.mixer) {
        item.mixer.timeScale = danceSpeedMultiplier;
        item.mixer.update(dt);
      }
    }
  }
}
