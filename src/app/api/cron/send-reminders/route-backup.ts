import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
// Import User first to ensure model is registered before QuietBlock
import User, { IUser } from '@/models/User'
import QuietBlock from '@/models/QuietBlock'
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
    const now = new Date()
    const lookAheadTime = new Date(now.getTime() + (60 * 60 * 1000)) // Look ahead 1 hour
    const timeTolerance = 10 * 60 * 1000 // 10 minutes tolerance for timing precision

    console.log(`🔍 Looking for quiet blocks between ${now.toISOString()} and ${lookAheadTime.toISOString()}`)

    // Find all scheduled quiet blocks that might need reminders
    const upcomingQuietBlocks = await QuietBlock.find({
      status: 'scheduled',
      reminderSent: false,
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
        const reminderMinutes = quietBlock.reminderConfig?.minutesBefore || user.preferences?.reminderMinutesBefore || 15
        const reminderTime = new Date(quietBlock.startTime.getTime() - (reminderMinutes * 60 * 1000))
        
        // FIXED: More lenient timing check - if current time is past reminder time, send it
        const timeSinceReminder = now.getTime() - reminderTime.getTime()
        const shouldSendNow = timeSinceReminder >= 0 && timeSinceReminder <= timeTolerance
        
        console.log(`📅 Quiet block "${quietBlock.title}":`)
        console.log(`   Start: ${quietBlock.startTime.toISOString()}`)
        console.log(`   Reminder time: ${reminderTime.toISOString()}`)
        console.log(`   Current time: ${now.toISOString()}`)
        console.log(`   Time since reminder: ${Math.round(timeSinceReminder / (1000 * 60))} minutes`)
        console.log(`   Should send now: ${shouldSendNow}`)
        console.log(`   Reminder enabled: ${quietBlock.reminderConfig?.enabled}`)
        console.log(`   Email enabled: ${quietBlock.reminderConfig?.emailEnabled}`)

        // Check if reminders are enabled
        if (!quietBlock.reminderConfig?.enabled || !quietBlock.reminderConfig?.emailEnabled) {
          console.log(`⏭️ Reminders disabled for "${quietBlock.title}"`)
          continue
        }

        if (!shouldSendNow) {
          console.log(`⏳ Not in reminder window for "${quietBlock.title}"`)
          continue
        }

        // Calculate minutes until start
        const minutesUntilStart = Math.round((quietBlock.startTime.getTime() - now.getTime()) / (1000 * 60))
        
        // Determine which email to use (user's notification email or primary email)
        const emailAddress = user.preferences?.notificationEmail || user.email

        console.log(`📧 Sending reminder for "${quietBlock.title}" to ${emailAddress}`)

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

    console.log(`📊 Reminder process completed: ${successCount} sent, ${errorCount} failed`)

    return NextResponse.json({
      message: 'Reminder check completed',
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
      reminderSent: false,
      startTime: {
        $gte: now,
        $lte: lookAheadTime
      }
    })

    const pendingReminders = await QuietBlock.find({
      status: 'scheduled',
      reminderSent: false,
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
        reminderMinutes: qb.reminderConfig?.minutesBefore || 15
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