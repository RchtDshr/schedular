import { NextRequest, NextResponse } from 'next/server'
import { EmailService } from '@/lib/services/emailService'

// Test API route for the email service
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 })
    }

    const emailService = EmailService.getInstance()
    
    // Send a test email
    const result = await emailService.sendTestEmail(email)

    if (result.success) {
      return NextResponse.json({ 
        message: 'Test email sent successfully',
        email: email 
      })
    } else {
      return NextResponse.json(
        { 
          error: 'Failed to send test email', 
          details: result.error 
        },
        { status: 500 }
      )
    }

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Test sending a reminder email
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 })
  }

  try {
    const emailService = EmailService.getInstance()
    
    // Send a test reminder email
    const result = await emailService.sendQuietBlockReminder({
      userEmail: email,
      userName: 'Test User',
      quietBlockTitle: 'Test Quiet Block',
      startTime: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
      endTime: new Date(Date.now() + 75 * 60 * 1000), // 75 minutes from now (1 hour block)
      minutesUntilStart: 15,
      dashboardUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard`
    })

    if (result.success) {
      return NextResponse.json({ 
        message: 'Test reminder email sent successfully',
        email: email 
      })
    } else {
      return NextResponse.json(
        { 
          error: 'Failed to send test reminder email', 
          details: result.error 
        },
        { status: 500 }
      )
    }

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}