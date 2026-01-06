import path from 'path';
import { config as loadEnv } from 'dotenv';
import { SoundcraftUI } from 'soundcraft-ui-connection';

loadEnv({ path: path.resolve(process.cwd(), '.env') });
loadEnv({ path: path.resolve(process.cwd(), '..', '.env'), override: false });

const host = process.env.UI24R_HOST;

if (!host) {
  console.error('UI24R_HOST is required');
  process.exit(1);
}

const channelId = Number(process.env.UI24R_TEST_CHANNEL ?? 1);
const value = Number(process.env.UI24R_TEST_VALUE ?? 0.5);

const conn = new SoundcraftUI(host);

async function run() {
  await conn.connect();
  conn.master.input(channelId).setFaderLevel(Math.min(1, Math.max(0, value)));
  setTimeout(async () => {
    await conn.disconnect();
    process.exit(0);
  }, 500);
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
