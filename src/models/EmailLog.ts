import mongoose, { Document, Schema, Model, Types } from 'mongoose'

// TypeScript interface for EmailLog
export interface IEmailLog extends Document {
  userId: Types.ObjectId
  supabaseUserId: string
  quietBlockId?: Types.ObjectId
  emailType: 'reminder' | 'welcome' | 'confirmation' | 'notification' | 'marketing'
  recipient: string
  subject: string
  templateId?: string
  status: 'pending' | 'sent' | 'delivered' | 'bounced' | 'failed' | 'opened' | 'clicked'
  provider: 'resend' | 'sendgrid' | 'ses' | 'nodemailer'
  providerMessageId?: string
  sentAt?: Date
  deliveredAt?: Date
  openedAt?: Date
  clickedAt?: Date
  bouncedAt?: Date
  failedAt?: Date
  errorMessage?: string
  metadata?: Record<string, any>
  retryCount: number
  nextRetryAt?: Date
  createdAt: Date
  updatedAt: Date
}

// Enum for email types
export enum EmailType {
  REMINDER = 'reminder',
  WELCOME = 'welcome',
  CONFIRMATION = 'confirmation',
  NOTIFICATION = 'notification',
  MARKETING = 'marketing'
}

// Enum for email status
export enum EmailStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  BOUNCED = 'bounced',
  FAILED = 'failed',
  OPENED = 'opened',
  CLICKED = 'clicked'
}

// Enum for email providers
export enum EmailProvider {
  RESEND = 'resend',
  SENDGRID = 'sendgrid',
  SES = 'ses',
  NODEMAILER = 'nodemailer'
}

// EmailLog schema
const EmailLogSchema = new Schema<IEmailLog>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  supabaseUserId: {
    type: String,
    required: [true, 'Supabase User ID is required'],
    trim: true,
    index: true
  },
  quietBlockId: {
    type: Schema.Types.ObjectId,
    ref: 'QuietBlock',
    index: true
  },
  emailType: {
    type: String,
    enum: {
      values: Object.values(EmailType),
      message: 'Email type must be one of: reminder, welcome, confirmation, notification, marketing'
    },
    required: [true, 'Email type is required'],
    index: true
  },
  recipient: {
    type: String,
    required: [true, 'Recipient email is required'],
    trim: true,
    lowercase: true,
    validate: {
      validator: function(email: string) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
      },
      message: 'Please provide a valid recipient email address'
    },
    index: true
  },
  subject: {
    type: String,
    required: [true, 'Email subject is required'],
    trim: true,
    maxlength: [300, 'Subject cannot be more than 300 characters']
  },
  templateId: {
    type: String,
    trim: true,
    maxlength: [100, 'Template ID cannot be more than 100 characters']
  },
  status: {
    type: String,
    enum: {
      values: Object.values(EmailStatus),
      message: 'Status must be one of: pending, sent, delivered, bounced, failed, opened, clicked'
    },
    default: EmailStatus.PENDING,
    index: true
  },
  provider: {
    type: String,
    enum: {
      values: Object.values(EmailProvider),
      message: 'Provider must be one of: resend, sendgrid, ses, nodemailer'
    },
    required: [true, 'Email provider is required'],
    index: true
  },
  providerMessageId: {
    type: String,
    trim: true,
    index: true
  },
  sentAt: {
    type: Date,
    index: true
  },
  deliveredAt: {
    type: Date,
    index: true
  },
  openedAt: {
    type: Date,
    index: true
  },
  clickedAt: {
    type: Date,
    index: true
  },
  bouncedAt: {
    type: Date,
    index: true
  },
  failedAt: {
    type: Date,
    index: true
  },
  errorMessage: {
    type: String,
    trim: true,
    maxlength: [1000, 'Error message cannot be more than 1000 characters']
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  retryCount: {
    type: Number,
    default: 0,
    min: [0, 'Retry count cannot be negative'],
    max: [10, 'Maximum 10 retry attempts allowed']
  },
  nextRetryAt: {
    type: Date,
    index: true
  }
}, {
  timestamps: true,
  collection: 'emaillogs'
})

// Compound indexes for better query performance
EmailLogSchema.index({ userId: 1, emailType: 1, createdAt: -1 })
EmailLogSchema.index({ supabaseUserId: 1, status: 1, createdAt: -1 })
EmailLogSchema.index({ quietBlockId: 1, emailType: 1 })
EmailLogSchema.index({ status: 1, nextRetryAt: 1 })
EmailLogSchema.index({ provider: 1, providerMessageId: 1 })
EmailLogSchema.index({ recipient: 1, emailType: 1, createdAt: -1 })
EmailLogSchema.index({ createdAt: -1 })

// Virtual for checking if email was successful
EmailLogSchema.virtual('isSuccessful').get(function(this: IEmailLog) {
  return [EmailStatus.SENT, EmailStatus.DELIVERED, EmailStatus.OPENED, EmailStatus.CLICKED].includes(this.status as EmailStatus)
})

// Virtual for checking if email failed
EmailLogSchema.virtual('isFailed').get(function(this: IEmailLog) {
  return [EmailStatus.BOUNCED, EmailStatus.FAILED].includes(this.status as EmailStatus)
})

// Virtual for checking if retry is needed
EmailLogSchema.virtual('needsRetry').get(function(this: IEmailLog) {
  return this.status === EmailStatus.FAILED && 
         this.retryCount < 3 && 
         this.nextRetryAt && 
         this.nextRetryAt <= new Date()
})

// Instance methods
EmailLogSchema.methods.toJSON = function() {
  const logObject = this.toObject({ virtuals: true })
  delete logObject.__v
  return logObject
}

