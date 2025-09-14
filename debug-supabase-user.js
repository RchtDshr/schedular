// Debug script to check Supabase user ID
import { createClient } from '@supabase/supabase-js'

// Add this to a temporary debug page or API route
export async function debugSupabaseUser() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (user) {
    console.log('Current Supabase User:', {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata
    })
  }
  
  return user
}