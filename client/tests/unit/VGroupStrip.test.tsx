/**
 * VGroupStrip Component Unit Tests
 *
 * Tests for the virtual group strip component including offset display,
 * mode selection, mute button, visibility toggle, and fader interaction.
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
  muted: false,
  showVisibilityToggle: true,
  isVisible: true,
  compact: false,
  showGlobalIndicator: false,
  onOffsetChange: vi.fn(),
  onModeChange: vi.fn(),
  onMuteToggle: vi.fn(),
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
    it('renders fader', () => {
      render(<VGroupStrip {...defaultProps} />);
      expect(screen.getByRole('slider')).toBeInTheDocument();
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
      render(<VGroupStrip {...defaultProps} />);
      expect(screen.getByText('+12')).toBeInTheDocument();
      expect(screen.getByText('+6')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('-6')).toBeInTheDocument();
      expect(screen.getByText('-12')).toBeInTheDocument();
    });
  });

  describe('stepper buttons', () => {
    it('shows + and - stepper buttons', () => {
      render(<VGroupStrip {...defaultProps} />);
      expect(screen.getByTitle('Increase offset')).toBeInTheDocument();
      expect(screen.getByTitle('Decrease offset')).toBeInTheDocument();
    });

    it('+ button increases offset by 1', () => {
      const onOffsetChange = vi.fn();
      render(
        <VGroupStrip
          {...defaultProps}
          offsetDb={0}
          onOffsetChange={onOffsetChange}
        />
      );

      fireEvent.click(screen.getByTitle('Increase offset'));

      expect(onOffsetChange).toHaveBeenCalledWith(1);
    });

    it('- button decreases offset by 1', () => {
      const onOffsetChange = vi.fn();
      render(
        <VGroupStrip
          {...defaultProps}
          offsetDb={0}
          onOffsetChange={onOffsetChange}
        />
      );

      fireEvent.click(screen.getByTitle('Decrease offset'));

      expect(onOffsetChange).toHaveBeenCalledWith(-1);
    });

    it('+ button works at positive values', () => {
      const onOffsetChange = vi.fn();
      render(
        <VGroupStrip
          {...defaultProps}
          offsetDb={6}
          onOffsetChange={onOffsetChange}
        />
      );

      fireEvent.click(screen.getByTitle('Increase offset'));

      expect(onOffsetChange).toHaveBeenCalledWith(7);
    });

    it('- button works at negative values', () => {
      const onOffsetChange = vi.fn();
      render(
        <VGroupStrip
          {...defaultProps}
          offsetDb={-6}
          onOffsetChange={onOffsetChange}
        />
      );

      fireEvent.click(screen.getByTitle('Decrease offset'));

      expect(onOffsetChange).toHaveBeenCalledWith(-7);
    });
  });

  describe('mute button', () => {
    it('renders mute button when showMute is true', () => {
      render(<VGroupStrip {...defaultProps} showMute={true} />);
      expect(screen.getByText('M')).toBeInTheDocument();
    });

    it('hides mute button when showMute is false', () => {
      render(<VGroupStrip {...defaultProps} showMute={false} />);
      expect(screen.queryByText('M')).not.toBeInTheDocument();
    });

    it('mute button has active class when muted', () => {
      render(<VGroupStrip {...defaultProps} muted={true} />);
      const muteButton = screen.getByText('M');
      expect(muteButton).toHaveClass('active');
    });

    it('mute button does not have active class when unmuted', () => {
      render(<VGroupStrip {...defaultProps} muted={false} />);
      const muteButton = screen.getByText('M');
      expect(muteButton).not.toHaveClass('active');
    });

    it('calls onMuteToggle with true when mute clicked while unmuted', () => {
      const onMuteToggle = vi.fn();
      render(<VGroupStrip {...defaultProps} muted={false} onMuteToggle={onMuteToggle} />);

      fireEvent.click(screen.getByText('M'));

      expect(onMuteToggle).toHaveBeenCalledWith(true);
    });

    it('calls onMuteToggle with false when mute clicked while muted', () => {
      const onMuteToggle = vi.fn();
      render(<VGroupStrip {...defaultProps} muted={true} onMuteToggle={onMuteToggle} />);

      fireEvent.click(screen.getByText('M'));

      expect(onMuteToggle).toHaveBeenCalledWith(false);
    });
  });

  describe('visibility toggle', () => {
    it('shows visibility toggle when showVisibilityToggle is true', () => {
      render(<VGroupStrip {...defaultProps} showVisibilityToggle={true} />);
      expect(screen.getByTitle('Collapse group')).toBeInTheDocument();
    });

    it('hides visibility toggle when showVisibilityToggle is false', () => {
      render(<VGroupStrip {...defaultProps} showVisibilityToggle={false} />);
      expect(screen.queryByTitle('Collapse group')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Expand group')).not.toBeInTheDocument();
    });

    it('shows − when isVisible is true', () => {
      render(<VGroupStrip {...defaultProps} isVisible={true} showVisibilityToggle={true} />);
      const button = screen.getByTitle('Collapse group');
      expect(button).toHaveTextContent('−');
    });

    it('shows + when isVisible is false', () => {
      render(<VGroupStrip {...defaultProps} isVisible={false} showVisibilityToggle={true} />);
      const button = screen.getByTitle('Expand group');
      expect(button).toHaveTextContent('+');
    });

    it('has active class when visible', () => {
      render(<VGroupStrip {...defaultProps} isVisible={true} showVisibilityToggle={true} />);
      const button = screen.getByTitle('Collapse group');
      expect(button).toHaveClass('active');
    });

    it('does not have active class when not visible', () => {
      render(<VGroupStrip {...defaultProps} isVisible={false} showVisibilityToggle={true} />);
      const button = screen.getByTitle('Expand group');
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

      fireEvent.click(screen.getByTitle('Collapse group'));

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
      expect(card).toHaveClass('channel-card-compact');
    });

    it('does not apply compact class when compact is false', () => {
      const { container } = render(<VGroupStrip {...defaultProps} compact={false} />);
      const card = container.querySelector('.channel-card');
      expect(card).not.toHaveClass('channel-card-compact');
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
        onVisibilityToggle: () => {},
      };

      expect(() => {
        render(<VGroupStrip {...props} />);
        fireEvent.click(screen.getByText('M'));
        fireEvent.change(screen.getByRole('slider'), { target: { value: '5' } });
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ignore-inf' } });
      }).not.toThrow();
    });
  });
});
