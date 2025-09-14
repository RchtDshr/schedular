
'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'

export default function HomePage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-8">
              Welcome to Quiet Scheduler
            </h1>
            <p className="text-xl text-gray-600 mb-12">
              Your personal scheduling assistant
            </p>

            {user ? (
              <div className="space-y-4">
                <p className="text-lg text-gray-700">
                  Welcome back, {user.email}!
                </p>
                <div className="flex justify-center space-x-4">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Go to Dashboard
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex justify-center space-x-4">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Features section */}
          <div className="mt-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-6 bg-white rounded-lg shadow-sm">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Easy Scheduling
                </h3>
                <p className="text-gray-600">
                  Create and manage your quiet blocks with ease
                </p>
              </div>
              <div className="text-center p-6 bg-white rounded-lg shadow-sm">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Time Management
                </h3>
                <p className="text-gray-600">
                  Optimize your productivity with structured time blocks
                </p>
              </div>
              <div className="text-center p-6 bg-white rounded-lg shadow-sm">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Focus Time
                </h3>
                <p className="text-gray-600">
                  Dedicated quiet periods for deep work and concentration
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
