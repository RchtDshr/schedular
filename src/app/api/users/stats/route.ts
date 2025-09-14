import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { UserService } from '@/lib/services/userService'

// GET /api/users/stats - Get user statistics
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser()

    if (error || !supabaseUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user statistics
    const stats = await UserService.getUserStats(supabaseUser.id)

    if (!stats) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Error getting user stats:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}