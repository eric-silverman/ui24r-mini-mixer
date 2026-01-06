import { SoundcraftUI, ConnectionStatus as MixerConnectionStatus } from 'soundcraft-ui-connection';
import { filter, firstValueFrom, sampleTime, Subscription, timeout } from 'rxjs';

import type { BusType, ConnectionStatus } from './state.js';

export type MixerChannelUpdate = {
  type: 'channel';
  id: number;
  busType: BusType;
  bus: number;
  fader?: number;
  faderDb?: number;
  muted?: boolean;
  solo?: boolean;
  name?: string;
};

export type MixerMeterUpdate = {
  type: 'meter';
  id: number;
  meterPre?: number;
  meterPostFader?: number;
};

export type MixerAuxUpdate = {
  type: 'aux';
  id: number;
  name: string;
};

export type MixerConnectionUpdate = {
  type: 'connection';
  status: ConnectionStatus;
};

export type MixerUpdate =
  | MixerChannelUpdate
  | MixerMeterUpdate
  | MixerConnectionUpdate
  | MixerAuxUpdate;

type UpdateHandler = (update: MixerUpdate) => void;

const DISCONNECT_EVENTS = [
  MixerConnectionStatus.Close,
  MixerConnectionStatus.Closing,
  MixerConnectionStatus.Error,
];

const RECONNECT_EVENTS = [
  MixerConnectionStatus.Opening,
  MixerConnectionStatus.Reconnecting,
];

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function sanitizeDb(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return undefined;
  }
  return value;
}

function mapStatus(status: MixerConnectionStatus): ConnectionStatus {
  if (status === MixerConnectionStatus.Open) {
    return 'connected';
  }
  if (RECONNECT_EVENTS.includes(status)) {
    return 'reconnecting';
  }
  return 'disconnected';
}

export class Ui24rClient {
  private host: string;
  private channelIds: number[];
  private channelIndexById: Map<number, number>;
  private auxBusIds: number[];
  private conn: SoundcraftUI | null = null;
  private subscriptions: Subscription[] = [];
  private debugEnabled = false;
  private debugSub: Subscription | null = null;
  private handlers = new Set<UpdateHandler>();
  private stopped = false;
  private lastValues = new Map<
    string,
    { fader?: number; faderDb?: number; muted?: boolean; solo?: boolean; name?: string }
  >();
  private connectionStatus: ConnectionStatus = 'disconnected';
  private lastMeters = new Map<number, { meterPre?: number; meterPostFader?: number }>();

  constructor(host: string, channelIds: number[], auxBusIds: number[]) {
    this.host = host;
    this.channelIds = channelIds;
    this.channelIndexById = new Map(channelIds.map((id, index) => [id, index]));
    this.auxBusIds = auxBusIds;
  }

  onUpdate(handler: UpdateHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  getStatus() {
    return this.connectionStatus;
  }

  setHost(host: string) {
    this.host = host;
    this.stop();
    if (host) {
      void this.start();
    } else {
      this.emitConnection('disconnected');
    }
  }

  isConnected() {
    return this.connectionStatus === 'connected';
  }

  setDebug(enabled: boolean) {
    this.debugEnabled = enabled;
    if (this.conn) {
      if (enabled && !this.debugSub) {
        this.debugSub = this.conn.conn.inbound$.subscribe(message => {
          // eslint-disable-next-line no-console
          console.log('[UI24R RAW]', message);
        });
      }
      if (!enabled && this.debugSub) {
        this.debugSub.unsubscribe();
        this.debugSub = null;
      }
    }
  }

  async start() {
    this.stopped = false;
    if (!this.host) {
      this.emitConnection('disconnected');
      return;
    }
    this.emitConnection('reconnecting');
    let delay = 250;

    while (!this.stopped) {
      try {
        await this.connectOnce();
        delay = 250;
        await this.waitForDisconnect();
      } catch (error) {
        this.emitConnection('disconnected');
      }

      if (this.stopped) {
        break;
      }

      this.emitConnection('reconnecting');
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, 5000);
    }
  }

