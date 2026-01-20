import path from 'path';
import fs from 'fs';
import { config as loadEnv } from 'dotenv';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { z } from 'zod';

import { loadConfig } from './config.js';
import { LayoutStore } from './layout.js';
import { StateStore, type ChannelState } from './state.js';
import { Ui24rClient, type MixerUpdate } from './ui24rClient.js';
import { setupWs } from './ws.js';

loadEnv({ path: path.resolve(process.cwd(), '.env') });
loadEnv({ path: path.resolve(process.cwd(), '..', '.env'), override: false });

const config = loadConfig();
const AUX_BUS_IDS = Array.from({ length: 10 }, (_, index) => index + 1);
const initialHost = config.host ?? 'Not configured';
const state = new StateStore(initialHost, config.channels, AUX_BUS_IDS);
const client = new Ui24rClient(config.host ?? '', config.channels, AUX_BUS_IDS);
const legacyLayoutPath = path.resolve(process.cwd(), 'data', 'layout.json');

function sanitizeHost(host?: string) {
  const normalized = host?.trim().toLowerCase();
  if (!normalized) {
    return 'unknown';
  }
  const cleaned = normalized.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return cleaned || 'unknown';
}

function getLayoutPath(host?: string) {
  const name = sanitizeHost(host);
  return path.resolve(process.cwd(), 'data', `layout.${name}.json`);
}

const createLayoutStore = (host?: string) =>
  new LayoutStore(getLayoutPath(host), config.channels, AUX_BUS_IDS, legacyLayoutPath);

let layoutStore = createLayoutStore(config.host);

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(compress, { threshold: 1024 });
await app.register(websocket);

await layoutStore.load();

const { broadcast } = setupWs(app, () => state.getState());
const clientDistPath = path.resolve(process.cwd(), '..', 'client', 'dist');
const hasClientDist = fs.existsSync(clientDistPath);
if (hasClientDist) {
  await app.register(fastifyStatic, {
    root: clientDistPath,
    maxAge: '1d',
    immutable: false,
    setHeaders: (res, filePath) => {
      // Versioned assets (with hash in filename) can be cached indefinitely
      if (/\.[a-f0-9]{8,}\.(js|css)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  });
}

const faderSchema = z.object({ value: z.number() });
const muteSchema = z.object({ muted: z.boolean() });
const soloSchema = z.object({ solo: z.boolean() });
const connectSchema = z.object({ host: z.string().min(1) });
const layoutSectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  channelIds: z.array(z.number().int()),
  offsetDb: z.number().optional(),
  mode: z.enum(['default', 'ignore-inf', 'ignore-inf-sends']).optional(),
  enabled: z.boolean().optional(),
});
const globalGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  channelIds: z.array(z.number().int()),
});
const globalSettingsSchema = z.record(
  z.object({
    offsetDb: z.number().optional(),
    mode: z.enum(['default', 'ignore-inf', 'ignore-inf-sends']).optional(),
    enabled: z.boolean().optional(),
  })
);
const mixOrderItemSchema = z.union([
  z.object({
    kind: z.literal('group'),
    groupType: z.enum(['local', 'global']),
    id: z.string().min(1),
  }),
  z.object({
    kind: z.literal('channel'),
    id: z.number().int(),
  }),
]);
const viewSettingsSchema = z.object({
  offsetDb: z.number().optional(),
  simpleControls: z.boolean().optional(),
  mixOrder: z.array(mixOrderItemSchema).optional(),
});
const layoutSchema = z.object({
  sections: z.array(layoutSectionSchema).optional(),
  globalGroups: z.array(globalGroupSchema).optional(),
  globalSettings: globalSettingsSchema.optional(),
  viewSettings: viewSettingsSchema.optional(),
});
const busSchema = z.object({
  bus: z.enum(['master', 'aux', 'gain']).optional(),
  busId: z.string().optional(),
});

const pendingChannelBroadcasts = new Map<string, ChannelState>();
let pendingChannelFlush: NodeJS.Timeout | null = null;

function queueChannelBroadcast(channel: ChannelState) {
  pendingChannelBroadcasts.set(`${channel.busType}:${channel.bus}:${channel.id}`, channel);
  if (pendingChannelFlush) {
    return;
  }
  pendingChannelFlush = setTimeout(() => {
    pendingChannelFlush = null;
    const updates = Array.from(pendingChannelBroadcasts.values());
    pendingChannelBroadcasts.clear();
    updates.forEach(update => broadcast({ type: 'channel', data: update }));
  }, 0);
}

function parseChannelId(id: string) {
  const channelId = Number(id);
  if (!Number.isInteger(channelId)) {
    return null;
  }
  return config.channels.includes(channelId) ? channelId : null;
}

function parseBus(query: unknown) {
  const parsed = busSchema.safeParse(query);
  if (!parsed.success) {
    return { busType: 'master' as const, bus: 0 };
  }
  const busType = parsed.data.bus ?? 'master';
  if (busType === 'master') {
    return { busType, bus: 0 };
  }
  if (busType === 'gain') {
    return { busType, bus: 0 };
  }
  const busId = Number(parsed.data.busId ?? 1);
  if (!AUX_BUS_IDS.includes(busId)) {
    return { busType, bus: 1 };
  }
  return { busType, bus: busId };
}

