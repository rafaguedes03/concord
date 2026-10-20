// Processador de voz do microfone (TrackProcessor do LiveKit)
// Cadeia: microfone -> [DeepFilterNet3 IA, só no modo auto] -> highpass -> calor -> presença -> compressor -> [noise gate, só no modo manual]
// Roda em um AudioContext próprio de 48 kHz para que o peso da IA não afete a reprodução das vozes dos amigos

// Só existem dois modos: 'auto' (IA DeepFilterNet3) e 'manual' (Noise Gate).
// 'deepfilter' era o padrão antigo salvo no localStorage e equivale ao modo IA.
export const normalizeNoiseMode = (mode) => (mode === 'manual' ? 'manual' : 'auto');

// Mapeamento do slider: 1% = 0.0035 RMS (-49 dB), 15% = 0.0105 RMS (-40 dB), 60% = 0.033 RMS (-30 dB)
const thresholdToLinear = (percent) => 0.003 + (percent / 100) * 0.05;

// Noise gate dentro do thread de áudio: abre rápido, segura 300 ms e fecha suave (sem cortar sílabas nem estalar)
const GATE_WORKLET_CODE = `
  class ConcordNoiseGate extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      return [
        { name: 'threshold', defaultValue: 0.0105, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
        { name: 'enabled', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
      ];
    }
    constructor() {
      super();
      this.envelope = 0;
      this.gain = 1;
      this.holdSamples = 0;
      this.holdLength = Math.round(sampleRate * 0.3);
      this.attackCoef = 1 - Math.exp(-1 / (sampleRate * 0.005));
      this.releaseCoef = 1 - Math.exp(-1 / (sampleRate * 0.08));
      this.envCoef = 1 - Math.exp(-1 / (sampleRate * 0.01));
    }
    process(inputs, outputs, parameters) {
      const input = inputs[0];
      const output = outputs[0];
      if (!input || !input[0]) return true;
      const enabled = parameters.enabled[0] >= 0.5;
      const threshold = parameters.threshold[0];
      const inCh = input[0];
      for (let i = 0; i < inCh.length; i++) {
        const s = inCh[i];
        this.envelope += (s * s - this.envelope) * this.envCoef;
        let target = 1;
        if (enabled) {
          if (Math.sqrt(this.envelope) >= threshold) {
            this.holdSamples = this.holdLength;
          } else if (this.holdSamples > 0) {
            this.holdSamples--;
          } else {
            target = 0;
          }
        }
        this.gain += (target - this.gain) * (target > this.gain ? this.attackCoef : this.releaseCoef);
        for (let c = 0; c < output.length; c++) {
          output[c][i] = (input[c] || inCh)[i] * this.gain;
        }
      }
      return true;
    }
  }
  registerProcessor('concord-noise-gate', ConcordNoiseGate);
`;

export class ConcordVoiceProcessor {
  constructor({ mode = 'auto', gateEnabled = true, thresholdPercent = 15 } = {}) {
    this.name = 'concord-voice';
    this.mode = normalizeNoiseMode(mode);
    this.gateEnabled = !!gateEnabled;
    this.thresholdPercent = thresholdPercent;

    this.processedTrack = undefined;
    this.rawTrack = null;
    this.audioContext = null;
    this.sourceNode = null;
    this.deepFilterWorklet = null;
    this.highPassFilter = null;
    this.gateNode = null;
    this.destination = null;
    this.routingTask = Promise.resolve();
  }

