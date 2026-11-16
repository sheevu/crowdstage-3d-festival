import * as THREE from 'three';

export function createSkyDomeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTopColor: { value: new THREE.Color('#060818') },
      uHorizonColor: { value: new THREE.Color('#17123B') },
      uAccentColor: { value: new THREE.Color('#00E5FF') },
      uSecondaryColor: { value: new THREE.Color('#FF3CAC') },
      uTime: { value: 0 },
      uBass: { value: 0 },
      uStarIntensity: { value: 0.9 },
      uSunElevation: { value: -0.1 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uAccentColor;
      uniform vec3 uSecondaryColor;
      uniform float uTime;
      uniform float uBass;
      uniform float uStarIntensity;
      uniform float uSunElevation;
      varying vec3 vWorldPos;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      void main() {
        vec3 dir = normalize(vWorldPos);
        float h = clamp(dir.y, -0.15, 1.0);
        float horizonFactor = pow(1.0 - clamp(h, 0.0, 1.0), 2.3);
        vec3 col = mix(uTopColor, uHorizonColor, horizonFactor);

        // Volumetric aurora / festival sky glow ribbon
        float wave = sin(dir.x * 4.5 + uTime * 0.35) * cos(dir.z * 3.5 - uTime * 0.25);
        float ribbon = smoothstep(0.05, 0.55, h) * smoothstep(0.85, 0.25, h) * (0.5 + 0.5 * wave);
        col += mix(uAccentColor, uSecondaryColor, 0.5 + 0.5 * sin(dir.x * 2.0 + uTime * 0.2))
               * ribbon * (0.14 + uBass * 0.22);

        // Horizon sun/moon halo
        vec3 sunDir = normalize(vec3(0.2, uSunElevation, -0.95));
        float sunDot = max(dot(dir, sunDir), 0.0);
        col += mix(uSecondaryColor, vec3(1.0, 0.88, 0.65), 0.6) * pow(sunDot, 14.0) * 0.45;
        col += vec3(1.0, 0.95, 0.85) * smoothstep(0.996, 0.999, sunDot) * 0.65;

        // Crisp starfield in upper sky
        vec3 starGrid = floor(dir * 260.0);
        float starVal = hash31(starGrid);
        if (starVal > 0.993 && h > 0.06) {
          float twinkle = 0.6 + 0.4 * sin(uTime * 3.0 + starVal * 100.0);
          col += vec3(0.85, 0.93, 1.0) * twinkle * uStarIntensity * smoothstep(0.06, 0.35, h);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export function createLedWallMaterial(
  spectrumTex: THREE.DataTexture,
  primaryHex: string,
  secondaryHex: string,
  webcamTex?: THREE.Texture
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uBeat: { value: 0 },
      uPreset: { value: 0 }, // 0=spectrum, 1=plasma, 2=mandala, 3=waveform, 4=strobe-grid, 5=live-cam
      uPrimary: { value: new THREE.Color(primaryHex) },
      uSecondary: { value: new THREE.Color(secondaryHex) },
      uSpectrumTex: { value: spectrumTex },
      uWebcamTex: { value: webcamTex ?? spectrumTex },
      uReducedFlashing: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uBass;
      uniform float uMid;
      uniform float uTreble;
      uniform float uBeat;
      uniform float uPreset;
      uniform vec3 uPrimary;
      uniform vec3 uSecondary;
      uniform sampler2D uSpectrumTex;
      uniform sampler2D uWebcamTex;
      uniform float uReducedFlashing;
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv;
        vec2 centered = uv - 0.5;
        float dist = length(centered);
        float angle = atan(centered.y, centered.x);

        // LED pixel grid sub-matrix
        vec2 cell = fract(uv * vec2(56.0, 32.0)) - 0.5;
        float pixelMask = smoothstep(0.48, 0.26, max(abs(cell.x), abs(cell.y)));

        vec3 col = vec3(0.03, 0.04, 0.09);

        if (uPreset < 0.5) {
          // 0: Mirror Spectrum Analyzer + Chromatic Bars
          float symX = abs(uv.x - 0.5) * 2.0;
          float freq = texture2D(uSpectrumTex, vec2(symX, 0.5)).r;
          float barH = 0.12 + freq * 0.85;
          float ySym = abs(uv.y - 0.5) * 2.0;
          float barMask = smoothstep(barH + 0.02, barH - 0.04, ySym);
          vec3 grad = mix(uPrimary, uSecondary, symX);
          col += grad * barMask * (1.1 + uBeat * 0.6);
          col += uPrimary * 0.18 * smoothstep(0.04, 0.0, abs(ySym));
        } else if (uPreset < 1.5) {
          // 1: Plasma Tunnel with Chromatic Dispersion
          float r = dist * (1.0 - uBass * 0.15);
          float p1 = sin(r * 18.0 - uTime * 4.0 + uBass * 3.0);
          float p2 = cos(angle * 6.0 + uTime * 2.0);
          float pR = 0.5 + 0.5 * sin(p1 + p2 + 0.25);
          float pG = 0.5 + 0.5 * sin(p1 + p2);
          float pB = 0.5 + 0.5 * sin(p1 + p2 - 0.25);
          vec3 tunnel = vec3(pR, pG, pB);
          col += mix(uPrimary, uSecondary, tunnel.r) * (0.45 + uMid * 0.9) * tunnel;
        } else if (uPreset < 2.5) {
          // 2: Sacred Mandala Lotus Geometry
          float petals = 8.0 + floor(uMid * 4.0);
          float flower = abs(cos(angle * petals * 0.5 + uTime * 0.6)) * 0.32 + 0.15;
          float ring1 = smoothstep(0.025, 0.0, abs(dist - flower * (0.7 + uBass * 0.35)));
          float ring2 = smoothstep(0.02, 0.0, abs(fract(dist * 7.0 - uTime * 0.9) - 0.5) - 0.12);
          col += mix(uPrimary, uSecondary, 0.5 + 0.5 * sin(dist * 12.0 - uTime * 2.0))
                 * (ring1 * 1.4 + ring2 * (0.4 + uTreble * 0.8));
        } else if (uPreset < 3.5) {
          // 3: Dual Audio Waveform Oscilloscope
          float freq = texture2D(uSpectrumTex, vec2(uv.x, 0.5)).r;
          float waveY = 0.5 + sin(uv.x * 22.0 - uTime * 6.0) * (0.08 + uBass * 0.28) * (0.4 + freq);
          float lineGlow = smoothstep(0.05, 0.0, abs(uv.y - waveY));
          float waveY2 = 0.5 + cos(uv.x * 16.0 + uTime * 4.5) * (0.06 + uTreble * 0.24);
          float lineGlow2 = smoothstep(0.04, 0.0, abs(uv.y - waveY2));
          col += uPrimary * lineGlow * 1.6 + uSecondary * lineGlow2 * 1.4;
        } else if (uPreset < 4.5) {
          // 4: Kinetic Strobe Matrix (respects reduced flashing)
          vec2 tile = floor(uv * vec2(12.0, 6.0));
          float checker = mod(tile.x + tile.y + floor(uTime * (uReducedFlashing > 0.5 ? 1.5 : 6.0)), 2.0);
          float pulse = mix(0.3, 1.0, checker) * (0.45 + uBeat * (uReducedFlashing > 0.5 ? 0.25 : 0.95));
          col += mix(uPrimary, uSecondary, uv.x) * pulse;
        } else {
          // 5: Live Camera Broadcast Feed on Large Stage LED Screens
          float shift = (0.003 + uBass * 0.008) * (1.0 - uReducedFlashing * 0.7);
          float camR = texture2D(uWebcamTex, uv + vec2(shift, 0.0)).r;
          float camG = texture2D(uWebcamTex, uv).g;
          float camB = texture2D(uWebcamTex, uv - vec2(shift, 0.0)).b;
          vec3 camCol = vec3(camR, camG, camB) * (1.28 + uBeat * 0.35);

          // Overlay audio spectrum bars along bottom edge of live LED broadcast
          float symX = abs(uv.x - 0.5) * 2.0;
          float freq = texture2D(uSpectrumTex, vec2(symX, 0.5)).r;
          float eqMask = smoothstep(freq * 0.28 + 0.02, freq * 0.28 - 0.01, uv.y);
          vec3 eqCol = mix(uPrimary, uSecondary, symX) * eqMask * 0.85;

          // Glowing frame border synced to bass
          float border = smoothstep(0.42, 0.49, max(abs(centered.x), abs(centered.y)));
          col = camCol + eqCol + mix(uPrimary, uSecondary, uv.y) * border * (0.7 + uBass * 0.8);
        }

        // Apply crisp LED diode grid + outer rim vignette
        col *= mix(0.66, 1.15, pixelMask);
        float edge = smoothstep(0.5, 0.45, max(abs(centered.x), abs(centered.y)));
        col *= mix(0.45, 1.0, edge);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export function createVolumetricConeMaterial(colorHex: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uIntensity: { value: 0.65 },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        // Soft Fresnel fade so cone edges dissolve naturally without hard polygon lines
        float fresnel = pow(abs(dot(vNormalView, vViewDir)), 1.85);
        // Vertical attenuation from spotlight emitter (vUv.y = 1) down to stage floor (vUv.y = 0)
        float lengthFade = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
        // Subtle atmospheric dust shimmer inside beam
        float dust = 0.82 + 0.18 * sin(vUv.y * 24.0 - uTime * 4.5 + vUv.x * 12.0);
        float alpha = fresnel * lengthFade * dust * uIntensity;
        gl_FragColor = vec4(uColor * (1.25 + uIntensity * 0.4), clamp(alpha, 0.0, 0.68));
      }
    `,
  });
}

export const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    uIntensity: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    varying vec2 vUv;
    void main() {
      vec2 dir = vUv - vec2(0.5);
      float d = length(dir);
      vec2 offset = dir * d * uIntensity;
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

export function createPortalShaderMaterial(
  primaryHex: string,
  secondaryHex: string
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uPrimary: { value: new THREE.Color(primaryHex) },
      uSecondary: { value: new THREE.Color(secondaryHex) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uBass;
      uniform vec3 uPrimary;
      uniform vec3 uSecondary;
      varying vec2 vUv;

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0) discard;
        float a = atan(p.y, p.x);

        // SDF concentric portal vortex rings
        float swirl = sin(a * 5.0 - r * 10.0 + uTime * 3.5);
        float sdfRing = smoothstep(0.14, 0.0, abs(r - 0.82 + swirl * 0.04));
        float innerVortex = smoothstep(0.95, 0.05, r) * (0.45 + 0.55 * sin(r * 16.0 - uTime * 5.0 + a * 3.0));
        vec3 col = mix(uPrimary, uSecondary, 0.5 + 0.5 * sin(a + uTime * 2.0));
        float alpha = clamp(sdfRing * 0.95 + innerVortex * (0.45 + uBass * 0.4), 0.0, 0.95);
        gl_FragColor = vec4(col * (1.2 + uBass * 0.5), alpha);
      }
    `,
  });
}

export function createSharpLaserMaterial(
  primaryHex: string,
  secondaryHex: string
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uPrimary: { value: new THREE.Color(primaryHex) },
      uSecondary: { value: new THREE.Color(secondaryHex) },
      uTime: { value: 0 },
      uBass: { value: 0 },
      uSharpness: { value: 1.0 },
      uStrobe: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uPrimary;
      uniform vec3 uSecondary;
      uniform float uTime;
      uniform float uBass;
      uniform float uSharpness;
      uniform float uStrobe;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        // High-exponent axial alignment for razor-sharp collimated diode laser beam
        float centerAlign = abs(dot(vNormalView, vViewDir));
        float coreMask = pow(centerAlign, mix(5.5, 11.0, clamp(uSharpness, 0.2, 1.5)));
        float sheathMask = pow(centerAlign, 2.2);

        // Coherent optical pulse waves racing along beam length
        float scanPulse = 0.86 + 0.14 * sin(vUv.y * 85.0 - uTime * 28.0);
        // Distance attenuation only at the very far tip so the laser stays needle-sharp
        float tipFade = smoothstep(1.0, 0.88, vUv.y) * smoothstep(0.0, 0.03, vUv.y);

        vec3 outerColor = mix(uPrimary, uSecondary, clamp(vUv.y * 0.9 + 0.2 * sin(uTime * 3.0), 0.0, 1.0));
        // Pure white-hot coherent laser center core + vivid neon outer sheath
        vec3 finalCol = mix(outerColor * 1.65, vec3(1.0, 1.0, 1.0), coreMask * 0.88);
        finalCol += vec3(1.0) * uStrobe * 0.65;

        float alpha = clamp((coreMask * 1.15 + sheathMask * (0.48 + uBass * 0.35)) * scanPulse * tipFade, 0.0, 0.98);
        gl_FragColor = vec4(finalCol, alpha);
      }
    `,
  });
}

export function createFloorOverlayMaterial(
  primaryHex: string,
  secondaryHex: string
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    uniforms: {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uBeat: { value: 0 },
      uStrobe: { value: 0 },
      uMode: { value: 0 }, // 0=cyber grid, 1=desert sand rings, 2=crystal runes, 3=mandala rangoli, 4=water caustics
      uFloorStyle: { value: 2 }, // 0=reflective-water, 1=polished-obsidian, 2=gridded-cyber-neon
      uPrimary: { value: new THREE.Color(primaryHex) },
      uSecondary: { value: new THREE.Color(secondaryHex) },
    },
    vertexShader: `
      varying vec2 vWorldXZ;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldXZ = wp.xz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uBass;
      uniform float uBeat;
      uniform float uStrobe;
      uniform float uMode;
      uniform float uFloorStyle;
      uniform vec3 uPrimary;
      uniform vec3 uSecondary;
      varying vec2 vWorldXZ;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        float dist = length(vWorldXZ);
        float radialFade = smoothstep(54.0, 10.0, dist);
        if (radialFade <= 0.001) discard;

        vec3 col = vec3(0.0);
        float alpha = 0.0;

        if (uFloorStyle < 0.5) {
          // 0: REFLECTIVE WATER — Concentric bass ripples + shimmering aquatic caustics
          vec2 p = vWorldXZ * 0.24;
          float ripple1 = sin(dist * 1.35 - uTime * 3.8 + uBass * 2.5);
          float ripple2 = cos(p.x * 3.4 + uTime * 1.6 + sin(p.y * 2.9 - uTime * 1.3));
          float caustic = pow(clamp(0.5 + 0.5 * (ripple1 * 0.55 + ripple2 * 0.45), 0.0, 1.0), 2.4);
          float crest = smoothstep(0.92, 0.99, 0.5 + 0.5 * ripple1);
          col = mix(vec3(0.0, 0.9, 1.0), uPrimary, 0.45) * caustic * 1.35
                + vec3(0.85, 0.98, 1.0) * crest * (0.45 + uBeat * 0.55);
          alpha = (caustic * 0.42 + crest * 0.36) * radialFade;
        } else if (uFloorStyle < 1.5) {
          // 1: POLISHED OBSIDIAN — Mirror-dark volcanic marble veins + metallic gold/neon specular seams
          vec2 cell = vWorldXZ * 0.18;
          float vein1 = abs(sin(cell.x * 2.2 + cos(cell.y * 1.9) * 1.6 + uTime * 0.15));
          float vein2 = abs(cos(cell.y * 2.7 - sin(cell.x * 2.1) * 1.4));
          float seam = smoothstep(0.065, 0.0, vein1 * vein2);
          float ringPulse = smoothstep(0.12, 0.0, abs(fract(dist * 0.08 - uTime * 0.35) - 0.5));
          vec3 goldAccent = mix(vec3(1.0, 0.78, 0.25), uPrimary, 0.5);
          col = mix(goldAccent, uSecondary, smoothstep(6.0, 32.0, dist)) * (1.1 + uBeat * 0.45);
          alpha = (seam * 0.46 + ringPulse * (0.18 + uBass * 0.32)) * radialFade;
        } else {
          // 2: GRIDDED CYBER-NEON — Razor-sharp dual-scale perspective synthwave grid + circuit nodes
          vec2 majorUV = vWorldXZ * 0.5;
          vec2 minorUV = vWorldXZ * 2.0;
          vec2 gMajor = abs(fract(majorUV - 0.5) - 0.5) / fwidth(majorUV);
          vec2 gMinor = abs(fract(minorUV - 0.5) - 0.5) / fwidth(minorUV);
          float majorLine = 1.0 - min(min(gMajor.x, gMajor.y), 1.0);
          float minorLine = 1.0 - min(min(gMinor.x, gMinor.y), 1.0);

          float pulseWave = smoothstep(1.8, 0.0, abs(fract(dist * 0.065 - uTime * 0.5) - 0.5) * 14.0);
          vec2 cellId = floor(majorUV);
          float nodeGlow = step(0.84, fract(hash21(cellId) + uTime * 0.25)) * (0.35 + uBeat * 0.65);

          col = mix(uPrimary, uSecondary, smoothstep(6.0, 34.0, dist)) * (1.25 + uBeat * 0.45);
          col += vec3(1.0) * majorLine * 0.35;
          alpha = (majorLine * 0.62 + minorLine * 0.16 + pulseWave * (0.28 + uBass * 0.42) + nodeGlow * 0.12) * radialFade;
        }

        // Strobe reflection flash across floor
        col += vec3(1.0) * uStrobe * 0.45;
        alpha = clamp(alpha + uStrobe * 0.18 * radialFade, 0.0, 0.92);

        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}
