// Common API response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

// Common query parameters
export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface DateRangeParams {
  startDate?: string | Date
  endDate?: string | Date
}

// Database connection status
export interface DatabaseStatus {
  connected: boolean
  status: string
  host?: string
  database?: string
}

// User preferences with strict typing
export interface UserPreferences {
  timezone: string
  reminderEnabled: boolean
  reminderMinutesBefore: number
  defaultQuietBlockDuration: number
  notificationEmail?: string
}

// Quiet block with computed fields
export interface QuietBlockWithMeta {
  id: string
  userId: string
  supabaseUserId: string
  title: string
  description?: string
  startTime: Date
  endTime: Date
  status: 'scheduled' | 'active' | 'completed' | 'cancelled' | 'missed'
  reminderSent: boolean
  reminderScheduledAt?: Date
  tags?: string[]
  durationMinutes: number
  isActive: boolean
  isUpcoming: boolean
  isPast: boolean
  createdAt: Date
  updatedAt: Date
}

// Email template data
export interface EmailTemplateData {
  userName?: string
  userEmail: string
  quietBlockTitle?: string
  quietBlockStartTime?: Date
  quietBlockEndTime?: Date
  quietBlockDuration?: number
  unsubscribeUrl?: string
  dashboardUrl?: string
  [key: string]: any
}

// Error types
export interface ValidationError {
  field: string
  message: string
  value?: any
}

export interface ApiError {
  code: string
  message: string
  details?: ValidationError[]
  statusCode?: number
}

// Time zone information
export interface TimeZoneInfo {
  value: string
  label: string
  offset: string
  country?: string
}

// Common status types
export type Status = 'active' | 'inactive' | 'pending' | 'completed' | 'cancelled'

// Generic ID type
export type ID = string

// Date string in ISO format
export type ISODateString = string

// Email address type
export type EmailAddress = string

// Environment types
export type Environment = 'development' | 'staging' | 'production'

// HTTP methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

// Generic key-value object
export type KeyValuePair<T = any> = Record<string, T>

// Utility types for partial updates
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>

// Form state types
export interface FormState<T = any> {
  data: T
  errors: Record<string, string>
  isSubmitting: boolean
  isDirty: boolean
  isValid: boolean
}

// Loading state
export interface LoadingState {
  isLoading: boolean
  error?: string
  lastUpdated?: Date
}

// Search and filter types
export interface SearchParams {
  query?: string
  filters?: KeyValuePair
  sort?: {
    field: string
    direction: 'asc' | 'desc'
  }
}

// Audit log entry
export interface AuditLogEntry {
  id: string
  userId: string
  action: string
  resource: string
  resourceId?: string
  changes?: KeyValuePair
  metadata?: KeyValuePair
  ipAddress?: string
  userAgent?: string
  timestamp: Date
}

// Notification types
export interface Notification {
  id: string
  userId: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  read: boolean
  actionUrl?: string
  createdAt: Date
  expiresAt?: Date
}

// Feature flag
export interface FeatureFlag {
  name: string
  enabled: boolean
  description?: string
  rolloutPercentage?: number
  targetUsers?: string[]
  environment?: Environment[]
}

// Analytics event
export interface AnalyticsEvent {
  name: string
  userId?: string
  properties?: KeyValuePair
  timestamp?: Date
  sessionId?: string
}

// File upload types
export interface FileUpload {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
  url?: string
}

// Theme and appearance
export interface ThemeSettings {
  mode: 'light' | 'dark' | 'system'
  primaryColor: string
  fontSize: 'small' | 'medium' | 'large'
  compactMode: boolean
}

// Application settings
export interface AppSettings {
  theme: ThemeSettings
  notifications: {
    email: boolean
    push: boolean
    inApp: boolean
  }
  privacy: {
    shareAnalytics: boolean
    shareUsageData: boolean
  }
}