import type { AppState, AuxBusState, BusType, ChannelState } from './types';

const CHANNEL_LABELS = [
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

const AUX_NAMES = [
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

const buildAuxBuses = (timestamp: string): AuxBusState[] =>
  AUX_NAMES.map((name, index) => ({
    id: index + 1,
    name,
    lastUpdatedAt: timestamp,
  }));

const buildChannels = (busType: BusType, busId: number, timestamp: string): ChannelState[] =>
  CHANNEL_LABELS.map((label, index) => {
    const id = index + 1;
    const base = ((index * 7) % 24) / 24;
    return {
      id,
      label,
      name: label,
      busType,
      bus: busId,
      fader: Math.max(0.05, Math.min(0.95, 0.2 + base)),
      muted: index % 6 === 0,
      solo: busType === 'master' ? index === 14 || index === 15 : undefined,
      lastUpdatedAt: timestamp,
    };
  });

export const buildSampleState = (busType: BusType, busId: number): AppState => {
  const timestamp = new Date().toISOString();
  return {
    host: 'Sample Data (Dev Mode)',
    connectionStatus: 'connected', // Show as connected since sample data is loaded
    bus: { type: busType, id: busId },
    auxBuses: buildAuxBuses(timestamp),
    channels: buildChannels(busType, busId, timestamp),
  };
};
