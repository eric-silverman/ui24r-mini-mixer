/**
 * WebSocket Connection Unit Tests
 *
 * Tests for WebSocket connection, reconnection, and message handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { connectWs } from '../../src/lib/ws';
import type { WsMessage, AppState, ChannelState } from '../../src/lib/types';

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;

  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: Error) => void) | null = null;
  readyState = MockWebSocket.OPEN;
  closeCalled = false;

  constructor(url: string) {
    this.url = url;
  }

  close() {
    this.closeCalled = true;
    this.readyState = MockWebSocket.CLOSED;
  }

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateRawMessage(data: string) {
    this.onmessage?.({ data });
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  simulateError(error: Error) {
    this.onerror?.(error);
  }
}

let mockWebSocketInstance: MockWebSocket | null = null;
const mockWebSocketConstructor = vi.fn((url: string) => {
  mockWebSocketInstance = new MockWebSocket(url);
  return mockWebSocketInstance;
});

// Mock window.location
const mockLocation = {
  protocol: 'http:',
  host: 'localhost:5173',
};

vi.stubGlobal('WebSocket', mockWebSocketConstructor);
vi.stubGlobal('location', mockLocation);

describe('connectWs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockWebSocketConstructor.mockClear();
    mockWebSocketInstance = null;
    mockLocation.protocol = 'http:';
    mockLocation.host = 'localhost:5173';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('connection establishment', () => {
    it('creates WebSocket connection immediately', () => {
      const onMessage = vi.fn();
      connectWs(onMessage);

      expect(mockWebSocketConstructor).toHaveBeenCalledTimes(1);
      expect(mockWebSocketConstructor).toHaveBeenCalledWith('ws://localhost:5173/ws');
    });

    it('uses wss protocol for https', () => {
      mockLocation.protocol = 'https:';
      const onMessage = vi.fn();
      connectWs(onMessage);

      expect(mockWebSocketConstructor).toHaveBeenCalledWith('wss://localhost:5173/ws');
    });

    it('uses ws protocol for http', () => {
      mockLocation.protocol = 'http:';
      const onMessage = vi.fn();
      connectWs(onMessage);

      expect(mockWebSocketConstructor).toHaveBeenCalledWith('ws://localhost:5173/ws');
    });

    it('includes host in WebSocket URL', () => {
      mockLocation.host = 'mixer.local:3000';
      const onMessage = vi.fn();
      connectWs(onMessage);

      expect(mockWebSocketConstructor).toHaveBeenCalledWith('ws://mixer.local:3000/ws');
    });
  });

  describe('message handling', () => {
    it('calls onMessage with parsed message', () => {
      const onMessage = vi.fn();
      connectWs(onMessage);

      const message: WsMessage = {
        type: 'status',
        data: { connectionStatus: 'connected' },
      };
      mockWebSocketInstance!.simulateMessage(message);

      expect(onMessage).toHaveBeenCalledWith(message);
    });

    it('handles state messages', () => {
      const onMessage = vi.fn();
      connectWs(onMessage);

      const appState: AppState = {
        host: 'test',
        connectionStatus: 'connected',
        bus: { type: 'master', id: 0 },
        auxBuses: [],
        channels: [],
      };
      const message: WsMessage = { type: 'state', data: appState };
      mockWebSocketInstance!.simulateMessage(message);

      expect(onMessage).toHaveBeenCalledWith(message);
    });

    it('handles channel messages', () => {
      const onMessage = vi.fn();
      connectWs(onMessage);

      const channel: ChannelState = {
        id: 1,
        label: 'CH 1',
        busType: 'master',
        bus: 0,
        fader: 0.5,
        faderDb: -30,
        lastUpdatedAt: '2024-01-01T00:00:00Z',
      };
      const message: WsMessage = { type: 'channel', data: channel };
      mockWebSocketInstance!.simulateMessage(message);

      expect(onMessage).toHaveBeenCalledWith(message);
    });

    it('handles meter messages', () => {
      const onMessage = vi.fn();
      connectWs(onMessage);

      const message: WsMessage = {
        type: 'meter',
        data: { id: 1, meterPre: 0.5, meterPostFader: 0.4 },
      };
      mockWebSocketInstance!.simulateMessage(message);

      expect(onMessage).toHaveBeenCalledWith(message);
    });

    it('handles aux messages', () => {
      const onMessage = vi.fn();
      connectWs(onMessage);

      const message: WsMessage = {
        type: 'aux',
        data: { id: 1, name: 'Aux 1', lastUpdatedAt: '2024-01-01T00:00:00Z' },
      };
      mockWebSocketInstance!.simulateMessage(message);

      expect(onMessage).toHaveBeenCalledWith(message);
    });

    it('ignores malformed JSON messages silently', () => {
      const onMessage = vi.fn();
      connectWs(onMessage);

      // Should not throw
      expect(() => {
        mockWebSocketInstance!.simulateRawMessage('not valid json{{{');
      }).not.toThrow();

      expect(onMessage).not.toHaveBeenCalled();
    });

    it('ignores empty messages silently', () => {
      const onMessage = vi.fn();
      connectWs(onMessage);

      expect(() => {
        mockWebSocketInstance!.simulateRawMessage('');
      }).not.toThrow();

      expect(onMessage).not.toHaveBeenCalled();
    });
  });

  describe('reconnection logic', () => {
    it('reconnects on connection close', () => {
      const onMessage = vi.fn();
      connectWs(onMessage);

      expect(mockWebSocketConstructor).toHaveBeenCalledTimes(1);

      mockWebSocketInstance!.simulateClose();
      vi.advanceTimersByTime(250);

      expect(mockWebSocketConstructor).toHaveBeenCalledTimes(2);
    });

    it('uses exponential backoff on reconnection', () => {
      const onMessage = vi.fn();
      connectWs(onMessage);

      // First close - 250ms delay
      mockWebSocketInstance!.simulateClose();
      expect(mockWebSocketConstructor).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(250);
      expect(mockWebSocketConstructor).toHaveBeenCalledTimes(2);

      // Second close - 500ms delay
      mockWebSocketInstance!.simulateClose();
      vi.advanceTimersByTime(250);
      expect(mockWebSocketConstructor).toHaveBeenCalledTimes(2);
      vi.advanceTimersByTime(250);
      expect(mockWebSocketConstructor).toHaveBeenCalledTimes(3);

      // Third close - 1000ms delay
      mockWebSocketInstance!.simulateClose();
      vi.advanceTimersByTime(500);
      expect(mockWebSocketConstructor).toHaveBeenCalledTimes(3);
      vi.advanceTimersByTime(500);
      expect(mockWebSocketConstructor).toHaveBeenCalledTimes(4);
    });

    it('caps backoff at 5000ms', () => {
      const onMessage = vi.fn();
      connectWs(onMessage);

      // Simulate many disconnections to reach max backoff
      for (let i = 0; i < 10; i++) {
        mockWebSocketInstance!.simulateClose();
        vi.advanceTimersByTime(5000);
      }

      const callCount = mockWebSocketConstructor.mock.calls.length;

      // One more close - should still be 5000ms
      mockWebSocketInstance!.simulateClose();
      vi.advanceTimersByTime(4999);
      expect(mockWebSocketConstructor).toHaveBeenCalledTimes(callCount);
      vi.advanceTimersByTime(1);
      expect(mockWebSocketConstructor).toHaveBeenCalledTimes(callCount + 1);
    });

    it('resets backoff on successful connection', () => {
      const onMessage = vi.fn();
      connectWs(onMessage);

      // Close and wait for backoff to increase
      mockWebSocketInstance!.simulateClose();
      vi.advanceTimersByTime(250);
      mockWebSocketInstance!.simulateClose();
      vi.advanceTimersByTime(500);

      // Now simulate successful connection
      mockWebSocketInstance!.simulateOpen();

      // Close again - should be back to 250ms
      mockWebSocketInstance!.simulateClose();
      const callsBefore = mockWebSocketConstructor.mock.calls.length;
      vi.advanceTimersByTime(249);
      expect(mockWebSocketConstructor).toHaveBeenCalledTimes(callsBefore);
      vi.advanceTimersByTime(1);
      expect(mockWebSocketConstructor).toHaveBeenCalledTimes(callsBefore + 1);
    });
  });

  describe('cleanup function', () => {
    it('returns cleanup function', () => {
      const onMessage = vi.fn();
      const cleanup = connectWs(onMessage);

      expect(typeof cleanup).toBe('function');
    });

    it('closes WebSocket on cleanup', () => {
      const onMessage = vi.fn();
      const cleanup = connectWs(onMessage);

      cleanup();

      expect(mockWebSocketInstance!.closeCalled).toBe(true);
    });

    it('stops reconnection after cleanup', () => {
      const onMessage = vi.fn();
      const cleanup = connectWs(onMessage);

      cleanup();
      mockWebSocketInstance!.simulateClose();
      vi.advanceTimersByTime(10000);

      // Should only have the initial connection
      expect(mockWebSocketConstructor).toHaveBeenCalledTimes(1);
    });

    it('handles cleanup when WebSocket is null', () => {
      const onMessage = vi.fn();

      // This tests the optional chaining in cleanup
      const cleanup = connectWs(onMessage);

      // Force websocket to be null-ish state
      mockWebSocketInstance = null;

      expect(() => cleanup()).not.toThrow();
    });
  });

  describe('multiple messages', () => {
    it('handles rapid successive messages', () => {
      const onMessage = vi.fn();
      connectWs(onMessage);

      for (let i = 0; i < 100; i++) {
        mockWebSocketInstance!.simulateMessage({
          type: 'meter',
          data: { id: i % 24, meterPre: Math.random() },
        });
      }

      expect(onMessage).toHaveBeenCalledTimes(100);
    });

    it('handles mixed message types', () => {
      const onMessage = vi.fn();
      connectWs(onMessage);

      mockWebSocketInstance!.simulateMessage({
        type: 'status',
        data: { connectionStatus: 'connected' },
      });
      mockWebSocketInstance!.simulateMessage({
        type: 'meter',
        data: { id: 1, meterPre: 0.5 },
      });
      mockWebSocketInstance!.simulateMessage({
        type: 'channel',
        data: {
          id: 1,
          label: 'CH 1',
          busType: 'master',
          bus: 0,
          fader: 0.6,
          lastUpdatedAt: '2024-01-01T00:00:00Z',
        },
      });

      expect(onMessage).toHaveBeenCalledTimes(3);
      expect(onMessage.mock.calls[0][0].type).toBe('status');
      expect(onMessage.mock.calls[1][0].type).toBe('meter');
      expect(onMessage.mock.calls[2][0].type).toBe('channel');
    });
  });

  describe('edge cases', () => {
    it('handles connection that never opens', () => {
      const onMessage = vi.fn();
      connectWs(onMessage);

      // Immediately close without ever opening
      mockWebSocketInstance!.simulateClose();
      vi.advanceTimersByTime(250);

      expect(mockWebSocketConstructor).toHaveBeenCalledTimes(2);
    });

    it('handles message before open event', () => {
      const onMessage = vi.fn();
      connectWs(onMessage);

      // Message arrives before open (edge case)
      mockWebSocketInstance!.simulateMessage({
        type: 'status',
        data: { connectionStatus: 'connected' },
      });

      expect(onMessage).toHaveBeenCalled();
    });

    it('handles cleanup during reconnection delay', () => {
      const onMessage = vi.fn();
      const cleanup = connectWs(onMessage);

      mockWebSocketInstance!.simulateClose();
      vi.advanceTimersByTime(100); // Part way through delay

      cleanup();
      vi.advanceTimersByTime(200); // Rest of delay + more

      // Should not have reconnected
      expect(mockWebSocketConstructor).toHaveBeenCalledTimes(1);
    });
  });
});
