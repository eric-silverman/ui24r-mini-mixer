/**
 * ConnectionPill Component Unit Tests
 *
 * Tests for the connection status pill component including
 * status display, label customization, and variant styling.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConnectionPill from '../../src/components/ConnectionPill';
import type { ConnectionStatus } from '../../src/lib/types';

describe('ConnectionPill', () => {
  describe('status labels', () => {
    it('displays "Connected" for connected status', () => {
      render(<ConnectionPill status="connected" />);
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('displays "Reconnecting" for reconnecting status', () => {
      render(<ConnectionPill status="reconnecting" />);
      expect(screen.getByText('Reconnecting')).toBeInTheDocument();
    });

    it('displays "Disconnected" for disconnected status', () => {
      render(<ConnectionPill status="disconnected" />);
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
  });

  describe('custom label', () => {
    it('displays custom label instead of default', () => {
      render(<ConnectionPill status="connected" label="Custom Label" />);
      expect(screen.getByText('Custom Label')).toBeInTheDocument();
      expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    });

    it('displays custom label for disconnected status', () => {
      render(<ConnectionPill status="disconnected" label="Network Error" />);
      expect(screen.getByText('Network Error')).toBeInTheDocument();
    });

    it('displays custom label for reconnecting status', () => {
      render(<ConnectionPill status="reconnecting" label="Trying again..." />);
      expect(screen.getByText('Trying again...')).toBeInTheDocument();
    });

    it('allows empty string as label', () => {
      render(<ConnectionPill status="connected" label="" />);
      const pill = document.querySelector('.status-pill');
      expect(pill?.textContent).toBe('');
    });
  });

  describe('CSS classes', () => {
    describe('status classes', () => {
      it('applies connected status class', () => {
        render(<ConnectionPill status="connected" />);
        const pill = screen.getByText('Connected');
        expect(pill).toHaveClass('status-pill--connected');
      });

      it('applies reconnecting status class', () => {
        render(<ConnectionPill status="reconnecting" />);
        const pill = screen.getByText('Reconnecting');
        expect(pill).toHaveClass('status-pill--reconnecting');
      });

      it('applies disconnected status class', () => {
        render(<ConnectionPill status="disconnected" />);
        const pill = screen.getByText('Disconnected');
        expect(pill).toHaveClass('status-pill--disconnected');
      });
    });

    describe('variant classes', () => {
      it('applies default variant class by default', () => {
        render(<ConnectionPill status="connected" />);
        const pill = screen.getByText('Connected');
        expect(pill).toHaveClass('status-pill--default');
      });

      it('applies default variant class when explicitly set', () => {
        render(<ConnectionPill status="connected" variant="default" />);
        const pill = screen.getByText('Connected');
        expect(pill).toHaveClass('status-pill--default');
      });

      it('applies sample variant class', () => {
        render(<ConnectionPill status="connected" variant="sample" />);
        const pill = screen.getByText('Connected');
        expect(pill).toHaveClass('status-pill--sample');
      });
    });

    describe('base class', () => {
      it('always has status-pill base class', () => {
        render(<ConnectionPill status="connected" />);
        const pill = screen.getByText('Connected');
        expect(pill).toHaveClass('status-pill');
      });

      it('has base class with custom label', () => {
        render(<ConnectionPill status="connected" label="Custom" />);
        const pill = screen.getByText('Custom');
        expect(pill).toHaveClass('status-pill');
      });

      it('has base class with sample variant', () => {
        render(<ConnectionPill status="disconnected" variant="sample" />);
        const pill = screen.getByText('Disconnected');
        expect(pill).toHaveClass('status-pill');
      });
    });

    describe('combined classes', () => {
      it('has all three classes: base, status, and variant', () => {
        render(<ConnectionPill status="connected" variant="sample" />);
        const pill = screen.getByText('Connected');
        expect(pill).toHaveClass('status-pill');
        expect(pill).toHaveClass('status-pill--connected');
        expect(pill).toHaveClass('status-pill--sample');
      });

      it('has correct classes for disconnected with default variant', () => {
        render(<ConnectionPill status="disconnected" variant="default" />);
        const pill = screen.getByText('Disconnected');
        expect(pill).toHaveClass('status-pill');
        expect(pill).toHaveClass('status-pill--disconnected');
        expect(pill).toHaveClass('status-pill--default');
      });
    });
  });

  describe('element structure', () => {
    it('renders as a span element', () => {
      render(<ConnectionPill status="connected" />);
      const pill = screen.getByText('Connected');
      expect(pill.tagName).toBe('SPAN');
    });
  });

  describe('all status and variant combinations', () => {
    const statuses: ConnectionStatus[] = ['connected', 'reconnecting', 'disconnected'];
    const variants: Array<'default' | 'sample'> = ['default', 'sample'];

    statuses.forEach(status => {
      variants.forEach(variant => {
        it(`renders correctly for ${status} status with ${variant} variant`, () => {
          render(<ConnectionPill status={status} variant={variant} />);
          const pill = document.querySelector('.status-pill');
          expect(pill).toBeInTheDocument();
          expect(pill).toHaveClass(`status-pill--${status}`);
          expect(pill).toHaveClass(`status-pill--${variant}`);
        });
      });
    });
  });

  describe('sample data mode', () => {
    it('renders correctly for sample/dev mode display', () => {
      render(<ConnectionPill status="connected" label="Sample Data" variant="sample" />);
      const pill = screen.getByText('Sample Data');
      expect(pill).toHaveClass('status-pill--sample');
      expect(pill).toHaveClass('status-pill--connected');
    });
  });

  describe('edge cases', () => {
    it('handles label with special characters', () => {
      render(<ConnectionPill status="connected" label="<script>alert('xss')</script>" />);
      const pill = screen.getByText("<script>alert('xss')</script>");
      expect(pill).toBeInTheDocument();
    });

    it('handles very long label', () => {
      const longLabel = 'A'.repeat(100);
      render(<ConnectionPill status="connected" label={longLabel} />);
      expect(screen.getByText(longLabel)).toBeInTheDocument();
    });

    it('handles unicode in label', () => {
      render(<ConnectionPill status="connected" label="连接成功 ✓" />);
      expect(screen.getByText('连接成功 ✓')).toBeInTheDocument();
    });
  });
});
