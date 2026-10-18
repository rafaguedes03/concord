// WebRTC Mesh Manager com suporte a Voz, Supressão de Ruído e Compartilhamento 720p 60FPS

import { NoiseGateProcessor } from './noiseGate';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ]
};

export class WebRTCManager {
  constructor(socket) {
    this.socket = socket;
    this.localRawAudioStream = null;
    this.localProcessedAudioStream = null;
    this.localScreenStream = null;
    this.noiseGateProcessor = null;

    this.peerConnections = new Map(); // peerId -> RTCPeerConnection
    this.candidateQueues = new Map(); // peerId -> [RTCIceCandidateInit]
    this.remoteStreams = new Map(); // peerId -> { audioStream, screenStream }

    // Motor de áudio global persistente para garantir que sempre escutemos os amigos
    // peerId -> { audioEl, gainNode, ctx, isLocallyMuted, volume }
    this.remoteAudioNodes = new Map();
    this.selfDeafened = false;

    // Stream de áudio da tela
    this.remoteScreenAudioNodes = new Map(); // peerId -> { audioEl, gainNode, isMuted, volume }

    // Callbacks
    this.onRemoteStream = null; // (peerId, { audioStream, screenStream }) => {}
    this.onPeerDisconnected = null; // (peerId) => {}

    this.setupSocketListeners();
  }

