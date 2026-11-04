import { TEAMS_RINGTONE_BASE64 } from "./teams-ringtone";
/**
 * Original synthesized soundtrack/foley plus a user-supplied embedded call ringtone.
 * No external audio requests are made.
 * The single look-ahead clock only runs while an unlocked context is running.
 */
export class OfficeAudio {
  private context: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private master: DynamicsCompressorNode | null = null;
  private noise: AudioBuffer | null = null;
  private mode: "menu" | "game" | "final" | "victory" | null = null;
  private clock: ReturnType<typeof setInterval> | null = null;
  private musicSources = new Set<AudioScheduledSourceNode>();
  private fxSources = new Set<AudioScheduledSourceNode>();
  private nextNoteTime = 0;
  private stepIndex = 0;
  private foot = 0;
  private musicVolume = 0.6;
  private sfxVolume = 0.8;
  private muted = false;
  private paused = false;
  private unlocked = false;

  private callBuffer: AudioBuffer | null = null;
  private callDecode: Promise<void> | null = null;
  private callSource: AudioBufferSourceNode | null = null;
  private callRequested = false;

  constructor() {
    // A context is deliberately NOT constructed until the user's first gesture.
  }

  /** Call on pointerdown/keydown. Repeated calls are harmless. */
  unlock(): void {
    if (this.paused) return;
    try {
      if (!this.context) this.createContext();
      const ctx = this.context;
      if (!ctx || ctx.state === "closed") return;
      this.unlocked = true;
      // Queue resume within the gesture, not within a timer or a deferred event.
      void ctx
        .resume()
        .then(() => {
          this.syncCallRingtone();
          if (!this.paused && this.mode && this.clock === null)
            this.startClock();
        })
        .catch(() => {
          /* A browser may still require another genuine gesture. */
        });
      if (ctx.state === "running" && this.mode && this.clock === null)
        this.startClock();
    } catch {
      // Unsupported/denied audio never prevents playing the game.
    }
  }

  setVolumes(music: number, sfx: number, mute: boolean): void {
    this.musicVolume = this.clamp(music);
    this.sfxVolume = this.clamp(sfx);
    this.muted = mute;
    this.applyVolumes();
    this.syncCallRingtone();
  }

  /** Always resets the arrangement, even when selecting the current mode. */
  music(mode: "menu" | "game" | "final" | "victory"): void {
    this.stopClock();
    this.mode = mode;
    this.stepIndex = 0;
    if (this.unlocked && !this.paused && this.context?.state === "running")
      this.startClock();
  }

