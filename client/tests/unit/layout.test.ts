/**
 * Layout Functions Unit Tests
 *
 * Tests for layout fetching and saving API functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchLayout, saveLayout, type LayoutPayload } from '../../src/lib/layout';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockLayoutPayload: LayoutPayload = {
  sections: [
    { id: 'favorites', name: 'My Channels', channelIds: [1, 2, 3] },
    { id: 'others', name: 'Other', channelIds: [4, 5, 6] },
  ],
  globalGroups: [{ id: 'drums', name: 'Drums', channelIds: [1, 2, 3] }],
  globalSettings: {
    drums: { offsetDb: 0, mode: 'ignore-inf', enabled: true },
  },
  viewSettings: {
    offsetDb: 0,
    simpleControls: false,
    mixOrder: [],
  },
};

describe('fetchLayout', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('master bus', () => {
    it('fetches layout for master bus', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLayoutPayload),
      });

      const result = await fetchLayout('master');

      expect(mockFetch).toHaveBeenCalledWith('/api/layout?bus=master');
      expect(result).toEqual(mockLayoutPayload);
    });

    it('fetches layout for master bus with busId (ignored)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLayoutPayload),
      });

      await fetchLayout('master', 5);

      expect(mockFetch).toHaveBeenCalledWith('/api/layout?bus=master');
    });
  });

  describe('gain bus', () => {
    it('fetches layout for gain bus', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLayoutPayload),
      });

      await fetchLayout('gain');

      expect(mockFetch).toHaveBeenCalledWith('/api/layout?bus=gain');
    });

    it('fetches layout for gain bus with busId (ignored)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLayoutPayload),
      });

      await fetchLayout('gain', 10);

      expect(mockFetch).toHaveBeenCalledWith('/api/layout?bus=gain');
    });
  });

  describe('aux bus', () => {
    it('fetches layout for aux bus with busId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLayoutPayload),
      });

      await fetchLayout('aux', 3);

      expect(mockFetch).toHaveBeenCalledWith('/api/layout?bus=aux&busId=3');
    });

    it('defaults busId to 1 when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLayoutPayload),
      });

      await fetchLayout('aux');

      expect(mockFetch).toHaveBeenCalledWith('/api/layout?bus=aux&busId=1');
    });

    it('encodes busId in URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLayoutPayload),
      });

      await fetchLayout('aux', 10);

      expect(mockFetch).toHaveBeenCalledWith('/api/layout?bus=aux&busId=10');
    });
  });

  describe('error handling', () => {
    it('throws error on failed response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(fetchLayout('master')).rejects.toThrow('Failed to load layout');
    });

    it('throws error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchLayout('master')).rejects.toThrow('Network error');
    });

    it('throws error on JSON parse failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(fetchLayout('master')).rejects.toThrow('Invalid JSON');
    });
  });

  describe('response parsing', () => {
    it('returns empty object for empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await fetchLayout('master');

      expect(result).toEqual({});
    });

    it('returns partial payload', async () => {
      const partialPayload = { sections: mockLayoutPayload.sections };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(partialPayload),
      });

      const result = await fetchLayout('master');

      expect(result).toEqual(partialPayload);
      expect(result.globalGroups).toBeUndefined();
    });
  });
});

describe('saveLayout', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('master bus', () => {
    it('saves layout for master bus', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await saveLayout('master', undefined, mockLayoutPayload);

      expect(mockFetch).toHaveBeenCalledWith('/api/layout?bus=master', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockLayoutPayload),
      });
    });

    it('ignores busId for master bus', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await saveLayout('master', 5, mockLayoutPayload);

      expect(mockFetch).toHaveBeenCalledWith('/api/layout?bus=master', expect.any(Object));
    });
  });

  describe('gain bus', () => {
    it('saves layout for gain bus', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await saveLayout('gain', undefined, mockLayoutPayload);

      expect(mockFetch).toHaveBeenCalledWith('/api/layout?bus=gain', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockLayoutPayload),
      });
    });
  });

  describe('aux bus', () => {
    it('saves layout for aux bus with busId', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await saveLayout('aux', 3, mockLayoutPayload);

      expect(mockFetch).toHaveBeenCalledWith('/api/layout?bus=aux&busId=3', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockLayoutPayload),
      });
    });

    it('defaults busId to 1 when undefined', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await saveLayout('aux', undefined, mockLayoutPayload);

      expect(mockFetch).toHaveBeenCalledWith('/api/layout?bus=aux&busId=1', expect.any(Object));
    });
  });

  describe('payload handling', () => {
    it('saves empty payload', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await saveLayout('master', undefined, {});

      expect(mockFetch).toHaveBeenCalledWith(expect.any(String), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
    });

    it('saves sections only', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const payload: LayoutPayload = {
        sections: [{ id: 'test', name: 'Test', channelIds: [1] }],
      };

      await saveLayout('master', undefined, payload);

      expect(mockFetch).toHaveBeenCalledWith(expect.any(String), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    });

    it('saves global groups only', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const payload: LayoutPayload = {
        globalGroups: [{ id: 'group1', name: 'Group 1', channelIds: [1, 2] }],
      };

      await saveLayout('master', undefined, payload);

      expect(mockFetch).toHaveBeenCalledWith(expect.any(String), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    });

    it('saves view settings only', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const payload: LayoutPayload = {
        viewSettings: { simpleControls: true },
      };

      await saveLayout('master', undefined, payload);

      expect(mockFetch).toHaveBeenCalledWith(expect.any(String), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    });

    it('saves complex nested structures', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const payload: LayoutPayload = {
        sections: [
          {
            id: 'section1',
            name: 'Section 1',
            channelIds: [1, 2, 3],
            offsetDb: 5,
            mode: 'ignore-inf',
            enabled: true,
          },
        ],
        globalSettings: {
          group1: { offsetDb: -3, mode: 'default', enabled: false },
          group2: { offsetDb: 0, mode: 'ignore-inf-sends', enabled: true },
        },
        viewSettings: {
          offsetDb: 2,
          simpleControls: true,
          mixOrder: [
            { kind: 'group', groupType: 'local', id: 'section1' },
            { kind: 'channel', id: 5 },
          ],
        },
      };

      await saveLayout('aux', 5, payload);

      expect(mockFetch).toHaveBeenCalledWith('/api/layout?bus=aux&busId=5', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    });
  });

  describe('error handling', () => {
    it('throws error on failed response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(saveLayout('master', undefined, mockLayoutPayload)).rejects.toThrow(
        'Failed to save layout'
      );
    });

    it('throws error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(saveLayout('master', undefined, mockLayoutPayload)).rejects.toThrow(
        'Network error'
      );
    });

    it('throws error on 400 Bad Request', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

      await expect(saveLayout('master', undefined, mockLayoutPayload)).rejects.toThrow(
        'Failed to save layout'
      );
    });

    it('throws error on 404 Not Found', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      await expect(saveLayout('master', undefined, mockLayoutPayload)).rejects.toThrow(
        'Failed to save layout'
      );
    });
  });
});

describe('demo mode (localStorage)', () => {
  const mockLocalStorage: Record<string, string> = {};
  const localStorageMock = {
    getItem: vi.fn((key: string) => mockLocalStorage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      mockLocalStorage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockLocalStorage[key];
    }),
    clear: vi.fn(() => {
      Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]);
    }),
  };

  beforeEach(() => {
    mockFetch.mockReset();
    localStorageMock.clear();
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  describe('fetchLayout with demoMode=true', () => {
    it('reads from localStorage instead of API for master bus', async () => {
      const storedPayload = { globalGroups: [{ id: 'test', name: 'Test', channelIds: [1] }] };
      mockLocalStorage['ui24r-demo-layout-master'] = JSON.stringify(storedPayload);

      const result = await fetchLayout('master', undefined, true);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual(storedPayload);
    });

    it('reads from localStorage for aux bus with correct key', async () => {
      const storedPayload = { sections: [{ id: 'sec1', name: 'Section', channelIds: [2] }] };
      mockLocalStorage['ui24r-demo-layout-aux-3'] = JSON.stringify(storedPayload);

      const result = await fetchLayout('aux', 3, true);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual(storedPayload);
    });

    it('reads from localStorage for gain bus', async () => {
      const storedPayload = { viewSettings: { offsetDb: 5 } };
      mockLocalStorage['ui24r-demo-layout-gain'] = JSON.stringify(storedPayload);

      const result = await fetchLayout('gain', undefined, true);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual(storedPayload);
    });

    it('returns empty object when no stored data', async () => {
      const result = await fetchLayout('master', undefined, true);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('returns empty object on invalid JSON', async () => {
      mockLocalStorage['ui24r-demo-layout-master'] = 'invalid json';

      const result = await fetchLayout('master', undefined, true);

      expect(result).toEqual({});
    });

    it('defaults aux busId to 1 in storage key', async () => {
      const storedPayload = { sections: [] };
      mockLocalStorage['ui24r-demo-layout-aux-1'] = JSON.stringify(storedPayload);

      const result = await fetchLayout('aux', undefined, true);

      expect(result).toEqual(storedPayload);
    });
  });

  describe('saveLayout with demoMode=true', () => {
    it('saves to localStorage instead of API for master bus', async () => {
      const payload = { globalGroups: [{ id: 'drums', name: 'Drums', channelIds: [1, 2] }] };

      await saveLayout('master', undefined, payload, true);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'ui24r-demo-layout-master',
        expect.any(String)
      );
      expect(JSON.parse(mockLocalStorage['ui24r-demo-layout-master'])).toEqual(payload);
    });

    it('saves to localStorage for aux bus with correct key', async () => {
      const payload = { sections: [{ id: 'fav', name: 'Favorites', channelIds: [3] }] };

      await saveLayout('aux', 5, payload, true);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'ui24r-demo-layout-aux-5',
        expect.any(String)
      );
      expect(JSON.parse(mockLocalStorage['ui24r-demo-layout-aux-5'])).toEqual(payload);
    });

    it('saves to localStorage for gain bus', async () => {
      const payload = { viewSettings: { offsetDb: 3 } };

      await saveLayout('gain', undefined, payload, true);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(JSON.parse(mockLocalStorage['ui24r-demo-layout-gain'])).toEqual(payload);
    });

    it('merges with existing stored data', async () => {
      mockLocalStorage['ui24r-demo-layout-master'] = JSON.stringify({
        globalGroups: [{ id: 'existing', name: 'Existing', channelIds: [1] }],
      });

      await saveLayout('master', undefined, { viewSettings: { offsetDb: 2 } }, true);

      const stored = JSON.parse(mockLocalStorage['ui24r-demo-layout-master']);
      expect(stored.globalGroups).toEqual([{ id: 'existing', name: 'Existing', channelIds: [1] }]);
      expect(stored.viewSettings).toEqual({ offsetDb: 2 });
    });

    it('overwrites same keys in existing data', async () => {
      mockLocalStorage['ui24r-demo-layout-master'] = JSON.stringify({
        globalGroups: [{ id: 'old', name: 'Old', channelIds: [1] }],
      });

      await saveLayout(
        'master',
        undefined,
        { globalGroups: [{ id: 'new', name: 'New', channelIds: [2, 3] }] },
        true
      );

      const stored = JSON.parse(mockLocalStorage['ui24r-demo-layout-master']);
      expect(stored.globalGroups).toEqual([{ id: 'new', name: 'New', channelIds: [2, 3] }]);
    });

    it('defaults aux busId to 1 in storage key', async () => {
      await saveLayout('aux', undefined, { sections: [] }, true);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'ui24r-demo-layout-aux-1',
        expect.any(String)
      );
    });
  });

  describe('round-trip save and fetch', () => {
    it('can save and retrieve the same data', async () => {
      const payload = {
        sections: [{ id: 'test', name: 'Test', channelIds: [1, 2, 3] }],
        globalGroups: [{ id: 'group', name: 'Group', channelIds: [4, 5] }],
        globalSettings: { group: { offsetDb: 5, mode: 'ignore-inf' as const, enabled: true } },
        viewSettings: { offsetDb: 0, mixOrder: [] },
      };

      await saveLayout('aux', 2, payload, true);
      const result = await fetchLayout('aux', 2, true);

      expect(result).toEqual(payload);
    });
  });
});

describe('LayoutPayload type validation', () => {
  it('allows empty payload', () => {
    const payload: LayoutPayload = {};
    expect(payload).toBeDefined();
  });

  it('allows sections with all properties', () => {
    const payload: LayoutPayload = {
      sections: [
        {
          id: 'test',
          name: 'Test Section',
          channelIds: [1, 2, 3],
          offsetDb: 5,
          mode: 'ignore-inf',
          enabled: true,
        },
      ],
    };
    expect(payload.sections![0].mode).toBe('ignore-inf');
  });

  it('allows all mode values', () => {
    const modes: Array<'default' | 'ignore-inf' | 'ignore-inf-sends'> = [
      'default',
      'ignore-inf',
      'ignore-inf-sends',
    ];

    modes.forEach(mode => {
      const payload: LayoutPayload = {
        sections: [{ id: 'test', name: 'Test', channelIds: [], mode }],
      };
      expect(payload.sections![0].mode).toBe(mode);
    });
  });

  it('allows mix order items', () => {
    const payload: LayoutPayload = {
      viewSettings: {
        mixOrder: [
          { kind: 'group', groupType: 'local', id: 'section1' },
          { kind: 'group', groupType: 'global', id: 'global1' },
          { kind: 'channel', id: 5 },
        ],
      },
    };
    expect(payload.viewSettings!.mixOrder).toHaveLength(3);
  });
});
