import { Schema, model, models, type Model, type Types } from 'mongoose';

export type ContactStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'SPAM';

export interface ContactMessageDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  /** Which page the enquiry came from — helps triage without asking. */
  source: string;
  status: ContactStatus;
  adminReply: string;
  /** Best-effort provenance for abuse handling. Never rendered publicly. */
  ip: string;
  userAgent: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContactMessageSchema = new Schema<ContactMessageDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160, index: true },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    source: { type: String, default: 'contact', trim: true, maxlength: 120 },
    status: {
      type: String,
      enum: ['NEW', 'IN_PROGRESS', 'RESOLVED', 'SPAM'] as const,
      default: 'NEW',
      index: true,
    },
    adminReply: { type: String, default: '', maxlength: 2000 },
    ip: { type: String, default: '', maxlength: 64 },
    userAgent: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true, collection: 'contact_messages' },
);

ContactMessageSchema.index({ status: 1, createdAt: -1 });
ContactMessageSchema.index({ createdAt: -1 });
// Reasonable guard against one person spamming the form.
ContactMessageSchema.index({ email: 1, createdAt: -1 });

export const ContactMessage =
  (models.ContactMessage as Model<ContactMessageDoc>) ||
  model<ContactMessageDoc>('ContactMessage', ContactMessageSchema);