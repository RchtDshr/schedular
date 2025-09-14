import { createClient } from '@/utils/supabase/client'
import type { LoginFormData, SignupFormData } from '@/lib/validations/auth'

export const authService = {
  // Sign up new user
  async signUp(data: SignupFormData) {
    const supabase = createClient()
    
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      throw new Error(error.message)
    }

    return authData
  },

  // Sign in user
  async signIn(data: LoginFormData) {
    const supabase = createClient()
    
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      throw new Error(error.message)
    }

    return authData
  },

  // Sign out user
  async signOut() {
    const supabase = createClient()
    
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      throw new Error(error.message)
    }
  },

  // Get current session
  async getSession() {
    const supabase = createClient()
    
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      throw new Error(error.message)
    }

    return session
  },

  // Get current user
  async getUser() {
    const supabase = createClient()
    
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      throw new Error(error.message)
    }

    return user
  },
}