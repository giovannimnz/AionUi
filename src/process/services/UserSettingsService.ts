/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import fs from 'fs';
import { getSystemDir } from '@process/utils/initStorage';

const SETTINGS_FILE = 'user-settings.json';

export interface IUserSettings {
  theme?: 'light' | 'dark';
  colorScheme?: 'default' | 'dark';
}

const defaultSettings: IUserSettings = {
  theme: 'light',
  colorScheme: 'default',
};

function getSettingsPath(): string {
  const { cacheDir } = getSystemDir();
  return path.join(cacheDir, SETTINGS_FILE);
}

function readSettings(): IUserSettings {
  const filePath = getSettingsPath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return { ...defaultSettings, ...parsed };
    }
  } catch (error) {
    console.error('[UserSettingsService] Failed to read settings:', error);
  }
  return { ...defaultSettings };
}

function writeSettings(settings: IUserSettings): void {
  const filePath = getSettingsPath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    console.error('[UserSettingsService] Failed to write settings:', error);
    throw error;
  }
}

export const UserSettingsService = {
  getSettings(): IUserSettings {
    return readSettings();
  },

  getTheme(): 'light' | 'dark' {
    return readSettings().theme ?? 'light';
  },

  setTheme(theme: 'light' | 'dark'): void {
    const settings = readSettings();
    settings.theme = theme;
    writeSettings(settings);
  },

  updateSettings(partial: Partial<IUserSettings>): IUserSettings {
    const settings = readSettings();
    const updated = { ...settings, ...partial };
    writeSettings(updated);
    return updated;
  },
};
