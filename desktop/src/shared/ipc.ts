export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export interface WindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export interface UserPreferences {
  theme: ThemePreference;
  windowBounds?: WindowBounds;
}

export interface RyujinBridge {
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  getPreferences: () => Promise<UserPreferences>;
  setTheme: (theme: ThemePreference) => Promise<ResolvedTheme>;
  onThemeChanged: (callback: (theme: ResolvedTheme) => void) => () => void;
  onGlobalSearch: (callback: () => void) => () => void;
}

export const IPC_CHANNELS = {
  GET_APP_VERSION: 'ryujin:get-app-version',
  GET_PLATFORM: 'ryujin:get-platform',
  GET_PREFERENCES: 'ryujin:get-preferences',
  SET_THEME: 'ryujin:set-theme',
  THEME_CHANGED: 'ryujin:theme-changed',
  GLOBAL_SEARCH: 'ryujin:global-search'
} as const;

declare global {
  interface Window {
    ryujin: RyujinBridge;
  }
}
