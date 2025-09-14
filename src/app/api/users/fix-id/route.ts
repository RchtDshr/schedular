import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { connectToDatabase } from '@/lib/mongodb'
import User from '@/models/User'

// POST /api/users/fix-id - Fix mismatched Supabase ID
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser()

    if (error || !supabaseUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await connectToDatabase()

    // Find user by email and update the supabaseId
    const mongoUser = await User.findOne({ email: supabaseUser.email })
    
    if (!mongoUser) {
      return NextResponse.json(
        { success: false, error: 'User not found in MongoDB' },
        { status: 404 }
      )
    }

    const oldSupabaseId = mongoUser.supabaseId
    mongoUser.supabaseId = supabaseUser.id
    await mongoUser.save()

    return NextResponse.json({
      success: true,
      message: 'Supabase ID updated successfully',
      data: {
        email: mongoUser.email,
        oldSupabaseId,
        newSupabaseId: supabaseUser.id,
        mongoUserId: mongoUser._id.toString()
      }
    })
  } catch (error) {
    console.error('Error fixing user ID:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}