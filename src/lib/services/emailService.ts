import { Resend } from 'resend'
import { format } from 'date-fns'

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY)

export interface ReminderEmailData {
  userEmail: string
  userName?: string
  quietBlockTitle: string
  startTime: Date
  endTime: Date
  minutesUntilStart: number
  dashboardUrl?: string
}

export class EmailService {
  private static instance: EmailService
  private readonly fromEmail: string

  constructor() {
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@quietscheduler.com'
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService()
    }
    return EmailService.instance
  }

  /**
   * Send a reminder email for an upcoming quiet block
   */
  async sendQuietBlockReminder(data: ReminderEmailData): Promise<{ success: boolean; error?: string }> {
    try {
      const { userEmail, userName, quietBlockTitle, startTime, endTime, minutesUntilStart, dashboardUrl } = data

      const formattedStartTime = format(startTime, 'PPp') // e.g., "Dec 31, 2023 at 2:00 PM"
      const formattedEndTime = format(endTime, 'p') // e.g., "3:00 PM"
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)) // duration in minutes

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

      const result = await resend.emails.send({
        from: this.fromEmail,
        to: userEmail,
        subject,
        html: htmlContent,
        text: textContent,
      })

      if (result.error) {
        console.error('Failed to send reminder email:', result.error)
        return { success: false, error: result.error.message }
      }

      console.log('Reminder email sent successfully:', { emailId: result.data?.id, to: userEmail })
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

  /**
   * Send a test email to verify email service is working
   */
  async sendTestEmail(toEmail: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await resend.emails.send({
        from: this.fromEmail,
        to: toEmail,
        subject: 'Test Email from Quiet Scheduler',
        html: '<p>If you receive this email, the email service is working correctly!</p>',
        text: 'If you receive this email, the email service is working correctly!',
      })

      if (result.error) {
        return { success: false, error: result.error.message }
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

export default EmailService