import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes } from 'react';
import type { ChannelState } from '../lib/types';

type Props = {
  channel: ChannelState;
  meterValue?: number;
  highlight: boolean;
  showMute: boolean;
  simpleControls: boolean;
  debugMeter?: boolean;
  onFaderChange: (id: number, value: number) => void;
  onMuteToggle: (id: number, muted: boolean) => void;
  onSoloToggle: (id: number, solo: boolean) => void;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  dragHandleProps?: HTMLAttributes<HTMLDivElement> & { draggable?: boolean };
};

const SCALE_LABELS = ['0', '-6', '-12', '-24', '-48', '-60'];

function clamp(value: number) {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function meterToPercent(value: number) {
  if (value <= 0) {
    return 0;
  }
  const db = 20 * Math.log10(value);
  const normalized = (db + 60) / 60;
  return Math.min(1, Math.max(0, normalized));
}

function faderToDb(value: number) {
  if (value <= 0.0001) {
    return -60;
  }
  return value * 60 - 60;
}

export default function ChannelStrip({
  channel,
  meterValue,
  highlight,
  showMute,
  simpleControls,
  debugMeter = false,
  onFaderChange,
  onMuteToggle,
  onSoloToggle,
  onDragStart,
  onDragEnd,
  dragHandleProps,
}: Props) {
  const labelRef = useRef<HTMLDivElement | null>(null);
  const [labelCompact, setLabelCompact] = useState(false);
  const channelLabel = channel.name ?? channel.label;
  const percentage = useMemo(() => {
    const raw = clamp(meterValue ?? channel.fader);
    return Math.round(meterToPercent(raw) * 100);
  }, [channel.fader, meterValue]);
  const dbValue = useMemo(
    () => channel.faderDb ?? faderToDb(channel.fader),
    [channel.fader, channel.faderDb]
  );
  const dbDisplay = useMemo(() => `${Math.round(dbValue)} dB`, [dbValue]);

  const muteSupported = channel.muted !== undefined;
  const muteLabel = 'MUTE';
  const soloSupported = channel.busType === 'master' && channel.solo !== undefined;
  const soloLabel = 'SOLO';
  const meterHeight = `${percentage}%`;
  const meterMaxed = percentage >= 98;
  const step = 1 / 60;

  useLayoutEffect(() => {
    const element = labelRef.current;
    if (!element) {
      return;
    }
    const updateCompact = () => {
      setLabelCompact(element.scrollWidth > element.clientWidth);
    };
    updateCompact();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateCompact);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', updateCompact);
    return () => window.removeEventListener('resize', updateCompact);
  }, [channelLabel]);

  return (
    <div
      className={`channel-card ${highlight ? 'channel-flash' : ''} ${
        simpleControls ? 'channel-card-simple' : ''
      }`}
    >
      <div className="strip-header">
        <div
          ref={labelRef}
          className={`strip-id ${labelCompact ? 'strip-id--compact' : ''} ${
            dragHandleProps ? 'strip-drag-handle' : ''
          }`}
          {...dragHandleProps}
        >
          {channelLabel}
        </div>
        <div className={`strip-display-row ${simpleControls ? 'simple-display-single' : ''}`}>
          <div className="strip-display">
            <div className="strip-display-value">{dbDisplay}</div>
          </div>
        </div>
        {debugMeter && !simpleControls && (
          <div className="meter-debug">
            VU {Math.round((meterValue ?? 0) * 100)}%
          </div>
        )}
      </div>
      {showMute &&
        (simpleControls ? (
          <div className="strip-controls strip-controls-compact strip-controls-simple">
            <div className="simple-control-stack">
              <button
                type="button"
                className={`mute-button ${channel.muted ? 'active' : ''}`}
                onClick={() => onMuteToggle(channel.id, !channel.muted)}
                disabled={!muteSupported}
                title={muteSupported ? '' : 'Mute not implemented'}
              >
                M
              </button>
              <button
                type="button"
                className="simple-stepper"
                onClick={() => onFaderChange(channel.id, clamp(channel.fader - step))}
              >
                -
              </button>
            </div>
            <div className="simple-control-stack">
              <button
                type="button"
                className={`solo-button ${channel.solo ? 'active' : ''}`}
                onClick={() => onSoloToggle(channel.id, !channel.solo)}
                disabled={!soloSupported}
                title={soloSupported ? '' : 'Solo only on Main Mix'}
              >
                S
              </button>
              <button
                type="button"
                className="simple-stepper"
                onClick={() => onFaderChange(channel.id, clamp(channel.fader + step))}
              >
                +
              </button>
            </div>
          </div>
        ) : (
          <div className="strip-controls">
            <button
              type="button"
              className={`mute-button ${channel.muted ? 'active' : ''}`}
              onClick={() => onMuteToggle(channel.id, !channel.muted)}
              disabled={!muteSupported}
              title={muteSupported ? '' : 'Mute not implemented'}
            >
              {muteLabel}
            </button>
            <button
              type="button"
              className={`solo-button ${channel.solo ? 'active' : ''}`}
              onClick={() => onSoloToggle(channel.id, !channel.solo)}
              disabled={!soloSupported}
              title={soloSupported ? '' : 'Solo only on Main Mix'}
            >
              {soloLabel}
            </button>
          </div>
        ))}

      {!simpleControls && (
        <div className="fader-zone">
          <div className="scale">
            {SCALE_LABELS.map(label => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="meter-slot meter">
            <div
              className={`meter-fill ${meterMaxed ? 'meter-fill-max' : ''}`}
              style={{ height: meterHeight }}
            />
          </div>
          <div className="fader-slot">
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={channel.fader}
              onChange={event => onFaderChange(channel.id, clamp(Number(event.target.value)))}
              onPointerDown={() => onDragStart(channel.id)}
              onPointerUp={onDragEnd}
              className="fader"
            />
          </div>
        </div>
      )}

      <div className="strip-footer">CH {channel.id}</div>
    </div>
  );
}
