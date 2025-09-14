'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import { authService } from '@/lib/auth'

interface AuthContextType {
  user: User | null
  mongoUserId: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, confirmPassword: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [mongoUserId, setMongoUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // Function to sync user with MongoDB
  const syncUserWithMongoDB = async (supabaseUser: User) => {
    try {
      const response = await fetch('/api/users/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setMongoUserId(result.data.id)
          console.log('✅ User synced with MongoDB:', result.data.id)
        }
      }
    } catch (error) {
      console.error('❌ Error syncing user with MongoDB:', error)
    }
  }

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const session = await authService.getSession()
        const sessionUser = session?.user ?? null
        setUser(sessionUser)
        
        // Sync with MongoDB if user exists
        if (sessionUser) {
          await syncUserWithMongoDB(sessionUser)
        } else {
          setMongoUserId(null)
        }
      } catch (error) {
        console.error('Error getting initial session:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const sessionUser = session?.user ?? null
      setUser(sessionUser)
      
      // Sync with MongoDB on sign in/sign up
      if (sessionUser && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        await syncUserWithMongoDB(sessionUser)
      } else if (event === 'SIGNED_OUT') {
        setMongoUserId(null)
      }
      
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw new Error(error.message)
      }

      if (data.user && data.session) {
        setUser(data.user)
      }
    } catch (error) {
      setLoading(false)
      throw error
    }
  }

  const signUp = async (email: string, password: string, confirmPassword: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        throw new Error(error.message)
      }

      // If email confirmation is disabled, the user will be signed in immediately
      if (data.user && data.session) {
        setUser(data.user)
      }
    } catch (error) {
      setLoading(false)
      throw error
    } finally {
      // Don't set loading to false here if we have a session
      // Let the auth state change handler manage it
      if (!supabase.auth.getSession()) {
        setLoading(false)
      }
    }
  }

  const signOut = async () => {
    try {
      await authService.signOut()
    } catch (error) {
      throw error
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      mongoUserId,
      loading,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}