  async init({ track }) {
    this.rawTrack = track;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx({ sampleRate: 48000, latencyHint: 'interactive' });
    this.audioContext = ctx;
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    this.sourceNode = ctx.createMediaStreamSource(new MediaStream([track]));

    // 1. FILTRO HIGHPASS (85 Hz) - Remove batidas na mesa, vento e ruído subgrave
    this.highPassFilter = ctx.createBiquadFilter();
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = 85;

    // 2. FILTRO DE CORPO/CALOR (Lowshelf a 220 Hz, +2.5 dB) - Deixa a voz encorpada
    const warmthFilter = ctx.createBiquadFilter();
    warmthFilter.type = 'lowshelf';
    warmthFilter.frequency.value = 220;
    warmthFilter.gain.value = 2.5;

    // 3. FILTRO DE PRESENÇA VOCAL (Peaking a 3200 Hz, +2 dB) - Clareza para jogos e conversas
    const presenceFilter = ctx.createBiquadFilter();
    presenceFilter.type = 'peaking';
    presenceFilter.frequency.value = 3200;
    presenceFilter.Q.value = 1.2;
    presenceFilter.gain.value = 2.0;

    // 4. COMPRESSOR DE DINÂMICA - Nivela sussurros e gritos
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 8;
    compressor.ratio.value = 3.5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.22;

    this.destination = ctx.createMediaStreamDestination();

    this.highPassFilter.connect(warmthFilter);
    warmthFilter.connect(presenceFilter);
    presenceFilter.connect(compressor);

    // 5. NOISE GATE (só atua no modo manual com o gate ligado)
    try {
      const blob = new Blob([GATE_WORKLET_CODE], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      this.gateNode = new AudioWorkletNode(ctx, 'concord-noise-gate');
      compressor.connect(this.gateNode);
      this.gateNode.connect(this.destination);
    } catch (err) {
      console.warn('[VoiceProcessor] Noise gate indisponível, seguindo sem gate:', err);
      compressor.connect(this.destination);
    }

    this.sourceNode.connect(this.highPassFilter);
    this.processedTrack = this.destination.stream.getAudioTracks()[0];

    this.applyGateParams();
    await this.applyNoiseRouting();
  }

  async restart(opts) {
    await this.destroy();
    await this.init(opts);
  }

  async destroy() {
    const ctx = this.audioContext;
    this.audioContext = null;
    this.sourceNode = null;
    this.highPassFilter = null;
    this.gateNode = null;
    this.destination = null;
    this.processedTrack = undefined;
    if (this.deepFilterWorklet) {
      try { this.deepFilterWorklet.dispose(); } catch (e) {}
      this.deepFilterWorklet = null;
    }
    if (ctx && ctx.state !== 'closed') {
      await ctx.close().catch(() => {});
    }
  }

  // Troca de modo/sensibilidade no meio da chamada, sem reiniciar o microfone
  setSettings(mode, gateEnabled, thresholdPercent) {
    const nextMode = normalizeNoiseMode(mode);
    const modeChanged = nextMode !== this.mode;
    this.mode = nextMode;
    this.gateEnabled = !!gateEnabled;
    if (thresholdPercent !== undefined) this.thresholdPercent = thresholdPercent;

    this.applyGateParams();
    if (modeChanged) this.applyNoiseRouting();

    // Liga/desliga o supressor e o AGC nativos do navegador junto com o modo
    if (this.rawTrack && this.rawTrack.applyConstraints) {
      const isAuto = this.mode === 'auto';
      this.rawTrack.applyConstraints({
        echoCancellation: true,
        noiseSuppression: isAuto,
        autoGainControl: isAuto
      }).catch(() => {});
    }
  }

  applyGateParams() {
    if (!this.gateNode || !this.audioContext) return;
    const now = this.audioContext.currentTime;
    const enabled = this.mode === 'manual' && this.gateEnabled ? 1 : 0;
    this.gateNode.parameters.get('enabled').setValueAtTime(enabled, now);
    this.gateNode.parameters.get('threshold').setValueAtTime(thresholdToLinear(this.thresholdPercent), now);
  }

  // Insere ou remove o DeepFilterNet3 da cadeia conforme o modo atual (em fila, para trocas rápidas não se atropelarem)
  applyNoiseRouting() {
    this.routingTask = this.routingTask.then(() => this.updateDeepFilterRouting()).catch(() => {});
    return this.routingTask;
  }

  async updateDeepFilterRouting() {
    const source = this.sourceNode;
    const ctx = this.audioContext;
    if (!source || !ctx || !this.highPassFilter) return;
    const wantAi = this.mode === 'auto';

    if (wantAi && !this.deepFilterWorklet) {
      try {
        const { createDeepFilterNetAudioWorklet } = await import('@workadventure/noise-suppression/deepfilternet');
        const basePath = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
        const worklet = await createDeepFilterNetAudioWorklet(ctx, {
          moduleUrl: new URL('noise-suppression/processor.js', basePath).href,
          wasmUrl: new URL('noise-suppression/df_bg.wasm', basePath).href,
          modelUrl: new URL('noise-suppression/DeepFilterNet3_onnx.tar.gz', basePath).href,
          speechAttenuationDb: 30,
          pauseAttenuationDb: 48,
          pauseGateLookaheadFrames: 1,
          bypassUntilReady: true
        });
        // O processador pode ter sido destruído ou o modo trocado enquanto o modelo carregava
        if (this.sourceNode !== source || this.mode !== 'auto') {
          worklet.dispose();
          return;
        }
        source.disconnect();
        source.connect(worklet.node);
        worklet.node.connect(this.highPassFilter);
        this.deepFilterWorklet = worklet;
        console.log('[VoiceProcessor] DeepFilterNet3 IA ativado com sucesso!');
      } catch (dfErr) {
        console.warn('[VoiceProcessor] DeepFilterNet3 indisponível, usando só os filtros do WebRTC:', dfErr);
      }
    } else if (!wantAi && this.deepFilterWorklet) {
      const worklet = this.deepFilterWorklet;
      this.deepFilterWorklet = null;
      try { source.disconnect(); } catch (e) {}
      try { worklet.node.disconnect(); } catch (e) {}
      try { worklet.dispose(); } catch (e) {}
      source.connect(this.highPassFilter);
      console.log('[VoiceProcessor] DeepFilterNet3 desativado (modo Noise Gate manual)');
    }
  }
}
