/**
 * Every sound in the house is synthesized with the Web Audio API at play time: no recordings, no
 * downloads, nothing copyrighted. The context is created on the first user gesture, as browsers
 * require, and every method is a no-op until then or when audio is unavailable.
 */

export type SoundName = 'candle' | 'snuff' | 'chime' | 'restored' | 'breath' | 'moan' | 'rattle' | 'click';

/** A live AudioContext in the app; an OfflineAudioContext when the sound check renders to a buffer. */
type Ctx = BaseAudioContext;

export class SoundEngine {
  private ctx: Ctx | null = null;
  private live: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientNodes: { stop: () => void } | null = null;
  private noise: AudioBuffer | null = null;
  private hiss: AudioBuffer | null = null;
  private volume = 0.6;
  private muted = false;
  private ambientWanted = false;

  /** Call from a click or key handler. Safe to call repeatedly. */
  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.live) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      let live: AudioContext;
      try {
        live = new AC();
      } catch {
        return;
      }
      this.live = live;
      this.attach(live);
    }
    if (this.live.state === 'suspended') void this.live.resume().catch(() => undefined);
  }

  /**
   * Routes every sound into the given context. The app uses the live context from unlock(); the
   * sound check passes an OfflineAudioContext to render and measure each sound without speakers.
   */
  attach(ctx: Ctx): void {
    this.ctx = ctx;
    this.noise = null;
    this.hiss = null;
    this.ambientNodes = null;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.applyGain();
    if (this.ambientWanted) this.startAmbient();
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    this.applyGain();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyGain();
  }

  setAmbient(on: boolean): void {
    this.ambientWanted = on;
    if (on && this.ctx && !this.ambientNodes) this.startAmbient();
    if (!on && this.ambientNodes) {
      this.ambientNodes.stop();
      this.ambientNodes = null;
    }
  }

  play(name: SoundName): void {
    const ctx = this.ctx;
    const out = this.master;
    if (!ctx || !out || this.muted || this.volume === 0) return;
    const t = ctx.currentTime + 0.01;
    switch (name) {
      case 'candle':
        this.noiseBurst(t, 0.35, 900, 0.25, 'bandpass');
        this.tone(t + 0.05, 196, 0.6, 0.08, 'sine');
        break;
      case 'snuff':
        this.noiseBurst(t, 0.5, 400, 0.18, 'lowpass');
        break;
      case 'chime':
        this.bell(t, 659.25, 2.4, 0.35);
        this.bell(t + 0.18, 987.77, 2.2, 0.22);
        break;
      case 'restored':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.bell(t + i * 0.22, f, 3, 0.25));
        break;
      case 'breath':
        this.noiseSwell(t, 3.5, 600, 0.12);
        break;
      case 'moan':
        this.moan(t);
        break;
      case 'rattle':
        // White noise: brown noise has almost no energy up here, which left the rattle near silent.
        for (let i = 0; i < 7; i++) this.noiseBurst(t + i * 0.07 + Math.random() * 0.02, 0.05, 2400 + Math.random() * 800, 0.3, 'bandpass', this.hissBuffer());
        break;
      case 'click':
        this.tone(t, 880, 0.06, 0.06, 'triangle');
        break;
    }
  }

  private applyGain(): void {
    if (!this.master || !this.ctx) return;
    const target = this.muted ? 0 : this.volume * this.volume;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  private noiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    if (this.noise) return this.noise;
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Brown noise: a random walk, softer and more like wind than white noise.
    let last = 0;
    for (let i = 0; i < length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    this.noise = buffer;
    return buffer;
  }

  private hissBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    if (this.hiss) return this.hiss;
    const length = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.hiss = buffer;
    return buffer;
  }

  private envelope(t: number, attack: number, hold: number, release: number, peak: number): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.setValueAtTime(Math.max(0.0002, peak), t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    g.connect(this.master!);
    return g;
  }

  private tone(t: number, freq: number, duration: number, peak: number, type: OscillatorType): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.connect(this.envelope(t, 0.01, 0, duration, peak));
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  private bell(t: number, freq: number, duration: number, peak: number): void {
    // Inharmonic partials give a small hand-bell rather than a beep.
    [1, 2.76, 5.4].forEach((ratio, i) => this.tone(t, freq * ratio, duration / (i + 1), peak / (i * 1.8 + 1), 'sine'));
  }

  private noiseBurst(t: number, duration: number, freq: number, peak: number, type: BiquadFilterType, source?: AudioBuffer): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = source ?? this.noiseBuffer();
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.value = 1.2;
    src.connect(filter).connect(this.envelope(t, 0.005, 0, duration, peak));
    src.start(t, Math.random() * Math.max(0, src.buffer.duration - duration - 0.1));
    src.stop(t + duration + 0.05);
  }

  private noiseSwell(t: number, duration: number, freq: number, peak: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 0.5, t);
    filter.frequency.linearRampToValueAtTime(freq * 1.5, t + duration / 2);
    filter.frequency.linearRampToValueAtTime(freq * 0.4, t + duration);
    src.connect(filter).connect(this.envelope(t, duration / 2, 0, duration / 2, peak));
    src.start(t);
    src.stop(t + duration + 0.1);
  }

  private moan(t: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(330, t + 0.9);
    osc.frequency.exponentialRampToValueAtTime(196, t + 2.4);
    const vibrato = ctx.createOscillator();
    const depth = ctx.createGain();
    vibrato.frequency.value = 5.5;
    depth.gain.value = 6;
    vibrato.connect(depth).connect(osc.frequency);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(700, t);
    filter.Q.value = 6;
    osc.connect(filter).connect(this.envelope(t, 0.6, 0.6, 1.4, 0.12));
    osc.start(t);
    vibrato.start(t);
    osc.stop(t + 2.8);
    vibrato.stop(t + 2.8);
  }

  private startAmbient(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    filter.Q.value = 0.8;
    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoDepth.gain.value = 220;
    lfo.connect(lfoDepth).connect(filter.frequency);
    const drone = ctx.createOscillator();
    drone.frequency.value = 55;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.015;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 3);
    src.connect(filter).connect(gain).connect(this.master!);
    drone.connect(droneGain).connect(gain);
    src.start();
    lfo.start();
    drone.start();
    this.ambientNodes = {
      stop: () => {
        const now = ctx.currentTime;
        gain.gain.setTargetAtTime(0.0001, now, 0.4);
        src.stop(now + 2);
        lfo.stop(now + 2);
        drone.stop(now + 2);
      },
    };
  }
}
