import { AudioMetrics, CrowdAggressionLevel } from '../types/festival';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;

  private audioEl: HTMLAudioElement | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private currentObjectUrl: string | null = null;

  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  private synthTimer: number | null = null;
  private synthStep = 0;
  private synthTempoBpm = 126;

  private freqData = new Uint8Array(512);
  private timeData = new Uint8Array(512);
  private prevSpectrum = new Float32Array(128);

  private beatEnvelope = 0;
  private avgEnergy = 0.15;
  private lastBeatTime = 0;
  private beatIntervals: number[] = [];
  private smoothedCrowdIntensity = 0.22;

  private sourceType: AudioMetrics['sourceType'] = 'none';
  private trackName = 'No track active';
  private isPlaying = false;
  private volume = 0.85;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.74;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;

      this.analyser.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.frequencyBinCount);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
    }
  }

  public getSynthBpm(): number {
    return this.synthTempoBpm;
  }

  public async loadFile(file: File): Promise<void> {
    this.stopAllSources();
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
    }
    this.currentObjectUrl = URL.createObjectURL(file);

    if (!this.audioEl) {
      this.audioEl = new Audio();
      this.audioEl.crossOrigin = 'anonymous';
      this.audioEl.loop = true;
      this.audioEl.setAttribute('playsinline', 'true');
    }

    this.audioEl.src = this.currentObjectUrl;
    if (!this.mediaSource && this.analyser) {
      this.mediaSource = ctx.createMediaElementSource(this.audioEl);
      this.mediaSource.connect(this.analyser);
    }

    this.beatIntervals = [];
    await this.audioEl.play();
    this.sourceType = 'file';
    this.trackName = file.name.replace(/\.[^/.]+$/, '');
    this.isPlaying = true;
  }

  public async startSynth(tempoBpm = 126): Promise<void> {
    this.stopAllSources();
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const clampedBpm = Math.max(70, Math.min(185, Math.round(tempoBpm)));
    this.synthTempoBpm = clampedBpm;
    this.sourceType = 'synth';
    const genreTag =
      clampedBpm >= 145
        ? 'DnB / Mosh Overdrive'
        : clampedBpm >= 126
          ? 'Mainstage Rave'
          : clampedBpm >= 105
            ? 'Festival Groove'
            : 'Chill Sunset Wave';
    this.trackName = `CrowdStage Synth · ${ genreTag } (${ clampedBpm } BPM)`;
    this.isPlaying = true;
    this.synthStep = 0;

    const stepMs = (60 / clampedBpm / 4) * 1000; // 16th note
    const scale = [130.81, 155.56, 174.61, 196.0, 233.08, 261.63, 311.13, 392.0]; // C minor pentatonic

    const triggerStep = () => {
      if (!this.isPlaying || this.sourceType !== 'synth' || !this.ctx || !this.analyser) return;
      const now = this.ctx.currentTime;
      const step = this.synthStep % 16;
      const isHighBpm = this.synthTempoBpm >= 140;

      // 1. Sub-Bass + Punchy Kick Drum (Four-on-the-floor or Syncopated Breakbeat at high BPM)
      const isKickStep = isHighBpm
        ? step === 0 || step === 3 || step === 6 || step === 10 || step === 12
        : step % 4 === 0;
      if (isKickStep) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isHighBpm ? 165 : 145, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.14);
        gain.gain.setValueAtTime(0.92, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
        osc.connect(gain);
        gain.connect(this.analyser);
        osc.start(now);
        osc.stop(now + 0.28);
      }

      // 2. Aggressive Snare / Clap on beats 4 and 12 (strong High-Mid energy for headbang response)
      if (step === 4 || step === 12 || (isHighBpm && step === 15)) {
        const snareOsc = this.ctx.createOscillator();
        const snareFilter = this.ctx.createBiquadFilter();
        const snareGain = this.ctx.createGain();
        snareOsc.type = 'triangle';
        snareOsc.frequency.setValueAtTime(2400, now);
        snareOsc.frequency.exponentialRampToValueAtTime(420, now + 0.09);
        snareFilter.type = 'bandpass';
        snareFilter.frequency.setValueAtTime(1850, now);
        snareGain.gain.setValueAtTime(isHighBpm ? 0.34 : 0.22, now);
        snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        snareOsc.connect(snareFilter);
        snareFilter.connect(snareGain);
        snareGain.connect(this.analyser);
        snareOsc.start(now);
        snareOsc.stop(now + 0.12);
      }

      // 3. Off-beat driving Sawtooth Bassline (60-400Hz)
      if (step % 2 === 1 || (isHighBpm && step % 3 === 0)) {
        const bassOsc = this.ctx.createOscillator();
        const bassFilter = this.ctx.createBiquadFilter();
        const bassGain = this.ctx.createGain();
        const bassNote = step < 8 ? 65.41 : step < 12 ? 77.78 : 58.27;
        bassOsc.type = 'sawtooth';
        bassOsc.frequency.setValueAtTime(bassNote, now);
        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(
          380 + (step % 4) * 160 + (isHighBpm ? 320 : 0),
          now
        );
        bassGain.gain.setValueAtTime(0.32, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        bassOsc.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(this.analyser);
        bassOsc.start(now);
        bassOsc.stop(now + 0.15);
      }

      // 4. Midrange Synth Lead / Arp (500-2500Hz)
      if (step % 2 === 0 || isHighBpm) {
        const arpOsc = this.ctx.createOscillator();
        const arpGain = this.ctx.createGain();
        const note = scale[(this.synthStep + (step % 3)) % scale.length];
        arpOsc.type = isHighBpm ? 'sawtooth' : 'triangle';
        arpOsc.frequency.setValueAtTime(note * (isHighBpm ? 2.5 : 2), now);
        arpGain.gain.setValueAtTime(0.15, now);
        arpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        arpOsc.connect(arpGain);
        arpGain.connect(this.analyser);
        arpOsc.start(now);
        arpOsc.stop(now + 0.16);
      }

      // 5. Crisp Brilliance Hi-Hat (5kHz-12kHz)
      if (step % 2 === 1 || isHighBpm) {
        const hatOsc = this.ctx.createOscillator();
        const hatFilter = this.ctx.createBiquadFilter();
        const hatGain = this.ctx.createGain();
        hatOsc.type = 'square';
        hatOsc.frequency.setValueAtTime(7200 + (step % 3) * 1600, now);
        hatFilter.type = 'highpass';
        hatFilter.frequency.setValueAtTime(5400, now);
        hatGain.gain.setValueAtTime(step % 4 === 2 ? 0.095 : 0.045, now);
        hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        hatOsc.connect(hatFilter);
        hatFilter.connect(hatGain);
        hatGain.connect(this.analyser);
        hatOsc.start(now);
        hatOsc.stop(now + 0.06);
      }

      // 6. Harmonic Pad Chord on Beat 0
      if (step === 0) {
        [261.63, 311.13, 392.0].forEach((freq) => {
          if (!this.ctx || !this.analyser) return;
          const padOsc = this.ctx.createOscillator();
          const padGain = this.ctx.createGain();
          padOsc.type = 'sine';
          padOsc.frequency.setValueAtTime(freq, now);
          padGain.gain.setValueAtTime(0.001, now);
          padGain.gain.linearRampToValueAtTime(0.055, now + 0.12);
          padGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
          padOsc.connect(padGain);
          padGain.connect(this.analyser);
          padOsc.start(now);
          padOsc.stop(now + 1.25);
        });
      }

      this.synthStep++;
    };

    triggerStep();
    this.synthTimer = window.setInterval(triggerStep, stepMs);
  }

  public async startMicrophone(): Promise<void> {
    this.stopAllSources();
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.micStream = stream;
    // Non-routed branch so mic does not feedback through speakers
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(0, ctx.currentTime);
    }
    this.micSource = ctx.createMediaStreamSource(stream);
    if (this.analyser) {
      this.micSource.connect(this.analyser);
    }
    this.beatIntervals = [];
    this.sourceType = 'mic';
    this.trackName = 'Live Microphone Input';
    this.isPlaying = true;
  }

  public togglePlayPause(): boolean {
    if (this.sourceType === 'none') {
      void this.startSynth(this.synthTempoBpm);
      return true;
    }
    if (this.sourceType === 'file' && this.audioEl) {
      if (this.audioEl.paused) {
        void this.ctx?.resume();
        void this.audioEl.play();
        this.isPlaying = true;
      } else {
        this.audioEl.pause();
        this.isPlaying = false;
      }
      return this.isPlaying;
    }
    if (this.sourceType === 'synth') {
      if (this.isPlaying) {
        if (this.synthTimer !== null) {
          clearInterval(this.synthTimer);
          this.synthTimer = null;
        }
        this.isPlaying = false;
      } else {
        void this.startSynth(this.synthTempoBpm);
      }
      return this.isPlaying;
    }
    return this.isPlaying;
  }

  public stopAllSources() {
    if (this.synthTimer !== null) {
      clearInterval(this.synthTimer);
      this.synthTimer = null;
    }
    if (this.audioEl) {
      this.audioEl.pause();
    }
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
    this.isPlaying = false;
    this.sourceType = 'none';
    this.trackName = 'No track active';
  }

  public sample(
    dt: number,
    afrSensitivity = 1.2,
    bpmOverride: number | null = null
  ): {
    metrics: AudioMetrics;
    freqBins: Uint8Array;
    waveBins: Uint8Array;
  } {
    const gain = Math.max(0.4, Math.min(2.4, afrSensitivity));

    if (!this.analyser || !this.isPlaying) {
      this.beatEnvelope = Math.max(0, this.beatEnvelope - dt * 3.5);
      const idleBpm = bpmOverride ?? this.synthTempoBpm ?? 124;
      const idleSpeed = Math.max(0.65, Math.min(2.2, (idleBpm / 120) * 0.85));
      const idleAggression: CrowdAggressionLevel =
        idleBpm >= 144
          ? 'mosh-frenzy'
          : idleBpm >= 125
            ? 'hype-jumping'
            : idleBpm >= 102
              ? 'upbeat-bouncing'
              : 'chill-grooving';

      return {
        metrics: {
          subBass: 0,
          bass: 0,
          lowMid: 0,
          mid: 0,
          highMid: 0,
          treble: 0,
          presence: 0,
          brilliance: 0,
          amplitude: 0,
          beatIntensity: this.beatEnvelope,
          spectralFlux: 0,
          bpmEstimate: idleBpm,
          crowdIntensity: 0.18,
          danceSpeedMultiplier: idleSpeed,
          aggressionLevel: idleAggression,
          isPlaying: this.isPlaying,
          sourceType: this.sourceType,
          trackName: this.trackName,
        },
        freqBins: this.freqData,
        waveBins: this.timeData,
      };
    }

    this.analyser.getByteFrequencyData(this.freqData);
    this.analyser.getByteTimeDomainData(this.timeData);

    // 7-Band Real-Time Audio Frequency Response (512 bins @ ~43Hz/bin)
    // 1. Sub-Bass (bins 0..2, ~20-90Hz): Ground Stomp & Jump Height
    let subSum = 0;
    for (let i = 0; i < 3; i++) subSum += this.freqData[i];
    const subBass = Math.min(1, (subSum / (3 * 255)) * gain);

    // 2. Punch Bass (bins 2..8, ~90-340Hz): Knee Drive & Step Bounce
    let bassSum = 0;
    for (let i = 2; i < 9; i++) bassSum += this.freqData[i];
    const bass = Math.min(1, (bassSum / (7 * 255)) * gain);

    // 3. Low-Mid (bins 9..20, ~350-860Hz): Hip Sway & Torso Groove
    let lowMidSum = 0;
    for (let i = 9; i < 20; i++) lowMidSum += this.freqData[i];
    const lowMid = Math.min(1, (lowMidSum / (11 * 255)) * gain);

    // 4. Midrange (bins 20..56, ~860-2400Hz): Arm Pump & Shoulder Roll
    let midSum = 0;
    for (let i = 20; i < 56; i++) midSum += this.freqData[i];
    const mid = Math.min(1, (midSum / (36 * 255)) * gain);

    // 5. High-Mid (bins 56..105, ~2.4kHz-4.5kHz): Headbang & Vocal Hype
    let highMidSum = 0;
    for (let i = 56; i < 105; i++) highMidSum += this.freqData[i];
    const highMid = Math.min(1, (highMidSum / (49 * 255)) * gain);

    // 6. Presence (bins 105..185, ~4.5kHz-8kHz): Held Props & Totem Waving
    let presSum = 0;
    for (let i = 105; i < 185; i++) presSum += this.freqData[i];
    const presence = Math.min(1, (presSum / (80 * 255)) * gain);

    // 7. Brilliance / Air (bins 185..320, ~8kHz-14kHz): LED Wristbands & Strobe Shimmer
    let brilSum = 0;
    for (let i = 185; i < 320; i++) brilSum += this.freqData[i];
    const brilliance = Math.min(1, (brilSum / (135 * 255)) * gain);

    const treble = Math.min(1, presence * 0.55 + brilliance * 0.45);
    const amplitude = Math.min(
      1,
      subBass * 0.25 + bass * 0.28 + lowMid * 0.15 + mid * 0.18 + treble * 0.14
    );

    // Spectral flux over first 128 bins
    let flux = 0;
    for (let i = 0; i < 128; i++) {
      const val = this.freqData[i] / 255;
      const diff = val - this.prevSpectrum[i];
      if (diff > 0) flux += diff;
      this.prevSpectrum[i] = val;
    }
    flux = Math.min(1, (flux / 15) * gain);

    // Adaptive Onset / Beat Detector (supports fast 180 BPM drum & bass down to 70 BPM)
    const lowEnergy = Math.max(subBass, bass);
    this.avgEnergy = this.avgEnergy * 0.92 + lowEnergy * 0.08;
    const nowMs = performance.now();
    if (
      lowEnergy > this.avgEnergy * 1.24 &&
      lowEnergy > 0.18 &&
      nowMs - this.lastBeatTime > 210
    ) {
      const interval = nowMs - this.lastBeatTime;
      if (interval > 260 && interval < 950) {
        this.beatIntervals.push(interval);
        if (this.beatIntervals.length > 10) this.beatIntervals.shift();
      }
      this.lastBeatTime = nowMs;
      this.beatEnvelope = 1.0;
    } else {
      this.beatEnvelope = Math.max(0, this.beatEnvelope - dt * 3.9);
    }

    // BPM Calculation: Exact when Synth or Override is used, Median Onset Tracker for Live Audio/Mic
    let bpmEstimate = this.synthTempoBpm || 126;
    if (bpmOverride && bpmOverride >= 70 && bpmOverride <= 185) {
      bpmEstimate = Math.round(bpmOverride);
    } else if (this.sourceType === 'synth') {
      bpmEstimate = this.synthTempoBpm;
    } else if (this.beatIntervals.length >= 3) {
      const sorted = [...this.beatIntervals].sort((a, b) => a - b);
      const midIdx = Math.floor(sorted.length / 2);
      const medianInterval = sorted[midIdx];
      let rawBpm = 60000 / medianInterval;
      // Fold half-time / double-time into festival range 75..180
      if (rawBpm < 75) rawBpm *= 2;
      if (rawBpm > 182) rawBpm *= 0.5;
      bpmEstimate = Math.round(Math.max(72, Math.min(182, rawBpm)));
    }

    // Real-Time Crowd Intensity & BPM-to-Dance Speed / Aggression Mapping
    const rawCrowdIntensity = Math.min(
      1,
      subBass * 0.28 +
        bass * 0.26 +
        this.beatEnvelope * 0.22 +
        highMid * 0.14 +
        flux * 0.1
    );
    this.smoothedCrowdIntensity =
      this.smoothedCrowdIntensity * 0.84 + rawCrowdIntensity * 0.16;

    const bpmFactor = bpmEstimate / 120; // 1.0 at 120 BPM, 1.45 at 174 BPM, 0.75 at 90 BPM
    const danceSpeedMultiplier = Number(
      Math.max(
        0.55,
        Math.min(2.45, bpmFactor * (0.78 + this.smoothedCrowdIntensity * 0.62))
      ).toFixed(2)
    );

    const aggressionScore =
      (bpmEstimate - 85) / 75 + this.smoothedCrowdIntensity * 0.75 + highMid * 0.25;
    const aggressionLevel: CrowdAggressionLevel =
      aggressionScore >= 1.25 || bpmEstimate >= 144
        ? 'mosh-frenzy'
        : aggressionScore >= 0.85 || bpmEstimate >= 124
          ? 'hype-jumping'
          : aggressionScore >= 0.45 || bpmEstimate >= 100
            ? 'upbeat-bouncing'
            : 'chill-grooving';

    return {
      metrics: {
        subBass,
        bass,
        lowMid,
        mid,
        highMid,
        treble,
        presence,
        brilliance,
        amplitude,
        beatIntensity: this.beatEnvelope,
        spectralFlux: flux,
        bpmEstimate,
        crowdIntensity: this.smoothedCrowdIntensity,
        danceSpeedMultiplier,
        aggressionLevel,
        isPlaying: this.isPlaying,
        sourceType: this.sourceType,
        trackName: this.trackName,
      },
      freqBins: this.freqData,
      waveBins: this.timeData,
    };
  }

  public dispose() {
    this.stopAllSources();
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

export const sharedAudioEngine = new AudioEngine();
