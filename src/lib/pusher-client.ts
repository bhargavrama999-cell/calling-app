import Pusher from 'pusher-js';

export function getPusherClient(sessionId: string, deviceName: string, deviceType: string): Pusher {
  const appKey = process.env.NEXT_PUBLIC_PUSHER_KEY || '';
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1';

  if (!appKey) {
    console.warn(
      'NEXT_PUBLIC_PUSHER_KEY is not defined. Real-time presence will not connect until Pusher keys are configured.'
    );
  }

  // Create a fresh Pusher client configured with channel authorization endpoint
  return new Pusher(appKey, {
    cluster,
    channelAuthorization: {
      endpoint: '/api/presence',
      transport: 'ajax',
      params: {
        sessionId,
        deviceName,
        deviceType,
      },
      headers: {
        'x-session-id': sessionId,
        'x-device-name': deviceName,
        'x-device-type': deviceType,
      },
    },
    authEndpoint: '/api/presence',
    auth: {
      params: {
        sessionId,
        deviceName,
        deviceType,
      },
      headers: {
        'x-session-id': sessionId,
        'x-device-name': deviceName,
        'x-device-type': deviceType,
      },
    },
  });
}

