import { app } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { UserPreferences, WindowBounds } from '../shared/ipc';

const PREFS_FILENAME = 'preferences.json';

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  windowBounds: {
    width: 1440,
    height: 900
  }
};

export class PreferencesManager {
  private filePath: string;
  private current: UserPreferences;

  constructor() {
    this.filePath = join(app.getPath('userData'), PREFS_FILENAME);
    this.current = this.load();
  }

  public get(): UserPreferences {
    return { ...this.current };
  }

  public update(partial: Partial<UserPreferences>): UserPreferences {
    this.current = {
      ...this.current,
      ...partial
    };
    this.save();
    return this.get();
  }

  public updateBounds(bounds: WindowBounds): void {
    this.current.windowBounds = bounds;
    this.save();
  }

  private load(): UserPreferences {
    try {
      const data = readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(data) as Partial<UserPreferences>;
      return {
        theme: parsed.theme === 'light' || parsed.theme === 'system' ? parsed.theme : 'dark',
        windowBounds: parsed.windowBounds && typeof parsed.windowBounds.width === 'number'
          ? parsed.windowBounds
          : DEFAULT_PREFERENCES.windowBounds
      };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }

  private save(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.current, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save user preferences:', err);
    }
  }
}