  sfx(name: string): void {
    const ctx = this.context;
    if (
      !ctx ||
      ctx.state !== "running" ||
      !this.unlocked ||
      this.paused ||
      this.muted ||
      this.sfxVolume <= 0
    )
      return;
    const t = ctx.currentTime + 0.005;
    // All events are scheduled on the audio clock. No sfx timeouts/intervals.
    switch (name) {
      case "meeting-call":
        // Original office-call motif, not a Microsoft Teams recording/melody.
        [74, 81, 78, 72, 79, 76].forEach((n, i) => {
          this.note(n, t + i * 0.1, 0.16, 0.12, "triangle", false);
          this.note(n - 12, t + i * 0.1, 0.12, 0.035, "sine", false);
        });
        break;
      case "step": {
        const pitch = ++this.foot % 2 ? 118 : 101;
        this.tone(pitch, t, 0.055, 0.1, "triangle", false, pitch * 0.65);
        this.hiss(t, 0.035, 0.018, 1250, false, "lowpass");
        break;
      }
      case "alert":
        this.tone(392, t, 0.11, 0.13, "square", false, 440);
        this.tone(587.33, t + 0.13, 0.18, 0.13, "square", false, 659.25);
        this.tone(1174.66, t + 0.13, 0.14, 0.035, "triangle", false);
        break;
      case "caught":
        this.hiss(t, 0.16, 0.13, 1100, false, "bandpass");
        this.tone(220, t, 0.38, 0.2, "sawtooth", false, 55);
        this.tone(233.08, t + 0.04, 0.3, 0.08, "square", false, 58.27);
        break;
      case "coffee":
        [330, 440, 554.37, 659.25].forEach((n, i) => {
          this.tone(n, t + i * 0.065, 0.12, 0.11, "triangle", false, n * 1.08);
        });
        this.hiss(t, 0.16, 0.04, 1600, false, "lowpass");
        this.tone(1318.51, t + 0.25, 0.27, 0.06, "sine", false);
        break;
      case "ability":
        [57, 64, 69, 76, 81].forEach((n, i) =>
          this.note(n, t + i * 0.048, 0.16, 0.095, "square", false),
        );
        this.hiss(t, 0.17, 0.045, 3600, false, "highpass");
        break;
      case "item":
        this.note(83, t, 0.13, 0.12, "triangle", false);
        this.note(88, t + 0.085, 0.25, 0.11, "triangle", false);
        this.note(95, t + 0.09, 0.2, 0.025, "sine", false);
        break;
      case "exit":
        [69, 73, 76, 81, 85, 88].forEach((n, i) =>
          this.note(n, t + i * 0.075, 0.28, 0.1, "triangle", false),
        );
        this.note(45, t, 0.55, 0.16, "triangle", false);
        break;
      case "fail":
        [64, 62, 59, 56, 52].forEach((n, i) =>
          this.note(n, t + i * 0.13, 0.2, 0.1, "square", false),
        );
        this.note(40, t + 0.4, 0.45, 0.13, "triangle", false);
        break;
      case "founder":
        // The founder's four-note interruption: recognisable, short, not a siren.
        [52, 59, 58, 64].forEach((n, i) => {
          this.note(n, t + i * 0.09, 0.1, 0.13, "square", false);
          this.note(n - 12, t + i * 0.09, 0.12, 0.1, "triangle", false);
        });
        break;
      case "click":
      default:
        this.tone(740, t, 0.038, 0.1, "triangle", false, 1046.5);
        this.tone(1480, t + 0.005, 0.025, 0.025, "sine", false);
        break;
    }
  }

  /** The uploaded MP3 loops only while its failure screen is waiting for a choice. */
  startCallRingtone(): void {
    this.callRequested = true;
    this.applyVolumes();
    this.syncCallRingtone();
  }
  stopCallRingtone(): void {
    this.callRequested = false;
    this.stopCallSource();
    this.applyVolumes();
  }
  ringtoneState() {
    return {
      requested: this.callRequested,
      playing: !!this.callSource,
      ready: !!this.callBuffer,
      duration: this.callBuffer?.duration || 0,
      loop: this.callSource?.loop || false,
      muted: this.muted,
      sfxVolume: this.sfxVolume,
      paused: this.paused,
    };
  }
  private stopCallSource(): void {
    const source = this.callSource;
    this.callSource = null;
    if (source) {
      try {
        source.stop();
      } catch {}
      source.disconnect();
    }
  }
  private syncCallRingtone(): void {
    const ctx = this.context;
    if (
      !this.callRequested ||
      this.paused ||
      this.muted ||
      this.sfxVolume <= 0 ||
      !this.unlocked ||
      ctx?.state !== "running"
    ) {
      this.stopCallSource();
      return;
    }
    if (!this.callBuffer) {
      if (!this.callDecode) {
        const bytes = Uint8Array.from(atob(TEAMS_RINGTONE_BASE64), (c) =>
          c.charCodeAt(0),
        );
        this.callDecode = ctx
          .decodeAudioData(bytes.buffer)
          .then((buffer) => {
            this.callBuffer = buffer;
            this.syncCallRingtone();
          })
          .catch(() => {
            /* Unsupported audio must never trap the failure buttons. */
          });
      }
      return;
    }
    if (this.callSource || !this.sfxGain) return;
    const source = ctx.createBufferSource();
    source.buffer = this.callBuffer;
    source.loop = true;
    source.connect(this.sfxGain);
    this.callSource = source;
    source.onended = () => {
      if (this.callSource === source) this.callSource = null;
      source.disconnect();
    };
    source.start();
  }

