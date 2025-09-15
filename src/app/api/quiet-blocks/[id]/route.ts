import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { QuietBlockService } from '@/lib/services/quietBlockService'
import { SupabaseEventService } from '@/lib/services/supabaseEventService'
import { 
  validateUpdateQuietBlock, 
  validateCompleteQuietBlock,
  type UpdateQuietBlockInput,
  type CompleteQuietBlockInput 
} from '@/lib/validations/quietBlockValidations'
import { checkQuietBlockOverlap, validateTimeSlot } from '@/lib/utils/timeValidation'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// GET /api/quiet-blocks/[id] - Get single quiet block
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !supabaseUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the quiet block
    const quietBlock = await QuietBlockService.getQuietBlockById(id, supabaseUser.id)

    if (!quietBlock) {
      return NextResponse.json(
        { success: false, error: 'Quiet block not found' },
        { status: 404 }
      )
    }

    // Format response
    const startDate = new Date(quietBlock.startTime)
    const endDate = new Date(quietBlock.endTime)
    
    return NextResponse.json({
      success: true,
      data: {
        _id: (quietBlock._id as any).toString(),
        id: (quietBlock._id as any).toString(),
        title: quietBlock.title,
        description: quietBlock.description,
        date: startDate.getFullYear() + '-' + 
              String(startDate.getMonth() + 1).padStart(2, '0') + '-' + 
              String(startDate.getDate()).padStart(2, '0'),
        startTime: String(startDate.getHours()).padStart(2, '0') + ':' + String(startDate.getMinutes()).padStart(2, '0'),
        endTime: String(endDate.getHours()).padStart(2, '0') + ':' + String(endDate.getMinutes()).padStart(2, '0'),
        priority: quietBlock.priority,
        status: quietBlock.status,
        reminderConfig: quietBlock.reminderConfig,
        reminderEnabled: quietBlock.reminderConfig?.enabled || false,
        reminderMinutesBefore: quietBlock.reminderConfig?.minutesBefore || 15,
        reminderEmailEnabled: quietBlock.reminderConfig?.emailEnabled || false,
        reminderPushEnabled: quietBlock.reminderConfig?.pushEnabled || false,
        tags: quietBlock.tags || [],
        isPrivate: quietBlock.isPrivate,
        location: quietBlock.location,
        notes: quietBlock.notes,
        actualStartTime: quietBlock.actualStartTime,
        actualEndTime: quietBlock.actualEndTime,
        reminderSent: quietBlock.reminderSent,
        reminderScheduledAt: quietBlock.reminderScheduledAt,
        createdAt: quietBlock.createdAt,
        updatedAt: quietBlock.updatedAt
      }
    })

  } catch (error) {
    console.error('❌ Error fetching quiet block:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PUT /api/quiet-blocks/[id] - Update quiet block
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !supabaseUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = validateUpdateQuietBlock(body)

    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const updateData: UpdateQuietBlockInput = validation.data

    // Additional time validation if times are being updated
    if (updateData.startTime && updateData.endTime) {
      // Convert string dates to Date objects for validation
      // The frontend sends separate date + time fields, so we need to combine them
      let startTime: Date;
      let endTime: Date;
      
      if (updateData.date) {
        // If we have separate date and time fields
        startTime = new Date(`${updateData.date}T${updateData.startTime}`);
        endTime = new Date(`${updateData.date}T${updateData.endTime}`);
      } else {
        // Fallback: try to parse as ISO strings (in case they're full datetime strings)
        startTime = new Date(updateData.startTime);
        endTime = new Date(updateData.endTime);
      }
      
      console.log('🕐 Date conversion debug:')
      console.log('updateData.date:', updateData.date)
      console.log('updateData.startTime:', updateData.startTime)
      console.log('updateData.endTime:', updateData.endTime)
      console.log('Converted startTime:', startTime.toISOString())
      console.log('Converted endTime:', endTime.toISOString())
      console.log('startTime valid:', !isNaN(startTime.getTime()))
      console.log('endTime valid:', !isNaN(endTime.getTime()))
      
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid date/time format provided' },
          { status: 400 }
        )
      }
      
      const timeValidation = validateTimeSlot(startTime, endTime)
      if (!timeValidation.isValid) {
        return NextResponse.json(
          { success: false, error: timeValidation.message },
          { status: 400 }
        )
      }

      // Check for overlaps with other quiet blocks if times are being changed
      console.log('🔍 Checking overlaps with dates:', {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      })
      
      const existingBlocks = await QuietBlockService.getUserQuietBlocks(supabaseUser.id, {
        startDate: new Date(startTime.getTime() - 24 * 60 * 60 * 1000), // 1 day before
        endDate: new Date(endTime.getTime() + 24 * 60 * 60 * 1000) // 1 day after
      })

      const overlapCheck = checkQuietBlockOverlap(
        { startTime: startTime, endTime: endTime },
        existingBlocks,
        id // Exclude the current block from overlap check
      )

      if (overlapCheck.hasOverlap) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Time conflict detected',
            message: overlapCheck.message,
            conflictingBlocks: overlapCheck.conflictingBlocks.map(block => ({
              id: block._id,
              title: block.title,
              startTime: block.startTime,
              endTime: block.endTime
            }))
          },
          { status: 409 }
        )
      }
    }

    // Update the quiet block
    const updatedQuietBlock = await QuietBlockService.updateQuietBlock(
      id,
      supabaseUser.id,
      updateData
    )

    if (!updatedQuietBlock) {
      return NextResponse.json(
        { success: false, error: 'Quiet block not found' },
        { status: 404 }
      )
    }

    // Trigger Supabase event for real-time updates
    await SupabaseEventService.triggerUpdated(
      supabaseUser.id,
      (updatedQuietBlock._id as any).toString(),
      {
        title: updatedQuietBlock.title,
        startTime: updatedQuietBlock.startTime,
        endTime: updatedQuietBlock.endTime,
        priority: updatedQuietBlock.priority,
        status: updatedQuietBlock.status
      }
    )

    // Format and return response
    return NextResponse.json({
      success: true,
      data: {
        id: (updatedQuietBlock._id as any).toString(),
        title: updatedQuietBlock.title,
        description: updatedQuietBlock.description,
        startTime: updatedQuietBlock.startTime,
        endTime: updatedQuietBlock.endTime,
        priority: updatedQuietBlock.priority,
        status: updatedQuietBlock.status,
        reminderConfig: updatedQuietBlock.reminderConfig,
        tags: updatedQuietBlock.tags,
        isPrivate: updatedQuietBlock.isPrivate,
        location: updatedQuietBlock.location,
        notes: updatedQuietBlock.notes,
        actualStartTime: updatedQuietBlock.actualStartTime,
        actualEndTime: updatedQuietBlock.actualEndTime,
        createdAt: updatedQuietBlock.createdAt,
        updatedAt: updatedQuietBlock.updatedAt
      }
    })

  } catch (error) {
    console.error('❌ Error updating quiet block:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// DELETE /api/quiet-blocks/[id] - Delete (soft delete) quiet block
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !supabaseUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the quiet block first (to get title for event)
    const quietBlock = await QuietBlockService.getQuietBlockById(id, supabaseUser.id)

    if (!quietBlock) {
      return NextResponse.json(
        { success: false, error: 'Quiet block not found' },
        { status: 404 }
      )
    }

    // Delete the quiet block (soft delete)
    const deletedQuietBlock = await QuietBlockService.deleteQuietBlock(id, supabaseUser.id)

    if (!deletedQuietBlock) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete quiet block' },
        { status: 500 }
      )
    }

    // Trigger Supabase event for real-time updates
    await SupabaseEventService.triggerDeleted(
      supabaseUser.id,
      id,
      {
        title: quietBlock.title
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Quiet block deleted successfully',
      data: {
        id: id,
        title: quietBlock.title,
        deletedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Error deleting quiet block:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PATCH /api/quiet-blocks/[id]/complete - Mark quiet block as completed
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    // Check if this is the complete endpoint
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action !== 'complete') {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      )
    }

    // Authenticate user
    const supabase = await createClient()
    const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !supabaseUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = validateCompleteQuietBlock(body)

    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const completeData: CompleteQuietBlockInput = validation.data

    // Convert string dates to Date objects if provided
    const processedCompleteData = {
      actualStartTime: completeData.actualStartTime ? new Date(completeData.actualStartTime) : undefined,
      actualEndTime: completeData.actualEndTime ? new Date(completeData.actualEndTime) : undefined,
      notes: completeData.notes
    }

    // Complete the quiet block
    const completedQuietBlock = await QuietBlockService.completeQuietBlock(
      id,
      supabaseUser.id,
      processedCompleteData
    )

    if (!completedQuietBlock) {
      return NextResponse.json(
        { success: false, error: 'Quiet block not found' },
        { status: 404 }
      )
    }

    // Trigger Supabase event for real-time updates
    await SupabaseEventService.triggerCompleted(
      supabaseUser.id,
      id,
      {
        title: completedQuietBlock.title,
        actualStartTime: completedQuietBlock.actualStartTime,
        actualEndTime: completedQuietBlock.actualEndTime
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Quiet block marked as completed',
      data: {
        id: (completedQuietBlock._id as any).toString(),
        title: completedQuietBlock.title,
        status: completedQuietBlock.status,
        actualStartTime: completedQuietBlock.actualStartTime,
        actualEndTime: completedQuietBlock.actualEndTime,
        completedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Error completing quiet block:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}