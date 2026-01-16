import { useMemo } from 'react';
import type { HTMLAttributes } from 'react';
import type { ChannelSection } from '../lib/types';

type Props = {
  title: string;
  offsetDb: number;
  mode: ChannelSection['mode'];
  showModeSelect: boolean;
  showMute: boolean;
  muted: boolean;
  showVisibilityToggle: boolean;
  isVisible: boolean;
  compact: boolean;
  showGlobalIndicator: boolean;
  showEditButton?: boolean;
  onOffsetChange: (next: number) => void;
  onModeChange: (nextMode: ChannelSection['mode']) => void;
  onMuteToggle: (nextMuted: boolean) => void;
  onVisibilityToggle: () => void;
  onEdit?: () => void;
  dragHandleProps?: HTMLAttributes<HTMLDivElement> & { draggable?: boolean };
};

const VGROUP_SCALE = ['+12', '+6', '0', '-6', '-12'];

function formatOffset(value: number) {
  const rounded = Math.round(value);
  if (rounded === 0) {
    return '0 dB';
  }
  return `${rounded > 0 ? '+' : ''}${rounded} dB`;
}

function modeLabel(mode: ChannelSection['mode']) {
  switch (mode) {
    case 'ignore-inf':
      return 'Ignore -∞';
    case 'ignore-inf-sends':
      return 'Ignore -∞ for sends';
    default:
      return 'Default';
  }
}

export default function VGroupStrip({
  title,
  offsetDb,
  mode,
  showModeSelect,
  showMute,
  muted,
  showVisibilityToggle,
  isVisible,
  compact,
  showGlobalIndicator,
  showEditButton,
  onOffsetChange,
  onModeChange,
  onMuteToggle,
  onVisibilityToggle,
  onEdit,
  dragHandleProps,
}: Props) {
  const meterHeight = useMemo(() => {
    const clamped = Math.max(-12, Math.min(12, offsetDb));
    const ratio = (clamped + 12) / 24;
    return `${Math.round(ratio * 100)}%`;
  }, [offsetDb]);
  const meterMaxed = useMemo(() => {
    const clamped = Math.max(-12, Math.min(12, offsetDb));
    return clamped >= 11.5;
  }, [offsetDb]);

  const step = 1;

  return (
    <div className={`channel-card vgroup-strip-card ${compact ? 'channel-card-compact' : ''}`}>
      <div className="strip-header">
        <div className="strip-id-row strip-id-row-vgroup">
          {showEditButton && (
            <button
              type="button"
              className="vgroup-edit-button"
              onClick={onEdit}
              title="Edit V-Group"
            >
              ✎
            </button>
          )}
          <div
            className={`strip-id vgroup-strip-title ${
              dragHandleProps ? 'strip-drag-handle' : ''
            }`}
            {...dragHandleProps}
          >
            {title}
          </div>
          {showVisibilityToggle && (
            <button
              type="button"
              className={`vgroup-expand-button ${isVisible ? 'active' : ''}`}
              onClick={onVisibilityToggle}
              title={isVisible ? 'Collapse group' : 'Expand group'}
            >
              {isVisible ? '−' : '+'}
            </button>
          )}
        </div>
        <div className="strip-display-row">
          <div className="strip-display">
            <div className="strip-display-value">{formatOffset(offsetDb)}</div>
          </div>
        </div>
      </div>

      {showMute && (
        <div className="strip-controls">
          <button
            type="button"
            className={`mute-button ${muted ? 'active' : ''}`}
            onClick={() => onMuteToggle(!muted)}
            title="Mute"
          >
            M
          </button>
        </div>
      )}

      <div className="fader-zone">
        <div className="scale">
          {VGROUP_SCALE.map(label => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="fader-slot">
          <input
            type="range"
            min={-12}
            max={12}
            step={1}
            value={offsetDb}
            onChange={event => onOffsetChange(Number(event.target.value))}
            className="fader"
          />
        </div>
      </div>

      <div className="stepper-row">
        <button
          type="button"
          className="stepper-button"
          onClick={() => onOffsetChange(offsetDb - step)}
          title="Decrease offset"
        >
          −
        </button>
        <button
          type="button"
          className="stepper-button"
          onClick={() => onOffsetChange(offsetDb + step)}
          title="Increase offset"
        >
          +
        </button>
      </div>

      {showModeSelect && (
        <select
          className="section-mode-select vgroup-mode-select"
          value={mode ?? 'default'}
          onChange={event => onModeChange(event.target.value as ChannelSection['mode'])}
        >
          <option value="default">{modeLabel('default')}</option>
          <option value="ignore-inf">{modeLabel('ignore-inf')}</option>
          <option value="ignore-inf-sends">{modeLabel('ignore-inf-sends')}</option>
        </select>
      )}

      <div className={`strip-footer ${showGlobalIndicator ? 'strip-footer-global' : ''}`} />
    </div>
  );
}
