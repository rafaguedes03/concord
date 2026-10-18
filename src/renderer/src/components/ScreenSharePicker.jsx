import React, { useState, useEffect } from 'react';
import { Monitor, AppWindow, X, CheckCircle, Zap, Sparkles } from 'lucide-react';

export default function ScreenSharePicker({ isOpen, onClose, onSelectSource }) {
  const [sources, setSources] = useState([]);
  const [selectedSourceId, setSelectedSourceId] = useState(null);
  const [activeTab, setActiveTab] = useState('screens'); // 'screens' ou 'windows'
  const [selectedPreset, setSelectedPreset] = useState('720p60'); // '720p30', '720p60', '1080p60'
  const [loading, setLoading] = useState(false);
  const [withAudio, setWithAudio] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSources();
    }
  }, [isOpen]);

  const loadSources = async () => {
    if (window.electronAPI?.getScreenSources) {
      setLoading(true);
      try {
        const list = await window.electronAPI.getScreenSources();
        setSources(list);
        const screensList = list.filter((s) => s.id.startsWith('screen:'));
        if (screensList.length > 0) {
          setSelectedSourceId(screensList[0].id);
        } else if (list.length > 0) {
          setSelectedSourceId(list[0].id);
        }
      } catch (err) {
        console.error('Erro ao carregar fontes de tela:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  if (!isOpen) return null;

  // Filtrar entre telas inteiras e janelas
  const screens = sources.filter((s) => s.id.startsWith('screen:'));
  const windows = sources.filter((s) => s.id.startsWith('window:'));
  const currentList = activeTab === 'screens' ? screens : windows;

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const subList = tab === 'screens' ? screens : windows;
    if (subList.length > 0) {
      setSelectedSourceId(subList[0].id);
    }
  };

  const handleConfirm = () => {
    const finalSourceId = selectedSourceId || (currentList.length > 0 ? currentList[0].id : null);
    onSelectSource(finalSourceId, withAudio, selectedPreset);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#313338] w-full max-w-xl rounded-lg shadow-2xl border border-[#2b2d31] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-[#2b2d31] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Monitor className="text-[#5865F2]" size={22} />
            <h2 className="text-white font-bold text-lg">Transmitir Sua Tela</h2>
          </div>
          <button
            onClick={onClose}
            className="text-discord-muted hover:text-white transition p-1 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Seleção de Qualidade e FPS (720p30, 720p60 e 1080p60) */}
        <div className="bg-[#2b2d31] p-3 mx-4 mt-3 rounded-lg border border-[#35373c] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-discord-text uppercase tracking-wider">
              <Zap size={14} className="text-discord-green" />
              <span>Resolução e Taxa de Quadros (FPS)</span>
            </div>
            <span className="text-[11px] text-discord-muted">
              Transmissão fluida mesmo em segundo plano
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Opção 1: 720p 30 FPS */}
            <button
              type="button"
              onClick={() => setSelectedPreset('720p30')}
              className={`p-2.5 rounded-md border text-center transition flex flex-col items-center space-y-1 ${
                selectedPreset === '720p30'
                  ? 'bg-[#5865F2]/20 border-[#5865F2] text-white shadow'
                  : 'bg-[#1e1f22] border-[#3f4147] text-discord-muted hover:text-white hover:bg-[#35373c]'
              }`}
            >
              <span className="text-xs font-bold">720p</span>
              <span className="text-[10px] bg-[#111214] px-1.5 py-0.5 rounded font-mono">30 FPS</span>
              <span className="text-[9px] opacity-75">Economia</span>
            </button>

            {/* Opção 2: 720p 60 FPS (Padrão) */}
            <button
              type="button"
              onClick={() => setSelectedPreset('720p60')}
              className={`p-2.5 rounded-md border text-center transition flex flex-col items-center space-y-1 relative ${
                selectedPreset === '720p60'
                  ? 'bg-[#5865F2]/20 border-[#5865F2] text-white shadow'
                  : 'bg-[#1e1f22] border-[#3f4147] text-discord-muted hover:text-white hover:bg-[#35373c]'
              }`}
            >
              <span className="text-xs font-bold">720p</span>
              <span className="text-[10px] bg-discord-green/20 text-discord-green px-1.5 py-0.5 rounded font-mono font-bold">60 FPS</span>
              <span className="text-[9px] text-discord-green">Fluidez (Recomendado)</span>
            </button>

            {/* Opção 3: 1080p 60 FPS (Full HD) */}
            <button
              type="button"
              onClick={() => setSelectedPreset('1080p60')}
              className={`p-2.5 rounded-md border text-center transition flex flex-col items-center space-y-1 ${
                selectedPreset === '1080p60'
                  ? 'bg-[#5865F2]/20 border-[#5865F2] text-white shadow'
                  : 'bg-[#1e1f22] border-[#3f4147] text-discord-muted hover:text-white hover:bg-[#35373c]'
              }`}
            >
              <div className="flex items-center space-x-1">
                <Sparkles size={11} className="text-[#FEE75C]" />
                <span className="text-xs font-bold text-white">1080p</span>
              </div>
              <span className="text-[10px] bg-[#5865F2]/30 text-[#5865F2] px-1.5 py-0.5 rounded font-mono font-bold">60 FPS</span>
              <span className="text-[9px] opacity-75">Full HD Máxima Nitidez</span>
            </button>
          </div>
        </div>

        {/* Abas Telas / Janelas (se Electron) */}
        {sources.length > 0 && (
          <div className="flex border-b border-[#2b2d31] px-4 mt-3 space-x-4 text-sm font-semibold text-discord-muted">
            <button
              onClick={() => handleTabChange('screens')}
              className={`pb-2.5 flex items-center space-x-2 border-b-2 transition ${
                activeTab === 'screens'
                  ? 'border-[#5865F2] text-white'
                  : 'border-transparent hover:text-white'
              }`}
            >
              <Monitor size={16} />
              <span>Telas Inteiras ({screens.length})</span>
            </button>
            <button
              onClick={() => handleTabChange('windows')}
              className={`pb-2.5 flex items-center space-x-2 border-b-2 transition ${
                activeTab === 'windows'
                  ? 'border-[#5865F2] text-white'
                  : 'border-transparent hover:text-white'
              }`}
            >
              <AppWindow size={16} />
              <span>Janelas ({windows.length})</span>
            </button>
          </div>
        )}

        {/* Grade de Miniaturas */}
        <div className="p-4 max-h-64 overflow-y-auto">
          {sources.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {currentList.map((src) => {
                const isSelected = selectedSourceId === src.id;
                return (
                  <div
                    key={src.id}
                    onClick={() => setSelectedSourceId(src.id)}
                    className={`p-2 rounded-lg cursor-pointer transition border-2 flex flex-col items-center bg-[#2b2d31] hover:bg-[#35373c] ${
                      isSelected
                        ? 'border-[#5865F2] ring-2 ring-[#5865F2]/40'
                        : 'border-[#1e1f22]'
                    }`}
                  >
                    <div className="w-full h-28 bg-black rounded overflow-hidden flex items-center justify-center relative">
                      <img
                        src={src.thumbnail}
                        alt={src.name}
                        className="w-full h-full object-contain"
                      />
                      {isSelected && (
                        <div className="absolute top-1 right-1 bg-[#5865F2] rounded-full p-0.5">
                          <CheckCircle size={14} className="text-white" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-white font-medium truncate w-full text-center mt-2 px-1">
                      {src.name}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-discord-muted text-sm">
              <p>O navegador solicitará a tela ou janela que você deseja compartilhar.</p>
            </div>
          )}
        </div>

        {/* Opção de Áudio do Sistema */}
        <div className="px-4 py-2 border-t border-[#2b2d31] bg-[#2b2d31]/40 flex items-center justify-between text-xs text-discord-text">
          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={withAudio}
              onChange={(e) => setWithAudio(e.target.checked)}
              className="w-4 h-4 accent-[#5865F2] cursor-pointer"
            />
            <span>Compartilhar áudio do sistema/jogos</span>
          </label>
          <span className="text-[11px] text-discord-muted">
            {activeTab === 'screens' ? 'Disponível em Telas Inteiras' : 'Apenas vídeo em janelas'}
          </span>
        </div>

        {/* Rodapé de Ações */}
        <div className="bg-[#2b2d31] px-4 py-3 border-t border-[#1e1f22] flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm font-semibold text-white hover:underline transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 bg-[#5865F2] hover:bg-[#4752c4] text-white rounded text-sm font-semibold transition shadow flex items-center space-x-1.5"
          >
            <span>Iniciar Transmissão</span>
          </button>
        </div>
      </div>
    </div>
  );
}