app.get('/api/state', async (request) => {
  const { busType, bus } = parseBus(request.query);
  return state.getState(busType, bus);
});

app.get('/api/layout', async (request, reply) => {
  const { busType, bus } = parseBus(request.query);
  if (busType === 'aux') {
    return {
      sections: layoutStore.getAuxLayout(bus),
      globalGroups: layoutStore.getGlobalGroups(),
      globalSettings: layoutStore.getGlobalSettings('aux', bus),
      viewSettings: layoutStore.getViewSettings('aux', bus),
    };
  }
  if (busType === 'master' || busType === 'gain') {
    return {
      globalGroups: layoutStore.getGlobalGroups(),
      globalSettings: layoutStore.getGlobalSettings(busType),
      viewSettings: layoutStore.getViewSettings(busType),
    };
  }
  return reply.status(400).send({ error: 'Invalid bus type' });
});

app.put('/api/layout', async (request, reply) => {
  const { busType, bus } = parseBus(request.query);
  const parsed = layoutSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Invalid layout payload' });
  }
  if (parsed.data.sections && busType === 'aux') {
    await layoutStore.setAuxLayout(bus, parsed.data.sections);
  }
  if (parsed.data.globalGroups) {
    await layoutStore.setGlobalGroups(parsed.data.globalGroups);
  }
  if (parsed.data.globalSettings) {
    await layoutStore.setGlobalSettings(busType, parsed.data.globalSettings, bus);
  }
  if (parsed.data.viewSettings) {
    await layoutStore.setViewSettings(busType, parsed.data.viewSettings, bus);
  }
  return reply.status(204).send();
});

app.post('/api/connect', async (request, reply) => {
  const parsed = connectSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Invalid host payload' });
  }

  const host = parsed.data.host.trim();
  state.setHost(host);
  client.setHost(host);
  layoutStore = createLayoutStore(host);
  await layoutStore.load();
  broadcast({ type: 'state', data: state.getState() });
  return reply.status(204).send();
});

if (hasClientDist) {
  app.setNotFoundHandler((request, reply) => {
    if (request.raw.method !== 'GET') {
      return reply.status(404).send();
    }
    const url = request.raw.url ?? '';
    if (url.startsWith('/api') || url.startsWith('/ws')) {
      return reply.status(404).send();
    }
    return reply.sendFile('index.html');
  });
}

app.post('/api/channels/:id/fader', async (request, reply) => {
  const channelId = parseChannelId((request.params as { id: string }).id);
  if (!channelId) {
    return reply.status(400).send({ error: 'Invalid channel id' });
  }
  const { busType, bus } = parseBus(request.query);

  const parsed = faderSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Invalid fader payload' });
  }

  if (!client.isConnected()) {
    return reply.status(503).send({ error: 'Mixer is not connected' });
  }

  const value = Math.min(1, Math.max(0, parsed.data.value));
  client.setFader(busType, bus, channelId, value);
  state.updateChannel(busType, bus, channelId, {
    fader: value,
  });
  const faderDb = await client.getFaderDb(busType, bus, channelId);
  if (faderDb !== undefined) {
    state.updateChannel(busType, bus, channelId, { faderDb });
  }
  const updated = state.getChannel(busType, bus, channelId);
  if (updated) {
    queueChannelBroadcast(updated);
  }
  return reply.status(204).send();
});

app.post('/api/channels/:id/gain', async (request, reply) => {
  const channelId = parseChannelId((request.params as { id: string }).id);
  if (!channelId) {
    return reply.status(400).send({ error: 'Invalid channel id' });
  }

  const parsed = faderSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Invalid gain payload' });
  }

  if (!client.isConnected()) {
    return reply.status(503).send({ error: 'Mixer is not connected' });
  }

  const value = Math.min(1, Math.max(0, parsed.data.value));
  client.setFader('gain', 0, channelId, value);
  state.updateChannel('gain', 0, channelId, {
    fader: value,
  });
  const gainDb = await client.getGainDb(channelId);
  if (gainDb !== undefined) {
    state.updateChannel('gain', 0, channelId, { faderDb: gainDb });
  }
  const updated = state.getChannel('gain', 0, channelId);
  if (updated) {
    queueChannelBroadcast(updated);
  }
  return reply.status(204).send();
});

app.post('/api/channels/:id/mute', async (request, reply) => {
  const channelId = parseChannelId((request.params as { id: string }).id);
  if (!channelId) {
    return reply.status(400).send({ error: 'Invalid channel id' });
  }
  const { busType, bus } = parseBus(request.query);
  if (busType === 'gain') {
    return reply.status(400).send({ error: 'Mute not supported for gain view' });
  }

  const parsed = muteSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Invalid mute payload' });
  }

  if (!client.isConnected()) {
    return reply.status(503).send({ error: 'Mixer is not connected' });
  }

  client.setMute(busType, bus, channelId, parsed.data.muted);
  state.updateChannel(busType, bus, channelId, { muted: parsed.data.muted });
  const updated = state.getChannel(busType, bus, channelId);
  if (updated) {
    queueChannelBroadcast(updated);
  }
  return reply.status(204).send();
});

