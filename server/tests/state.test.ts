/**
 * StateStore Unit Tests
 *
 * Tests for the StateStore class that manages mixer state.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StateStore, type BusType, type ConnectionStatus } from '../src/state.js';

describe('StateStore', () => {
  const channelIds = [1, 2, 3, 4];
  const auxBusIds = [1, 2, 3];
  let store: StateStore;

  beforeEach(() => {
    store = new StateStore('mixer.local', channelIds, auxBusIds);
  });

  describe('constructor', () => {
    it('initializes with the provided host', () => {
      const state = store.getState();
      expect(state.host).toBe('mixer.local');
    });

    it('initializes with disconnected status', () => {
      const state = store.getState();
      expect(state.connectionStatus).toBe('disconnected');
    });

    it('initializes channels for master bus', () => {
      const state = store.getState('master', 0);
      expect(state.channels).toHaveLength(4);
      state.channels.forEach((channel, index) => {
        expect(channel.id).toBe(channelIds[index]);
        expect(channel.busType).toBe('master');
        expect(channel.bus).toBe(0);
        expect(channel.fader).toBe(0);
        expect(channel.label).toBe(`CH ${channelIds[index]}`);
      });
    });

    it('initializes channels for gain bus', () => {
      const state = store.getState('gain', 0);
      expect(state.channels).toHaveLength(4);
      state.channels.forEach((channel, index) => {
        expect(channel.id).toBe(channelIds[index]);
        expect(channel.busType).toBe('gain');
        expect(channel.bus).toBe(0);
      });
    });

    it('initializes channels for each aux bus', () => {
      auxBusIds.forEach(busId => {
        const state = store.getState('aux', busId);
        expect(state.channels).toHaveLength(4);
        state.channels.forEach((channel, index) => {
          expect(channel.id).toBe(channelIds[index]);
          expect(channel.busType).toBe('aux');
          expect(channel.bus).toBe(busId);
        });
      });
    });

    it('initializes aux buses', () => {
      const state = store.getState();
      expect(state.auxBuses).toHaveLength(3);
      expect(state.auxBuses[0]).toMatchObject({ id: 1, name: 'AUX 1' });
      expect(state.auxBuses[1]).toMatchObject({ id: 2, name: 'AUX 2' });
      expect(state.auxBuses[2]).toMatchObject({ id: 3, name: 'AUX 3' });
    });

    it('sets lastUpdatedAt on channels', () => {
      const state = store.getState();
      state.channels.forEach(channel => {
        expect(channel.lastUpdatedAt).toBeDefined();
        expect(() => new Date(channel.lastUpdatedAt)).not.toThrow();
      });
    });
  });

  describe('getState', () => {
    it('returns state for master bus by default', () => {
      const state = store.getState();
      expect(state.bus).toEqual({ type: 'master', id: 0 });
    });

    it('returns state for specified bus type', () => {
      const state = store.getState('aux', 2);
      expect(state.bus).toEqual({ type: 'aux', id: 2 });
    });

    it('filters channels by bus type and id', () => {
      const masterState = store.getState('master', 0);
      const auxState = store.getState('aux', 1);

      masterState.channels.forEach(channel => {
        expect(channel.busType).toBe('master');
        expect(channel.bus).toBe(0);
      });

      auxState.channels.forEach(channel => {
        expect(channel.busType).toBe('aux');
        expect(channel.bus).toBe(1);
      });
    });

    it('returns channels sorted by id', () => {
      const state = store.getState();
      for (let i = 1; i < state.channels.length; i++) {
        expect(state.channels[i].id).toBeGreaterThan(state.channels[i - 1].id);
      }
    });

    it('returns aux buses sorted by id', () => {
      const state = store.getState();
      for (let i = 1; i < state.auxBuses.length; i++) {
        expect(state.auxBuses[i].id).toBeGreaterThan(state.auxBuses[i - 1].id);
      }
    });

    it('includes meter data in channel state', () => {
      store.setMeter(1, { pre: 0.5, postFader: 0.4 });
      const state = store.getState();
      const channel = state.channels.find(c => c.id === 1);
      expect(channel?.meterPre).toBe(0.5);
      expect(channel?.meterPostFader).toBe(0.4);
    });
  });

  describe('setConnectionStatus', () => {
    it('updates connection status to connected', () => {
      store.setConnectionStatus('connected');
      const state = store.getState();
      expect(state.connectionStatus).toBe('connected');
    });

    it('updates connection status to reconnecting', () => {
      store.setConnectionStatus('reconnecting');
      const state = store.getState();
      expect(state.connectionStatus).toBe('reconnecting');
    });

    it('updates connection status to disconnected', () => {
      store.setConnectionStatus('connected');
      store.setConnectionStatus('disconnected');
      const state = store.getState();
      expect(state.connectionStatus).toBe('disconnected');
    });
  });

  describe('setHost', () => {
    it('updates the host', () => {
      store.setHost('new-mixer.local');
      const state = store.getState();
      expect(state.host).toBe('new-mixer.local');
    });

    it('handles empty host', () => {
      store.setHost('');
      const state = store.getState();
      expect(state.host).toBe('');
    });
  });

  describe('updateChannel', () => {
    it('updates fader value', () => {
      const result = store.updateChannel('master', 0, 1, { fader: 0.75 });
      expect(result?.fader).toBe(0.75);

      const state = store.getState();
      const channel = state.channels.find(c => c.id === 1);
      expect(channel?.fader).toBe(0.75);
    });

    it('updates faderDb value', () => {
      const result = store.updateChannel('master', 0, 1, { faderDb: -12 });
      expect(result?.faderDb).toBe(-12);
    });

    it('updates muted value', () => {
      const result = store.updateChannel('master', 0, 1, { muted: true });
      expect(result?.muted).toBe(true);
    });

    it('updates solo value', () => {
      const result = store.updateChannel('master', 0, 1, { solo: true });
      expect(result?.solo).toBe(true);
    });

    it('updates name value', () => {
      const result = store.updateChannel('master', 0, 1, { name: 'Kick' });
      expect(result?.name).toBe('Kick');
    });

    it('sets lastUpdatedAt on update', () => {
      store.updateChannel('master', 0, 1, { fader: 0.5 });
      const channel = store.getChannel('master', 0, 1);
      expect(channel?.lastUpdatedAt).toBeDefined();
      // Verify it's a valid ISO date string
      expect(() => new Date(channel!.lastUpdatedAt)).not.toThrow();
      const timestamp = new Date(channel!.lastUpdatedAt).getTime();
      expect(timestamp).toBeGreaterThan(0);
    });

    it('updates multiple fields at once', () => {
      const result = store.updateChannel('master', 0, 1, {
        fader: 0.5,
        faderDb: -6,
        muted: true,
        name: 'Kick',
      });
      expect(result?.fader).toBe(0.5);
      expect(result?.faderDb).toBe(-6);
      expect(result?.muted).toBe(true);
      expect(result?.name).toBe('Kick');
    });

    it('returns null for non-existent channel', () => {
      const result = store.updateChannel('master', 0, 999, { fader: 0.5 });
      expect(result).toBeNull();
    });

    it('returns null for non-existent bus', () => {
      const result = store.updateChannel('aux', 999, 1, { fader: 0.5 });
      expect(result).toBeNull();
    });

    it('preserves existing values when updating', () => {
      store.updateChannel('master', 0, 1, { fader: 0.75, muted: true });
      store.updateChannel('master', 0, 1, { faderDb: -6 });

      const channel = store.getChannel('master', 0, 1);
      expect(channel?.fader).toBe(0.75);
      expect(channel?.muted).toBe(true);
      expect(channel?.faderDb).toBe(-6);
    });

    it('updates channel on aux bus', () => {
      const result = store.updateChannel('aux', 2, 1, { fader: 0.5, muted: true });
      expect(result?.busType).toBe('aux');
      expect(result?.bus).toBe(2);
      expect(result?.fader).toBe(0.5);
      expect(result?.muted).toBe(true);
    });

    it('updates channel on gain bus', () => {
      const result = store.updateChannel('gain', 0, 1, { fader: 0.8 });
      expect(result?.busType).toBe('gain');
      expect(result?.fader).toBe(0.8);
    });
  });

  describe('getChannel', () => {
    it('returns channel for valid id', () => {
      const channel = store.getChannel('master', 0, 1);
      expect(channel).not.toBeNull();
      expect(channel?.id).toBe(1);
    });

    it('returns null for invalid channel id', () => {
      const channel = store.getChannel('master', 0, 999);
      expect(channel).toBeNull();
    });

    it('returns null for invalid bus', () => {
      const channel = store.getChannel('aux', 999, 1);
      expect(channel).toBeNull();
    });

    it('returns correct channel for different bus types', () => {
      store.updateChannel('master', 0, 1, { fader: 0.5 });
      store.updateChannel('aux', 1, 1, { fader: 0.75 });

      const masterChannel = store.getChannel('master', 0, 1);
      const auxChannel = store.getChannel('aux', 1, 1);

      expect(masterChannel?.fader).toBe(0.5);
      expect(auxChannel?.fader).toBe(0.75);
    });
  });

  describe('updateAuxBus', () => {
    it('updates aux bus name', () => {
      const result = store.updateAuxBus(1, 'Drums');
      expect(result?.name).toBe('Drums');
    });

    it('updates lastUpdatedAt', () => {
      store.updateAuxBus(1, 'Drums');
      const state = store.getState();
      const bus = state.auxBuses.find(b => b.id === 1);
      expect(bus?.lastUpdatedAt).toBeDefined();
    });

    it('returns null for non-existent aux bus', () => {
      const result = store.updateAuxBus(999, 'Invalid');
      expect(result).toBeNull();
    });

    it('reflects in getState', () => {
      store.updateAuxBus(2, 'Vocals');
      const state = store.getState();
      const bus = state.auxBuses.find(b => b.id === 2);
      expect(bus?.name).toBe('Vocals');
    });
  });

  describe('setMeter', () => {
    it('sets pre-fader meter value', () => {
      store.setMeter(1, { pre: 0.5 });
      const state = store.getState();
      const channel = state.channels.find(c => c.id === 1);
      expect(channel?.meterPre).toBe(0.5);
    });

    it('sets post-fader meter value', () => {
      store.setMeter(1, { postFader: 0.4 });
      const state = store.getState();
      const channel = state.channels.find(c => c.id === 1);
      expect(channel?.meterPostFader).toBe(0.4);
    });

    it('sets both meter values', () => {
      store.setMeter(1, { pre: 0.5, postFader: 0.4 });
      const state = store.getState();
      const channel = state.channels.find(c => c.id === 1);
      expect(channel?.meterPre).toBe(0.5);
      expect(channel?.meterPostFader).toBe(0.4);
    });

    it('updates meter values', () => {
      store.setMeter(1, { pre: 0.5 });
      store.setMeter(1, { pre: 0.8 });
      const state = store.getState();
      const channel = state.channels.find(c => c.id === 1);
      expect(channel?.meterPre).toBe(0.8);
    });

    it('preserves other meter value when updating one', () => {
      store.setMeter(1, { pre: 0.5, postFader: 0.4 });
      store.setMeter(1, { pre: 0.8 });
      const state = store.getState();
      const channel = state.channels.find(c => c.id === 1);
      expect(channel?.meterPre).toBe(0.8);
      expect(channel?.meterPostFader).toBe(0.4);
    });
  });

  describe('channel key generation', () => {
    it('stores channels for different buses independently', () => {
      store.updateChannel('master', 0, 1, { fader: 0.1 });
      store.updateChannel('gain', 0, 1, { fader: 0.2 });
      store.updateChannel('aux', 1, 1, { fader: 0.3 });
      store.updateChannel('aux', 2, 1, { fader: 0.4 });

      expect(store.getChannel('master', 0, 1)?.fader).toBe(0.1);
      expect(store.getChannel('gain', 0, 1)?.fader).toBe(0.2);
      expect(store.getChannel('aux', 1, 1)?.fader).toBe(0.3);
      expect(store.getChannel('aux', 2, 1)?.fader).toBe(0.4);
    });
  });

  describe('edge cases', () => {
    it('handles empty channel ids', () => {
      const emptyStore = new StateStore('host', [], [1, 2]);
      const state = emptyStore.getState();
      expect(state.channels).toHaveLength(0);
    });

    it('handles empty aux bus ids', () => {
      const noAuxStore = new StateStore('host', [1, 2], []);
      const state = noAuxStore.getState();
      expect(state.auxBuses).toHaveLength(0);
    });

    it('handles fader value 0', () => {
      store.updateChannel('master', 0, 1, { fader: 0 });
      const channel = store.getChannel('master', 0, 1);
      expect(channel?.fader).toBe(0);
    });

    it('handles fader value 1', () => {
      store.updateChannel('master', 0, 1, { fader: 1 });
      const channel = store.getChannel('master', 0, 1);
      expect(channel?.fader).toBe(1);
    });

    it('handles negative faderDb', () => {
      store.updateChannel('master', 0, 1, { faderDb: -60 });
      const channel = store.getChannel('master', 0, 1);
      expect(channel?.faderDb).toBe(-60);
    });

    it('handles -Infinity faderDb', () => {
      store.updateChannel('master', 0, 1, { faderDb: -Infinity });
      const channel = store.getChannel('master', 0, 1);
      expect(channel?.faderDb).toBe(-Infinity);
    });
  });
});
