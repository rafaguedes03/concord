// Motor de Transmissão de Tela em Tempo Real estilo Discord
// 100% em tempo real (zero câmera lenta, descarte instantâneo de quadros atrasados)
// Suporte a multi-stream (várias pessoas transmitindo juntas) e presets 720p30, 720p60 e 1080p60

export const STREAM_PRESETS = {
  '720p30': {
    name: '720p 30 FPS',
    width: 1280,
    height: 720,
    fps: 30,
    interval: 33,
    quality: 0.44
  },
  '720p60': {
    name: '720p 60 FPS',
    width: 1280,
    height: 720,
    fps: 60,
    interval: 16,
    quality: 0.38
  },
  '1080p60': {
    name: '1080p 60 FPS',
    width: 1920,
    height: 1080,
    fps: 60,
    interval: 16,
    quality: 0.34 // Ultra leve para manter 60 FPS sem pesar CPU e sem travar voz
  }
};

export class ScreenEngine {
  constructor(socket) {
    this.socket = socket;
    this.isSharing = false;
    this.currentChannelId = null;
    this.currentPresetKey = '720p60';

    // Elementos de captura (streamer)
    this.localStream = null;
    this.hiddenVideo = null;
    this.captureCanvas = null;
    this.captureCtx = null;
    this.isEncoding = false;
    this.lastFrameTime = 0;
    this.videoCallbackId = null;

    // Web Worker de alta precisão anti-throttling para segundo plano
    this.tickerWorker = null;

    // Áudio da tela (streamer)
    this.screenAudioStream = null;
    this.screenAudioCtx = null;
    this.screenAudioProcessor = null;
    this.screenSilentGain = null;

    // Reprodução de áudio da tela por usuário (viewer)
    this.playbackCtx = null;
    this.streamAudioNodes = new Map(); // userId -> { gainNode, nextPlayTime }
    this.isStreamMuted = false;
    this.streamVolume = 100;

    // Callbacks e listeners do visualizador
    this.frameListeners = new Set();
    this.pendingFrames = new Map(); // userId -> { frame, timestamp }
    this.isDecodingUser = new Set(); // userId
    this.onFrameReceived = null; // (userId, imageBitmap) => {}
    this.onShareStarted = null;  // (userId, meta) => {}
    this.onShareStopped = null;  // (userId) => {}

    this.setupSocketListeners();
    this.initWorker();
  }

  addFrameListener(fn) {
    this.frameListeners.add(fn);
    return () => {
      this.frameListeners.delete(fn);
    };
  }

