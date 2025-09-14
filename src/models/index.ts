// Central export file for all models
export { default as User } from './User'
export type { IUser, UserCreateInput, UserUpdateInput, UserResponse } from './User'

export { default as QuietBlock } from './QuietBlock'
export type { 
  IQuietBlock, 
  QuietBlockCreateInput, 
  QuietBlockUpdateInput, 
  QuietBlockResponse,
  QuietBlockFilters,
  QuietBlockStats 
} from './QuietBlock'
export { QuietBlockStatus } from './QuietBlock'

export { default as EmailLog } from './EmailLog'
export type { 
  IEmailLog, 
  EmailLogCreateInput, 
  EmailLogUpdateInput, 
  EmailLogResponse,
  EmailLogFilters,
  EmailStats 
} from './EmailLog'
export { EmailType, EmailStatus, EmailProvider } from './EmailLog'

// Re-export mongoose types for convenience
export type { Document, Types } from 'mongoose'