  setupSocketListeners() {
    // Oferta SDP recebida
    this.socket.on('webrtc-offer', async ({ from, offer, streamType }) => {
      console.log(`[WebRTC] Recebida offer de ${from} (${streamType})`);
      const pc = this.getOrCreatePeerConnection(from);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        // Descarrega candidatos ICE acumulados
        await this.flushIceCandidates(from, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.optimizeSenders(pc);

        this.socket.emit('webrtc-answer', {
          to: from,
          answer: pc.localDescription,
          streamType
        });
      } catch (err) {
        console.error(`[WebRTC] Erro ao responder offer de ${from}:`, err);
      }
    });

    // Resposta SDP recebida
    this.socket.on('webrtc-answer', async ({ from, answer, streamType }) => {
      console.log(`[WebRTC] Recebida answer de ${from} (${streamType})`);
      const pc = this.peerConnections.get(from);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await this.flushIceCandidates(from, pc);
          this.optimizeSenders(pc);
        } catch (err) {
          console.error(`[WebRTC] Erro ao aplicar answer de ${from}:`, err);
        }
      }
    });

    // ICE Candidate recebido (com fila para evitar erro de remoteDescription nulo)
    this.socket.on('webrtc-ice-candidate', async ({ from, candidate }) => {
      if (!candidate) return;

      const pc = this.peerConnections.get(from);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn(`[WebRTC] Falha ao adicionar ICE candidate de ${from}:`, err);
        }
      } else {
        // Enfileira candidato para quando o remoteDescription for setado
        if (!this.candidateQueues.has(from)) {
          this.candidateQueues.set(from, []);
        }
        this.candidateQueues.get(from).push(candidate);
      }
    });

    // Usuário saiu do canal
    this.socket.on('user-left-voice-channel', ({ userId }) => {
      this.closePeerConnection(userId);
    });
  }

  async flushIceCandidates(peerId, pc) {
    const queue = this.candidateQueues.get(peerId);
    if (queue && queue.length > 0) {
      console.log(`[WebRTC] Descarregando ${queue.length} ICE candidates para ${peerId}`);
      for (const cand of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('Erro ao descarregar candidato ICE:', e);
        }
      }
      this.candidateQueues.set(peerId, []);
    }
  }

  // Inicializa microfone local com Supressor de Ruído
  async initLocalAudio(initialNoiseThreshold = 0.15) {
    if (this.localProcessedAudioStream) return this.localProcessedAudioStream;

    try {
      this.localRawAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000
        },
        video: false
      });

      // Inicializa o processador de ruído Web Audio
      this.noiseGateProcessor = new NoiseGateProcessor(this.localRawAudioStream, initialNoiseThreshold);
      this.localProcessedAudioStream = this.noiseGateProcessor.getProcessedStream();

      return this.localProcessedAudioStream;
    } catch (err) {
      console.warn('[WebRTC] Microfone não disponível, criando stream mudo:', err);
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const dst = osc.connect(ctx.createMediaStreamDestination());
      osc.start();
      const track = dst.stream.getAudioTracks()[0];
      track.enabled = false;
      this.localProcessedAudioStream = dst.stream;
      return this.localProcessedAudioStream;
    }
  }

  setNoiseThreshold(val) {
    if (this.noiseGateProcessor) {
      this.noiseGateProcessor.setThreshold(val);
    }
  }

  setNoiseGateEnabled(enable) {
    if (this.noiseGateProcessor) {
      this.noiseGateProcessor.setEnabled(enable);
    }
  }

  // Cria ou recupera uma conexão Peer com outro usuário
  getOrCreatePeerConnection(peerId) {
    if (this.peerConnections.has(peerId)) {
      return this.peerConnections.get(peerId);
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnections.set(peerId, pc);

    // Enviar ICE candidates locais via Socket
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('webrtc-ice-candidate', {
          to: peerId,
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Conexão com ${peerId}:`, pc.connectionState);
      if (pc.connectionState === 'failed') {
        pc.restartIce();
      }
    };

    // Receber tracks remotas de áudio e tela
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Track remota de ${peerId}: tipo=${event.track.kind}, id=${event.track.id}`);
      let streams = this.remoteStreams.get(peerId);
      if (!streams) {
        streams = { audioStream: new MediaStream(), screenStream: null, screenAudioStream: null };
        this.remoteStreams.set(peerId, streams);
      }

      if (event.track.kind === 'audio') {
        // Se já tivermos uma track de áudio de voz e vier outra, pode ser áudio da tela
        if (streams.audioStream.getAudioTracks().length === 0) {
          streams.audioStream.addTrack(event.track);
          // Conecta ao motor de áudio global persistente para tocar imediatamente!
          this.attachRemoteAudio(peerId, streams.audioStream);
        } else {
          // Áudio da tela compartilhada
          if (!streams.screenAudioStream) streams.screenAudioStream = new MediaStream();
          streams.screenAudioStream.addTrack(event.track);
          this.attachRemoteScreenAudio(peerId, streams.screenAudioStream);
        }
      } else if (event.track.kind === 'video') {
        // Track de vídeo (transmissão de tela)
        streams.screenStream = event.streams[0] || new MediaStream([event.track]);
      }

      if (this.onRemoteStream) {
        this.onRemoteStream(peerId, streams);
      }
    };

    // Adiciona tracks de áudio locais
    if (this.localProcessedAudioStream) {
      this.localProcessedAudioStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localProcessedAudioStream);
      });
    }

    // Adiciona tracks de tela locais
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localScreenStream);
      });
    }

    return pc;
  }

  // Motor de áudio para tocar o amigo em qualquer tela sem cortes e com volume seguro de até 200%
  attachRemoteAudio(peerId, stream) {
    try {
      let node = this.remoteAudioNodes.get(peerId);
      if (!node) {
        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.playsInline = true;

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(1.0, ctx.currentTime);

        const destination = ctx.createMediaStreamDestination();
        source.connect(gainNode);
        gainNode.connect(destination);

        audioEl.srcObject = destination.stream;
        audioEl.play().catch(() => {});

        node = {
          audioEl,
          gainNode,
          ctx,
          isLocallyMuted: false,
          volume: 100
        };
        this.remoteAudioNodes.set(peerId, node);
      } else {
        node.audioEl.srcObject = stream;
        node.audioEl.play().catch(() => {});
      }
    } catch (e) {
      console.warn('Erro ao anexar áudio global:', e);
    }
  }

  // Motor de áudio para a transmissão de tela
  attachRemoteScreenAudio(peerId, stream) {
    try {
      let node = this.remoteScreenAudioNodes.get(peerId);
      if (!node) {
        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.playsInline = true;

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(1.0, ctx.currentTime);

        const destination = ctx.createMediaStreamDestination();
        source.connect(gainNode);
        gainNode.connect(destination);

        audioEl.srcObject = destination.stream;
        audioEl.play().catch(() => {});

        node = {
          audioEl,
          gainNode,
          ctx,
          isMuted: false,
          volume: 100
        };
        this.remoteScreenAudioNodes.set(peerId, node);
      }
    } catch (e) {
      console.warn('Erro ao anexar áudio da tela:', e);
    }
  }

  // Controle de volume individual seguro (0% a 200%) usando Web Audio GainNode
  setUserVolume(peerId, volumePercent) {
    const node = this.remoteAudioNodes.get(peerId);
    if (node && node.gainNode && node.ctx) {
      node.volume = volumePercent;
      if (!node.isLocallyMuted && !this.selfDeafened) {
        const gainVal = Math.max(0, volumePercent / 100);
        node.gainNode.gain.setValueAtTime(gainVal, node.ctx.currentTime);
      }
    }
  }

  // Mute local de um participante
  setUserLocalMuted(peerId, isMuted) {
    const node = this.remoteAudioNodes.get(peerId);
    if (node && node.gainNode && node.ctx) {
      node.isLocallyMuted = !!isMuted;
      if (node.isLocallyMuted || this.selfDeafened) {
        node.gainNode.gain.setValueAtTime(0, node.ctx.currentTime);
      } else {
        const gainVal = Math.max(0, node.volume / 100);
        node.gainNode.gain.setValueAtTime(gainVal, node.ctx.currentTime);
      }
    }
  }

  // Controle de volume / mute da transmissão de tela
  setStreamVolume(peerId, volumePercent) {
    const node = this.remoteScreenAudioNodes.get(peerId);
    if (node && node.gainNode && node.ctx) {
      node.volume = volumePercent;
      if (!node.isMuted) {
        node.gainNode.gain.setValueAtTime(Math.max(0, volumePercent / 100), node.ctx.currentTime);
      }
    }
  }

  setStreamMuted(peerId, isMuted) {
    const node = this.remoteScreenAudioNodes.get(peerId);
    if (node && node.gainNode && node.ctx) {
      node.isMuted = !!isMuted;
      if (node.isMuted) {
        node.gainNode.gain.setValueAtTime(0, node.ctx.currentTime);
      } else {
        node.gainNode.gain.setValueAtTime(Math.max(0, node.volume / 100), node.ctx.currentTime);
      }
    }
  }

  // Ensurdecer próprio (Deafen) - silencia todos os amigos
  setSelfDeafened(deafened) {
    this.selfDeafened = !!deafened;
    for (const [peerId, node] of this.remoteAudioNodes.entries()) {
      if (node.gainNode && node.ctx) {
        if (this.selfDeafened) {
          node.gainNode.gain.setValueAtTime(0, node.ctx.currentTime);
        } else if (!node.isLocallyMuted) {
          node.gainNode.gain.setValueAtTime(Math.max(0, node.volume / 100), node.ctx.currentTime);
        }
      }
    }
  }

  // Iniciar chamada com um usuário (criar offer)
  async initiateCall(peerId) {
    console.log(`[WebRTC] Iniciando chamada para ${peerId}...`);
    const pc = this.getOrCreatePeerConnection(peerId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.optimizeSenders(pc);

      this.socket.emit('webrtc-offer', {
        to: peerId,
        offer: pc.localDescription,
        streamType: 'voice'
      });
    } catch (err) {
      console.error(`[WebRTC] Erro ao criar offer para ${peerId}:`, err);
    }
  }

  // Iniciar compartilhamento de tela com 720p @ 60 FPS (Correção tela preta)
  async startScreenShare(sourceId = null, withAudio = false) {
    try {
      let stream;

      if (sourceId && window.electronAPI) {
        // Se for tela inteira (screen:), suporta captura de áudio opcional
        const isWholeScreen = sourceId.startsWith('screen:');
        let audioConfig = false;
        if (withAudio && isWholeScreen) {
          audioConfig = {
            mandatory: {
              chromeMediaSource: 'desktop'
            }
          };
        }

        // Constraints flexíveis para não dar tela preta com resoluções diferentes
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
              maxFrameRate: 60
            },
            optional: [
              { maxWidth: 1280 },
              { maxHeight: 720 }
            ]
          },
          audio: audioConfig
        });
      } else {
        // Fallback getDisplayMedia padrão
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1280, max: 1280 },
            height: { ideal: 720, max: 720 },
            frameRate: { ideal: 60, max: 60 }
          },
          audio: withAudio
        });
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        if ('contentHint' in videoTrack) {
          videoTrack.contentHint = 'motion';
        }
        videoTrack.onended = () => {
          this.stopScreenShare();
        };
      }

      this.localScreenStream = stream;

      // Adiciona as tracks de tela e renegocia com todos
      for (const [peerId, pc] of this.peerConnections.entries()) {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          this.optimizeSenders(pc);
          this.socket.emit('webrtc-offer', {
            to: peerId,
            offer: pc.localDescription,
            streamType: 'screen'
          });
        } catch (err) {
          console.error(`[WebRTC] Erro ao atualizar tela para ${peerId}:`, err);
        }
      }

      return stream;
    } catch (err) {
      console.error('[WebRTC] Erro ao iniciar compartilhamento de tela:', err);
      throw err;
    }
  }

  // Otimiza bitrate e framerate nas conexões para 720p 60FPS
  optimizeSenders(pc) {
    try {
      const senders = pc.getSenders();
      senders.forEach((sender) => {
        if (sender.track && sender.track.kind === 'video') {
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          // Bitrate de alta fidelidade para 60fps
          params.encodings[0].maxBitrate = 4500000;
          params.encodings[0].maxFramerate = 60;
          params.encodings[0].priority = 'high';
          sender.setParameters(params).catch(() => {});
        }
      });
    } catch (e) {}
  }

  // Parar compartilhamento de tela
  stopScreenShare() {
    if (!this.localScreenStream) return;

    const screenTracks = this.localScreenStream.getTracks();
    screenTracks.forEach((track) => track.stop());

    for (const [peerId, pc] of this.peerConnections.entries()) {
      const senders = pc.getSenders();
      senders.forEach((sender) => {
        if (sender.track && screenTracks.includes(sender.track)) {
          pc.removeTrack(sender);
        }
      });

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          this.socket.emit('webrtc-offer', {
            to: peerId,
            offer: pc.localDescription,
            streamType: 'stop-screen'
          });
        })
        .catch((e) => console.error(e));
    }

    this.localScreenStream = null;
  }

  // Muta ou desmuta microfone local
  setMuted(muted) {
    if (this.localRawAudioStream) {
      this.localRawAudioStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
    if (this.localProcessedAudioStream) {
      this.localProcessedAudioStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  closePeerConnection(peerId) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    this.candidateQueues.delete(peerId);
    this.remoteStreams.delete(peerId);

    const node = this.remoteAudioNodes.get(peerId);
    if (node) {
      if (node.audioEl) {
        node.audioEl.srcObject = null;
        node.audioEl.remove();
      }
      if (node.ctx && node.ctx.state !== 'closed') {
        node.ctx.close().catch(() => {});
      }
      this.remoteAudioNodes.delete(peerId);
    }

    const screenNode = this.remoteScreenAudioNodes.get(peerId);
    if (screenNode) {
      if (screenNode.audioEl) {
        screenNode.audioEl.srcObject = null;
        screenNode.audioEl.remove();
      }
      this.remoteScreenAudioNodes.delete(peerId);
    }

    if (this.onPeerDisconnected) {
      this.onPeerDisconnected(peerId);
    }
  }

  leaveCall() {
    this.stopScreenShare();

    for (const [peerId, pc] of this.peerConnections.entries()) {
      pc.close();
    }
    this.peerConnections.clear();
    this.candidateQueues.clear();
    this.remoteStreams.clear();

    for (const [peerId, node] of this.remoteAudioNodes.entries()) {
      if (node.audioEl) {
        node.audioEl.srcObject = null;
        node.audioEl.remove();
      }
      if (node.ctx && node.ctx.state !== 'closed') node.ctx.close().catch(() => {});
    }
    this.remoteAudioNodes.clear();

    for (const [peerId, node] of this.remoteScreenAudioNodes.entries()) {
      if (node.audioEl) {
        node.audioEl.srcObject = null;
        node.audioEl.remove();
      }
    }
    this.remoteScreenAudioNodes.clear();

    if (this.noiseGateProcessor) {
      this.noiseGateProcessor.stop();
      this.noiseGateProcessor = null;
    }

    if (this.localRawAudioStream) {
      this.localRawAudioStream.getTracks().forEach((t) => t.stop());
      this.localRawAudioStream = null;
    }
    this.localProcessedAudioStream = null;
  }
}
