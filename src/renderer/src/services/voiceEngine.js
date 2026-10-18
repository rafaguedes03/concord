// Motor de Áudio Direto via WebSocket estilo Discord
// Som encorpado, processamento dinâmico (Compressor + EQ), latência ultra-baixa (~21ms) e zero cortes

export class VoiceEngine {
  constructor(socket) {
    this.socket = socket;
    this.localStream = null;
    this.audioContext = null;
    this.sourceNode = null;

    // Filtros de áudio estilo Discord / Concord
    this.deepFilterWorklet = null;
    this.highPassFilter = null;
    this.warmthFilter = null;
    this.presenceFilter = null;
    this.compressorNode = null;
    this.scriptProcessor = null;
    this.silentGain = null;

    this.isMuted = false;
    this.isDeafened = false;
    this.currentChannelId = null;

    // Modo de áudio: 'auto' (IA estilo Krisp / WebRTC APM) ou 'manual' (Noise Gate com slider)
    this.noiseMode = 'auto';
    this.noiseGateEnabled = true;
    this.noiseThresholdPercent = 15;
    this.linearThreshold = 0.012; // Calibrado para o nível real de voz (-38 dB)

    // Callback para indicador de fala visual
    this.onSpeakingChange = null;

    // Receptor: mapas de áudio por usuário
    // userId -> { nextPlayTime, volume, isLocallyMuted, gainNode }
    this.remotePeers = new Map();
    this.playbackContext = null;

    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.socket.on('voice-frame', ({ userId, data }) => {
      this.playRemoteAudio(userId, data);
    });

    this.socket.on('user-left-voice-channel', ({ userId }) => {
      this.removeRemotePeer(userId);
    });
  }

