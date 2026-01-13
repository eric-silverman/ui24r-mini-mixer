/**
 * Config Module Unit Tests
 *
 * Tests for the config loading and channel list parsing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We need to test parseChannelList and loadConfig, but parseChannelList is not exported.
// So we'll test loadConfig which uses parseChannelList internally.

describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('returns default channels when UI24R_CHANNELS is not set', async () => {
      delete process.env.UI24R_CHANNELS;
      delete process.env.UI24R_HOST;
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.channels).toHaveLength(24);
      expect(config.channels[0]).toBe(1);
      expect(config.channels[23]).toBe(24);
    });

    it('returns default channels when UI24R_CHANNELS is empty string', async () => {
      process.env.UI24R_CHANNELS = '';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.channels).toHaveLength(24);
    });

    it('returns default channels when UI24R_CHANNELS is whitespace only', async () => {
      process.env.UI24R_CHANNELS = '   ';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.channels).toHaveLength(24);
    });

    it('parses single channel number', async () => {
      process.env.UI24R_CHANNELS = '5';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.channels).toEqual([5]);
    });

    it('parses multiple channel numbers', async () => {
      process.env.UI24R_CHANNELS = '1,5,10';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.channels).toEqual([1, 5, 10]);
    });

    it('parses channel range', async () => {
      process.env.UI24R_CHANNELS = '1-5';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.channels).toEqual([1, 2, 3, 4, 5]);
    });

    it('parses reverse range (swaps start/end)', async () => {
      process.env.UI24R_CHANNELS = '5-1';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.channels).toEqual([1, 2, 3, 4, 5]);
    });

    it('parses mixed channels and ranges', async () => {
      process.env.UI24R_CHANNELS = '1-3,10,15-17';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.channels).toEqual([1, 2, 3, 10, 15, 16, 17]);
    });

    it('removes duplicate channels', async () => {
      process.env.UI24R_CHANNELS = '1,2,1,3,2';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.channels).toEqual([1, 2, 3]);
    });

    it('sorts channels numerically', async () => {
      process.env.UI24R_CHANNELS = '10,1,5';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.channels).toEqual([1, 5, 10]);
    });

    it('handles whitespace around channels', async () => {
      process.env.UI24R_CHANNELS = ' 1 , 2 , 3 ';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.channels).toEqual([1, 2, 3]);
    });

    it('handles whitespace around parts but not inside ranges', async () => {
      // Whitespace is trimmed around comma-separated parts, but not inside ranges
      // So " 1-3 " works, but "1 - 3" does not
      process.env.UI24R_CHANNELS = ' 1-3 ';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.channels).toEqual([1, 2, 3]);
    });

    it('throws error for whitespace inside ranges', async () => {
      process.env.UI24R_CHANNELS = '1 - 3';
      const { loadConfig } = await import('../src/config.js');

      expect(() => loadConfig()).toThrow('Invalid channel range: "1 - 3"');
    });

    it('throws error for channel below 1', async () => {
      process.env.UI24R_CHANNELS = '0';
      const { loadConfig } = await import('../src/config.js');

      expect(() => loadConfig()).toThrow('Channel 0 out of range (1-24)');
    });

    it('throws error for channel above 24', async () => {
      process.env.UI24R_CHANNELS = '25';
      const { loadConfig } = await import('../src/config.js');

      expect(() => loadConfig()).toThrow('Channel 25 out of range (1-24)');
    });

    it('throws error for invalid range format', async () => {
      process.env.UI24R_CHANNELS = 'abc';
      const { loadConfig } = await import('../src/config.js');

      expect(() => loadConfig()).toThrow('Invalid channel range: "abc"');
    });

    it('throws error for range with channel below 1', async () => {
      process.env.UI24R_CHANNELS = '0-5';
      const { loadConfig } = await import('../src/config.js');

      expect(() => loadConfig()).toThrow('Invalid channel range: "0-5"');
    });

    it('throws error for range with channel above 24', async () => {
      process.env.UI24R_CHANNELS = '20-30';
      const { loadConfig } = await import('../src/config.js');

      expect(() => loadConfig()).toThrow('Invalid channel range: "20-30"');
    });

    it('parses edge case: channel 1', async () => {
      process.env.UI24R_CHANNELS = '1';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.channels).toEqual([1]);
    });

    it('parses edge case: channel 24', async () => {
      process.env.UI24R_CHANNELS = '24';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.channels).toEqual([24]);
    });

    it('parses full range 1-24', async () => {
      process.env.UI24R_CHANNELS = '1-24';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.channels).toHaveLength(24);
      expect(config.channels[0]).toBe(1);
      expect(config.channels[23]).toBe(24);
    });
  });

  describe('host configuration', () => {
    it('returns undefined host when UI24R_HOST is not set', async () => {
      delete process.env.UI24R_HOST;
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.host).toBeUndefined();
    });

    it('returns undefined host when UI24R_HOST is empty string', async () => {
      process.env.UI24R_HOST = '';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.host).toBeUndefined();
    });

    it('returns undefined host when UI24R_HOST is whitespace only', async () => {
      process.env.UI24R_HOST = '   ';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.host).toBeUndefined();
    });

    it('returns trimmed host', async () => {
      process.env.UI24R_HOST = '  192.168.1.100  ';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.host).toBe('192.168.1.100');
    });

    it('returns host as-is', async () => {
      process.env.UI24R_HOST = 'mixer.local';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.host).toBe('mixer.local');
    });

    it('handles IP address host', async () => {
      process.env.UI24R_HOST = '192.168.1.50';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.host).toBe('192.168.1.50');
    });

    it('handles hostname with port', async () => {
      process.env.UI24R_HOST = 'mixer.local:8080';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.host).toBe('mixer.local:8080');
    });
  });

  describe('combined configuration', () => {
    it('loads both host and channels', async () => {
      process.env.UI24R_HOST = 'mixer.local';
      process.env.UI24R_CHANNELS = '1-12';
      const { loadConfig } = await import('../src/config.js');
      const config = loadConfig();

      expect(config.host).toBe('mixer.local');
      expect(config.channels).toHaveLength(12);
      expect(config.channels).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });
  });
});
