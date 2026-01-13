/**
 * ChannelStrip Component Unit Tests
 *
 * Tests for the ChannelStrip component, focusing on LCD display behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChannelStrip from '../../src/components/ChannelStrip';
import type { ChannelState } from '../../src/lib/types';

const createMockChannel = (overrides?: Partial<ChannelState>): ChannelState => ({
  id: 1,
  label: 'CH 1',
  name: 'Test Channel',
  busType: 'master',
  bus: 0,
  fader: 0.5,
  faderDb: undefined,
  muted: false,
  solo: false,
  lastUpdatedAt: new Date().toISOString(),
  ...overrides,
});

describe('ChannelStrip', () => {
  const mockHandlers = {
    onFaderChange: vi.fn(),
    onMuteToggle: vi.fn(),
    onSoloToggle: vi.fn(),
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('LCD Display', () => {
    it('displays calculated dB when faderDb is undefined', () => {
      const channel = createMockChannel({ fader: 0.5, faderDb: undefined });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={false}
          {...mockHandlers}
        />
      );

      // fader 0.5 = -30 dB
      expect(screen.getByText('-30 dB')).toBeInTheDocument();
    });

    it('displays faderDb when present', () => {
      const channel = createMockChannel({ fader: 0.5, faderDb: -28.5 });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={false}
          {...mockHandlers}
        />
      );

      // Should round to nearest integer
      expect(screen.getByText('-28 dB') || screen.getByText('-29 dB')).toBeTruthy();
    });

    it('displays 0 dB for fader at 1', () => {
      const channel = createMockChannel({ fader: 1, faderDb: undefined });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={false}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('0 dB')).toBeInTheDocument();
    });

    it('displays -60 dB for fader at 0', () => {
      const channel = createMockChannel({ fader: 0, faderDb: undefined });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={false}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('-60 dB')).toBeInTheDocument();
    });

    it('displays various dB values correctly', () => {
      const testCases = [
        { fader: 0.75, expectedDb: '-15 dB' },
        { fader: 0.25, expectedDb: '-45 dB' },
        { fader: 0.9, expectedDb: '-6 dB' },
      ];

      for (const testCase of testCases) {
        const channel = createMockChannel({
          fader: testCase.fader,
          faderDb: undefined,
        });

        const { unmount } = render(
          <ChannelStrip
            channel={channel}
            highlight={false}
            showMute={true}
            simpleControls={false}
            {...mockHandlers}
          />
        );

        expect(screen.getByText(testCase.expectedDb)).toBeInTheDocument();
        unmount();
      }
    });
  });

  describe('Channel Label', () => {
    it('displays channel name when available', () => {
      const channel = createMockChannel({ name: 'Kick Drum', label: 'CH 1' });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={false}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('Kick Drum')).toBeInTheDocument();
    });

    it('falls back to label when name is not available', () => {
      const channel = createMockChannel({ name: undefined, label: 'CH 1' });

      const { container } = render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={false}
          {...mockHandlers}
        />
      );

      // Label appears in strip-id (header area)
      const stripId = container.querySelector('.strip-id');
      expect(stripId).toHaveTextContent('CH 1');
    });
  });

  describe('Fader Interaction', () => {
    it('calls onFaderChange when fader is moved (regular mode)', () => {
      const channel = createMockChannel({ fader: 0.5 });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={false}
          {...mockHandlers}
        />
      );

      const fader = screen.getByRole('slider');
      fireEvent.change(fader, { target: { value: '0.75' } });

      expect(mockHandlers.onFaderChange).toHaveBeenCalledWith(1, 0.75);
    });

    it('clamps fader values above 1', () => {
      const channel = createMockChannel({ fader: 0.5 });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={false}
          {...mockHandlers}
        />
      );

      const fader = screen.getByRole('slider');
      fireEvent.change(fader, { target: { value: '1.5' } });

      // The component should clamp to 1
      expect(mockHandlers.onFaderChange).toHaveBeenCalledWith(1, 1);
    });

    it('clamps fader values below 0', () => {
      const channel = createMockChannel({ fader: 0.5 });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={false}
          {...mockHandlers}
        />
      );

      const fader = screen.getByRole('slider');
      fireEvent.change(fader, { target: { value: '-0.5' } });

      expect(mockHandlers.onFaderChange).toHaveBeenCalledWith(1, 0);
    });
  });

  describe('Simple Controls Mode', () => {
    const STEP = 1 / 60; // As defined in the component

    it('shows + and - buttons in simple controls mode', () => {
      const channel = createMockChannel({ fader: 0.5 });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={true}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('+')).toBeInTheDocument();
      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('calls onFaderChange with incremented value when + is clicked', () => {
      const channel = createMockChannel({ fader: 0.5 });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={true}
          {...mockHandlers}
        />
      );

      fireEvent.click(screen.getByText('+'));

      expect(mockHandlers.onFaderChange).toHaveBeenCalledWith(
        1,
        expect.closeTo(0.5 + STEP, 5)
      );
    });

    it('calls onFaderChange with decremented value when - is clicked', () => {
      const channel = createMockChannel({ fader: 0.5 });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={true}
          {...mockHandlers}
        />
      );

      fireEvent.click(screen.getByText('-'));

      expect(mockHandlers.onFaderChange).toHaveBeenCalledWith(
        1,
        expect.closeTo(0.5 - STEP, 5)
      );
    });

    it('clamps to 0 when - is clicked at minimum', () => {
      const channel = createMockChannel({ fader: 0 });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={true}
          {...mockHandlers}
        />
      );

      fireEvent.click(screen.getByText('-'));

      expect(mockHandlers.onFaderChange).toHaveBeenCalledWith(1, 0);
    });

    it('clamps to 1 when + is clicked at maximum', () => {
      const channel = createMockChannel({ fader: 1 });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={true}
          {...mockHandlers}
        />
      );

      fireEvent.click(screen.getByText('+'));

      expect(mockHandlers.onFaderChange).toHaveBeenCalledWith(1, 1);
    });

    it('hides regular fader in simple controls mode', () => {
      const channel = createMockChannel({ fader: 0.5 });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={true}
          {...mockHandlers}
        />
      );

      // Slider should not be present in simple controls mode
      expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    });
  });

  describe('Mute Button', () => {
    it('shows mute button when muted is defined', () => {
      const channel = createMockChannel({ muted: false });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={false}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('MUTE')).toBeInTheDocument();
    });

    it('calls onMuteToggle when clicked', () => {
      const channel = createMockChannel({ muted: false });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={false}
          {...mockHandlers}
        />
      );

      fireEvent.click(screen.getByText('MUTE'));

      expect(mockHandlers.onMuteToggle).toHaveBeenCalledWith(1, true);
    });

    it('hides mute button when showMute is false', () => {
      const channel = createMockChannel({ muted: false });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={false}
          simpleControls={false}
          {...mockHandlers}
        />
      );

      expect(screen.queryByText('MUTE')).not.toBeInTheDocument();
    });
  });

  describe('Solo Button', () => {
    it('shows solo button on master bus', () => {
      const channel = createMockChannel({
        busType: 'master',
        bus: 0,
        solo: false,
      });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={false}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('SOLO')).toBeInTheDocument();
    });

    it('disables solo button on aux bus', () => {
      const channel = createMockChannel({
        busType: 'aux',
        bus: 1,
        solo: undefined,
      });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={false}
          {...mockHandlers}
        />
      );

      // Solo button is shown but disabled on aux bus
      const soloButton = screen.getByText('SOLO');
      expect(soloButton).toBeDisabled();
    });

    it('calls onSoloToggle when clicked', () => {
      const channel = createMockChannel({
        busType: 'master',
        bus: 0,
        solo: false,
      });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={false}
          {...mockHandlers}
        />
      );

      fireEvent.click(screen.getByText('SOLO'));

      expect(mockHandlers.onSoloToggle).toHaveBeenCalledWith(1, true);
    });
  });

  describe('Highlight State', () => {
    it('applies highlight class when highlight is true', () => {
      const channel = createMockChannel();

      const { container } = render(
        <ChannelStrip
          channel={channel}
          highlight={true}
          showMute={true}
          simpleControls={false}
          {...mockHandlers}
        />
      );

      expect(container.querySelector('.channel-flash')).toBeInTheDocument();
    });

    it('does not apply highlight class when highlight is false', () => {
      const channel = createMockChannel();

      const { container } = render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={false}
          {...mockHandlers}
        />
      );

      expect(container.querySelector('.channel-flash')).not.toBeInTheDocument();
    });
  });

  describe('Aux Bus Specific Behavior', () => {
    it('displays correctly on aux bus', () => {
      const channel = createMockChannel({
        busType: 'aux',
        bus: 3,
        fader: 0.6,
        faderDb: undefined,
        solo: undefined, // No solo on aux
      });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={false}
          {...mockHandlers}
        />
      );

      // LCD should show calculated value: 0.6 * 60 - 60 = -24 dB
      expect(screen.getByText('-24 dB')).toBeInTheDocument();

      // Mute should still be visible
      expect(screen.getByText('MUTE')).toBeInTheDocument();

      // Solo button is shown but disabled on aux
      const soloButton = screen.getByText('SOLO');
      expect(soloButton).toBeDisabled();
    });

    it('works with simple controls on aux bus', () => {
      const channel = createMockChannel({
        busType: 'aux',
        bus: 2,
        fader: 0.5,
        faderDb: undefined,
      });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={true}
          {...mockHandlers}
        />
      );

      // LCD should show calculated value
      expect(screen.getByText('-30 dB')).toBeInTheDocument();

      // + and - buttons should work
      fireEvent.click(screen.getByText('+'));
      expect(mockHandlers.onFaderChange).toHaveBeenCalled();
    });
  });

  describe('Gain Mode', () => {
    it('displays correctly in gain mode', () => {
      const channel = createMockChannel({
        busType: 'gain',
        bus: 0,
        fader: 0.5,
        faderDb: undefined,
        muted: undefined, // No mute in gain mode
        solo: undefined,
      });

      render(
        <ChannelStrip
          channel={channel}
          highlight={false}
          showMute={true}
          simpleControls={false}
          {...mockHandlers}
        />
      );

      // LCD should still show value
      expect(screen.getByText('-30 dB')).toBeInTheDocument();
    });
  });
});

describe('ChannelStrip - dB Display Bug Fix Verification', () => {
  /**
   * These tests specifically verify that the LCD display bug fix is working.
   * The bug was: when changing fader on aux mix, LCD showed stale faderDb.
   * The fix: clear faderDb during optimistic update.
   */

  const mockHandlers = {
    onFaderChange: vi.fn(),
    onMuteToggle: vi.fn(),
    onSoloToggle: vi.fn(),
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows calculated dB immediately when faderDb is undefined (fix working)', () => {
    // Simulate state after optimistic update with fix applied
    const channelAfterFix = createMockChannel({
      busType: 'aux',
      bus: 1,
      fader: 0.75, // New fader position
      faderDb: undefined, // Cleared by the fix
    });

    render(
      <ChannelStrip
        channel={channelAfterFix}
        highlight={false}
        showMute={true}
        simpleControls={false}
        {...mockHandlers}
      />
    );

    // Should show the calculated value: 0.75 * 60 - 60 = -15 dB
    expect(screen.getByText('-15 dB')).toBeInTheDocument();
  });

  it('would show stale value if faderDb was not cleared (bug demonstration)', () => {
    // This demonstrates what the bug looked like
    const channelWithBug = createMockChannel({
      busType: 'aux',
      bus: 1,
      fader: 0.75, // New fader position
      faderDb: -30, // OLD stale value that wasn't cleared
    });

    render(
      <ChannelStrip
        channel={channelWithBug}
        highlight={false}
        showMute={true}
        simpleControls={false}
        {...mockHandlers}
      />
    );

    // Bug: would show -30 dB instead of -15 dB
    expect(screen.getByText('-30 dB')).toBeInTheDocument();
  });

  it('updates display when server responds with actual faderDb', () => {
    // After server responds, faderDb is set with the precise value
    const channelAfterServerResponse = createMockChannel({
      busType: 'aux',
      bus: 1,
      fader: 0.75,
      faderDb: -14.8, // Precise value from server
    });

    render(
      <ChannelStrip
        channel={channelAfterServerResponse}
        highlight={false}
        showMute={true}
        simpleControls={false}
        {...mockHandlers}
      />
    );

    // Should show rounded server value
    expect(screen.getByText('-15 dB')).toBeInTheDocument();
  });
});
