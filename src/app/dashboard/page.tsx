'use client'

import { useAuth } from '@/contexts/auth-context'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface UserStats {
  totalQuietBlocks: number
  completedQuietBlocks: number
  totalMinutesScheduled: number
  joinedDate: string
}

interface MongoUser {
  id: string
  supabaseId: string
  email: string
  name?: string
  preferences: {
    timezone: string
    reminderEnabled: boolean
    reminderMinutesBefore: number
    defaultQuietBlockDuration: number
    notificationEmail?: string
  }
  createdAt: string
  updatedAt: string
}

export default function Dashboard() {
  const { user, mongoUserId, loading, signOut } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showConfirmationMessage, setShowConfirmationMessage] = useState(false)
  const [mongoUser, setMongoUser] = useState<MongoUser | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [loadingData, setLoadingData] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Check if user just confirmed their email
    if (searchParams.get('confirmed') === 'true') {
      setShowConfirmationMessage(true)
      // Remove the query parameter from URL
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('confirmed')
      window.history.replaceState({}, '', newUrl.toString())
      
      // Hide message after 5 seconds
      setTimeout(() => setShowConfirmationMessage(false), 5000)
    }
  }, [searchParams])

  // Fetch MongoDB user data and stats
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user || !mongoUserId) return
      
      setLoadingData(true)
      try {
        // Fetch user data
        const userResponse = await fetch('/api/users/me')
        if (userResponse.ok) {
          const userResult = await userResponse.json()
          if (userResult.success) {
            setMongoUser(userResult.data)
          }
        }

        // Fetch user stats
        const statsResponse = await fetch('/api/users/stats')
        if (statsResponse.ok) {
          const statsResult = await statsResponse.json()
          if (statsResult.success) {
            setUserStats(statsResult.data)
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error)
      } finally {
        setLoadingData(false)
      }
    }

    fetchUserData()
  }, [user, mongoUserId])

  useEffect(() => {
    // Add a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (!loading && !user && mounted) {
        console.log('Redirecting to login - no user found')
        router.push('/auth/login')
      }
    }, 3000) // 3 second timeout

    if (!loading && !user && mounted) {
      console.log('Redirecting to login immediately')
      router.push('/auth/login')
    }

    return () => clearTimeout(timeout)
  }, [user, loading, router, mounted])

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setIsSigningOut(false)
    }
  }

  // Show loading state
  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
          {loading && <p className="text-sm text-gray-500 mt-2">Auth state: {loading ? 'Loading' : 'Ready'}</p>}
        </div>
      </div>
    )
  }

  // Show error state if no user after loading
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Authentication error. Redirecting to login...</p>
          <button 
            onClick={() => router.push('/auth/login')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Quiet Scheduler
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, {user.email}
              </span>
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
              >
                {isSigningOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Email confirmation success message */}
        {showConfirmationMessage && (
          <div className="mb-6 mx-4 sm:mx-0">
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-green-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    Email confirmed successfully!
                  </h3>
                  <p className="mt-1 text-sm text-green-700">
                    Welcome to Quiet Scheduler. Your account is now fully activated.
                  </p>
                </div>
                <div className="ml-auto pl-3">
                  <button
                    onClick={() => setShowConfirmationMessage(false)}
                    className="inline-flex text-green-400 hover:text-green-600"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* User Information Card */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                User Information
              </h3>
              {loadingData ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              ) : mongoUser ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Email</p>
                      <p className="font-medium">{mongoUser.email}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Name</p>
                      <p className="font-medium">{mongoUser.name || 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">MongoDB ID</p>
                      <p className="font-medium text-xs">{mongoUser.id}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Timezone</p>
                      <p className="font-medium">{mongoUser.preferences.timezone}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Joined</p>
                      <p className="font-medium">{new Date(mongoUser.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Reminders</p>
                      <p className="font-medium">
                        {mongoUser.preferences.reminderEnabled ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">Failed to load user data</p>
              )}
            </div>

            {/* User Statistics Card */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Statistics
              </h3>
              {loadingData ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              ) : userStats ? (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center p-3 bg-blue-50 rounded">
                    <p className="text-2xl font-bold text-blue-600">{userStats.totalQuietBlocks}</p>
                    <p className="text-gray-600">Total Blocks</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded">
                    <p className="text-2xl font-bold text-green-600">{userStats.completedQuietBlocks}</p>
                    <p className="text-gray-600">Completed</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded">
                    <p className="text-2xl font-bold text-purple-600">{Math.round(userStats.totalMinutesScheduled)}</p>
                    <p className="text-gray-600">Minutes Scheduled</p>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded">
                    <p className="text-2xl font-bold text-orange-600">
                      {userStats.totalQuietBlocks > 0 
                        ? Math.round((userStats.completedQuietBlocks / userStats.totalQuietBlocks) * 100)
                        : 0}%
                    </p>
                    <p className="text-gray-600">Completion Rate</p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No statistics available yet</p>
              )}
            </div>
          </div>

          {/* System Status */}
          <div className="mt-8 bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              System Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${user ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span>Supabase Auth: {user ? 'Connected' : 'Disconnected'}</span>
              </div>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${mongoUserId ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span>MongoDB Sync: {mongoUserId ? 'Synced' : 'Not Synced'}</span>
              </div>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${mongoUser ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                <span>User Data: {mongoUser ? 'Loaded' : loadingData ? 'Loading' : 'Failed'}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}