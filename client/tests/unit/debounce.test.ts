/**
 * Throttle Utility Unit Tests
 *
 * Comprehensive tests for the throttle function with timing verification.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { throttle } from '../../src/lib/debounce';

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('immediate execution', () => {
    it('executes immediately on first call', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('arg1');

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('arg1');
    });

    it('executes immediately when enough time has passed', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('first');
      vi.advanceTimersByTime(100);
      throttled('second');

      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenNthCalledWith(1, 'first');
      expect(fn).toHaveBeenNthCalledWith(2, 'second');
    });

    it('executes immediately after throttle window expires', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('first');
      vi.advanceTimersByTime(150);
      throttled('second');

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('throttling behavior', () => {
    it('does not execute immediately within throttle window', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('first');
      throttled('second');

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('first');
    });

    it('schedules pending execution when called within throttle window', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('first');
      throttled('second');
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenNthCalledWith(2, 'second');
    });

    it('uses latest arguments for pending execution', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('first');
      throttled('second');
      throttled('third');
      throttled('fourth');
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenNthCalledWith(1, 'first');
      expect(fn).toHaveBeenNthCalledWith(2, 'fourth');
    });

    it('executes pending call at throttle window end', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('first');
      vi.advanceTimersByTime(50);
      throttled('second'); // Schedules timeout for remaining 50ms
      vi.advanceTimersByTime(50);
      // Pending call should have executed at 100ms mark

      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenNthCalledWith(1, 'first');
      expect(fn).toHaveBeenNthCalledWith(2, 'second');

      // After the pending executes, the 'last' timestamp is updated
      // So another 100ms must pass for immediate execution
      vi.advanceTimersByTime(100);
      throttled('third');
      expect(fn).toHaveBeenCalledTimes(3);
      expect(fn).toHaveBeenNthCalledWith(3, 'third');
    });
  });

  describe('timing precision', () => {
    it('respects exact throttle window', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('first');
      vi.advanceTimersByTime(99);
      throttled('second');

      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('handles zero wait time', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 0);

      throttled('first');
      throttled('second');
      throttled('third');

      // All should execute immediately with 0ms throttle
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('handles very small wait times', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 1);

      throttled('first'); // Immediate, last=T0
      throttled('second'); // Pending (remaining=1)
      vi.advanceTimersByTime(1); // Execute pending, last=T1
      // After pending executes, 'last' is updated, so we need to wait
      // another 1ms for the throttle window to expire
      vi.advanceTimersByTime(1);
      throttled('third'); // Now immediate (new window)

      // first (immediate), second (pending), third (immediate after wait)
      expect(fn).toHaveBeenCalledTimes(3);
      expect(fn).toHaveBeenNthCalledWith(1, 'first');
      expect(fn).toHaveBeenNthCalledWith(2, 'second');
      expect(fn).toHaveBeenNthCalledWith(3, 'third');
    });

    it('handles large wait times', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 10000);

      throttled('first');
      throttled('second');
      vi.advanceTimersByTime(5000);
      throttled('third');

      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(5000);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenNthCalledWith(2, 'third');
    });
  });

  describe('argument handling', () => {
    it('passes no arguments correctly', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();

      expect(fn).toHaveBeenCalledWith();
    });

    it('passes multiple arguments', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('a', 'b', 'c');

      expect(fn).toHaveBeenCalledWith('a', 'b', 'c');
    });

    it('passes object arguments', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);
      const obj = { key: 'value' };

      throttled(obj);

      expect(fn).toHaveBeenCalledWith(obj);
    });

    it('passes number arguments', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled(1, 2, 3);

      expect(fn).toHaveBeenCalledWith(1, 2, 3);
    });

    it('handles undefined and null arguments', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled(undefined, null);

      expect(fn).toHaveBeenCalledWith(undefined, null);
    });
  });

  describe('rapid calls', () => {
    it('handles burst of calls', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      for (let i = 0; i < 100; i++) {
        throttled(i);
      }

      // Only first call executed immediately
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(0);

      // After timeout, last call args used
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenNthCalledWith(2, 99);
    });

    it('handles calls spread across multiple throttle windows', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled(1);
      vi.advanceTimersByTime(50);
      throttled(2);
      vi.advanceTimersByTime(50);
      throttled(3);
      vi.advanceTimersByTime(50);
      throttled(4);
      vi.advanceTimersByTime(50);
      throttled(5);
      vi.advanceTimersByTime(100);

      // Should have: immediate(1), pending(2), immediate(3), pending(4), pending(5)
      expect(fn).toHaveBeenCalledTimes(4);
    });
  });

  describe('multiple throttled functions', () => {
    it('maintains independent state for different throttled functions', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      const throttled1 = throttle(fn1, 100);
      const throttled2 = throttle(fn2, 200);

      throttled1('a');
      throttled2('b');
      throttled1('c');
      throttled2('d');

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);

      expect(fn1).toHaveBeenCalledTimes(2);
      expect(fn2).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);

      expect(fn1).toHaveBeenCalledTimes(2);
      expect(fn2).toHaveBeenCalledTimes(2);
    });
  });

  describe('return value', () => {
    it('returns a function', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      expect(typeof throttled).toBe('function');
    });

    it('throttled function returns undefined', () => {
      const fn = vi.fn().mockReturnValue('result');
      const throttled = throttle(fn, 100);

      const result = throttled();

      expect(result).toBeUndefined();
    });
  });

  describe('context and this binding', () => {
    it('preserves function behavior without this context', () => {
      let called = false;
      const fn = () => {
        called = true;
      };
      const throttled = throttle(fn, 100);

      throttled();

      expect(called).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles function that throws', () => {
      const fn = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      const throttled = throttle(fn, 100);

      expect(() => throttled()).toThrow('Test error');
      expect(fn).toHaveBeenCalledTimes(1);

      // Should still allow future calls
      vi.advanceTimersByTime(100);
      expect(() => throttled()).toThrow('Test error');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('handles function that throws in scheduled execution', () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Scheduled error');
        }
      });
      const throttled = throttle(fn, 100);

      throttled('first');
      throttled('second');

      // First call succeeds
      expect(fn).toHaveBeenCalledTimes(1);

      // Scheduled call will throw
      expect(() => vi.advanceTimersByTime(100)).toThrow('Scheduled error');
    });
  });

  describe('real-world usage patterns', () => {
    it('simulates fader change throttling', () => {
      const sendFaderValue = vi.fn();
      const throttledFader = throttle(sendFaderValue, 60); // 60ms like in the app

      // Simulate rapid fader movement
      for (let i = 0; i <= 10; i++) {
        throttledFader(i / 10); // 0, 0.1, 0.2, ... 1.0
      }

      expect(sendFaderValue).toHaveBeenCalledTimes(1);
      expect(sendFaderValue).toHaveBeenCalledWith(0);

      vi.advanceTimersByTime(60);

      expect(sendFaderValue).toHaveBeenCalledTimes(2);
      expect(sendFaderValue).toHaveBeenNthCalledWith(2, 1);
    });

    it('simulates multiple channel fader changes', () => {
      const sendFaderValue = vi.fn();
      const throttledFader = throttle(sendFaderValue, 60);

      // Simulate changing faders on multiple channels rapidly
      throttledFader(1, 0.5);
      throttledFader(2, 0.6);
      throttledFader(1, 0.55);
      throttledFader(3, 0.7);

      expect(sendFaderValue).toHaveBeenCalledTimes(1);
      expect(sendFaderValue).toHaveBeenCalledWith(1, 0.5);

      vi.advanceTimersByTime(60);

      expect(sendFaderValue).toHaveBeenCalledTimes(2);
      expect(sendFaderValue).toHaveBeenNthCalledWith(2, 3, 0.7);
    });
  });
});
