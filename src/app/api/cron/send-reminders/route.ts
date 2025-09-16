import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
// Import User first and ensure it's registered
import User, { IUser } from '@/models/User'
import QuietBlock from '@/models/QuietBlock'
import { Resend } from 'resend'

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY)

// Ensure User model is registered by accessing it
const ensureUserModel = () => {
  try {
    return User
  } catch (error) {
    console.log('User model registration check:', error)
    return User
  }
}

// This API route handles sending reminder emails for upcoming quiet blocks
// Runs every 5 minutes and checks for reminders due in the next 5 minutes

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting 5-minute reminder check process...')

    // Verify the request is from an authorized source (Supabase cron or authorized client)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'default-secret-change-in-production'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.log('❌ Unauthorized request to reminder endpoint')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Connect to database
    await connectToDatabase()
    
    // Ensure User model is registered before using it
    ensureUserModel()
    console.log('✅ User model ensured')

    // Get the current UTC time and 5-minute lookahead window
    const now = new Date()
    const fiveMinutesFromNow = new Date(now.getTime() + (5 * 60 * 1000))

    console.log(`🔍 Checking for reminders due between ${now.toISOString()} and ${fiveMinutesFromNow.toISOString()}`)

    // Find all scheduled quiet blocks that have reminders due in the next 5 minutes
    // Logic: Find blocks where (startTime - reminderMinutes) falls within the next 5 minutes
    const upcomingQuietBlocks = await QuietBlock.find({
      status: 'scheduled',
      reminderSent: false,
      'reminderConfig.enabled': true,
      'reminderConfig.emailEnabled': true,
      startTime: { $gt: now } // Only future blocks
    })

    console.log(`📋 Found ${upcomingQuietBlocks.length} scheduled blocks to check`)

    // Filter blocks based on reminder timing
    const blocksNeedingReminders = []
    const blockDetails = []

    for (const block of upcomingQuietBlocks) {
      // Calculate when reminder should be sent
      const reminderMinutes = block.reminderConfig?.minutesBefore || 15
      const reminderTime = new Date(block.startTime.getTime() - (reminderMinutes * 60 * 1000))
      
      // Check if reminder time is within our 5-minute window
      const shouldSendNow = reminderTime >= now && reminderTime <= fiveMinutesFromNow
      
      const minutesUntilStart = Math.round((block.startTime.getTime() - now.getTime()) / (1000 * 60))
      
      blockDetails.push({
        title: block.title,
        startTime: block.startTime.toISOString(),
        reminderTime: reminderTime.toISOString(),
        minutesUntilStart,
        shouldSendNow
      })

      if (shouldSendNow) {
        blocksNeedingReminders.push(block)
      }
    }

    console.log(`📧 ${blocksNeedingReminders.length} blocks need reminders sent now`)

    if (blocksNeedingReminders.length === 0) {
      return NextResponse.json({ 
        message: 'No reminders due in the next 5 minutes',
        timestamp: now.toISOString(),
        totalChecked: upcomingQuietBlocks.length,
        remindersDue: 0,
        blockDetails,
        interval: '5 minutes'
      })
    }

    // Process reminders for eligible blocks
    let successCount = 0
    let errorCount = 0
    const results = []

    // Process each block that needs a reminder
    for (const quietBlock of blocksNeedingReminders) {
      try {
        // Manually fetch user instead of using populate
        const user = await User.findById(quietBlock.userId) as IUser
        if (!user || !user.email) {
          console.error(`❌ User not found for quiet block "${quietBlock.title}"`)
          errorCount++
          results.push({
            quietBlockId: quietBlock._id,
            title: quietBlock.title,
            status: 'error',
            error: 'User not found or no email'
          })
          continue
        }
        
        // Calculate minutes until start
        const minutesUntilStart = Math.round((quietBlock.startTime.getTime() - now.getTime()) / (1000 * 60))
        
        // Determine which email to use (user's notification email or primary email)
        const emailAddress = user.preferences?.notificationEmail || user.email

        console.log(`� Sending reminder for "${quietBlock.title}" to ${emailAddress}`)
        console.log(`   Start time: ${quietBlock.startTime.toISOString()}`)
        console.log(`   Minutes until start: ${minutesUntilStart}`)

        // Send the reminder email using Resend
        const emailResult = await resend.emails.send({
          from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
          to: [emailAddress],
          subject: `Reminder: ${quietBlock.title} starts in ${minutesUntilStart} minutes`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Quiet Block Reminder</h2>
              <p>Hello,</p>
              <p>This is a reminder that your quiet block "<strong>${quietBlock.title}</strong>" is starting soon.</p>
              
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #666;">Block Details:</h3>
                <p><strong>Title:</strong> ${quietBlock.title}</p>
                <p><strong>Start Time:</strong> ${quietBlock.startTime.toLocaleString()}</p>
                <p><strong>End Time:</strong> ${quietBlock.endTime.toLocaleString()}</p>
                <p><strong>Time until start:</strong> ${minutesUntilStart} minutes</p>
                ${quietBlock.description ? `<p><strong>Description:</strong> ${quietBlock.description}</p>` : ''}
                ${quietBlock.location ? `<p><strong>Location:</strong> ${quietBlock.location}</p>` : ''}
              </div>
              
              <p>Prepare to enter your focused quiet time!</p>
              
              <p style="margin-top: 30px;">
                <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://schedular-34hl.vercel.app'}/dashboard" 
                   style="background-color: #007cba; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                  View Dashboard
                </a>
              </p>
              
              <p style="color: #666; font-size: 12px; margin-top: 30px;">
                This reminder was sent because you have email reminders enabled for this quiet block.
              </p>
            </div>
          `
        })

        if (emailResult.data) {
          // Mark reminder as sent
          await QuietBlock.findByIdAndUpdate(quietBlock._id, {
            reminderSent: true,
            reminderScheduledAt: now
          })

          console.log(`✅ Reminder sent successfully for "${quietBlock.title}" to ${emailAddress}`)
          console.log(`   Email ID: ${emailResult.data.id}`)
          successCount++
          
          results.push({
            quietBlockId: quietBlock._id,
            title: quietBlock.title,
            userEmail: emailAddress,
            status: 'sent',
            minutesUntilStart,
            emailId: emailResult.data.id,
            startTime: quietBlock.startTime.toISOString()
          })
        } else {
          console.error(`❌ Failed to send reminder for "${quietBlock.title}":`, emailResult.error)
          errorCount++
          
          results.push({
            quietBlockId: quietBlock._id,
            title: quietBlock.title,
            userEmail: emailAddress,
            status: 'failed',
            error: emailResult.error?.message || 'Unknown email error',
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
      interval: '5 minutes',
      totalChecked: upcomingQuietBlocks.length,
      remindersDue: blocksNeedingReminders.length,
      remindersSent: successCount,
      errors: errorCount,
      blockDetails,
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
    const fiveMinutesFromNow = new Date(now.getTime() + (5 * 60 * 1000))
    
    // Find blocks that would trigger reminders in the next 5 minutes
    const upcomingBlocks = await QuietBlock.find({
      status: 'scheduled',
      reminderSent: false,
      'reminderConfig.enabled': true,
      'reminderConfig.emailEnabled': true,
      startTime: { $gt: now }
    })
    .select('title startTime reminderConfig')
    .limit(20)

    const blockDetails = []
    let remindersDueCount = 0

    for (const block of upcomingBlocks) {
      const reminderMinutes = block.reminderConfig?.minutesBefore || 15
      const reminderTime = new Date(block.startTime.getTime() - (reminderMinutes * 60 * 1000))
      const shouldSendNow = reminderTime >= now && reminderTime <= fiveMinutesFromNow
      const minutesUntilStart = Math.round((block.startTime.getTime() - now.getTime()) / (1000 * 60))
      
      if (shouldSendNow) remindersDueCount++
      
      blockDetails.push({
        title: block.title,
        startTime: block.startTime.toISOString(),
        reminderTime: reminderTime.toISOString(),
        minutesUntilStart,
        shouldSendNow
      })
    }

    return NextResponse.json({
      message: 'Reminder service status (5-minute intervals)',
      timestamp: now.toISOString(),
      interval: '5 minutes',
      remindersDueInNext5Minutes: remindersDueCount,
      totalScheduledBlocks: upcomingBlocks.length,
      blockDetails
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