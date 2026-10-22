// Efeitos Sonoros Estilo Discord gerados via Web Audio API
// Sons limpos, harmoniosos e instantâneos (zero latência e sem depender de arquivos externos)

class SoundEffectsManager {
  constructor() {
    this.ctx = null;
    this.sinkId = '';
  }

  // Toca os efeitos no mesmo alto-falante escolhido para a call ('' = padrão do sistema)
  setOutputDevice(deviceId) {
    this.sinkId = deviceId || '';
    if (this.ctx && this.ctx.setSinkId) {
      this.ctx.setSinkId(this.sinkId).catch(() => {});
    }
  }

  ensureContext() {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      if (this.sinkId && this.ctx.setSinkId) {
        this.ctx.setSinkId(this.sinkId).catch(() => {});
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Som ao entrar na call (Dois tons harmoniosos subindo: Ré -> Lá)
  playJoinCall() {
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Tom 1: 392 Hz (G4), Tom 2: 523.25 Hz (C5)
      osc.frequency.setValueAtTime(392, now);
      osc.frequency.setValueAtTime(523.25, now + 0.12);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.03);
      gain.gain.setValueAtTime(0.18, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch (e) {
      console.warn('Erro ao tocar som join:', e);
    }
  }

  // Som ao sair da call (Dois tons harmoniosos descendo: Dó -> Sol)
  playLeaveCall() {
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(392, now + 0.12);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.03);
      gain.gain.setValueAtTime(0.16, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch (e) {
      console.warn('Erro ao tocar som leave:', e);
    }
  }

  // Som ao mutar microfone (Tom suave e seco caindo)
  playMute() {
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.1);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch (e) {
      console.warn('Erro ao tocar som mute:', e);
    }
  }

  // Som ao desmutar microfone (Tom suave e brilhante subindo)
  playUnmute() {
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(560, now + 0.1);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch (e) {
      console.warn('Erro ao tocar som unmute:', e);
    }
  }

  // Som ao ensurdecer (Deafen)
  playDeafen() {
    this.playMute();
  }

  // Som ao reativar áudio (Undeafen)
  playUndeafen() {
    this.playUnmute();
  }
}

export const soundEffects = new SoundEffectsManager();
