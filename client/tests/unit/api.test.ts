/**
 * API Functions Unit Tests
 *
 * Tests for all client-side API functions with comprehensive mocking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchState, setFader, setMute, setSolo, connectMixer } from '../../src/lib/api';
import type { AppState, BusType } from '../../src/lib/types';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockAppState: AppState = {
  host: 'test-mixer',
  connectionStatus: 'connected',
  bus: { type: 'master', id: 0 },
  auxBuses: [{ id: 1, name: 'Aux 1', lastUpdatedAt: '2024-01-01T00:00:00Z' }],
  channels: [
    {
      id: 1,
      label: 'CH 1',
      busType: 'master',
      bus: 0,
      fader: 0.5,
      lastUpdatedAt: '2024-01-01T00:00:00Z',
    },
  ],
};

describe('fetchState', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('master bus', () => {
    it('fetches state for master bus with correct URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAppState),
      });

      const result = await fetchState('master', 0);

      expect(mockFetch).toHaveBeenCalledWith('/api/state?bus=master');
      expect(result).toEqual(mockAppState);
    });

    it('ignores bus id for master type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAppState),
      });

      await fetchState('master', 5);

      expect(mockFetch).toHaveBeenCalledWith('/api/state?bus=master');
    });
  });

  describe('aux bus', () => {
    it('fetches state for aux bus with bus id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAppState),
      });

      await fetchState('aux', 3);

      expect(mockFetch).toHaveBeenCalledWith('/api/state?bus=aux&busId=3');
    });

    it('encodes bus id in URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAppState),
      });

      await fetchState('aux', 10);

      expect(mockFetch).toHaveBeenCalledWith('/api/state?bus=aux&busId=10');
    });
  });

  describe('gain bus', () => {
    it('fetches state for gain bus', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAppState),
      });

      await fetchState('gain', 0);

      expect(mockFetch).toHaveBeenCalledWith('/api/state?bus=gain');
    });

    it('ignores bus id for gain type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAppState),
      });

      await fetchState('gain', 5);

      expect(mockFetch).toHaveBeenCalledWith('/api/state?bus=gain');
    });
  });

  describe('error handling', () => {
    it('throws error on failed response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(fetchState('master', 0)).rejects.toThrow('Failed to load state');
    });

    it('throws error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchState('master', 0)).rejects.toThrow('Network error');
    });

    it('throws error on malformed JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(fetchState('master', 0)).rejects.toThrow('Invalid JSON');
    });
  });
});

describe('setFader', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('gain bus', () => {
    it('posts to gain endpoint for gain bus', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await setFader('gain', 0, 1, 0.75);

      expect(mockFetch).toHaveBeenCalledWith('/api/channels/1/gain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 0.75 }),
      });
    });

    it('throws on gain endpoint failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(setFader('gain', 0, 1, 0.5)).rejects.toThrow('Failed to set gain');
    });
  });

  describe('master bus', () => {
    it('posts to fader endpoint for master bus', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await setFader('master', 0, 5, 0.5);

      expect(mockFetch).toHaveBeenCalledWith('/api/channels/5/fader?bus=master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 0.5 }),
      });
    });
  });

  describe('aux bus', () => {
    it('posts to fader endpoint with aux bus params', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await setFader('aux', 3, 2, 0.8);

      expect(mockFetch).toHaveBeenCalledWith('/api/channels/2/fader?bus=aux&busId=3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 0.8 }),
      });
    });
  });

  describe('value handling', () => {
    it('sends exact value provided', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await setFader('master', 0, 1, 0);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ value: 0 }),
        })
      );
    });

    it('sends value of 1', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await setFader('master', 0, 1, 1);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ value: 1 }),
        })
      );
    });

    it('sends fractional values', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await setFader('master', 0, 1, 0.123456);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ value: 0.123456 }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('throws error on failed fader response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(setFader('master', 0, 1, 0.5)).rejects.toThrow('Failed to set fader');
    });

    it('throws error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(setFader('master', 0, 1, 0.5)).rejects.toThrow('Network error');
    });
  });
});

describe('setMute', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('gain bus', () => {
    it('returns immediately for gain bus without making request', async () => {
      await setMute('gain', 0, 1, true);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('master bus', () => {
    it('posts mute state for master bus', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await setMute('master', 0, 3, true);

      expect(mockFetch).toHaveBeenCalledWith('/api/channels/3/mute?bus=master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted: true }),
      });
    });

    it('posts unmute state', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await setMute('master', 0, 3, false);

      expect(mockFetch).toHaveBeenCalledWith('/api/channels/3/mute?bus=master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted: false }),
      });
    });
  });

  describe('aux bus', () => {
    it('posts mute state for aux bus', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await setMute('aux', 5, 2, true);

      expect(mockFetch).toHaveBeenCalledWith('/api/channels/2/mute?bus=aux&busId=5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted: true }),
      });
    });
  });

  describe('error handling', () => {
    it('throws error on failed response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(setMute('master', 0, 1, true)).rejects.toThrow('Failed to set mute');
    });
  });
});

describe('setSolo', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('non-master bus', () => {
    it('returns immediately for aux bus without making request', async () => {
      await setSolo('aux', 1, 1, true);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns immediately for gain bus without making request', async () => {
      await setSolo('gain', 0, 1, true);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('master bus', () => {
    it('posts solo state for master bus', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await setSolo('master', 0, 4, true);

      expect(mockFetch).toHaveBeenCalledWith('/api/channels/4/solo?bus=master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solo: true }),
      });
    });

    it('posts unsolo state', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await setSolo('master', 0, 4, false);

      expect(mockFetch).toHaveBeenCalledWith('/api/channels/4/solo?bus=master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solo: false }),
      });
    });
  });

  describe('error handling', () => {
    it('throws error on failed response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(setSolo('master', 0, 1, true)).rejects.toThrow('Failed to set solo');
    });
  });
});

describe('connectMixer', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('posts host to connect endpoint', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await connectMixer('192.168.1.100');

    expect(mockFetch).toHaveBeenCalledWith('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: '192.168.1.100' }),
    });
  });

  it('handles hostname with port', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await connectMixer('mixer.local:3000');

    expect(mockFetch).toHaveBeenCalledWith('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: 'mixer.local:3000' }),
    });
  });

  it('handles empty string host', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await connectMixer('');

    expect(mockFetch).toHaveBeenCalledWith('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: '' }),
    });
  });

  describe('error handling', () => {
    it('throws error on failed response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(connectMixer('bad-host')).rejects.toThrow('Failed to connect mixer');
    });

    it('throws error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(connectMixer('host')).rejects.toThrow('Network error');
    });
  });
});

describe('API integration scenarios', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('handles multiple concurrent requests', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await Promise.all([
      setFader('master', 0, 1, 0.5),
      setFader('master', 0, 2, 0.6),
      setFader('aux', 1, 3, 0.7),
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('handles request sequence correctly', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await setMute('master', 0, 1, true);
    await setFader('master', 0, 1, 0);
    await setMute('master', 0, 1, false);

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch.mock.calls[0][0]).toContain('mute');
    expect(mockFetch.mock.calls[1][0]).toContain('fader');
    expect(mockFetch.mock.calls[2][0]).toContain('mute');
  });
});
