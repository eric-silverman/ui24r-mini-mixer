/**
 * App.tsx Helper Functions Unit Tests
 *
 * Tests for all utility/helper functions defined in App.tsx.
 * These functions are recreated here for testing since they're not exported.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  ChannelSection,
  GlobalGroup,
  GlobalGroupSettings,
  BusType,
  AuxBusState,
} from '../../src/lib/types';

// Recreate helper functions for testing
const FAVORITES_ID = 'favorites';
const OTHERS_ID = 'others';
const VIEW_GROUP_PREFIX = 'view';

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

function normalizeMixName(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '');
}

function resolveMixTarget(
  requested: string,
  auxBuses: AuxBusState[]
): { type: BusType; id: number } | null {
  const normalized = normalizeMixName(requested);
  if (!normalized) {
    return null;
  }
  if (['main', 'master', 'mainmix', 'mix'].includes(normalized)) {
    return { type: 'master', id: 0 };
  }
  if (['gain', 'preamp', 'preamps'].includes(normalized)) {
    return { type: 'gain', id: 0 };
  }
  const auxMatch = normalized.match(/^aux0*(\d+)$/) ?? normalized.match(/^aux0*(\d+)mix$/);
  if (auxMatch) {
    const id = Number(auxMatch[1]);
    if (Number.isFinite(id)) {
      return { type: 'aux', id };
    }
  }
  const byName = auxBuses.find(
    aux => normalizeMixName(aux.name || `aux${aux.id}`) === normalized
  );
  if (byName) {
    return { type: 'aux', id: byName.id };
  }
  return null;
}

function getGroupKey(busType: BusType, busId: number, groupType: string, groupId: string): string {
  if (busType === 'aux') {
    return `aux:${busId}:${groupType}:${groupId}`;
  }
  return `${VIEW_GROUP_PREFIX}:${busType}:${groupType}:${groupId}`;
}

function buildDefaultLayout(channelIds: number[]): ChannelSection[] {
  return [
    { id: FAVORITES_ID, name: 'My Channels', channelIds: [], offsetDb: 0, mode: 'ignore-inf' },
    {
      id: OTHERS_ID,
      name: 'Other',
      channelIds: channelIds.slice(),
      offsetDb: 0,
      mode: 'ignore-inf',
    },
  ];
}

function normalizeLayout(sections: ChannelSection[], channelIds: number[]): ChannelSection[] {
  if (channelIds.length === 0) {
    return buildDefaultLayout([]);
  }

  const allowed = new Set(channelIds);
  const byId = new Map<string, ChannelSection>();
  sections.forEach(section => {
    if (!section.id || byId.has(section.id)) {
      return;
    }
    const nameOverride = section.id === FAVORITES_ID ? 'My Channels' : section.name || section.id;
    byId.set(section.id, {
      id: section.id,
      name: nameOverride,
      channelIds: Array.isArray(section.channelIds) ? section.channelIds.slice() : [],
      offsetDb: typeof section.offsetDb === 'number' ? section.offsetDb : 0,
      mode:
        section.mode === 'ignore-inf' || section.mode === 'ignore-inf-sends'
          ? section.mode
          : 'ignore-inf',
      enabled: typeof section.enabled === 'boolean' ? section.enabled : true,
    });
  });

  if (!byId.has(FAVORITES_ID)) {
    byId.set(FAVORITES_ID, {
      id: FAVORITES_ID,
      name: 'My Channels',
      channelIds: [],
      offsetDb: 0,
      mode: 'ignore-inf',
      enabled: true,
    });
  }
  if (!byId.has(OTHERS_ID)) {
    byId.set(OTHERS_ID, {
      id: OTHERS_ID,
      name: 'Other',
      channelIds: [],
      offsetDb: 0,
      mode: 'ignore-inf',
      enabled: true,
    });
  }

  const ordered: ChannelSection[] = [];
  const favorites = byId.get(FAVORITES_ID)!;
  ordered.push(favorites);
  sections.forEach(section => {
    if (section.id === FAVORITES_ID || section.id === OTHERS_ID) {
      return;
    }
    const existing = byId.get(section.id);
    if (existing) {
      ordered.push(existing);
    }
  });
  const others = byId.get(OTHERS_ID)!;
  ordered.push(others);

  ordered.forEach(section => {
    const next: number[] = [];
    section.channelIds.forEach(id => {
      if (!allowed.has(id) || next.includes(id)) {
        return;
      }
      next.push(id);
    });
    section.channelIds = next;
  });

  const favoriteIds = new Set(favorites.channelIds);
  const remaining = channelIds.filter(id => !favoriteIds.has(id));
  const existingOthers = Array.isArray(others.channelIds) ? others.channelIds : [];
  const nextOthers: number[] = [];
  const seen = new Set<number>();
  existingOthers.forEach(id => {
    if (!allowed.has(id) || favoriteIds.has(id) || seen.has(id)) {
      return;
    }
    seen.add(id);
    nextOthers.push(id);
  });
  remaining.forEach(id => {
    if (!seen.has(id)) {
      nextOthers.push(id);
    }
  });
  others.channelIds = nextOthers;

  return ordered;
}

function normalizeGlobalGroups(groups: GlobalGroup[], channelIds: number[]): GlobalGroup[] {
  const allowed = new Set(channelIds);
  const byId = new Map<string, GlobalGroup>();
  groups.forEach(group => {
    if (!group.id || byId.has(group.id)) {
      return;
    }
    const groupChannelIds = Array.isArray(group.channelIds) ? group.channelIds.slice() : [];
    const cleaned = groupChannelIds.filter((id, index, list) => {
      if (!allowed.has(id)) {
        return false;
      }
      return list.indexOf(id) === index;
    });
    byId.set(group.id, {
      id: group.id,
      name: group.name || group.id,
      channelIds: cleaned,
    });
  });
  return Array.from(byId.values());
}

function normalizeGlobalSettings(
  settings: Record<string, GlobalGroupSettings>
): Record<string, GlobalGroupSettings> {
  const entries = Object.entries(settings ?? {});
  const normalized: Record<string, GlobalGroupSettings> = {};
  entries.forEach(([groupId, setting]) => {
    if (!groupId) {
      return;
    }
    const offsetDb =
      typeof setting.offsetDb === 'number' && Number.isFinite(setting.offsetDb)
        ? setting.offsetDb
        : 0;
    const mode =
      setting.mode === 'ignore-inf' || setting.mode === 'ignore-inf-sends'
        ? setting.mode
        : 'ignore-inf';
    const enabled = typeof setting.enabled === 'boolean' ? setting.enabled : false;
    normalized[groupId] = { offsetDb, mode, enabled };
  });
  return normalized;
}

function layoutsEqual(a: ChannelSection[], b: ChannelSection[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((section, index) => {
    const other = b[index];
    if (
      !other ||
      section.id !== other.id ||
      section.name !== other.name ||
      (section.offsetDb ?? 0) !== (other.offsetDb ?? 0)
    ) {
      return false;
    }
    if (section.channelIds.length !== other.channelIds.length) {
      return false;
    }
    return section.channelIds.every((id, idx) => id === other.channelIds[idx]);
  });
}

function makeSectionId(name: string, existing: Set<string>): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  let id = base || 'section';
  let suffix = 1;
  while (existing.has(id)) {
    id = `${base || 'section'}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function upsertChannelInSection(
  sections: ChannelSection[],
  channelId: number,
  toSectionId: string,
  beforeChannelId?: number
): ChannelSection[] {
  return sections.map(section => {
    if (section.id !== toSectionId) {
      return section;
    }
    if (beforeChannelId === channelId) {
      return section;
    }
    const updated = section.channelIds.filter(id => id !== channelId);
    const insertAt = beforeChannelId ? updated.indexOf(beforeChannelId) : -1;
    if (insertAt >= 0) {
      updated.splice(insertAt, 0, channelId);
    } else {
      updated.push(channelId);
    }
    return { ...section, channelIds: updated };
  });
}

function removeChannelFromSection(
  sections: ChannelSection[],
  channelId: number,
  sectionId: string
): ChannelSection[] {
  return sections.map(section => {
    if (section.id !== sectionId) {
      return section;
    }
    return { ...section, channelIds: section.channelIds.filter(id => id !== channelId) };
  });
}

// Tests
describe('clamp', () => {
  it('returns 0 for NaN', () => {
    expect(clamp(NaN)).toBe(0);
  });

  it('clamps negative values to 0', () => {
    expect(clamp(-1)).toBe(0);
    expect(clamp(-0.5)).toBe(0);
    expect(clamp(-100)).toBe(0);
  });

  it('clamps values above 1 to 1', () => {
    expect(clamp(1.1)).toBe(1);
    expect(clamp(2)).toBe(1);
    expect(clamp(100)).toBe(1);
  });

  it('returns value unchanged if in range', () => {
    expect(clamp(0)).toBe(0);
    expect(clamp(0.5)).toBe(0.5);
    expect(clamp(1)).toBe(1);
    expect(clamp(0.001)).toBe(0.001);
    expect(clamp(0.999)).toBe(0.999);
  });
});

describe('faderToDb', () => {
  it('returns -60 for zero', () => {
    expect(faderToDb(0)).toBe(-60);
  });

  it('returns -60 for values at threshold', () => {
    expect(faderToDb(0.0001)).toBe(-60);
    expect(faderToDb(0.00001)).toBe(-60);
  });

  it('returns 0 for fader at 1', () => {
    expect(faderToDb(1)).toBe(0);
  });

  it('calculates correct dB values', () => {
    expect(faderToDb(0.5)).toBe(-30);
    expect(faderToDb(0.25)).toBe(-45);
    expect(faderToDb(0.75)).toBe(-15);
  });

  it('handles values just above threshold', () => {
    expect(faderToDb(0.0002)).toBeCloseTo(-59.988, 2);
  });
});

describe('dbToFader', () => {
  it('returns 0 for -60 dB', () => {
    expect(dbToFader(-60)).toBe(0);
  });

  it('returns 1 for 0 dB', () => {
    expect(dbToFader(0)).toBe(1);
  });

  it('clamps values below -60', () => {
    expect(dbToFader(-70)).toBe(0);
    expect(dbToFader(-100)).toBe(0);
  });

  it('clamps values above 0', () => {
    expect(dbToFader(10)).toBe(1);
    expect(dbToFader(100)).toBe(1);
  });

  it('calculates correct fader values', () => {
    expect(dbToFader(-30)).toBe(0.5);
    expect(dbToFader(-45)).toBe(0.25);
    expect(dbToFader(-15)).toBe(0.75);
  });

  it('is inverse of faderToDb', () => {
    const testValues = [0.1, 0.25, 0.5, 0.75, 0.9, 1];
    testValues.forEach(fader => {
      const db = faderToDb(fader);
      const backToFader = dbToFader(db);
      expect(backToFader).toBeCloseTo(fader, 5);
    });
  });
});

describe('isMinusInf', () => {
  it('returns true for zero', () => {
    expect(isMinusInf(0)).toBe(true);
  });

  it('returns true for values at threshold', () => {
    expect(isMinusInf(0.0001)).toBe(true);
    expect(isMinusInf(0.00001)).toBe(true);
  });

  it('returns false for values above threshold', () => {
    expect(isMinusInf(0.001)).toBe(false);
    expect(isMinusInf(0.5)).toBe(false);
    expect(isMinusInf(1)).toBe(false);
  });
});

describe('normalizeMixName', () => {
  it('converts to lowercase', () => {
    expect(normalizeMixName('MASTER')).toBe('master');
    expect(normalizeMixName('Aux1')).toBe('aux1');
  });

  it('trims whitespace', () => {
    expect(normalizeMixName('  master  ')).toBe('master');
  });

  it('removes special characters', () => {
    expect(normalizeMixName('aux-1')).toBe('aux1');
    expect(normalizeMixName('aux_1')).toBe('aux1');
    expect(normalizeMixName('aux.1')).toBe('aux1');
    expect(normalizeMixName('aux!@#$%1')).toBe('aux1');
  });

  it('keeps alphanumeric characters', () => {
    expect(normalizeMixName('wedge1')).toBe('wedge1');
    expect(normalizeMixName('IEM2')).toBe('iem2');
  });

  it('returns empty string for only special chars', () => {
    expect(normalizeMixName('!@#$%')).toBe('');
    expect(normalizeMixName('   ')).toBe('');
  });
});

describe('resolveMixTarget', () => {
  const mockAuxBuses: AuxBusState[] = [
    { id: 1, name: 'Wedge 1', lastUpdatedAt: '' },
    { id: 2, name: 'Wedge 2', lastUpdatedAt: '' },
    { id: 3, name: 'IEM 1', lastUpdatedAt: '' },
    { id: 4, name: 'Drummer', lastUpdatedAt: '' },
  ];

  describe('master bus', () => {
    it('resolves "main" to master', () => {
      expect(resolveMixTarget('main', mockAuxBuses)).toEqual({ type: 'master', id: 0 });
    });

    it('resolves "master" to master', () => {
      expect(resolveMixTarget('master', mockAuxBuses)).toEqual({ type: 'master', id: 0 });
    });

    it('resolves "mainmix" to master', () => {
      expect(resolveMixTarget('mainmix', mockAuxBuses)).toEqual({ type: 'master', id: 0 });
    });

    it('resolves "mix" to master', () => {
      expect(resolveMixTarget('mix', mockAuxBuses)).toEqual({ type: 'master', id: 0 });
    });

    it('is case insensitive', () => {
      expect(resolveMixTarget('MASTER', mockAuxBuses)).toEqual({ type: 'master', id: 0 });
      expect(resolveMixTarget('Main', mockAuxBuses)).toEqual({ type: 'master', id: 0 });
    });
  });

  describe('gain bus', () => {
    it('resolves "gain" to gain', () => {
      expect(resolveMixTarget('gain', mockAuxBuses)).toEqual({ type: 'gain', id: 0 });
    });

    it('resolves "preamp" to gain', () => {
      expect(resolveMixTarget('preamp', mockAuxBuses)).toEqual({ type: 'gain', id: 0 });
    });

    it('resolves "preamps" to gain', () => {
      expect(resolveMixTarget('preamps', mockAuxBuses)).toEqual({ type: 'gain', id: 0 });
    });
  });

  describe('aux bus by number', () => {
    it('resolves "aux1" format', () => {
      expect(resolveMixTarget('aux1', mockAuxBuses)).toEqual({ type: 'aux', id: 1 });
      expect(resolveMixTarget('aux5', mockAuxBuses)).toEqual({ type: 'aux', id: 5 });
    });

    it('resolves "aux01" format with leading zeros', () => {
      expect(resolveMixTarget('aux01', mockAuxBuses)).toEqual({ type: 'aux', id: 1 });
      expect(resolveMixTarget('aux001', mockAuxBuses)).toEqual({ type: 'aux', id: 1 });
    });

    it('resolves "aux1mix" format', () => {
      expect(resolveMixTarget('aux1mix', mockAuxBuses)).toEqual({ type: 'aux', id: 1 });
      expect(resolveMixTarget('aux01mix', mockAuxBuses)).toEqual({ type: 'aux', id: 1 });
    });

    it('handles double-digit aux numbers', () => {
      expect(resolveMixTarget('aux10', mockAuxBuses)).toEqual({ type: 'aux', id: 10 });
    });
  });

  describe('aux bus by name', () => {
    it('resolves by aux bus name', () => {
      expect(resolveMixTarget('wedge1', mockAuxBuses)).toEqual({ type: 'aux', id: 1 });
      expect(resolveMixTarget('drummer', mockAuxBuses)).toEqual({ type: 'aux', id: 4 });
    });

    it('is case insensitive', () => {
      expect(resolveMixTarget('DRUMMER', mockAuxBuses)).toEqual({ type: 'aux', id: 4 });
      expect(resolveMixTarget('IEM1', mockAuxBuses)).toEqual({ type: 'aux', id: 3 });
    });

    it('normalizes names for comparison', () => {
      expect(resolveMixTarget('Wedge 1', mockAuxBuses)).toEqual({ type: 'aux', id: 1 });
      expect(resolveMixTarget('iem-1', mockAuxBuses)).toEqual({ type: 'aux', id: 3 });
    });
  });

  describe('invalid inputs', () => {
    it('returns null for empty string', () => {
      expect(resolveMixTarget('', mockAuxBuses)).toBeNull();
    });

    it('returns null for only spaces', () => {
      expect(resolveMixTarget('   ', mockAuxBuses)).toBeNull();
    });

    it('returns null for unknown mix name', () => {
      expect(resolveMixTarget('unknown', mockAuxBuses)).toBeNull();
    });

    it('returns null for invalid aux format', () => {
      expect(resolveMixTarget('auxx1', mockAuxBuses)).toBeNull();
    });
  });
});

describe('getGroupKey', () => {
  it('generates key for aux bus', () => {
    expect(getGroupKey('aux', 3, 'local', 'section1')).toBe('aux:3:local:section1');
    expect(getGroupKey('aux', 1, 'global', 'drums')).toBe('aux:1:global:drums');
  });

  it('generates key for master bus', () => {
    expect(getGroupKey('master', 0, 'local', 'section1')).toBe('view:master:local:section1');
  });

  it('generates key for gain bus', () => {
    expect(getGroupKey('gain', 0, 'global', 'group1')).toBe('view:gain:global:group1');
  });
});

describe('buildDefaultLayout', () => {
  it('creates two sections', () => {
    const layout = buildDefaultLayout([1, 2, 3]);
    expect(layout).toHaveLength(2);
  });

  it('creates favorites section first', () => {
    const layout = buildDefaultLayout([1, 2, 3]);
    expect(layout[0].id).toBe('favorites');
    expect(layout[0].name).toBe('My Channels');
    expect(layout[0].channelIds).toEqual([]);
  });

  it('creates others section with all channels', () => {
    const layout = buildDefaultLayout([1, 2, 3]);
    expect(layout[1].id).toBe('others');
    expect(layout[1].name).toBe('Other');
    expect(layout[1].channelIds).toEqual([1, 2, 3]);
  });

  it('handles empty channel list', () => {
    const layout = buildDefaultLayout([]);
    expect(layout[0].channelIds).toEqual([]);
    expect(layout[1].channelIds).toEqual([]);
  });

  it('sets default offsetDb and mode', () => {
    const layout = buildDefaultLayout([1]);
    expect(layout[0].offsetDb).toBe(0);
    expect(layout[0].mode).toBe('ignore-inf');
  });
});

describe('normalizeLayout', () => {
  const channelIds = [1, 2, 3, 4, 5];

  it('returns default layout for empty channels', () => {
    const result = normalizeLayout([], []);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('favorites');
    expect(result[1].id).toBe('others');
  });

  it('ensures favorites section exists', () => {
    const sections: ChannelSection[] = [
      { id: 'custom', name: 'Custom', channelIds: [1, 2] },
    ];
    const result = normalizeLayout(sections, channelIds);

    expect(result.find(s => s.id === 'favorites')).toBeDefined();
  });

  it('ensures others section exists', () => {
    const sections: ChannelSection[] = [
      { id: 'favorites', name: 'My Channels', channelIds: [1] },
    ];
    const result = normalizeLayout(sections, channelIds);

    expect(result.find(s => s.id === 'others')).toBeDefined();
  });

  it('filters out invalid channel IDs', () => {
    const sections: ChannelSection[] = [
      { id: 'favorites', name: 'My Channels', channelIds: [1, 99, 100] },
    ];
    const result = normalizeLayout(sections, channelIds);

    expect(result[0].channelIds).toEqual([1]);
  });

  it('deduplicates channel IDs within sections', () => {
    const sections: ChannelSection[] = [
      { id: 'favorites', name: 'My Channels', channelIds: [1, 1, 2, 2, 3] },
    ];
    const result = normalizeLayout(sections, channelIds);

    expect(result[0].channelIds).toEqual([1, 2, 3]);
  });

  it('puts remaining channels in others section', () => {
    const sections: ChannelSection[] = [
      { id: 'favorites', name: 'My Channels', channelIds: [1, 2] },
    ];
    const result = normalizeLayout(sections, channelIds);
    const others = result.find(s => s.id === 'others')!;

    expect(others.channelIds).toEqual([3, 4, 5]);
  });

  it('preserves custom section order', () => {
    const sections: ChannelSection[] = [
      { id: 'favorites', name: 'My Channels', channelIds: [] },
      { id: 'drums', name: 'Drums', channelIds: [1, 2] },
      { id: 'vocals', name: 'Vocals', channelIds: [3] },
      { id: 'others', name: 'Other', channelIds: [] },
    ];
    const result = normalizeLayout(sections, channelIds);

    expect(result[0].id).toBe('favorites');
    expect(result[1].id).toBe('drums');
    expect(result[2].id).toBe('vocals');
    expect(result[result.length - 1].id).toBe('others');
  });

  it('defaults mode to ignore-inf for invalid modes', () => {
    const sections: ChannelSection[] = [
      { id: 'custom', name: 'Custom', channelIds: [1], mode: 'invalid' as any },
    ];
    const result = normalizeLayout(sections, channelIds);
    const custom = result.find(s => s.id === 'custom')!;

    expect(custom.mode).toBe('ignore-inf');
  });

  it('preserves valid mode values', () => {
    const sections: ChannelSection[] = [
      { id: 'custom1', name: 'Custom 1', channelIds: [1], mode: 'ignore-inf' },
      { id: 'custom2', name: 'Custom 2', channelIds: [2], mode: 'ignore-inf-sends' },
    ];
    const result = normalizeLayout(sections, channelIds);

    expect(result.find(s => s.id === 'custom1')!.mode).toBe('ignore-inf');
    expect(result.find(s => s.id === 'custom2')!.mode).toBe('ignore-inf-sends');
  });
});

describe('normalizeGlobalGroups', () => {
  const channelIds = [1, 2, 3, 4, 5];

  it('filters out invalid channel IDs', () => {
    const groups: GlobalGroup[] = [
      { id: 'drums', name: 'Drums', channelIds: [1, 2, 99, 100] },
    ];
    const result = normalizeGlobalGroups(groups, channelIds);

    expect(result[0].channelIds).toEqual([1, 2]);
  });

  it('deduplicates channel IDs', () => {
    const groups: GlobalGroup[] = [
      { id: 'drums', name: 'Drums', channelIds: [1, 1, 2, 2, 3] },
    ];
    const result = normalizeGlobalGroups(groups, channelIds);

    expect(result[0].channelIds).toEqual([1, 2, 3]);
  });

  it('deduplicates groups by ID', () => {
    const groups: GlobalGroup[] = [
      { id: 'drums', name: 'Drums 1', channelIds: [1] },
      { id: 'drums', name: 'Drums 2', channelIds: [2] },
    ];
    const result = normalizeGlobalGroups(groups, channelIds);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Drums 1');
    expect(result[0].channelIds).toEqual([1]);
  });

  it('uses id as name if name is missing', () => {
    const groups: GlobalGroup[] = [
      { id: 'drums', name: '', channelIds: [1] },
    ];
    const result = normalizeGlobalGroups(groups, channelIds);

    expect(result[0].name).toBe('drums');
  });

  it('filters out groups with empty id', () => {
    const groups: GlobalGroup[] = [
      { id: '', name: 'No ID', channelIds: [1] },
      { id: 'valid', name: 'Valid', channelIds: [2] },
    ];
    const result = normalizeGlobalGroups(groups, channelIds);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('valid');
  });

  it('handles empty groups array', () => {
    const result = normalizeGlobalGroups([], channelIds);
    expect(result).toEqual([]);
  });
});

describe('normalizeGlobalSettings', () => {
  it('normalizes valid settings', () => {
    const settings: Record<string, GlobalGroupSettings> = {
      group1: { offsetDb: 5, mode: 'ignore-inf', enabled: true },
    };
    const result = normalizeGlobalSettings(settings);

    expect(result.group1).toEqual({ offsetDb: 5, mode: 'ignore-inf', enabled: true });
  });

  it('defaults offsetDb to 0 for invalid values', () => {
    const settings: Record<string, GlobalGroupSettings> = {
      group1: { offsetDb: NaN, mode: 'ignore-inf', enabled: true },
      group2: { offsetDb: Infinity, mode: 'ignore-inf', enabled: true },
    };
    const result = normalizeGlobalSettings(settings);

    expect(result.group1.offsetDb).toBe(0);
    expect(result.group2.offsetDb).toBe(0);
  });

  it('defaults mode to ignore-inf for invalid values', () => {
    const settings: Record<string, GlobalGroupSettings> = {
      group1: { offsetDb: 0, mode: 'invalid' as any, enabled: true },
    };
    const result = normalizeGlobalSettings(settings);

    expect(result.group1.mode).toBe('ignore-inf');
  });

  it('defaults enabled to false', () => {
    const settings: Record<string, GlobalGroupSettings> = {
      group1: { offsetDb: 0, mode: 'ignore-inf' },
    };
    const result = normalizeGlobalSettings(settings);

    expect(result.group1.enabled).toBe(false);
  });

  it('preserves valid mode values', () => {
    const settings: Record<string, GlobalGroupSettings> = {
      group1: { offsetDb: 0, mode: 'ignore-inf-sends', enabled: false },
    };
    const result = normalizeGlobalSettings(settings);

    expect(result.group1.mode).toBe('ignore-inf-sends');
  });

  it('handles null/undefined input', () => {
    const result = normalizeGlobalSettings(null as any);
    expect(result).toEqual({});
  });

  it('filters out empty group IDs', () => {
    const settings: Record<string, GlobalGroupSettings> = {
      '': { offsetDb: 0, mode: 'ignore-inf', enabled: true },
      valid: { offsetDb: 0, mode: 'ignore-inf', enabled: true },
    };
    const result = normalizeGlobalSettings(settings);

    expect(result['']).toBeUndefined();
    expect(result.valid).toBeDefined();
  });
});

describe('layoutsEqual', () => {
  it('returns true for identical layouts', () => {
    const layout: ChannelSection[] = [
      { id: 'favorites', name: 'My Channels', channelIds: [1, 2] },
    ];
    expect(layoutsEqual(layout, layout)).toBe(true);
  });

  it('returns true for equivalent layouts', () => {
    const a: ChannelSection[] = [
      { id: 'favorites', name: 'My Channels', channelIds: [1, 2], offsetDb: 0 },
    ];
    const b: ChannelSection[] = [
      { id: 'favorites', name: 'My Channels', channelIds: [1, 2], offsetDb: 0 },
    ];
    expect(layoutsEqual(a, b)).toBe(true);
  });

  it('returns false for different lengths', () => {
    const a: ChannelSection[] = [
      { id: 'favorites', name: 'My Channels', channelIds: [1] },
    ];
    const b: ChannelSection[] = [
      { id: 'favorites', name: 'My Channels', channelIds: [1] },
      { id: 'others', name: 'Other', channelIds: [2] },
    ];
    expect(layoutsEqual(a, b)).toBe(false);
  });

  it('returns false for different section IDs', () => {
    const a: ChannelSection[] = [
      { id: 'favorites', name: 'My Channels', channelIds: [1] },
    ];
    const b: ChannelSection[] = [
      { id: 'custom', name: 'My Channels', channelIds: [1] },
    ];
    expect(layoutsEqual(a, b)).toBe(false);
  });

  it('returns false for different section names', () => {
    const a: ChannelSection[] = [
      { id: 'favorites', name: 'My Channels', channelIds: [1] },
    ];
    const b: ChannelSection[] = [
      { id: 'favorites', name: 'Different Name', channelIds: [1] },
    ];
    expect(layoutsEqual(a, b)).toBe(false);
  });

  it('returns false for different channel IDs', () => {
    const a: ChannelSection[] = [
      { id: 'favorites', name: 'My Channels', channelIds: [1, 2] },
    ];
    const b: ChannelSection[] = [
      { id: 'favorites', name: 'My Channels', channelIds: [1, 3] },
    ];
    expect(layoutsEqual(a, b)).toBe(false);
  });

  it('returns false for different channel order', () => {
    const a: ChannelSection[] = [
      { id: 'favorites', name: 'My Channels', channelIds: [1, 2] },
    ];
    const b: ChannelSection[] = [
      { id: 'favorites', name: 'My Channels', channelIds: [2, 1] },
    ];
    expect(layoutsEqual(a, b)).toBe(false);
  });

  it('returns false for different offsetDb', () => {
    const a: ChannelSection[] = [
      { id: 'favorites', name: 'My Channels', channelIds: [1], offsetDb: 0 },
    ];
    const b: ChannelSection[] = [
      { id: 'favorites', name: 'My Channels', channelIds: [1], offsetDb: 5 },
    ];
    expect(layoutsEqual(a, b)).toBe(false);
  });

  it('handles undefined offsetDb as 0', () => {
    const a: ChannelSection[] = [
      { id: 'favorites', name: 'My Channels', channelIds: [1], offsetDb: 0 },
    ];
    const b: ChannelSection[] = [
      { id: 'favorites', name: 'My Channels', channelIds: [1] },
    ];
    expect(layoutsEqual(a, b)).toBe(true);
  });

  it('returns true for empty arrays', () => {
    expect(layoutsEqual([], [])).toBe(true);
  });
});

describe('makeSectionId', () => {
  it('converts name to lowercase kebab-case', () => {
    const existing = new Set<string>();
    expect(makeSectionId('My Section', existing)).toBe('my-section');
  });

  it('removes special characters', () => {
    const existing = new Set<string>();
    expect(makeSectionId('Section!@#$%', existing)).toBe('section');
  });

  it('handles leading/trailing dashes', () => {
    const existing = new Set<string>();
    expect(makeSectionId('---Section---', existing)).toBe('section');
  });

  it('uses "section" for empty name', () => {
    const existing = new Set<string>();
    expect(makeSectionId('', existing)).toBe('section');
  });

  it('adds suffix for collisions', () => {
    const existing = new Set(['drums']);
    expect(makeSectionId('Drums', existing)).toBe('drums-1');
  });

  it('increments suffix for multiple collisions', () => {
    const existing = new Set(['drums', 'drums-1', 'drums-2']);
    expect(makeSectionId('Drums', existing)).toBe('drums-3');
  });

  it('handles empty name collisions', () => {
    const existing = new Set(['section', 'section-1']);
    expect(makeSectionId('', existing)).toBe('section-2');
  });
});

describe('upsertChannelInSection', () => {
  const baseSections: ChannelSection[] = [
    { id: 'section1', name: 'Section 1', channelIds: [1, 2, 3] },
    { id: 'section2', name: 'Section 2', channelIds: [4, 5, 6] },
  ];

  it('adds channel to end of section', () => {
    const result = upsertChannelInSection(baseSections, 10, 'section1');
    expect(result[0].channelIds).toEqual([1, 2, 3, 10]);
  });

  it('inserts channel before specific channel', () => {
    const result = upsertChannelInSection(baseSections, 10, 'section1', 2);
    expect(result[0].channelIds).toEqual([1, 10, 2, 3]);
  });

  it('moves existing channel within section', () => {
    const result = upsertChannelInSection(baseSections, 3, 'section1', 1);
    expect(result[0].channelIds).toEqual([3, 1, 2]);
  });

  it('does not modify other sections', () => {
    const result = upsertChannelInSection(baseSections, 10, 'section1');
    expect(result[1].channelIds).toEqual([4, 5, 6]);
  });

  it('returns unchanged section if beforeChannelId equals channelId', () => {
    const result = upsertChannelInSection(baseSections, 2, 'section1', 2);
    expect(result[0].channelIds).toEqual([1, 2, 3]);
  });

  it('adds to end if beforeChannelId not found', () => {
    const result = upsertChannelInSection(baseSections, 10, 'section1', 99);
    expect(result[0].channelIds).toEqual([1, 2, 3, 10]);
  });
});

describe('removeChannelFromSection', () => {
  const baseSections: ChannelSection[] = [
    { id: 'section1', name: 'Section 1', channelIds: [1, 2, 3] },
    { id: 'section2', name: 'Section 2', channelIds: [4, 5, 6] },
  ];

  it('removes channel from section', () => {
    const result = removeChannelFromSection(baseSections, 2, 'section1');
    expect(result[0].channelIds).toEqual([1, 3]);
  });

  it('does not modify other sections', () => {
    const result = removeChannelFromSection(baseSections, 2, 'section1');
    expect(result[1].channelIds).toEqual([4, 5, 6]);
  });

  it('handles removing non-existent channel', () => {
    const result = removeChannelFromSection(baseSections, 99, 'section1');
    expect(result[0].channelIds).toEqual([1, 2, 3]);
  });

  it('handles non-existent section', () => {
    const result = removeChannelFromSection(baseSections, 1, 'nonexistent');
    expect(result).toEqual(baseSections);
  });
});