EmailLogSchema.methods.markAsSent = function(providerMessageId?: string) {
  this.status = EmailStatus.SENT
  this.sentAt = new Date()
  if (providerMessageId) {
    this.providerMessageId = providerMessageId
  }
  return this.save()
}

EmailLogSchema.methods.markAsDelivered = function() {
  this.status = EmailStatus.DELIVERED
  this.deliveredAt = new Date()
  return this.save()
}

EmailLogSchema.methods.markAsOpened = function() {
  this.status = EmailStatus.OPENED
  this.openedAt = new Date()
  return this.save()
}

EmailLogSchema.methods.markAsClicked = function() {
  this.status = EmailStatus.CLICKED
  this.clickedAt = new Date()
  return this.save()
}

EmailLogSchema.methods.markAsBounced = function(errorMessage?: string) {
  this.status = EmailStatus.BOUNCED
  this.bouncedAt = new Date()
  if (errorMessage) {
    this.errorMessage = errorMessage
  }
  return this.save()
}

EmailLogSchema.methods.markAsFailed = function(errorMessage?: string) {
  this.status = EmailStatus.FAILED
  this.failedAt = new Date()
  this.retryCount += 1
  
  if (errorMessage) {
    this.errorMessage = errorMessage
  }
  
  // Schedule next retry (exponential backoff)
  if (this.retryCount <= 3) {
    const retryDelay = Math.pow(2, this.retryCount) * 60 * 1000 // 2^n minutes
    this.nextRetryAt = new Date(Date.now() + retryDelay)
  }
  
  return this.save()
}

// Static methods
EmailLogSchema.statics.findByUser = function(userId: string, emailType?: EmailType) {
  const query: any = { supabaseUserId: userId }
  if (emailType) {
    query.emailType = emailType
  }
  return this.find(query).sort({ createdAt: -1 })
}

EmailLogSchema.statics.findByQuietBlock = function(quietBlockId: string) {
  return this.find({ quietBlockId }).sort({ createdAt: -1 })
}

EmailLogSchema.statics.findPendingRetries = function() {
  return this.find({
    status: EmailStatus.FAILED,
    retryCount: { $lt: 3 },
    nextRetryAt: { $lte: new Date() }
  })
}

EmailLogSchema.statics.findByStatus = function(status: EmailStatus, limit?: number) {
  const query = this.find({ status }).sort({ createdAt: -1 })
  if (limit) {
    query.limit(limit)
  }
  return query
}

EmailLogSchema.statics.getEmailStats = function(userId?: string, dateFrom?: Date, dateTo?: Date) {
  const matchStage: any = {}
  
  if (userId) {
    matchStage.supabaseUserId = userId
  }
  
  if (dateFrom || dateTo) {
    matchStage.createdAt = {}
    if (dateFrom) matchStage.createdAt.$gte = dateFrom
    if (dateTo) matchStage.createdAt.$lte = dateTo
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        sent: { $sum: { $cond: [{ $eq: ['$status', EmailStatus.SENT] }, 1, 0] } },
        delivered: { $sum: { $cond: [{ $eq: ['$status', EmailStatus.DELIVERED] }, 1, 0] } },
        opened: { $sum: { $cond: [{ $eq: ['$status', EmailStatus.OPENED] }, 1, 0] } },
        clicked: { $sum: { $cond: [{ $eq: ['$status', EmailStatus.CLICKED] }, 1, 0] } },
        bounced: { $sum: { $cond: [{ $eq: ['$status', EmailStatus.BOUNCED] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', EmailStatus.FAILED] }, 1, 0] } },
        byType: {
          $push: {
            type: '$emailType',
            status: '$status'
          }
        }
      }
    }
  ])
}

// Pre-save middleware
EmailLogSchema.pre('save', function(next) {
  // Ensure recipient email is lowercase
  if (this.isModified('recipient')) {
    this.recipient = this.recipient.toLowerCase()
  }
  next()
})

// Create and export the model
const EmailLog: Model<IEmailLog> = mongoose.models.EmailLog || mongoose.model<IEmailLog>('EmailLog', EmailLogSchema)

export default EmailLog

// Type definitions for API requests/responses
export interface EmailLogCreateInput {
  supabaseUserId: string
  quietBlockId?: string
  emailType: EmailType
  recipient: string
  subject: string
  templateId?: string
  provider: EmailProvider
  metadata?: Record<string, any>
}

export interface EmailLogUpdateInput {
  status?: EmailStatus
  providerMessageId?: string
  errorMessage?: string
  metadata?: Record<string, any>
}

export interface EmailLogResponse {
  id: string
  userId: string
  supabaseUserId: string
  quietBlockId?: string
  emailType: EmailType
  recipient: string
  subject: string
  templateId?: string
  status: EmailStatus
  provider: EmailProvider
  providerMessageId?: string
  sentAt?: string
  deliveredAt?: string
  openedAt?: string
  clickedAt?: string
  bouncedAt?: string
  failedAt?: string
  errorMessage?: string
  metadata?: Record<string, any>
  retryCount: number
  nextRetryAt?: string
  isSuccessful: boolean
  isFailed: boolean
  needsRetry: boolean
  createdAt: string
  updatedAt: string
}

export interface EmailStats {
  total: number
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  failed: number
  openRate: number
  clickRate: number
  bounceRate: number
  deliveryRate: number
}

export interface EmailLogFilters {
  userId?: string
  emailType?: EmailType | EmailType[]
  status?: EmailStatus | EmailStatus[]
  provider?: EmailProvider
  dateFrom?: Date
  dateTo?: Date
  recipient?: string
}