// Edge-optimized email service for cross-platform compatibility
// Works in both Node.js (Next.js) and Deno (Supabase Edge Functions)

// Deno types for cross-platform compatibility
declare global {
  var Deno: {
    env: {
      get(key: string): string | undefined
    }
  } | undefined
}

// Interface for email sending result
interface EmailResult {
  success: boolean
  error?: string
}

export class EdgeOptimizedEmailService {
  private static instance: EdgeOptimizedEmailService | null = null
  private resendApiKey: string
  private fromEmail: string

  constructor() {
    // Cross-platform environment variable access
    const isNode = typeof process !== 'undefined' && process.env
    const isDeno = typeof globalThis.Deno !== 'undefined' && globalThis.Deno.env
    
    this.resendApiKey = isNode ? (process.env.RESEND_API_KEY || '') : 
                       isDeno ? (globalThis.Deno!.env.get('RESEND_API_KEY') || '') : ''
    this.fromEmail = isNode ? (process.env.FROM_EMAIL || 'noreply@quiteapp.com') :
                     isDeno ? (globalThis.Deno!.env.get('FROM_EMAIL') || 'noreply@quiteapp.com') : 'noreply@quiteapp.com'
  }

  static getInstance(): EdgeOptimizedEmailService {
    if (!EdgeOptimizedEmailService.instance) {
      EdgeOptimizedEmailService.instance = new EdgeOptimizedEmailService()
    }
    return EdgeOptimizedEmailService.instance
  }

  async sendQuietBlockReminder(
    userEmail: string,
    userName: string,
    quietBlockTitle: string,
    startTime: Date,
    endTime: Date,
    minutesUntilStart: number
  ): Promise<EmailResult> {
    try {
      if (!this.resendApiKey) {
        console.error('RESEND_API_KEY is not configured')
        return { success: false, error: 'Email service not configured' }
      }

      const formattedStartTime = this.formatDateTime(startTime)
      const formattedEndTime = this.formatTime(endTime)
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))

      const subject = `🔔 Reminder: "${quietBlockTitle}" starts in ${minutesUntilStart} minute${minutesUntilStart !== 1 ? 's' : ''}`

      const htmlContent = this.generateReminderEmailHTML({
        userName,
        quietBlockTitle,
        startTime: formattedStartTime,
        endTime: formattedEndTime,
        duration,
        minutesUntilStart,
        dashboardUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app'
      })

      const textContent = this.generateReminderEmailText({
        userName,
        quietBlockTitle,
        startTime: formattedStartTime,
        endTime: formattedEndTime,
        duration,
        minutesUntilStart
      })

