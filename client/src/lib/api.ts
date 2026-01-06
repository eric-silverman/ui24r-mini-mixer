import type { AppState, BusType } from './types';

export async function fetchState(busType: BusType, bus: number): Promise<AppState> {
  const params =
    busType === 'aux'
      ? `?bus=aux&busId=${encodeURIComponent(bus)}`
      : busType === 'gain'
        ? '?bus=gain'
        : '?bus=master';
  const response = await fetch(`/api/state${params}`);
  if (!response.ok) {
    throw new Error('Failed to load state');
  }
  return response.json();
}

export async function setFader(busType: BusType, bus: number, id: number, value: number) {
  if (busType === 'gain') {
    const response = await fetch(`/api/channels/${id}/gain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });

    if (!response.ok) {
      throw new Error('Failed to set gain');
    }
    return;
  }

  const params =
    busType === 'aux' ? `?bus=aux&busId=${encodeURIComponent(bus)}` : '?bus=master';
  const response = await fetch(`/api/channels/${id}/fader${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });

  if (!response.ok) {
    throw new Error('Failed to set fader');
  }
}

export async function setMute(busType: BusType, bus: number, id: number, muted: boolean) {
  if (busType === 'gain') {
    return;
  }
  const params =
    busType === 'aux' ? `?bus=aux&busId=${encodeURIComponent(bus)}` : '?bus=master';
  const response = await fetch(`/api/channels/${id}/mute${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ muted }),
  });

  if (!response.ok) {
    throw new Error('Failed to set mute');
  }
}

export async function setSolo(busType: BusType, bus: number, id: number, solo: boolean) {
  if (busType !== 'master') {
    return;
  }
  const response = await fetch(`/api/channels/${id}/solo?bus=master`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ solo }),
  });

  if (!response.ok) {
    throw new Error('Failed to set solo');
  }
}

export async function connectMixer(host: string) {
  const response = await fetch('/api/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host }),
  });

  if (!response.ok) {
    throw new Error('Failed to connect mixer');
  }
}
