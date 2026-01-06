import type { WsMessage } from './types';

function getWsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/ws`;
}

export function connectWs(onMessage: (message: WsMessage) => void) {
  let socket: WebSocket | null = null;
  let stopped = false;
  let delay = 250;

  const connect = () => {
    if (stopped) {
      return;
    }

    socket = new WebSocket(getWsUrl());

    socket.onopen = () => {
      delay = 250;
    };

    socket.onmessage = event => {
      try {
        const message = JSON.parse(event.data) as WsMessage;
        onMessage(message);
      } catch {
        // ignore malformed messages
      }
    };

    socket.onclose = () => {
      if (stopped) {
        return;
      }
      setTimeout(connect, delay);
      delay = Math.min(delay * 2, 5000);
    };
  };

  connect();

  return () => {
    stopped = true;
    socket?.close();
  };
}
