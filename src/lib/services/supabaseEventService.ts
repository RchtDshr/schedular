import { createClient } from '@/utils/supabase/server'

// Event types for Supabase real-time notifications
export type SupabaseEventType = 
  | 'quiet_block_created'
  | 'quiet_block_updated' 
  | 'quiet_block_deleted'
  | 'quiet_block_completed'
  | 'quiet_block_started'

// Supabase event data structure (lightweight for real-time)
export interface SupabaseEventData {
  user_id: string
  event_type: SupabaseEventType
  mongo_block_id: string
  timestamp: string
  event_data: {
    title?: string
    start_time?: string
    end_time?: string
    status?: string
    priority?: string
    [key: string]: any
  }
}

// Create the quiet_blocks_events table schema (for reference)
// This should be created in Supabase manually or via migration:
/*
CREATE TABLE quiet_blocks_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  mongo_block_id TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE quiet_blocks_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own events
CREATE POLICY "Users can view their own events" ON quiet_blocks_events
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can only insert their own events
CREATE POLICY "Users can insert their own events" ON quiet_blocks_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Enable real-time
ALTER PUBLICATION supabase_realtime ADD TABLE quiet_blocks_events;
*/

export class SupabaseEventService {
  /**
   * Trigger a quiet block event in Supabase for real-time updates
   */
  static async triggerEvent(
    supabaseUserId: string,
    eventType: SupabaseEventType,
    mongoBlockId: string,
    eventData: Record<string, any> = {}
  ): Promise<void> {
    try {
      const supabase = await createClient()

      const eventRecord: Omit<SupabaseEventData, 'timestamp'> = {
        user_id: supabaseUserId,
        event_type: eventType,
        mongo_block_id: mongoBlockId,
        event_data: {
          ...eventData,
          timestamp: new Date().toISOString()
        }
      }

      const { error } = await supabase
        .from('quiet_blocks_events')
        .insert(eventRecord)

      if (error) {
        console.error('❌ Failed to trigger Supabase event:', error)
        // Don't throw error - event triggering is non-critical
        return
      }

      console.log(`✅ Supabase event triggered: ${eventType} for block ${mongoBlockId}`)
    } catch (error) {
      console.error('❌ Error triggering Supabase event:', error)
      // Don't throw error - event triggering is non-critical
    }
  }

  /**
   * Trigger quiet block creation event
   */
  static async triggerCreated(
    supabaseUserId: string,
    mongoBlockId: string,
    blockData: {
      title: string
      startTime: Date
      endTime: Date
      priority: string
      status: string
    }
  ): Promise<void> {
    await this.triggerEvent(supabaseUserId, 'quiet_block_created', mongoBlockId, {
      title: blockData.title,
      start_time: blockData.startTime.toISOString(),
      end_time: blockData.endTime.toISOString(),
      priority: blockData.priority,
      status: blockData.status
    })
  }

  /**
   * Trigger quiet block update event
   */
  static async triggerUpdated(
    supabaseUserId: string,
    mongoBlockId: string,
    blockData: {
      title?: string
      startTime?: Date
      endTime?: Date
      priority?: string
      status?: string
    }
  ): Promise<void> {
    const eventData: Record<string, any> = {}
    
    if (blockData.title) eventData.title = blockData.title
    if (blockData.startTime) eventData.start_time = blockData.startTime.toISOString()
    if (blockData.endTime) eventData.end_time = blockData.endTime.toISOString()
    if (blockData.priority) eventData.priority = blockData.priority
    if (blockData.status) eventData.status = blockData.status

    await this.triggerEvent(supabaseUserId, 'quiet_block_updated', mongoBlockId, eventData)
  }

  /**
   * Trigger quiet block deletion event
   */
  static async triggerDeleted(
    supabaseUserId: string,
    mongoBlockId: string,
    blockData: {
      title: string
    }
  ): Promise<void> {
    await this.triggerEvent(supabaseUserId, 'quiet_block_deleted', mongoBlockId, {
      title: blockData.title
    })
  }

  /**
   * Trigger quiet block completion event
   */
  static async triggerCompleted(
    supabaseUserId: string,
    mongoBlockId: string,
    blockData: {
      title: string
      actualStartTime?: Date
      actualEndTime?: Date
    }
  ): Promise<void> {
    const eventData: Record<string, any> = {
      title: blockData.title,
      status: 'completed'
    }

    if (blockData.actualStartTime) {
      eventData.actual_start_time = blockData.actualStartTime.toISOString()
    }
    if (blockData.actualEndTime) {
      eventData.actual_end_time = blockData.actualEndTime.toISOString()
    }

    await this.triggerEvent(supabaseUserId, 'quiet_block_completed', mongoBlockId, eventData)
  }

  /**
   * Trigger quiet block started event
   */
  static async triggerStarted(
    supabaseUserId: string,
    mongoBlockId: string,
    blockData: {
      title: string
      actualStartTime: Date
    }
  ): Promise<void> {
    await this.triggerEvent(supabaseUserId, 'quiet_block_started', mongoBlockId, {
      title: blockData.title,
      status: 'active',
      actual_start_time: blockData.actualStartTime.toISOString()
    })
  }

  /**
   * Get recent events for a user (for debugging/history)
   */
  static async getUserEvents(
    supabaseUserId: string,
    limit: number = 50
  ): Promise<SupabaseEventData[]> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('quiet_blocks_events')
        .select('*')
        .eq('user_id', supabaseUserId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('❌ Failed to fetch user events:', error)
        return []
      }

      return data.map(event => ({
        user_id: event.user_id,
        event_type: event.event_type,
        mongo_block_id: event.mongo_block_id,
        timestamp: event.created_at,
        event_data: event.event_data || {}
      }))
    } catch (error) {
      console.error('❌ Error fetching user events:', error)
      return []
    }
  }

  /**
   * Clean up old events (optional housekeeping)
   */
  static async cleanupOldEvents(olderThanDays: number = 30): Promise<void> {
    try {
      const supabase = await createClient()
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

      const { error } = await supabase
        .from('quiet_blocks_events')
        .delete()
        .lt('created_at', cutoffDate.toISOString())

      if (error) {
        console.error('❌ Failed to cleanup old events:', error)
        return
      }

      console.log(`✅ Cleaned up events older than ${olderThanDays} days`)
    } catch (error) {
      console.error('❌ Error cleaning up old events:', error)
    }
  }
}