      console.log(`Sending reminder email to ${userEmail} for "${quietBlockTitle}" starting at ${formattedStartTime}`)

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
        const errorText = await response.text()
        console.error('Failed to send reminder email:', errorText)
        return { success: false, error: `Resend API error: ${response.status} ${errorText}` }
      }

      const result = await response.json() as { id: string }
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

  /**
   * Format date and time for display
   */
  private formatDateTime(date: Date): string {
    try {
      return date.toLocaleString('en-US', {
        weekday: 'short' as const,
        year: 'numeric' as const,
        month: 'short' as const, 
        day: 'numeric' as const,
        hour: 'numeric' as const,
        minute: '2-digit' as const,
        hour12: true
      })
    } catch {
      // Fallback for environments that don't support toLocaleString
      return date.toISOString().replace('T', ' at ').replace(/\.\d{3}Z$/, ' UTC')
    }
  }

  /**
   * Format time only for display
   */
  private formatTime(date: Date): string {
    try {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric' as const,
        minute: '2-digit' as const,
        hour12: true
      })
    } catch {
      // Fallback for environments that don't support toLocaleTimeString
      const hours = date.getHours()
      const minutes = date.getMinutes()
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const hour12 = hours % 12 || 12
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`
    }
  }

  /**
   * Generate HTML content for reminder email
   */
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
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc; }
        .container { background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 32px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
        .content { padding: 32px 24px; }
        .alert-box { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid #f59e0b; padding: 20px; margin: 24px 0; border-radius: 8px; }
        .alert-box strong { color: #92400e; font-size: 18px; }
        .quiet-block-details { background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 24px 0; border: 1px solid #e2e8f0; }
        .detail-row { display: flex; justify-content: space-between; margin: 12px 0; align-items: center; }
        .label { font-weight: 600; color: #1e293b; }
        .value { color: #475569; background-color: white; padding: 4px 8px; border-radius: 4px; }
        .tips { background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #3b82f6; }
        .tips h4 { margin-top: 0; color: #1e40af; }
        .tips ul { margin: 8px 0; }
        .tips li { margin: 4px 0; color: #1e40af; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; transition: transform 0.2s; }
        .cta-button:hover { transform: translateY(-2px); }
        .footer { color: #64748b; font-size: 14px; text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; }
        @media (max-width: 600px) {
          .detail-row { flex-direction: column; align-items: flex-start; }
          .value { margin-top: 4px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Quiet Block Reminder</h1>
        </div>
        
        <div class="content">
          <p style="font-size: 18px; margin-bottom: 24px;">Hello,</p>
          
          <div class="alert-box">
            <strong>Your quiet block "${quietBlockTitle}" starts in ${minutesUntilStart} minute${minutesUntilStart !== 1 ? 's' : ''}!</strong>
          </div>
          
          <div class="quiet-block-details">
            <h3 style="margin-top: 0; color: #1e293b;">📅 Session Details</h3>
            <div class="detail-row">
              <span class="label">🏷️ Title:</span>
              <span class="value">${quietBlockTitle}</span>
            </div>
            <div class="detail-row">
              <span class="label">🕐 Start Time:</span>
              <span class="value">${startTime}</span>
            </div>
            <div class="detail-row">
              <span class="label">🕐 End Time:</span>
              <span class="value">${endTime}</span>
            </div>
            <div class="detail-row">
              <span class="label">⏱️ Duration:</span>
              <span class="value">${duration} minutes</span>
            </div>
          </div>
          
          <div class="tips">
            <h4>💡 Getting Ready for Your Quiet Block</h4>
            <ul>
              <li>Find a comfortable, distraction-free environment</li>
              <li>Turn off notifications on your devices</li>
              <li>Have water and any materials you need ready</li>
              <li>Take a moment to set your intention for this focused time</li>
            </ul>
          </div>
          
          ${dashboardUrl ? `<div style="text-align: center;">
            <a href="${dashboardUrl}/dashboard" class="cta-button">📊 View Dashboard</a>
          </div>` : ''}
          
          <p style="color: #64748b; font-style: italic; margin-top: 32px;">
            Make the most of your focused time! 🚀
          </p>
        </div>
        
        <div class="footer">
          <p>This reminder was sent because you have reminders enabled for your quiet blocks.</p>
          <p>Quiet Scheduler - Helping you focus better, one block at a time.</p>
        </div>
      </div>
    </body>
    </html>
    `
  }

  /**
   * Generate plain text content for reminder email
   */
  private generateReminderEmailText(data: {
    userName: string
    quietBlockTitle: string
    startTime: string
    endTime: string
    duration: number
    minutesUntilStart: number
  }): string {
    const { userName, quietBlockTitle, startTime, endTime, duration, minutesUntilStart } = data

    return `
🔔 Quiet Block Reminder

Hello ${userName},

Your quiet block "${quietBlockTitle}" starts in ${minutesUntilStart} minute${minutesUntilStart !== 1 ? 's' : ''}!

📅 Session Details:
🏷️ Title: ${quietBlockTitle}
🕐 Start Time: ${startTime}
🕐 End Time: ${endTime}
⏱️ Duration: ${duration} minutes

💡 Getting Ready for Your Quiet Block:
• Find a comfortable, distraction-free environment
• Turn off notifications on your devices
• Have water and any materials you need ready
• Take a moment to set your intention for this focused time

Make the most of your focused time! 🚀

---
This reminder was sent because you have reminders enabled for your quiet blocks.
Quiet Scheduler - Helping you focus better, one block at a time.
    `.trim()
  }

  /**
   * Send a test email to verify the service is working
   */
  async sendTestEmail(toEmail: string): Promise<EmailResult> {
    try {
      if (!this.resendApiKey) {
        return { success: false, error: 'RESEND_API_KEY is not configured' }
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: toEmail,
          subject: 'Test Email from Quiet Scheduler',
          html: '<h1>Test Email</h1><p>If you receive this, the email service is working correctly!</p>',
          text: 'Test Email\n\nIf you receive this, the email service is working correctly!',
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return { success: false, error: `Resend API error: ${response.status} ${errorText}` }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }
    }
  }
}

export default EdgeOptimizedEmailService