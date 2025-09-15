import { connectToDatabase } from '@/lib/mongodb'
import QuietBlock, { type IQuietBlock, QuietBlockStatus } from '@/models/QuietBlock'
import { UserService } from './userService'
import type { CreateQuietBlockInput, UpdateQuietBlockInput } from '@/lib/validations/quietBlockValidations'

// Query options interface
export interface QuietBlockQueryOptions {
  status?: 'scheduled' | 'active' | 'completed' | 'cancelled'
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
  sortBy?: 'startTime' | 'endTime' | 'createdAt' | 'priority' | 'title'
  sortOrder?: 'asc' | 'desc'
  tags?: string
  priority?: 'low' | 'medium' | 'high'
}

export class QuietBlockService {
  /**
   * Create a new quiet block
   * Ensures proper user ID mapping between Supabase and MongoDB
   */
  static async createQuietBlock(
    supabaseUserId: string,
    blockData: CreateQuietBlockInput
  ): Promise<IQuietBlock> {
    await connectToDatabase()

    try {
      // Get MongoDB user by Supabase ID
      const user = await UserService.getUserBySupabaseId(supabaseUserId)
      if (!user) {
        throw new Error('User not found')
      }

      // Create the quiet block
      const quietBlockData: any = {
        ...blockData,
        userId: user._id,
        supabaseUserId: supabaseUserId,
        // startTime and endTime are already Date objects from validation transform
        startTime: blockData.startTime,
        endTime: blockData.endTime
      }

      // Calculate reminder time if specified
      if (blockData.reminderConfig?.enabled && blockData.reminderConfig.minutesBefore) {
        const reminderTime = new Date(quietBlockData.startTime.getTime() - (blockData.reminderConfig.minutesBefore * 60 * 1000))
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
    options?: QuietBlockQueryOptions
  ): Promise<IQuietBlock[]> {
    await connectToDatabase()

    try {
      // Migrate existing records that don't have isDeleted field
      const migrationResult = await QuietBlock.updateMany(
        { isDeleted: { $exists: false } },
        { $set: { isDeleted: false } }
      )
      console.log('🔄 Migration result:', migrationResult)

      // Verify migration worked by checking the block again
      const verifyBlock = await QuietBlock.findOne({ supabaseUserId }).lean()
      console.log('🔍 Block after migration:', { 
        id: verifyBlock?._id, 
        title: verifyBlock?.title, 
        isDeleted: verifyBlock?.isDeleted 
      })

      const query: any = { 
        supabaseUserId,
        $or: [
          { isDeleted: false },
          { isDeleted: { $exists: false } },
          { isDeleted: null },
          { isDeleted: undefined }
        ]
      }

      console.log('🔍 QuietBlockService query for user:', supabaseUserId)

      // Apply filters
      if (options?.status) {
        query.status = options.status
      }

      if (options?.priority) {
        query.priority = options.priority
      }

      if (options?.startDate || options?.endDate) {
        query.startTime = {}
        if (options.startDate) {
          query.startTime.$gte = options.startDate
        }
        if (options.endDate) {
          query.startTime.$lte = options.endDate
        }
      }

      if (options?.tags) {
        // Split comma-separated tags and search for any of them
        const tags = options.tags.split(',').map(tag => tag.trim())
        query.tags = { $in: tags }
      }

      console.log('🔍 Final MongoDB query:', JSON.stringify(query, null, 2))
      if (options?.status) {
        query.status = options.status
      }

      if (options?.priority) {
        query.priority = options.priority
      }

      if (options?.startDate || options?.endDate) {
        query.startTime = {}
        if (options.startDate) {
          query.startTime.$gte = options.startDate
        }
        if (options.endDate) {
          query.startTime.$lte = options.endDate
        }
      }

      if (options?.tags) {
        // Split comma-separated tags and search for any of them
        const tags = options.tags.split(',').map(tag => tag.trim())
        query.tags = { $in: tags }
      }

      console.log('🔍 Final MongoDB query:', JSON.stringify(query, null, 2))

      // Build sort object
      const sortBy = options?.sortBy || 'startTime'
      const sortOrder = options?.sortOrder === 'desc' ? -1 : 1
      const sort: any = { [sortBy]: sortOrder }

      const queryBuilder = QuietBlock.find(query).sort(sort)

      if (options?.limit) {
        queryBuilder.limit(options.limit)
      }

      if (options?.offset) {
        queryBuilder.skip(options.offset)
      }

      const results = await queryBuilder.exec()
      console.log('📋 MongoDB query results:', results.length, 'documents')
      
      return results
    } catch (error) {
      console.error('❌ Error fetching quiet blocks:', error)
      throw new Error(`Failed to fetch quiet blocks: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get count of user's quiet blocks (for pagination)
   */
  static async getUserQuietBlocksCount(
    supabaseUserId: string,
    options?: QuietBlockQueryOptions
  ): Promise<number> {
    await connectToDatabase()

    try {
      const query: any = { 
        supabaseUserId,
        $or: [
          { isDeleted: false },
          { isDeleted: { $exists: false } },
          { isDeleted: null },
          { isDeleted: undefined }
        ]
      }

      // Apply same filters as getUserQuietBlocks
      if (options?.status) {
        query.status = options.status
      }

      if (options?.priority) {
        query.priority = options.priority
      }

      if (options?.startDate || options?.endDate) {
        query.startTime = {}
        if (options.startDate) {
          query.startTime.$gte = options.startDate
        }
        if (options.endDate) {
          query.startTime.$lte = options.endDate
        }
      }

      if (options?.tags) {
        const tags = options.tags.split(',').map(tag => tag.trim())
        query.tags = { $in: tags }
      }

      return await QuietBlock.countDocuments(query)
    } catch (error) {
      console.error('❌ Error counting quiet blocks:', error)
      throw new Error(`Failed to count quiet blocks: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Update a quiet block
   */
  static async updateQuietBlock(
    quietBlockId: string,
    supabaseUserId: string,
    updates: UpdateQuietBlockInput
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
        if (updates.date) {
          // If we have a date field, combine date + time
          quietBlock.startTime = new Date(`${updates.date}T${updates.startTime}`)
        } else {
          // Otherwise assume it's a full datetime string or try to parse as-is
          quietBlock.startTime = new Date(updates.startTime)
        }
      }

      if (updates.endTime !== undefined) {
        if (updates.date) {
          // If we have a date field, combine date + time
          quietBlock.endTime = new Date(`${updates.date}T${updates.endTime}`)
        } else {
          // Otherwise assume it's a full datetime string or try to parse as-is
          quietBlock.endTime = new Date(updates.endTime)
        }
      }

      if (updates.status !== undefined) {
        quietBlock.status = updates.status
      }

      if (updates.tags !== undefined) {
        quietBlock.tags = updates.tags
      }

      // Recalculate reminder time if reminder config or start time changed
      if (updates.reminderConfig?.minutesBefore !== undefined && quietBlock.startTime) {
        const reminderTime = new Date(quietBlock.startTime.getTime() - (updates.reminderConfig.minutesBefore * 60 * 1000))
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
   * Get a single quiet block by ID
   */
  static async getQuietBlockById(quietBlockId: string, supabaseUserId: string): Promise<IQuietBlock | null> {
    await connectToDatabase()

    try {
      const quietBlock = await QuietBlock.findOne({
        _id: quietBlockId,
        supabaseUserId,
        isDeleted: false
      })

      return quietBlock
    } catch (error) {
      console.error('❌ Error getting quiet block by ID:', error)
      throw new Error(`Failed to get quiet block: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete a quiet block (soft delete)
   */
  static async deleteQuietBlock(quietBlockId: string, supabaseUserId: string): Promise<IQuietBlock | null> {
    await connectToDatabase()

    try {
      const quietBlock = await QuietBlock.findOneAndUpdate(
        {
          _id: quietBlockId,
          supabaseUserId,
          isDeleted: false
        },
        {
          isDeleted: true,
          status: QuietBlockStatus.CANCELLED
        },
        { new: true }
      )

      return quietBlock
    } catch (error) {
      console.error('❌ Error deleting quiet block:', error)
      throw new Error(`Failed to delete quiet block: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete a quiet block (hard delete)
   */
  static async hardDeleteQuietBlock(quietBlockId: string, supabaseUserId: string): Promise<boolean> {
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
  static async completeQuietBlock(
    quietBlockId: string, 
    supabaseUserId: string,
    completeData?: { actualStartTime?: Date; actualEndTime?: Date; notes?: string }
  ): Promise<IQuietBlock | null> {
    const updateData: any = {
      status: QuietBlockStatus.COMPLETED
    }

    if (completeData?.actualStartTime) {
      updateData.actualStartTime = completeData.actualStartTime
    }

    if (completeData?.actualEndTime) {
      updateData.actualEndTime = completeData.actualEndTime
    }

    if (completeData?.notes) {
      updateData.notes = completeData.notes
    }

    return this.updateQuietBlock(quietBlockId, supabaseUserId, updateData)
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