app.post('/api/channels/:id/solo', async (request, reply) => {
  const channelId = parseChannelId((request.params as { id: string }).id);
  if (!channelId) {
    return reply.status(400).send({ error: 'Invalid channel id' });
  }
  const { busType } = parseBus(request.query);
  if (busType !== 'master') {
    return reply.status(400).send({ error: 'Solo only supported for main mix' });
  }

  const parsed = soloSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Invalid solo payload' });
  }

  if (!client.isConnected()) {
    return reply.status(503).send({ error: 'Mixer is not connected' });
  }

  client.setSolo(channelId, parsed.data.solo);
  state.updateChannel('master', 0, channelId, { solo: parsed.data.solo });
  const updated = state.getChannel('master', 0, channelId);
  if (updated) {
    queueChannelBroadcast(updated);
  }
  return reply.status(204).send();
});

client.onUpdate(async (update: MixerUpdate) => {
  if (update.type === 'connection') {
    state.setConnectionStatus(update.status);
    broadcast({ type: 'status', data: { connectionStatus: update.status } });

    if (update.status === 'connected') {
      const auxNames = await client.getAuxBusNames(AUX_BUS_IDS);
      auxNames.forEach(aux => {
        state.updateAuxBus(aux.id, aux.name);
      });

      const masterSnapshot = await client.getChannelState('master', 0, config.channels);
      masterSnapshot.forEach(channel => {
        state.updateChannel('master', 0, channel.id, {
          fader: channel.fader,
          ...(channel.faderDb !== undefined ? { faderDb: channel.faderDb } : {}),
          muted: channel.muted,
          solo: channel.solo,
          ...(channel.name ? { name: channel.name } : {}),
        });
        if (channel.name) {
          state.updateChannel('gain', 0, channel.id, { name: channel.name });
          AUX_BUS_IDS.forEach(busId => {
            state.updateChannel('aux', busId, channel.id, { name: channel.name });
          });
        }
      });

      const gainSnapshot = await client.getChannelState('gain', 0, config.channels);
      gainSnapshot.forEach(channel => {
        state.updateChannel('gain', 0, channel.id, {
          fader: channel.fader,
          ...(channel.faderDb !== undefined ? { faderDb: channel.faderDb } : {}),
          ...(channel.name ? { name: channel.name } : {}),
        });
      });

      for (const busId of AUX_BUS_IDS) {
        const auxSnapshot = await client.getChannelState('aux', busId, config.channels);
        auxSnapshot.forEach(channel => {
          state.updateChannel('aux', busId, channel.id, {
            fader: channel.fader,
            ...(channel.faderDb !== undefined ? { faderDb: channel.faderDb } : {}),
            muted: channel.muted,
            ...(channel.name ? { name: channel.name } : {}),
          });
        });
      }

      broadcast({ type: 'state', data: state.getState('master', 0) });
    }
    return;
  }

  if (update.type === 'meter') {
    state.setMeter(update.id, {
      pre: update.meterPre,
      postFader: update.meterPostFader,
    });
    broadcast({
      type: 'meter',
      data: {
        id: update.id,
        meterPre: update.meterPre,
        meterPostFader: update.meterPostFader,
      },
    });
    return;
  }

  if (update.type === 'aux') {
    const next = state.updateAuxBus(update.id, update.name);
    if (next) {
      broadcast({ type: 'aux', data: next });
    }
    return;
  }

  const patch: {
    fader?: number;
    faderDb?: number;
    muted?: boolean;
    solo?: boolean;
    name?: string;
  } = {};
  if (update.fader !== undefined) {
    patch.fader = update.fader;
  }
  if (update.faderDb !== undefined) {
    patch.faderDb = update.faderDb;
  }
  if (update.muted !== undefined) {
    patch.muted = update.muted;
  }
  if (update.solo !== undefined) {
    patch.solo = update.solo;
  }
  if (update.name !== undefined) {
    patch.name = update.name;
  }

  const next = state.updateChannel(update.busType, update.bus, update.id, patch);
  if (next) {
    queueChannelBroadcast(next);
  }

  if (update.busType === 'master' && update.name) {
    const gainNext = state.updateChannel('gain', 0, update.id, { name: update.name });
    if (gainNext) {
      queueChannelBroadcast(gainNext);
    }
    AUX_BUS_IDS.forEach(busId => {
      const auxNext = state.updateChannel('aux', busId, update.id, { name: update.name });
      if (auxNext) {
        queueChannelBroadcast(auxNext);
      }
    });
  }
});

if (config.host) {
  client.start().catch((error: unknown) => {
    app.log.error(error, 'Failed to start mixer client');
  });
}

const port = Number(process.env.PORT ?? 3001);
app
  .listen({ port, host: '0.0.0.0' })
  .then(() => {
    app.log.info(`Server listening on ${port}`);
  })
  .catch(error => {
    app.log.error(error, 'Server failed to start');
    process.exit(1);
  });
