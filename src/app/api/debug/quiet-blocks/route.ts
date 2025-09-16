import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
// Import User first to ensure model is registered before QuietBlock
import User from '@/models/User'
import QuietBlock from '@/models/QuietBlock'

// Debug endpoint to check quiet block states
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const now = new Date()
    const next24Hours = new Date(now.getTime() + (24 * 60 * 60 * 1000))
    
    // Find all upcoming quiet blocks with details
    // NOTE: Avoiding .populate() due to serverless model registration issues
    const allUpcoming = await QuietBlock.find({
      status: 'scheduled',
      isDeleted: { $ne: true },
      startTime: { $gte: now, $lte: next24Hours }
    })
    .select('title startTime endTime reminderConfig reminderSent reminderScheduledAt userId')
    .sort({ startTime: 1 })
    .limit(20)

    const details = []
    
    for (const block of allUpcoming) {
      // Manually fetch user instead of using populate
      const user = await User.findById(block.userId)
      
      const reminderMinutes = block.reminderConfig?.minutesBefore || 15
      const reminderTime = new Date(block.startTime.getTime() - (reminderMinutes * 60 * 1000))
      const minutesUntilReminder = Math.round((reminderTime.getTime() - now.getTime()) / (1000 * 60))
      const minutesUntilStart = Math.round((block.startTime.getTime() - now.getTime()) / (1000 * 60))
      
      details.push({
        id: block._id,
        title: block.title,
        startTime: block.startTime,
        reminderTime,
        minutesUntilReminder,
        minutesUntilStart,
        reminderEnabled: block.reminderConfig?.enabled,
        emailEnabled: block.reminderConfig?.emailEnabled,
        reminderSent: block.reminderSent,
        reminderScheduledAt: block.reminderScheduledAt,
        userEmail: user?.email || 'unknown',
        shouldSendNow: now >= reminderTime && !block.reminderSent && block.reminderConfig?.enabled && block.reminderConfig?.emailEnabled
      })
    }

    return NextResponse.json({
      message: 'Debug quiet blocks',
      timestamp: now.toISOString(),
      totalFound: allUpcoming.length,
      details
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to debug quiet blocks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Reset reminder flags for testing
export async function POST(request: NextRequest) {
  try {
    const { blockId } = await request.json()
    
    if (!blockId) {
      return NextResponse.json({ error: 'blockId required' }, { status: 400 })
    }

    await connectToDatabase()
    
    const updated = await QuietBlock.findByIdAndUpdate(blockId, {
      reminderSent: false,
      reminderScheduledAt: null
    }, { new: true })

    if (!updated) {
      return NextResponse.json({ error: 'Quiet block not found' }, { status: 404 })
    }

    return NextResponse.json({
      message: 'Reminder flag reset',
      blockId,
      title: updated.title
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to reset reminder flag',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}