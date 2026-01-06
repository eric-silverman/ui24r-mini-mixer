export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';
export type BusType = 'master' | 'aux' | 'gain';

export type ChannelState = {
  id: number;
  label: string;
  name?: string;
  busType: BusType;
  bus: number;
  fader: number;
  faderDb?: number;
  meterPre?: number;
  meterPostFader?: number;
  muted?: boolean;
  solo?: boolean;
  lastUpdatedAt: string;
};

export type AuxBusState = {
  id: number;
  name: string;
  lastUpdatedAt: string;
};

export type AppState = {
  host: string;
  connectionStatus: ConnectionStatus;
  bus: { type: BusType; id: number };
  auxBuses: AuxBusState[];
  channels: ChannelState[];
};

export type ChannelSection = {
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

export type GlobalGroupSettings = {
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

export type WsMessage =
  | { type: 'state'; data: AppState }
  | { type: 'channel'; data: ChannelState }
  | { type: 'meter'; data: { id: number; meterPre?: number; meterPostFader?: number } }
  | { type: 'aux'; data: AuxBusState }
  | { type: 'status'; data: { connectionStatus: ConnectionStatus } };
