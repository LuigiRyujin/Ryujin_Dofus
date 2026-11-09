import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IPC_CHANNELS, type ResolvedTheme, type ThemePreference, type UserPreferences } from '../shared/ipc';
import { PreferencesManager } from './preferences';

const isDev = process.env.NODE_ENV === 'development';
const directory = fileURLToPath(new URL('.', import.meta.url));

let mainWindow: BrowserWindow | null = null;
let prefsManager: PreferencesManager;

app.setName('RyujinDofus');
app.setAppUserModelId('com.ryujin.dofus');

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  }
  return pref;
}

function getTitleBarOverlayConfig(resolved: ResolvedTheme) {
  return {
    color: resolved === 'dark' ? '#081321' : '#E8F0F8',
    symbolColor: resolved === 'dark' ? '#E8F3FB' : '#0B1B3D',
    height: 32
  };
}

function getBackgroundColor(resolved: ResolvedTheme): string {
  return resolved === 'dark' ? '#050B14' : '#F4F8FC';
}

function updateWindowTheme(window: BrowserWindow, resolved: ResolvedTheme) {
  if (process.platform === 'win32') {
    window.setTitleBarOverlay(getTitleBarOverlayConfig(resolved));
  }
  window.setBackgroundColor(getBackgroundColor(resolved));
  window.webContents.send(IPC_CHANNELS.THEME_CHANGED, resolved);
}

function createMainWindow(): BrowserWindow {
  prefsManager = new PreferencesManager();
  const prefs = prefsManager.get();
  const resolved = resolveTheme(prefs.theme);

  const initialBounds = prefs.windowBounds || { width: 1440, height: 900 };

  const win = new BrowserWindow({
    title: 'RyujinDofus',
    width: initialBounds.width,
    height: initialBounds.height,
    x: initialBounds.x,
    y: initialBounds.y,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: getBackgroundColor(resolved),
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: getTitleBarOverlayConfig(resolved),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(directory, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  });

  win.removeMenu();

  // Security restrictions
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const isRenderer = isDev && process.env.ELECTRON_RENDERER_URL
      ? url.startsWith(process.env.ELECTRON_RENDERER_URL)
      : url.startsWith('file:');
    if (!isRenderer) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Track window bounds
  const saveBounds = () => {
    if (!win.isMinimized() && !win.isMaximized()) {
      const bounds = win.getBounds();
      prefsManager.updateBounds(bounds);
    }
  };

  win.on('resize', saveBounds);
  win.on('move', saveBounds);

  win.once('ready-to-show', () => {
    win.show();
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(directory, '../renderer/index.html'));
  }

  return win;
}

// IPC Handlers
ipcMain.handle(IPC_CHANNELS.GET_APP_VERSION, () => {
  return app.getVersion();
});

ipcMain.handle(IPC_CHANNELS.GET_PLATFORM, () => {
  return process.platform;
});

ipcMain.handle(IPC_CHANNELS.GET_PREFERENCES, (): UserPreferences => {
  return prefsManager.get();
});

ipcMain.handle(IPC_CHANNELS.SET_THEME, (_event, pref: ThemePreference): ResolvedTheme => {
  prefsManager.update({ theme: pref });
  const resolved = resolveTheme(pref);
  if (mainWindow && !mainWindow.isDestroyed()) {
    updateWindowTheme(mainWindow, resolved);
  }
  return resolved;
});

nativeTheme.on('updated', () => {
  const currentPref = prefsManager?.get().theme;
  if (currentPref === 'system' && mainWindow && !mainWindow.isDestroyed()) {
    const resolved = resolveTheme('system');
    updateWindowTheme(mainWindow, resolved);
  }
});

app.whenReady().then(() => {
  mainWindow = createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
