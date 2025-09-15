import { z } from 'zod'

// Priority enum validation
export const PrioritySchema = z.enum(['low', 'medium', 'high'], {
  message: 'Priority must be low, medium, or high'
})

// Status enum validation
export const StatusSchema = z.enum(['scheduled', 'active', 'completed', 'cancelled'], {
  message: 'Status must be scheduled, active, completed, or cancelled'
})

// Time validation helper (HH:MM format)
const timeString = z.string().refine((val) => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  return timeRegex.test(val)
}, {
  message: 'Invalid time format, use HH:MM'
})

// Date validation helper (YYYY-MM-DD format)
const dateString = z.string().refine((val) => {
  const date = new Date(val)
  return !isNaN(date.getTime())
}, {
  message: 'Invalid date format'
})

// Reminder configuration schema
export const ReminderConfigSchema = z.object({
  enabled: z.boolean().default(true),
  minutesBefore: z.number()
    .min(1, 'Reminder must be at least 1 minute before')
    .max(1440, 'Reminder cannot be more than 24 hours before')
    .default(15),
  emailEnabled: z.boolean().default(true),
  pushEnabled: z.boolean().default(false)
}).optional()

// Base quiet block schema for creation
export const CreateQuietBlockSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(100, 'Title cannot exceed 100 characters')
    .trim(),
  
  description: z.string()
    .max(500, 'Description cannot exceed 500 characters')
    .trim()
    .optional(),
  
  date: dateString,
  
  startTime: timeString,
  
  endTime: timeString,
  
  priority: PrioritySchema.default('medium'),
  
  reminderConfig: ReminderConfigSchema,
  
  tags: z.array(z.string().trim().min(1)).max(10, 'Cannot have more than 10 tags').optional(),
  
  isPrivate: z.boolean().default(false),
  
  location: z.string().max(200, 'Location cannot exceed 200 characters').trim().optional(),
  
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').trim().optional()
}).refine((data) => {
  // Validate start time is before end time
  const startDateTime = new Date(`${data.date}T${data.startTime}`)
  const endDateTime = new Date(`${data.date}T${data.endTime}`)
  return startDateTime < endDateTime
}, {
  message: 'Start time must be before end time',
  path: ['endTime']
}).refine((data) => {
  // Validate end time is not in the past (allow current time + 1 minute buffer)
  // Note: We're assuming the date/time is in the user's local timezone
  // The client sends date as YYYY-MM-DD and time as HH:MM in local timezone
  const endDateTime = new Date(`${data.date}T${data.endTime}`)
  const now = new Date()
  const bufferTime = new Date(now.getTime() + 60000) // 1 minute buffer
  
  console.log('Server validation - End time check:')
  console.log('Date:', data.date)
  console.log('End time:', data.endTime)
  console.log('Constructed datetime string:', `${data.date}T${data.endTime}`)
  console.log('End DateTime:', endDateTime.toISOString())
  console.log('End DateTime Local:', endDateTime.toString())
  console.log('Now:', now.toISOString())
  console.log('Now Local:', now.toString())
  console.log('Buffer time:', bufferTime.toISOString())
  console.log('Is valid?', endDateTime >= bufferTime)
  console.log('Difference in minutes:', (endDateTime.getTime() - now.getTime()) / (1000 * 60))
  
  return endDateTime >= bufferTime
}, {
  message: 'End time must be at least 1 minute in the future',
  path: ['endTime']
}).refine((data) => {
  // Validate minimum duration (15 minutes)
  const startDateTime = new Date(`${data.date}T${data.startTime}`)
  const endDateTime = new Date(`${data.date}T${data.endTime}`)
  const duration = endDateTime.getTime() - startDateTime.getTime()
  return duration >= 15 * 60 * 1000
}, {
  message: 'Quiet block must be at least 15 minutes long',
  path: ['endTime']
}).refine((data) => {
  // Validate maximum duration (8 hours)
  const startDateTime = new Date(`${data.date}T${data.startTime}`)
  const endDateTime = new Date(`${data.date}T${data.endTime}`)
  const duration = endDateTime.getTime() - startDateTime.getTime()
  return duration <= 8 * 60 * 60 * 1000
}, {
  message: 'Quiet block cannot be longer than 8 hours',
  path: ['endTime']
}).transform((data) => {
  // Transform the separate date/time fields into Date objects for the API
  const startDateTime = new Date(`${data.date}T${data.startTime}`)
  const endDateTime = new Date(`${data.date}T${data.endTime}`)
  
  return {
    ...data,
    startTime: startDateTime,
    endTime: endDateTime,
    // Keep the original date field for MongoDB storage
    date: data.date
  }
})

