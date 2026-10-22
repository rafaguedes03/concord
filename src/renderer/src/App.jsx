import React, { useState, useEffect, useRef, Component } from 'react';
import TitleBar from './components/TitleBar';
import ServerSidebar from './components/ServerSidebar';
import ChannelSidebar from './components/ChannelSidebar';
import VoiceCallView from './components/VoiceCallView';
import VoiceDock from './components/VoiceDock';
import ChatArea from './components/ChatArea';
import ConnectModal from './components/ConnectModal';
import CreateChannelModal from './components/CreateChannelModal';
import ScreenSharePicker from './components/ScreenSharePicker';
import SettingsModal from './components/SettingsModal';

import { socketService } from './services/socket';
import { LivekitEngine, STREAM_PRESETS } from './services/livekitEngine';
import { normalizeNoiseMode } from './services/voiceProcessor';
import { soundEffects } from './services/soundEffects';

const CURRENT_APP_VERSION = '1.5.6';

// true só se a versão do servidor for mais nova que a instalada (evita oferecer downgrade)
const isNewerVersion = (version) => {
  const a = String(version).split('.').map(Number);
  const b = CURRENT_APP_VERSION.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
};

// Tempo que a call fica "segurando" a vaga enquanto o socket de sinalização tenta voltar
const SOCKET_DROP_GRACE_MS = 15000;
const MEDIA_RETRY_ATTEMPTS = 3;

