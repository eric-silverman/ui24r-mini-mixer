import type { ChannelSection, GlobalGroup, GlobalGroupSettings, ViewSettings } from './types';

export type LayoutPayload = {
  sections?: ChannelSection[];
  globalGroups?: GlobalGroup[];
  globalSettings?: Record<string, GlobalGroupSettings>;
  viewSettings?: ViewSettings;
};

const DEMO_STORAGE_PREFIX = 'ui24r-demo-layout';

function getDemoStorageKey(busType: 'master' | 'aux' | 'gain', busId?: number): string {
  if (busType === 'aux') {
    return `${DEMO_STORAGE_PREFIX}-aux-${busId ?? 1}`;
  }
  return `${DEMO_STORAGE_PREFIX}-${busType}`;
}

function fetchLayoutFromLocalStorage(
  busType: 'master' | 'aux' | 'gain',
  busId?: number
): LayoutPayload {
  const key = getDemoStorageKey(busType, busId);
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored) as LayoutPayload;
    } catch {
      return {};
    }
  }
  return {};
}

function saveLayoutToLocalStorage(
  busType: 'master' | 'aux' | 'gain',
  busId: number | undefined,
  payload: LayoutPayload
): void {
  const key = getDemoStorageKey(busType, busId);
  const existing = fetchLayoutFromLocalStorage(busType, busId);
  const merged = { ...existing, ...payload };
  localStorage.setItem(key, JSON.stringify(merged));
}

export async function fetchLayout(
  busType: 'master' | 'aux' | 'gain',
  busId?: number,
  demoMode = false
): Promise<LayoutPayload> {
  if (demoMode) {
    return fetchLayoutFromLocalStorage(busType, busId);
  }

  const params =
    busType === 'aux'
      ? `?bus=aux&busId=${encodeURIComponent(busId ?? 1)}`
      : busType === 'gain'
        ? '?bus=gain'
        : '?bus=master';
  const response = await fetch(`/api/layout${params}`);
  if (!response.ok) {
    throw new Error('Failed to load layout');
  }
  return (await response.json()) as LayoutPayload;
}

export async function saveLayout(
  busType: 'master' | 'aux' | 'gain',
  busId: number | undefined,
  payload: LayoutPayload,
  demoMode = false
) {
  if (demoMode) {
    saveLayoutToLocalStorage(busType, busId, payload);
    return;
  }

  const params =
    busType === 'aux'
      ? `?bus=aux&busId=${encodeURIComponent(busId ?? 1)}`
      : busType === 'gain'
        ? '?bus=gain'
        : '?bus=master';
  const response = await fetch(`/api/layout${params}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to save layout');
  }
}
