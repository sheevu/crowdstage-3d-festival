import * as THREE from 'three';
import { FaceTextureMode, WebcamPoseMetrics } from '../types/festival';

export interface ScannedAvatarResult {
  skinColor: string;
  hairColor: string;
  outfitColor: string;
  snapshotDataUrl: string;
  simulated: boolean;
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export class WebcamStageBridge {
  private videoEl: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;

  private processCanvas: HTMLCanvasElement;
  private processCtx: CanvasRenderingContext2D;
  private holoTexture: THREE.CanvasTexture;

  // High-clarity 3D head UV facial texture (captured snapshot or live video face)
  private faceSnapshotCanvas: HTMLCanvasElement;
  private faceSnapshotCtx: CanvasRenderingContext2D;
  private faceSnapshotTexture: THREE.CanvasTexture;

  private liveFaceCanvas: HTMLCanvasElement;
  private liveFaceCtx: CanvasRenderingContext2D;
  private liveFaceTexture: THREE.CanvasTexture;

  private analysisCanvas: HTMLCanvasElement;
  private analysisCtx: CanvasRenderingContext2D;
  private prevFrame: Uint8ClampedArray | null = null;

  public pose: WebcamPoseMetrics = {
    active: false,
    usingSimulatedFeed: false,
    headX: 0,
    headY: 0,
    leftArmRaise: 0.25,
    rightArmRaise: 0.25,
    motionEnergy: 0,
  };

  constructor() {
    this.processCanvas = document.createElement('canvas');
    this.processCanvas.width = 256;
    this.processCanvas.height = 256;
    this.processCtx = this.processCanvas.getContext('2d')!;

    this.faceSnapshotCanvas = document.createElement('canvas');
    this.faceSnapshotCanvas.width = 256;
    this.faceSnapshotCanvas.height = 256;
    this.faceSnapshotCtx = this.faceSnapshotCanvas.getContext('2d')!;

    this.liveFaceCanvas = document.createElement('canvas');
    this.liveFaceCanvas.width = 256;
    this.liveFaceCanvas.height = 256;
    this.liveFaceCtx = this.liveFaceCanvas.getContext('2d')!;

    this.analysisCanvas = document.createElement('canvas');
    this.analysisCanvas.width = 64;
    this.analysisCanvas.height = 48;
    this.analysisCtx = this.analysisCanvas.getContext('2d', {
      willReadFrequently: true,
    })!;

    this.holoTexture = new THREE.CanvasTexture(this.processCanvas);
    this.holoTexture.colorSpace = THREE.SRGBColorSpace;
    this.holoTexture.minFilter = THREE.LinearFilter;
    this.holoTexture.magFilter = THREE.LinearFilter;

    this.faceSnapshotTexture = new THREE.CanvasTexture(this.faceSnapshotCanvas);
    this.faceSnapshotTexture.colorSpace = THREE.SRGBColorSpace;
    this.faceSnapshotTexture.minFilter = THREE.LinearFilter;
    this.faceSnapshotTexture.magFilter = THREE.LinearFilter;

    this.liveFaceTexture = new THREE.CanvasTexture(this.liveFaceCanvas);
    this.liveFaceTexture.colorSpace = THREE.SRGBColorSpace;
    this.liveFaceTexture.minFilter = THREE.LinearFilter;
    this.liveFaceTexture.magFilter = THREE.LinearFilter;

    this.drawSimulatedPerformer(0, 0, '#00E5FF', '#FF3CAC');
    this.drawStylizedFacePortrait(
      this.faceSnapshotCtx,
      '#E2B897',
      '#1E1B4B',
      '#00E5FF'
    );
    this.faceSnapshotTexture.needsUpdate = true;
    this.drawStylizedFacePortrait(
      this.liveFaceCtx,
      '#E2B897',
      '#1E1B4B',
      '#00E5FF'
    );
    this.liveFaceTexture.needsUpdate = true;
  }

  public getTexture(): THREE.CanvasTexture {
    return this.holoTexture;
  }

  public getFaceTexture(mode: FaceTextureMode = 'snapshot'): THREE.CanvasTexture {
    if (mode === 'live-video') {
      return this.liveFaceTexture;
    }
    return this.faceSnapshotTexture;
  }

  public getVideoElement(): HTMLVideoElement | null {
    return this.videoEl;
  }

  public async startLiveWebcam(): Promise<{ ok: boolean; simulated: boolean }> {
    if (this.stream && !this.pose.usingSimulatedFeed && this.videoEl) {
      this.pose.active = true;
      return { ok: true, simulated: false };
    }
    this.stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: 'user',
        },
        audio: false,
      });
      this.stream = stream;
      if (!this.videoEl) {
        this.videoEl = document.createElement('video');
        this.videoEl.playsInline = true;
        this.videoEl.muted = true;
        this.videoEl.setAttribute('playsinline', 'true');
      }
      this.videoEl.srcObject = stream;
      await this.videoEl.play();

      this.pose = {
        ...this.pose,
        active: true,
        usingSimulatedFeed: false,
      };
      return { ok: true, simulated: false };
    } catch {
      // Graceful fallback to simulated holographic stage performer if camera is unavailable
      this.pose = {
        ...this.pose,
        active: true,
        usingSimulatedFeed: true,
      };
      return { ok: true, simulated: true };
    }
  }

  public startSimulatedPerformer(): void {
    this.stop();
    this.pose = {
      ...this.pose,
      active: true,
      usingSimulatedFeed: true,
    };
  }

  public stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.srcObject = null;
    }
    this.prevFrame = null;
    this.pose = {
      active: false,
      usingSimulatedFeed: false,
      headX: 0,
      headY: 0,
      leftArmRaise: 0.2,
      rightArmRaise: 0.2,
      motionEnergy: 0,
    };
  }

  /**
   * Captures a webcam snapshot (or procedural demo scan if camera is unavailable),
   * extracts skin tone, hair color, and upper-body outfit colors directly from frame pixels,
   * and maps the captured face into the 3D UV head texture.
   */
  public scanAndExtractAvatarColors(
    fallbackPrimary = '#00E5FF',
    fallbackSecondary = '#FF3CAC'
  ): ScannedAvatarResult {
    const hasLiveVideo =
      !this.pose.usingSimulatedFeed &&
      this.videoEl &&
      this.videoEl.readyState >= 2;

    if (hasLiveVideo && this.videoEl) {
      // Sample 64x48 frame for pixel color extraction
      this.analysisCtx.save();
      this.analysisCtx.scale(-1, 1);
      this.analysisCtx.drawImage(this.videoEl, -64, 0, 64, 48);
      this.analysisCtx.restore();

      const data = this.analysisCtx.getImageData(0, 0, 64, 48).data;

      const sampleRegion = (
        x0: number,
        y0: number,
        x1: number,
        y1: number
      ): [number, number, number] => {
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const i = (y * 64 + x) * 4;
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }
        if (count === 0) return [220, 180, 150];
        return [r / count, g / count, b / count];
      };

      // 1. Hair region (top crown of head)
      const [hr, hg, hb] = sampleRegion(24, 4, 40, 11);
      // 2. Skin region (center face / cheeks / nose bridge)
      const [sr, sg, sb] = sampleRegion(25, 16, 39, 28);
      // 3. Upper-body outfit region (lower center frame / shoulders)
      const [or, og, ob] = sampleRegion(18, 36, 46, 46);

      // Enhance saturation slightly on outfit color so it pops on the 3D stage
      const skinColor = rgbToHex(
        Math.max(95, Math.min(245, sr * 1.05)),
        Math.max(70, Math.min(225, sg * 1.02)),
        Math.max(55, Math.min(210, sb))
      );
      const hairColor = rgbToHex(hr * 0.9, hg * 0.9, hb * 0.9);
      const outfitColor = rgbToHex(
        Math.min(255, or * 1.2 + 18),
        Math.min(255, og * 1.2 + 18),
        Math.min(255, ob * 1.2 + 18)
      );

      // Render high-clarity UV-mapped facial texture into faceSnapshotCanvas
      this.renderVideoFaceToCanvas(
        this.faceSnapshotCtx,
        this.videoEl,
        skinColor,
        fallbackPrimary
      );
      this.faceSnapshotTexture.needsUpdate = true;

      return {
        skinColor,
        hairColor,
        outfitColor,
        snapshotDataUrl: this.faceSnapshotCanvas.toDataURL('image/png'),
        simulated: false,
      };
    }

    // Clean procedural fallback scan when camera permission is denied or unavailable
    const skinSwatches = ['#E5BA98', '#C68B59', '#F3D2B8', '#8D5524', '#D9A17C'];
    const hairSwatches = ['#15192B', '#3B2314', '#00E5FF', '#FF3CAC', '#F59E0B'];
    const pickIdx = Math.floor(Date.now() / 1000) % skinSwatches.length;
    const skinColor = skinSwatches[pickIdx];
    const hairColor = hairSwatches[(pickIdx + 1) % hairSwatches.length];
    const outfitColor = fallbackPrimary;

    this.drawStylizedFacePortrait(
      this.faceSnapshotCtx,
      skinColor,
      hairColor,
      fallbackSecondary
    );
    this.faceSnapshotTexture.needsUpdate = true;

    return {
      skinColor,
      hairColor,
      outfitColor,
      snapshotDataUrl: this.faceSnapshotCanvas.toDataURL('image/png'),
      simulated: true,
    };
  }

  private renderVideoFaceToCanvas(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    skinHex: string,
    accentHex: string
  ) {
    ctx.clearRect(0, 0, 256, 256);

    // Base skin tone fill so edges blend seamlessly with the 3D sculpted head mesh
    ctx.fillStyle = skinHex;
    ctx.fillRect(0, 0, 256, 256);

    // Center crop of the user's face from the video stream
    const vw = video.videoWidth || 320;
    const vh = video.videoHeight || 240;
    const cropSize = Math.min(vw, vh) * 0.72;
    const sx = (vw - cropSize) * 0.5;
    const sy = (vh - cropSize) * 0.38;

    ctx.save();
    ctx.beginPath();
    ctx.arc(128, 128, 114, 0, Math.PI * 2);
    ctx.clip();

    ctx.translate(256, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, cropSize, cropSize, 10, 10, 236, 236);
    ctx.restore();

    // Soft radial feather into skinHex around the perimeter so 3D head UV seams disappear
    const feather = ctx.createRadialGradient(128, 128, 76, 128, 128, 122);
    feather.addColorStop(0, 'rgba(0,0,0,0)');
    feather.addColorStop(0.75, 'rgba(0,0,0,0)');
    feather.addColorStop(1, skinHex);
    ctx.fillStyle = feather;
    ctx.fillRect(0, 0, 256, 256);

    // Subtle cybernetic cheek telemetry contour lines
    ctx.strokeStyle = `${accentHex}88`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(46, 146);
    ctx.lineTo(78, 156);
    ctx.moveTo(210, 146);
    ctx.lineTo(178, 156);
    ctx.stroke();
  }

  private drawStylizedFacePortrait(
    ctx: CanvasRenderingContext2D,
    skinHex: string,
    hairHex: string,
    accentHex: string
  ) {
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = skinHex;
    ctx.fillRect(0, 0, 256, 256);

    // Soft facial shading
    const cheekGrad = ctx.createRadialGradient(128, 132, 18, 128, 132, 118);
    cheekGrad.addColorStop(0, 'rgba(255,255,255,0.12)');
    cheekGrad.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = cheekGrad;
    ctx.fillRect(0, 0, 256, 256);

    // Brows
    ctx.strokeStyle = hairHex;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(68, 92);
    ctx.quadraticCurveTo(88, 84, 106, 92);
    ctx.moveTo(150, 92);
    ctx.quadraticCurveTo(168, 84, 188, 92);
    ctx.stroke();

    // Expressive eyes with luminous cyber iris
    [88, 168].forEach((ex) => {
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.ellipse(ex, 112, 16, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = accentHex;
      ctx.beginPath();
      ctx.arc(ex, 112, 7.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex - 3, 109, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Sculpted nose highlight
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(128, 106);
    ctx.lineTo(124, 146);
    ctx.lineTo(135, 150);
    ctx.stroke();

    // Confident festival smile
    ctx.strokeStyle = '#3B1D2E';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(128, 162, 24, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // Cyber cheek LED accents
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(52, 144);
    ctx.lineTo(78, 152);
    ctx.moveTo(204, 144);
    ctx.lineTo(178, 152);
    ctx.stroke();
  }

  public update(
    elapsed: number,
    bass: number,
    beat: number,
    primaryHex: string,
    secondaryHex: string
  ): WebcamPoseMetrics {
    if (!this.pose.active) {
      return this.pose;
    }

    if (
      !this.pose.usingSimulatedFeed &&
      this.videoEl &&
      this.videoEl.readyState >= 2
    ) {
      // 1. Analyze 64x48 downsampled frame for centroid & left/right hand motion
      this.analysisCtx.save();
      this.analysisCtx.scale(-1, 1);
      this.analysisCtx.drawImage(this.videoEl, -64, 0, 64, 48);
      this.analysisCtx.restore();

      const frameData = this.analysisCtx.getImageData(0, 0, 64, 48).data;
      if (this.prevFrame) {
        let leftMotion = 0;
        let rightMotion = 0;
        let weightedX = 0;
        let weightedY = 0;
        let totalMotion = 0;

        for (let y = 0; y < 48; y++) {
          for (let x = 0; x < 64; x++) {
            const idx = (y * 64 + x) * 4;
            const diff =
              Math.abs(frameData[idx] - this.prevFrame[idx]) +
              Math.abs(frameData[idx + 1] - this.prevFrame[idx + 1]) +
              Math.abs(frameData[idx + 2] - this.prevFrame[idx + 2]);

            if (diff > 52) {
              totalMotion += diff;
              weightedX += (x / 64 - 0.5) * 2 * diff;
              weightedY += (0.5 - y / 48) * 2 * diff;
              if (x < 26) leftMotion += diff;
              else if (x > 38) rightMotion += diff;
            }
          }
        }

        if (totalMotion > 1800) {
          const targetX = Math.max(-0.85, Math.min(0.85, weightedX / totalMotion));
          const targetY = Math.max(-0.6, Math.min(0.6, weightedY / totalMotion));
          this.pose.headX = THREE.MathUtils.lerp(this.pose.headX, targetX, 0.22);
          this.pose.headY = THREE.MathUtils.lerp(this.pose.headY, targetY, 0.22);
        } else {
          this.pose.headX = THREE.MathUtils.lerp(this.pose.headX, 0, 0.08);
          this.pose.headY = THREE.MathUtils.lerp(this.pose.headY, 0, 0.08);
        }

        const normLeft = Math.min(1, leftMotion / 18000);
        const normRight = Math.min(1, rightMotion / 18000);
        const normEnergy = Math.min(1, totalMotion / 42000);

        this.pose.leftArmRaise = THREE.MathUtils.lerp(
          this.pose.leftArmRaise,
          Math.max(0.15 + bass * 0.35, normLeft),
          0.25
        );
        this.pose.rightArmRaise = THREE.MathUtils.lerp(
          this.pose.rightArmRaise,
          Math.max(0.15 + bass * 0.35, normRight),
          0.25
        );
        this.pose.motionEnergy = THREE.MathUtils.lerp(
          this.pose.motionEnergy,
          normEnergy,
          0.25
        );
      }
      this.prevFrame = new Uint8ClampedArray(frameData);

      // 2. Update live video face texture for 3D head UV mapping
      this.renderVideoFaceToCanvas(
        this.liveFaceCtx,
        this.videoEl,
        '#E2B897',
        primaryHex
      );
      this.liveFaceTexture.needsUpdate = true;

      // 3. Render stylized holographic / LED wall broadcast feed into 256x256 canvas texture
      const ctx = this.processCtx;
      ctx.clearRect(0, 0, 256, 256);

      ctx.save();
      ctx.translate(256, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(this.videoEl, 0, 0, 256, 256);
      ctx.restore();

      // Subtle holographic color grading & scanline overlay
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, `${primaryHex}44`);
      grad.addColorStop(0.5, 'rgba(0, 229, 255, 0.08)');
      grad.addColorStop(1, `${secondaryHex}55`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);

      // Scanlines
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.18)';
      ctx.lineWidth = 1.5;
      const offset = (elapsed * 40) % 8;
      for (let y = offset; y < 256; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.stroke();
      }

      // Outer glowing rim
      ctx.strokeStyle = primaryHex;
      ctx.lineWidth = 5 + beat * 4;
      ctx.strokeRect(4, 4, 248, 248);
      ctx.restore();

      this.holoTexture.needsUpdate = true;
    } else {
      // Simulated Live Performer mode (works even without webcam hardware)
      this.pose.headX = Math.sin(elapsed * 1.9) * 0.35;
      this.pose.headY = Math.cos(elapsed * 3.2) * (0.15 + bass * 0.25);
      this.pose.leftArmRaise = 0.45 + 0.45 * Math.sin(elapsed * 4.2) + beat * 0.25;
      this.pose.rightArmRaise = 0.45 + 0.45 * Math.cos(elapsed * 4.2) + beat * 0.25;
      this.pose.motionEnergy = 0.55 + bass * 0.4;

      this.drawSimulatedPerformer(elapsed, bass + beat * 0.5, primaryHex, secondaryHex);
      this.holoTexture.needsUpdate = true;
    }

    return this.pose;
  }

  private drawSimulatedPerformer(
    elapsed: number,
    energy: number,
    primaryHex: string,
    secondaryHex: string
  ) {
    const ctx = this.processCtx;
    ctx.clearRect(0, 0, 256, 256);

    // Deep holographic backdrop
    const bgGrad = ctx.createRadialGradient(128, 115, 16, 128, 128, 150);
    bgGrad.addColorStop(0, '#14204B');
    bgGrad.addColorStop(0.75, '#080B1D');
    bgGrad.addColorStop(1, '#050714');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 256, 256);

    // Animated surreal cyber-DJ silhouette & visor inside broadcast feed
    const headX = 128 + Math.sin(elapsed * 2.1) * 14;
    const headY = 96 - Math.abs(Math.sin(elapsed * 4.2)) * (8 + energy * 10);

    // Aura rings behind head
    ctx.strokeStyle = secondaryHex;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(headX, headY, 48 + energy * 16, 0, Math.PI * 2);
    ctx.stroke();

    // Shoulders & upper torso silhouette
    const torsoGrad = ctx.createLinearGradient(68, 140, 188, 246);
    torsoGrad.addColorStop(0, primaryHex);
    torsoGrad.addColorStop(1, secondaryHex);
    ctx.fillStyle = torsoGrad;
    ctx.beginPath();
    ctx.moveTo(54, 248);
    ctx.quadraticCurveTo(72, 152, headX - 20, 144);
    ctx.lineTo(headX + 20, 144);
    ctx.quadraticCurveTo(184, 152, 202, 248);
    ctx.closePath();
    ctx.fill();

    // Sculpted head silhouette
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.arc(headX, headY, 31, 0, Math.PI * 2);
    ctx.fill();

    // Luminous cyber-visor across eyes
    ctx.fillStyle = primaryHex;
    ctx.fillRect(headX - 24, headY - 8, 48, 14);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(headX - 18, headY - 4, 36, 5);

    // Scanline grid
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.24)';
    ctx.lineWidth = 1.5;
    const offset = (elapsed * 36) % 8;
    for (let y = offset; y < 256; y += 8) {
      ctx.beginPath();
      ctx.moveTo(8, y);
      ctx.lineTo(248, y);
      ctx.stroke();
    }

    // Outer neon frame
    ctx.strokeStyle = primaryHex;
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, 248, 248);
  }
}

export const sharedWebcamBridge = new WebcamStageBridge();
