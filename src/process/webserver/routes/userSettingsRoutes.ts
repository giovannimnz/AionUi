/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Express, Request, Response } from 'express';
import { UserSettingsService } from '@process/services/UserSettingsService';
import { TokenMiddleware } from '@process/webserver/auth/middleware/TokenMiddleware';
import { apiRateLimiter } from '@process/webserver/middleware/security';

export function registerUserSettingsRoutes(app: Express): void {
  const validateApiAccess = TokenMiddleware.validateToken({ responseType: 'json' });

  /**
   * GET /api/user-settings
   * Returns all user settings (theme, colorScheme, etc.)
   */
  app.get('/api/user-settings', apiRateLimiter, validateApiAccess, (_req: Request, res: Response) => {
    try {
      const settings = UserSettingsService.getSettings();
      res.json({ success: true, data: settings });
    } catch (error) {
      console.error('[UserSettings] GET error:', error);
      res.status(500).json({ success: false, msg: 'Failed to load settings' });
    }
  });

  /**
   * PUT /api/user-settings
   * Updates user settings (theme, colorScheme, etc.)
   * Body: { theme?: 'light' | 'dark', colorScheme?: 'default' | 'dark' }
   */
  app.put('/api/user-settings', apiRateLimiter, validateApiAccess, (req: Request, res: Response) => {
    try {
      const { theme, colorScheme } = req.body as { theme?: 'light' | 'dark'; colorScheme?: 'default' | 'dark' };

      if (theme !== undefined && theme !== 'light' && theme !== 'dark') {
        res.status(400).json({ success: false, msg: 'Invalid theme value' });
        return;
      }

      if (colorScheme !== undefined && colorScheme !== 'default' && colorScheme !== 'dark') {
        res.status(400).json({ success: false, msg: 'Invalid colorScheme value' });
        return;
      }

      const updated = UserSettingsService.updateSettings({ theme, colorScheme });
      res.json({ success: true, data: updated });
    } catch (error) {
      console.error('[UserSettings] PUT error:', error);
      res.status(500).json({ success: false, msg: 'Failed to save settings' });
    }
  });
}
