import type { ChannelSection, GlobalGroup, GlobalGroupSettings, ViewSettings } from './types';

export type LayoutPayload = {
  sections?: ChannelSection[];
  globalGroups?: GlobalGroup[];
  globalSettings?: Record<string, GlobalGroupSettings>;
  viewSettings?: ViewSettings;
};

export async function fetchLayout(
  busType: 'master' | 'aux' | 'gain',
  busId?: number
): Promise<LayoutPayload> {
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
  payload: LayoutPayload
) {
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
