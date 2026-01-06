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

export class StateStore {
  private host: string;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private channels = new Map<string, ChannelState>();
  private auxBuses = new Map<number, AuxBusState>();
  private meters = new Map<number, { pre?: number; postFader?: number }>();

  constructor(host: string, channelIds: number[], auxBusIds: number[]) {
    this.host = host;
    const now = new Date().toISOString();
    channelIds.forEach(id => {
      this.channels.set(this.channelKey('master', 0, id), {
        id,
        label: `CH ${id}`,
        busType: 'master',
        bus: 0,
        fader: 0,
        muted: undefined,
        lastUpdatedAt: now,
      });
      this.channels.set(this.channelKey('gain', 0, id), {
        id,
        label: `CH ${id}`,
        busType: 'gain',
        bus: 0,
        fader: 0,
        muted: undefined,
        lastUpdatedAt: now,
      });
    });
    auxBusIds.forEach(busId => {
      this.auxBuses.set(busId, {
        id: busId,
        name: `AUX ${busId}`,
        lastUpdatedAt: now,
      });
      channelIds.forEach(id => {
        this.channels.set(this.channelKey('aux', busId, id), {
          id,
          label: `CH ${id}`,
          busType: 'aux',
          bus: busId,
          fader: 0,
          muted: undefined,
          lastUpdatedAt: now,
        });
      });
    });
  }

  getState(busType: BusType = 'master', bus = 0): AppState {
    return {
      host: this.host,
      connectionStatus: this.connectionStatus,
      bus: { type: busType, id: bus },
      auxBuses: Array.from(this.auxBuses.values()).sort((a, b) => a.id - b.id),
      channels: Array.from(this.channels.values())
        .filter(channel => channel.busType === busType && channel.bus === bus)
        .sort((a, b) => a.id - b.id)
        .map(channel => {
          const meter = this.meters.get(channel.id);
          return {
            ...channel,
            meterPre: meter?.pre ?? channel.meterPre,
            meterPostFader: meter?.postFader ?? channel.meterPostFader,
          };
        }),
    };
  }

  setConnectionStatus(status: ConnectionStatus) {
    this.connectionStatus = status;
  }

  setHost(host: string) {
    this.host = host;
  }

  updateChannel(
    busType: BusType,
    bus: number,
    id: number,
    patch: Partial<Omit<ChannelState, 'id' | 'label' | 'busType' | 'bus'>>
  ): ChannelState | null {
    const existing = this.channels.get(this.channelKey(busType, bus, id));
    if (!existing) {
      return null;
    }

    const next: ChannelState = {
      ...existing,
      ...patch,
      lastUpdatedAt: new Date().toISOString(),
    };
    this.channels.set(this.channelKey(busType, bus, id), next);
    return next;
  }

  getChannel(busType: BusType, bus: number, id: number): ChannelState | null {
    return this.channels.get(this.channelKey(busType, bus, id)) ?? null;
  }

  updateAuxBus(id: number, name: string): AuxBusState | null {
    const existing = this.auxBuses.get(id);
    if (!existing) {
      return null;
    }
    const next: AuxBusState = {
      ...existing,
      name,
      lastUpdatedAt: new Date().toISOString(),
    };
    this.auxBuses.set(id, next);
    return next;
  }

  setMeter(id: number, meter: { pre?: number; postFader?: number }) {
    const current = this.meters.get(id) ?? {};
    this.meters.set(id, { ...current, ...meter });
  }

  private channelKey(busType: BusType, bus: number, id: number) {
    return `${busType}:${bus}:${id}`;
  }
}
