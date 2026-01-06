import type { ConnectionStatus } from '../lib/types';

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  disconnected: 'Disconnected',
};

type Props = {
  status: ConnectionStatus;
  label?: string;
  variant?: 'default' | 'sample';
};

export default function ConnectionPill({ status, label, variant = 'default' }: Props) {
  const resolvedLabel = label ?? STATUS_LABELS[status];
  return (
    <span className={`status-pill status-pill--${status} status-pill--${variant}`}>
      {resolvedLabel}
    </span>
  );
}
