/**
 * LayoutStore Unit Tests
 *
 * Tests for the LayoutStore class that manages layout configuration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { LayoutStore } from '../src/layout.js';

describe('LayoutStore', () => {
  const channelIds = [1, 2, 3, 4, 5, 6, 7, 8];
  const auxBusIds = [1, 2, 3];
  let tempDir: string;
  let layoutPath: string;
  let fallbackPath: string;
  let store: LayoutStore;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'layout-test-'));
    layoutPath = path.join(tempDir, 'layout.json');
    fallbackPath = path.join(tempDir, 'fallback.json');
    store = new LayoutStore(layoutPath, channelIds, auxBusIds, fallbackPath);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('creates store with default data', () => {
      const sections = store.getAuxLayout(1);
      expect(sections).toBeDefined();
      expect(Array.isArray(sections)).toBe(true);
    });
  });

  describe('load', () => {
    it('loads from file when it exists', async () => {
      const data = {
        version: 2,
        aux: {
          '1': [
            { id: 'favorites', name: 'My Channels', channelIds: [1, 2, 3] },
            { id: 'others', name: 'Other', channelIds: [4, 5, 6, 7, 8] },
          ],
        },
        globalGroups: [],
        globalSettings: { master: {}, gain: {}, aux: {} },
        viewSettings: {
          master: { offsetDb: 0, simpleControls: false },
          gain: { offsetDb: 0, simpleControls: false },
          aux: {},
        },
      };
      await fs.writeFile(layoutPath, JSON.stringify(data));

      await store.load();
      const sections = store.getAuxLayout(1);
      const favorites = sections.find(s => s.id === 'favorites');
      expect(favorites?.channelIds).toEqual([1, 2, 3]);
    });

    it('loads from fallback when primary file does not exist', async () => {
      const fallbackData = {
        version: 2,
        aux: {
          '2': [
            { id: 'favorites', name: 'My Channels', channelIds: [5, 6] },
            { id: 'others', name: 'Other', channelIds: [] },
          ],
        },
        globalGroups: [],
        globalSettings: { master: {}, gain: {}, aux: {} },
        viewSettings: {
          master: { offsetDb: 0, simpleControls: false },
          gain: { offsetDb: 0, simpleControls: false },
          aux: {},
        },
      };
      await fs.writeFile(fallbackPath, JSON.stringify(fallbackData));

      await store.load();
      const sections = store.getAuxLayout(2);
      const favorites = sections.find(s => s.id === 'favorites');
      expect(favorites?.channelIds).toEqual([5, 6]);
    });

    it('uses defaults when neither file exists', async () => {
      await store.load();
      const sections = store.getAuxLayout(1);
      expect(sections).toHaveLength(2); // favorites and others
    });

    it('handles malformed JSON gracefully', async () => {
      await fs.writeFile(layoutPath, 'not valid json');
      await store.load();
      const sections = store.getAuxLayout(1);
      expect(sections).toBeDefined();
    });
  });

  describe('getAuxLayout', () => {
    it('returns normalized sections with favorites and others', async () => {
      await store.load();
      const sections = store.getAuxLayout(1);

      expect(sections[0].id).toBe('favorites');
      expect(sections[sections.length - 1].id).toBe('others');
    });

    it('returns empty layout for invalid bus id', async () => {
      await store.load();
      const sections = store.getAuxLayout(999);
      expect(sections).toHaveLength(2); // Still has favorites and others with defaults
    });

    it('filters out invalid channel ids', async () => {
      const data = {
        version: 2,
        aux: {
          '1': [
            { id: 'favorites', name: 'My Channels', channelIds: [1, 999, 2] },
            { id: 'others', name: 'Other', channelIds: [] },
          ],
        },
        globalGroups: [],
        globalSettings: { master: {}, gain: {}, aux: {} },
        viewSettings: {
          master: {},
          gain: {},
          aux: {},
        },
      };
      await fs.writeFile(layoutPath, JSON.stringify(data));
      await store.load();

      const sections = store.getAuxLayout(1);
      const favorites = sections.find(s => s.id === 'favorites');
      expect(favorites?.channelIds).toEqual([1, 2]);
    });

    it('removes duplicate channel ids', async () => {
      const data = {
        version: 2,
        aux: {
          '1': [
            { id: 'favorites', name: 'My Channels', channelIds: [1, 1, 2, 2] },
            { id: 'others', name: 'Other', channelIds: [] },
          ],
        },
        globalGroups: [],
        globalSettings: { master: {}, gain: {}, aux: {} },
        viewSettings: {
          master: {},
          gain: {},
          aux: {},
        },
      };
      await fs.writeFile(layoutPath, JSON.stringify(data));
      await store.load();

      const sections = store.getAuxLayout(1);
      const favorites = sections.find(s => s.id === 'favorites');
      expect(favorites?.channelIds).toEqual([1, 2]);
    });

    it('puts remaining channels in others', async () => {
      const data = {
        version: 2,
        aux: {
          '1': [
            { id: 'favorites', name: 'My Channels', channelIds: [1, 2] },
            { id: 'others', name: 'Other', channelIds: [] },
          ],
        },
        globalGroups: [],
        globalSettings: { master: {}, gain: {}, aux: {} },
        viewSettings: {
          master: {},
          gain: {},
          aux: {},
        },
      };
      await fs.writeFile(layoutPath, JSON.stringify(data));
      await store.load();

      const sections = store.getAuxLayout(1);
      const others = sections.find(s => s.id === 'others');
      expect(others?.channelIds).toContain(3);
      expect(others?.channelIds).toContain(4);
    });

    it('normalizes section mode', async () => {
      const data = {
        version: 2,
        aux: {
          '1': [
            {
              id: 'favorites',
              name: 'My Channels',
              channelIds: [],
              mode: 'invalid-mode',
            },
            { id: 'others', name: 'Other', channelIds: [] },
          ],
        },
        globalGroups: [],
        globalSettings: { master: {}, gain: {}, aux: {} },
        viewSettings: {
          master: {},
          gain: {},
          aux: {},
        },
      };
      await fs.writeFile(layoutPath, JSON.stringify(data));
      await store.load();

      const sections = store.getAuxLayout(1);
      const favorites = sections.find(s => s.id === 'favorites');
      expect(favorites?.mode).toBe('ignore-inf');
    });
  });

  describe('setAuxLayout', () => {
    it('saves layout to file', async () => {
      await store.load();
      await store.setAuxLayout(1, [
        { id: 'favorites', name: 'My Channels', channelIds: [1, 2, 3] },
        { id: 'others', name: 'Other', channelIds: [] },
      ]);

      const fileContent = await fs.readFile(layoutPath, 'utf-8');
      const data = JSON.parse(fileContent);
      expect(data.aux['1']).toBeDefined();
    });

    it('does not save for invalid bus id', async () => {
      await store.load();
      await store.setAuxLayout(999, []);

      // File should not exist or not have bus 999
      try {
        const fileContent = await fs.readFile(layoutPath, 'utf-8');
        const data = JSON.parse(fileContent);
        expect(data.aux['999']).toBeUndefined();
      } catch {
        // File might not exist
      }
    });

    it('normalizes sections on save', async () => {
      await store.load();
      await store.setAuxLayout(1, [
        {
          id: 'favorites',
          name: 'Test',
          channelIds: [1, 999, 1],
          mode: 'ignore-inf',
        },
      ]);

      const sections = store.getAuxLayout(1);
      const favorites = sections.find(s => s.id === 'favorites');
      expect(favorites?.channelIds).toEqual([1]);
    });
  });

  describe('getGlobalGroups', () => {
    it('returns empty array by default', async () => {
      await store.load();
      const groups = store.getGlobalGroups();
      expect(groups).toEqual([]);
    });

    it('returns saved global groups', async () => {
      const data = {
        version: 2,
        aux: {},
        globalGroups: [{ id: 'drums', name: 'Drums', channelIds: [1, 2, 3] }],
        globalSettings: { master: {}, gain: {}, aux: {} },
        viewSettings: {
          master: {},
          gain: {},
          aux: {},
        },
      };
      await fs.writeFile(layoutPath, JSON.stringify(data));
      await store.load();

      const groups = store.getGlobalGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe('drums');
      expect(groups[0].channelIds).toEqual([1, 2, 3]);
    });

    it('filters invalid channel ids from groups', async () => {
      const data = {
        version: 2,
        aux: {},
        globalGroups: [{ id: 'test', name: 'Test', channelIds: [1, 999, 2] }],
        globalSettings: { master: {}, gain: {}, aux: {} },
        viewSettings: {
          master: {},
          gain: {},
          aux: {},
        },
      };
      await fs.writeFile(layoutPath, JSON.stringify(data));
      await store.load();

      const groups = store.getGlobalGroups();
      expect(groups[0].channelIds).toEqual([1, 2]);
    });
  });

  describe('setGlobalGroups', () => {
    it('saves global groups', async () => {
      await store.load();
      await store.setGlobalGroups([{ id: 'drums', name: 'Drums', channelIds: [1, 2] }]);

      const groups = store.getGlobalGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe('drums');
    });

    it('normalizes groups on save', async () => {
      await store.load();
      await store.setGlobalGroups([
        { id: 'test', name: 'Test', channelIds: [1, 999, 1] },
      ]);

      const groups = store.getGlobalGroups();
      expect(groups[0].channelIds).toEqual([1]);
    });
  });

  describe('getGlobalSettings', () => {
    it('returns empty object for master by default', async () => {
      await store.load();
      const settings = store.getGlobalSettings('master');
      expect(settings).toEqual({});
    });

    it('returns settings for master bus', async () => {
      const data = {
        version: 2,
        aux: {},
        globalGroups: [],
        globalSettings: {
          master: {
            drums: { offsetDb: 5, mode: 'ignore-inf', enabled: true },
          },
          gain: {},
          aux: {},
        },
        viewSettings: {
          master: {},
          gain: {},
          aux: {},
        },
      };
      await fs.writeFile(layoutPath, JSON.stringify(data));
      await store.load();

      const settings = store.getGlobalSettings('master');
      expect(settings.drums).toBeDefined();
      expect(settings.drums.offsetDb).toBe(5);
    });

    it('returns settings for aux bus', async () => {
      const data = {
        version: 2,
        aux: {},
        globalGroups: [],
        globalSettings: {
          master: {},
          gain: {},
          aux: {
            '1': {
              drums: { offsetDb: 3, mode: 'ignore-inf', enabled: true },
            },
          },
        },
        viewSettings: {
          master: {},
          gain: {},
          aux: {},
        },
      };
      await fs.writeFile(layoutPath, JSON.stringify(data));
      await store.load();

      const settings = store.getGlobalSettings('aux', 1);
      expect(settings.drums).toBeDefined();
      expect(settings.drums.offsetDb).toBe(3);
    });
  });

  describe('setGlobalSettings', () => {
    it('saves settings for master', async () => {
      await store.load();
      await store.setGlobalSettings('master', {
        drums: { offsetDb: 5, mode: 'ignore-inf', enabled: true },
      });

      const settings = store.getGlobalSettings('master');
      expect(settings.drums.offsetDb).toBe(5);
    });

    it('saves settings for aux bus', async () => {
      await store.load();
      await store.setGlobalSettings(
        'aux',
        { drums: { offsetDb: 3, mode: 'ignore-inf', enabled: true } },
        2
      );

      const settings = store.getGlobalSettings('aux', 2);
      expect(settings.drums.offsetDb).toBe(3);
    });

    it('does not save for invalid aux bus id', async () => {
      await store.load();
      await store.setGlobalSettings('aux', { drums: { offsetDb: 5 } }, 999);

      const settings = store.getGlobalSettings('aux', 999);
      expect(settings).toEqual({});
    });
  });

  describe('getViewSettings', () => {
    it('returns default view settings', async () => {
      await store.load();
      const settings = store.getViewSettings('master');
      expect(settings.offsetDb).toBe(0);
      expect(settings.simpleControls).toBe(false);
      expect(settings.mixOrder).toEqual([]);
    });

    it('returns saved view settings', async () => {
      const data = {
        version: 2,
        aux: {},
        globalGroups: [],
        globalSettings: { master: {}, gain: {}, aux: {} },
        viewSettings: {
          master: { offsetDb: 5, simpleControls: true },
          gain: {},
          aux: {},
        },
      };
      await fs.writeFile(layoutPath, JSON.stringify(data));
      await store.load();

      const settings = store.getViewSettings('master');
      expect(settings.offsetDb).toBe(5);
      expect(settings.simpleControls).toBe(true);
    });

    it('returns view settings for aux bus', async () => {
      const data = {
        version: 2,
        aux: {},
        globalGroups: [],
        globalSettings: { master: {}, gain: {}, aux: {} },
        viewSettings: {
          master: {},
          gain: {},
          aux: {
            '1': { offsetDb: 3, simpleControls: true },
          },
        },
      };
      await fs.writeFile(layoutPath, JSON.stringify(data));
      await store.load();

      const settings = store.getViewSettings('aux', 1);
      expect(settings.offsetDb).toBe(3);
      expect(settings.simpleControls).toBe(true);
    });
  });

  describe('setViewSettings', () => {
    it('saves view settings for master', async () => {
      await store.load();
      await store.setViewSettings('master', {
        offsetDb: 5,
        simpleControls: true,
      });

      const settings = store.getViewSettings('master');
      expect(settings.offsetDb).toBe(5);
      expect(settings.simpleControls).toBe(true);
    });

    it('saves view settings for aux bus', async () => {
      await store.load();
      await store.setViewSettings(
        'aux',
        { offsetDb: 3, simpleControls: true },
        2
      );

      const settings = store.getViewSettings('aux', 2);
      expect(settings.offsetDb).toBe(3);
      expect(settings.simpleControls).toBe(true);
    });

    it('normalizes mixOrder', async () => {
      await store.load();
      await store.setViewSettings('master', {
        mixOrder: [
          { kind: 'group', groupType: 'local', id: 'favorites' },
          { kind: 'channel', id: 1 },
          { kind: 'group', groupType: 'local', id: 'favorites' }, // duplicate
        ],
      });

      const settings = store.getViewSettings('master');
      expect(settings.mixOrder).toHaveLength(2);
    });

    it('does not save for invalid aux bus id', async () => {
      await store.load();
      await store.setViewSettings('aux', { offsetDb: 5 }, 999);

      const settings = store.getViewSettings('aux', 999);
      expect(settings.offsetDb).toBe(0);
    });
  });

  describe('normalization helpers', () => {
    it('normalizes section name to "My Channels" for favorites', async () => {
      const data = {
        version: 2,
        aux: {
          '1': [
            { id: 'favorites', name: 'Custom Name', channelIds: [] },
            { id: 'others', name: 'Other', channelIds: [] },
          ],
        },
        globalGroups: [],
        globalSettings: { master: {}, gain: {}, aux: {} },
        viewSettings: {
          master: {},
          gain: {},
          aux: {},
        },
      };
      await fs.writeFile(layoutPath, JSON.stringify(data));
      await store.load();

      const sections = store.getAuxLayout(1);
      const favorites = sections.find(s => s.id === 'favorites');
      expect(favorites?.name).toBe('My Channels');
    });

    it('normalizes offsetDb to 0 if not a number', async () => {
      const data = {
        version: 2,
        aux: {
          '1': [
            {
              id: 'favorites',
              name: 'Test',
              channelIds: [],
              offsetDb: 'invalid',
            },
            { id: 'others', name: 'Other', channelIds: [] },
          ],
        },
        globalGroups: [],
        globalSettings: { master: {}, gain: {}, aux: {} },
        viewSettings: {
          master: {},
          gain: {},
          aux: {},
        },
      };
      await fs.writeFile(layoutPath, JSON.stringify(data));
      await store.load();

      const sections = store.getAuxLayout(1);
      const favorites = sections.find(s => s.id === 'favorites');
      expect(favorites?.offsetDb).toBe(0);
    });

    it('normalizes enabled to true by default for sections', async () => {
      const data = {
        version: 2,
        aux: {
          '1': [
            { id: 'favorites', name: 'Test', channelIds: [] },
            { id: 'others', name: 'Other', channelIds: [] },
          ],
        },
        globalGroups: [],
        globalSettings: { master: {}, gain: {}, aux: {} },
        viewSettings: {
          master: {},
          gain: {},
          aux: {},
        },
      };
      await fs.writeFile(layoutPath, JSON.stringify(data));
      await store.load();

      const sections = store.getAuxLayout(1);
      const favorites = sections.find(s => s.id === 'favorites');
      expect(favorites?.enabled).toBe(true);
    });
  });
});
