export interface IDevice {
  sessionId: string;
  name: string;
  deviceType?: string;
  userAgent?: string;
  status: 'online' | 'offline';
  lastActive: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface IMessage {
  _id?: string;
  id?: string;
  sender: string;
  senderSessionId: string;
  deviceType?: string;
  content: string;
  roomId?: string;
  timestamp: string | Date;
  createdAt?: string | Date;
}

export interface PresenceMemberInfo {
  name: string;
  deviceType: string;
  userAgent?: string;
  joinedAt?: string;
}

export interface PusherMember {
  id: string;
  info: PresenceMemberInfo;
}

