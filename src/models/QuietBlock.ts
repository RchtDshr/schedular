import mongoose, { Document, Schema, Model, Types } from 'mongoose'

// TypeScript interface for QuietBlock
export interface IQuietBlock extends Document {
  userId: Types.ObjectId
  supabaseUserId: string
  title: string
  description?: string
  startTime: Date
  endTime: Date
  priority: 'low' | 'medium' | 'high'
  status: 'scheduled' | 'active' | 'completed' | 'cancelled'
  reminderConfig: {
    enabled: boolean
    minutesBefore: number
    emailEnabled: boolean
    pushEnabled: boolean
  }
  tags?: string[]
  isPrivate: boolean
  location?: string
  notes?: string
  actualStartTime?: Date
  actualEndTime?: Date
  reminderSent: boolean
  reminderScheduledAt?: Date
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
}

// Enum for status values
export enum QuietBlockStatus {
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// Enum for priority values
export enum QuietBlockPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

// QuietBlock schema
const QuietBlockSchema = new Schema<IQuietBlock>({
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
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters'],
    minlength: [1, 'Title is required']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  startTime: {
    type: Date,
    required: [true, 'Start time is required'],
    index: true
  },
  endTime: {
    type: Date,
    required: [true, 'End time is required'],
    validate: {
      validator: function(this: IQuietBlock, endTime: Date) {
        return endTime > this.startTime
      },
      message: 'End time must be after start time'
    }
  },
  priority: {
    type: String,
    enum: {
      values: Object.values(QuietBlockPriority),
      message: 'Priority must be one of: low, medium, high'
    },
    default: QuietBlockPriority.MEDIUM
  },
  status: {
    type: String,
    enum: {
      values: Object.values(QuietBlockStatus),
      message: 'Status must be one of: scheduled, active, completed, cancelled'
    },
    default: QuietBlockStatus.SCHEDULED,
    index: true
  },
  reminderConfig: {
    enabled: {
      type: Boolean,
      default: true
    },
    minutesBefore: {
      type: Number,
      default: 15,
      min: [1, 'Reminder must be at least 1 minute before'],
      max: [1440, 'Reminder cannot be more than 24 hours before']
    },
    emailEnabled: {
      type: Boolean,
      default: true
    },
    pushEnabled: {
      type: Boolean,
      default: false
    }
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot be more than 50 characters']
  }],
  isPrivate: {
    type: Boolean,
    default: false
  },
  location: {
    type: String,
    trim: true,
    maxlength: [200, 'Location cannot be more than 200 characters']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot be more than 1000 characters']
  },
  actualStartTime: {
    type: Date
  },
  actualEndTime: {
    type: Date,
    validate: {
      validator: function(this: IQuietBlock, actualEndTime: Date) {
        if (!actualEndTime || !this.actualStartTime) return true
        return actualEndTime > this.actualStartTime
      },
      message: 'Actual end time must be after actual start time'
    }
  },
  reminderSent: {
    type: Boolean,
    default: false,
    index: true
  },
  reminderScheduledAt: {
    type: Date,
    validate: {
      validator: function(this: IQuietBlock, reminderTime: Date) {
        if (!reminderTime) return true // Optional field
        return reminderTime < this.startTime
      },
      message: 'Reminder must be scheduled before the start time'
    }
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  collection: 'quietblocks'
})

// Compound indexes for better query performance
QuietBlockSchema.index({ userId: 1, startTime: 1 })
QuietBlockSchema.index({ supabaseUserId: 1, startTime: 1 })
QuietBlockSchema.index({ status: 1, startTime: 1 })
QuietBlockSchema.index({ reminderSent: 1, reminderScheduledAt: 1 })
QuietBlockSchema.index({ startTime: 1, endTime: 1 })

// Virtual for duration in minutes
QuietBlockSchema.virtual('durationMinutes').get(function(this: IQuietBlock) {
  return Math.round((this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60))
})

// Virtual for checking if block is currently active
QuietBlockSchema.virtual('isActive').get(function(this: IQuietBlock) {
  const now = new Date()
  return this.startTime <= now && now <= this.endTime && this.status === QuietBlockStatus.ACTIVE
})

// Virtual for checking if block is upcoming
QuietBlockSchema.virtual('isUpcoming').get(function(this: IQuietBlock) {
  return this.startTime > new Date() && this.status === QuietBlockStatus.SCHEDULED
})

// Instance methods
QuietBlockSchema.methods.toJSON = function() {
  const blockObject = this.toObject({ virtuals: true })
  delete blockObject.__v
  return blockObject
}

QuietBlockSchema.methods.markAsActive = function() {
  this.status = QuietBlockStatus.ACTIVE
  return this.save()
}

QuietBlockSchema.methods.markAsCompleted = function() {
  this.status = QuietBlockStatus.COMPLETED
  return this.save()
}

QuietBlockSchema.methods.markAsCancelled = function() {
  this.status = QuietBlockStatus.CANCELLED
  return this.save()
}

QuietBlockSchema.methods.markAsMissed = function() {
  this.status = QuietBlockStatus.CANCELLED // Using CANCELLED instead of MISSED
  return this.save()
}

QuietBlockSchema.methods.markReminderSent = function() {
  this.reminderSent = true
  return this.save()
}

// Static methods
QuietBlockSchema.statics.findByUser = function(userId: string) {
  return this.find({ supabaseUserId: userId }).sort({ startTime: 1 })
}

QuietBlockSchema.statics.findUpcoming = function(userId?: string) {
  const query: any = {
    startTime: { $gt: new Date() },
    status: QuietBlockStatus.SCHEDULED
  }
  if (userId) {
    query.supabaseUserId = userId
  }
  return this.find(query).sort({ startTime: 1 })
}

QuietBlockSchema.statics.findActive = function(userId?: string) {
  const now = new Date()
  const query: any = {
    startTime: { $lte: now },
    endTime: { $gte: now },
    status: QuietBlockStatus.ACTIVE
  }
  if (userId) {
    query.supabaseUserId = userId
  }
  return this.find(query)
}

QuietBlockSchema.statics.findPendingReminders = function() {
  const now = new Date()
  return this.find({
    reminderScheduledAt: { $lte: now },
    reminderSent: false,
    status: QuietBlockStatus.SCHEDULED
  })
}

// Pre-save middleware
QuietBlockSchema.pre('save', function(next) {
  // Auto-calculate reminder time if not set
  if (this.isNew && !this.reminderScheduledAt) {
    // Default to 15 minutes before start time
    this.reminderScheduledAt = new Date(this.startTime.getTime() - (15 * 60 * 1000))
  }
  
  // Validate that end time is after start time
  if (this.endTime <= this.startTime) {
    next(new Error('End time must be after start time'))
    return
  }
  
  // Validate minimum duration (15 minutes)
  const duration = (this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60)
  if (duration < 15) {
    next(new Error('Quiet block must be at least 15 minutes long'))
    return
  }
  
  next()
})

// Create and export the model
const QuietBlock: Model<IQuietBlock> = mongoose.models.QuietBlock || mongoose.model<IQuietBlock>('QuietBlock', QuietBlockSchema)

export default QuietBlock

// Type definitions for API requests/responses
export interface QuietBlockCreateInput {
  supabaseUserId: string
  title: string
  startTime: Date | string
  endTime: Date | string
  description?: string
  tags?: string[]
  reminderMinutesBefore?: number
}

export interface QuietBlockUpdateInput {
  title?: string
  startTime?: Date | string
  endTime?: Date | string
  description?: string
  tags?: string[]
  reminderMinutesBefore?: number
  status?: QuietBlockStatus
}

export interface QuietBlockResponse {
  id: string
  userId: string
  supabaseUserId: string
  title: string
  startTime: string
  endTime: string
  status: QuietBlockStatus
  reminderSent: boolean
  reminderScheduledAt?: string
  description?: string
  tags?: string[]
  durationMinutes: number
  isActive: boolean
  isUpcoming: boolean
  createdAt: string
  updatedAt: string
}

export interface QuietBlockFilters {
  userId?: string
  status?: QuietBlockStatus | QuietBlockStatus[]
  startDate?: Date
  endDate?: Date
  tags?: string[]
}

export interface QuietBlockStats {
  total: number
  scheduled: number
  completed: number
  cancelled: number
  missed: number
  totalMinutes: number
  averageDuration: number
}