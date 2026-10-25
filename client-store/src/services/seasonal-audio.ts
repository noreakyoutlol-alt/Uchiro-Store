// ==============================================================================
// Seasonal Audio Synthesizer (Web Audio API)
// Provides lightweight, non-intrusive ambient tones for Halloween & Christmas
// Zero external media downloads, zero copyright risk, strictly requires user toggle
// Fully cleans up oscillators, gains, and contexts on stop or theme change
// ==============================================================================

import { SeasonalThemeId } from '../types';

class SeasonalAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: (OscillatorNode | GainNode)[] = [];
  private intervalTimer: any = null;
  private currentTheme: SeasonalThemeId | null = null;
  private isRunning = false;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.ctx || this.ctx.state === 'closed') {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public play(theme: SeasonalThemeId): boolean {
    this.stop();

    if (theme === 'gaming' || theme === 'angkor-khmer') {
      // These themes do not have seasonal sounds
      return false;
    }

    const ctx = this.getAudioContext();
    if (!ctx) return false;

    this.currentTheme = theme;
    this.isRunning = true;

    // Master volume kept gentle and non-intrusive
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.08, ctx.currentTime);
    master.connect(ctx.destination);
    this.masterGain = master;

    if (theme === 'halloween') {
      this.startHalloweenAtmosphere(ctx, master);
    } else if (theme === 'christmas') {
      this.startChristmasChimes(ctx, master);
    }

    return true;
  }

  private startHalloweenAtmosphere(ctx: AudioContext, master: GainNode): void {
    // Subtle, low resonant wind/drone with very soft harmonic resonance
    try {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      const gain2 = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(110, ctx.currentTime); // Low A2 tone

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(164.81, ctx.currentTime); // E3 fifth interval

      // Subtle LFO modulation for eerie gentle swaying
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(0.2, ctx.currentTime); // 0.2 Hz slow wave
      lfoGain.gain.setValueAtTime(15, ctx.currentTime);
      lfo.connect(osc1.frequency);
      lfo.start();

      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain2.gain.setValueAtTime(0.15, ctx.currentTime);

      osc1.connect(gain1);
      osc2.connect(gain2);
      gain1.connect(master);
      gain2.connect(master);

      osc1.start();
      osc2.start();

      this.activeNodes.push(osc1, osc2, lfo, gain1, gain2, lfoGain);

      // Gentle sporadic wind chime bell every 6 seconds
      this.intervalTimer = setInterval(() => {
        if (!this.isRunning || !this.ctx || this.ctx.state !== 'running') return;
        this.playSoftBell(this.ctx, master, [440, 523.25, 659.25][Math.floor(Math.random() * 3)]);
      }, 6000);
    } catch {
      // Audio node failure fallback
    }
  }

  private startChristmasChimes(ctx: AudioContext, master: GainNode): void {
    // Festive crystalline high bell pattern (pentatonic winter chime)
    const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5]; // C5, D5, E5, G5, A5, C6
    let step = 0;

    // Play an immediate gentle chime
    this.playSoftBell(ctx, master, notes[0], 0.25);

    // Light recurring chime pattern every 4 seconds
    this.intervalTimer = setInterval(() => {
      if (!this.isRunning || !this.ctx || this.ctx.state !== 'running') return;
      const freq = notes[step % notes.length];
      step++;
      this.playSoftBell(this.ctx, master, freq, 0.22);
    }, 4000);
  }

  private playSoftBell(ctx: AudioContext, master: GainNode, frequency: number, initialGain = 0.2): void {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(initialGain, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

      osc.connect(gain);
      gain.connect(master);

      osc.start(now);
      osc.stop(now + 2.6);
    } catch {
      // Ignore transient bell errors
    }
  }

  public stop(): void {
    this.isRunning = false;
    this.currentTheme = null;

    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }

    for (const node of this.activeNodes) {
      try {
        if ('stop' in node && typeof (node as any).stop === 'function') {
          (node as any).stop();
        }
        node.disconnect();
      } catch {
        // Safe disposal
      }
    }
    this.activeNodes = [];

    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {
        // Safe disposal
      }
      this.masterGain = null;
    }

    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.suspend().catch(() => {});
      } catch {
        // Ignore
      }
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }
}

export const seasonalAudio = new SeasonalAudioSynthesizer();