// O LiveKit roda no mesmo host do servidor Concord, na porta informada por ele
function buildLivekitUrl(serverAddress, port) {
  const raw = (serverAddress || '').trim();
  const withProtocol = /^https?:\/\//.test(raw) ? raw : `http://${raw}`;
  const parsed = new URL(withProtocol);
  const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${parsed.hostname}:${port || 7880}`;
}

// emit com confirmação e timeout (evita promessas penduradas se o servidor não responder)
function emitWithAck(socket, event, payload, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    socket.timeout(timeoutMs).emit(event, payload, (err, res) => {
      if (err) reject(new Error(`Servidor não respondeu a "${event}"`));
      else resolve(res);
    });
  });
}

// Error Boundary para evitar que qualquer erro no React deixe a tela cinza
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Erro capturado:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-background bg-grid text-on-surface flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-xl bg-error-container text-error flex items-center justify-center text-2xl font-headline font-bold mb-4 shadow-[0_0_16px_rgba(255,68,68,0.35)]">
            !
          </div>
          <h2 className="text-xl font-headline font-bold mb-2">Ops! Ocorreu um pequeno erro de interface</h2>
          <p className="text-on-surface-variant text-sm max-w-md mb-6">
            O aplicativo detectou um erro temporário e recuperou a sessão para você continuar conversando.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="bg-primary hover:bg-primary-container text-on-primary hover:text-on-primary-container hover-glow-pink px-6 py-2.5 rounded-lg font-headline font-bold text-sm transition"
          >
            Recarregar Interface
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  // Gerar ou carregar ID persistente do usuário
  const getOrCreatePersistentUserId = () => {
    let id = localStorage.getItem('concord_user_id');
    if (!id) {
      id = 'usr_' + Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 6);
      localStorage.setItem('concord_user_id', id);
    }
    return id;
  };

  const persistentUserId = useRef(getOrCreatePersistentUserId()).current;
  const savedAvatar = localStorage.getItem(`concord_avatar_${persistentUserId}`) || localStorage.getItem('concord_avatar') || null;
  const [userAvatar, setUserAvatar] = useState(savedAvatar);

  // Configurações salvas no localStorage
  const savedNick = localStorage.getItem('dc_nickname') || '';
  const rawSavedServer = localStorage.getItem('dc_server') || __SERVER_ADDRESS__;
  const savedServer = rawSavedServer.replace(':3001', ':3002');
  const savedNoiseMode = normalizeNoiseMode(localStorage.getItem('dc_noise_mode'));
  const savedNoiseEnabled = localStorage.getItem('dc_noise_enabled') !== 'false';
  const savedNoiseThreshold = parseInt(localStorage.getItem('dc_noise_threshold') || '15', 10);

  const [connected, setConnected] = useState(false);
  const [serverAddress, setServerAddress] = useState(savedServer);
  const [currentUser, setCurrentUser] = useState(null);
  const [channels, setChannels] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentVoiceChannel, setCurrentVoiceChannel] = useState(null);
  const [currentTextChannel, setCurrentTextChannel] = useState(null);
  const [messages, setMessages] = useState([]);

  // Visão ativa: 'call' (transmissões e participantes) ou 'chat' (conversa de texto)
  const [activeView, setActiveView] = useState('chat');

  // Supressor de Ruído (DeepFilterNet3 IA, Manual com Slider ou Desligado)
  const [noiseMode, setNoiseMode] = useState(savedNoiseMode);
  const [noiseGateEnabled, setNoiseGateEnabled] = useState(savedNoiseEnabled);
  const [noiseGateThreshold, setNoiseGateThreshold] = useState(savedNoiseThreshold);

  // Atualizar Avatar do Usuário com persistência por ID
  const handleUpdateAvatar = (dataUrl) => {
    setUserAvatar(dataUrl);
    if (persistentUserId) {
      localStorage.setItem(`concord_avatar_${persistentUserId}`, dataUrl);
    }
    localStorage.setItem('concord_avatar', dataUrl);
    setCurrentUser((prev) => (prev ? { ...prev, avatarUrl: dataUrl } : prev));
    setUsers((prev) =>
      prev.map((u) => (u.id === socketService.getSocket()?.id ? { ...u, avatarUrl: dataUrl } : u))
    );
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('update-user-avatar', { avatarUrl: dataUrl });
    }
  };

  // Estados de voz, áudio e tela
  const [speakingUsers, setSpeakingUsers] = useState({});
  const [userVolumes, setUserVolumes] = useState({});
  const [locallyMutedUsers, setLocallyMutedUsers] = useState({});
  const [streamVolumes, setStreamVolumes] = useState({});
  const [streamMuted, setStreamMuted] = useState({});
  const [localScreenStream, setLocalScreenStream] = useState(null);
  // Câmera própria (track local para o preview) e dispositivo escolhido
  const [localCameraTrack, setLocalCameraTrack] = useState(null);
  const [cameraDeviceId, setCameraDeviceId] = useState(localStorage.getItem('dc_camera_device') || '');
  // Microfone e alto-falante escolhidos ('' = padrão do sistema)
  const [micDeviceId, setMicDeviceId] = useState(localStorage.getItem('dc_mic_device') || '');
  const [speakerDeviceId, setSpeakerDeviceId] = useState(localStorage.getItem('dc_speaker_device') || '');
  // Estado da conexão de mídia (LiveKit): null | 'connecting' | 'connected' | 'reconnecting'
  const [mediaState, setMediaState] = useState(null);

  // Atualização Automática
  const [updateStatus, setUpdateStatus] = useState({
    available: false,
    version: '',
    releaseNotes: '',
    downloading: false,
    progress: 0,
    error: null
  });

  // Modais
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(!savedNick);
  const [isCreateChannelModalOpen, setIsCreateChannelModalOpen] = useState(false);
  const [createChannelType, setCreateChannelType] = useState('voice');
  const [isScreenPickerOpen, setIsScreenPickerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Motor de mídia único: voz e tela via LiveKit WebRTC (o socket fica só para sinalização e chat)
  const livekitEngineRef = useRef(new LivekitEngine());

  // Refs lidas pelos handlers de socket/LiveKit registrados uma única vez (evita closures desatualizadas)
  const currentVoiceChannelRef = useRef(null);
  const currentUserRef = useRef(null);
  const serverAddressRef = useRef(savedServer);
  const noiseSettingsRef = useRef({
    mode: savedNoiseMode,
    gateEnabled: savedNoiseEnabled,
    thresholdPercent: savedNoiseThreshold
  });
  const socketDropTimerRef = useRef(null);
  const isJoiningVoiceRef = useRef(false);
  const cameraBusyRef = useRef(false);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Inicialização, conexão e monitoramento automático de novas versões
  useEffect(() => {
    const livekitEngine = livekitEngineRef.current;
    livekitEngine.cameraDeviceId = localStorage.getItem('dc_camera_device') || null;
    livekitEngine.micDeviceId = localStorage.getItem('dc_mic_device') || null;
    livekitEngine.speakerDeviceId = localStorage.getItem('dc_speaker_device') || null;
    soundEffects.setOutputDevice(livekitEngine.speakerDeviceId);

    // Detecção de fala em tempo real do LiveKit (inclui o próprio usuário)
    livekitEngine.onActiveSpeakersChanged = (speakerIds) => {
      const map = {};
      for (const id of speakerIds) {
        map[id] = true;
      }
      setSpeakingUsers(map);
    };

    livekitEngine.onConnectionStateChange = (state) => {
      if (state === 'reconnecting') {
        setMediaState('reconnecting');
      } else if (state === 'connected') {
        setMediaState('connected');
      } else if (state === 'disconnected') {
        // O SDK desistiu de reconectar: busca um token novo e entra de novo na sala
        const channel = currentVoiceChannelRef.current;
        if (!channel) return;
        markScreenShareStopped();
        markCameraStopped();
        setMediaState('reconnecting');
        retryMediaConnection(channel, 1);
      }
    };

    // Usuário encerrou a captura pelo sistema operacional (ex.: "Parar compartilhamento")
    livekitEngine.onLocalScreenShareEnded = () => {
      markScreenShareStopped();
    };

    // Câmera desconectada ou bloqueada pelo sistema durante a call
    livekitEngine.onLocalCameraEnded = () => {
      markCameraStopped();
    };

    if (savedNick && savedServer) {
      handleConnect(savedNick, savedServer);
    } else if (savedServer) {
      checkForUpdates(savedServer);
    }

    // Monitora atualizações a cada 15 segundos sem travar o app
    const updateTimer = setInterval(() => {
      checkForUpdates(serverAddress || savedServer);
    }, 15000);

    return () => {
      clearInterval(updateTimer);
      clearTimeout(socketDropTimerRef.current);
      livekitEngine.disconnect();
      socketService.disconnect();
    };
  }, []);

  // Verifica atualizações no servidor (com cache-busting para detecção instantânea)
  const checkForUpdates = async (serverUrl) => {
    try {
      if (!serverUrl) return;
      const cleanUrl = serverUrl.startsWith('http') ? serverUrl : `http://${serverUrl}`;
      const res = await fetch(`${cleanUrl}/download/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.version && isNewerVersion(data.version)) {
        console.log(`[AutoUpdate] Nova versão detectada: v${data.version} (Instalada: v${CURRENT_APP_VERSION})`);
        setUpdateStatus({
          available: true,
          version: data.version,
          releaseNotes: data.releaseNotes || 'Nova versão com melhorias de tela e janela.',
          downloading: false,
          progress: 0,
          error: null
        });
      }
    } catch (e) {}
  };

  // Aplica atualização automática sem precisar baixar o executável
  const handleStartAutoUpdate = async () => {
    if (!window.electronAPI?.applyUpdate) {
      alert('A atualização automática funciona no aplicativo instalado no Windows.');
      return;
    }

    setUpdateStatus((prev) => ({ ...prev, downloading: true, progress: 10 }));

    try {
      const cleanUrl = serverAddress.startsWith('http') ? serverAddress : `http://${serverAddress}`;
      const response = await fetch(`${cleanUrl}/download/app.asar`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Não foi possível obter app.asar do servidor');

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;

      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (total > 0) {
          const pct = Math.round((loaded / total) * 100);
          setUpdateStatus((prev) => ({ ...prev, progress: pct }));
        }
      }

      const fullBuffer = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) {
        fullBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      setUpdateStatus((prev) => ({ ...prev, progress: 100 }));

      // Envia buffer para o processo principal substituir e reiniciar o app sozinho
      const result = await window.electronAPI.applyUpdate(fullBuffer.buffer);
      if (!result?.success && result?.error) {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('[AutoUpdate] Erro:', err);
      setUpdateStatus((prev) => ({ ...prev, downloading: false, error: err.message }));
      alert('Erro ao atualizar automaticamente: ' + err.message);
    }
  };

  // Conectar ao servidor com apelido (Sem Login)
  const handleConnect = (nickname, serverUrl) => {
    localStorage.setItem('dc_nickname', nickname);
    localStorage.setItem('dc_server', serverUrl);
    setServerAddress(serverUrl);
    serverAddressRef.current = serverUrl;

    checkForUpdates(serverUrl);

    // Trocar de servidor encerra a call atual (o canal pertence ao servidor antigo)
    if (currentVoiceChannelRef.current) {
      leaveVoiceLocally();
    }

    const socket = socketService.connect(serverUrl);

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-server', { nickname, userId: persistentUserId, avatarUrl: userAvatar }, (response) => {
        if (response) {
          const previousUser = currentUserRef.current;
          setCurrentUser(
            previousUser
              ? { ...response.self, isMuted: previousUser.isMuted, isDeafened: previousUser.isDeafened }
              : response.self
          );
          setChannels(response.channels || []);
          setUsers(response.users || []);

          let defaultText = response.channels?.find((c) => c.type === 'text');
          if (!defaultText) {
            defaultText = { id: 'chat-geral', name: 'chat-geral', type: 'text' };
          }
          setCurrentTextChannel(defaultText);
          loadChannelMessages(defaultText.id);

          setIsConnectModalOpen(false);

          // Socket voltou depois de uma queda: entra de novo na mesma call automaticamente
          const channelToRejoin = currentVoiceChannelRef.current;
          if (channelToRejoin) {
            clearTimeout(socketDropTimerRef.current);
            if (previousUser && (previousUser.isMuted || previousUser.isDeafened)) {
              socket.emit('update-user-state', {
                isMuted: !!previousUser.isMuted,
                isDeafened: !!previousUser.isDeafened
              });
            }
            console.log(`[App] Reconectado ao servidor, voltando para a call ${channelToRejoin.id}...`);
            joinVoiceChannel(channelToRejoin, { isRejoin: true });
          }
        }
      });
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      // Saída intencional (troca de servidor/fechar app) não segura a call
      if (reason === 'io client disconnect') return;
      if (currentVoiceChannelRef.current) {
        // A mídia do LiveKit segue funcionando; damos um tempo para o socket voltar antes de encerrar a call
        setMediaState('reconnecting');
        clearTimeout(socketDropTimerRef.current);
        socketDropTimerRef.current = setTimeout(() => {
          if (!socketService.getSocket()?.connected && currentVoiceChannelRef.current) {
            console.warn('[App] Servidor não voltou a tempo, encerrando a call');
            leaveVoiceLocally();
            soundEffects.playLeaveCall();
          }
        }, SOCKET_DROP_GRACE_MS);
      }
    });

    // Atualizações de usuários e canais
    socket.on('user-joined-server', (newUser) => {
      setUsers((prev) => [...prev.filter((u) => u.id !== newUser.id), newUser]);
    });

    socket.on('user-updated', (updatedUser) => {
      setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
      if (updatedUser.id === socket.id) {
        setCurrentUser(updatedUser);
      }
    });

    socket.on('user-left-server', (userId) => {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setSpeakingUsers((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });

    socket.on('channel-created', (newChannel) => {
      setChannels((prev) => [...prev, newChannel]);
    });

    socket.on('channel-deleted', ({ channelId }) => {
      setChannels((prev) => prev.filter((c) => c.id !== channelId));
      if (currentVoiceChannelRef.current?.id === channelId) {
        leaveVoiceLocally();
      }
      setCurrentTextChannel((prev) => {
        if (prev?.id === channelId) {
          return null;
        }
        return prev;
      });
    });

    // Eventos de voz
    socket.on('user-joined-voice-channel', ({ user, channelId }) => {
      console.log(`[Voz] Usuário ${user.nickname} entrou na call`);
      setUsers((prev) => [...prev.filter((u) => u.id !== user.id), user]);
      // Avisa quem já está na call (quem entrou ouve o próprio som em joinVoiceChannel)
      if (currentVoiceChannelRef.current?.id === channelId && user.id !== socket.id) {
        soundEffects.playJoinCall();
      }
    });

    // O estado do usuário chega pelo 'user-updated'; aqui só tocamos o som para quem ficou na call
    socket.on('user-left-voice-channel', ({ userId, channelId }) => {
      if (currentVoiceChannelRef.current?.id === channelId && userId !== socket.id) {
        soundEffects.playLeaveCall();
      }
    });

    socket.on('user-state-changed', ({ userId, isMuted, isDeafened, isScreenSharing, isCameraOn }) => {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, isMuted, isDeafened, isScreenSharing, isCameraOn: !!isCameraOn } : u
        )
      );
    });

    // Notificações de transmissão de tela para enquadrar perfeitamente para todos
    socket.on('screen-share-started', ({ userId, preset }) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isScreenSharing: true, screenPreset: preset } : u))
      );
    });

    socket.on('screen-share-stopped', ({ userId }) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isScreenSharing: false } : u))
      );
    });

    // Mensagens de texto
    socket.on('new-message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    // Notificação imediata de nova versão via WebSocket
    socket.on('update-available', ({ version, releaseNotes }) => {
      if (version && isNewerVersion(version)) {
        console.log(`[AutoUpdate WS] Nova versão detectada via Socket: v${version}`);
        setUpdateStatus({
          available: true,
          version,
          releaseNotes: releaseNotes || 'Nova versão com correções essenciais.',
          downloading: false,
          progress: 0,
          error: null
        });
      }
    });
  };

  const loadChannelMessages = (channelId) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('get-messages', { channelId }, (msgs) => {
        setMessages(msgs || []);
      });
    }
  };

  // Conecta a mídia (LiveKit) do canal: token -> sala -> microfone com o processador de voz
  const connectMedia = async (channel) => {
    const socket = socketService.getSocket();
    const livekitEngine = livekitEngineRef.current;
    if (!socket?.connected) throw new Error('Sem conexão com o servidor');

    const tokenRes = await emitWithAck(socket, 'get-livekit-token', { channelId: channel.id });
    if (!tokenRes?.success) {
      throw new Error(tokenRes?.error || 'Servidor não gerou o token do LiveKit');
    }

    const livekitUrl = tokenRes.livekitUrl || buildLivekitUrl(serverAddressRef.current, tokenRes.livekitPort);
    await livekitEngine.connect(livekitUrl, tokenRes.token, channel.id);

    const user = currentUserRef.current;
    await livekitEngine.setMuted(!!user?.isMuted);
    livekitEngine.setDeafened(!!user?.isDeafened);

    // Sem microfone (permissão negada/dispositivo ausente) a pessoa ainda ouve e assiste a call
    try {
      await livekitEngine.startMicrophone(noiseSettingsRef.current);
    } catch (micErr) {
      console.error('Erro ao acessar microfone:', micErr);
    }

    setMediaState('connected');
    console.log('[App] Mídia conectada via LiveKit SFU');
  };

  // Nova tentativa de mídia após o LiveKit desistir de reconectar sozinho
  const retryMediaConnection = (channel, attempt) => {
    setTimeout(async () => {
      if (currentVoiceChannelRef.current?.id !== channel.id) return;
      // Se o socket caiu junto, o rejoin acontece quando ele voltar
      if (!socketService.getSocket()?.connected) return;
      try {
        await connectMedia(channel);
      } catch (err) {
        console.warn(`[App] Tentativa ${attempt} de reconectar a mídia falhou:`, err);
        if (attempt < MEDIA_RETRY_ATTEMPTS) {
          retryMediaConnection(channel, attempt + 1);
        } else {
          handleLeaveVoice();
          alert('A conexão de voz caiu e não foi possível reconectar. Entre na call novamente.');
        }
      }
    }, 1500 * attempt);
  };

  // Entra no canal de voz: presença no servidor + mídia no LiveKit
  const joinVoiceChannel = async (channel, { isRejoin = false } = {}) => {
    const socket = socketService.getSocket();
    if (!socket?.connected || isJoiningVoiceRef.current) return;
    isJoiningVoiceRef.current = true;

    const livekitEngine = livekitEngineRef.current;
    try {
      await livekitEngine.disconnect();
      markScreenShareStopped();
      markCameraStopped();
      setMediaState(isRejoin ? 'reconnecting' : 'connecting');

      const joinRes = await emitWithAck(socket, 'join-voice-channel', { channelId: channel.id });
      if (!joinRes?.success) throw new Error('O servidor recusou a entrada no canal');

      currentVoiceChannelRef.current = channel;
      setCurrentVoiceChannel(channel);
      setCurrentUser((prev) => ({ ...prev, currentVoiceChannel: channel.id, isScreenSharing: false, isCameraOn: false }));
      if (Array.isArray(joinRes.usersInRoom)) {
        setUsers((prev) => {
          const map = new Map(prev.map((u) => [u.id, u]));
          for (const rUser of joinRes.usersInRoom) {
            map.set(rUser.id, { ...(map.get(rUser.id) || {}), ...rUser });
          }
          return Array.from(map.values());
        });
      }
      if (!isRejoin) {
        setActiveView('call');
      }

      await connectMedia(channel);
      if (!isRejoin) soundEffects.playJoinCall();
    } catch (err) {
      console.error('[App] Falha ao entrar na call:', err);
      handleLeaveVoice();
      alert(
        'Não foi possível conectar a voz: ' + err.message +
        '\n\nVerifique se o servidor está com o LiveKit ativo e com as portas TCP 7880/7881 e UDP 7882 liberadas' +
        ' (se o domínio passa pelo proxy do Cloudflare, configure LIVEKIT_URL no server/.env).'
      );
    } finally {
      isJoiningVoiceRef.current = false;
    }
  };

  // Entrar em um canal de voz
  const handleSelectVoiceChannel = async (channel) => {
    if (!connected) return;

    // Se já está nesta call, alterna a tela para a chamada
    if (currentVoiceChannel?.id === channel.id) {
      setActiveView('call');
      return;
    }

    await joinVoiceChannel(channel);
  };

  // Limpa a call no cliente (sem depender do servidor responder)
  const leaveVoiceLocally = () => {
    currentVoiceChannelRef.current = null;
    clearTimeout(socketDropTimerRef.current);
    livekitEngineRef.current.disconnect();
    setCurrentVoiceChannel(null);
    setCurrentUser((prev) => (prev ? { ...prev, currentVoiceChannel: null, isScreenSharing: false, isCameraOn: false } : prev));
    setLocalScreenStream(null);
    setLocalCameraTrack(null);
    setSpeakingUsers({});
    setMediaState(null);
    setActiveView('chat');
  };

  // Sair do canal de voz
  const handleLeaveVoice = () => {
    const wasInCall = !!currentVoiceChannelRef.current;
    leaveVoiceLocally();
    const socket = socketService.getSocket();
    if (socket?.connected) {
      socket.emit('leave-voice-channel', () => {});
    }
    if (wasInCall) soundEffects.playLeaveCall();
  };

  // Alternar microfone próprio (Mute)
  const handleToggleMic = () => {
    const socket = socketService.getSocket();
    if (!currentUser) return;

    const newMuted = !currentUser.isMuted;
    setCurrentUser((prev) => ({ ...prev, isMuted: newMuted }));

    if (newMuted) {
      soundEffects.playMute();
    } else {
      soundEffects.playUnmute();
    }

    livekitEngineRef.current.setMuted(newMuted);

    if (newMuted) {
      setSpeakingUsers((prev) => ({ ...prev, [currentUser.id]: false }));
    }

    if (socket) {
      socket.emit('update-user-state', { isMuted: newMuted });
    }
  };

  // Alternar áudio do fone (Deafen / Ensurdecer)
  const handleToggleDeafen = () => {
    const socket = socketService.getSocket();
    if (!currentUser) return;

    const newDeafened = !currentUser.isDeafened;
    const newMuted = newDeafened ? true : currentUser.isMuted;

    if (newDeafened) {
      soundEffects.playDeafen();
    } else {
      soundEffects.playUndeafen();
    }

    setCurrentUser((prev) => ({
      ...prev,
      isDeafened: newDeafened,
      isMuted: newMuted
    }));

    livekitEngineRef.current.setMuted(newMuted);
    livekitEngineRef.current.setDeafened(newDeafened);

    if (socket) {
      socket.emit('update-user-state', {
        isDeafened: newDeafened,
        isMuted: newMuted
      });
    }
  };

  // Marca a transmissão própria como encerrada (UI + servidor)
  const markScreenShareStopped = () => {
    setLocalScreenStream(null);
    if (!currentUserRef.current?.isScreenSharing) return;
    setCurrentUser((prev) => (prev ? { ...prev, isScreenSharing: false } : prev));
    const socket = socketService.getSocket();
    if (socket?.connected) {
      socket.emit('stop-screen-share', { channelId: currentVoiceChannelRef.current?.id });
      socket.emit('update-user-state', { isScreenSharing: false });
    }
  };

  // Compartilhamento de tela com aceleração GPU H.264 (LiveKit) e presets 720p/1080p 60FPS
  const handleToggleScreenShare = () => {
    if (!currentVoiceChannel) {
      alert('Entre em um canal de voz antes de compartilhar a tela!');
      return;
    }

    if (currentUser?.isScreenSharing) {
      livekitEngineRef.current.stopScreenShare();
      markScreenShareStopped();
    } else {
      setIsScreenPickerOpen(true);
    }
  };

  const handleStartScreenShare = async (sourceId, withAudio = false, presetKey = '720p60') => {
    try {
      if (!currentVoiceChannel) return;
      const livekitEngine = livekitEngineRef.current;
      if (!livekitEngine.isConnected()) {
        throw new Error('a conexão de voz/vídeo (LiveKit) não está ativa');
      }

      const stream = await livekitEngine.startScreenShare(sourceId, withAudio, presetKey);
      const preset = STREAM_PRESETS[livekitEngine.currentPresetKey];

      setLocalScreenStream(stream);
      setCurrentUser((prev) => ({ ...prev, isScreenSharing: true, screenPreset: livekitEngine.currentPresetKey }));
      setActiveView('call');

      const socket = socketService.getSocket();
      if (socket) {
        socket.emit('start-screen-share', {
          channelId: currentVoiceChannel.id,
          preset: livekitEngine.currentPresetKey,
          width: preset.width,
          height: preset.height,
          fps: preset.fps
        });
        socket.emit('update-user-state', { isScreenSharing: true });
      }
    } catch (err) {
      console.error('Falha ao iniciar compartilhamento de tela:', err);
      alert('Erro ao compartilhar tela: ' + err.message);
    }
  };

  // Marca a câmera própria como desligada (UI + servidor)
  const markCameraStopped = () => {
    setLocalCameraTrack(null);
    if (!currentUserRef.current?.isCameraOn) return;
    setCurrentUser((prev) => (prev ? { ...prev, isCameraOn: false } : prev));
    const socket = socketService.getSocket();
    if (socket?.connected) {
      socket.emit('update-user-state', { isCameraOn: false });
    }
  };

  // Liga/desliga a câmera na call (720p 30 FPS com simulcast via LiveKit)
  const handleToggleCamera = async () => {
    if (!currentVoiceChannel || cameraBusyRef.current) return;
    const livekitEngine = livekitEngineRef.current;

    if (currentUser?.isCameraOn) {
      await livekitEngine.stopCamera();
      markCameraStopped();
      return;
    }

    cameraBusyRef.current = true;
    try {
      if (!livekitEngine.isConnected()) {
        throw new Error('a conexão de voz/vídeo (LiveKit) não está ativa');
      }
      const track = await livekitEngine.startCamera();
      setLocalCameraTrack(track);
      setCurrentUser((prev) => ({ ...prev, isCameraOn: true }));
      const socket = socketService.getSocket();
      if (socket) socket.emit('update-user-state', { isCameraOn: true });
    } catch (err) {
      console.error('Falha ao ligar a câmera:', err);
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      const missing = err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError';
      alert(
        denied
          ? 'O acesso à câmera foi bloqueado. No Windows, verifique Configurações > Privacidade e segurança > Câmera e permita o acesso para aplicativos da área de trabalho.'
          : missing
          ? 'Nenhuma câmera encontrada. Conecte uma câmera ou escolha outra no menu ao lado do botão.'
          : 'Erro ao ligar a câmera: ' + err.message
      );
    } finally {
      cameraBusyRef.current = false;
    }
  };

  // Escolhe a câmera usada (troca ao vivo se ela estiver ligada)
  const handleSelectCamera = async (deviceId) => {
    setCameraDeviceId(deviceId);
    localStorage.setItem('dc_camera_device', deviceId);
    try {
      await livekitEngineRef.current.switchCamera(deviceId);
    } catch (err) {
      console.error('Falha ao trocar de câmera:', err);
      alert('Não foi possível usar essa câmera: ' + err.message);
    }
  };

  // Escolhe o microfone (troca ao vivo na call, mantendo o processador de voz)
  const handleSelectMic = async (deviceId) => {
    setMicDeviceId(deviceId);
    localStorage.setItem('dc_mic_device', deviceId);
    try {
      await livekitEngineRef.current.switchMicrophone(deviceId);
    } catch (err) {
      console.error('Falha ao trocar de microfone:', err);
      alert('Não foi possível usar esse microfone: ' + err.message);
    }
  };

  // Escolhe o alto-falante/fone de todo o áudio da call e dos efeitos sonoros
  const handleSelectSpeaker = async (deviceId) => {
    setSpeakerDeviceId(deviceId);
    localStorage.setItem('dc_speaker_device', deviceId);
    soundEffects.setOutputDevice(deviceId);
    try {
      await livekitEngineRef.current.switchSpeaker(deviceId);
    } catch (err) {
      console.error('Falha ao trocar de alto-falante:', err);
      alert('Não foi possível usar esse alto-falante: ' + err.message);
    }
  };

  // Controles de áudio individuais para outros participantes (0% até 200%)
  const handleVolumeChange = (userId, volume) => {
    setUserVolumes((prev) => ({ ...prev, [userId]: volume }));
    livekitEngineRef.current.setUserVolume(userId, volume);
  };

  const handleToggleLocalMute = (userId) => {
    setLocallyMutedUsers((prev) => {
      const nextMuted = !prev[userId];
      livekitEngineRef.current.setUserLocalMuted(userId, nextMuted);
      return { ...prev, [userId]: nextMuted };
    });
  };

  // Controle de Som e Mute da Transmissão de Tela
  const handleStreamVolumeChange = (userId, volume) => {
    setStreamVolumes((prev) => ({ ...prev, [userId]: volume }));
    livekitEngineRef.current.setStreamVolume(userId, volume);
  };

  const handleToggleStreamMute = (userId) => {
    setStreamMuted((prev) => {
      const nextMuted = !prev[userId];
      livekitEngineRef.current.setStreamMuted(userId, nextMuted);
      return { ...prev, [userId]: nextMuted };
    });
  };

  // Atualizar Supressor de Ruído (Modo IA vs Manual)
  const handleUpdateNoiseGate = (mode, enabled, threshold) => {
    setNoiseMode(mode);
    setNoiseGateEnabled(enabled);
    setNoiseGateThreshold(threshold);
    localStorage.setItem('dc_noise_mode', mode);
    localStorage.setItem('dc_noise_enabled', enabled ? 'true' : 'false');
    localStorage.setItem('dc_noise_threshold', threshold.toString());

    const normalizedMode = normalizeNoiseMode(mode);
    noiseSettingsRef.current = { mode: normalizedMode, gateEnabled: enabled, thresholdPercent: threshold };
    livekitEngineRef.current.setNoiseSettings(normalizedMode, enabled, threshold);
  };

  // Criar canal
  const handleCreateChannel = (name, type) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('create-channel', { name, type }, (res) => {
        if (res?.success && type === 'voice') {
          handleSelectVoiceChannel(res.channel);
        }
      });
    }
  };

  // Excluir canal (voz ou texto)
  const handleDeleteChannel = (channelId) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('delete-channel', { channelId }, (res) => {
        if (res?.success) {
          if (currentVoiceChannel?.id === channelId) {
            handleLeaveVoice();
          }
          if (currentTextChannel?.id === channelId) {
            const remaining = channels.filter((c) => c.id !== channelId && c.type === 'text');
            if (remaining.length > 0) {
              setCurrentTextChannel(remaining[0]);
              loadChannelMessages(remaining[0].id);
            } else {
              setCurrentTextChannel(null);
            }
          }
        } else if (res?.message) {
          alert(res.message);
        }
      });
    }
  };

  // Enviar mensagem de texto e imagem (garantido para todos os usuários)
  const handleSendMessage = (text, image = null) => {
    const socket = socketService.getSocket();
    if (socket && ((text && text.trim()) || image)) {
      const channelId = currentTextChannel?.id || channels.find((c) => c.type === 'text')?.id || 'chat-geral';
      socket.emit('send-message', {
        channelId,
        text: (text || '').trim(),
        image: image || null,
        senderName: currentUser?.nickname || localStorage.getItem('dc_nickname') || 'Amigo',
        avatarUrl: currentUser?.avatarUrl || userAvatar || null
      });
    }
  };

  // Usuários na call atual
  const usersInCall = currentVoiceChannel
    ? users.filter((u) => u.currentVoiceChannel === currentVoiceChannel.id)
    : [];

  return (
    <ErrorBoundary>
      <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
        {/* Barra de Título Superior Customizada */}
        <TitleBar />

        {/* Banner de Atualização Automática Estilo Discord */}
        {updateStatus.available && (
          <div className="bg-surface-container border-b border-primary/50 shadow-[inset_0_0_12px_rgba(255,45,120,0.1)] text-on-surface px-4 py-2 flex items-center justify-between text-xs font-semibold z-50 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center space-x-2 truncate">
              <span className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded font-label font-bold text-[10px] tracking-widest">
                NOVA VERSÃO v{updateStatus.version}
              </span>
              <span className="truncate">{updateStatus.releaseNotes}</span>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              {updateStatus.downloading ? (
                <div className="bg-surface-container-lowest px-3 py-1 rounded font-label text-[11px] text-secondary flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-ping"></span>
                  <span>Atualizando... {updateStatus.progress}%</span>
                </div>
              ) : (
                <button
                  onClick={handleStartAutoUpdate}
                  className="bg-surface-container-high text-primary border border-primary/50 hover:bg-primary-container hover:text-on-primary-container hover-glow-pink px-3.5 py-1 rounded-lg font-headline font-bold text-xs transition cursor-pointer active:scale-95"
                >
                  Atualizar Agora (Sem reinstalar)
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* Barra Lateral 1: Servidores */}
          <ServerSidebar
            connected={connected}
            serverAddress={serverAddress}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
          />

          {/* Barra Lateral 2: Canais e Usuário */}
          <ChannelSidebar
            channels={channels}
            currentVoiceChannel={currentVoiceChannel}
            currentTextChannel={currentTextChannel}
            users={users}
            currentUser={currentUser}
            speakingUsers={speakingUsers}
            onSelectVoiceChannel={handleSelectVoiceChannel}
            onSelectTextChannel={(ch) => {
              setCurrentTextChannel(ch);
              loadChannelMessages(ch.id);
              setActiveView('chat'); // Alterna para o chat de texto mantendo a voz conectada!
            }}
            onOpenCreateChannel={(type) => {
              setCreateChannelType(type);
              setIsCreateChannelModalOpen(true);
            }}
            onDeleteChannel={handleDeleteChannel}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onToggleMic={handleToggleMic}
            onToggleDeafen={handleToggleDeafen}
            onLeaveVoice={handleLeaveVoice}
          />

          {/* Área Central: Visualização de Chamada / Transmissões OU Chat de Texto */}
          {activeView === 'call' && currentVoiceChannel ? (
            <VoiceCallView
              channel={currentVoiceChannel}
              usersInCall={usersInCall}
              currentUser={currentUser}
              speakingUsers={speakingUsers}
              localScreenStream={localScreenStream}
              livekitEngine={livekitEngineRef.current}
              mediaState={mediaState}
              onToggleMic={handleToggleMic}
              onToggleDeafen={handleToggleDeafen}
              onToggleScreenShare={handleToggleScreenShare}
              localCameraTrack={localCameraTrack}
              cameraDeviceId={cameraDeviceId}
              onToggleCamera={handleToggleCamera}
              onSelectCamera={handleSelectCamera}
              micDeviceId={micDeviceId}
              speakerDeviceId={speakerDeviceId}
              onSelectMic={handleSelectMic}
              onSelectSpeaker={handleSelectSpeaker}
              onLeaveCall={handleLeaveVoice}
              userVolumes={userVolumes}
              locallyMutedUsers={locallyMutedUsers}
              onVolumeChange={handleVolumeChange}
              onToggleLocalMute={handleToggleLocalMute}
              onStreamVolumeChange={handleStreamVolumeChange}
              onToggleStreamMute={handleToggleStreamMute}
              streamVolumes={streamVolumes}
              streamMuted={streamMuted}
              noiseMode={noiseMode}
            />
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <ChatArea
                currentTextChannel={currentTextChannel}
                messages={messages}
                currentUser={currentUser}
                onSendMessage={handleSendMessage}
                isVoiceConnected={!!currentVoiceChannel}
                onJoinVoiceFromChat={() => {
                  const general = channels.find((c) => c.type === 'voice');
                  if (general) handleSelectVoiceChannel(general);
                }}
              />
              <VoiceDock
                channel={currentVoiceChannel}
                usersCount={usersInCall.length}
                currentUser={currentUser}
                onToggleMic={handleToggleMic}
                onToggleDeafen={handleToggleDeafen}
                onOpenCall={() => setActiveView('call')}
                onLeave={handleLeaveVoice}
              />
            </div>
          )}
        </div>

        {/* MODAL 1: Conexão / Apelido */}
        <ConnectModal
          isOpen={isConnectModalOpen}
          initialNick={currentUser?.nickname || savedNick}
          initialServer={serverAddress}
          onConnect={(nick, srv) => {
            handleConnect(nick, srv);
            setIsConnectModalOpen(false);
          }}
        />

        {/* MODAL 2: Criar Canal */}
        <CreateChannelModal
          isOpen={isCreateChannelModalOpen}
          defaultType={createChannelType}
          onClose={() => setIsCreateChannelModalOpen(false)}
          onCreateChannel={handleCreateChannel}
        />

        {/* MODAL 3: Seletor de Tela com Opções 720p30, 720p60 e 1080p60 */}
        <ScreenSharePicker
          isOpen={isScreenPickerOpen}
          onClose={() => setIsScreenPickerOpen(false)}
          onSelectSource={handleStartScreenShare}
        />

        {/* MODAL 4: Configurações do Usuário, Servidor e Supressor de Ruído */}
        <SettingsModal
          isOpen={isSettingsOpen}
          currentUser={currentUser ? { ...currentUser, avatarUrl: currentUser.avatarUrl || userAvatar } : { avatarUrl: userAvatar }}
          serverAddress={serverAddress}
          noiseMode={noiseMode}
          noiseGateEnabled={noiseGateEnabled}
          noiseGateThreshold={noiseGateThreshold}
          onUpdateNoiseGate={handleUpdateNoiseGate}
          onClose={() => setIsSettingsOpen(false)}
          onUpdateAvatar={handleUpdateAvatar}
          persistentUserId={persistentUserId}
          onUpdateNickname={(newNick) => {
            setCurrentUser((prev) => ({ ...prev, nickname: newNick }));
            localStorage.setItem('dc_nickname', newNick);
            const s = socketService.getSocket();
            if (s) s.emit('join-server', { nickname: newNick, userId: persistentUserId, avatarUrl: userAvatar });
          }}
          onReconnectWithNewServer={(newServer) => {
            handleConnect(currentUser?.nickname || 'Anonimo', newServer);
          }}
        />
      </div>
    </ErrorBoundary>
  );
}
