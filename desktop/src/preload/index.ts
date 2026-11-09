import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type RyujinBridge,
  type ThemePreference,
  type ResolvedTheme
} from '../shared/ipc';

const bridge: RyujinBridge = {
  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_VERSION),
  getPlatform: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PLATFORM),
  getPreferences: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PREFERENCES),
  setTheme: (theme: ThemePreference) => ipcRenderer.invoke(IPC_CHANNELS.SET_THEME, theme),
  onThemeChanged: (callback: (theme: ResolvedTheme) => void) => {
    const handler = (_event: unknown, theme: ResolvedTheme) => callback(theme);
    ipcRenderer.on(IPC_CHANNELS.THEME_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.THEME_CHANGED, handler);
    };
  },
  onGlobalSearch: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.GLOBAL_SEARCH, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.GLOBAL_SEARCH, handler);
    };
  }
};

contextBridge.exposeInMainWorld('ryujin', Object.freeze(bridge));