  stop() {
    this.stopped = true;
    this.teardown();
  }

  async getChannelState(busType: BusType, bus: number, ids: number[]) {
    if (!this.conn) {
      throw new Error('Not connected');
    }

    const results = await Promise.all(
      ids.map(async id => {
        if (busType === 'gain') {
          const channel = this.conn!.hw(id);
          const [gain, gainDb, name] = await Promise.all([
            firstValueFrom(channel.gain$),
            firstValueFrom(channel.gainDB$),
            firstValueFrom(this.conn!.master.input(id).name$),
          ]);
          return {
            id,
            busType,
            bus,
            fader: clamp(gain ?? 0, 0, 1),
            faderDb: sanitizeDb(gainDb),
            muted: undefined,
            name: name ?? undefined,
          };
        }

        if (busType === 'master') {
          const channel = this.conn!.master.input(id);
          const [fader, faderDb, muted, solo, name] = await Promise.all([
            firstValueFrom(channel.faderLevel$),
            firstValueFrom(channel.faderLevelDB$),
            firstValueFrom(channel.mute$),
            firstValueFrom(channel.solo$),
            firstValueFrom(channel.name$),
          ]);
          return {
            id,
            busType,
            bus,
            fader: clamp(fader ?? 0, 0, 1),
            faderDb: sanitizeDb(faderDb),
            muted: muted === undefined ? undefined : !!muted,
            solo: solo === undefined ? undefined : !!solo,
            name: name ?? undefined,
          };
        }

        const channel = this.conn!.aux(bus).input(id);
        const [fader, faderDb, muted] = await Promise.all([
          firstValueFrom(channel.faderLevel$),
          firstValueFrom(channel.faderLevelDB$),
          firstValueFrom(channel.mute$),
        ]);
        return {
          id,
          busType,
          bus,
          fader: clamp(fader ?? 0, 0, 1),
          faderDb: sanitizeDb(faderDb),
          muted: muted === undefined ? undefined : !!muted,
          solo: undefined,
          name: undefined,
        };
      })
    );

    return results;
  }

  async getAuxBusNames(ids: number[]) {
    if (!this.conn) {
      throw new Error('Not connected');
    }

    const results = await Promise.all(
      ids.map(async id => {
        const auxChannel = this.conn!.master.aux(id);
        const name = await firstValueFrom(auxChannel.name$);
        return { id, name: name ?? `AUX ${id}` };
      })
    );

    return results;
  }

  setFader(busType: BusType, bus: number, id: number, value: number) {
    if (!this.conn) {
      throw new Error('Not connected');
    }
    if (busType === 'gain') {
      const channel = this.conn.hw(id);
      channel.setGain(clamp(value, 0, 1));
      return;
    }
    const channel = busType === 'master' ? this.conn.master.input(id) : this.conn.aux(bus).input(id);
    channel.setFaderLevel(clamp(value, 0, 1));
  }

  setMute(busType: BusType, bus: number, id: number, muted: boolean) {
    if (!this.conn) {
      throw new Error('Not connected');
    }
    const channel = busType === 'master' ? this.conn.master.input(id) : this.conn.aux(bus).input(id);
    channel.setMute(muted ? 1 : 0);
  }

  setSolo(id: number, solo: boolean) {
    if (!this.conn) {
      throw new Error('Not connected');
    }
    const channel = this.conn.master.input(id);
    channel.setSolo(solo ? 1 : 0);
  }

  async getGainDb(id: number) {
    if (!this.conn) {
      throw new Error('Not connected');
    }
    try {
      const value = await firstValueFrom(
        this.conn.hw(id).gainDB$.pipe(timeout({ first: 500 }))
      );
      return sanitizeDb(value);
    } catch {
      return undefined;
    }
  }

  async getFaderDb(busType: BusType, bus: number, id: number) {
    if (!this.conn) {
      throw new Error('Not connected');
    }
    if (busType === 'gain') {
      return undefined;
    }
    try {
      const channel =
        busType === 'master' ? this.conn.master.input(id) : this.conn.aux(bus).input(id);
      const value = await firstValueFrom(
        channel.faderLevelDB$.pipe(timeout({ first: 500 }))
      );
      return sanitizeDb(value);
    } catch {
      return undefined;
    }
  }

