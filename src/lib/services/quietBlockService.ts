import { connectToDatabase } from '@/lib/mongodb'
import QuietBlock, { type IQuietBlock, type QuietBlockCreateInput, type QuietBlockUpdateInput, QuietBlockStatus } from '@/models/QuietBlock'
import { UserService } from './userService'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export class QuietBlockService {
  /**
   * Create a new quiet block
   * Ensures proper user ID mapping between Supabase and MongoDB
   */
  static async createQuietBlock(
    supabaseUser: SupabaseUser,
    blockData: Omit<QuietBlockCreateInput, 'supabaseUserId'>
  ): Promise<IQuietBlock> {
    await connectToDatabase()

    try {
      // Ensure user exists in MongoDB
      const { user, mongoUserId } = await UserService.ensureUserExists(supabaseUser)

      // Create the quiet block
      const quietBlockData: any = {
        ...blockData,
        userId: mongoUserId,
        supabaseUserId: supabaseUser.id,
        startTime: new Date(blockData.startTime),
        endTime: new Date(blockData.endTime)
      }

      // Calculate reminder time if specified
      if (blockData.reminderMinutesBefore) {
        const reminderTime = new Date(quietBlockData.startTime.getTime() - (blockData.reminderMinutesBefore * 60 * 1000))
        quietBlockData.reminderScheduledAt = reminderTime
      }

      const quietBlock = new QuietBlock(quietBlockData)
      await quietBlock.save()

      console.log(`✅ Quiet block created: ${quietBlock.title} for user ${user.email}`)
      return quietBlock
    } catch (error) {
      console.error('❌ Error creating quiet block:', error)
      throw new Error(`Failed to create quiet block: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get quiet blocks for a user
   */
  static async getUserQuietBlocks(
    supabaseUserId: string,
    filters?: {
      status?: QuietBlockStatus
      startDate?: Date
      endDate?: Date
      limit?: number
    }
  ): Promise<IQuietBlock[]> {
    await connectToDatabase()

    try {
      let query: any = { supabaseUserId }

      // Apply filters
      if (filters?.status) {
        query.status = filters.status
      }

      if (filters?.startDate || filters?.endDate) {
        query.startTime = {}
        if (filters.startDate) {
          query.startTime.$gte = filters.startDate
        }
        if (filters.endDate) {
          query.startTime.$lte = filters.endDate
        }
      }

      const queryBuilder = QuietBlock.find(query).sort({ startTime: 1 })

      if (filters?.limit) {
        queryBuilder.limit(filters.limit)
      }

      return await queryBuilder.exec()
    } catch (error) {
      console.error('❌ Error getting quiet blocks:', error)
      throw new Error(`Failed to get quiet blocks: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Update a quiet block
   */
  static async updateQuietBlock(
    quietBlockId: string,
    supabaseUserId: string,
    updates: QuietBlockUpdateInput
  ): Promise<IQuietBlock | null> {
    await connectToDatabase()

    try {
      const quietBlock = await QuietBlock.findOne({
        _id: quietBlockId,
        supabaseUserId
      })

      if (!quietBlock) {
        throw new Error('Quiet block not found')
      }

      // Update fields
      if (updates.title !== undefined) {
        quietBlock.title = updates.title
      }

      if (updates.description !== undefined) {
        quietBlock.description = updates.description
      }

      if (updates.startTime !== undefined) {
        quietBlock.startTime = new Date(updates.startTime)
      }

      if (updates.endTime !== undefined) {
        quietBlock.endTime = new Date(updates.endTime)
      }

      if (updates.status !== undefined) {
        quietBlock.status = updates.status
      }

      if (updates.tags !== undefined) {
        quietBlock.tags = updates.tags
      }

      // Recalculate reminder time if start time changed and reminder offset provided
      if (updates.reminderMinutesBefore !== undefined && quietBlock.startTime) {
        const reminderTime = new Date(quietBlock.startTime.getTime() - (updates.reminderMinutesBefore * 60 * 1000))
        quietBlock.reminderScheduledAt = reminderTime
        quietBlock.reminderSent = false // Reset reminder status
      }

      await quietBlock.save()
      return quietBlock
    } catch (error) {
      console.error('❌ Error updating quiet block:', error)
      throw new Error(`Failed to update quiet block: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete a quiet block
   */
  static async deleteQuietBlock(quietBlockId: string, supabaseUserId: string): Promise<boolean> {
    await connectToDatabase()

    try {
      const result = await QuietBlock.deleteOne({
        _id: quietBlockId,
        supabaseUserId
      })

      return result.deletedCount > 0
    } catch (error) {
      console.error('❌ Error deleting quiet block:', error)
      throw new Error(`Failed to delete quiet block: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get upcoming quiet blocks (next 7 days)
   */
  static async getUpcomingQuietBlocks(supabaseUserId: string): Promise<IQuietBlock[]> {
    const now = new Date()
    const nextWeek = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000))

    return this.getUserQuietBlocks(supabaseUserId, {
      status: QuietBlockStatus.SCHEDULED,
      startDate: now,
      endDate: nextWeek
    })
  }

  /**
   * Get active quiet blocks
   */
  static async getActiveQuietBlocks(supabaseUserId: string): Promise<IQuietBlock[]> {
    return this.getUserQuietBlocks(supabaseUserId, {
      status: QuietBlockStatus.ACTIVE
    })
  }

  /**
   * Mark quiet block as active (when it starts)
   */
  static async startQuietBlock(quietBlockId: string, supabaseUserId: string): Promise<IQuietBlock | null> {
    return this.updateQuietBlock(quietBlockId, supabaseUserId, {
      status: QuietBlockStatus.ACTIVE
    })
  }

  /**
   * Mark quiet block as completed
   */
  static async completeQuietBlock(quietBlockId: string, supabaseUserId: string): Promise<IQuietBlock | null> {
    return this.updateQuietBlock(quietBlockId, supabaseUserId, {
      status: QuietBlockStatus.COMPLETED
    })
  }

  /**
   * Cancel a quiet block
   */
  static async cancelQuietBlock(quietBlockId: string, supabaseUserId: string): Promise<IQuietBlock | null> {
    return this.updateQuietBlock(quietBlockId, supabaseUserId, {
      status: QuietBlockStatus.CANCELLED
    })
  }

  /**
   * Get quiet blocks that need reminders sent
   */
  static async getBlocksNeedingReminders(): Promise<IQuietBlock[]> {
    await connectToDatabase()

    try {
      const now = new Date()
      return await QuietBlock.find({
        reminderScheduledAt: { $lte: now },
        reminderSent: false,
        status: QuietBlockStatus.SCHEDULED
      })
    } catch (error) {
      console.error('❌ Error getting blocks needing reminders:', error)
      throw new Error(`Failed to get blocks needing reminders: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Mark reminder as sent
   */
  static async markReminderSent(quietBlockId: string): Promise<boolean> {
    await connectToDatabase()

    try {
      const result = await QuietBlock.updateOne(
        { _id: quietBlockId },
        { reminderSent: true }
      )

      return result.modifiedCount > 0
    } catch (error) {
      console.error('❌ Error marking reminder as sent:', error)
      return false
    }
  }

  /**
   * Check for conflicts with existing quiet blocks
   */
  static async checkForConflicts(
    supabaseUserId: string,
    startTime: Date,
    endTime: Date,
    excludeBlockId?: string
  ): Promise<IQuietBlock[]> {
    await connectToDatabase()

    try {
      const query: any = {
        supabaseUserId,
        status: { $in: [QuietBlockStatus.SCHEDULED, QuietBlockStatus.ACTIVE] },
        $or: [
          // New block starts during existing block
          {
            startTime: { $lte: startTime },
            endTime: { $gt: startTime }
          },
          // New block ends during existing block
          {
            startTime: { $lt: endTime },
            endTime: { $gte: endTime }
          },
          // New block completely contains existing block
          {
            startTime: { $gte: startTime },
            endTime: { $lte: endTime }
          }
        ]
      }

      if (excludeBlockId) {
        query._id = { $ne: excludeBlockId }
      }

      return await QuietBlock.find(query).sort({ startTime: 1 })
    } catch (error) {
      console.error('❌ Error checking for conflicts:', error)
      throw new Error(`Failed to check for conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}