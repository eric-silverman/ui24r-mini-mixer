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