  private async connectOnce() {
    this.teardown();
    this.conn = new SoundcraftUI(this.host);

    const statusSub = this.conn.status$.subscribe(event => {
      if (event.type === MixerConnectionStatus.Error) {
        // eslint-disable-next-line no-console
        console.warn('[UI24R ERROR]', 'payload' in event ? event.payload : event);
      }
      const status = mapStatus(event.type);
      this.emitConnection(status);
    });

    this.subscriptions.push(statusSub);
    await this.conn.connect();
    this.emitConnection('connected');
    if (this.debugEnabled && this.conn) {
      this.debugSub = this.conn.conn.inbound$.subscribe(message => {
        // eslint-disable-next-line no-console
        console.log('[UI24R RAW]', message);
      });
    }
    this.bindChannelSubscriptions();
    this.bindGainSubscriptions();
    this.bindAuxSubscriptions();
    this.bindMeterSubscriptions();
  }

  private bindChannelSubscriptions() {
    if (!this.conn) {
      return;
    }

    this.channelIds.forEach(id => {
      const channel = this.conn!.master.input(id);
      const faderSub = channel.faderLevel$.subscribe(value => {
        const clamped = clamp(value ?? 0, 0, 1);
        this.emitChannelUpdate('master', 0, id, {
          fader: clamped,
        });
      });

      const faderDbSub = channel.faderLevelDB$.subscribe(value => {
        const dbValue = sanitizeDb(value);
        if (dbValue === undefined) {
          return;
        }
        this.emitChannelUpdate('master', 0, id, { faderDb: dbValue });
      });

      const muteSub = channel.mute$.subscribe(value => {
        if (value === undefined) {
          this.emitChannelUpdate('master', 0, id, { muted: undefined });
        } else {
          this.emitChannelUpdate('master', 0, id, { muted: !!value });
        }
      });

      const soloSub = channel.solo$.subscribe(value => {
        if (value === undefined) {
          this.emitChannelUpdate('master', 0, id, { solo: undefined });
        } else {
          this.emitChannelUpdate('master', 0, id, { solo: !!value });
        }
      });

      const nameSub = channel.name$.subscribe(name => {
        this.emitChannelUpdate('master', 0, id, { name: name ?? undefined });
      });

      this.subscriptions.push(faderSub, faderDbSub, muteSub, soloSub, nameSub);
    });

    this.auxBusIds.forEach(busId => {
      this.channelIds.forEach(id => {
        const channel = this.conn!.aux(busId).input(id);
        const faderSub = channel.faderLevel$.subscribe(value => {
          const clamped = clamp(value ?? 0, 0, 1);
          this.emitChannelUpdate('aux', busId, id, {
            fader: clamped,
          });
        });

        const faderDbSub = channel.faderLevelDB$.subscribe(value => {
          const dbValue = sanitizeDb(value);
          if (dbValue === undefined) {
            return;
          }
          this.emitChannelUpdate('aux', busId, id, { faderDb: dbValue });
        });

        const muteSub = channel.mute$.subscribe(value => {
          if (value === undefined) {
            this.emitChannelUpdate('aux', busId, id, { muted: undefined });
          } else {
            this.emitChannelUpdate('aux', busId, id, { muted: !!value });
          }
        });

        this.subscriptions.push(faderSub, faderDbSub, muteSub);
      });
    });
  }

  private bindGainSubscriptions() {
    if (!this.conn) {
      return;
    }

    this.channelIds.forEach(id => {
      const channel = this.conn!.hw(id);
      const gainSub = channel.gain$.subscribe(value => {
        const clamped = clamp(value ?? 0, 0, 1);
        this.emitChannelUpdate('gain', 0, id, {
          fader: clamped,
        });
      });
      const gainDbSub = channel.gainDB$.subscribe(value => {
        const dbValue = sanitizeDb(value);
        if (dbValue === undefined) {
          return;
        }
        this.emitChannelUpdate('gain', 0, id, { faderDb: dbValue });
      });
      this.subscriptions.push(gainSub, gainDbSub);
    });
  }

