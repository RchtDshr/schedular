import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import QuietBlock from '@/models/QuietBlock'
import { IUser } from '@/models/User'
import { EmailService } from '@/lib/services/emailService'

// This API route handles sending reminder emails for upcoming quiet blocks
// Optimized for Supabase cron jobs running every 90 seconds

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting reminder check process (90s interval)...')

    // Verify the request is from an authorized source (Supabase cron or authorized client)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'default-secret-change-in-production'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.log('❌ Unauthorized request to reminder endpoint')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Connect to database
    await connectToDatabase()

    // Get the current time and calculate precise time windows
    // With 90s intervals, we need to be more precise about timing
    const now = new Date()
    const lookAheadTime = new Date(now.getTime() + (5 * 60 * 1000)) // Look ahead 5 minutes
    const timeTolerance = 2 * 60 * 1000 // 2 minutes tolerance for timing precision

    console.log(`🔍 Looking for quiet blocks between ${now.toISOString()} and ${lookAheadTime.toISOString()}`)

    // Find all scheduled quiet blocks that need reminders
    // With 90s intervals, we can be more precise about timing
    const upcomingQuietBlocks = await QuietBlock.find({
      status: 'scheduled',
      isDeleted: false,
      reminderSent: false,
      'reminderConfig.enabled': true,
      'reminderConfig.emailEnabled': true,
      startTime: {
        $gte: now,
        $lte: lookAheadTime
      }
    }).populate('userId')

    console.log(`📋 Found ${upcomingQuietBlocks.length} quiet blocks to check for reminders`)

    if (upcomingQuietBlocks.length === 0) {
      return NextResponse.json({ 
        message: 'No upcoming quiet blocks requiring reminders',
        processed: 0,
        timestamp: now.toISOString()
      })
    }

    const emailService = EmailService.getInstance()
    let successCount = 0
    let errorCount = 0
    const results = []

    // Process each quiet block
    for (const quietBlock of upcomingQuietBlocks) {
      try {
        // Check if userId is populated (should be a User document)
        const user = quietBlock.userId as any as IUser
        if (!user || !user.email) {
          console.error(`❌ User not found or populated for quiet block "${quietBlock.title}"`)
          errorCount++
          continue
        }
        
        // Calculate when the reminder should be sent
        const reminderMinutes = quietBlock.reminderConfig.minutesBefore || user.preferences?.reminderMinutesBefore || 15
        const reminderTime = new Date(quietBlock.startTime.getTime() - (reminderMinutes * 60 * 1000))
        
        // Check if it's time to send the reminder (with tolerance for 90s intervals)
        const shouldSendNow = now >= reminderTime && now <= new Date(reminderTime.getTime() + timeTolerance)
        
        console.log(`📅 Quiet block "${quietBlock.title}":`)
        console.log(`   Start: ${quietBlock.startTime.toISOString()}`)
        console.log(`   Reminder time: ${reminderTime.toISOString()}`)
        console.log(`   Should send now: ${shouldSendNow}`)
        console.log(`   Time tolerance window: ${new Date(reminderTime.getTime() + timeTolerance).toISOString()}`)

        if (!shouldSendNow) {
          console.log(`⏳ Not in reminder window for "${quietBlock.title}"`)
          continue
        }

        // Calculate minutes until start
        const minutesUntilStart = Math.round((quietBlock.startTime.getTime() - now.getTime()) / (1000 * 60))
        
        // Determine which email to use (user's notification email or primary email)
        const emailAddress = user.preferences?.notificationEmail || user.email

        // Send the reminder email
        const emailResult = await emailService.sendQuietBlockReminder({
          userEmail: emailAddress,
          userName: user.name,
          quietBlockTitle: quietBlock.title,
          startTime: quietBlock.startTime,
          endTime: quietBlock.endTime,
          minutesUntilStart,
          dashboardUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard`
        })

        if (emailResult.success) {
          // Mark reminder as sent
          await QuietBlock.findByIdAndUpdate(quietBlock._id, {
            reminderSent: true,
            reminderScheduledAt: now
          })

          console.log(`✅ Reminder sent successfully for "${quietBlock.title}" to ${emailAddress}`)
          successCount++
          
          results.push({
            quietBlockId: quietBlock._id,
            title: quietBlock.title,
            userEmail: emailAddress,
            status: 'sent',
            minutesUntilStart
          })
        } else {
          console.error(`❌ Failed to send reminder for "${quietBlock.title}":`, emailResult.error)
          errorCount++
          
          results.push({
            quietBlockId: quietBlock._id,
            title: quietBlock.title,
            userEmail: emailAddress,
            status: 'failed',
            error: emailResult.error,
            minutesUntilStart
          })
        }

      } catch (error) {
        console.error(`❌ Error processing quiet block "${quietBlock.title}":`, error)
        errorCount++
        
        results.push({
          quietBlockId: quietBlock._id,
          title: quietBlock.title,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log(`📊 Reminder process completed (90s interval): ${successCount} sent, ${errorCount} failed`)

    return NextResponse.json({
      message: 'Reminder check completed (90s interval)',
      timestamp: now.toISOString(),
      totalChecked: upcomingQuietBlocks.length,
      remindersSent: successCount,
      errors: errorCount,
      interval: '90 seconds',
      results
    })

  } catch (error) {
    console.error('❌ Error in reminder process:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error during reminder process',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Handle GET requests for manual testing
export async function GET(request: NextRequest) {
  // Only allow GET requests in development or with proper authorization
  const isDevelopment = process.env.NODE_ENV === 'development'
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || 'default-secret-change-in-production'
  
  if (!isDevelopment && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // For GET requests, just provide status information
  try {
    await connectToDatabase()
    
    const now = new Date()
    const lookAheadTime = new Date(now.getTime() + (5 * 60 * 1000)) // Look ahead 5 minutes
    
    const upcomingCount = await QuietBlock.countDocuments({
      status: 'scheduled',
      isDeleted: false,
      reminderSent: false,
      'reminderConfig.enabled': true,
      'reminderConfig.emailEnabled': true,
      startTime: {
        $gte: now,
        $lte: lookAheadTime
      }
    })

    const pendingReminders = await QuietBlock.find({
      status: 'scheduled',
      isDeleted: false,
      reminderSent: false,
      'reminderConfig.enabled': true,
      'reminderConfig.emailEnabled': true,
      startTime: { $gte: now }
    })
    .select('title startTime reminderConfig')
    .limit(10)

    return NextResponse.json({
      message: 'Reminder service status (90s intervals)',
      timestamp: now.toISOString(),
      upcomingInNext5Minutes: upcomingCount,
      interval: '90 seconds',
      nextFewReminders: pendingReminders.map((qb: any) => ({
        title: qb.title,
        startTime: qb.startTime,
        reminderMinutes: qb.reminderConfig.minutesBefore
      }))
    })
    
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to get reminder status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}