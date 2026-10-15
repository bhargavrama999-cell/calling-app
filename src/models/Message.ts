import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMessageDocument extends Document {
  sender: string;
  senderSessionId: string;
  deviceType?: string;
  content: string;
  roomId: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema: Schema<IMessageDocument> = new Schema(
  {
    sender: {
      type: String,
      required: true,
      trim: true,
    },
    senderSessionId: {
      type: String,
      required: true,
      index: true,
    },
    deviceType: {
      type: String,
      default: 'Unknown Device',
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    roomId: {
      type: String,
      default: 'general',
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent model overwrite in development hot reloading
const Message: Model<IMessageDocument> =
  mongoose.models.Message || mongoose.model<IMessageDocument>('Message', MessageSchema);

export default Message;