// Schema for updating a quiet block (all fields optional except validation rules)
export const UpdateQuietBlockSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(100, 'Title cannot exceed 100 characters')
    .trim()
    .optional(),
  
  description: z.string()
    .max(500, 'Description cannot exceed 500 characters')
    .trim()
    .optional(),
  
  date: dateString.optional(),
  
  startTime: timeString.optional(),
  
  endTime: timeString.optional(),
  
  priority: PrioritySchema.optional(),
  
  status: StatusSchema.optional(),
  
  reminderConfig: ReminderConfigSchema,
  
  tags: z.array(z.string().trim().min(1)).max(10, 'Cannot have more than 10 tags').optional(),
  
  isPrivate: z.boolean().optional(),
  
  location: z.string().max(200, 'Location cannot exceed 200 characters').trim().optional(),
  
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').trim().optional(),
  
  actualStartTime: dateString.optional(),
  
  actualEndTime: dateString.optional()
}).refine((data) => {
  // Validate start time is before end time (if both provided)
  if (data.startTime && data.endTime && data.date) {
    const startDateTime = new Date(`${data.date}T${data.startTime}`)
    const endDateTime = new Date(`${data.date}T${data.endTime}`)
    return startDateTime < endDateTime
  }
  return true
}, {
  message: 'Start time must be before end time',
  path: ['endTime']
}).refine((data) => {
  // Validate duration if both times provided
  if (data.startTime && data.endTime && data.date) {
    const startDateTime = new Date(`${data.date}T${data.startTime}`)
    const endDateTime = new Date(`${data.date}T${data.endTime}`)
    const duration = endDateTime.getTime() - startDateTime.getTime()
    return duration >= 15 * 60 * 1000 && duration <= 8 * 60 * 60 * 1000
  }
  return true
}, {
  message: 'Quiet block duration must be between 15 minutes and 8 hours',
  path: ['endTime']
}).refine((data) => {
  // Validate actual times
  if (data.actualStartTime && data.actualEndTime) {
    return data.actualStartTime < data.actualEndTime
  }
  return true
}, {
  message: 'Actual start time must be before actual end time',
  path: ['actualEndTime']
})

// Schema for query parameters
export const QuietBlockQuerySchema = z.object({
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  status: StatusSchema.optional(),
  priority: PrioritySchema.optional(),
  tags: z.string().optional(), // Comma-separated tags
  limit: z.number().min(1).max(100).default(50).optional(),
  offset: z.number().min(0).default(0).optional(),
  sortBy: z.enum(['startTime', 'endTime', 'createdAt', 'priority', 'title']).default('startTime').optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc').optional()
})

// Schema for bulk operations
export const BulkUpdateQuietBlocksSchema = z.object({
  ids: z.array(z.string().min(1, 'Invalid ID')).min(1, 'At least one ID is required'),
  updates: UpdateQuietBlockSchema.omit({ startTime: true, endTime: true }) // Don't allow time changes in bulk
})

// Schema for marking a quiet block as completed
export const CompleteQuietBlockSchema = z.object({
  actualStartTime: dateString.optional(),
  actualEndTime: dateString.optional(),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').trim().optional()
})

// Type exports for use in API routes
export type CreateQuietBlockInput = z.infer<typeof CreateQuietBlockSchema>
export type UpdateQuietBlockInput = z.infer<typeof UpdateQuietBlockSchema>
export type QuietBlockQuery = z.infer<typeof QuietBlockQuerySchema>
export type BulkUpdateQuietBlocksInput = z.infer<typeof BulkUpdateQuietBlocksSchema>
export type CompleteQuietBlockInput = z.infer<typeof CompleteQuietBlockSchema>

// Validation helper functions
export function validateCreateQuietBlock(data: unknown) {
  return CreateQuietBlockSchema.safeParse(data)
}

export function validateUpdateQuietBlock(data: unknown) {
  return UpdateQuietBlockSchema.safeParse(data)
}

export function validateQuietBlockQuery(data: unknown) {
  return QuietBlockQuerySchema.safeParse(data)
}

export function validateBulkUpdateQuietBlocks(data: unknown) {
  return BulkUpdateQuietBlocksSchema.safeParse(data)
}

export function validateCompleteQuietBlock(data: unknown) {
  return CompleteQuietBlockSchema.safeParse(data)
}