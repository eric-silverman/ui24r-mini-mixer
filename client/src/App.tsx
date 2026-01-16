import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, HTMLAttributes } from 'react';
import ChannelStrip from './components/ChannelStrip';
import VGroupStrip from './components/VGroupStrip';
import ConnectionPill from './components/ConnectionPill';
import ChannelMinimap from './components/ChannelMinimap';
import { connectMixer, fetchState, setFader, setMute, setSolo } from './lib/api';
import { throttle } from './lib/debounce';
import { fetchLayout, saveLayout } from './lib/layout';
import { buildSampleState } from './lib/sampleData';
import { connectWs } from './lib/ws';
import type {
  AppState,
  BusType,
  ChannelState,
  ChannelSection,
  GlobalGroup,
  GlobalGroupSettings,
  MixOrderItem,
  ViewSettings,
  WsMessage,
} from './lib/types';

const EMPTY_STATE: AppState = {
  host: 'Not connected',
  connectionStatus: 'disconnected',
  bus: { type: 'master', id: 0 },
  auxBuses: [],
  channels: [],
};

const FAVORITES_ID = 'favorites';
const OTHERS_ID = 'others';
const VIEW_GROUP_PREFIX = 'view';
const GLOBAL_GROUP_PREFIX = 'global';
const THEME_KEY = 'ui24r-mini-mixer.theme';
const STYLE_KEY = 'ui24r-mini-mixer.style';
const ASSIGNED_AUX_KEY = 'ui24r-mini-mixer.assignedAux';

type MixerStyle = 'broadcast';
type MixGroup = {
  id: string;
  name: string;
  channelIds: number[];
  channels: ChannelState[];
  groupType: 'local' | 'global';
  offsetDb?: number;
  mode?: ChannelSection['mode'];
  settings?: GlobalGroupSettings;
};
type MixRowItem =
  | { kind: 'group'; group: MixGroup }
  | { kind: 'channel'; channel: ChannelState };

