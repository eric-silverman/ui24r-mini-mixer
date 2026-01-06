import { z } from 'zod';

const MAX_CHANNEL = 24;
const DEFAULT_CHANNELS = Array.from({ length: 24 }, (_, index) => index + 1);

const envSchema = z.object({
  UI24R_HOST: z.string().optional(),
  UI24R_CHANNELS: z.string().optional(),
});

const rangePattern = /^(\d+)-(\d+)$/;
const singlePattern = /^\d+$/;

function parseChannelList(input?: string): number[] {
  if (!input || input.trim() === '') {
    return DEFAULT_CHANNELS;
  }

  const channels = new Set<number>();
  const parts = input.split(',').map(part => part.trim()).filter(Boolean);

  for (const part of parts) {
    if (singlePattern.test(part)) {
      const value = Number(part);
      if (!Number.isInteger(value)) {
        continue;
      }
      if (value < 1 || value > MAX_CHANNEL) {
        throw new Error(`Channel ${value} out of range (1-${MAX_CHANNEL}).`);
      }
      channels.add(value);
      continue;
    }

    const match = part.match(rangePattern);
    if (!match) {
      throw new Error(`Invalid channel range: "${part}".`);
    }

    const start = Number(match[1]);
    const end = Number(match[2]);
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 1 ||
      end < 1 ||
      start > MAX_CHANNEL ||
      end > MAX_CHANNEL
    ) {
      throw new Error(`Invalid channel range: "${part}".`);
    }

    const [from, to] = start <= end ? [start, end] : [end, start];
    for (let i = from; i <= to; i += 1) {
      channels.add(i);
    }
  }

  const list = Array.from(channels).sort((a, b) => a - b);
  if (list.length === 0) {
    return DEFAULT_CHANNELS;
  }
  return list;
}

export type AppConfig = {
  host?: string;
  channels: number[];
};

export function loadConfig(): AppConfig {
  const env = envSchema.parse(process.env);
  return {
    host: env.UI24R_HOST?.trim() || undefined,
    channels: parseChannelList(env.UI24R_CHANNELS),
  };
}
