import { Resend } from 'resend'
import { format } from 'date-fns'
import EmailTemplates from '@/lib/templates/emailTemplates'

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

      // Use centralized template to format email data
      const emailData = EmailTemplates.formatEmailData({
        userName,
        quietBlockTitle,
        startTime,
        endTime,
        minutesUntilStart,
        dashboardUrl,
        timezone: 'IST'
      })

      const subject = EmailTemplates.generateReminderEmailSubject(quietBlockTitle, minutesUntilStart)
      const htmlContent = EmailTemplates.generateReminderEmailHTML(emailData)
      const textContent = EmailTemplates.generateReminderEmailText(emailData)

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