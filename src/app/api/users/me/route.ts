import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { UserService } from '@/lib/services/userService'

// GET /api/users/me - Get current user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser()

    if (error || !supabaseUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get or create MongoDB user
    const { user, mongoUserId } = await UserService.ensureUserExists(supabaseUser)

    return NextResponse.json({
      success: true,
      data: {
        id: mongoUserId,
        supabaseId: user.supabaseId,
        email: user.email,
        name: user.name,
        preferences: user.preferences,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    })
  } catch (error) {
    console.error('Error getting user:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/users/me - Update current user
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser()

    if (error || !supabaseUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, preferences } = body

    // Update user in MongoDB
    const updatedUser = await UserService.updateUser(supabaseUser.id, {
      name,
      preferences
    })

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: (updatedUser._id as any).toString(),
        supabaseId: updatedUser.supabaseId,
        email: updatedUser.email,
        name: updatedUser.name,
        preferences: updatedUser.preferences,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      }
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}