import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDeviceDocument extends Document {
  sessionId: string;
  name: string;
  deviceType: string;
  userAgent?: string;
  status: 'online' | 'offline';
  lastActive: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSchema: Schema<IDeviceDocument> = new Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    deviceType: {
      type: String,
      default: 'Unknown Device',
    },
    userAgent: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['online', 'offline'],
      default: 'online',
      index: true,
    },
    lastActive: {
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
const Device: Model<IDeviceDocument> =
  mongoose.models.Device || mongoose.model<IDeviceDocument>('Device', DeviceSchema);

export default Device;

