import { useMemo } from 'react';
import type { HTMLAttributes } from 'react';
import type { ChannelSection } from '../lib/types';

type Props = {
  title: string;
  offsetDb: number;
  mode: ChannelSection['mode'];
  showModeSelect: boolean;
  showMute: boolean;
  showSolo: boolean;
  muted: boolean;
  solo: boolean;
  showVisibilityToggle: boolean;
  isVisible: boolean;
  compact: boolean;
  simpleControls: boolean;
  showGlobalIndicator: boolean;
  onOffsetChange: (next: number) => void;
  onModeChange: (nextMode: ChannelSection['mode']) => void;
  onMuteToggle: (nextMuted: boolean) => void;
  onSoloToggle: (nextSolo: boolean) => void;
  onVisibilityToggle: () => void;
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
  showSolo,
  muted,
  solo,
  showVisibilityToggle,
  isVisible,
  compact,
  simpleControls,
  showGlobalIndicator,
  onOffsetChange,
  onModeChange,
  onMuteToggle,
  onSoloToggle,
  onVisibilityToggle,
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
    <div className={`channel-card vgroup-strip-card ${compact ? 'channel-card-simple' : ''}`}>
      <div className="strip-header">
        <div className="strip-id-row strip-id-row-centered">
          <div
            className={`strip-id vgroup-strip-title ${
              dragHandleProps ? 'strip-drag-handle' : ''
            }`}
            {...dragHandleProps}
          >
            {title}
          </div>
        </div>
        <div className={`strip-display-row ${simpleControls ? 'simple-display-single' : ''}`}>
          <div className="strip-display">
            <div className="strip-display-value">{formatOffset(offsetDb)}</div>
          </div>
        </div>
      </div>

      {showMute &&
        (simpleControls ? (
          <div className="strip-controls strip-controls-compact strip-controls-simple">
            <div className="simple-control-stack">
              <button
                type="button"
                className={`mute-button ${muted ? 'active' : ''}`}
                onClick={() => onMuteToggle(!muted)}
              >
                M
              </button>
              <button
                type="button"
                className="simple-stepper"
                onClick={() => onOffsetChange(offsetDb - step)}
              >
                -
              </button>
            </div>
            <div className="simple-control-stack">
              <button
                type="button"
                className={`solo-button ${solo ? 'active' : ''}`}
                onClick={() => onSoloToggle(!solo)}
                disabled={!showSolo}
                title={showSolo ? '' : 'Solo only on Main Mix'}
              >
                S
              </button>
              <button
                type="button"
                className="simple-stepper"
                onClick={() => onOffsetChange(offsetDb + step)}
              >
                +
              </button>
            </div>
            {showVisibilityToggle && (
              <div className="simple-control-stack">
                <button
                  type="button"
                  className={`show-button ${isVisible ? 'active' : ''}`}
                  onClick={onVisibilityToggle}
                >
                  {isVisible ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="strip-controls">
            <button
              type="button"
              className={`mute-button ${muted ? 'active' : ''}`}
              onClick={() => onMuteToggle(!muted)}
            >
              MUTE
            </button>
            <button
              type="button"
              className={`solo-button ${solo ? 'active' : ''}`}
              onClick={() => onSoloToggle(!solo)}
              disabled={!showSolo}
              title={showSolo ? '' : 'Solo only on Main Mix'}
            >
              SOLO
            </button>
            {showVisibilityToggle && (
              <button
                type="button"
                className={`show-button ${isVisible ? 'active' : ''}`}
                onClick={onVisibilityToggle}
              >
                {isVisible ? 'HIDE' : 'SHOW'}
              </button>
            )}
          </div>
        ))}

      {!simpleControls && (
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
      )}

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