  private bindAuxSubscriptions() {
    if (!this.conn) {
      return;
    }

    this.auxBusIds.forEach(busId => {
      const auxChannel = this.conn!.master.aux(busId);
      const nameSub = auxChannel.name$.subscribe(name => {
        if (name) {
          this.emit({ type: 'aux', id: busId, name });
        }
      });
      this.subscriptions.push(nameSub);
    });
  }

  private bindMeterSubscriptions() {
    if (!this.conn) {
      return;
    }

    const meterSub = this.conn!.vuProcessor.vuData$.pipe(sampleTime(50)).subscribe(data => {
      if (!data) {
        return;
      }
      this.channelIds.forEach(id => {
        const index = this.channelIndexById.get(id);
        if (index === undefined) {
          return;
        }
        const input = data.input?.[index];
        if (!input) {
          return;
        }
        const meterPre = clamp(input.vuPre ?? 0, 0, 1);
        const meterPostFader = clamp(input.vuPostFader ?? 0, 0, 1);
        if (this.debugEnabled) {
          // eslint-disable-next-line no-console
          console.log('[UI24R VU]', { id, meterPre, meterPostFader });
        }
        this.emitMeterUpdate(id, { meterPre, meterPostFader });
      });
    });
    this.subscriptions.push(meterSub);
  }

  private async waitForDisconnect() {
    if (!this.conn) {
      return;
    }

    await firstValueFrom(
      this.conn.status$.pipe(filter(event => DISCONNECT_EVENTS.includes(event.type)))
    );
    this.emitConnection('disconnected');
  }

  private emitChannelUpdate(
    busType: BusType,
    bus: number,
    id: number,
    patch: { fader?: number; faderDb?: number; muted?: boolean; solo?: boolean; name?: string }
  ) {
    const key = `${busType}:${bus}:${id}`;
    const previous = this.lastValues.get(key) ?? {};
    const faderChanged =
      patch.fader !== undefined && Math.abs((previous.fader ?? -1) - patch.fader) > 0.0001;
    const faderDbChanged =
      patch.faderDb !== undefined &&
      Math.abs((previous.faderDb ?? -1000) - patch.faderDb) > 0.01;
    const muteChanged = patch.muted !== undefined && previous.muted !== patch.muted;
    const soloChanged = patch.solo !== undefined && previous.solo !== patch.solo;
    const nameChanged = patch.name !== undefined && previous.name !== patch.name;
    if (!faderChanged && !faderDbChanged && !muteChanged && !soloChanged && !nameChanged) {
      return;
    }

    this.lastValues.set(key, { ...previous, ...patch });
    this.emit({ type: 'channel', busType, bus, id, ...patch });
  }

  private emitMeterUpdate(
    id: number,
    patch: { meterPre?: number; meterPostFader?: number }
  ) {
    const previous = this.lastMeters.get(id) ?? {};
    const preChanged =
      patch.meterPre !== undefined &&
      Math.abs((previous.meterPre ?? -1) - patch.meterPre) > 0.005;
    const postChanged =
      patch.meterPostFader !== undefined &&
      Math.abs((previous.meterPostFader ?? -1) - patch.meterPostFader) > 0.005;
    if (!preChanged && !postChanged) {
      return;
    }
    this.lastMeters.set(id, { ...previous, ...patch });
    this.emit({ type: 'meter', id, ...patch });
  }

  private emitConnection(status: ConnectionStatus) {
    if (this.connectionStatus === status) {
      return;
    }
    this.connectionStatus = status;
    this.emit({ type: 'connection', status });
  }

  private emit(update: MixerUpdate) {
    this.handlers.forEach(handler => handler(update));
  }

  private teardown() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    if (this.debugSub) {
      this.debugSub.unsubscribe();
      this.debugSub = null;
    }
    if (this.conn) {
      this.conn.disconnect().catch(() => undefined);
    }
    this.conn = null;
  }
}
