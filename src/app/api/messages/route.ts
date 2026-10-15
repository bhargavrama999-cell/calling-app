import { NextRequest, NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher-server';
import { connectToDatabase } from '@/lib/mongodb';
import Message from '@/models/Message';

// GET: Retrieve recent chat history
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const roomId = searchParams.get('roomId') || 'general';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    if (!process.env.MONGODB_URI) {
      // In development or if MongoDB is not configured yet, return empty list gracefully
      return NextResponse.json({ messages: [], warning: 'MongoDB not connected' });
    }

    await connectToDatabase();

    const messages = await Message.find({ roomId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    // Return in chronological order
    return NextResponse.json({ messages: messages.reverse() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch messages';
    console.error('Error in GET /api/messages:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Store message in MongoDB Atlas and broadcast via Pusher
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, sender, senderSessionId, deviceType, roomId = 'general' } = body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json(
        { error: 'Message content cannot be empty' },
        { status: 400 }
      );
    }

    if (!sender || !senderSessionId) {
      return NextResponse.json(
        { error: 'Sender name and sessionId are required' },
        { status: 400 }
      );
    }

    const trimmedContent = content.trim();
    const timestamp = new Date();

    let savedMessage: {
      _id: string;
      sender: string;
      senderSessionId: string;
      deviceType: string;
      content: string;
      roomId: string;
      timestamp: Date;
    };

    if (process.env.MONGODB_URI) {
      await connectToDatabase();

      const messageDoc = await Message.create({
        sender,
        senderSessionId,
        deviceType: deviceType || 'Unknown Device',
        content: trimmedContent,
        roomId,
        timestamp,
      });

      savedMessage = {
        _id: messageDoc._id.toString(),
        sender: messageDoc.sender,
        senderSessionId: messageDoc.senderSessionId,
        deviceType: messageDoc.deviceType || 'Unknown Device',
        content: messageDoc.content,
        roomId: messageDoc.roomId,
        timestamp: messageDoc.timestamp,
      };
    } else {
      // Fallback object if MongoDB is pending setup
      savedMessage = {
        _id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        sender,
        senderSessionId,
        deviceType: deviceType || 'Unknown Device',
        content: trimmedContent,
        roomId,
        timestamp,
      };
    }

    // Broadcast the new message in real-time to all connected devices in the presence channel
    const channelName = `presence-devices-${roomId}`;
    await pusherServer.trigger(channelName, 'chat-message', savedMessage);

    return NextResponse.json(savedMessage, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send message';
    console.error('Error in POST /api/messages:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