  initWorker() {
    try {
      const workerCode = `
        let timer = null;
        self.onmessage = function(e) {
          if (e.data && e.data.action === 'start') {
            if (timer) clearInterval(timer);
            timer = setInterval(function() {
              self.postMessage('tick');
            }, e.data.interval || 16);
          } else if (e.data === 'stop') {
            if (timer) clearInterval(timer);
            timer = null;
          }
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.tickerWorker = new Worker(workerUrl);

      this.tickerWorker.onmessage = (e) => {
        if (e.data === 'tick') {
          this.captureFrame();
        }
      };
    } catch (err) {
      console.warn('[ScreenEngine] Web Worker não suportado:', err);
    }
  }

  setupSocketListeners() {
    // Receptor Zero-Latency: NUNCA enfileira frames antigos (comportamento UDP)
    this.socket.on('screen-frame', ({ userId, frame, timestamp }) => {
      // Substitui qualquer frame anterior pelo mais recente recebido
      this.pendingFrames.set(userId, { frame, timestamp: Date.now() });

      if (!this.isDecodingUser.has(userId)) {
        this.processNextFrame(userId);
      }
    });

    this.socket.on('screen-share-started', ({ userId, preset, width, height, fps }) => {
      if (this.onShareStarted) {
        this.onShareStarted(userId, { preset, width, height, fps });
      }
    });

    this.socket.on('screen-audio-frame', ({ userId, data }) => {
      this.playRemoteScreenAudio(userId, data);
    });

    this.socket.on('screen-share-stopped', ({ userId }) => {
      this.pendingFrames.delete(userId);
      this.isDecodingUser.delete(userId);
      if (this.onShareStopped) {
        this.onShareStopped(userId);
      }
      this.streamAudioNodes.delete(userId);
    });
  }

  async processNextFrame(userId) {
    if (!this.pendingFrames.has(userId)) {
      this.isDecodingUser.delete(userId);
      return;
    }

    this.isDecodingUser.add(userId);
    const { frame } = this.pendingFrames.get(userId);
    this.pendingFrames.delete(userId);

    try {
      const blob = new Blob([frame], { type: 'image/jpeg' });
      const bitmap = await createImageBitmap(blob);

      if (this.onFrameReceived) {
        try { this.onFrameReceived(userId, bitmap); } catch (e) {}
      }

      if (this.frameListeners.size > 0) {
        for (const listener of this.frameListeners) {
          try {
            listener(userId, bitmap);
          } catch (e) {}
        }
      }

      bitmap.close();
    } catch (err) {}

    // Se chegou um frame mais novo enquanto decodificava este, processa imediatamente
    if (this.pendingFrames.has(userId)) {
      requestAnimationFrame(() => this.processNextFrame(userId));
    } else {
      this.isDecodingUser.delete(userId);
    }
  }

  async startShare(sourceId = null, withAudio = false, channelId = null, presetKey = '720p60') {
    this.currentChannelId = channelId;
    this.currentPresetKey = presetKey in STREAM_PRESETS ? presetKey : '720p60';
    const preset = STREAM_PRESETS[this.currentPresetKey];
    this.isSharing = true;

    try {
      let stream;

      if (sourceId && window.electronAPI?.isElectron) {
        if (window.electronAPI.setSelectedSource) {
          try {
            await window.electronAPI.setSelectedSource(sourceId);
          } catch (e) {}
        }

        const isWholeScreen = sourceId.startsWith('screen:');
        let audioConfig = false;
        if (withAudio && isWholeScreen) {
          audioConfig = {
            mandatory: {
              chromeMediaSource: 'desktop'
            }
          };
        }

        try {
          // Captura com constraints amplas para suportar resolução nativa de qualquer monitor secundário
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: sourceId,
                minWidth: 640,
                maxWidth: 3840,
                minHeight: 360,
                maxHeight: 2160,
                maxFrameRate: preset.fps
              }
            },
            audio: audioConfig
          });
        } catch (gumErr) {
          console.warn('[ScreenEngine] getUserMedia falhou para a fonte selecionada, usando fallback getDisplayMedia:', gumErr);
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: { ideal: preset.width, max: 3840 },
              height: { ideal: preset.height, max: 2160 },
              frameRate: { ideal: preset.fps, max: preset.fps }
            },
            audio: withAudio
          });
        }
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: preset.width, max: preset.width },
            height: { ideal: preset.height, max: preset.height },
            frameRate: { ideal: preset.fps, max: preset.fps }
          },
          audio: withAudio
        });
      }

      this.localStream = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.stopShare();
        };
      }

      if (!this.hiddenVideo) {
        this.hiddenVideo = document.createElement('video');
        this.hiddenVideo.muted = true;
        this.hiddenVideo.autoplay = true;
        this.hiddenVideo.playsInline = true;
      }
      this.hiddenVideo.srcObject = stream;
      await this.hiddenVideo.play();

      // Aguarda o vídeo carregar os dados reais do monitor para não enviar quadro preto inicial
      await new Promise((resolve) => {
        if (this.hiddenVideo.videoWidth > 0 && this.hiddenVideo.readyState >= 2) {
          resolve();
        } else {
          const onMeta = () => {
            this.hiddenVideo.removeEventListener('loadedmetadata', onMeta);
            resolve();
          };
          this.hiddenVideo.addEventListener('loadedmetadata', onMeta);
          setTimeout(resolve, 600);
        }
      });

      if (!this.captureCanvas) {
        this.captureCanvas = document.createElement('canvas');
      }
      this.captureCanvas.width = preset.width;
      this.captureCanvas.height = preset.height;
      // Renderização direta por GPU sem willReadFrequently para 0% de impacto na CPU e nos jogos
      this.captureCtx = this.captureCanvas.getContext('2d', {
        alpha: false
      });
      this.captureCtx.imageSmoothingEnabled = true;
      this.captureCtx.imageSmoothingQuality = 'medium';

      this.socket.emit('start-screen-share', {
        channelId: this.currentChannelId,
        preset: this.currentPresetKey,
        width: preset.width,
        height: preset.height,
        fps: preset.fps
      });

      this.isEncoding = false;
      this.lastFrameTime = 0;
      this.startCaptureLoop(preset);

      const audioTracks = stream.getAudioTracks();
      if (withAudio && audioTracks.length > 0) {
        this.startScreenAudioCapture(audioTracks[0]);
      }

      return stream;
    } catch (err) {
      console.error('[ScreenEngine] Erro ao iniciar compartilhamento:', err);
      this.stopShare();
      throw err;
    }
  }

  // Loop inteligente sincronizado com o compositor gráfico da GPU
  startCaptureLoop(preset) {
    this.stopCaptureLoop();

    const loop = () => {
      if (!this.isSharing) return;
      this.captureFrame();

      if (this.hiddenVideo && 'requestVideoFrameCallback' in this.hiddenVideo) {
        this.videoCallbackId = this.hiddenVideo.requestVideoFrameCallback(loop);
      }
    };

    if (this.hiddenVideo && 'requestVideoFrameCallback' in this.hiddenVideo) {
      this.videoCallbackId = this.hiddenVideo.requestVideoFrameCallback(loop);
    } else if (this.tickerWorker) {
      this.tickerWorker.postMessage({ action: 'start', interval: preset.interval });
    } else {
      this.fallbackInterval = setInterval(() => this.captureFrame(), preset.interval);
    }
  }

  stopCaptureLoop() {
    if (this.hiddenVideo && this.videoCallbackId !== null && 'cancelVideoFrameCallback' in this.hiddenVideo) {
      try { this.hiddenVideo.cancelVideoFrameCallback(this.videoCallbackId); } catch (e) {}
      this.videoCallbackId = null;
    }
    if (this.tickerWorker) {
      this.tickerWorker.postMessage('stop');
    }
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
  }

  // Captura e envio em tempo real com prioridade absoluta para o áudio de voz
  captureFrame() {
    if (!this.isSharing || this.isEncoding) return;
    if (!this.hiddenVideo || this.hiddenVideo.readyState < 2) return;

    // PROTEÇÃO CRÍTICA DE BANDA: Se o buffer de rede tiver mais de 8KB, PULA o frame de vídeo!
    // Isso garante que o áudio/voz em tempo real NUNCA sofra picote, atraso ou voz robótica
    const wsTransport = this.socket?.io?.engine?.transport?.ws;
    if (wsTransport && wsTransport.bufferedAmount > 8192) {
      return;
    }

    const now = performance.now();
    const preset = STREAM_PRESETS[this.currentPresetKey] || STREAM_PRESETS['720p60'];
    if (now - this.lastFrameTime < preset.interval - 2) {
      return;
    }
    this.lastFrameTime = now;

    try {
      this.isEncoding = true;
      this.captureCtx.drawImage(this.hiddenVideo, 0, 0, preset.width, preset.height);

      this.captureCanvas.toBlob(
        (blob) => {
          if (blob && this.isSharing) {
            blob.arrayBuffer().then((buffer) => {
              // Checagem de segurança antes de transmitir
              const currentWs = this.socket?.io?.engine?.transport?.ws;
              if (currentWs && currentWs.bufferedAmount > 16384) {
                this.isEncoding = false;
                return;
              }

              this.socket.emit('screen-frame', {
                channelId: this.currentChannelId,
                frame: buffer,
                timestamp: Date.now()
              });
              this.isEncoding = false;
            }).catch(() => {
              this.isEncoding = false;
            });
          } else {
            this.isEncoding = false;
          }
        },
        'image/jpeg',
        preset.quality
      );
    } catch (e) {
      this.isEncoding = false;
    }
  }

  startScreenAudioCapture(audioTrack) {
    try {
      this.screenAudioStream = new MediaStream([audioTrack]);
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.screenAudioCtx = new AudioCtx({ sampleRate: 48000 });

      const source = this.screenAudioCtx.createMediaStreamSource(this.screenAudioStream);
      // 2048 amostras (~42.6 ms) reduz pela metade a quantidade de pacotes sem atrasar o som
      this.screenAudioProcessor = this.screenAudioCtx.createScriptProcessor(2048, 1, 1);

      this.screenSilentGain = this.screenAudioCtx.createGain();
      this.screenSilentGain.gain.setValueAtTime(0, this.screenAudioCtx.currentTime);

      this.screenAudioProcessor.onaudioprocess = (e) => {
        if (!this.isSharing || !this.currentChannelId) return;

        const input = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        this.socket.emit('screen-audio-frame', {
          channelId: this.currentChannelId,
          data: int16.buffer
        });
      };

      source.connect(this.screenAudioProcessor);
      this.screenAudioProcessor.connect(this.screenSilentGain);
      this.screenSilentGain.connect(this.screenAudioCtx.destination);
    } catch (e) {
      console.warn('[ScreenEngine] Não foi possível capturar áudio da tela:', e);
    }
  }

  playRemoteScreenAudio(userId, arrayBuffer) {
    if (this.isStreamMuted) return;

    if (!this.playbackCtx || this.playbackCtx.state === 'closed') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.playbackCtx = new AudioCtx({ sampleRate: 48000 });
    }

    if (this.playbackCtx.state === 'suspended') {
      this.playbackCtx.resume().catch(() => {});
    }

    let node = this.streamAudioNodes.get(userId);
    if (!node) {
      const gainNode = this.playbackCtx.createGain();
      gainNode.gain.setValueAtTime(Math.max(0, this.streamVolume / 100), this.playbackCtx.currentTime);
      gainNode.connect(this.playbackCtx.destination);
      node = { gainNode, nextPlayTime: 0 };
      this.streamAudioNodes.set(userId, node);
    }

    try {
      const int16 = new Int16Array(arrayBuffer);
      const float32 = new Float32Array(int16.length);

      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7FFF);
      }

      const audioBuffer = this.playbackCtx.createBuffer(1, float32.length, 48000);
      audioBuffer.copyToChannel(float32, 0);

      const source = this.playbackCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(node.gainNode);

      const now = this.playbackCtx.currentTime;
      let startTime = Math.max(now, node.nextPlayTime);
      if (node.nextPlayTime - now > 0.06) {
        startTime = now + 0.01;
      }

      source.start(startTime);
      node.nextPlayTime = startTime + audioBuffer.duration;
    } catch (err) {
      console.warn('[ScreenEngine] Erro ao reproduzir áudio da tela:', err);
    }
  }

  calcGain(volume) {
    if (volume <= 0) return 0;
    if (volume <= 100) return volume / 100;
    const extra = (volume - 100) / 100;
    return 1.0 + Math.pow(extra, 1.25) * 4.0;
  }

  setStreamVolume(volumePercent) {
    this.streamVolume = volumePercent;
    this.applyStreamVolume();
  }

  setStreamMuted(isMuted) {
    this.isStreamMuted = !!isMuted;
    this.applyStreamVolume();
  }

  applyStreamVolume() {
    if (this.playbackCtx) {
      const val = this.isStreamMuted ? 0 : this.calcGain(this.streamVolume);
      for (const node of this.streamAudioNodes.values()) {
        if (node.gainNode) {
          node.gainNode.gain.setValueAtTime(val, this.playbackCtx.currentTime);
        }
      }
    }
  }

  stopShare() {
    this.isSharing = false;

    this.stopCaptureLoop();

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    if (this.hiddenVideo) {
      this.hiddenVideo.srcObject = null;
    }

    if (this.screenAudioProcessor) {
      try { this.screenAudioProcessor.disconnect(); } catch (e) {}
      this.screenAudioProcessor = null;
    }

    if (this.screenSilentGain) {
      try { this.screenSilentGain.disconnect(); } catch (e) {}
      this.screenSilentGain = null;
    }

    if (this.screenAudioCtx && this.screenAudioCtx.state !== 'closed') {
      this.screenAudioCtx.close().catch(() => {});
      this.screenAudioCtx = null;
    }

    if (this.currentChannelId) {
      this.socket.emit('stop-screen-share', { channelId: this.currentChannelId });
      this.currentChannelId = null;
    }
  }
}
