import fs from 'fs/promises';
import path from 'path';

export type LayoutSection = {
  id: string;
  name: string;
  channelIds: number[];
  offsetDb?: number;
  mode?: 'default' | 'ignore-inf' | 'ignore-inf-sends';
  enabled?: boolean;
};

export type GlobalGroup = {
  id: string;
  name: string;
  channelIds: number[];
};

export type GroupSettings = {
  offsetDb?: number;
  mode?: 'default' | 'ignore-inf' | 'ignore-inf-sends';
  enabled?: boolean;
};

export type MixOrderItem =
  | { kind: 'group'; groupType: 'local' | 'global'; id: string }
  | { kind: 'channel'; id: number };

export type ViewSettings = {
  offsetDb?: number;
  simpleControls?: boolean;
  mixOrder?: MixOrderItem[];
};

type LayoutData = {
  version: 2;
  aux: Record<string, LayoutSection[]>;
  globalGroups: GlobalGroup[];
  globalSettings: {
    master: Record<string, GroupSettings>;
    gain: Record<string, GroupSettings>;
    aux: Record<string, Record<string, GroupSettings>>;
  };
  viewSettings: {
    master: ViewSettings;
    gain: ViewSettings;
    aux: Record<string, ViewSettings>;
  };
};

const FAVORITES_ID = 'favorites';
const OTHERS_ID = 'others';

