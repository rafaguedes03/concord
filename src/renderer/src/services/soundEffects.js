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

  // Som ao entrar em uma transmissão (whoosh subindo + acorde brilhante, estilo Discord)
  playJoinStream() {
    this.playStreamCue({
      sweepFrom: 400,
      sweepTo: 3200,
      volume: 0.9,
      // Mi5 e depois Si5, com um brilho uma oitava acima
      notes: [
        { freq: 659.25, start: 0.1, peak: 0.13 },
        { freq: 987.77, start: 0.19, peak: 0.12 },
        { freq: 1975.53, start: 0.19, peak: 0.03 }
      ]
    });
  }

  // Som ao sair de uma transmissão (espelho do de entrada: whoosh descendo + acorde caindo)
  playLeaveStream() {
    this.playStreamCue({
      sweepFrom: 3200,
      sweepTo: 400,
      volume: 0.75,
      // Si5 e depois Mi5
      notes: [
        { freq: 987.77, start: 0.06, peak: 0.12 },
        { freq: 659.25, start: 0.15, peak: 0.13 }
      ]
    });
  }

  // Som quando alguém começa a transmitir (arpejo brilhante subindo: Dó -> Mi -> Sol -> Dó)
  playStreamStarted() {
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const t = now + i * 0.075;
        const last = i === notes.length - 1;
        const decay = last ? 0.55 : 0.22;

        // Triângulo dá o corpo, seno uma oitava acima dá o brilho de "sininho"
        for (const [type, mult, peak] of [['triangle', 1, 0.12], ['sine', 2, 0.035]]) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freq * mult, t);

          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(peak, t + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.001, t + decay);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + decay + 0.01);
        }
      });
    } catch (e) {
      console.warn('Erro ao tocar som de início de transmissão:', e);
    }
  }

  // Whoosh de ruído filtrado seguido de notas curtas (base dos sons de transmissão)
  playStreamCue({ sweepFrom, sweepTo, volume, notes }) {
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const master = ctx.createGain();
      master.gain.setValueAtTime(volume, now);
      master.connect(ctx.destination);

      // Whoosh: ruído com o filtro varrendo de sweepFrom até sweepTo
      const noiseLength = 0.22;
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * noiseLength), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.2;
      filter.frequency.setValueAtTime(sweepFrom, now);
      filter.frequency.exponentialRampToValueAtTime(sweepTo, now + noiseLength);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.001, now);
      noiseGain.gain.linearRampToValueAtTime(0.07, now + 0.12);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseLength);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(master);
      noise.start(now);
      noise.stop(now + noiseLength);

      for (const { freq, start, peak } of notes) {
        const t = now + start;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(peak, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + 0.46);
      }
    } catch (e) {
      console.warn('Erro ao tocar som de transmissão:', e);
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