  /** Freezes playback and clears all pending sequencer work. */
  suspend(): void {
    this.paused = true;
    this.stopCallSource();
    this.stopClock();
    this.stopSources(this.fxSources);
    if (this.context && this.context.state !== "closed")
      void this.context.suspend().catch(() => {});
  }

  /** Resumes the selected arrangement from its beginning, without stacking clocks. */
  resume(): void {
    this.paused = false;
    const ctx = this.context;
    if (!ctx || !this.unlocked || ctx.state === "closed") return;
    void ctx
      .resume()
      .then(() => {
        this.syncCallRingtone();
        if (!this.paused && this.mode && this.clock === null) this.startClock();
      })
      .catch(() => {});
  }

  private clamp(value: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  }

  private createContext(): void {
    if (typeof window === "undefined") return;
    const Audio =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Audio) return;
    const ctx = new Audio();
    this.context = ctx;
    this.musicGain = ctx.createGain();
    this.sfxGain = ctx.createGain();
    this.master = ctx.createDynamicsCompressor();
    this.master.threshold.value = -16;
    this.master.knee.value = 16;
    this.master.ratio.value = 4;
    this.master.attack.value = 0.004;
    this.master.release.value = 0.16;
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.master.connect(ctx.destination);
    // Deterministic one-second noise table: no data fetch and no audio worklet.
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 0x459b17;
    for (let i = 0; i < data.length; i++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      data[i] = ((seed >>> 0) / 0x100000000) * 2 - 1;
    }
    this.applyVolumes(true);
    // Safari/mobile can interrupt the context independently of the game.
    ctx.onstatechange = () => {
      if (ctx.state !== "running") {
        this.stopCallSource();
        this.stopClock();
      } else if (
        this.mode &&
        this.unlocked &&
        !this.paused &&
        this.clock === null
      ) {
        this.startClock();
      }
      this.syncCallRingtone();
    };
  }

  private applyVolumes(immediate = false): void {
    const ctx = this.context;
    if (!ctx || !this.musicGain || !this.sfxGain) return;
    const time = ctx.currentTime;
    // The lower music gain leaves generous headroom for overlapping voices.
    const values: [GainNode, number][] = [
      [
        this.musicGain,
        this.muted || this.callRequested ? 0 : this.musicVolume * 0.42,
      ],
      [this.sfxGain, this.muted ? 0 : this.sfxVolume * 0.7],
    ];
    for (const [node, value] of values) {
      node.gain.cancelScheduledValues(time);
      if (immediate) node.gain.setValueAtTime(value, time);
      else node.gain.setTargetAtTime(value, time, 0.018);
    }
  }

  private startClock(): void {
    const ctx = this.context;
    if (
      !ctx ||
      ctx.state !== "running" ||
      this.paused ||
      !this.mode ||
      this.clock !== null
    )
      return;
    this.stepIndex = 0;
    this.nextNoteTime = ctx.currentTime + 0.035;
    this.schedule();
    this.clock = setInterval(() => this.schedule(), 25);
  }

  private stopClock(): void {
    if (this.clock !== null) {
      clearInterval(this.clock);
      this.clock = null;
    }
    this.stopSources(this.musicSources);
    this.stepIndex = 0;
  }

  private stopSources(sources: Set<AudioScheduledSourceNode>): void {
    for (const source of sources) {
      try {
        source.stop();
      } catch {
        /* Already ended. */
      }
    }
    sources.clear();
  }

  private schedule(): void {
    const ctx = this.context;
    if (!ctx || ctx.state !== "running" || !this.mode || this.paused) return;
    const tempo = { menu: 100, game: 112, final: 134, victory: 122 }[this.mode];
    const sixteenth = 60 / tempo / 4;
    // If a background tab starved the scheduler, skip stale notes rather than burst.
    if (this.nextNoteTime < ctx.currentTime - 0.15)
      this.nextNoteTime = ctx.currentTime + 0.025;
    while (this.nextNoteTime < ctx.currentTime + 0.13) {
      // Light 54:46 swing in the groove, less swing in the urgent final cue.
      const swing = this.mode === "final" ? 0.025 : 0.08;
      this.arrange(this.stepIndex, this.nextNoteTime, sixteenth);
      this.nextNoteTime +=
        sixteenth * (this.stepIndex % 2 === 0 ? 1 + swing : 1 - swing);
      this.stepIndex = (this.stepIndex + 1) % 128;
    }
  }

  private arrange(step: number, t: number, tick: number): void {
    if (!this.mode) return;
    const bar = Math.floor(step / 16),
      beat = step % 16;
    const mode = this.mode;
    const roots =
      mode === "victory"
        ? [57, 62, 64, 57, 66, 62, 64, 57]
        : mode === "final"
          ? [57, 53, 50, 52, 57, 53, 55, 52]
          : [57, 53, 60, 55, 57, 53, 50, 52];
    const root = roots[bar];
    const major = mode === "victory" || [53, 55, 60].includes(root);
    const third = major ? 4 : 3;
    const chord = [root, root + third, root + 7, root + 11];
    const duration = tick * (mode === "menu" ? 0.72 : 0.6);
    // Rubber-like triangle bass with a short octave pickup into each half-bar.
    if ([0, 6, 8, 14].includes(beat)) {
      const n = root - 12 + (beat === 14 ? 7 : beat === 6 ? 12 : 0);
      this.note(
        n,
        t,
        tick * (beat === 0 || beat === 8 ? 2.2 : 1.3),
        0.26,
        "triangle",
        true,
      );
      this.note(n + 12, t, tick * 0.8, 0.022, "square", true);
    }
    // Dry chip percussion is deliberately lighter than the stealth sound effects.
    if (beat === 0 || beat === 8 || (mode !== "menu" && beat === 12))
      this.kick(t, mode === "final" ? 0.3 : 0.25);
    if (beat === 4 || beat === 12) {
      this.hiss(t, 0.085, 0.075, 1850, true, "bandpass");
      this.tone(176, t, 0.07, 0.045, "triangle", true, 125);
    }
    if (beat % 2 === 0)
      this.hiss(
        t,
        beat === 14 ? 0.09 : 0.028,
        beat % 4 === 2 ? 0.04 : 0.025,
        6900,
        true,
        "highpass",
      );
    if (mode === "final" && beat % 2 === 1)
      this.hiss(t, 0.018, 0.018, 7800, true, "highpass");
    // Quiet broken-chord ostinato: the changing register leaves space for the lead.
    const arpOrder = [0, 2, 1, 2, 0, 3, 1, 2];
    if (beat % 2 === 1) {
      const n = chord[arpOrder[Math.floor(beat / 2)]] + 12;
      this.note(
        n,
        t,
        duration,
        mode === "menu" ? 0.07 : 0.052,
        "triangle",
        true,
      );
    }
    // Eight-bar call/response motif, intentionally composed rather than random.
    const motifs: Record<"menu" | "game" | "final" | "victory", number[][]> = {
      menu: [
        [0, -1, 7, -1, 10, -1, 7, -1, 3, -1, 2, -1, 0, -1, -1, -1],
        [7, -1, -1, 10, -1, 7, -1, -1, 3, -1, 2, -1, 0, -1, -1, -1],
      ],
      game: [
        [0, -1, -1, 7, -1, 10, 7, -1, 3, -1, -1, 2, 0, -1, -1, -1],
        [12, -1, 10, -1, 7, -1, -1, 3, -1, 7, -1, 2, 0, -1, 7, -1],
      ],
      final: [
        [0, 7, -1, 12, 10, -1, 7, 3, 0, -1, 7, 10, 12, -1, 10, 7],
        [12, -1, 10, 7, 3, -1, 2, 3, 7, -1, 10, 7, 3, 2, 0, -1],
      ],
      victory: [
        [0, -1, 4, -1, 7, -1, 12, 11, -1, 9, -1, 7, 4, -1, 7, -1],
        [12, -1, -1, 11, 9, -1, 7, -1, 4, -1, 2, -1, 0, -1, -1, -1],
      ],
    };
    let melody = motifs[mode][bar % 2][beat];
    // Adapt the minor melodic third and seventh to major chords outside victory.
    if (mode !== "victory" && major && melody === 3) melody = 4;
    if (mode !== "victory" && major && melody === 10) melody = 11;
    if (melody >= 0 && (mode !== "menu" || bar % 4 !== 3)) {
      this.note(
        root + 12 + melody,
        t,
        tick * (mode === "final" ? 0.85 : 1.1),
        mode === "menu" ? 0.065 : mode === "final" ? 0.078 : 0.075,
        "square",
        true,
      );
      // A tiny triangle doubling rounds off the pulse's edge.
      this.note(root + 12 + melody, t, tick * 1.35, 0.025, "triangle", true);
    }
    // A soft chord at the beginning of each bar is a warm, non-drone bed.
    if (beat === 0) {
      for (let i = 0; i < 3; i++)
        this.note(chord[i], t + i * 0.012, tick * 5, 0.035, "triangle", true);
    }
    if (bar === 7 && beat >= 14)
      this.hiss(t, 0.04, 0.04, 2500 + beat * 150, true, "highpass");
  }

  private note(
    midi: number,
    t: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    music: boolean,
  ): void {
    this.tone(
      440 * Math.pow(2, (midi - 69) / 12),
      t,
      duration,
      volume,
      type,
      music,
    );
  }

  private tone(
    frequency: number,
    t: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    music: boolean,
    endFrequency?: number,
  ): void {
    const ctx = this.context,
      bus = music ? this.musicGain : this.sfxGain;
    if (!ctx || !bus) return;
    const source = ctx.createOscillator();
    const envelope = ctx.createGain();
    source.type = type;
    source.frequency.setValueAtTime(Math.max(20, frequency), t);
    if (endFrequency !== undefined)
      source.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFrequency),
        t + duration,
      );
    const attack = Math.min(0.008, duration * 0.15);
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.linearRampToValueAtTime(volume, t + attack);
    envelope.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, volume * 0.45),
      t + duration * 0.55,
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.035);
    source.connect(envelope);
    envelope.connect(bus);
    const collection = music ? this.musicSources : this.fxSources;
    collection.add(source);
    source.onended = () => {
      collection.delete(source);
      source.disconnect();
      envelope.disconnect();
    };
    source.start(t);
    source.stop(t + duration + 0.045);
  }

  private kick(t: number, volume: number): void {
    this.tone(145, t, 0.12, volume, "sine", true, 43);
    this.hiss(t, 0.015, 0.018, 1900, true, "lowpass");
  }

  private hiss(
    t: number,
    duration: number,
    volume: number,
    cutoff: number,
    music: boolean,
    type: BiquadFilterType,
  ): void {
    const ctx = this.context,
      bus = music ? this.musicGain : this.sfxGain;
    if (!ctx || !bus || !this.noise) return;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const envelope = ctx.createGain();
    source.buffer = this.noise;
    filter.type = type;
    filter.frequency.value = Math.min(cutoff, ctx.sampleRate * 0.45);
    filter.Q.value = type === "bandpass" ? 0.8 : 0.5;
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.linearRampToValueAtTime(volume, t + 0.002);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(bus);
    const collection = music ? this.musicSources : this.fxSources;
    collection.add(source);
    source.onended = () => {
      collection.delete(source);
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };
    source.start(t, (this.stepIndex * 0.027) % 0.6);
    source.stop(t + duration + 0.01);
  }
}