function clamp(value: number) {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function faderToDb(value: number) {
  if (value <= 0.0001) {
    return -60;
  }
  return value * 60 - 60;
}

function dbToFader(value: number) {
  const clamped = Math.max(-60, Math.min(0, value));
  return (clamped + 60) / 60;
}

function isMinusInf(value: number) {
  return value <= 0.0001;
}

function getInitialMixName() {
  if (typeof window === 'undefined') {
    return null;
  }
  const segment = window.location.pathname.split('/').filter(Boolean)[0];
  if (!segment) {
    return null;
  }
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function normalizeMixName(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '');
}

function resolveMixTarget(requested: string, auxBuses: AppState['auxBuses']) {
  const normalized = normalizeMixName(requested);
  if (!normalized) {
    return null;
  }
  if (['main', 'master', 'mainmix', 'mix'].includes(normalized)) {
    return { type: 'master' as const, id: 0 };
  }
  if (['gain', 'preamp', 'preamps'].includes(normalized)) {
    return { type: 'gain' as const, id: 0 };
  }
  const auxMatch = normalized.match(/^aux0*(\d+)$/) ?? normalized.match(/^aux0*(\d+)mix$/);
  if (auxMatch) {
    const id = Number(auxMatch[1]);
    if (Number.isFinite(id)) {
      return { type: 'aux' as const, id };
    }
  }
  const byName = auxBuses.find(
    aux => normalizeMixName(aux.name || `aux${aux.id}`) === normalized
  );
  if (byName) {
    return { type: 'aux' as const, id: byName.id };
  }
  return null;
}

function getGroupKey(busType: BusType, busId: number, groupType: string, groupId: string) {
  if (busType === 'aux') {
    return `aux:${busId}:${groupType}:${groupId}`;
  }
  return `${VIEW_GROUP_PREFIX}:${busType}:${groupType}:${groupId}`;
}

// Stereo AUX pair detection - linked buses have names ending in " L" and " R"
type AuxDisplayItem =
  | { type: 'mono'; aux: AuxBusState }
  | { type: 'stereo'; name: string; left: AuxBusState; right: AuxBusState };

function groupStereoAuxBuses(auxBuses: AuxBusState[]): AuxDisplayItem[] {
  const result: AuxDisplayItem[] = [];
  const processed = new Set<number>();

  for (const aux of auxBuses) {
    if (processed.has(aux.id)) continue;

    // Check if this is a left channel of a stereo pair
    if (aux.name.endsWith(' L')) {
      const baseName = aux.name.slice(0, -2);
      const rightBus = auxBuses.find(
        other => other.name === `${baseName} R` && !processed.has(other.id)
      );
      if (rightBus) {
        result.push({ type: 'stereo', name: baseName, left: aux, right: rightBus });
        processed.add(aux.id);
        processed.add(rightBus.id);
        continue;
      }
    }

    // Check if this is a right channel (in case R comes before L in the list)
    if (aux.name.endsWith(' R')) {
      const baseName = aux.name.slice(0, -2);
      const leftBus = auxBuses.find(
        other => other.name === `${baseName} L` && !processed.has(other.id)
      );
      if (leftBus) {
        result.push({ type: 'stereo', name: baseName, left: leftBus, right: aux });
        processed.add(aux.id);
        processed.add(leftBus.id);
        continue;
      }
    }

    // Mono bus
    result.push({ type: 'mono', aux });
    processed.add(aux.id);
  }

  return result;
}

function buildDefaultLayout(channelIds: number[]): ChannelSection[] {
  return [
    { id: FAVORITES_ID, name: 'Favorites', channelIds: [], offsetDb: 0, mode: 'ignore-inf' },
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
    const nameOverride = section.id === FAVORITES_ID ? 'Favorites' : section.name || section.id;
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
      name: 'Favorites',
      channelIds: [],
      offsetDb: 0,
      mode: 'ignore-inf',
      enabled: true,
    });
  }
  if (!byId.has(OTHERS_ID)) {
    byId.set(OTHERS_ID, {
      id: OTHERS_ID,
      name: 'All Channels',
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

  // All Channels section includes ALL channels, with favorites sorted to the front
  const favoriteIds = new Set(favorites.channelIds);
  const seen = new Set<number>();
  const nextOthers: number[] = [];

  // First, add favorites in their current order
  favorites.channelIds.forEach(id => {
    if (allowed.has(id) && !seen.has(id)) {
      seen.add(id);
      nextOthers.push(id);
    }
  });

  // Then add non-favorites in channel ID order (natural order)
  // This ensures unfavorited channels return to their original position
  channelIds.forEach(id => {
    if (!seen.has(id)) {
      seen.add(id);
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

function normalizeGlobalSettings(settings: Record<string, GlobalGroupSettings>) {
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

function layoutsEqual(a: ChannelSection[], b: ChannelSection[]) {
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

function makeSectionId(name: string, existing: Set<string>) {
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
) {
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
) {
  return sections.map(section => {
    if (section.id !== sectionId) {
      return section;
    }
    return { ...section, channelIds: section.channelIds.filter(id => id !== channelId) };
  });
}

export default function App() {
  const isDev = import.meta.env.DEV;
  const isDemo = import.meta.env.VITE_DEMO === 'true';
  // Use sample data when VITE_DEMO=true or when ?sample=true URL parameter is present
  // This allows demo mode in any build without loading sample data by default in dev
  const urlParams = new URLSearchParams(window.location.search);
  const urlSampleMode = urlParams.get('sample') === 'true' || urlParams.get('demo') === 'true';
  const shouldUseSampleData = isDemo || urlSampleMode;
  const appVersion = __APP_VERSION__.trim();
  const gitSha = __GIT_SHA__.trim();
  const versionLabel = appVersion
    ? appVersion.startsWith('v')
      ? appVersion
      : `v${appVersion}`
    : '';

  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [highlighted, setHighlighted] = useState<Record<number, boolean>>({});
  const [draggingChannelId, setDraggingChannelId] = useState<number | null>(null);
  const draggingIdRef = useRef<number | null>(null);
  const requestedMixRef = useRef<string | null>(getInitialMixName());
  const [activeBus, setActiveBus] = useState<{ type: BusType; id: number }>({
    type: 'master',
    id: 0,
  });
  const activeBusRef = useRef(activeBus);
  const [hostInput, setHostInput] = useState('');
  const [showConnect, setShowConnect] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showLocalGroupModal, setShowLocalGroupModal] = useState(false);
  const [localGroupName, setLocalGroupName] = useState('');
  const [localGroupSelection, setLocalGroupSelection] = useState<Set<number>>(new Set());
  const [connectError, setConnectError] = useState('');
  const [sampleMode, setSampleMode] = useState(shouldUseSampleData);
  const sampleModeInitializedRef = useRef(false);
  const [assignedAuxId, setAssignedAuxId] = useState<number | null>(() => {
    const stored = localStorage.getItem(ASSIGNED_AUX_KEY);
    if (!stored) {
      return null;
    }
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : null;
  });
  const [showAllAuxMixes, setShowAllAuxMixes] = useState(false);
  const [groupSpillState, setGroupSpillState] = useState<Record<string, boolean>>({});
  const [dropTarget, setDropTarget] = useState<{
    groupType: 'local' | 'global';
    groupId: string;
    channelId?: number;
    position: 'before' | 'end';
  } | null>(null);
  const [mixDropTarget, setMixDropTarget] = useState<{
    itemType: 'group' | 'channel' | 'slot';
    targetKey?: string;
    groupType?: 'local' | 'global';
    groupId?: string;
    channelId?: number;
    position: 'before' | 'end';
  } | null>(null);
  const [mixerStyle] = useState<MixerStyle>(() => {
    localStorage.setItem(STYLE_KEY, 'broadcast');
    return 'broadcast';
  });
  const [showVGroupAdmin, setShowVGroupAdmin] = useState(false);
  const [auxLayout, setAuxLayout] = useState<ChannelSection[]>([]);
  const [viewOffsets, setViewOffsets] = useState<Record<BusType, number>>({
    master: 0,
    aux: 0,
    gain: 0,
  });
  const [globalGroups, setGlobalGroups] = useState<GlobalGroup[]>([]);
  const [globalSettings, setGlobalSettings] = useState<Record<string, GlobalGroupSettings>>({});
  const [viewSettings, setViewSettings] = useState<{
    master: ViewSettings;
    gain: ViewSettings;
    aux: Record<number, ViewSettings>;
  }>({
    master: { offsetDb: 0, mixOrder: [] },
    gain: { offsetDb: 0, mixOrder: [] },
    aux: {},
  });
  const layoutLoadedRef = useRef(false);
  const layoutDirtyRef = useRef(false);
  const layoutSaveTimeoutRef = useRef<number | null>(null);
  const globalLoadedRef = useRef(false);
  const globalDirtyRef = useRef(false);
  const globalSaveTimeoutRef = useRef<number | null>(null);
  const globalSettingsDirtyRef = useRef(false);
  const globalSettingsSaveTimeoutRef = useRef<number | null>(null);
  const viewSettingsDirtyRef = useRef(false);
  const viewSettingsSaveTimeoutRef = useRef<number | null>(null);
  const viewSettingsDirtyKeyRef = useRef<{ type: BusType; id: number } | null>(null);
  const groupDragRef = useRef<{ groupType: 'local' | 'global'; groupId: string } | null>(null);
  const channelItemDragRef = useRef<{
    channelId: number;
    sourceGroupType?: 'local' | 'global';
    sourceGroupId?: string;
  } | null>(null);
  const groupRatiosRef = useRef<Record<string, Record<number, number>>>({});
  const skipRatioRef = useRef<Set<number>>(new Set());
  const mixBoardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeBusRef.current = activeBus;
  }, [activeBus]);

  useEffect(() => {
    // Automatically enable sample mode in dev or demo builds
    if (shouldUseSampleData && !sampleMode) {
      setSampleMode(true);
    }
  }, [shouldUseSampleData, sampleMode]);

  useEffect(() => {
    const requested = requestedMixRef.current;
    if (!requested) {
      return;
    }
    const resolved = resolveMixTarget(requested, state.auxBuses);
    if (!resolved) {
      return;
    }
    requestedMixRef.current = null;
    if (resolved.type === activeBus.type && resolved.id === activeBus.id) {
      return;
    }
    setActiveBus(resolved);
    setShowVGroupAdmin(false);
    setHighlighted({});
  }, [activeBus.id, activeBus.type, state.auxBuses]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem(THEME_KEY, 'dark');
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-style', 'broadcast');
    localStorage.setItem(STYLE_KEY, 'broadcast');
  }, []);

  useEffect(() => {
    if (assignedAuxId === null) {
      localStorage.removeItem(ASSIGNED_AUX_KEY);
      setShowAllAuxMixes(false);
      return;
    }
    localStorage.setItem(ASSIGNED_AUX_KEY, String(assignedAuxId));
    setShowAllAuxMixes(false);
  }, [assignedAuxId]);

  useEffect(() => {
    if (sampleMode) {
      // Only build sample state once initially, then let user changes persist
      if (!sampleModeInitializedRef.current) {
        setState(buildSampleState(activeBus.type, activeBus.id));
        sampleModeInitializedRef.current = true;
      } else {
        // Update busType on channels when switching buses in sample mode
        setState(current => ({
          ...current,
          bus: { type: activeBus.type, id: activeBus.id },
          channels: current.channels.map(channel => ({
            ...channel,
            busType: activeBus.type,
            bus: activeBus.id,
            // Solo is only supported on master bus
            solo: activeBus.type === 'master' ? channel.solo : undefined,
          })),
        }));
      }
      return;
    }
    fetchState(activeBus.type, activeBus.id)
      .then(next => setState(next))
      .catch(() => setState(EMPTY_STATE));
  }, [activeBus, sampleMode]);

  useEffect(() => {
    layoutLoadedRef.current = false;
    layoutDirtyRef.current = false;
    if (layoutSaveTimeoutRef.current) {
      window.clearTimeout(layoutSaveTimeoutRef.current);
      layoutSaveTimeoutRef.current = null;
    }
    globalLoadedRef.current = false;
    globalDirtyRef.current = false;
    globalSettingsDirtyRef.current = false;
    if (globalSaveTimeoutRef.current) {
      window.clearTimeout(globalSaveTimeoutRef.current);
      globalSaveTimeoutRef.current = null;
    }
    if (globalSettingsSaveTimeoutRef.current) {
      window.clearTimeout(globalSettingsSaveTimeoutRef.current);
      globalSettingsSaveTimeoutRef.current = null;
    }
    viewSettingsDirtyRef.current = false;
    viewSettingsDirtyKeyRef.current = null;
    if (viewSettingsSaveTimeoutRef.current) {
      window.clearTimeout(viewSettingsSaveTimeoutRef.current);
      viewSettingsSaveTimeoutRef.current = null;
    }

    fetchLayout(activeBus.type, activeBus.id, sampleMode)
      .then(payload => {
        setAuxLayout(activeBus.type === 'aux' ? payload.sections ?? [] : []);
        setGlobalGroups(payload.globalGroups ?? []);
        setGlobalSettings(payload.globalSettings ?? {});
        const nextViewSettings = payload.viewSettings ?? {
          offsetDb: 0,
          mixOrder: [],
        };
        if (activeBus.type === 'aux') {
          setViewSettings(current => ({
            ...current,
            aux: { ...current.aux, [activeBus.id]: nextViewSettings },
          }));
        } else {
          setViewSettings(current => ({ ...current, [activeBus.type]: nextViewSettings }));
          setViewOffsets(current => ({
            ...current,
            [activeBus.type]: nextViewSettings.offsetDb ?? 0,
          }));
        }
        layoutLoadedRef.current = true;
        globalLoadedRef.current = true;
      })
      .catch(() => {
        setAuxLayout([]);
        setGlobalGroups([]);
        setGlobalSettings({});
        layoutLoadedRef.current = true;
        globalLoadedRef.current = true;
      });
  }, [activeBus.type, activeBus.id, sampleMode]);

  const channelIds = useMemo(() => state.channels.map(channel => channel.id), [state.channels]);
  const normalizedLayout = useMemo(
    () => normalizeLayout(auxLayout, channelIds),
    [auxLayout, channelIds]
  );
  const normalizedGlobalGroups = useMemo(
    () => normalizeGlobalGroups(globalGroups, channelIds),
    [globalGroups, channelIds]
  );
  const normalizedGlobalSettings = useMemo(
    () => normalizeGlobalSettings(globalSettings),
    [globalSettings]
  );
  const getViewSettingsForBus = useCallback(
    (busType: BusType, busId: number) => {
      const fallback: ViewSettings = { offsetDb: 0, mixOrder: [] };
      if (busType === 'aux') {
        return viewSettings.aux[busId] ?? fallback;
      }
      return viewSettings[busType] ?? fallback;
    },
    [viewSettings]
  );

  useEffect(() => {
    if (activeBus.type !== 'aux' || !layoutLoadedRef.current) {
      return;
    }
    if (!layoutsEqual(auxLayout, normalizedLayout)) {
      setAuxLayout(normalizedLayout);
    }
  }, [activeBus.type, auxLayout, normalizedLayout]);

  useEffect(() => {
    if (!globalLoadedRef.current) {
      return;
    }
    if (globalGroups.length !== normalizedGlobalGroups.length) {
      setGlobalGroups(normalizedGlobalGroups);
      return;
    }
    const mismatch = normalizedGlobalGroups.some(group => {
      const current = globalGroups.find(item => item.id === group.id);
      if (!current) {
        return true;
      }
      if (current.name !== group.name) {
        return true;
      }
      if (current.channelIds.length !== group.channelIds.length) {
        return true;
      }
      return current.channelIds.some((id, index) => id !== group.channelIds[index]);
    });
    if (mismatch) {
      setGlobalGroups(normalizedGlobalGroups);
    }
  }, [globalGroups, normalizedGlobalGroups]);

  useEffect(() => {
    if (!globalLoadedRef.current) {
      return;
    }
    const keys = Object.keys(normalizedGlobalSettings);
    const currentKeys = Object.keys(globalSettings);
    if (keys.length !== currentKeys.length) {
      setGlobalSettings(normalizedGlobalSettings);
      return;
    }
    const mismatch = keys.some(key => {
      const current = globalSettings[key];
      const normalized = normalizedGlobalSettings[key];
      if (!current || !normalized) {
        return true;
      }
      return (
        (current.offsetDb ?? 0) !== (normalized.offsetDb ?? 0) ||
        (current.mode ?? 'ignore-inf') !== (normalized.mode ?? 'ignore-inf')
      );
    });
    if (mismatch) {
      setGlobalSettings(normalizedGlobalSettings);
    }
  }, [globalSettings, normalizedGlobalSettings]);

  useEffect(() => {
    if (activeBus.type !== 'aux' || !layoutLoadedRef.current || !layoutDirtyRef.current) {
      return;
    }
    if (layoutSaveTimeoutRef.current) {
      window.clearTimeout(layoutSaveTimeoutRef.current);
    }
    layoutSaveTimeoutRef.current = window.setTimeout(() => {
      saveLayout('aux', activeBus.id, { sections: normalizedLayout }, sampleMode).catch(
        () => undefined
      );
      layoutDirtyRef.current = false;
    }, 400);
    return () => {
      if (layoutSaveTimeoutRef.current) {
        window.clearTimeout(layoutSaveTimeoutRef.current);
        layoutSaveTimeoutRef.current = null;
      }
    };
  }, [activeBus.type, activeBus.id, normalizedLayout, sampleMode]);

  useEffect(() => {
    if (!globalLoadedRef.current || !globalDirtyRef.current) {
      return;
    }
    if (globalSaveTimeoutRef.current) {
      window.clearTimeout(globalSaveTimeoutRef.current);
    }
    globalSaveTimeoutRef.current = window.setTimeout(() => {
      saveLayout('master', undefined, { globalGroups }, sampleMode).catch(() => undefined);
      globalDirtyRef.current = false;
    }, 400);
    return () => {
      if (globalSaveTimeoutRef.current) {
        window.clearTimeout(globalSaveTimeoutRef.current);
        globalSaveTimeoutRef.current = null;
      }
    };
  }, [globalGroups, sampleMode]);

  useEffect(() => {
    if (!globalLoadedRef.current || !globalSettingsDirtyRef.current) {
      return;
    }
    if (globalSettingsSaveTimeoutRef.current) {
      window.clearTimeout(globalSettingsSaveTimeoutRef.current);
    }
    globalSettingsSaveTimeoutRef.current = window.setTimeout(() => {
      saveLayout(activeBus.type, activeBus.id, { globalSettings }, sampleMode).catch(
        () => undefined
      );
      globalSettingsDirtyRef.current = false;
    }, 400);
    return () => {
      if (globalSettingsSaveTimeoutRef.current) {
        window.clearTimeout(globalSettingsSaveTimeoutRef.current);
        globalSettingsSaveTimeoutRef.current = null;
      }
    };
  }, [activeBus.type, activeBus.id, globalSettings, sampleMode]);

  useEffect(() => {
    if (!globalLoadedRef.current || !viewSettingsDirtyRef.current) {
      return;
    }
    if (viewSettingsSaveTimeoutRef.current) {
      window.clearTimeout(viewSettingsSaveTimeoutRef.current);
    }
    const dirtyTarget = viewSettingsDirtyKeyRef.current ?? activeBus;
    viewSettingsSaveTimeoutRef.current = window.setTimeout(() => {
      const current = getViewSettingsForBus(dirtyTarget.type, dirtyTarget.id);
      if (current) {
        saveLayout(dirtyTarget.type, dirtyTarget.id, { viewSettings: current }, sampleMode).catch(
          () => undefined
        );
      }
      viewSettingsDirtyRef.current = false;
      viewSettingsDirtyKeyRef.current = null;
    }, 400);
    return () => {
      if (viewSettingsSaveTimeoutRef.current) {
        window.clearTimeout(viewSettingsSaveTimeoutRef.current);
        viewSettingsSaveTimeoutRef.current = null;
      }
    };
  }, [activeBus, getViewSettingsForBus, viewSettings, sampleMode]);

  useEffect(() => {
    if (state.channels.length === 0) {
      return;
    }
    if (activeBus.type === 'aux') {
      normalizedLayout.forEach(section => {
        const groupKey = getGroupKey('aux', activeBus.id, 'local', section.id);
        const ratioMap = ensureRatioMap(groupKey);
        const shouldIgnoreInf =
          section.mode === 'ignore-inf' ||
          (section.mode === 'ignore-inf-sends' && activeBus.type === 'aux');
        section.channelIds.forEach(channelId => {
          const channel = state.channels.find(item => item.id === channelId);
          if (!channel) {
            return;
          }
          if (shouldIgnoreInf && isMinusInf(channel.fader)) {
            return;
          }
          if (ratioMap[channelId] === undefined) {
            ratioMap[channelId] = faderToDb(channel.fader) - (section.offsetDb ?? 0);
          }
        });
      });
    }

    normalizedGlobalGroups.forEach(group => {
      const settings = normalizedGlobalSettings[group.id] ?? { offsetDb: 0, mode: 'ignore-inf' };
      const groupKey = getGroupKey(
        activeBus.type,
        activeBus.id,
        GLOBAL_GROUP_PREFIX,
        group.id
      );
      const ratioMap = ensureRatioMap(groupKey);
      const shouldIgnoreInf =
        settings.mode === 'ignore-inf' ||
        (settings.mode === 'ignore-inf-sends' && activeBus.type === 'aux');
      group.channelIds.forEach(channelId => {
        const channel = state.channels.find(item => item.id === channelId);
        if (!channel) {
          return;
        }
        if (shouldIgnoreInf && isMinusInf(channel.fader)) {
          return;
        }
        if (ratioMap[channelId] === undefined) {
          ratioMap[channelId] = faderToDb(channel.fader) - (settings.offsetDb ?? 0);
        }
      });
    });

    if (activeBus.type !== 'aux') {
      const groupKey = getGroupKey(
        activeBus.type,
        activeBus.id,
        VIEW_GROUP_PREFIX,
        'all'
      );
      const ratioMap = ensureRatioMap(groupKey);
      channelIds.forEach(channelId => {
        const channel = state.channels.find(item => item.id === channelId);
        if (!channel) {
          return;
        }
        if (isMinusInf(channel.fader)) {
          return;
        }
        if (ratioMap[channelId] === undefined) {
          ratioMap[channelId] = faderToDb(channel.fader) - (viewOffsets[activeBus.type] ?? 0);
        }
      });
    }
  }, [
    activeBus.type,
    activeBus.id,
    normalizedLayout,
    normalizedGlobalGroups,
    normalizedGlobalSettings,
    state.channels,
    channelIds,
    viewOffsets,
  ]);

  useEffect(() => {
    if (sampleMode) {
      return;
    }
    if (state.host && state.host !== 'Not configured') {
      setHostInput(state.host);
      setShowConnect(false);
      return;
    }
    setShowConnect(true);
  }, [state.host, sampleMode]);

  const throttledSetFader = useMemo(
    () =>
      throttle((id: number, value: number) => {
        const { type, id: busId } = activeBusRef.current;
        setFader(type, busId, id, value).catch(() => undefined);
      }, 60),
    []
  );

  const ensureRatioMap = (key: string) => {
    if (!groupRatiosRef.current[key]) {
      groupRatiosRef.current[key] = {};
    }
    return groupRatiosRef.current[key];
  };

  const updateRatioForChannel = useCallback(
    (channelId: number, faderValue: number) => {
      if (skipRatioRef.current.has(channelId)) {
        skipRatioRef.current.delete(channelId);
        return;
      }
      const ratioTargets: Array<{
        key: string;
        masterDb: number;
        mode: ChannelSection['mode'];
      }> = [];

      if (activeBusRef.current.type === 'aux') {
        const localSection = normalizedLayout.find(item =>
          item.channelIds.includes(channelId)
        );
        if (localSection) {
          ratioTargets.push({
            key: getGroupKey(
              'aux',
              activeBusRef.current.id,
              'local',
              localSection.id
            ),
            masterDb: localSection.offsetDb ?? 0,
            mode: localSection.mode ?? 'ignore-inf',
          });
        }
      }

      normalizedGlobalGroups.forEach(group => {
        if (!group.channelIds.includes(channelId)) {
          return;
        }
        const settings = normalizedGlobalSettings[group.id] ?? { offsetDb: 0, mode: 'ignore-inf' };
        ratioTargets.push({
          key: getGroupKey(
            activeBusRef.current.type,
            activeBusRef.current.id,
            GLOBAL_GROUP_PREFIX,
            group.id
          ),
          masterDb: settings.offsetDb ?? 0,
          mode: settings.mode ?? 'ignore-inf',
        });
      });

      if (activeBusRef.current.type !== 'aux') {
        ratioTargets.push({
          key: getGroupKey(
            activeBusRef.current.type,
            activeBusRef.current.id,
            VIEW_GROUP_PREFIX,
            'all'
          ),
          masterDb: viewOffsets[activeBusRef.current.type] ?? 0,
          mode: 'ignore-inf',
        });
      }

      ratioTargets.forEach(target => {
        const shouldIgnore =
          (target.mode === 'ignore-inf' ||
            (target.mode === 'ignore-inf-sends' && activeBusRef.current.type === 'aux')) &&
          isMinusInf(faderValue);
        if (shouldIgnore) {
          return;
        }
        const ratioMap = ensureRatioMap(target.key);
        ratioMap[channelId] = faderToDb(faderValue) - target.masterDb;
      });
    },
    [normalizedLayout, normalizedGlobalGroups, normalizedGlobalSettings, viewOffsets]
  );

  const handleWsMessage = useCallback(
    (message: WsMessage) => {
      if (sampleMode) {
        return;
      }
      if (message.type === 'state') {
        const matches =
          message.data.bus.type === activeBusRef.current.type &&
          message.data.bus.id === activeBusRef.current.id;
        if (matches) {
          setState(message.data);
        } else {
          setState(current => ({
            ...current,
            host: message.data.host,
            connectionStatus: message.data.connectionStatus,
            auxBuses: message.data.auxBuses,
          }));
        }
        return;
      }

      if (message.type === 'status') {
        setState(current => ({ ...current, connectionStatus: message.data.connectionStatus }));
        return;
      }

      if (message.type === 'aux') {
        setState(current => ({
          ...current,
          auxBuses: current.auxBuses.map(aux =>
            aux.id === message.data.id ? message.data : aux
          ),
        }));
        return;
      }

      if (message.type === 'meter') {
        setState(current => ({
          ...current,
          channels: current.channels.map(channel =>
            channel.id === message.data.id
              ? {
                  ...channel,
                  meterPre: message.data.meterPre ?? channel.meterPre,
                  meterPostFader: message.data.meterPostFader ?? channel.meterPostFader,
                }
              : channel
          ),
        }));
        return;
      }

      if (message.type === 'channel') {
        if (
          message.data.busType !== activeBusRef.current.type ||
          message.data.bus !== activeBusRef.current.id
        ) {
          return;
        }
        setState(current => {
          const updated = current.channels.map(channel =>
            channel.id === message.data.id
              ? {
                  ...channel,
                  ...message.data,
                  meterPre: message.data.meterPre ?? channel.meterPre,
                  meterPostFader: message.data.meterPostFader ?? channel.meterPostFader,
                }
              : channel
          );
          return { ...current, channels: updated };
        });
        updateRatioForChannel(message.data.id, message.data.fader);

        if (draggingIdRef.current !== message.data.id) {
          setHighlighted(current => ({ ...current, [message.data.id]: true }));
          setTimeout(() => {
            setHighlighted(current => ({ ...current, [message.data.id]: false }));
          }, 500);
        }
      }
    },
    [sampleMode, updateRatioForChannel]
  );

  const resolveMeterValue = useCallback(
    (channel: ChannelState) => {
      const pre = channel.meterPre;
      const post = channel.meterPostFader;
      if (activeBus.type === 'master') {
        if (post !== undefined && post > 0.001) {
          return post;
        }
        return pre ?? post ?? channel.fader;
      }
      return pre ?? post ?? channel.fader;
    },
    [activeBus.type]
  );

  useEffect(() => {
    if (sampleMode) {
      return undefined;
    }
    const cleanup = connectWs(message => {
      handleWsMessage(message);
    });

    return () => cleanup();
  }, [handleWsMessage, sampleMode]);

  // Simulate VU meter activity in sample mode
  useEffect(() => {
    if (!sampleMode) {
      return undefined;
    }

    // Per-channel state for smooth meter animation
    const channelState = new Map<number, { base: number; velocity: number }>();

    const interval = setInterval(() => {
      setState(current => ({
        ...current,
        channels: current.channels.map(channel => {
          // Skip muted channels - their meters should be at 0
          if (channel.muted) {
            return { ...channel, meterPre: 0, meterPostFader: 0 };
          }

          // Get or initialize per-channel animation state
          let state = channelState.get(channel.id);
          if (!state) {
            state = { base: Math.random() * 0.3 + 0.4, velocity: 0 };
            channelState.set(channel.id, state);
          }

          // Smooth random walk for natural movement
          state.velocity += (Math.random() - 0.5) * 0.15;
          state.velocity *= 0.85; // Damping
          state.base += state.velocity;
          state.base = Math.max(0.2, Math.min(0.9, state.base));

          // Occasional random peaks
          const peak = Math.random() > 0.95 ? Math.random() * 0.3 : 0;

          // Scale by fader position - higher fader = higher meter
          const faderScale = channel.fader * 0.8 + 0.2;
          const meterValue = Math.min(1, (state.base + peak) * faderScale);

          // Add slight variation between pre and post
          const meterPre = meterValue;
          const meterPostFader = meterValue * channel.fader;

          return { ...channel, meterPre, meterPostFader };
        }),
      }));
    }, 60); // ~16fps for smooth animation

    return () => clearInterval(interval);
  }, [sampleMode]);

  const handleFaderChange = (id: number, value: number) => {
    const clamped = clamp(value);
    setState(current => ({
      ...current,
      channels: current.channels.map(channel =>
        channel.id === id ? { ...channel, fader: clamped, faderDb: undefined } : channel
      ),
    }));
    updateRatioForChannel(id, clamped);
    if (sampleMode) {
      return;
    }
    throttledSetFader(id, clamped);
  };

  const handleMuteToggle = (id: number, muted: boolean) => {
    setState(current => ({
      ...current,
      channels: current.channels.map(channel =>
        channel.id === id ? { ...channel, muted } : channel
      ),
    }));
    if (sampleMode) {
      return;
    }
    setMute(activeBus.type, activeBus.id, id, muted).catch(() => undefined);
  };

  const handleSoloToggle = (id: number, solo: boolean) => {
    if (activeBusRef.current.type !== 'master') {
      return;
    }
    setState(current => ({
      ...current,
      channels: current.channels.map(channel =>
        channel.id === id ? { ...channel, solo } : channel
      ),
    }));
    if (sampleMode) {
      return;
    }
    setSolo('master', 0, id, solo).catch(() => undefined);
  };

  const applyGroupMasterChange = (
    channelIds: number[],
    previousMasterDb: number,
    nextMasterDb: number,
    mode: ChannelSection['mode'] = 'ignore-inf',
    groupKey: string
  ) => {
    const shouldIgnoreInf =
      mode === 'ignore-inf' || (mode === 'ignore-inf-sends' && activeBusRef.current.type === 'aux');
    const ratioMap = ensureRatioMap(groupKey);
    const updates: Record<number, number> = {};

    channelIds.forEach(channelId => {
      const channel = state.channels.find(item => item.id === channelId);
      if (!channel) {
        return;
      }
      if (shouldIgnoreInf && isMinusInf(channel.fader)) {
        return;
      }
      const ratio =
        ratioMap[channelId] !== undefined
          ? ratioMap[channelId]
          : faderToDb(channel.fader) - previousMasterDb;
      ratioMap[channelId] = ratio;
      const nextDb = ratio + nextMasterDb;
      updates[channelId] = clamp(dbToFader(nextDb));
    });

    if (Object.keys(updates).length === 0) {
      return;
    }

    setState(current => ({
      ...current,
      channels: current.channels.map(channel => {
        const nextValue = updates[channel.id];
        if (nextValue === undefined) {
          return channel;
        }
        return { ...channel, fader: nextValue, faderDb: undefined };
      }),
    }));

    if (sampleMode) {
      return;
    }

    Object.entries(updates).forEach(([id, value]) => {
      const channelId = Number(id);
      skipRatioRef.current.add(channelId);
      setFader(activeBusRef.current.type, activeBusRef.current.id, channelId, value).catch(
        () => undefined
      );
    });
  };

  const updateLayout = (next: ChannelSection[]) => {
    setAuxLayout(next);
    layoutDirtyRef.current = true;
  };

  const updateGlobalGroups = (next: GlobalGroup[]) => {
    setGlobalGroups(next);
    globalDirtyRef.current = true;
  };

  const updateGlobalSettings = (next: Record<string, GlobalGroupSettings>) => {
    setGlobalSettings(next);
    globalSettingsDirtyRef.current = true;
  };

  const updateViewSettings = (busType: BusType, busId: number, next: ViewSettings) => {
    setViewSettings(current => {
      if (busType === 'aux') {
        return { ...current, aux: { ...current.aux, [busId]: next } };
      }
      return { ...current, [busType]: next };
    });
    viewSettingsDirtyRef.current = true;
    viewSettingsDirtyKeyRef.current = { type: busType, id: busId };
  };

  useEffect(() => {
    const handleDragEnd = () => {
      groupDragRef.current = null;
      channelItemDragRef.current = null;
      setDraggingChannelId(null);
      setMixDropTarget(null);
      setDropTarget(null);
    };
    window.addEventListener('dragend', handleDragEnd);
    window.addEventListener('drop', handleDragEnd);
    return () => {
      window.removeEventListener('dragend', handleDragEnd);
      window.removeEventListener('drop', handleDragEnd);
    };
  }, []);

  const handleAddSection = () => {
    setLocalGroupName('');
    setLocalGroupSelection(new Set());
    setShowLocalGroupModal(true);
  };

  const handleResetLayout = () => {
    const confirmReset = window.confirm(
      'Reset layout? This clears local V-Groups, disables Global V-Groups, and clears Favorites for this view.'
    );
    if (!confirmReset) {
      return;
    }
    const nextGlobalSettings = { ...normalizedGlobalSettings };
    normalizedGlobalGroups.forEach(group => {
      const current = nextGlobalSettings[group.id] ?? { offsetDb: 0, mode: 'ignore-inf' };
      nextGlobalSettings[group.id] = { ...current, enabled: false };
    });
    updateGlobalSettings(nextGlobalSettings);
    updateLayout(buildDefaultLayout(channelIds));
    updateViewSettings(activeBus.type, activeBus.id, { ...activeViewSettings, mixOrder: [] });
  };

  const handleAddGlobalGroup = () => {
    const name = window.prompt('Global V-Group name?');
    if (!name || !name.trim()) {
      return;
    }
    const nameTrimmed = name.trim();
    const nameExists = normalizedGlobalGroups.some(
      group => group.name.toLowerCase() === nameTrimmed.toLowerCase()
    );
    if (nameExists) {
      window.alert('A Global V-Group with that name already exists.');
      return;
    }
    const existing = new Set(normalizedGlobalGroups.map(group => group.id));
    const id = makeSectionId(nameTrimmed, existing);
    const next = [...normalizedGlobalGroups, { id, name: nameTrimmed, channelIds: [] }];
    updateGlobalGroups(next);
  };

  const handleRenameSection = (sectionId: string) => {
    const section = normalizedLayout.find(current => current.id === sectionId);
    if (!section) {
      return;
    }
    const name = window.prompt('Rename V-Group', section.name);
    if (!name || !name.trim()) {
      return;
    }
    const next = normalizedLayout.map(current =>
      current.id === sectionId ? { ...current, name: name.trim() } : current
    );
    updateLayout(next);
  };

  const handleRemoveSection = (sectionId: string) => {
    if (!window.confirm('Remove this V-Group? Channels will move to Other.')) {
      return;
    }
    const remaining = normalizedLayout.filter(section => section.id !== sectionId);
    const removed = normalizedLayout.find(section => section.id === sectionId);
    if (!removed) {
      return;
    }
    const others = remaining.find(section => section.id === OTHERS_ID);
    if (others) {
      others.channelIds = others.channelIds.concat(removed.channelIds);
    }
    updateLayout(remaining);
  };

  const handleToggleLocalGroupChannel = (channelId: number) => {
    setLocalGroupSelection(current => {
      const next = new Set(current);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  };

  const handleCreateLocalGroup = () => {
    const trimmed = localGroupName.trim();
    if (!trimmed) {
      return;
    }
    const existing = new Set(normalizedLayout.map(section => section.id));
    const id = makeSectionId(trimmed, existing);
    const channelIds = Array.from(localGroupSelection);
    const next = [
      ...normalizedLayout.slice(0, -1),
      { id, name: trimmed, channelIds },
      normalizedLayout[normalizedLayout.length - 1],
    ];
    updateLayout(next);
    setShowLocalGroupModal(false);
    setLocalGroupName('');
    setLocalGroupSelection(new Set());
  };

  const handleRenameGlobalGroup = (groupId: string) => {
    const group = normalizedGlobalGroups.find(item => item.id === groupId);
    if (!group) {
      return;
    }
    const name = window.prompt('Rename Global V-Group', group.name);
    if (!name || !name.trim()) {
      return;
    }
    const nameTrimmed = name.trim();
    const nameExists = normalizedGlobalGroups.some(
      item => item.id !== groupId && item.name.toLowerCase() === nameTrimmed.toLowerCase()
    );
    if (nameExists) {
      window.alert('A Global V-Group with that name already exists.');
      return;
    }
    const next = normalizedGlobalGroups.map(item =>
      item.id === groupId ? { ...item, name: nameTrimmed } : item
    );
    updateGlobalGroups(next);
  };

  const handleRemoveGlobalGroup = (groupId: string) => {
    if (!window.confirm('Delete this Global V-Group?')) {
      return;
    }
    const nextGroups = normalizedGlobalGroups.filter(item => item.id !== groupId);
    updateGlobalGroups(nextGroups);
    if (globalSettings[groupId]) {
      const nextSettings = { ...globalSettings };
      delete nextSettings[groupId];
      updateGlobalSettings(nextSettings);
    }
  };

  const findSectionForChannel = (channelId: number) =>
    normalizedLayout.find(section => section.channelIds.includes(channelId))?.id;

  const handleFavoriteToggle = (channelId: number) => {
    const favorites = normalizedLayout.find(section => section.id === FAVORITES_ID);
    if (!favorites) {
      return;
    }
    const isFavorite = favorites.channelIds.includes(channelId);
    const next = isFavorite
      ? removeChannelFromSection(normalizedLayout, channelId, FAVORITES_ID)
      : upsertChannelInSection(normalizedLayout, channelId, FAVORITES_ID);
    updateLayout(next);
  };

  const handleSectionOffsetChange = (sectionId: string, nextOffset: number) => {
    const section = normalizedLayout.find(item => item.id === sectionId);
    if (!section) {
      return;
    }
    const currentOffset = section.offsetDb ?? 0;
    const delta = nextOffset - currentOffset;
    if (delta === 0) {
      return;
    }
    const groupKey = getGroupKey(
      'aux',
      activeBusRef.current.id,
      'local',
      section.id
    );
    applyGroupMasterChange(
      section.channelIds,
      currentOffset,
      nextOffset,
      section.mode,
      groupKey
    );
    const nextLayout = normalizedLayout.map(item =>
      item.id === sectionId ? { ...item, offsetDb: nextOffset } : item
    );
    updateLayout(nextLayout);
  };

  const handleSectionModeChange = (sectionId: string, mode: ChannelSection['mode']) => {
    const nextLayout = normalizedLayout.map(item =>
      item.id === sectionId ? { ...item, mode } : item
    );
    updateLayout(nextLayout);
  };

  const handleGlobalGroupOffsetChange = (groupId: string, nextOffset: number) => {
    const settings = normalizedGlobalSettings[groupId] ?? { offsetDb: 0, mode: 'ignore-inf' };
    const currentOffset = settings.offsetDb ?? 0;
    const delta = nextOffset - currentOffset;
    if (delta === 0) {
      return;
    }
    const group = normalizedGlobalGroups.find(item => item.id === groupId);
    if (!group) {
      return;
    }
    const groupKey = getGroupKey(
      activeBusRef.current.type,
      activeBusRef.current.id,
      GLOBAL_GROUP_PREFIX,
      groupId
    );
    applyGroupMasterChange(group.channelIds, currentOffset, nextOffset, settings.mode, groupKey);
    const nextSettings = {
      ...normalizedGlobalSettings,
      [groupId]: { ...settings, offsetDb: nextOffset },
    };
    updateGlobalSettings(nextSettings);
  };

  const handleGlobalGroupModeChange = (groupId: string, mode: ChannelSection['mode']) => {
    const settings = normalizedGlobalSettings[groupId] ?? { offsetDb: 0, mode: 'ignore-inf' };
    const nextSettings = {
      ...normalizedGlobalSettings,
      [groupId]: { ...settings, mode },
    };
    updateGlobalSettings(nextSettings);
  };

  const handleVGroupMute = (channelIds: number[], muted: boolean) => {
    if (activeBusRef.current.type === 'gain') {
      return;
    }
    const idSet = new Set(channelIds);
    setState(current => ({
      ...current,
      channels: current.channels.map(channel =>
        idSet.has(channel.id) ? { ...channel, muted } : channel
      ),
    }));
    if (sampleMode) {
      return;
    }
    channelIds.forEach(channelId => {
      setMute(activeBusRef.current.type, activeBusRef.current.id, channelId, muted).catch(
        () => undefined
      );
    });
  };

  const handleVGroupSolo = (channelIds: number[], solo: boolean) => {
    if (activeBusRef.current.type !== 'master') {
      return;
    }
    const idSet = new Set(channelIds);
    setState(current => ({
      ...current,
      channels: current.channels.map(channel =>
        idSet.has(channel.id) ? { ...channel, solo } : channel
      ),
    }));
    if (sampleMode) {
      return;
    }
    channelIds.forEach(channelId => {
      setSolo('master', 0, channelId, solo).catch(() => undefined);
    });
  };

  const handleViewOffsetChange = (nextOffset: number) => {
    const currentOffset = viewOffsets[activeBus.type] ?? 0;
    const delta = nextOffset - currentOffset;
    if (delta === 0) {
      return;
    }
    const groupKey = getGroupKey(
      activeBusRef.current.type,
      activeBusRef.current.id,
      VIEW_GROUP_PREFIX,
      'all'
    );
    applyGroupMasterChange(channelIds, currentOffset, nextOffset, 'ignore-inf', groupKey);
    setViewOffsets(current => ({ ...current, [activeBus.type]: nextOffset }));
    updateViewSettings(activeBusRef.current.type, activeBusRef.current.id, {
      ...getViewSettingsForBus(activeBusRef.current.type, activeBusRef.current.id),
      offsetDb: nextOffset,
    });
  };

  const handleChannelDrop = (
    channelId: number,
    toSectionId: string,
    beforeChannelId?: number
  ) => {
    setDropTarget(null);
    updateLayout(upsertChannelInSection(normalizedLayout, channelId, toSectionId, beforeChannelId));
  };

  const updateGlobalGroupChannels = (
    groupId: string,
    channelId: number,
    beforeChannelId?: number
  ) => {
    setDropTarget(null);
    const nextGroups = normalizedGlobalGroups.map(group => {
      if (group.id !== groupId) {
        return group;
      }
      if (beforeChannelId === channelId) {
        return group;
      }
      const nextIds = group.channelIds.filter(id => id !== channelId);
      const insertAt = beforeChannelId ? nextIds.indexOf(beforeChannelId) : -1;
      if (insertAt >= 0) {
        nextIds.splice(insertAt, 0, channelId);
      } else {
        nextIds.push(channelId);
      }
      return { ...group, channelIds: nextIds };
    });
    updateGlobalGroups(nextGroups);
  };

  const removeFromGlobalGroup = (groupId: string, channelId: number) => {
    const nextGroups = normalizedGlobalGroups.map(group => {
      if (group.id !== groupId) {
        return group;
      }
      return { ...group, channelIds: group.channelIds.filter(id => id !== channelId) };
    });
    updateGlobalGroups(nextGroups);
  };

  const removeFromLocalGroup = (groupId: string, channelId: number) => {
    const next = removeChannelFromSection(normalizedLayout, channelId, groupId);
    updateLayout(next);
  };

  const handleToggleGlobalGroupChannel = (groupId: string, channelId: number) => {
    const nextGroups = normalizedGlobalGroups.map(group => {
      if (group.id !== groupId) {
        return group;
      }
      const exists = group.channelIds.includes(channelId);
      const nextIds = exists
        ? group.channelIds.filter(id => id !== channelId)
        : [...group.channelIds, channelId];
      return { ...group, channelIds: nextIds };
    });
    updateGlobalGroups(nextGroups);
  };

  const handleRemoveGlobalGroupFromPage = (groupId: string) => {
    const settings = normalizedGlobalSettings[groupId];
    if (!settings) {
      return;
    }
    updateGlobalSettings({
      ...normalizedGlobalSettings,
      [groupId]: { ...settings, enabled: false },
    });
  };

  const handleToggleGlobalGroupForView = (groupId: string) => {
    const settings = normalizedGlobalSettings[groupId] ?? { offsetDb: 0, mode: 'ignore-inf' };
    updateGlobalSettings({
      ...normalizedGlobalSettings,
      [groupId]: { ...settings, enabled: !settings.enabled },
    });
  };

  const handleToggleLocalGroupForView = (groupId: string) => {
    const target = normalizedLayout.find(section => section.id === groupId);
    if (!target) {
      return;
    }
    const enabled = target.enabled ?? true;
    const next = normalizedLayout.map(section =>
      section.id === groupId ? { ...section, enabled: !enabled } : section
    );
    updateLayout(next);
  };

  const readDragPayload = (event: DragEvent) => {
    const raw =
      event.dataTransfer.getData('application/json') ||
      event.dataTransfer.getData('text/plain');
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as {
        channelId?: number;
        groupId?: string;
        groupType?: 'local' | 'global';
      };
      if (!parsed.channelId) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const readGroupDragPayload = (event: DragEvent) => {
    const raw =
      event.dataTransfer.getData('application/x-ui24r-group') ||
      event.dataTransfer.getData('text/plain');
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as {
        kind?: string;
        groupId?: string;
        groupType?: 'local' | 'global';
      };
      if (parsed.kind !== 'group' || !parsed.groupId || !parsed.groupType) {
        return null;
      }
      return { groupId: parsed.groupId, groupType: parsed.groupType };
    } catch {
      return null;
    }
  };

  const isGroupDragEvent = (event: DragEvent) =>
    (!!groupDragRef.current && !channelItemDragRef.current) ||
    Array.from(event.dataTransfer.types).includes('application/x-ui24r-group');

  const readChannelItemDragPayload = (event: DragEvent) => {
    const raw =
      event.dataTransfer.getData('application/x-ui24r-channel-item') ||
      event.dataTransfer.getData('text/plain');
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as {
        kind?: string;
        channelId?: number;
        sourceGroupType?: 'local' | 'global';
        sourceGroupId?: string;
      };
      if (parsed.kind !== 'channel-item' || !parsed.channelId) {
        return null;
      }
      return {
        channelId: parsed.channelId,
        sourceGroupType: parsed.sourceGroupType,
        sourceGroupId: parsed.sourceGroupId,
      };
    } catch {
      return null;
    }
  };

  const isChannelItemDragEvent = (event: DragEvent) =>
    !!channelItemDragRef.current ||
    Array.from(event.dataTransfer.types).includes('application/x-ui24r-channel-item');

  const readMixDragPayload = (event: DragEvent) => {
    const groupPayload = readGroupDragPayload(event) ?? groupDragRef.current;
    if (groupPayload) {
      return { kind: 'group' as const, ...groupPayload };
    }
    const channelPayload = readChannelItemDragPayload(event) ?? channelItemDragRef.current;
    if (channelPayload) {
      return { kind: 'channel' as const, ...channelPayload };
    }
    return null;
  };

  const getActiveMixDrag = (event?: DragEvent) => {
    if (groupDragRef.current) {
      return { kind: 'group' as const, ...groupDragRef.current };
    }
    if (channelItemDragRef.current) {
      return { kind: 'channel' as const, ...channelItemDragRef.current };
    }
    return event ? readMixDragPayload(event) : null;
  };

  const isMixItemDragEvent = (event: DragEvent) =>
    isGroupDragEvent(event) || isChannelItemDragEvent(event);

  const handleDragStartCard = (
    event: DragEvent,
    channelId: number,
    groupType: 'local' | 'global',
    groupId: string
  ) => {
    groupDragRef.current = null;
    setMixDropTarget(null);
    const channelPayload = {
      kind: 'channel-item',
      channelId,
      sourceGroupType: groupType,
      sourceGroupId: groupId,
    };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(
      'application/json',
      JSON.stringify({ channelId, groupId, groupType })
    );
    event.dataTransfer.setData('application/x-ui24r-channel-item', JSON.stringify(channelPayload));
    event.dataTransfer.setData(
      'text/plain',
      JSON.stringify(channelPayload)
    );
    channelItemDragRef.current = { channelId, sourceGroupType: groupType, sourceGroupId: groupId };
  };

  const handleGroupDragStart = (
    event: DragEvent,
    groupType: 'local' | 'global',
    groupId: string
  ) => {
    const payload = { kind: 'group', groupType, groupId };
    groupDragRef.current = { groupType, groupId };
    channelItemDragRef.current = null;
    setMixDropTarget(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-ui24r-group', JSON.stringify(payload));
    event.dataTransfer.setData('text/plain', JSON.stringify(payload));
  };

  const handleChannelItemDragStart = (event: DragEvent, channelId: number) => {
    const payload = { kind: 'channel-item', channelId };
    channelItemDragRef.current = { channelId };
    groupDragRef.current = null;
    setMixDropTarget(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-ui24r-channel-item', JSON.stringify(payload));
    event.dataTransfer.setData('application/json', JSON.stringify({ channelId }));
    event.dataTransfer.setData('text/plain', JSON.stringify(payload));
  };

  const getMixItemKey = (item: MixRowItem) =>
    item.kind === 'group'
      ? `group:${item.group.groupType}:${item.group.id}`
      : `channel:${item.channel.id}`;

  const buildMixOrderFromItems = (items: MixRowItem[]): MixOrderItem[] =>
    items.map(item =>
      item.kind === 'group'
        ? { kind: 'group', groupType: item.group.groupType, id: item.group.id }
        : { kind: 'channel', id: item.channel.id }
    );

  const reorderMixItems = (
    items: MixRowItem[],
    draggedKey: string,
    targetKey: string | undefined,
    position: 'before' | 'end',
    fallbackItem?: MixRowItem
  ) => {
    if (targetKey && draggedKey === targetKey && position === 'before') {
      return items;
    }
    if (position === 'end') {
      if (!targetKey) {
        const lastKey = items.length ? getMixItemKey(items[items.length - 1]) : undefined;
        if (lastKey === draggedKey) {
          return items;
        }
      } else {
        const fromIndex = items.findIndex(item => getMixItemKey(item) === draggedKey);
        const toIndex = items.findIndex(item => getMixItemKey(item) === targetKey);
        if (fromIndex >= 0 && toIndex >= 0 && fromIndex === toIndex - 1) {
          return items;
        }
      }
    }
    const fromIndex = items.findIndex(item => getMixItemKey(item) === draggedKey);
    const next = items.slice();
    let moved: MixRowItem | undefined;
    if (fromIndex < 0) {
      if (!fallbackItem) {
        return items;
      }
      moved = fallbackItem;
    } else {
      [moved] = next.splice(fromIndex, 1);
    }
    if (!moved) {
      return items;
    }
    if (position === 'end' || !targetKey) {
      next.push(moved);
      return next;
    }
    const toIndex = next.findIndex(item => getMixItemKey(item) === targetKey);
    if (toIndex < 0) {
      next.push(moved);
      return next;
    }
    next.splice(toIndex, 0, moved);
    return next;
  };

  const updateMixOrder = (next: MixOrderItem[]) => {
    updateViewSettings(activeBus.type, activeBus.id, { ...activeViewSettings, mixOrder: next });
  };

  const removeChannelFromMixOrder = (channelId: number) => {
    const current = activeViewSettings.mixOrder ?? [];
    const next = current.filter(entry => entry.kind !== 'channel' || entry.id !== channelId);
    if (next.length === current.length) {
      return;
    }
    updateMixOrder(next);
  };

  const reorderMixByKey = (
    draggedKey: string,
    targetKey: string | undefined,
    position: 'before' | 'end',
    fallbackItem?: MixRowItem
  ) => {
    const nextItems = reorderMixItems(mixRowItems, draggedKey, targetKey, position, fallbackItem);
    updateMixOrder(buildMixOrderFromItems(nextItems));
  };

  const handleChannelItemDroppedInRow = (
    payload: { channelId: number; sourceGroupType?: 'local' | 'global'; sourceGroupId?: string },
    targetKey: string | undefined,
    position: 'before' | 'end'
  ) => {
    const channel = state.channels.find(item => item.id === payload.channelId);
    if (!channel) {
      return;
    }
    reorderMixByKey(`channel:${payload.channelId}`, targetKey, position, {
      kind: 'channel',
      channel,
    });
    if (payload.sourceGroupType === 'local' && payload.sourceGroupId) {
      removeFromLocalGroup(payload.sourceGroupId, payload.channelId);
    }
    if (payload.sourceGroupType === 'global' && payload.sourceGroupId) {
      removeFromGlobalGroup(payload.sourceGroupId, payload.channelId);
    }
  };

  const handleMixDrop = (
    payload: {
      kind: 'group' | 'channel';
      groupType?: 'local' | 'global';
      groupId?: string;
      channelId?: number;
      sourceGroupType?: 'local' | 'global';
      sourceGroupId?: string;
    },
    targetKey: string | undefined,
    position: 'before' | 'end'
  ) => {
    if (payload.kind === 'group' && payload.groupType && payload.groupId) {
      reorderMixByKey(`group:${payload.groupType}:${payload.groupId}`, targetKey, position);
      return;
    }
    if (payload.kind === 'channel' && payload.channelId) {
      handleChannelItemDroppedInRow(payload, targetKey, position);
    }
  };


  const handleConnect = async () => {
    if (isDemo) {
      setConnectError('Demo mode always uses sample data.');
      return;
    }
    const host = hostInput.trim();
    if (!host) {
      setConnectError('Enter a mixer IP address.');
      return;
    }
    setConnectError('');
    try {
      await connectMixer(host);
      setSampleMode(false);
      setState(current => ({ ...current, host }));
      setShowConnect(false);
      fetchState(activeBus.type, activeBus.id)
        .then(next => setState(next))
        .catch(() => undefined);
    } catch {
      setConnectError('Could not connect. Check IP and LAN.');
    }
  };

  const handleLoadSampleData = () => {
    setSampleMode(true);
    setConnectError('');
    setShowConnect(false);
    setState(buildSampleState(activeBusRef.current.type, activeBusRef.current.id));
  };

  const handleDragStart = (id: number) => {
    draggingIdRef.current = id;
  };

  const handleDragEnd = () => {
    draggingIdRef.current = null;
  };

  const handleSelectMaster = () => {
    setActiveBus({ type: 'master', id: 0 });
    setShowVGroupAdmin(false);
    setHighlighted({});
  };

  const handleSelectGain = () => {
    setActiveBus({ type: 'gain', id: 0 });
    setShowVGroupAdmin(false);
    setHighlighted({});
  };

  const handleSelectAux = (id: number) => {
    setActiveBus({ type: 'aux', id });
    setShowVGroupAdmin(false);
    setHighlighted({});
  };

  const handleToggleVGroupAdmin = () => {
    setShowVGroupAdmin(current => !current);
  };

  const getSpillKey = useCallback(
    (groupType: 'local' | 'global', groupId: string) =>
      `${activeBus.type}:${activeBus.id}:${groupType}:${groupId}`,
    [activeBus.type, activeBus.id]
  );

  const isGroupSpilled = useCallback(
    (groupType: 'local' | 'global', groupId: string) =>
      groupSpillState[getSpillKey(groupType, groupId)] ?? true,
    [groupSpillState, getSpillKey]
  );

  const toggleGroupSpill = useCallback(
    (groupType: 'local' | 'global', groupId: string) => {
      const key = getSpillKey(groupType, groupId);
      setGroupSpillState(current => ({ ...current, [key]: !(current[key] ?? true) }));
    },
    [getSpillKey]
  );

  const channelsById = useMemo(
    () => new Map(state.channels.map(channel => [channel.id, channel])),
    [state.channels]
  );
  const layoutSectionsWithChannels = useMemo(() => {
    // Find channels that are in local V-Groups (exclude from "All Channels")
    const channelsInLocalGroups = new Set<number>();
    normalizedLayout.forEach(section => {
      if (section.id !== FAVORITES_ID && section.id !== OTHERS_ID && (section.enabled ?? true)) {
        section.channelIds.forEach(id => channelsInLocalGroups.add(id));
      }
    });

    return normalizedLayout
      .map(section => {
        // For "All Channels", filter out channels that are in V-Groups
        const channelIds =
          section.id === OTHERS_ID
            ? section.channelIds.filter(id => !channelsInLocalGroups.has(id))
            : section.channelIds;

        return {
          ...section,
          groupType: 'local' as const,
          channels: channelIds
            .map(id => channelsById.get(id))
            .filter((channel): channel is NonNullable<typeof channel> => !!channel),
        };
      })
      .filter(section => section.enabled ?? true);
  }, [normalizedLayout, channelsById]);
  const globalGroupsWithChannels = useMemo(
    () =>
      normalizedGlobalGroups
        .map(group => ({
          ...group,
          groupType: 'global' as const,
          channels: group.channelIds
            .map(id => channelsById.get(id))
            .filter((channel): channel is NonNullable<typeof channel> => !!channel),
          settings: normalizedGlobalSettings[group.id] ?? { offsetDb: 0, mode: 'ignore-inf' },
        }))
        .filter(group => group.settings.enabled),
    [normalizedGlobalGroups, normalizedGlobalSettings, channelsById]
  );
  const auxGroupList = useMemo(() => {
    // Exclude Favorites section - favorites are now shown at the front of All Channels
    const localSections = layoutSectionsWithChannels.filter(
      section => section.id !== FAVORITES_ID
    );
    return [...globalGroupsWithChannels, ...localSections];
  }, [layoutSectionsWithChannels, globalGroupsWithChannels]);
  const favoriteIds = useMemo(() => {
    const favorites = normalizedLayout.find(section => section.id === FAVORITES_ID);
    return new Set(favorites?.channelIds ?? []);
  }, [normalizedLayout]);
  const mixerHost =
    state.host && state.host !== 'Not connected' && state.host !== 'Not configured'
      ? state.host
      : '';
  const mixerUrl = mixerHost ? `http://${mixerHost}/mixer.html` : '';
  const showNotYourMix =
    assignedAuxId !== null &&
    !(activeBus.type === 'aux' && activeBus.id === assignedAuxId);
  const activeViewSettings = useMemo(
    () => getViewSettingsForBus(activeBus.type, activeBus.id),
    [activeBus.type, activeBus.id, getViewSettingsForBus]
  );
  const mixRowItems = useMemo(() => {
    const groupList = activeBus.type === 'aux' ? auxGroupList : globalGroupsWithChannels;
    const groupMap = new Map<string, MixGroup>();
    groupList.forEach(group => {
      groupMap.set(`${group.groupType}:${group.id}`, group);
    });
    const channelMap = new Map(state.channels.map(channel => [channel.id, channel]));
    const usedGroups = new Set<string>();
    const usedChannels = new Set<number>();
    const items: MixRowItem[] = [];
    (activeViewSettings.mixOrder ?? []).forEach(entry => {
      if (entry.kind === 'group') {
        const key = `${entry.groupType}:${entry.id}`;
        const group = groupMap.get(key);
        if (group && !usedGroups.has(key)) {
          usedGroups.add(key);
          items.push({ kind: 'group', group });
        }
        return;
      }
      const channel = channelMap.get(entry.id);
      if (channel && !usedChannels.has(channel.id)) {
        usedChannels.add(channel.id);
        items.push({ kind: 'channel', channel });
      }
    });
    groupList.forEach(group => {
      const key = `${group.groupType}:${group.id}`;
      if (!usedGroups.has(key)) {
        usedGroups.add(key);
        items.push({ kind: 'group', group });
      }
    });
    if (activeBus.type !== 'aux') {
      state.channels.forEach(channel => {
        if (!usedChannels.has(channel.id)) {
          usedChannels.add(channel.id);
          items.push({ kind: 'channel', channel });
        }
      });
    }
    return items;
  }, [activeBus.type, activeViewSettings.mixOrder, auxGroupList, globalGroupsWithChannels, state.channels]);

  // Flatten mixRowItems to get channels in display order for the minimap
  const minimapChannels = useMemo(() => {
    const channels: ChannelState[] = [];
    const seen = new Set<number>();
    mixRowItems.forEach(item => {
      if (item.kind === 'channel') {
        if (!seen.has(item.channel.id)) {
          seen.add(item.channel.id);
          channels.push(item.channel);
        }
      } else if (item.kind === 'group') {
        item.group.channels.forEach(channel => {
          if (!seen.has(channel.id)) {
            seen.add(channel.id);
            channels.push(channel);
          }
        });
      }
    });
    return channels;
  }, [mixRowItems]);

  const renderVGroupStrip = (
    title: string,
    value: number,
    mode: ChannelSection['mode'],
    onChange: (next: number) => void,
    onModeChange: (nextMode: ChannelSection['mode']) => void,
    showModeSelect: boolean,
    channelIdsForGroup: number[],
    muted: boolean,
    solo: boolean,
    showMute: boolean,
    showSolo: boolean,
    showGlobalIndicator: boolean,
    showVisibilityToggle: boolean,
    isVisible: boolean,
    onVisibilityToggle: () => void,
    dragHandleProps?: HTMLAttributes<HTMLDivElement> & { draggable?: boolean },
    showEditButton?: boolean,
    onEdit?: () => void
  ) => (
    <VGroupStrip
      title={title}
      offsetDb={value}
      mode={mode}
      showModeSelect={showModeSelect}
      showMute={showMute}
      showSolo={showSolo}
      muted={muted}
      solo={solo}
      showVisibilityToggle={showVisibilityToggle}
      isVisible={isVisible}
      compact={false}
      showGlobalIndicator={showGlobalIndicator}
      showEditButton={showEditButton}
      onOffsetChange={onChange}
      onModeChange={onModeChange}
      onMuteToggle={next => handleVGroupMute(channelIdsForGroup, next)}
      onSoloToggle={next => handleVGroupSolo(channelIdsForGroup, next)}
      onVisibilityToggle={onVisibilityToggle}
      onEdit={onEdit}
      dragHandleProps={dragHandleProps}
    />
  );

  const renderMixRowItem = (item: MixRowItem) => {
    if (item.kind === 'channel') {
      const channel = item.channel;
      const isDropTarget =
        mixDropTarget?.itemType === 'channel' &&
        mixDropTarget?.channelId === channel.id &&
        mixDropTarget?.position === 'before';
      const targetKey = `channel:${channel.id}`;
      return (
        <div
          key={targetKey}
          className={`channel-stack ${isDropTarget ? 'mix-drop-target' : ''}`}
          onDragOver={event => {
            if (!isMixItemDragEvent(event)) {
              return;
            }
            const payload = getActiveMixDrag(event);
            if (!payload) {
              return;
            }
            event.preventDefault();
            setMixDropTarget({
              itemType: 'channel',
              channelId: channel.id,
              position: 'before',
            });
          }}
          onDragEnter={event => {
            if (!isMixItemDragEvent(event)) {
              return;
            }
            const payload = getActiveMixDrag(event);
            if (!payload) {
              return;
            }
            event.preventDefault();
            setMixDropTarget({
              itemType: 'channel',
              channelId: channel.id,
              position: 'before',
            });
          }}
          onDragLeave={event => {
            if (event.currentTarget.contains(event.relatedTarget as Node)) {
              return;
            }
            setMixDropTarget(null);
          }}
          onDrop={event => {
            if (!isMixItemDragEvent(event)) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            const payload = getActiveMixDrag(event);
            groupDragRef.current = null;
            channelItemDragRef.current = null;
            setMixDropTarget(null);
            if (!payload) {
              return;
            }
            handleMixDrop(payload, targetKey, 'before');
          }}
        >
          <div
            className={`channel-item ${
              draggingChannelId === channel.id ? 'is-dragging' : ''
            }`}
          >
            <ChannelStrip
              channel={channel}
              meterValue={resolveMeterValue(channel)}
              highlight={!!highlighted[channel.id]}
              showMute={activeBus.type !== 'gain'}

              onFaderChange={handleFaderChange}
              onMuteToggle={handleMuteToggle}
              onSoloToggle={handleSoloToggle}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              dragHandleProps={{
                draggable: true,
                title: 'Drag channel',
                onDragStart: event => {
                  event.stopPropagation();
                  handleChannelItemDragStart(event, channel.id);
                  setDraggingChannelId(channel.id);
                },
                onDragEnd: () => {
                  channelItemDragRef.current = null;
                  setDraggingChannelId(null);
                  setMixDropTarget(null);
                },
              }}
            />
          </div>
        </div>
      );
    }

    const section = item.group;
    const isLocalVGroup =
      section.groupType === 'local' &&
      section.id !== FAVORITES_ID &&
      section.id !== OTHERS_ID;
    const hasSectionControls = false; // Removed - edit is now via pencil icon on VGroupStrip
    const isOther = section.groupType === 'local' && section.id === OTHERS_ID;
    const showSectionHeader = !isLocalVGroup; // Hide header for local V-Groups
    const canDragGroup = true;
    const canAcceptDrop = true; // All visible sections can accept drops
    const isSpilled = isGroupSpilled(section.groupType, section.id);
    const isDropTarget =
      mixDropTarget?.itemType === 'group' &&
      mixDropTarget?.groupType === section.groupType &&
      mixDropTarget?.groupId === section.id &&
      mixDropTarget?.position === 'before';
    const targetKey = `group:${section.groupType}:${section.id}`;
    return (
      <div
        key={targetKey}
        className={`section-stack ${isDropTarget ? 'mix-drop-target' : ''}`}
      >
        {showSectionHeader && (
          <div
            className={`section-header section-header-board ${
              hasSectionControls ? '' : 'section-header-no-actions'
            }`}
            draggable={canDragGroup}
            onDragStart={event => {
              if (!canDragGroup) {
                return;
              }
              handleGroupDragStart(event, section.groupType, section.id);
            }}
            onDragEnd={() => {
              groupDragRef.current = null;
              setMixDropTarget(null);
            }}
            onDragOver={event => {
              if (!canAcceptDrop || !isMixItemDragEvent(event)) {
                return;
              }
              const payload = getActiveMixDrag(event);
              if (!payload) {
                return;
              }
              event.preventDefault();
              setMixDropTarget({
                itemType: 'group',
                groupType: section.groupType,
                groupId: section.id,
                position: 'before',
              });
            }}
            onDragEnter={event => {
              if (!canAcceptDrop || !isMixItemDragEvent(event)) {
                return;
              }
              const payload = getActiveMixDrag(event);
              if (!payload) {
                return;
              }
              event.preventDefault();
              setMixDropTarget({
                itemType: 'group',
                groupType: section.groupType,
                groupId: section.id,
                position: 'before',
              });
            }}
            onDragLeave={event => {
              if (event.currentTarget.contains(event.relatedTarget as Node)) {
                return;
              }
              setMixDropTarget(null);
            }}
            onDrop={event => {
              if (!canAcceptDrop || !isMixItemDragEvent(event)) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              const payload = getActiveMixDrag(event);
              groupDragRef.current = null;
              channelItemDragRef.current = null;
              setMixDropTarget(null);
              if (!payload) {
                return;
              }
              handleMixDrop(payload, targetKey, 'before');
            }}
          >
            <div className="section-title">{section.name}</div>
            <div className="section-controls">
              {hasSectionControls && (
                <div className="section-actions">
                  <button
                    className="section-button"
                    type="button"
                    onClick={() => handleRenameSection(section.id)}
                  >
                    Rename
                  </button>
                  <button
                    className="section-button"
                    type="button"
                    onClick={() => handleRemoveSection(section.id)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        <div
          className={`channel-section ${isOther ? 'channel-section-simple' : ''} ${
            isSpilled ? 'channel-section-spilled' : 'channel-section-collapsed'
          }`}
        >
          {!isOther && (
            <div className="vgroup-rail">
              {section.groupType === 'global'
                ? renderVGroupStrip(
                    section.name,
                    section.settings?.offsetDb ?? 0,
                    section.settings?.mode ?? 'ignore-inf',
                    next => handleGlobalGroupOffsetChange(section.id, next),
                    nextMode => handleGlobalGroupModeChange(section.id, nextMode),
                    true,
                    section.channelIds,
                    section.channels.some(channel => channel.muted),
                    section.channels.some(channel => channel.solo),
                    activeBus.type !== 'gain' && section.channelIds.length > 0,
                    activeBus.type === 'master' && section.channelIds.length > 0,
                    true,
                    true,
                    isGroupSpilled('global', section.id),
                    () => toggleGroupSpill('global', section.id),
                    {
                      draggable: canDragGroup,
                      onDragStart: event => {
                        if (!canDragGroup) {
                          return;
                        }
                        handleGroupDragStart(event, section.groupType, section.id);
                      },
                      onDragEnd: () => {
                        groupDragRef.current = null;
                        setMixDropTarget(null);
                      },
                    }
                  )
                : renderVGroupStrip(
                    section.name,
                    section.offsetDb ?? 0,
                    section.mode ?? 'ignore-inf',
                    next => handleSectionOffsetChange(section.id, next),
                    nextMode => handleSectionModeChange(section.id, nextMode),
                    true,
                    section.channelIds,
                    section.channels.some(channel => channel.muted),
                    section.channels.some(channel => channel.solo),
                    activeBus.type !== 'gain' && section.channelIds.length > 0,
                    activeBus.type === 'master' && section.channelIds.length > 0,
                    false,
                    true,
                    isGroupSpilled('local', section.id),
                    () => toggleGroupSpill('local', section.id),
                    {
                      draggable: canDragGroup,
                      onDragStart: event => {
                        if (!canDragGroup) {
                          return;
                        }
                        handleGroupDragStart(event, section.groupType, section.id);
                      },
                      onDragEnd: () => {
                        groupDragRef.current = null;
                        setMixDropTarget(null);
                      },
                    },
                    true, // showEditButton
                    () => handleRenameSection(section.id) // onEdit
                  )}
            </div>
          )}
          <div
            className="section-body"
            onDragOver={event => {
              if (isGroupDragEvent(event)) {
                return;
              }
              event.preventDefault();
            }}
            onDrop={event => {
              if (isGroupDragEvent(event)) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              setDropTarget(null);
              setMixDropTarget(null);
              channelItemDragRef.current = null;
              const payload = readDragPayload(event);
              const channelItemPayload = readChannelItemDragPayload(event);
              if (channelItemPayload) {
                removeChannelFromMixOrder(channelItemPayload.channelId);
              }
              if (!payload) {
                return;
              }
              if (section.groupType === 'global') {
                updateGlobalGroupChannels(section.id, payload.channelId);
                return;
              }
              handleChannelDrop(payload.channelId, section.id);
            }}
          >
            {isSpilled && (
              <div
                className="channel-grid section-grid board-grid"
                onDragOver={event => {
                  if (isGroupDragEvent(event)) {
                    return;
                  }
                  event.preventDefault();
                }}
                onDragOverCapture={event => {
                  if (event.target !== event.currentTarget) {
                    return;
                  }
                  if (isGroupDragEvent(event)) {
                    return;
                  }
                  setDropTarget({
                    groupType: section.groupType,
                    groupId: section.id,
                    position: 'end',
                  });
                }}
                onDragLeave={event => {
                  if (event.currentTarget.contains(event.relatedTarget as Node)) {
                    return;
                  }
                  setDropTarget(null);
                }}
                onDrop={event => {
                  if (isGroupDragEvent(event)) {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  setMixDropTarget(null);
                  channelItemDragRef.current = null;
                  const payload = readDragPayload(event);
                  const channelItemPayload = readChannelItemDragPayload(event);
                  if (channelItemPayload) {
                    removeChannelFromMixOrder(channelItemPayload.channelId);
                  }
                  if (!payload) {
                    return;
                  }
                  if (section.groupType === 'global') {
                    updateGlobalGroupChannels(section.id, payload.channelId);
                    return;
                  }
                  handleChannelDrop(payload.channelId, section.id);
                }}
              >
                {section.channels.map(channel => (
                  <div
                    key={channel.id}
                    className={`channel-item ${
                      dropTarget?.groupType === section.groupType &&
                      dropTarget?.groupId === section.id &&
                      dropTarget?.channelId === channel.id
                        ? 'drop-target'
                        : ''
                    } ${draggingChannelId === channel.id ? 'is-dragging' : ''}`}
                    onDragOver={event => {
                      event.preventDefault();
                      setDropTarget({
                        groupType: section.groupType,
                        groupId: section.id,
                        channelId: channel.id,
                        position: 'before',
                      });
                    }}
                    onDragEnter={event => {
                      event.preventDefault();
                      setDropTarget({
                        groupType: section.groupType,
                        groupId: section.id,
                        channelId: channel.id,
                        position: 'before',
                      });
                    }}
                    onDrop={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDropTarget(null);
                      const payload = readDragPayload(event);
                      if (!payload) {
                        return;
                      }
                      if (section.groupType === 'global') {
                        updateGlobalGroupChannels(section.id, payload.channelId, channel.id);
                        return;
                      }
                      handleChannelDrop(payload.channelId, section.id, channel.id);
                    }}
                  >
                    <ChannelStrip
                      channel={channel}
                      meterValue={resolveMeterValue(channel)}
                      highlight={!!highlighted[channel.id]}
                      showMute={activeBus.type !== 'gain'}
        
                      onFaderChange={handleFaderChange}
                      onMuteToggle={handleMuteToggle}
                      onSoloToggle={handleSoloToggle}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      dragHandleProps={{
                        draggable: true,
                        title: 'Drag channel',
                        onDragStart: event => {
                          event.stopPropagation();
                          handleDragStartCard(event, channel.id, section.groupType, section.id);
                          setDraggingChannelId(channel.id);
                        },
                        onDragEnd: () => {
                          channelItemDragRef.current = null;
                          setDraggingChannelId(null);
                        },
                      }}
                    />
                    {section.groupType === 'local' && section.id === OTHERS_ID && (
                      <button
                        className={`group-remove ${favoriteIds.has(channel.id) ? 'group-remove-favorite' : 'group-add-favorite'}`}
                        type="button"
                        onClick={() => handleFavoriteToggle(channel.id)}
                        title={favoriteIds.has(channel.id) ? 'Unpin from front' : 'Pin to front'}
                      >
                        {favoriteIds.has(channel.id) ? '★' : '☆'}
                      </button>
                    )}
                    {section.groupType === 'local' &&
                      section.id !== OTHERS_ID &&
                      section.id !== FAVORITES_ID && (
                        <button
                          className="group-remove"
                          type="button"
                          onClick={() => removeFromLocalGroup(section.id, channel.id)}
                        >
                          ✕
                        </button>
                      )}
                  </div>
                ))}
                {section.channels.length === 0 && (
                  <div className="section-empty">
                    <span>Drop</span>
                    <span>channels</span>
                    <span>here</span>
                  </div>
                )}
                <div
                  className={`drop-end ${
                    dropTarget?.groupType === section.groupType &&
                    dropTarget?.groupId === section.id &&
                    dropTarget?.position === 'end'
                      ? 'active'
                      : ''
                  }`}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const resolveEndTarget = () => {
    const hasOthers = mixRowItems.some(
      item =>
        item.kind === 'group' &&
        item.group.groupType === 'local' &&
        item.group.id === OTHERS_ID
    );
    const targetKey =
      activeBus.type === 'aux' && hasOthers ? `group:local:${OTHERS_ID}` : undefined;
    const position = activeBus.type === 'aux' && hasOthers ? 'before' : 'end';
    return { targetKey, position };
  };

  const renderMixDropSlot = (targetKey: string) => {
    const isActive =
      mixDropTarget?.itemType === 'slot' &&
      mixDropTarget?.targetKey === targetKey &&
      mixDropTarget?.position === 'before';
    return (
      <div
        key={`slot:${targetKey}`}
        className={`mix-drop-slot ${isActive ? 'active' : ''}`}
        onDragOver={event => {
          if (!isMixItemDragEvent(event)) {
            return;
          }
          const payload = getActiveMixDrag(event);
          if (!payload) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          setMixDropTarget({ itemType: 'slot', targetKey, position: 'before' });
        }}
        onDragEnter={event => {
          if (!isMixItemDragEvent(event)) {
            return;
          }
          const payload = getActiveMixDrag(event);
          if (!payload) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          setMixDropTarget({ itemType: 'slot', targetKey, position: 'before' });
        }}
        onDragLeave={event => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) {
            return;
          }
          setMixDropTarget(null);
        }}
        onDrop={event => {
          if (!isMixItemDragEvent(event)) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          const payload = getActiveMixDrag(event);
          groupDragRef.current = null;
          channelItemDragRef.current = null;
          setMixDropTarget(null);
          if (!payload) {
            return;
          }
          if (targetKey === '__end__') {
            const endTarget = resolveEndTarget();
            handleMixDrop(payload, endTarget.targetKey, endTarget.position);
            return;
          }
          handleMixDrop(payload, targetKey, 'before');
        }}
      />
    );
  };

  return (
    <div className="app-shell">
      <div className="top-bar">
        <span className="brand-title">Ui24R Mini</span>
        <div className="status-block">
          {!isDemo && (
            <button
              className="icon-button"
              type="button"
              onClick={() => setShowConnect(value => !value)}
              title="Connect to mixer"
            >
              <span className="icon-button-icon">⚡</span>
            </button>
          )}
          {mixerUrl && (
            <a
              className="icon-button"
              href={mixerUrl}
              target="_blank"
              rel="noreferrer"
              title="Open full Ui24R interface"
            >
              <span className="icon-button-icon">↗</span>
            </a>
          )}
          <button
            className="icon-button"
            type="button"
            onClick={() => setShowHelp(true)}
            title="Help"
          >
            <span className="icon-button-icon">?</span>
          </button>
          {isDev && (
            <span className="dev-badge">{versionLabel || 'Dev'}</span>
          )}
          {isDemo && gitSha && (
            <a
              className="dev-badge sha-badge"
              href={`https://github.com/eric-silverman/ui24r-mini-mixer/commit/${gitSha}`}
              target="_blank"
              rel="noreferrer"
              title={`View commit ${gitSha} on GitHub`}
            >
              {gitSha}
            </a>
          )}
          <ConnectionPill
            status={state.connectionStatus}
            label={sampleMode ? 'Sample' : undefined}
            variant={sampleMode ? 'sample' : 'default'}
          />
        </div>
        <div className="toolbar-spacer" />
        <button
          className={`mode-button mode-button-small ${showVGroupAdmin ? 'mode-button-active' : ''}`}
          type="button"
          onClick={handleToggleVGroupAdmin}
        >
          Global V-Groups
        </button>
        <select
          className="mix-select"
          value={
            activeBus.type === 'master'
              ? 'master'
              : activeBus.type === 'gain'
                ? 'gain'
                : `aux-${activeBus.id}`
          }
          onChange={event => {
            const value = event.target.value;
            if (value === 'master') {
              handleSelectMaster();
            } else if (value === 'gain') {
              handleSelectGain();
            } else if (value.startsWith('aux-')) {
              const auxId = parseInt(value.replace('aux-', ''), 10);
              handleSelectAux(auxId);
            }
          }}
        >
          <option value="master">Main Mix</option>
          <option value="gain">Gain</option>
          {state.auxBuses.length > 0 && (
            <optgroup label="AUX Sends">
              {groupStereoAuxBuses(
                assignedAuxId === null || showAllAuxMixes
                  ? state.auxBuses
                  : state.auxBuses.filter(
                      aux =>
                        aux.id === assignedAuxId ||
                        (aux.name.endsWith(' L') &&
                          state.auxBuses.find(
                            other =>
                              other.id === assignedAuxId && other.name === aux.name.slice(0, -2) + ' R'
                          )) ||
                        (aux.name.endsWith(' R') &&
                          state.auxBuses.find(
                            other =>
                              other.id === assignedAuxId && other.name === aux.name.slice(0, -2) + ' L'
                          ))
                    )
              ).map(item =>
                item.type === 'mono' ? (
                  <option key={item.aux.id} value={`aux-${item.aux.id}`}>
                    {item.aux.name || `AUX ${item.aux.id}`}
                  </option>
                ) : (
                  <option key={`stereo-${item.left.id}-${item.right.id}`} value={`aux-${item.left.id}`}>
                    {item.name} (Stereo)
                  </option>
                )
              )}
            </optgroup>
          )}
        </select>
        {assignedAuxId !== null && (
          <button
            className="mode-button mode-button-small"
            type="button"
            onClick={() => setShowAllAuxMixes(current => !current)}
            title={showAllAuxMixes ? 'Show only your assigned AUX' : 'Show all AUX sends'}
          >
            {showAllAuxMixes ? 'All' : 'Mine'}
          </button>
        )}
      </div>
      {showNotYourMix && (
        <div className="not-your-mix-banner">
          <span>NOT YOUR MIX</span>
        </div>
      )}

      {showConnect && (
        <div className="connect-panel">
          <div className="connect-title">Mixer IP</div>
          <div className="connect-row">
            <input
              className="connect-input"
              value={hostInput}
              placeholder="192.168.1.123"
              onChange={event => setHostInput(event.target.value)}
            />
            <button className="mode-button mode-button-active" onClick={handleConnect}>
              Connect
            </button>
          </div>
          {connectError && <div className="connect-error">{connectError}</div>}
        </div>
      )}

      {showHelp && (
        <div className="modal-backdrop" onClick={() => setShowHelp(false)}>
          <div className="modal-card help-modal" onClick={event => event.stopPropagation()}>
            <div className="modal-title">Help & How-To</div>
            <div className="modal-body help-body">
              <div className="help-grid">
                <section className="help-section">
                  <h3>Quick Start</h3>
                  <ol>
                    <li>Join the same Wi-Fi or LAN as the mixer.</li>
                    <li>Open the app URL in your browser.</li>
                    <li>Tap Connect, enter the mixer IP, then Connect.</li>
                    <li>Select Main Mix, Gain, or an AUX send.</li>
                  </ol>
                </section>
                <section className="help-section">
                  <h3>Top Bar</h3>
                  <ul>
                    <li>Ui24R Full Interface opens the Soundcraft UI when connected.</li>
                    <li>Connect toggles the IP entry panel.</li>
                    <li>Load Sample Data appears when disconnected.</li>
                    <li>Status pill shows connection state.</li>
                  </ul>
                </section>
                <section className="help-section">
                  <h3>Main Mix</h3>
                  <ul>
                    <li>Fader adjusts channel level.</li>
                    <li>Mute and Solo are available per channel.</li>
                    <li>Meters show signal activity.</li>
                  </ul>
                </section>
                <section className="help-section">
                  <h3>Aux Sends</h3>
                  <ul>
                    <li>Select your AUX in the AUX SENDS row.</li>
                    <li>Assign to Me claims that aux on this device.</li>
                    <li>Show Assigned hides other auxes.</li>
                    <li>Fader adjusts send level; Mute is per channel.</li>
                  </ul>
                </section>
                <section className="help-section">
                  <h3>Gain</h3>
                  <ul>
                    <li>Adjust preamp gain for each channel.</li>
                    <li>No mute or solo in Gain view.</li>
                  </ul>
                </section>
                <section className="help-section">
                  <h3>V-Groups</h3>
                  <ul>
                    <li>Use V-Groups to group channels together.</li>
                    <li>Global groups are managed in the V-Groups view.</li>
                    <li>Local groups exist per AUX view.</li>
                  </ul>
                </section>
                <section className="help-section">
                  <h3>Reordering</h3>
                  <ul>
                    <li>Drag a channel or group header to move it.</li>
                    <li>Drop between items or at the end to append.</li>
                  </ul>
                </section>
                <section className="help-section">
                  <h3>Reset</h3>
                  <ul>
                    <li>Reset button in the toolbar restores defaults.</li>
                    <li>Clears local groups and custom ordering.</li>
                  </ul>
                </section>
                <section className="help-section">
                  <h3>Tips</h3>
                  <ul>
                    <li>Refresh if the view looks stale.</li>
                    <li>Keep one browser tab per device.</li>
                    <li>Be cautious in Gain; it affects everyone.</li>
                  </ul>
                </section>
                <section className="help-section">
                  <h3>Troubleshooting</h3>
                  <ul>
                    <li>Cannot connect: check IP and network.</li>
                    <li>Buttons disabled: some controls are view-specific.</li>
                    <li>No audio changes: verify the correct aux or main mix.</li>
                  </ul>
                </section>
              </div>
            </div>
            <div className="modal-actions">
              <button className="mode-button" type="button" onClick={() => setShowHelp(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showLocalGroupModal && activeBus.type === 'aux' && (
        <div
          className="modal-backdrop"
          onClick={() => setShowLocalGroupModal(false)}
        >
          <div className="modal-card" onClick={event => event.stopPropagation()}>
            <div className="modal-title">New V-Group</div>
            <div className="modal-body">
              <label className="modal-field">
                <span>Name</span>
                <input
                  className="connect-input"
                  value={localGroupName}
                  placeholder="e.g. Drums"
                  onChange={event => setLocalGroupName(event.target.value)}
                />
              </label>
              <div className="modal-subtitle">Channels</div>
              <div className="modal-channel-list">
                {state.channels.map(channel => {
                  const checked = localGroupSelection.has(channel.id);
                  return (
                    <label key={channel.id} className="vgroup-admin-option">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleLocalGroupChannel(channel.id)}
                      />
                      <span>{channel.name ?? channel.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="section-button"
                type="button"
                onClick={() => setShowLocalGroupModal(false)}
              >
                Cancel
              </button>
              <button
                className="mode-button"
                type="button"
                disabled={!localGroupName.trim()}
                onClick={handleCreateLocalGroup}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showVGroupAdmin ? (
        <div className="vgroup-admin">
          <div className="vgroup-admin-header">
            <div className="sections-title">Global V-Groups</div>
            <button className="mode-button" type="button" onClick={handleAddGlobalGroup}>
              + New V-Group
            </button>
          </div>
          {normalizedGlobalGroups.length === 0 && (
            <div className="section-empty">No global V-Groups yet</div>
          )}
          {normalizedGlobalGroups.map(group => (
            <div key={group.id} className="vgroup-admin-card">
              <div className="vgroup-admin-title">{group.name}</div>
              <div className="section-actions">
                <button
                  className="section-button"
                  type="button"
                  onClick={() => handleRenameGlobalGroup(group.id)}
                >
                  Rename
                </button>
                <button
                  className="section-button"
                  type="button"
                  onClick={() => handleRemoveGlobalGroup(group.id)}
                >
                  Remove
                </button>
              </div>
              <div className="vgroup-admin-channels">
                {state.channels.length === 0 ? (
                  <div className="section-empty">Load channels to assign</div>
                ) : (
                  state.channels.map(channel => {
                    const checked = group.channelIds.includes(channel.id);
                    return (
                      <label key={channel.id} className="vgroup-admin-option">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleGlobalGroupChannel(group.id, channel.id)}
                        />
                        <span>{channel.name ?? channel.label}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      ) : activeBus.type === 'aux' ? (
        <div className="sections-shell">
          <div className="sections-toolbar-shell">
            <div className="sections-toolbar">
              <div className="sections-actions">
                {normalizedGlobalGroups.map(group => {
                  const enabled = normalizedGlobalSettings[group.id]?.enabled ?? false;
                  return (
                    <button
                      key={group.id}
                      className={`section-button ${enabled ? 'mode-button-active' : ''}`}
                      type="button"
                      onClick={() => handleToggleGlobalGroupForView(group.id)}
                    >
                      {group.name}
                    </button>
                  );
                })}
                {normalizedGlobalGroups.length > 0 && normalizedLayout.length > 0 && (
                  <span className="section-divider" aria-hidden="true" />
                )}
                {normalizedLayout
                  .filter(group => group.id !== FAVORITES_ID) // Favorites is no longer a visible section
                  .map(group => {
                    const enabled = group.enabled ?? true;
                    const isOther = group.id === OTHERS_ID;
                    const isLocal = !isOther;
                    return (
                      <button
                        key={group.id}
                        className={`section-button ${enabled ? 'mode-button-active' : ''}`}
                        type="button"
                        onClick={() =>
                          handleToggleLocalGroupForView(group.id)
                        }
                      >
                        {isLocal ? `${group.name}` : group.name}
                      </button>
                    );
                  })}
                <button className="mode-button" type="button" onClick={handleAddSection}>
                  + Add V-Group
                </button>
                <button className="section-button" type="button" onClick={handleResetLayout}>
                  ↻ Reset
                </button>
              </div>
            </div>
          </div>
          <div
            ref={mixBoardRef}
            className={`mix-board-row ${
              mixDropTarget?.position === 'end' ? 'mix-drop-end-active' : ''
            }`}
            onDragOver={event => {
              if (!isMixItemDragEvent(event)) {
                return;
              }
              if ((event.target as HTMLElement).closest('.mix-drop-slot')) {
                return;
              }
              if ((event.target as HTMLElement).closest('.channel-stack, .section-stack')) {
                return;
              }
              const payload = getActiveMixDrag(event);
              if (!payload) {
                return;
              }
              event.preventDefault();
              setMixDropTarget({
                itemType: payload.kind === 'group' ? 'group' : 'channel',
                position: 'end',
              });
            }}
            onDragLeave={event => {
              if (event.currentTarget.contains(event.relatedTarget as Node)) {
                return;
              }
              setMixDropTarget(null);
            }}
            onDrop={event => {
              if (!isMixItemDragEvent(event)) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              const payload = getActiveMixDrag(event);
              const dropTarget = mixDropTarget;
              groupDragRef.current = null;
              channelItemDragRef.current = null;
              setMixDropTarget(null);
              if (!payload) {
                return;
              }
              if (!dropTarget || dropTarget.position !== 'end') {
                return;
              }
              const endTarget = resolveEndTarget();
              handleMixDrop(payload, endTarget.targetKey, endTarget.position);
            }}
          >
            {mixRowItems.map(item => {
              const itemKey = getMixItemKey(item);
              return (
                <Fragment key={itemKey}>
                  {renderMixDropSlot(itemKey)}
                  {renderMixRowItem(item)}
                </Fragment>
              );
            })}
            {renderMixDropSlot('__end__')}
          </div>
          <ChannelMinimap
            channels={minimapChannels}
            scrollContainerRef={mixBoardRef}
          />
        </div>
      ) : (
        <div className="sections-shell">
          <div className="sections-toolbar-shell">
            <div className="sections-toolbar">
              <div className="sections-actions">
                <button className="section-button" type="button" onClick={handleResetLayout}>
                  ↻ Reset
                </button>
              </div>
            </div>
          </div>
          <div
            ref={mixBoardRef}
            className={`mix-board-row ${
              mixDropTarget?.position === 'end' ? 'mix-drop-end-active' : ''
            }`}
            onDragOver={event => {
              if (!isMixItemDragEvent(event)) {
                return;
              }
              if ((event.target as HTMLElement).closest('.mix-drop-slot')) {
                return;
              }
              if ((event.target as HTMLElement).closest('.channel-stack, .section-stack')) {
                return;
              }
              const payload = getActiveMixDrag(event);
              if (!payload) {
                return;
              }
              event.preventDefault();
              setMixDropTarget({
                itemType: payload.kind === 'group' ? 'group' : 'channel',
                position: 'end',
              });
            }}
            onDragLeave={event => {
              if (event.currentTarget.contains(event.relatedTarget as Node)) {
                return;
              }
              setMixDropTarget(null);
            }}
            onDrop={event => {
              if (!isMixItemDragEvent(event)) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              const payload = getActiveMixDrag(event);
              const dropTarget = mixDropTarget;
              groupDragRef.current = null;
              channelItemDragRef.current = null;
              setMixDropTarget(null);
              if (!payload) {
                return;
              }
              if (!dropTarget || dropTarget.position !== 'end') {
                return;
              }
              const endTarget = resolveEndTarget();
              handleMixDrop(payload, endTarget.targetKey, endTarget.position);
            }}
          >
            {mixRowItems.map(item => {
              const itemKey = getMixItemKey(item);
              return (
                <Fragment key={itemKey}>
                  {renderMixDropSlot(itemKey)}
                  {renderMixRowItem(item)}
                </Fragment>
              );
            })}
            {renderMixDropSlot('__end__')}
          </div>
          <ChannelMinimap
            channels={minimapChannels}
            scrollContainerRef={mixBoardRef}
          />
        </div>
      )}
    </div>
  );
}