function normalizeSections(
  sections: LayoutSection[],
  channelIds: number[]
): LayoutSection[] {
  const allowed = new Set(channelIds);
  const byId = new Map<string, LayoutSection>();

  sections.forEach(section => {
    if (!section.id || byId.has(section.id)) {
      return;
    }
    const nameOverride = section.id === FAVORITES_ID ? 'My Channels' : section.name || section.id;
    const offsetDb =
      typeof section.offsetDb === 'number' && Number.isFinite(section.offsetDb)
        ? section.offsetDb
        : 0;
    const mode =
      section.mode === 'ignore-inf' || section.mode === 'ignore-inf-sends'
        ? section.mode
        : 'ignore-inf';
    const enabled = typeof section.enabled === 'boolean' ? section.enabled : true;
    byId.set(section.id, {
      id: section.id,
      name: nameOverride,
      channelIds: Array.isArray(section.channelIds) ? section.channelIds.slice() : [],
      offsetDb,
      mode,
      enabled,
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

  const ordered: LayoutSection[] = [];
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
    const channelIds = Array.isArray(group.channelIds) ? group.channelIds.slice() : [];
    const cleaned = channelIds.filter((id, index, list) => {
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

function normalizeSettings(settings: Record<string, GroupSettings>) {
  const entries = Object.entries(settings ?? {});
  const normalized: Record<string, GroupSettings> = {};
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

function normalizeMixOrder(items: MixOrderItem[] | undefined) {
  if (!Array.isArray(items)) {
    return [];
  }
  const next: MixOrderItem[] = [];
  const seen = new Set<string>();
  items.forEach(item => {
    if (item.kind === 'group' && item.id && (item.groupType === 'local' || item.groupType === 'global')) {
      const key = `group:${item.groupType}:${item.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        next.push({ kind: 'group', groupType: item.groupType, id: item.id });
      }
      return;
    }
    if (item.kind === 'channel' && Number.isInteger(item.id)) {
      const key = `channel:${item.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        next.push({ kind: 'channel', id: item.id });
      }
    }
  });
  return next;
}

function normalizeViewSettings(settings: ViewSettings | undefined) {
  const offsetDb =
    typeof settings?.offsetDb === 'number' && Number.isFinite(settings.offsetDb)
      ? settings.offsetDb
      : 0;
  const simpleControls = typeof settings?.simpleControls === 'boolean' ? settings.simpleControls : false;
  const mixOrder = normalizeMixOrder(settings?.mixOrder);
  return { offsetDb, simpleControls, mixOrder };
}

export class LayoutStore {
  private data: LayoutData;
  private filePath: string;
  private fallbackPath?: string;
  private channelIds: number[];
  private auxBusIds: number[];

  constructor(filePath: string, channelIds: number[], auxBusIds: number[], fallbackPath?: string) {
    this.filePath = filePath;
    this.fallbackPath = fallbackPath;
    this.channelIds = channelIds;
    this.auxBusIds = auxBusIds;
    this.data = this.createDefaultData();
  }

  async load() {
    try {
      const parsed = await this.readData(this.filePath);
      if (this.applyParsedData(parsed)) {
        return;
      }
    } catch {
      // Fall through to fallback/default handling.
    }

    if (this.fallbackPath) {
      try {
        const fallback = await this.readData(this.fallbackPath);
        if (this.applyParsedData(fallback)) {
          await this.save();
          return;
        }
      } catch {
        // Ignore fallback failures and use defaults.
      }
    }

    this.data = this.createDefaultData();
  }

  getAuxLayout(busId: number): LayoutSection[] {
    if (!this.auxBusIds.includes(busId)) {
      return normalizeSections([], this.channelIds);
    }
    const existing = this.data.aux[String(busId)] ?? [];
    return normalizeSections(existing, this.channelIds);
  }

  getGlobalGroups() {
    return normalizeGlobalGroups(this.data.globalGroups ?? [], this.channelIds);
  }

  getGlobalSettings(busType: 'master' | 'gain' | 'aux', busId?: number) {
    if (busType === 'aux' && busId) {
      const settings = this.data.globalSettings.aux[String(busId)] ?? {};
      return normalizeSettings(settings);
    }
    const settings = this.data.globalSettings[busType] ?? {};
    return normalizeSettings(settings);
  }

  getViewSettings(busType: 'master' | 'gain' | 'aux', busId?: number) {
    if (busType === 'aux' && busId) {
      const settings = this.data.viewSettings.aux[String(busId)];
      return normalizeViewSettings(settings);
    }
    return normalizeViewSettings(this.data.viewSettings[busType]);
  }

  async setAuxLayout(busId: number, sections: LayoutSection[]) {
    if (!this.auxBusIds.includes(busId)) {
      return;
    }
    this.data.aux[String(busId)] = normalizeSections(sections, this.channelIds);
    await this.save();
  }

  async setGlobalGroups(groups: GlobalGroup[]) {
    this.data.globalGroups = normalizeGlobalGroups(groups, this.channelIds);
    await this.save();
  }

  async setGlobalSettings(busType: 'master' | 'gain' | 'aux', settings: Record<string, GroupSettings>, busId?: number) {
    if (busType === 'aux') {
      if (!busId || !this.auxBusIds.includes(busId)) {
        return;
      }
      this.data.globalSettings.aux[String(busId)] = normalizeSettings(settings);
      await this.save();
      return;
    }
    this.data.globalSettings[busType] = normalizeSettings(settings);
    await this.save();
  }

  async setViewSettings(busType: 'master' | 'gain' | 'aux', settings: ViewSettings, busId?: number) {
    if (busType === 'aux') {
      if (!busId || !this.auxBusIds.includes(busId)) {
        return;
      }
      this.data.viewSettings.aux[String(busId)] = normalizeViewSettings(settings);
      await this.save();
      return;
    }
    this.data.viewSettings[busType] = normalizeViewSettings(settings);
    await this.save();
  }

  private async save() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
  }

  private createDefaultData(): LayoutData {
    return {
      version: 2,
      aux: {},
      globalGroups: [],
      globalSettings: { master: {}, gain: {}, aux: {} },
      viewSettings: {
        master: { offsetDb: 0, simpleControls: false },
        gain: { offsetDb: 0, simpleControls: false },
        aux: {},
      },
    };
  }

  private async readData(filePath: string): Promise<LayoutData> {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as LayoutData;
  }

  private applyParsedData(parsed: LayoutData) {
    if (!parsed || !parsed.aux) {
      return false;
    }
    this.data = {
      version: 2,
      aux: parsed.aux ?? {},
      globalGroups: parsed.globalGroups ?? [],
      globalSettings: parsed.globalSettings ?? { master: {}, gain: {}, aux: {} },
      viewSettings:
        parsed.viewSettings ?? {
          master: { offsetDb: 0, simpleControls: false },
          gain: { offsetDb: 0, simpleControls: false },
          aux: {},
        },
    };
    return true;
  }
}
