import Pusher from 'pusher';

const appId = process.env.PUSHER_APP_ID;
const key = process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY;
const secret = process.env.PUSHER_SECRET;
const cluster = process.env.PUSHER_CLUSTER || process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

if (!appId || !key || !secret || !cluster) {
  console.warn(
    'Warning: Pusher environment variables are not fully configured. Real-time broadcasting will not function until PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, and PUSHER_CLUSTER are set.'
  );
}

export const pusherServer = new Pusher({
  appId: appId || '',
  key: key || '',
  secret: secret || '',
  cluster: cluster || 'mt1',
  useTLS: true,
});

