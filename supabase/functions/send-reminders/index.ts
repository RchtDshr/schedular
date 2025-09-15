// Supabase Edge Function for sending reminder emails
// Optimized for 90-second cron intervals

// @ts-nocheck - This file is for Deno runtime, ignore Node.js type checking
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

// Types
interface QuietBlock {
  _id: string
  userId: any
  title: string
  startTime: string
  endTime: string
  reminderConfig: {
    enabled: boolean
    minutesBefore: number
    emailEnabled: boolean
  }
  reminderSent: boolean
}

interface User {
  _id: string
  email: string
  name?: string
  preferences?: {
    reminderMinutesBefore?: number
    notificationEmail?: string
  }
}

interface ReminderEmailData {
  userEmail: string
  userName?: string
  quietBlockTitle: string
  startTime: Date
  endTime: Date
  minutesUntilStart: number
  dashboardUrl?: string
}

// Email service for edge runtime
class EdgeEmailService {
  private fromEmail: string
  private resendApiKey: string

  constructor() {
    this.fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@quietscheduler.com'
    this.resendApiKey = Deno.env.get('RESEND_API_KEY') || ''
  }

  async sendQuietBlockReminder(data: ReminderEmailData): Promise<{ success: boolean; error?: string }> {
    try {
      const { userEmail, userName, quietBlockTitle, startTime, endTime, minutesUntilStart, dashboardUrl } = data

      const formattedStartTime = startTime.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
      
      const formattedEndTime = endTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })

      const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))

      const subject = `Reminder: "${quietBlockTitle}" starts in ${minutesUntilStart} minutes`
      
      const htmlContent = this.generateReminderEmailHTML({
        userName: userName || 'there',
        quietBlockTitle,
        startTime: formattedStartTime,
        endTime: formattedEndTime,
        duration,
        minutesUntilStart,
        dashboardUrl
      })

      const textContent = this.generateReminderEmailText({
        userName: userName || 'there',
        quietBlockTitle,
        startTime: formattedStartTime,
        endTime: formattedEndTime,
        duration,
        minutesUntilStart,
        dashboardUrl
      })

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: userEmail,
          subject,
          html: htmlContent,
          text: textContent,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('Failed to send reminder email:', error)
        return { success: false, error: `Resend API error: ${error}` }
      }

      const result = await response.json()
      console.log('Reminder email sent successfully:', { emailId: result.id, to: userEmail })
      return { success: true }

    } catch (error) {
      console.error('Error sending reminder email:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }
    }
  }

  private generateReminderEmailHTML(data: {
    userName: string
    quietBlockTitle: string
    startTime: string
    endTime: string
    duration: number
    minutesUntilStart: number
    dashboardUrl?: string
  }): string {
    const { userName, quietBlockTitle, startTime, endTime, duration, minutesUntilStart, dashboardUrl } = data

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Quiet Block Reminder</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4f46e5; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .alert-box { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        .quiet-block-details { background-color: white; padding: 20px; border-radius: 6px; margin: 20px 0; border: 1px solid #e5e7eb; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; }
        .label { font-weight: bold; color: #374151; }
        .value { color: #6b7280; }
        .cta-button { display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🔕 Quiet Block Reminder</h1>
      </div>
      
      <div class="content">
        <p>Hi ${userName},</p>
        
        <div class="alert-box">
          <strong>⏰ Your quiet block starts in ${minutesUntilStart} minutes!</strong>
        </div>
        
        <p>This is a friendly reminder that your scheduled quiet block is starting soon. Time to prepare for some focused, uninterrupted time.</p>
        
        <div class="quiet-block-details">
          <h3 style="margin-top: 0; color: #4f46e5;">📋 Quiet Block Details</h3>
          <div class="detail-row">
            <span class="label">Title:</span>
            <span class="value">${quietBlockTitle}</span>
          </div>
          <div class="detail-row">
            <span class="label">Start Time:</span>
            <span class="value">${startTime}</span>
          </div>
          <div class="detail-row">
            <span class="label">End Time:</span>
            <span class="value">${endTime}</span>
          </div>
          <div class="detail-row">
            <span class="label">Duration:</span>
            <span class="value">${duration} minutes</span>
          </div>
        </div>
        
        <p>💡 <strong>Pro tip:</strong> Use these few minutes to:</p>
        <ul>
          <li>Close unnecessary applications and browser tabs</li>
          <li>Put your phone in silent mode</li>
          <li>Gather any materials you'll need</li>
          <li>Set your workspace for maximum focus</li>
        </ul>
        
        ${dashboardUrl ? `
        <div style="text-align: center;">
          <a href="${dashboardUrl}" class="cta-button">View Dashboard</a>
        </div>
        ` : ''}
        
        <div class="footer">
          <p>This reminder was sent because you have email reminders enabled for your quiet blocks.</p>
          <p>Quiet Scheduler - Focus on what matters most</p>
        </div>
      </div>
    </body>
    </html>
    `
  }

  private generateReminderEmailText(data: {
    userName: string
    quietBlockTitle: string
    startTime: string
    endTime: string
    duration: number
    minutesUntilStart: number
    dashboardUrl?: string
  }): string {
    const { userName, quietBlockTitle, startTime, endTime, duration, minutesUntilStart, dashboardUrl } = data

    return `
Hi ${userName},

🔕 QUIET BLOCK REMINDER

Your quiet block starts in ${minutesUntilStart} minutes!

Quiet Block Details:
- Title: ${quietBlockTitle}
- Start Time: ${startTime}
- End Time: ${endTime}
- Duration: ${duration} minutes

Pro tip: Use these few minutes to:
• Close unnecessary applications and browser tabs
• Put your phone in silent mode
• Gather any materials you'll need
• Set your workspace for maximum focus

${dashboardUrl ? `View your dashboard: ${dashboardUrl}` : ''}

This reminder was sent because you have email reminders enabled for your quiet blocks.

Quiet Scheduler - Focus on what matters most
    `.trim()
  }
}

serve(async (req: any) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Starting Supabase edge function reminder check (90s interval)...')

    // Verify the request is from Supabase cron or authorized source
    const authHeader = req.headers.get('authorization')
    const cronSecret = Deno.env.get('CRON_SECRET') || 'default-secret-change-in-production'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.log('❌ Unauthorized request to reminder endpoint')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get MongoDB connection string
    const mongoUri = Deno.env.get('MONGODB_URI')
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required')
    }

    // Since we can't use Mongoose in edge functions, we'll use MongoDB native driver
    // or make HTTP requests to our Next.js API
    const nextjsApiUrl = Deno.env.get('NEXTJS_API_URL') || 'https://schedular-34hl.vercel.app'
    
    // Call our existing Next.js API endpoint
    const response = await fetch(`${nextjsApiUrl}/api/cron/send-reminders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Next.js API call failed: ${errorText}`)
    }

    const result = await response.json()
    
    console.log('📊 Supabase edge function completed:', result)

    return new Response(
      JSON.stringify({
        ...result,
        source: 'supabase-edge-function',
        interval: '90 seconds'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Error in Supabase edge function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error during reminder process',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        source: 'supabase-edge-function'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})