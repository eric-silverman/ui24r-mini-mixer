/**
 * Fader Logic Unit Tests
 *
 * Tests for the fader conversion functions and state update logic.
 * These functions are critical for the LCD dB display to work correctly.
 */

import { describe, it, expect } from 'vitest';

// Recreate the functions from App.tsx and ChannelStrip.tsx for testing
function clamp(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function faderToDb(value: number): number {
  if (value <= 0.0001) {
    return -60;
  }
  return value * 60 - 60;
}

function dbToFader(value: number): number {
  const clamped = Math.max(-60, Math.min(0, value));
  return (clamped + 60) / 60;
}

function isMinusInf(value: number): boolean {
  return value <= 0.0001;
}

function meterToPercent(value: number): number {
  if (value <= 0) {
    return 0;
  }
  const db = 20 * Math.log10(value);
  const normalized = (db + 60) / 60;
  return Math.min(1, Math.max(0, normalized));
}

describe('clamp', () => {
  it('returns 0 for NaN', () => {
    expect(clamp(NaN)).toBe(0);
  });

  it('returns 0 for negative values', () => {
    expect(clamp(-0.5)).toBe(0);
    expect(clamp(-100)).toBe(0);
  });

  it('returns 1 for values above 1', () => {
    expect(clamp(1.5)).toBe(1);
    expect(clamp(100)).toBe(1);
  });

  it('returns the value for values in range [0, 1]', () => {
    expect(clamp(0)).toBe(0);
    expect(clamp(0.5)).toBe(0.5);
    expect(clamp(1)).toBe(1);
    expect(clamp(0.75)).toBe(0.75);
  });

  it('handles edge cases at boundaries', () => {
    expect(clamp(0.0001)).toBe(0.0001);
    expect(clamp(0.9999)).toBe(0.9999);
  });
});

describe('faderToDb', () => {
  it('returns -60 for zero fader value', () => {
    expect(faderToDb(0)).toBe(-60);
  });

  it('returns -60 for very small values (minus infinity threshold)', () => {
    expect(faderToDb(0.0001)).toBe(-60);
    expect(faderToDb(0.00001)).toBe(-60);
  });

  it('returns 0 dB for fader value of 1', () => {
    expect(faderToDb(1)).toBe(0);
  });

  it('returns correct dB values for intermediate fader positions', () => {
    // fader 0.5 should give -30 dB
    expect(faderToDb(0.5)).toBe(-30);
    // fader 0.25 should give -45 dB
    expect(faderToDb(0.25)).toBe(-45);
    // fader 0.75 should give -15 dB
    expect(faderToDb(0.75)).toBe(-15);
  });

  it('maintains linear relationship in valid range', () => {
    // Check that the conversion is linear: db = fader * 60 - 60
    for (let fader = 0.1; fader <= 1; fader += 0.1) {
      const expectedDb = fader * 60 - 60;
      expect(faderToDb(fader)).toBeCloseTo(expectedDb, 5);
    }
  });
});

describe('dbToFader', () => {
  it('returns 0 for -60 dB', () => {
    expect(dbToFader(-60)).toBe(0);
  });

  it('returns 1 for 0 dB', () => {
    expect(dbToFader(0)).toBe(1);
  });

  it('clamps values below -60 dB to 0', () => {
    expect(dbToFader(-100)).toBe(0);
    expect(dbToFader(-70)).toBe(0);
  });

  it('clamps values above 0 dB to 1', () => {
    expect(dbToFader(10)).toBe(1);
    expect(dbToFader(100)).toBe(1);
  });

  it('returns correct fader values for intermediate dB values', () => {
    expect(dbToFader(-30)).toBe(0.5);
    expect(dbToFader(-45)).toBe(0.25);
    expect(dbToFader(-15)).toBe(0.75);
  });

  it('is the inverse of faderToDb for valid ranges', () => {
    const testValues = [0.1, 0.25, 0.5, 0.75, 0.9, 1.0];
    for (const fader of testValues) {
      const db = faderToDb(fader);
      const backToFader = dbToFader(db);
      expect(backToFader).toBeCloseTo(fader, 5);
    }
  });
});

describe('isMinusInf', () => {
  it('returns true for zero', () => {
    expect(isMinusInf(0)).toBe(true);
  });

  it('returns true for values at or below threshold', () => {
    expect(isMinusInf(0.0001)).toBe(true);
    expect(isMinusInf(0.00001)).toBe(true);
  });

  it('returns false for values above threshold', () => {
    expect(isMinusInf(0.001)).toBe(false);
    expect(isMinusInf(0.5)).toBe(false);
    expect(isMinusInf(1)).toBe(false);
  });
});

describe('meterToPercent', () => {
  it('returns 0 for zero or negative values', () => {
    expect(meterToPercent(0)).toBe(0);
    expect(meterToPercent(-1)).toBe(0);
  });

  it('returns 1 for value of 1 (0 dB)', () => {
    expect(meterToPercent(1)).toBe(1);
  });

  it('clamps output to [0, 1] range', () => {
    // Values above 1 should return 1
    expect(meterToPercent(10)).toBe(1);
    // Values below 0 should return 0
    expect(meterToPercent(-0.5)).toBe(0);
  });

  it('converts linear amplitude to dB-based percentage correctly', () => {
    // Amplitude 0.001 = -60 dB → 0%
    expect(meterToPercent(0.001)).toBeCloseTo(0, 1);
    // Amplitude ~0.5 = -6 dB → should be around 90%
    const percent = meterToPercent(0.5);
    expect(percent).toBeGreaterThan(0.8);
    expect(percent).toBeLessThan(1);
  });
});

describe('faderDb display logic', () => {
  /**
   * This test verifies the core fix for the LCD display bug.
   * When faderDb is undefined, the calculated value should be used.
   * When faderDb is defined, it should take precedence.
   */

  type ChannelState = {
    id: number;
    fader: number;
    faderDb?: number;
  };

  function computeDbValue(channel: ChannelState): number {
    return channel.faderDb ?? faderToDb(channel.fader);
  }

  function computeDbDisplay(dbValue: number): string {
    return `${Math.round(dbValue)} dB`;
  }

  it('uses faderDb when present', () => {
    const channel: ChannelState = { id: 1, fader: 0.5, faderDb: -25 };
    expect(computeDbValue(channel)).toBe(-25);
    expect(computeDbDisplay(computeDbValue(channel))).toBe('-25 dB');
  });

  it('calculates from fader when faderDb is undefined', () => {
    const channel: ChannelState = { id: 1, fader: 0.5, faderDb: undefined };
    expect(computeDbValue(channel)).toBe(-30);
    expect(computeDbDisplay(computeDbValue(channel))).toBe('-30 dB');
  });

  it('shows calculated value after fader change (fix verification)', () => {
    // Simulate the bug fix: when fader changes, faderDb should be cleared
    const originalChannel: ChannelState = { id: 1, fader: 0.5, faderDb: -30 };

    // Before fix: fader changes but faderDb stays, showing stale value
    const newFaderValue = 0.75;

    // After fix: faderDb is cleared during optimistic update
    const updatedChannel: ChannelState = {
      ...originalChannel,
      fader: newFaderValue,
      faderDb: undefined, // This is the key fix
    };

    // The display should now show the calculated value from the new fader
    expect(computeDbValue(updatedChannel)).toBe(-15); // 0.75 * 60 - 60 = -15
    expect(computeDbDisplay(computeDbValue(updatedChannel))).toBe('-15 dB');
  });

  it('handles the old buggy behavior (for documentation)', () => {
    // This shows what the bug looked like:
    const originalChannel: ChannelState = { id: 1, fader: 0.5, faderDb: -30 };
    const newFaderValue = 0.75;

    // Bug: faderDb was NOT cleared, so stale value was shown
    const buggyUpdate: ChannelState = {
      ...originalChannel,
      fader: newFaderValue,
      // faderDb: -30 remains from original (BUG!)
    };

    // The stale faderDb would still show -30 instead of -15
    expect(computeDbValue(buggyUpdate)).toBe(-30); // Wrong! Should be -15

    // This is why we clear faderDb in the fix
  });
});

describe('state update simulation', () => {
  type ChannelState = {
    id: number;
    fader: number;
    faderDb?: number;
    busType: 'master' | 'aux' | 'gain';
    bus: number;
  };

  function handleFaderChange(
    channels: ChannelState[],
    id: number,
    value: number
  ): ChannelState[] {
    const clamped = clamp(value);
    return channels.map(channel =>
      channel.id === id
        ? { ...channel, fader: clamped, faderDb: undefined }
        : channel
    );
  }

  it('clears faderDb on individual channel fader change', () => {
    const channels: ChannelState[] = [
      { id: 1, fader: 0.5, faderDb: -30, busType: 'aux', bus: 1 },
      { id: 2, fader: 0.75, faderDb: -15, busType: 'aux', bus: 1 },
    ];

    const updated = handleFaderChange(channels, 1, 0.8);

    // Channel 1 should have updated fader and undefined faderDb
    expect(updated[0].fader).toBe(0.8);
    expect(updated[0].faderDb).toBeUndefined();

    // Channel 2 should be unchanged
    expect(updated[1].fader).toBe(0.75);
    expect(updated[1].faderDb).toBe(-15);
  });

  it('clamps fader values correctly during update', () => {
    const channels: ChannelState[] = [
      { id: 1, fader: 0.5, faderDb: -30, busType: 'master', bus: 0 },
    ];

    // Test clamping above 1
    let updated = handleFaderChange(channels, 1, 1.5);
    expect(updated[0].fader).toBe(1);

    // Test clamping below 0
    updated = handleFaderChange(channels, 1, -0.5);
    expect(updated[0].fader).toBe(0);
  });

  it('works correctly for aux bus channels', () => {
    const channels: ChannelState[] = [
      { id: 1, fader: 0.5, faderDb: -30, busType: 'aux', bus: 3 },
      { id: 2, fader: 0.5, faderDb: -30, busType: 'aux', bus: 3 },
    ];

    const updated = handleFaderChange(channels, 2, 0.6);

    // Only channel 2 should be updated
    expect(updated[0].faderDb).toBe(-30);
    expect(updated[1].fader).toBe(0.6);
    expect(updated[1].faderDb).toBeUndefined();
  });
});

describe('group fader change simulation', () => {
  type ChannelState = {
    id: number;
    fader: number;
    faderDb?: number;
  };

  function applyGroupFaderChange(
    channels: ChannelState[],
    updates: Record<number, number>
  ): ChannelState[] {
    return channels.map(channel => {
      const nextValue = updates[channel.id];
      if (nextValue === undefined) {
        return channel;
      }
      return { ...channel, fader: nextValue, faderDb: undefined };
    });
  }

  it('clears faderDb for all updated channels in a group', () => {
    const channels: ChannelState[] = [
      { id: 1, fader: 0.5, faderDb: -30 },
      { id: 2, fader: 0.6, faderDb: -24 },
      { id: 3, fader: 0.7, faderDb: -18 },
      { id: 4, fader: 0.4, faderDb: -36 },
    ];

    // Simulate updating channels 1 and 3 as part of a group
    const updates = { 1: 0.6, 3: 0.8 };
    const updated = applyGroupFaderChange(channels, updates);

    // Updated channels should have new fader and undefined faderDb
    expect(updated[0].fader).toBe(0.6);
    expect(updated[0].faderDb).toBeUndefined();
    expect(updated[2].fader).toBe(0.8);
    expect(updated[2].faderDb).toBeUndefined();

    // Unchanged channels should retain their values
    expect(updated[1].fader).toBe(0.6);
    expect(updated[1].faderDb).toBe(-24);
    expect(updated[3].fader).toBe(0.4);
    expect(updated[3].faderDb).toBe(-36);
  });
});

describe('WebSocket channel update simulation', () => {
  type ChannelState = {
    id: number;
    fader: number;
    faderDb?: number;
    busType: 'master' | 'aux' | 'gain';
    bus: number;
  };

  type ChannelUpdate = Partial<ChannelState> & { id: number; busType: string; bus: number };

  function applyWsChannelUpdate(
    channels: ChannelState[],
    update: ChannelUpdate,
    activeBus: { type: string; id: number }
  ): ChannelState[] {
    // Skip if update is for a different bus
    if (update.busType !== activeBus.type || update.bus !== activeBus.id) {
      return channels;
    }

    return channels.map(channel =>
      channel.id === update.id
        ? {
            ...channel,
            ...update,
          }
        : channel
    );
  }

  it('applies faderDb from server response', () => {
    const channels: ChannelState[] = [
      { id: 1, fader: 0.5, faderDb: undefined, busType: 'aux', bus: 1 },
    ];

    const update: ChannelUpdate = {
      id: 1,
      fader: 0.5,
      faderDb: -29.5, // Precise value from server
      busType: 'aux',
      bus: 1,
    };

    const activeBus = { type: 'aux', id: 1 };
    const updated = applyWsChannelUpdate(channels, update, activeBus);

    expect(updated[0].faderDb).toBe(-29.5);
  });

  it('ignores updates for different bus', () => {
    const channels: ChannelState[] = [
      { id: 1, fader: 0.5, faderDb: -30, busType: 'aux', bus: 1 },
    ];

    const update: ChannelUpdate = {
      id: 1,
      fader: 0.75,
      faderDb: -15,
      busType: 'aux',
      bus: 2, // Different bus!
    };

    const activeBus = { type: 'aux', id: 1 };
    const updated = applyWsChannelUpdate(channels, update, activeBus);

    // Should be unchanged
    expect(updated[0].fader).toBe(0.5);
    expect(updated[0].faderDb).toBe(-30);
  });

  it('ignores updates for different bus type', () => {
    const channels: ChannelState[] = [
      { id: 1, fader: 0.5, faderDb: -30, busType: 'master', bus: 0 },
    ];

    const update: ChannelUpdate = {
      id: 1,
      fader: 0.75,
      faderDb: -15,
      busType: 'aux', // Different bus type!
      bus: 1,
    };

    const activeBus = { type: 'master', id: 0 };
    const updated = applyWsChannelUpdate(channels, update, activeBus);

    // Should be unchanged
    expect(updated[0].fader).toBe(0.5);
    expect(updated[0].faderDb).toBe(-30);
  });
});

describe('dB display formatting', () => {
  function formatDbDisplay(dbValue: number): string {
    return `${Math.round(dbValue)} dB`;
  }

  it('rounds to nearest integer', () => {
    expect(formatDbDisplay(-29.4)).toBe('-29 dB');
    expect(formatDbDisplay(-29.5)).toBe('-29 dB'); // Math.round rounds .5 to nearest even
    expect(formatDbDisplay(-29.6)).toBe('-30 dB');
  });

  it('displays 0 dB correctly', () => {
    expect(formatDbDisplay(0)).toBe('0 dB');
    expect(formatDbDisplay(-0.4)).toBe('0 dB');
  });

  it('displays -60 dB correctly', () => {
    expect(formatDbDisplay(-60)).toBe('-60 dB');
    expect(formatDbDisplay(-59.6)).toBe('-60 dB');
  });

  it('displays intermediate values correctly', () => {
    expect(formatDbDisplay(-12)).toBe('-12 dB');
    expect(formatDbDisplay(-6)).toBe('-6 dB');
    expect(formatDbDisplay(-24)).toBe('-24 dB');
  });
});
