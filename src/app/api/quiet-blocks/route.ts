import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { QuietBlockService } from '@/lib/services/quietBlockService'
import { UserService } from '@/lib/services/userService'
import { SupabaseEventService } from '@/lib/services/supabaseEventService'
import { 
  validateCreateQuietBlock, 
  validateQuietBlockQuery,
  type CreateQuietBlockInput,
  type QuietBlockQuery 
} from '@/lib/validations/quietBlockValidations'
import { checkQuietBlockOverlap, validateTimeSlot } from '@/lib/utils/timeValidation'

// POST /api/quiet-blocks - Create new quiet block
export async function POST(request: NextRequest) {
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
    console.log('Received request body:', JSON.stringify(body, null, 2))
    
    const validation = validateCreateQuietBlock(body)

    if (!validation.success) {
      console.error('Validation failed:', JSON.stringify(validation.error.issues, null, 2))
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const quietBlockData: CreateQuietBlockInput = validation.data

    // The validation transform already provides Date objects
    const startDateTime = quietBlockData.startTime as Date
    const endDateTime = quietBlockData.endTime as Date

    console.log('🕐 POST - Date conversion debug:')
    console.log('startDateTime:', startDateTime.toISOString())
    console.log('endDateTime:', endDateTime.toISOString())
    console.log('startDateTime valid:', !isNaN(startDateTime.getTime()))
    console.log('endDateTime valid:', !isNaN(endDateTime.getTime()))

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid date/time format provided' },
        { status: 400 }
      )
    }

    // Additional time validation
    const timeValidation = validateTimeSlot(startDateTime, endDateTime)
    if (!timeValidation.isValid) {
      return NextResponse.json(
        { success: false, error: timeValidation.message },
        { status: 400 }
      )
    }

    // Check for overlaps with existing quiet blocks
    const existingBlocks = await QuietBlockService.getUserQuietBlocks(supabaseUser.id, {
      startDate: new Date(startDateTime.getTime() - 24 * 60 * 60 * 1000), // 1 day before
      endDate: new Date(endDateTime.getTime() + 24 * 60 * 60 * 1000) // 1 day after
    })

    const overlapCheck = checkQuietBlockOverlap(
      { startTime: startDateTime, endTime: endDateTime },
      existingBlocks
    )

    if (overlapCheck.hasOverlap) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Time conflict detected',
          message: overlapCheck.message,
          conflictingBlocks: overlapCheck.conflictingBlocks.map(block => ({
            id: (block._id as any).toString(),
            title: block.title,
            startTime: block.startTime,
            endTime: block.endTime
          }))
        },
        { status: 409 }
      )
    }

    // Create the quiet block in MongoDB
    const quietBlock = await QuietBlockService.createQuietBlock(supabaseUser.id, quietBlockData)

    // Trigger Supabase event for real-time updates
    await SupabaseEventService.triggerCreated(
      supabaseUser.id,
      (quietBlock._id as any).toString(),
      {
        title: quietBlock.title,
        startTime: quietBlock.startTime,
        endTime: quietBlock.endTime,
        priority: quietBlock.priority,
        status: quietBlock.status
      }
    )

    // Return success response
    return NextResponse.json({
      success: true,
      data: {
        id: (quietBlock._id as any).toString(),
        title: quietBlock.title,
        description: quietBlock.description,
        startTime: quietBlock.startTime,
        endTime: quietBlock.endTime,
        priority: quietBlock.priority,
        status: quietBlock.status,
        reminderConfig: quietBlock.reminderConfig,
        tags: quietBlock.tags,
        isPrivate: quietBlock.isPrivate,
        location: quietBlock.location,
        notes: quietBlock.notes,
        createdAt: quietBlock.createdAt,
        updatedAt: quietBlock.updatedAt
      }
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Error creating quiet block:', error)
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

// GET /api/quiet-blocks - Get user's quiet blocks
export async function GET(request: NextRequest) {
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

    console.log('🔍 Authenticated user ID:', supabaseUser.id)

    // Ensure user exists in MongoDB
    const { user: mongoUser } = await UserService.ensureUserExists(supabaseUser)
    console.log('🔍 MongoDB user synced:', mongoUser.supabaseId)

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const queryData: Record<string, any> = {}

    // Extract query parameters
    if (searchParams.get('startDate')) queryData.startDate = searchParams.get('startDate')
    if (searchParams.get('endDate')) queryData.endDate = searchParams.get('endDate')
    if (searchParams.get('status')) queryData.status = searchParams.get('status')
    if (searchParams.get('priority')) queryData.priority = searchParams.get('priority')
    if (searchParams.get('tags')) queryData.tags = searchParams.get('tags')
    if (searchParams.get('limit')) queryData.limit = parseInt(searchParams.get('limit')!)
    if (searchParams.get('offset')) queryData.offset = parseInt(searchParams.get('offset')!)
    if (searchParams.get('sortBy')) queryData.sortBy = searchParams.get('sortBy')
    if (searchParams.get('sortOrder')) queryData.sortOrder = searchParams.get('sortOrder')

    // Validate query parameters
    const validation = validateQuietBlockQuery(queryData)
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid query parameters',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const query: QuietBlockQuery = validation.data

    // Convert string dates to Date objects for the service
    const serviceQuery = {
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined
    }

    // Get quiet blocks from MongoDB
    console.log('🔍 Fetching quiet blocks for user:', supabaseUser.id)
    console.log('🔍 Service query options:', JSON.stringify(serviceQuery, null, 2))
    
    const quietBlocks = await QuietBlockService.getUserQuietBlocks(supabaseUser.id, serviceQuery)
    console.log('📋 Found quiet blocks:', quietBlocks.length)
    console.log('📋 Raw blocks data:', JSON.stringify(quietBlocks.slice(0, 2), null, 2)) // Log first 2 blocks

    // Get total count for pagination
    const totalCount = await QuietBlockService.getUserQuietBlocksCount(supabaseUser.id, serviceQuery)
    console.log('📊 Total count:', totalCount)

    // Format response
    const formattedBlocks = quietBlocks.map(block => {
      // Extract date and time in local timezone format
      const startDate = new Date(block.startTime)
      const endDate = new Date(block.endTime)
      
      return {
        _id: (block._id as any).toString(),
        id: (block._id as any).toString(),
        title: block.title,
        description: block.description,
        date: startDate.getFullYear() + '-' + 
              String(startDate.getMonth() + 1).padStart(2, '0') + '-' + 
              String(startDate.getDate()).padStart(2, '0'),
        startTime: String(startDate.getHours()).padStart(2, '0') + ':' + String(startDate.getMinutes()).padStart(2, '0'),
        endTime: String(endDate.getHours()).padStart(2, '0') + ':' + String(endDate.getMinutes()).padStart(2, '0'),
        priority: block.priority,
        status: block.status,
        reminderConfig: block.reminderConfig,
        reminderEnabled: block.reminderConfig?.enabled || false,
        reminderMinutesBefore: block.reminderConfig?.minutesBefore || 15,
        reminderEmailEnabled: block.reminderConfig?.emailEnabled || false,
        reminderPushEnabled: block.reminderConfig?.pushEnabled || false,
        tags: block.tags || [],
        isPrivate: block.isPrivate,
        location: block.location,
        notes: block.notes,
        actualStartTime: block.actualStartTime,
        actualEndTime: block.actualEndTime,
        createdAt: block.createdAt,
        updatedAt: block.updatedAt
      }
    })

    return NextResponse.json({
      success: true,
      data: formattedBlocks,
      pagination: {
        total: totalCount,
        limit: query.limit || 50,
        offset: query.offset || 0,
        hasMore: totalCount > (query.offset || 0) + formattedBlocks.length
      }
    })

  } catch (error) {
    console.error('❌ Error fetching quiet blocks:', error)
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