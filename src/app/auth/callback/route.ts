import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    
    try {
      // Exchange the auth code for a session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (!error && data.session) {
        // Successfully confirmed email and created session
        // Redirect to dashboard with a success message
        const redirectUrl = new URL(next, origin)
        redirectUrl.searchParams.set('confirmed', 'true')
        return NextResponse.redirect(redirectUrl)
      } else {
        console.error('Auth callback error:', error)
        // Redirect to login with error message
        const errorUrl = new URL('/auth/login', origin)
        errorUrl.searchParams.set('error', 'Email confirmation failed')
        return NextResponse.redirect(errorUrl)
      }
    } catch (err) {
      console.error('Auth callback exception:', err)
      // Redirect to login with error message
      const errorUrl = new URL('/auth/login', origin)
      errorUrl.searchParams.set('error', 'An error occurred during email confirmation')
      return NextResponse.redirect(errorUrl)
    }
  }

  // No code provided - redirect to login
  const loginUrl = new URL('/auth/login', origin)
  loginUrl.searchParams.set('error', 'Invalid confirmation link')
  return NextResponse.redirect(loginUrl)
}