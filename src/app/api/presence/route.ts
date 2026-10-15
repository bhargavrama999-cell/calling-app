import { NextRequest, NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher-server';
import { connectToDatabase } from '@/lib/mongodb';
import Device from '@/models/Device';

export async function POST(req: NextRequest) {
  try {
    let socketId = '';
    let channelName = '';
    let sessionId = '';
    let deviceName = '';
    let deviceType = '';
    let action = '';

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      socketId = (formData.get('socket_id') as string) || '';
      channelName = (formData.get('channel_name') as string) || '';
      sessionId = (formData.get('sessionId') as string) || '';
      deviceName = (formData.get('deviceName') as string) || '';
      deviceType = (formData.get('deviceType') as string) || '';
      action = (formData.get('action') as string) || '';
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      socketId = body.socket_id || '';
      channelName = body.channel_name || '';
      sessionId = body.sessionId || '';
      deviceName = body.deviceName || '';
      deviceType = body.deviceType || '';
      action = body.action || '';
    }

    // Fallbacks from URL search parameters or request headers
    const searchParams = req.nextUrl.searchParams;
    sessionId = sessionId || searchParams.get('sessionId') || req.headers.get('x-session-id') || '';
    deviceName = deviceName || searchParams.get('deviceName') || req.headers.get('x-device-name') || 'Anonymous Device';
    deviceType = deviceType || searchParams.get('deviceType') || req.headers.get('x-device-type') || 'Browser';
    socketId = socketId || searchParams.get('socket_id') || '';
    channelName = channelName || searchParams.get('channel_name') || '';

    const userAgent = req.headers.get('user-agent') || '';

    // If an explicit status update action is requested (e.g. heartbeat or going offline)
    if (action === 'offline' && sessionId) {
      if (process.env.MONGODB_URI) {
        await connectToDatabase();
        await Device.findOneAndUpdate(
          { sessionId },
          { status: 'offline', lastActive: new Date() }
        );
      }
      return NextResponse.json({ success: true, status: 'offline' });
    }

    // Standard Pusher Presence Channel Authorization
    if (!socketId || !channelName) {
      return NextResponse.json(
        { error: 'Missing socket_id or channel_name for Pusher authorization' },
        { status: 400 }
      );
    }

    if (!sessionId) {
      sessionId = `device_${socketId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
    }

    // Upsert active device record in MongoDB Atlas
    if (process.env.MONGODB_URI) {
      try {
        await connectToDatabase();
        await Device.findOneAndUpdate(
          { sessionId },
          {
            name: deviceName,
            deviceType: deviceType,
            userAgent: userAgent,
            status: 'online',
            lastActive: new Date(),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (dbErr) {
        console.error('Failed to update device record in MongoDB:', dbErr);
        // Continue channel authorization even if DB logging hits a transient issue
      }
    }

    // Presence channel user data structure
    const presenceData = {
      user_id: sessionId,
      user_info: {
        name: deviceName,
        deviceType: deviceType,
        userAgent: userAgent,
        joinedAt: new Date().toISOString(),
      },
    };

    // Authorize socket to subscribe to Pusher Presence Channel
    const authResponse = pusherServer.authorizeChannel(socketId, channelName, presenceData);

    return NextResponse.json(authResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Error in /api/presence:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET endpoint to retrieve list of active devices registered in MongoDB
export async function GET() {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ devices: [], warning: 'MongoDB not connected' });
    }

    await connectToDatabase();

    // Fetch devices active in the last 2 hours or marked online
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const devices = await Device.find({
      $or: [{ status: 'online' }, { lastActive: { $gte: twoHoursAgo } }],
    })
      .sort({ lastActive: -1 })
      .limit(30)
      .lean();

    return NextResponse.json({ devices });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch devices';
    console.error('Error in GET /api/presence:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

