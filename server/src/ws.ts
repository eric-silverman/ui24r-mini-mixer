import type { FastifyInstance } from 'fastify';

import type { AppState, AuxBusState, ChannelState, ConnectionStatus } from './state.js';

type ClientSocket = {
  OPEN: number;
  readyState: number;
  send: (data: string) => void;
  on: (event: 'close', handler: () => void) => void;
};

export type WsMessage =
  | { type: 'state'; data: AppState }
  | { type: 'channel'; data: ChannelState }
  | {
      type: 'meter';
      data: { id: number; meterPre?: number; meterPostFader?: number };
    }
  | { type: 'aux'; data: AuxBusState }
  | { type: 'status'; data: { connectionStatus: ConnectionStatus } };

export function setupWs(
  fastify: FastifyInstance,
  getState: () => AppState
) {
  const clients = new Set<ClientSocket>();

  fastify.get('/ws', { websocket: true }, connection => {
    const socket = connection.socket as ClientSocket;
    clients.add(socket);
    const payload: WsMessage = { type: 'state', data: getState() };
    socket.send(JSON.stringify(payload));
    socket.on('close', () => {
      clients.delete(socket);
    });
  });

  function broadcast(message: WsMessage) {
    const payload = JSON.stringify(message);
    clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    });
  }

  return { broadcast };
}
