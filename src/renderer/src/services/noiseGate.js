// Supressor de Ruído e Noise Gate ajustável com Web Audio API

export class NoiseGateProcessor {
  constructor(audioStream, initialThreshold = 0.15) {
    this.rawStream = audioStream;
    this.threshold = initialThreshold; // 0.0 a 1.0
    this.audioContext = null;
    this.sourceNode = null;
    this.highpassFilter = null;
    this.gateGain = null;
    this.analyser = null;
    this.destination = null;
    this.processedStream = null;
    this.rafId = null;
    this.enabled = true;
    this.onVolumeMeter = null; // Callback para VU meter ao vivo (volume: 0..1, isOpen: boolean)

    this.init();
  }

  init() {
    if (!this.rawStream || this.rawStream.getAudioTracks().length === 0) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();

      this.sourceNode = this.audioContext.createMediaStreamSource(this.rawStream);

      // 1. Filtro passa-altas em 85Hz para cortar roncos, vibrações de mesa e sopros
      this.highpassFilter = this.audioContext.createBiquadFilter();
      this.highpassFilter.type = 'highpass';
      this.highpassFilter.frequency.setValueAtTime(85, this.audioContext.currentTime);

      // 2. AnalyserNode para medir o volume do microfone em tempo real
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.2;

      // 3. GainNode para atuar como Noise Gate (corta quando abaixo do limiar)
      this.gateGain = this.audioContext.createGain();
      this.gateGain.gain.setValueAtTime(1.0, this.audioContext.currentTime);

      // 4. Destination para gerar a nova MediaStream tratada
      this.destination = this.audioContext.createMediaStreamDestination();

      // Encadeamento de áudio:
      // mic -> highpass -> analyser
      //      \-> gateGain -> destination (áudio limpo que vai pro WebRTC)
      this.sourceNode.connect(this.highpassFilter);
      this.highpassFilter.connect(this.analyser);
      this.highpassFilter.connect(this.gateGain);
      this.gateGain.connect(this.destination);

      this.processedStream = this.destination.stream;

      // Iniciar monitoramento do Noise Gate
      this.startGateLoop();
    } catch (err) {
      console.warn('[NoiseGate] Falha ao inicializar Web Audio:', err);
      this.processedStream = this.rawStream;
    }
  }

  startGateLoop() {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let isOpen = true;
    let holdTimer = null;

    const processFrame = () => {
      if (!this.analyser || !this.gateGain || !this.audioContext) return;

      this.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const averageVolume = sum / bufferLength / 255; // 0.0 a 1.0

      if (this.onVolumeMeter) {
        this.onVolumeMeter(averageVolume, isOpen);
      }

      if (this.enabled) {
        if (averageVolume >= this.threshold) {
          // Voz detectada: abre o portão suavemente em 15ms
          isOpen = true;
          this.gateGain.gain.setTargetAtTime(1.0, this.audioContext.currentTime, 0.015);
          if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
          }
        } else if (isOpen && !holdTimer) {
          // Abaixo do limiar: segura por 150ms para não cortar finais de sílabas
          holdTimer = setTimeout(() => {
            isOpen = false;
            if (this.gateGain && this.audioContext) {
              // Rampa para zero em 30ms para corte imperceptível sem estalos
              this.gateGain.gain.setTargetAtTime(0.0, this.audioContext.currentTime, 0.03);
            }
            holdTimer = null;
          }, 150);
        }
      } else {
        // Se desativado, passa áudio direto
        this.gateGain.gain.setTargetAtTime(1.0, this.audioContext.currentTime, 0.02);
      }

      this.rafId = requestAnimationFrame(processFrame);
    };

    this.rafId = requestAnimationFrame(processFrame);
  }

  setThreshold(val) {
    this.threshold = Math.max(0, Math.min(1.0, val));
  }

  setEnabled(enable) {
    this.enabled = !!enable;
  }

  getProcessedStream() {
    return this.processedStream || this.rawStream;
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }
  }
}
