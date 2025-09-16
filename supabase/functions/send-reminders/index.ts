// Supabase Edge Function for sending reminder emails
// Runs every 5 minutes and checks for reminders due in the next 5 minutes
// This function acts as a cron trigger that calls the Next.js API for actual processing

// @ts-nocheck - This file is for Deno runtime, ignore Node.js type checking
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req: any) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Starting Supabase edge function reminder check (5-minute interval)...')

    // Verify the request is from Supabase cron or authorized source
    const authHeader = req.headers.get('authorization')
    const cronSecret = Deno.env.get('CRON_SECRET') || 'default-secret-change-in-production'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.log('❌ Unauthorized request to reminder endpoint')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Call our Next.js API endpoint to get reminder data and send emails
    const nextjsApiUrl = Deno.env.get('NEXTJS_API_URL') || 'https://schedular-34hl.vercel.app'
    
    const response = await fetch(`${nextjsApiUrl}/api/cron/send-reminders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Next.js API call failed: ${errorText}`)
    }

    const result = await response.json()
    
    console.log('📊 Supabase edge function completed:', result)

    return new Response(
      JSON.stringify({
        ...result,
        source: 'supabase-edge-function',
        interval: '5 minutes'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Error in Supabase edge function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error during reminder process',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        source: 'supabase-edge-function'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})