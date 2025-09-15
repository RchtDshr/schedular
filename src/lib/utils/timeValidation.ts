import { IQuietBlock } from '@/models/QuietBlock'

export interface TimeSlot {
  startTime: Date
  endTime: Date
}

export interface OverlapCheckResult {
  hasOverlap: boolean
  conflictingBlocks: IQuietBlock[]
  message?: string
}

/**
 * Check if two time slots overlap
 */
export function doTimeSlotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
  return slot1.startTime < slot2.endTime && slot2.startTime < slot1.endTime
}

/**
 * Check if a new quiet block overlaps with existing ones
 */
export function checkQuietBlockOverlap(
  newBlock: TimeSlot,
  existingBlocks: IQuietBlock[],
  excludeBlockId?: string
): OverlapCheckResult {
  const conflictingBlocks: IQuietBlock[] = []

  for (const existingBlock of existingBlocks) {
    // Skip the block we're updating (for edit scenarios)
    if (excludeBlockId && existingBlock._id?.toString() === excludeBlockId) {
      continue
    }

    // Skip deleted blocks
    if (existingBlock.isDeleted) {
      continue
    }

    // Check for overlap
    if (doTimeSlotsOverlap(newBlock, {
      startTime: existingBlock.startTime,
      endTime: existingBlock.endTime
    })) {
      conflictingBlocks.push(existingBlock)
    }
  }

  const hasOverlap = conflictingBlocks.length > 0
  let message: string | undefined

  if (hasOverlap) {
    const blockTitles = conflictingBlocks.map(block => block.title || 'Untitled').join(', ')
    message = `Time conflict with existing quiet block${conflictingBlocks.length > 1 ? 's' : ''}: ${blockTitles}`
  }

  return {
    hasOverlap,
    conflictingBlocks,
    message
  }
}

/**
 * Validate time slot basic rules
 */
export function validateTimeSlot(startTime: Date, endTime: Date): { isValid: boolean; message?: string } {
  const now = new Date()
  
  // Check if start time is before end time
  if (startTime >= endTime) {
    return {
      isValid: false,
      message: 'Start time must be before end time'
    }
  }

  // Check if end time is in the past
  if (endTime <= now) {
    return {
      isValid: false,
      message: 'End time cannot be in the past'
    }
  }

  // Check minimum duration (15 minutes)
  const minDurationMs = 15 * 60 * 1000 // 15 minutes in milliseconds
  if (endTime.getTime() - startTime.getTime() < minDurationMs) {
    return {
      isValid: false,
      message: 'Quiet block must be at least 15 minutes long'
    }
  }

  // Check maximum duration (8 hours)
  const maxDurationMs = 8 * 60 * 60 * 1000 // 8 hours in milliseconds
  if (endTime.getTime() - startTime.getTime() > maxDurationMs) {
    return {
      isValid: false,
      message: 'Quiet block cannot be longer than 8 hours'
    }
  }

  return { isValid: true }
}

/**
 * Generate recurring time slots from a base quiet block
 */
export function generateRecurringSlots(
  baseStartTime: Date,
  baseEndTime: Date,
  recurrencePattern: string,
  endDate?: Date
): TimeSlot[] {
  const slots: TimeSlot[] = []
  const maxRecurrences = 52 // Limit to 52 weeks to prevent infinite loops
  let currentStart = new Date(baseStartTime)
  let currentEnd = new Date(baseEndTime)
  let count = 0

  while (count < maxRecurrences) {
    // Add current slot
    slots.push({
      startTime: new Date(currentStart),
      endTime: new Date(currentEnd)
    })

    // Check if we've reached the end date
    if (endDate && currentStart > endDate) {
      break
    }

    // Calculate next occurrence based on pattern
    switch (recurrencePattern.toLowerCase()) {
      case 'daily':
        currentStart.setDate(currentStart.getDate() + 1)
        currentEnd.setDate(currentEnd.getDate() + 1)
        break
      case 'weekly':
        currentStart.setDate(currentStart.getDate() + 7)
        currentEnd.setDate(currentEnd.getDate() + 7)
        break
      case 'monthly':
        currentStart.setMonth(currentStart.getMonth() + 1)
        currentEnd.setMonth(currentEnd.getMonth() + 1)
        break
      default:
        // No recurrence or unknown pattern
        break
    }

    count++
  }

  return slots
}

/**
 * Format duration in a human-readable way
 */
export function formatDuration(startTime: Date, endTime: Date): string {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  return `${minutes}m`
}