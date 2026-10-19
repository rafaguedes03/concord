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
import { LivekitEngine } from './services/livekitEngine';
import { VoiceEngine } from './services/voiceEngine';
import { ScreenEngine } from './services/screenEngine';
import { soundEffects } from './services/soundEffects';

const CURRENT_APP_VERSION = '1.5.1';

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
  const rawSavedServer = localStorage.getItem('dc_server') || '45.184.120.69:3002';
  const savedServer = rawSavedServer.replace(':3001', ':3002');
  const savedNoiseMode = localStorage.getItem('dc_noise_mode') || 'deepfilter';
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

  // Referências dos Motores de Áudio e Vídeo (LiveKit WebRTC + WebSocket Fallback)
  const livekitEngineRef = useRef(new LivekitEngine());
  const voiceEngineRef = useRef(null);
  const screenEngineRef = useRef(null);

  // Inicialização, conexão e monitoramento automático de novas versões
  useEffect(() => {
    // Configura detecção de fala em tempo real do LiveKit
    if (livekitEngineRef.current) {
      livekitEngineRef.current.onActiveSpeakersChanged = (speakerIds) => {
        const map = {};
        for (const id of speakerIds) {
          map[id] = true;
        }
        setSpeakingUsers(map);
      };
    }

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
      if (livekitEngineRef.current) livekitEngineRef.current.disconnect();
      if (voiceEngineRef.current) voiceEngineRef.current.stopVoice();
      if (screenEngineRef.current) screenEngineRef.current.stopShare();
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
      if (data.version && data.version !== CURRENT_APP_VERSION) {
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

    checkForUpdates(serverUrl);

    const socket = socketService.connect(serverUrl);

    const voiceEngine = new VoiceEngine(socket);
    voiceEngineRef.current = voiceEngine;

    const screenEngine = new ScreenEngine(socket);
    screenEngineRef.current = screenEngine;

    // Atualiza anel verde de fala para o próprio usuário
    voiceEngine.onSpeakingChange = (isSpeaking) => {
      if (socket.id) {
        setSpeakingUsers((prev) => ({
          ...prev,
          [socket.id]: isSpeaking
        }));
      }
    };

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-server', { nickname, userId: persistentUserId, avatarUrl: userAvatar }, (response) => {
        if (response) {
          setCurrentUser(response.self);
          setChannels(response.channels || []);
          setUsers(response.users || []);

          let defaultText = response.channels?.find((c) => c.type === 'text');
          if (!defaultText) {
            defaultText = { id: 'chat-geral', name: 'chat-geral', type: 'text' };
          }
          setCurrentTextChannel(defaultText);
          loadChannelMessages(defaultText.id);

          setIsConnectModalOpen(false);
        }
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setCurrentVoiceChannel(null);
      if (voiceEngineRef.current) voiceEngineRef.current.stopVoice();
      if (screenEngineRef.current) screenEngineRef.current.stopShare();
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
      setCurrentVoiceChannel((prev) => {
        if (prev?.id === channelId) {
          if (voiceEngineRef.current) voiceEngineRef.current.stopVoice();
          if (screenEngineRef.current) screenEngineRef.current.stopShare();
          setActiveView('chat');
          return null;
        }
        return prev;
      });
      setCurrentTextChannel((prev) => {
        if (prev?.id === channelId) {
          return null;
        }
        return prev;
      });
    });

    // Eventos de voz
    socket.on('user-joined-voice-channel', ({ user }) => {
      console.log(`[Voz] Usuário ${user.nickname} entrou na call`);
      setUsers((prev) => [...prev.filter((u) => u.id !== user.id), user]);
    });

    // Indicador visual de quem está falando (borda verde)
    socket.on('user-speaking', ({ userId, isSpeaking }) => {
      setSpeakingUsers((prev) => ({
        ...prev,
        [userId]: isSpeaking
      }));
    });

    socket.on('user-state-changed', ({ userId, isMuted, isDeafened, isScreenSharing }) => {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, isMuted, isDeafened, isScreenSharing } : u
        )
      );
    });

    // Notificações de transmissão de tela para enquadrar perfeitamente para todos
    socket.on('screen-share-started', ({ userId }) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isScreenSharing: true } : u))
      );
    });

    socket.on('screen-share-stopped', ({ userId }) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isScreenSharing: false } : u))
      );
    });

    // Recebimento de frame também assegura que a tela seja exibida mesmo se o evento start foi perdido
    socket.on('screen-frame', ({ userId }) => {
      setUsers((prev) => {
        const target = prev.find((u) => u.id === userId);
        if (target && !target.isScreenSharing) {
          return prev.map((u) => (u.id === userId ? { ...u, isScreenSharing: true } : u));
        }
        return prev;
      });
    });

    // Mensagens de texto
    socket.on('new-message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    // Notificação imediata de nova versão via WebSocket
    socket.on('update-available', ({ version, releaseNotes }) => {
      if (version && version !== CURRENT_APP_VERSION) {
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

  // Entrar em um canal de voz
  const handleSelectVoiceChannel = async (channel) => {
    const socket = socketService.getSocket();
    if (!socket || !connected) return;

    // Se já está nesta call, alterna a tela para a chamada
    if (currentVoiceChannel?.id === channel.id) {
      setActiveView('call');
      return;
    }

    if (livekitEngineRef.current) {
      await livekitEngineRef.current.disconnect();
    }
    if (voiceEngineRef.current) {
      voiceEngineRef.current.stopVoice();
    }
    if (screenEngineRef.current && currentUser?.isScreenSharing) {
      screenEngineRef.current.stopShare();
      setLocalScreenStream(null);
    }

    // Inicia SEMPRE o motor de áudio estável na porta 3002 (para que TODOS os participantes conversem na mesma sala)
    if (voiceEngineRef.current) {
      try {
        await voiceEngineRef.current.startVoice(
          channel.id,
          noiseMode,
          noiseGateEnabled,
          noiseGateThreshold
        );
      } catch (err) {
        console.error('Erro ao acessar microfone:', err);
      }
    }

    // Tenta também conectar ao LiveKit SFU em segundo plano se disponível
    socket.emit('get-livekit-token', { channelId: channel.id }, async (tokenRes) => {
      if (tokenRes?.success && livekitEngineRef.current) {
        try {
          await livekitEngineRef.current.connect(tokenRes.livekitUrl, tokenRes.token, channel.id);
          console.log('[App] Conectado via LiveKit SFU');
        } catch (lkErr) {
          console.warn('[App] LiveKit indisponível externamente, mantendo motor na porta 3002:', lkErr);
        }
      }
    });

    socket.emit('join-voice-channel', { channelId: channel.id }, ({ success, usersInRoom }) => {
      if (success) {
        setCurrentVoiceChannel(channel);
        setCurrentUser((prev) => ({ ...prev, currentVoiceChannel: channel.id }));
        if (usersInRoom && Array.isArray(usersInRoom)) {
          setUsers((prev) => {
            const map = new Map(prev.map((u) => [u.id, u]));
            for (const rUser of usersInRoom) {
              map.set(rUser.id, { ...(map.get(rUser.id) || {}), ...rUser });
            }
            return Array.from(map.values());
          });
        }
        setActiveView('call');
        soundEffects.playJoinCall();
      }
    });
  };

  // Sair do canal de voz
  const handleLeaveVoice = () => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('leave-voice-channel', () => {
        soundEffects.playLeaveCall();
        setCurrentVoiceChannel(null);
        setCurrentUser((prev) => ({ ...prev, currentVoiceChannel: null, isScreenSharing: false }));
        setActiveView('chat');

        if (livekitEngineRef.current) livekitEngineRef.current.disconnect();
        if (voiceEngineRef.current) voiceEngineRef.current.stopVoice();
        if (screenEngineRef.current) screenEngineRef.current.stopShare();
        setLocalScreenStream(null);
      });
    }
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

    if (livekitEngineRef.current) {
      livekitEngineRef.current.setMuted(newMuted);
    }
    if (voiceEngineRef.current) {
      voiceEngineRef.current.setMuted(newMuted);
    }

    if (newMuted) {
      setSpeakingUsers((prev) => ({ ...prev, [currentUser.id]: false }));
      if (socket) socket.emit('speaking-state', { isSpeaking: false });
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

    if (livekitEngineRef.current) {
      livekitEngineRef.current.setMuted(newMuted);
      livekitEngineRef.current.setDeafened(newDeafened);
    }
    if (voiceEngineRef.current) {
      voiceEngineRef.current.setMuted(newMuted);
      voiceEngineRef.current.setDeafened(newDeafened);
    }

    if (socket) {
      socket.emit('update-user-state', {
        isDeafened: newDeafened,
        isMuted: newMuted
      });
    }
  };

  // Compartilhamento de tela com aceleração GPU H.264 (LiveKit) e presets 720p/1080p 60FPS
  const handleToggleScreenShare = () => {
    if (!currentVoiceChannel) {
      alert('Entre em um canal de voz antes de compartilhar a tela!');
      return;
    }

    if (currentUser?.isScreenSharing) {
      if (livekitEngineRef.current) {
        livekitEngineRef.current.stopScreenShare();
      }
      if (screenEngineRef.current) {
        screenEngineRef.current.stopShare();
      }
      setLocalScreenStream(null);
      setCurrentUser((prev) => ({ ...prev, isScreenSharing: false }));
      const socket = socketService.getSocket();
      if (socket) socket.emit('update-user-state', { isScreenSharing: false });
    } else {
      setIsScreenPickerOpen(true);
    }
  };

  const handleStartScreenShare = async (sourceId, withAudio = false, presetKey = '720p60') => {
    try {
      if (!currentVoiceChannel) return;

      let stream = null;

      // Inicia sempre a transmissão via Socket na porta 3002 para que todos os amigos vejam garantido
      if (screenEngineRef.current) {
        stream = await screenEngineRef.current.startShare(sourceId, withAudio, currentVoiceChannel.id, presetKey);
      }

      // Tenta também transmitir via LiveKit se disponível
      if (livekitEngineRef.current && livekitEngineRef.current.isConnected()) {
        try {
          await livekitEngineRef.current.startScreenShare(sourceId, withAudio, presetKey);
        } catch (lkErr) {
          console.warn('[LiveKit] Falha ao compartilhar via LiveKit:', lkErr);
        }
      }

      if (stream) {
        setLocalScreenStream(stream);
        setCurrentUser((prev) => ({ ...prev, isScreenSharing: true }));
        setActiveView('call');

        const socket = socketService.getSocket();
        if (socket) socket.emit('update-user-state', { isScreenSharing: true });
      }
    } catch (err) {
      console.error('Falha ao iniciar compartilhamento de tela:', err);
      alert('Erro ao compartilhar tela: ' + err.message);
    }
  };

  // Controles de áudio individuais para outros participantes (0% até 200%)
  const handleVolumeChange = (userId, volume) => {
    setUserVolumes((prev) => ({ ...prev, [userId]: volume }));
    if (livekitEngineRef.current) {
      livekitEngineRef.current.setUserVolume(userId, volume);
    }
    if (voiceEngineRef.current) {
      voiceEngineRef.current.setUserVolume(userId, volume);
    }
  };

  const handleToggleLocalMute = (userId) => {
    setLocallyMutedUsers((prev) => {
      const nextMuted = !prev[userId];
      if (livekitEngineRef.current) {
        livekitEngineRef.current.setUserLocalMuted(userId, nextMuted);
      }
      if (voiceEngineRef.current) {
        voiceEngineRef.current.setUserLocalMuted(userId, nextMuted);
      }
      return { ...prev, [userId]: nextMuted };
    });
  };

  // Controle de Som e Mute da Transmissão de Tela
  const handleStreamVolumeChange = (userId, volume) => {
    setStreamVolumes((prev) => ({ ...prev, [userId]: volume }));
    if (screenEngineRef.current) {
      screenEngineRef.current.setStreamVolume(volume);
    }
  };

  const handleToggleStreamMute = (userId) => {
    setStreamMuted((prev) => {
      const nextMuted = !prev[userId];
      if (screenEngineRef.current) {
        screenEngineRef.current.setStreamMuted(nextMuted);
      }
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

    if (voiceEngineRef.current) {
      voiceEngineRef.current.setNoiseSettings(mode, enabled, threshold);
    }
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
              screenEngine={screenEngineRef.current}
              onToggleMic={handleToggleMic}
              onToggleDeafen={handleToggleDeafen}
              onToggleScreenShare={handleToggleScreenShare}
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
