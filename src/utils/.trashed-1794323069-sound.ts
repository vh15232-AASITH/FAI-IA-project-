/**
 * Web Audio API sound synthesizer for tactile parlor game feedback.
 * Generates organic wooden/slate stone taps, removal clacks, and chimes without external audio files.
 */

class SoundEffects {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /** Subtle slate tap when hovering/selecting stones */
  public playStoneSelect(count: number = 1) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    const baseFreq = 320 + Math.min(count, 8) * 28;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.45, now + 0.045);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /** Crisp multi-stone removal clack */
  public playStoneRemove(stonesRemoved: number, isBot: boolean = false) {
    const ctx = this.getContext();
    if (!ctx) return;

    const pulses = Math.min(stonesRemoved, 4);
    for (let i = 0; i < pulses; i++) {
      const start = ctx.currentTime + i * 0.038;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isBot ? 'sine' : 'triangle';
      const startFreq = isBot ? 260 + i * 22 : 410 + i * 35;
      osc.frequency.setValueAtTime(startFreq, start);
      osc.frequency.exponentialRampToValueAtTime(110, start + 0.065);

      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.065);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.07);
    }
  }

  /** Warm harmonic chord on victory or loss */
  public playGameOver(playerWon: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = playerWon ? [261.63, 329.63, 392.0, 523.25] : [293.66, 261.63, 220.0, 196.0];
    notes.forEach((freq, idx) => {
      const start = ctx.currentTime + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.11, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.46);
    });
  }
}

export const soundFX = new SoundEffects();
