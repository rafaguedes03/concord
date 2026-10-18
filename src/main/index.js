const { app, BrowserWindow, ipcMain, desktopCapturer, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Impede que o Chromium diminua o FPS ou pause timers quando o app estiver em segundo plano ou minimizado
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

// Otimizações para captura de múltiplos monitores (DirectX 11 + WGC)
app.commandLine.appendSwitch('use-angle', 'd3d11');
app.commandLine.appendSwitch('enable-features', 'WebRtcAllowWgcScreenCapturer');

let mainWindow;
let selectedDisplaySourceId = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#1e1f22',
    autoHideMenuBar: true,
    frame: false, // Barra customizada arrastável via -webkit-app-region: drag
    title: 'Concord',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false // Mantém 60 FPS fluídos mesmo em segundo plano
    }
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  // Interceptar requisição de mídia de tela nativa no Electron com suporte a múltiplos monitores
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      let chosen = sources[0];
      if (selectedDisplaySourceId) {
        const found = sources.find((s) => s.id === selectedDisplaySourceId);
        if (found) chosen = found;
      }
      callback({ video: chosen });
    });
  });
}

// IPC para registrar qual tela ou janela foi selecionada antes da captura
ipcMain.handle('set-selected-source', (event, sourceId) => {
  selectedDisplaySourceId = sourceId;
  return true;
});

// IPC para obter lista de telas e janelas com miniaturas (telas vêm primeiro)
ipcMain.handle('get-screen-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true
    });

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
      display_id: source.display_id
    }));
  } catch (err) {
    console.error('Erro ao capturar fontes de tela:', err);
    return [];
  }
});

// IPC para obter versão do aplicativo para atualização automática
ipcMain.handle('get-app-version', () => {
  return app.getVersion() || '1.3.0';
});

// IPC para aplicar atualização automática do app.asar com script resiliente a locks de arquivo
ipcMain.handle('apply-update', async (event, arrayBuffer) => {
  try {
    if (!app.isPackaged) {
      console.log('[AutoUpdate] Modo de desenvolvimento - atualização simulada com sucesso.');
      return { success: true, message: 'Modo dev' };
    }

    const resourcesPath = process.resourcesPath;
    const asarPath = path.join(resourcesPath, 'app.asar');
    const newAsarPath = path.join(resourcesPath, 'app.asar.new');
    const exePath = process.execPath;

    // Salva o novo asar recebido
    fs.writeFileSync(newAsarPath, Buffer.from(arrayBuffer));

    // Script batch resiliente: aguarda até que o app feche completamente e libera o arquivo antes de mover
    const updaterBat = path.join(app.getPath('temp'), 'concord_update.bat');
    const scriptContent = `@echo off
setlocal
set RETRIES=0
:RETRY
timeout /t 1 /nobreak > nul
move /y "${newAsarPath}" "${asarPath}" > nul
if exist "${newAsarPath}" (
    set /a RETRIES+=1
    if %RETRIES% leq 10 goto RETRY
)
start "" "${exePath}"
del "%~f0"
`;
    fs.writeFileSync(updaterBat, scriptContent);

    // Executa o script em segundo plano desanexado do processo atual
    spawn('cmd.exe', ['/c', updaterBat], { detached: true, stdio: 'ignore' }).unref();

    // Fecha o aplicativo para permitir a substituição do arquivo
    setTimeout(() => {
      app.quit();
    }, 500);

    return { success: true };
  } catch (err) {
    console.error('[AutoUpdate] Erro ao aplicar atualização:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