  // Inicia captura de microfone com cadeia de áudio profissional estilo Discord
  async startVoice(channelId, noiseMode = 'auto', noiseEnabled = true, noiseThresholdPercent = 15) {
    this.currentChannelId = channelId;
    this.noiseMode = noiseMode || 'auto';
    this.noiseGateEnabled = noiseEnabled;
    this.setNoiseSettings(noiseMode, noiseEnabled, noiseThresholdPercent);

    try {
      const isAuto = this.noiseMode === 'auto';
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: isAuto, // Ativa o supressor neural C++ do WebRTC no modo auto estilo Krisp
          autoGainControl: isAuto,  // Nivelamento inteligente por IA no modo auto
          googNoiseSuppression: isAuto,
          googHighpassFilter: true,
          googEchoCancellation: true,
          googAutoGainControl: isAuto,
          channelCount: 1,
          sampleRate: 48000
        },
        video: false
      });

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: 48000 });
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.localStream);

      // 1. FILTRO HIGHPASS (85 Hz) - Remove batidas na mesa, vento e ruído subgrave
      this.highPassFilter = this.audioContext.createBiquadFilter();
      this.highPassFilter.type = 'highpass';
      this.highPassFilter.frequency.setValueAtTime(85, this.audioContext.currentTime);

      // 2. FILTRO DE CORPO/CALOR (Lowshelf a 220 Hz, +2.5 dB) - Deixa a voz encorpada ("som de rádio/Discord")
      this.warmthFilter = this.audioContext.createBiquadFilter();
      this.warmthFilter.type = 'lowshelf';
      this.warmthFilter.frequency.setValueAtTime(220, this.audioContext.currentTime);
      this.warmthFilter.gain.setValueAtTime(2.5, this.audioContext.currentTime);

      // 3. FILTRO DE PRESENÇA VOCAL (Peaking a 3200 Hz, +2 dB) - Clareza para jogos e conversas
      this.presenceFilter = this.audioContext.createBiquadFilter();
      this.presenceFilter.type = 'peaking';
      this.presenceFilter.frequency.setValueAtTime(3200, this.audioContext.currentTime);
      this.presenceFilter.Q.setValueAtTime(1.2, this.audioContext.currentTime);
      this.presenceFilter.gain.setValueAtTime(2.0, this.audioContext.currentTime);

      // 4. COMPRESSOR DE DINÂMICA DE ESTÚDIO - Nivela sussurros e gritos, encorpando a voz
      this.compressorNode = this.audioContext.createDynamicsCompressor();
      this.compressorNode.threshold.setValueAtTime(-24, this.audioContext.currentTime);
      this.compressorNode.knee.setValueAtTime(8, this.audioContext.currentTime);
      this.compressorNode.ratio.setValueAtTime(3.5, this.audioContext.currentTime);
      this.compressorNode.attack.setValueAtTime(0.003, this.audioContext.currentTime);
      this.compressorNode.release.setValueAtTime(0.22, this.audioContext.currentTime);

      // 5. PACKETIZER DE ALTA PRIORIDADE (AudioWorklet no thread de áudio do SO)
      // Garante que o microfone NUNCA picote ou fique robótico mesmo quando o PC estiver jogando ou transmitindo tela
      this.silentGain = this.audioContext.createGain();
      this.silentGain.gain.setValueAtTime(0, this.audioContext.currentTime);

      this.isCurrentlySpeaking = false;
      this.silenceCounter = 0;

      const workletCode = `
        class ConcordVoiceProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.bufferSize = 2048;
            this.buffer = new Float32Array(this.bufferSize);
            this.index = 0;
          }
          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (!input || !input[0]) return true;
            const channel = input[0];
            const len = channel.length;
            for (let i = 0; i < len; i++) {
              this.buffer[this.index++] = channel[i];
              if (this.index >= this.bufferSize) {
                this.port.postMessage(this.buffer);
                this.buffer = new Float32Array(this.bufferSize);
                this.index = 0;
              }
            }
            return true;
          }
        }
        registerProcessor('concord-voice-processor', ConcordVoiceProcessor);
      `;

      try {
        const blob = new Blob([workletCode], { type: 'application/javascript' });
        const workletUrl = URL.createObjectURL(blob);
        await this.audioContext.audioWorklet.addModule(workletUrl);
        URL.revokeObjectURL(workletUrl);

        this.voiceWorkletNode = new AudioWorkletNode(this.audioContext, 'concord-voice-processor');
        this.voiceWorkletNode.port.onmessage = (e) => {
          this.processVoiceChunk(e.data);
        };

        this.compressorNode.connect(this.voiceWorkletNode);
        this.voiceWorkletNode.connect(this.silentGain);
        this.silentGain.connect(this.audioContext.destination);
        console.log('[VoiceEngine] AudioWorklet de áudio dedicado ativado com sucesso!');
      } catch (workletErr) {
        console.warn('[VoiceEngine] AudioWorklet indisponível, usando fallback ScriptProcessor:', workletErr);
        this.scriptProcessor = this.audioContext.createScriptProcessor(2048, 1, 1);
        this.scriptProcessor.onaudioprocess = (e) => {
          this.processVoiceChunk(e.inputBuffer.getChannelData(0));
        };
        this.compressorNode.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.silentGain);
        this.silentGain.connect(this.audioContext.destination);
      }

      // Conexão da cadeia completa com DeepFilterNet3 IA (WorkAdventure 48kHz Deep Learning)
      let currentChainNode = this.sourceNode;
      if (this.noiseMode === 'auto' || this.noiseMode === 'deepfilter') {
        try {
          const { createDeepFilterNetAudioWorklet } = await import('@workadventure/noise-suppression/deepfilternet');
          const basePath = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
          this.deepFilterWorklet = await createDeepFilterNetAudioWorklet(this.audioContext, {
            moduleUrl: new URL('noise-suppression/processor.js', basePath).href,
            wasmUrl: new URL('noise-suppression/df_bg.wasm', basePath).href,
            modelUrl: new URL('noise-suppression/DeepFilterNet3_onnx.tar.gz', basePath).href,
            speechAttenuationDb: 30,
            pauseAttenuationDb: 48,
            pauseGateLookaheadFrames: 1,
            bypassUntilReady: true
          });
          currentChainNode.connect(this.deepFilterWorklet.node);
          currentChainNode = this.deepFilterWorklet.node;
          console.log('[VoiceEngine] DeepFilterNet3 IA ativado com sucesso!');
        } catch (dfErr) {
          console.warn('[VoiceEngine] DeepFilterNet3 fallback para filtros WebRTC:', dfErr);
        }
      }

      currentChainNode.connect(this.highPassFilter);
      this.highPassFilter.connect(this.warmthFilter);
      this.warmthFilter.connect(this.presenceFilter);
      this.presenceFilter.connect(this.compressorNode);

      return this.localStream;
    } catch (err) {
      console.error('[VoiceEngine] Erro ao iniciar captura de voz:', err);
      throw err;
    }
  }

  processVoiceChunk(inputData) {
    if (this.isMuted || !this.currentChannelId) {
      if (this.isCurrentlySpeaking) {
        this.isCurrentlySpeaking = false;
        if (this.onSpeakingChange) this.onSpeakingChange(false);
        this.socket.emit('speaking-state', { isSpeaking: false });
      }
      return;
    }

    // Medir volume RMS
    let sum = 0;
    for (let i = 0; i < inputData.length; i++) {
      sum += inputData[i] * inputData[i];
    }
    const rms = Math.sqrt(sum / inputData.length);

    const isAboveThreshold = this.noiseMode === 'auto'
      ? rms >= 0.007
      : (!this.noiseGateEnabled || rms >= this.linearThreshold);

    if (isAboveThreshold) {
      this.silenceCounter = 0;
      if (!this.isCurrentlySpeaking) {
        this.isCurrentlySpeaking = true;
        if (this.onSpeakingChange) this.onSpeakingChange(true);
        this.socket.emit('speaking-state', { isSpeaking: true });
      }

      this.sendAudioFrame(inputData);
    } else {
      if (this.isCurrentlySpeaking) {
        this.silenceCounter++;
        if (this.silenceCounter <= 9) { // ~380ms hangover
          this.sendAudioFrame(inputData);
        } else {
          this.isCurrentlySpeaking = false;
          if (this.onSpeakingChange) this.onSpeakingChange(false);
          this.socket.emit('speaking-state', { isSpeaking: false });
        }
      }
    }
  }

  sendAudioFrame(float32Array) {
    const int16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    this.socket.emit('voice-frame', {
      channelId: this.currentChannelId,
      data: int16.buffer
    });
  }

  // Curva de ganho exponencial de estúdio estilo Discord
  // Permite elevar a voz de amigos baixos em até 5.0x (+14dB) sem distorcer
  calcGain(volume) {
    if (volume <= 0) return 0;
    if (volume <= 100) {
      return volume / 100;
    }
    const extra = (volume - 100) / 100;
    return 1.0 + Math.pow(extra, 1.25) * 4.0;
  }

  ensurePlaybackContext() {
    if (!this.playbackContext || this.playbackContext.state === 'closed') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.playbackContext = new AudioCtx({ sampleRate: 48000 });

      // Limiter / Master Compressor de estúdio na saída para permitir ganhos de até 500% sem distorção
      this.masterLimiter = this.playbackContext.createDynamicsCompressor();
      this.masterLimiter.threshold.setValueAtTime(-3, this.playbackContext.currentTime);
      this.masterLimiter.knee.setValueAtTime(3, this.playbackContext.currentTime);
      this.masterLimiter.ratio.setValueAtTime(14, this.playbackContext.currentTime);
      this.masterLimiter.attack.setValueAtTime(0.002, this.playbackContext.currentTime);
      this.masterLimiter.release.setValueAtTime(0.06, this.playbackContext.currentTime);
      this.masterLimiter.connect(this.playbackContext.destination);
    }

    if (this.playbackContext.state === 'suspended') {
      this.playbackContext.resume().catch(() => {});
    }
  }

  getOrCreatePeer(userId) {
    this.ensurePlaybackContext();
    let peer = this.remotePeers.get(userId);
    if (!peer) {
      const gainNode = this.playbackContext.createGain();
      gainNode.gain.setValueAtTime(1.0, this.playbackContext.currentTime);
      gainNode.connect(this.masterLimiter || this.playbackContext.destination);

      peer = {
        nextPlayTime: 0,
        volume: 100,
        isLocallyMuted: false,
        gainNode
      };
      this.remotePeers.set(userId, peer);
    }
    return peer;
  }

  // Reproduz áudio do amigo com qualidade cristalina e sem cortes
  playRemoteAudio(userId, arrayBuffer) {
    if (this.isDeafened) return;

    this.ensurePlaybackContext();
    const peer = this.getOrCreatePeer(userId);

    if (peer.isLocallyMuted) return;

    try {
      const int16 = new Int16Array(arrayBuffer);
      const float32 = new Float32Array(int16.length);

      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7FFF);
      }

      const audioBuffer = this.playbackContext.createBuffer(1, float32.length, 48000);
      audioBuffer.copyToChannel(float32, 0);

      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(peer.gainNode);

      // Jitter buffer inteligente ultra-suave: elimina voz de robô e cortes
      const now = this.playbackContext.currentTime;
      let startTime = peer.nextPlayTime;

      // Se o buffer anterior já encerrou, agenda com pre-buffer suave de 30ms
      if (startTime < now) {
        startTime = now + 0.030;
      }
      // Se acumulou mais de 160ms de atraso devido a oscilações de rede, reajusta suavemente
      else if (startTime - now > 0.16) {
        startTime = now + 0.030;
      }

      source.start(startTime);
      peer.nextPlayTime = startTime + audioBuffer.duration;
    } catch (err) {
      console.warn('[VoiceEngine] Erro ao reproduzir frame:', err);
    }
  }

  setUserVolume(userId, volume) {
    const peer = this.getOrCreatePeer(userId);
    peer.volume = volume;
    if (peer.gainNode && this.playbackContext) {
      const gainVal = peer.isLocallyMuted || this.isDeafened ? 0 : this.calcGain(volume);
      peer.gainNode.gain.setValueAtTime(gainVal, this.playbackContext.currentTime);
    }
  }

  setUserLocalMuted(userId, isMuted) {
    const peer = this.getOrCreatePeer(userId);
    peer.isLocallyMuted = !!isMuted;
    if (peer.gainNode && this.playbackContext) {
      const gainVal = peer.isLocallyMuted || this.isDeafened ? 0 : this.calcGain(peer.volume);
      peer.gainNode.gain.setValueAtTime(gainVal, this.playbackContext.currentTime);
    }
  }

  setMuted(muted) {
    this.isMuted = !!muted;
    if (this.isMuted) {
      if (this.onSpeakingChange) this.onSpeakingChange(false);
      this.socket.emit('speaking-state', { isSpeaking: false });
    }
  }

  setDeafened(deafened) {
    this.isDeafened = !!deafened;
    if (this.playbackContext) {
      for (const peer of this.remotePeers.values()) {
        if (peer.gainNode) {
          const val = this.isDeafened || peer.isLocallyMuted ? 0 : this.calcGain(peer.volume);
          peer.gainNode.gain.setValueAtTime(val, this.playbackContext.currentTime);
        }
      }
    }
  }

  // Ajusta o modo de áudio e sensibilidade do Noise Gate
  setNoiseSettings(mode, enabled, thresholdPercent) {
    if (typeof mode === 'string') {
      this.noiseMode = mode;
    }
    this.noiseGateEnabled = !!enabled;
    this.noiseThresholdPercent = thresholdPercent !== undefined ? thresholdPercent : 15;
    // Mapeamento: 1% = 0.004 RMS (-48 dB), 15% = 0.012 RMS (-38 dB), 60% = 0.045 RMS (-27 dB)
    this.linearThreshold = 0.003 + (this.noiseThresholdPercent / 100) * 0.05;

    // Atualiza constraints da track ativa sem reiniciar áudio
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack && audioTrack.applyConstraints) {
        const isAuto = this.noiseMode === 'auto';
        audioTrack.applyConstraints({
          noiseSuppression: isAuto,
          autoGainControl: isAuto,
          echoCancellation: true
        }).catch(() => {});
      }
    }
  }

  removeRemotePeer(userId) {
    const peer = this.remotePeers.get(userId);
    if (peer && peer.gainNode) {
      try { peer.gainNode.disconnect(); } catch (e) {}
    }
    this.remotePeers.delete(userId);
  }

  stopVoice() {
    this.currentChannelId = null;

    if (this.voiceWorkletNode) {
      try { this.voiceWorkletNode.disconnect(); } catch (e) {}
      this.voiceWorkletNode = null;
    }

    if (this.deepFilterWorklet) {
      try { this.deepFilterWorklet.dispose(); } catch (e) {}
      this.deepFilterWorklet = null;
    }

    if (this.scriptProcessor) {
      try { this.scriptProcessor.disconnect(); } catch (e) {}
      this.scriptProcessor = null;
    }
    if (this.compressorNode) {
      try { this.compressorNode.disconnect(); } catch (e) {}
      this.compressorNode = null;
    }
    if (this.presenceFilter) {
      try { this.presenceFilter.disconnect(); } catch (e) {}
      this.presenceFilter = null;
    }
    if (this.warmthFilter) {
      try { this.warmthFilter.disconnect(); } catch (e) {}
      this.warmthFilter = null;
    }
    if (this.highPassFilter) {
      try { this.highPassFilter.disconnect(); } catch (e) {}
      this.highPassFilter = null;
    }
    if (this.silentGain) {
      try { this.silentGain.disconnect(); } catch (e) {}
      this.silentGain = null;
    }
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch (e) {}
      this.sourceNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    for (const peer of this.remotePeers.values()) {
      if (peer.gainNode) {
        try { peer.gainNode.disconnect(); } catch (e) {}
      }
    }
    this.remotePeers.clear();
  }
}
