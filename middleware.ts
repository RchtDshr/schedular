import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { createClient } from '@/utils/supabase/server'

export async function middleware(request: NextRequest) {
  // Update session first
  const response = await updateSession(request)
  
  // Define protected routes
  const protectedRoutes = ['/dashboard', '/profile']
  const authRoutes = ['/auth/login', '/auth/signup']
  
  const { pathname } = request.nextUrl
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))
  
  // Skip auth check for API routes and static files
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.includes('.')) {
    return response
  }
  
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // Redirect unauthenticated users from protected routes
    if (isProtectedRoute && !user) {
      const redirectUrl = new URL('/auth/login', request.url)
      redirectUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(redirectUrl)
    }
    
    // Redirect authenticated users from auth routes
    if (isAuthRoute && user) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  } catch (error) {
    console.error('Middleware auth error:', error)
    // If there's an auth error on protected routes, redirect to login
    if (isProtectedRoute) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}