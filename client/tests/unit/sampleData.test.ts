/**
 * Sample Data Unit Tests
 *
 * Tests for the sample/demo data generation function.
 */

import { describe, it, expect } from 'vitest';
import { buildSampleState } from '../../src/lib/sampleData';
import type { BusType } from '../../src/lib/types';

describe('buildSampleState', () => {
  describe('basic structure', () => {
    it('returns valid AppState object', () => {
      const state = buildSampleState('master', 0);

      expect(state).toHaveProperty('host');
      expect(state).toHaveProperty('connectionStatus');
      expect(state).toHaveProperty('bus');
      expect(state).toHaveProperty('auxBuses');
      expect(state).toHaveProperty('channels');
    });

    it('sets host to sample mode indicator', () => {
      const state = buildSampleState('master', 0);

      expect(state.host).toBe('Sample Data (Dev Mode)');
    });

    it('sets connectionStatus to connected', () => {
      const state = buildSampleState('master', 0);

      expect(state.connectionStatus).toBe('connected');
    });
  });

  describe('bus configuration', () => {
    it('returns master bus configuration', () => {
      const state = buildSampleState('master', 0);

      expect(state.bus).toEqual({ type: 'master', id: 0 });
    });

    it('returns aux bus configuration', () => {
      const state = buildSampleState('aux', 3);

      expect(state.bus).toEqual({ type: 'aux', id: 3 });
    });

    it('returns gain bus configuration', () => {
      const state = buildSampleState('gain', 0);

      expect(state.bus).toEqual({ type: 'gain', id: 0 });
    });

    it('handles various aux bus IDs', () => {
      for (let i = 1; i <= 10; i++) {
        const state = buildSampleState('aux', i);
        expect(state.bus).toEqual({ type: 'aux', id: i });
      }
    });
  });

  describe('aux buses', () => {
    it('generates 10 aux buses', () => {
      const state = buildSampleState('master', 0);

      expect(state.auxBuses).toHaveLength(10);
    });

    it('assigns sequential IDs starting at 1', () => {
      const state = buildSampleState('master', 0);

      state.auxBuses.forEach((bus, index) => {
        expect(bus.id).toBe(index + 1);
      });
    });

    it('assigns expected aux bus names', () => {
      const state = buildSampleState('master', 0);
      const expectedNames = [
        'Wedge 1',
        'Wedge 2',
        'Wedge 3',
        'IEM 1',
        'IEM 2',
        'IEM 3',
        'Drummer',
        'Keys',
        'Guitar',
        'Spare',
      ];

      state.auxBuses.forEach((bus, index) => {
        expect(bus.name).toBe(expectedNames[index]);
      });
    });

    it('includes lastUpdatedAt timestamp', () => {
      const state = buildSampleState('master', 0);

      state.auxBuses.forEach(bus => {
        expect(bus.lastUpdatedAt).toBeDefined();
        expect(typeof bus.lastUpdatedAt).toBe('string');
        // Should be valid ISO date
        expect(() => new Date(bus.lastUpdatedAt)).not.toThrow();
      });
    });

    it('aux buses are consistent across bus types', () => {
      const masterState = buildSampleState('master', 0);
      const auxState = buildSampleState('aux', 1);
      const gainState = buildSampleState('gain', 0);

      expect(masterState.auxBuses.length).toBe(auxState.auxBuses.length);
      expect(masterState.auxBuses.length).toBe(gainState.auxBuses.length);

      masterState.auxBuses.forEach((bus, index) => {
        expect(bus.name).toBe(auxState.auxBuses[index].name);
        expect(bus.name).toBe(gainState.auxBuses[index].name);
      });
    });
  });

  describe('channels', () => {
    it('generates 24 channels', () => {
      const state = buildSampleState('master', 0);

      expect(state.channels).toHaveLength(24);
    });

    it('assigns sequential IDs starting at 1', () => {
      const state = buildSampleState('master', 0);

      state.channels.forEach((channel, index) => {
        expect(channel.id).toBe(index + 1);
      });
    });

    it('assigns expected channel labels', () => {
      const state = buildSampleState('master', 0);
      const expectedLabels = [
        'Kick',
        'Snare',
        'Hat',
        'Tom 1',
        'Tom 2',
        'Tom 3',
        'Overhead L',
        'Overhead R',
        'Bass',
        'Gtr 1',
        'Gtr 2',
        'Keys',
        'Piano',
        'Synth',
        'Vox 1',
        'Vox 2',
        'Vox 3',
        'Vox 4',
        'Horn 1',
        'Horn 2',
        'FX 1',
        'FX 2',
        'Spare 1',
        'Spare 2',
      ];

      state.channels.forEach((channel, index) => {
        expect(channel.label).toBe(expectedLabels[index]);
        expect(channel.name).toBe(expectedLabels[index]);
      });
    });

    it('sets busType correctly for master', () => {
      const state = buildSampleState('master', 0);

      state.channels.forEach(channel => {
        expect(channel.busType).toBe('master');
        expect(channel.bus).toBe(0);
      });
    });

    it('sets busType correctly for aux', () => {
      const state = buildSampleState('aux', 5);

      state.channels.forEach(channel => {
        expect(channel.busType).toBe('aux');
        expect(channel.bus).toBe(5);
      });
    });

    it('sets busType correctly for gain', () => {
      const state = buildSampleState('gain', 0);

      state.channels.forEach(channel => {
        expect(channel.busType).toBe('gain');
        expect(channel.bus).toBe(0);
      });
    });

    it('generates fader values in valid range', () => {
      const state = buildSampleState('master', 0);

      state.channels.forEach(channel => {
        expect(channel.fader).toBeGreaterThanOrEqual(0);
        expect(channel.fader).toBeLessThanOrEqual(1);
      });
    });

    it('generates varied fader values', () => {
      const state = buildSampleState('master', 0);
      const faderValues = new Set(state.channels.map(c => c.fader));

      // Should have multiple different values
      expect(faderValues.size).toBeGreaterThan(1);
    });

    it('fader values are within 0.05 to 0.95 range', () => {
      const state = buildSampleState('master', 0);

      state.channels.forEach(channel => {
        expect(channel.fader).toBeGreaterThanOrEqual(0.05);
        expect(channel.fader).toBeLessThanOrEqual(0.95);
      });
    });

    it('includes lastUpdatedAt timestamp', () => {
      const state = buildSampleState('master', 0);

      state.channels.forEach(channel => {
        expect(channel.lastUpdatedAt).toBeDefined();
        expect(typeof channel.lastUpdatedAt).toBe('string');
        expect(() => new Date(channel.lastUpdatedAt)).not.toThrow();
      });
    });
  });

  describe('mute state', () => {
    it('mutes every 6th channel (indices 0, 6, 12, 18)', () => {
      const state = buildSampleState('master', 0);

      state.channels.forEach((channel, index) => {
        if (index % 6 === 0) {
          expect(channel.muted).toBe(true);
        } else {
          expect(channel.muted).toBe(false);
        }
      });
    });

    it('has exactly 4 muted channels', () => {
      const state = buildSampleState('master', 0);
      const mutedCount = state.channels.filter(c => c.muted).length;

      expect(mutedCount).toBe(4);
    });

    it('mutes Kick, Overhead L, Piano, Horn 1', () => {
      const state = buildSampleState('master', 0);
      const mutedLabels = state.channels.filter(c => c.muted).map(c => c.label);

      expect(mutedLabels).toContain('Kick');
      expect(mutedLabels).toContain('Overhead L');
      expect(mutedLabels).toContain('Piano');
      expect(mutedLabels).toContain('Horn 1');
    });
  });

  describe('solo state', () => {
    it('solos Vox 1 and Vox 2 on master bus', () => {
      const state = buildSampleState('master', 0);

      const vox1 = state.channels.find(c => c.label === 'Vox 1');
      const vox2 = state.channels.find(c => c.label === 'Vox 2');

      expect(vox1?.solo).toBe(true);
      expect(vox2?.solo).toBe(true);
    });

    it('has exactly 2 soloed channels on master', () => {
      const state = buildSampleState('master', 0);
      const soloedCount = state.channels.filter(c => c.solo === true).length;

      expect(soloedCount).toBe(2);
    });

    it('does not set solo on aux bus', () => {
      const state = buildSampleState('aux', 1);

      state.channels.forEach(channel => {
        expect(channel.solo).toBeUndefined();
      });
    });

    it('does not set solo on gain bus', () => {
      const state = buildSampleState('gain', 0);

      state.channels.forEach(channel => {
        expect(channel.solo).toBeUndefined();
      });
    });
  });

  describe('timestamp consistency', () => {
    it('all timestamps are the same within a call', () => {
      const state = buildSampleState('master', 0);

      const allTimestamps = [
        ...state.auxBuses.map(b => b.lastUpdatedAt),
        ...state.channels.map(c => c.lastUpdatedAt),
      ];

      const uniqueTimestamps = new Set(allTimestamps);
      expect(uniqueTimestamps.size).toBe(1);
    });

    it('timestamps are recent', () => {
      const before = Date.now();
      const state = buildSampleState('master', 0);
      const after = Date.now();

      const timestamp = new Date(state.channels[0].lastUpdatedAt).getTime();

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('all bus types', () => {
    const busTypes: BusType[] = ['master', 'aux', 'gain'];

    busTypes.forEach(busType => {
      it(`generates valid state for ${busType} bus`, () => {
        const busId = busType === 'aux' ? 5 : 0;
        const state = buildSampleState(busType, busId);

        expect(state.bus.type).toBe(busType);
        expect(state.channels).toHaveLength(24);
        expect(state.auxBuses).toHaveLength(10);
        expect(state.connectionStatus).toBe('connected');

        state.channels.forEach(channel => {
          expect(channel.busType).toBe(busType);
          expect(channel.bus).toBe(busId);
        });
      });
    });
  });

  describe('deterministic output', () => {
    it('generates consistent channel order', () => {
      const state1 = buildSampleState('master', 0);
      const state2 = buildSampleState('master', 0);

      state1.channels.forEach((channel, index) => {
        expect(channel.label).toBe(state2.channels[index].label);
        expect(channel.id).toBe(state2.channels[index].id);
      });
    });

    it('generates consistent fader values for same channel', () => {
      const state1 = buildSampleState('master', 0);
      const state2 = buildSampleState('master', 0);

      state1.channels.forEach((channel, index) => {
        expect(channel.fader).toBe(state2.channels[index].fader);
      });
    });

    it('generates consistent aux bus names', () => {
      const state1 = buildSampleState('master', 0);
      const state2 = buildSampleState('aux', 1);

      state1.auxBuses.forEach((bus, index) => {
        expect(bus.name).toBe(state2.auxBuses[index].name);
      });
    });
  });
});
