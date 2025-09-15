import mongoose, { Document, Schema, Model } from 'mongoose'

// TypeScript interface for User
export interface IUser extends Document {
  supabaseId: string
  email: string
  name?: string
  preferences: {
    timezone?: string
    reminderEnabled?: boolean
    reminderMinutesBefore?: number
    defaultQuietBlockDuration?: number
    notificationEmail?: string
  }
  createdAt: Date
  updatedAt: Date
}

// User preferences schema
const PreferencesSchema = new Schema({
  timezone: {
    type: String,
    default: 'UTC',
    trim: true
  },
  reminderEnabled: {
    type: Boolean,
    default: true
  },
  reminderMinutesBefore: {
    type: Number,
    default: 15,
    min: [1, 'Reminder must be at least 1 minute before'],
    max: [1440, 'Reminder cannot be more than 24 hours before'] // 24 hours in minutes
  },
  defaultQuietBlockDuration: {
    type: Number,
    default: 60, // 60 minutes default
    min: [15, 'Quiet block must be at least 15 minutes'],
    max: [480, 'Quiet block cannot be more than 8 hours'] // 8 hours in minutes
  },
  notificationEmail: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(email: string) {
        if (!email) return true // Optional field
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
      },
      message: 'Please provide a valid email address'
    }
  }
}, { _id: false })

// Static methods interface
interface IUserModel extends Model<IUser> {
  findBySupabaseId(supabaseId: string): Promise<IUser | null>
  findByEmail(email: string): Promise<IUser | null>
}

// User schema
const UserSchema = new Schema<IUser>({
  supabaseId: {
    type: String,
    required: [true, 'Supabase ID is required'],
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(email: string) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
      },
      message: 'Please provide a valid email address'
    }
  },
  name: {
    type: String,
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  preferences: {
    type: PreferencesSchema,
    default: () => ({})
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  collection: 'users'
})

// Indexes for better query performance (removing duplicates since unique:true already creates indexes)
UserSchema.index({ createdAt: -1 })

// Instance methods
UserSchema.methods.toJSON = function() {
  const userObject = this.toObject()
  delete userObject.__v
  return userObject
}

// Static methods
UserSchema.statics.findBySupabaseId = function(supabaseId: string) {
  return this.findOne({ supabaseId })
}

UserSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase() })
}

// Pre-save middleware
UserSchema.pre('save', function(next) {
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase()
  }
  next()
})

// Create and export the model
const User = (mongoose.models.User || mongoose.model<IUser>('User', UserSchema)) as IUserModel

export default User

// Type definitions for API responses
export interface UserCreateInput {
  supabaseId: string
  email: string
  name?: string
  preferences?: Partial<IUser['preferences']>
}

export interface UserUpdateInput {
  name?: string
  preferences?: Partial<IUser['preferences']>
}

export interface UserResponse {
  id: string
  supabaseId: string
  email: string
  name?: string
  preferences: IUser['preferences']
  createdAt: string
  updatedAt: string
}