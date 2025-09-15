import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import QuietBlock from '@/models/QuietBlock'
import User from '@/models/User'

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()

    // Get some basic stats
    const totalBlocks = await QuietBlock.countDocuments({})
    const totalUsers = await User.countDocuments({})
    const deletedBlocks = await QuietBlock.countDocuments({ isDeleted: true })
    const activeBlocks = await QuietBlock.countDocuments({ isDeleted: false })

    // Get sample data
    const sampleBlocks = await QuietBlock.find({}).limit(5).lean()
    const sampleUsers = await User.find({}).limit(3).lean()

    // Get distinct supabaseUserIds
    const distinctSupabaseIds = await QuietBlock.distinct('supabaseUserId')

    return NextResponse.json({
      success: true,
      stats: {
        totalBlocks,
        totalUsers,
        deletedBlocks,
        activeBlocks,
        distinctSupabaseIds: distinctSupabaseIds.length
      },
      sampleData: {
        blocks: sampleBlocks.map(block => ({
          _id: block._id,
          title: block.title,
          supabaseUserId: block.supabaseUserId,
          userId: block.userId,
          isDeleted: block.isDeleted,
          status: block.status,
          startTime: block.startTime,
          endTime: block.endTime
        })),
        users: sampleUsers.map(user => ({
          _id: user._id,
          supabaseId: user.supabaseId,
          email: user.email,
          name: user.name
        })),
        distinctSupabaseIds
      }
    })
  } catch (error) {
    console.error('Database debug error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}