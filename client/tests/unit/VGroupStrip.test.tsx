/**
 * VGroupStrip Component Unit Tests
 *
 * Tests for the virtual group strip component including offset display,
 * mode selection, mute/solo buttons, visibility toggle, and fader interaction.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VGroupStrip from '../../src/components/VGroupStrip';

const defaultProps = {
  title: 'Drums',
  offsetDb: 0,
  mode: 'default' as const,
  showModeSelect: true,
  showMute: true,
  showSolo: true,
  muted: false,
  solo: false,
  showVisibilityToggle: true,
  isVisible: true,
  compact: false,
  simpleControls: false,
  showGlobalIndicator: false,
  onOffsetChange: vi.fn(),
  onModeChange: vi.fn(),
  onMuteToggle: vi.fn(),
  onSoloToggle: vi.fn(),
  onVisibilityToggle: vi.fn(),
};

describe('VGroupStrip', () => {
  describe('title display', () => {
    it('displays the group title', () => {
      render(<VGroupStrip {...defaultProps} title="Drums" />);
      expect(screen.getByText('Drums')).toBeInTheDocument();
    });

    it('displays different titles', () => {
      render(<VGroupStrip {...defaultProps} title="Vocals" />);
      expect(screen.getByText('Vocals')).toBeInTheDocument();
    });

    it('applies drag handle class when dragHandleProps provided', () => {
      const dragHandleProps = { draggable: true };
      render(<VGroupStrip {...defaultProps} dragHandleProps={dragHandleProps} />);
      const titleElement = screen.getByText('Drums');
      expect(titleElement).toHaveClass('strip-drag-handle');
    });

    it('does not apply drag handle class without dragHandleProps', () => {
      render(<VGroupStrip {...defaultProps} />);
      const titleElement = screen.getByText('Drums');
      expect(titleElement).not.toHaveClass('strip-drag-handle');
    });
  });

  describe('offset display', () => {
    it('displays 0 dB for zero offset', () => {
      render(<VGroupStrip {...defaultProps} offsetDb={0} />);
      expect(screen.getByText('0 dB')).toBeInTheDocument();
    });

    it('displays positive offset with plus sign', () => {
      render(<VGroupStrip {...defaultProps} offsetDb={6} />);
      expect(screen.getByText('+6 dB')).toBeInTheDocument();
    });

    it('displays negative offset with minus sign', () => {
      render(<VGroupStrip {...defaultProps} offsetDb={-6} />);
      expect(screen.getByText('-6 dB')).toBeInTheDocument();
    });

    it('displays maximum offset', () => {
      render(<VGroupStrip {...defaultProps} offsetDb={12} />);
      expect(screen.getByText('+12 dB')).toBeInTheDocument();
    });

    it('displays minimum offset', () => {
      render(<VGroupStrip {...defaultProps} offsetDb={-12} />);
      expect(screen.getByText('-12 dB')).toBeInTheDocument();
    });

    it('rounds decimal offsets', () => {
      render(<VGroupStrip {...defaultProps} offsetDb={3.7} />);
      expect(screen.getByText('+4 dB')).toBeInTheDocument();
    });

    it('rounds negative decimal offsets', () => {
      render(<VGroupStrip {...defaultProps} offsetDb={-3.2} />);
      expect(screen.getByText('-3 dB')).toBeInTheDocument();
    });
  });

  describe('fader interaction', () => {
    it('renders fader in normal mode', () => {
      render(<VGroupStrip {...defaultProps} simpleControls={false} />);
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    it('hides fader in simple controls mode', () => {
      render(<VGroupStrip {...defaultProps} simpleControls={true} />);
      expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    });

    it('fader has correct value', () => {
      render(<VGroupStrip {...defaultProps} offsetDb={6} />);
      const fader = screen.getByRole('slider');
      expect(fader).toHaveValue('6');
    });

    it('fader has min of -12', () => {
      render(<VGroupStrip {...defaultProps} />);
      const fader = screen.getByRole('slider');
      expect(fader).toHaveAttribute('min', '-12');
    });

    it('fader has max of 12', () => {
      render(<VGroupStrip {...defaultProps} />);
      const fader = screen.getByRole('slider');
      expect(fader).toHaveAttribute('max', '12');
    });

    it('calls onOffsetChange when fader changes', () => {
      const onOffsetChange = vi.fn();
      render(<VGroupStrip {...defaultProps} onOffsetChange={onOffsetChange} />);
      const fader = screen.getByRole('slider');

      fireEvent.change(fader, { target: { value: '6' } });

      expect(onOffsetChange).toHaveBeenCalledWith(6);
    });

    it('renders scale labels', () => {
      render(<VGroupStrip {...defaultProps} simpleControls={false} />);
      expect(screen.getByText('+12')).toBeInTheDocument();
      expect(screen.getByText('+6')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('-6')).toBeInTheDocument();
      expect(screen.getByText('-12')).toBeInTheDocument();
    });
  });

  describe('simple controls mode', () => {
    it('shows + and - buttons in simple mode', () => {
      render(<VGroupStrip {...defaultProps} simpleControls={true} />);
      expect(screen.getByRole('button', { name: '+' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '-' })).toBeInTheDocument();
    });

    it('+ button increases offset by 1', () => {
      const onOffsetChange = vi.fn();
      render(
        <VGroupStrip
          {...defaultProps}
          simpleControls={true}
          offsetDb={0}
          onOffsetChange={onOffsetChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: '+' }));

      expect(onOffsetChange).toHaveBeenCalledWith(1);
    });

    it('- button decreases offset by 1', () => {
      const onOffsetChange = vi.fn();
      render(
        <VGroupStrip
          {...defaultProps}
          simpleControls={true}
          offsetDb={0}
          onOffsetChange={onOffsetChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: '-' }));

      expect(onOffsetChange).toHaveBeenCalledWith(-1);
    });

    it('shows M and S labels for mute/solo in simple mode', () => {
      render(<VGroupStrip {...defaultProps} simpleControls={true} />);
      expect(screen.getByRole('button', { name: 'M' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'S' })).toBeInTheDocument();
    });
  });

  describe('mute button', () => {
    it('renders mute button when showMute is true', () => {
      render(<VGroupStrip {...defaultProps} showMute={true} />);
      expect(screen.getByRole('button', { name: 'MUTE' })).toBeInTheDocument();
    });

    it('hides mute button when showMute is false', () => {
      render(<VGroupStrip {...defaultProps} showMute={false} />);
      expect(screen.queryByRole('button', { name: 'MUTE' })).not.toBeInTheDocument();
    });

    it('mute button has active class when muted', () => {
      render(<VGroupStrip {...defaultProps} muted={true} />);
      const muteButton = screen.getByRole('button', { name: 'MUTE' });
      expect(muteButton).toHaveClass('active');
    });

    it('mute button does not have active class when unmuted', () => {
      render(<VGroupStrip {...defaultProps} muted={false} />);
      const muteButton = screen.getByRole('button', { name: 'MUTE' });
      expect(muteButton).not.toHaveClass('active');
    });

    it('calls onMuteToggle with true when mute clicked while unmuted', () => {
      const onMuteToggle = vi.fn();
      render(<VGroupStrip {...defaultProps} muted={false} onMuteToggle={onMuteToggle} />);

      fireEvent.click(screen.getByRole('button', { name: 'MUTE' }));

      expect(onMuteToggle).toHaveBeenCalledWith(true);
    });

    it('calls onMuteToggle with false when mute clicked while muted', () => {
      const onMuteToggle = vi.fn();
      render(<VGroupStrip {...defaultProps} muted={true} onMuteToggle={onMuteToggle} />);

      fireEvent.click(screen.getByRole('button', { name: 'MUTE' }));

      expect(onMuteToggle).toHaveBeenCalledWith(false);
    });
  });

  describe('solo button', () => {
    it('renders solo button when showMute is true', () => {
      render(<VGroupStrip {...defaultProps} showMute={true} />);
      expect(screen.getByRole('button', { name: 'SOLO' })).toBeInTheDocument();
    });

    it('solo button is enabled when showSolo is true', () => {
      render(<VGroupStrip {...defaultProps} showSolo={true} />);
      const soloButton = screen.getByRole('button', { name: 'SOLO' });
      expect(soloButton).not.toBeDisabled();
    });

    it('solo button is disabled when showSolo is false', () => {
      render(<VGroupStrip {...defaultProps} showSolo={false} />);
      const soloButton = screen.getByRole('button', { name: 'SOLO' });
      expect(soloButton).toBeDisabled();
    });

    it('solo button has title when disabled', () => {
      render(<VGroupStrip {...defaultProps} showSolo={false} />);
      const soloButton = screen.getByRole('button', { name: 'SOLO' });
      expect(soloButton).toHaveAttribute('title', 'Solo only on Main Mix');
    });

    it('solo button has no title when enabled', () => {
      render(<VGroupStrip {...defaultProps} showSolo={true} />);
      const soloButton = screen.getByRole('button', { name: 'SOLO' });
      expect(soloButton).toHaveAttribute('title', '');
    });

    it('solo button has active class when solo is true', () => {
      render(<VGroupStrip {...defaultProps} solo={true} />);
      const soloButton = screen.getByRole('button', { name: 'SOLO' });
      expect(soloButton).toHaveClass('active');
    });

    it('solo button does not have active class when solo is false', () => {
      render(<VGroupStrip {...defaultProps} solo={false} />);
      const soloButton = screen.getByRole('button', { name: 'SOLO' });
      expect(soloButton).not.toHaveClass('active');
    });

    it('calls onSoloToggle with true when solo clicked while not soloed', () => {
      const onSoloToggle = vi.fn();
      render(<VGroupStrip {...defaultProps} solo={false} onSoloToggle={onSoloToggle} />);

      fireEvent.click(screen.getByRole('button', { name: 'SOLO' }));

      expect(onSoloToggle).toHaveBeenCalledWith(true);
    });

    it('calls onSoloToggle with false when solo clicked while soloed', () => {
      const onSoloToggle = vi.fn();
      render(<VGroupStrip {...defaultProps} solo={true} onSoloToggle={onSoloToggle} />);

      fireEvent.click(screen.getByRole('button', { name: 'SOLO' }));

      expect(onSoloToggle).toHaveBeenCalledWith(false);
    });
  });

  describe('visibility toggle', () => {
    it('shows visibility toggle when showVisibilityToggle is true', () => {
      render(<VGroupStrip {...defaultProps} showVisibilityToggle={true} />);
      expect(screen.getByRole('button', { name: 'HIDE' })).toBeInTheDocument();
    });

    it('hides visibility toggle when showVisibilityToggle is false', () => {
      render(<VGroupStrip {...defaultProps} showVisibilityToggle={false} />);
      expect(screen.queryByRole('button', { name: 'HIDE' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'SHOW' })).not.toBeInTheDocument();
    });

    it('shows HIDE when isVisible is true', () => {
      render(<VGroupStrip {...defaultProps} isVisible={true} showVisibilityToggle={true} />);
      expect(screen.getByRole('button', { name: 'HIDE' })).toBeInTheDocument();
    });

    it('shows SHOW when isVisible is false', () => {
      render(<VGroupStrip {...defaultProps} isVisible={false} showVisibilityToggle={true} />);
      expect(screen.getByRole('button', { name: 'SHOW' })).toBeInTheDocument();
    });

    it('has active class when visible', () => {
      render(<VGroupStrip {...defaultProps} isVisible={true} showVisibilityToggle={true} />);
      const button = screen.getByRole('button', { name: 'HIDE' });
      expect(button).toHaveClass('active');
    });

    it('does not have active class when not visible', () => {
      render(<VGroupStrip {...defaultProps} isVisible={false} showVisibilityToggle={true} />);
      const button = screen.getByRole('button', { name: 'SHOW' });
      expect(button).not.toHaveClass('active');
    });

    it('calls onVisibilityToggle when clicked', () => {
      const onVisibilityToggle = vi.fn();
      render(
        <VGroupStrip
          {...defaultProps}
          showVisibilityToggle={true}
          onVisibilityToggle={onVisibilityToggle}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'HIDE' }));

      expect(onVisibilityToggle).toHaveBeenCalled();
    });
  });

  describe('mode select', () => {
    it('renders mode select when showModeSelect is true', () => {
      render(<VGroupStrip {...defaultProps} showModeSelect={true} />);
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('hides mode select when showModeSelect is false', () => {
      render(<VGroupStrip {...defaultProps} showModeSelect={false} />);
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('has correct options', () => {
      render(<VGroupStrip {...defaultProps} showModeSelect={true} />);
      expect(screen.getByRole('option', { name: 'Default' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Ignore -∞' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Ignore -∞ for sends' })).toBeInTheDocument();
    });

    it('selects correct mode value', () => {
      render(<VGroupStrip {...defaultProps} mode="ignore-inf" showModeSelect={true} />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('ignore-inf');
    });

    it('defaults to default mode', () => {
      render(<VGroupStrip {...defaultProps} mode="default" showModeSelect={true} />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('default');
    });

    it('calls onModeChange when mode changes', () => {
      const onModeChange = vi.fn();
      render(
        <VGroupStrip {...defaultProps} showModeSelect={true} onModeChange={onModeChange} />
      );

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ignore-inf' } });

      expect(onModeChange).toHaveBeenCalledWith('ignore-inf');
    });

    it('calls onModeChange with ignore-inf-sends', () => {
      const onModeChange = vi.fn();
      render(
        <VGroupStrip {...defaultProps} showModeSelect={true} onModeChange={onModeChange} />
      );

      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'ignore-inf-sends' },
      });

      expect(onModeChange).toHaveBeenCalledWith('ignore-inf-sends');
    });
  });

  describe('compact mode', () => {
    it('applies compact class when compact is true', () => {
      const { container } = render(<VGroupStrip {...defaultProps} compact={true} />);
      const card = container.querySelector('.channel-card');
      expect(card).toHaveClass('channel-card-simple');
    });

    it('does not apply compact class when compact is false', () => {
      const { container } = render(<VGroupStrip {...defaultProps} compact={false} />);
      const card = container.querySelector('.channel-card');
      expect(card).not.toHaveClass('channel-card-simple');
    });
  });

  describe('global indicator', () => {
    it('applies global footer class when showGlobalIndicator is true', () => {
      const { container } = render(<VGroupStrip {...defaultProps} showGlobalIndicator={true} />);
      const footer = container.querySelector('.strip-footer');
      expect(footer).toHaveClass('strip-footer-global');
    });

    it('does not apply global footer class when showGlobalIndicator is false', () => {
      const { container } = render(<VGroupStrip {...defaultProps} showGlobalIndicator={false} />);
      const footer = container.querySelector('.strip-footer');
      expect(footer).not.toHaveClass('strip-footer-global');
    });
  });

  describe('simple controls visibility toggle', () => {
    it('shows visibility toggle in simple controls mode', () => {
      render(
        <VGroupStrip
          {...defaultProps}
          simpleControls={true}
          showVisibilityToggle={true}
          isVisible={true}
        />
      );
      expect(screen.getByRole('button', { name: 'HIDE' })).toBeInTheDocument();
    });

    it('hides visibility toggle in simple controls mode when showVisibilityToggle is false', () => {
      render(
        <VGroupStrip
          {...defaultProps}
          simpleControls={true}
          showVisibilityToggle={false}
        />
      );
      expect(screen.queryByRole('button', { name: 'HIDE' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'SHOW' })).not.toBeInTheDocument();
    });
  });

  describe('simple controls mute/solo', () => {
    it('mute M button toggles mute in simple mode', () => {
      const onMuteToggle = vi.fn();
      render(
        <VGroupStrip
          {...defaultProps}
          simpleControls={true}
          muted={false}
          onMuteToggle={onMuteToggle}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'M' }));

      expect(onMuteToggle).toHaveBeenCalledWith(true);
    });

    it('solo S button toggles solo in simple mode', () => {
      const onSoloToggle = vi.fn();
      render(
        <VGroupStrip
          {...defaultProps}
          simpleControls={true}
          solo={false}
          onSoloToggle={onSoloToggle}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'S' }));

      expect(onSoloToggle).toHaveBeenCalledWith(true);
    });

    it('solo S button is disabled when showSolo is false in simple mode', () => {
      render(
        <VGroupStrip {...defaultProps} simpleControls={true} showSolo={false} />
      );
      const soloButton = screen.getByRole('button', { name: 'S' });
      expect(soloButton).toBeDisabled();
    });

    it('M button has active class when muted in simple mode', () => {
      render(<VGroupStrip {...defaultProps} simpleControls={true} muted={true} />);
      const muteButton = screen.getByRole('button', { name: 'M' });
      expect(muteButton).toHaveClass('active');
    });

    it('S button has active class when soloed in simple mode', () => {
      render(<VGroupStrip {...defaultProps} simpleControls={true} solo={true} />);
      const soloButton = screen.getByRole('button', { name: 'S' });
      expect(soloButton).toHaveClass('active');
    });
  });

  describe('edge cases', () => {
    it('handles offset at exactly 0', () => {
      render(<VGroupStrip {...defaultProps} offsetDb={0} />);
      expect(screen.getByText('0 dB')).toBeInTheDocument();
    });

    it('handles offset at -0.4 (rounds to 0)', () => {
      render(<VGroupStrip {...defaultProps} offsetDb={-0.4} />);
      expect(screen.getByText('0 dB')).toBeInTheDocument();
    });

    it('handles offset at 0.4 (rounds to 0)', () => {
      render(<VGroupStrip {...defaultProps} offsetDb={0.4} />);
      expect(screen.getByText('0 dB')).toBeInTheDocument();
    });

    it('handles undefined mode gracefully', () => {
      render(<VGroupStrip {...defaultProps} mode={undefined as any} showModeSelect={true} />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('default');
    });

    it('handles all callbacks being no-ops', () => {
      const props = {
        ...defaultProps,
        onOffsetChange: () => {},
        onModeChange: () => {},
        onMuteToggle: () => {},
        onSoloToggle: () => {},
        onVisibilityToggle: () => {},
      };

      expect(() => {
        const { container } = render(<VGroupStrip {...props} />);
        fireEvent.click(screen.getByRole('button', { name: 'MUTE' }));
        fireEvent.click(screen.getByRole('button', { name: 'SOLO' }));
        fireEvent.change(screen.getByRole('slider'), { target: { value: '5' } });
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ignore-inf' } });
      }).not.toThrow();
    });
  });
});
