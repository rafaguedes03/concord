// Detector de atividade de voz usando Web Audio API (AnalyserNode)

export class AudioActivityDetector {
  constructor(stream, onSpeakingChange, threshold = 0.02) {
    this.stream = stream;
    this.onSpeakingChange = onSpeakingChange;
    this.threshold = threshold;
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.rafId = null;
    this.isSpeaking = false;
    this.silenceTimeout = null;

    this.init();
  }

  init() {
    if (!this.stream || this.stream.getAudioTracks().length === 0) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.4;

      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!this.analyser) return;

        this.analyser.getByteFrequencyData(dataArray);

        // Calcula média de amplitude
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength / 255; // Normaliza entre 0 e 1

        const speakingNow = average > this.threshold;

        if (speakingNow) {
          if (!this.isSpeaking) {
            this.isSpeaking = true;
            this.onSpeakingChange(true);
          }
          if (this.silenceTimeout) {
            clearTimeout(this.silenceTimeout);
            this.silenceTimeout = null;
          }
        } else if (this.isSpeaking && !this.silenceTimeout) {
          // Mantém o estado ativo por 300ms para evitar piscadas na fala natural
          this.silenceTimeout = setTimeout(() => {
            this.isSpeaking = false;
            this.onSpeakingChange(false);
            this.silenceTimeout = null;
          }, 350);
        }

        this.rafId = requestAnimationFrame(checkVolume);
      };

      this.rafId = requestAnimationFrame(checkVolume);
    } catch (err) {
      console.warn('Erro ao inicializar AudioActivityDetector:', err);
    }
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.silenceTimeout) clearTimeout(this.silenceTimeout);
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
  }
}
