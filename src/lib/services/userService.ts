import { connectToDatabase } from '@/lib/mongodb'
import User, { type IUser, type UserCreateInput, type UserUpdateInput } from '@/models/User'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export class UserService {
  /**
   * Sync a Supabase user with MongoDB
   * Creates or updates the user record
   */
  static async syncSupabaseUser(supabaseUser: SupabaseUser): Promise<IUser> {
    await connectToDatabase()

    try {
      // Check if user already exists
      let user = await User.findBySupabaseId(supabaseUser.id)

      if (user) {
        // Update existing user if email changed
        if (user.email !== supabaseUser.email) {
          user.email = supabaseUser.email!
          await user.save()
        }
        return user
      }

      // Create new user
      const userData: UserCreateInput = {
        supabaseId: supabaseUser.id,
        email: supabaseUser.email!,
        name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name,
        preferences: {
          timezone: 'UTC',
          reminderEnabled: true,
          reminderMinutesBefore: 15,
          defaultQuietBlockDuration: 60,
          notificationEmail: supabaseUser.email
        }
      }

      user = new User(userData)
      await user.save()

      console.log(`✅ User synced: ${user.email} (${user.supabaseId})`)
      return user
    } catch (error) {
      console.error('❌ Error syncing user:', error)
      throw new Error(`Failed to sync user: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get user by Supabase ID
   */
  static async getUserBySupabaseId(supabaseId: string): Promise<IUser | null> {
    await connectToDatabase()
    return User.findBySupabaseId(supabaseId)
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string): Promise<IUser | null> {
    await connectToDatabase()
    return User.findByEmail(email)
  }

  /**
   * Update user data
   */
  static async updateUser(supabaseId: string, updates: UserUpdateInput): Promise<IUser | null> {
    await connectToDatabase()

    try {
      const user = await User.findBySupabaseId(supabaseId)
      if (!user) {
        throw new Error('User not found')
      }

      // Update fields
      if (updates.name !== undefined) {
        user.name = updates.name
      }

      if (updates.preferences) {
        user.preferences = {
          ...user.preferences,
          ...updates.preferences
        }
      }

      await user.save()
      return user
    } catch (error) {
      console.error('❌ Error updating user:', error)
      throw new Error(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete user (soft delete - just mark as inactive)
   */
  static async deleteUser(supabaseId: string): Promise<boolean> {
    await connectToDatabase()

    try {
      const result = await User.deleteOne({ supabaseId })
      return result.deletedCount > 0
    } catch (error) {
      console.error('❌ Error deleting user:', error)
      throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get user with their MongoDB ObjectId for use in other collections
   */
  static async getUserWithObjectId(supabaseId: string): Promise<{ user: IUser; mongoUserId: string } | null> {
    await connectToDatabase()

    const user = await User.findBySupabaseId(supabaseId)
    if (!user) return null

    return {
      user,
      mongoUserId: (user._id as any).toString()
    }
  }

  /**
   * Ensure user exists (sync if not found)
   */
  static async ensureUserExists(supabaseUser: SupabaseUser): Promise<{ user: IUser; mongoUserId: string }> {
    let user = await this.getUserBySupabaseId(supabaseUser.id)
    
    if (!user) {
      user = await this.syncSupabaseUser(supabaseUser)
    }

    return {
      user,
      mongoUserId: (user._id as any).toString()
    }
  }

  /**
   * Get user statistics
   */
  static async getUserStats(supabaseId: string): Promise<{
    totalQuietBlocks: number
    completedQuietBlocks: number
    totalMinutesScheduled: number
    joinedDate: Date
  } | null> {
    await connectToDatabase()

    try {
      const user = await User.findBySupabaseId(supabaseId)
      if (!user) return null

      // Import QuietBlock here to avoid circular dependency
      const { default: QuietBlock } = await import('@/models/QuietBlock')

      const stats = await QuietBlock.aggregate([
        { $match: { supabaseUserId: supabaseId } },
        {
          $group: {
            _id: null,
            totalQuietBlocks: { $sum: 1 },
            completedQuietBlocks: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            totalMinutesScheduled: {
              $sum: {
                $divide: [
                  { $subtract: ['$endTime', '$startTime'] },
                  1000 * 60 // Convert milliseconds to minutes
                ]
              }
            }
          }
        }
      ])

      const result = stats[0] || {
        totalQuietBlocks: 0,
        completedQuietBlocks: 0,
        totalMinutesScheduled: 0
      }

      return {
        ...result,
        joinedDate: user.createdAt
      }
    } catch (error) {
      console.error('❌ Error getting user stats:', error)
      return null
    }
  }
}