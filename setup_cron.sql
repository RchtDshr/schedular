-- Supabase Cron Job Setup for 90-second intervals
-- Run this in your Supabase SQL Editor

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cron job A: runs at 0,3,6,9... minutes of each hour
SELECT cron.schedule(
  'send-reminders-a',
  '0,3,6,9,12,15,18,21,24,27,30,33,36,39,42,45,48,51,54,57 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://wonvdgabgxdqceugsnfp.supabase.co/functions/v1/send-reminders',
      headers := '{"Authorization": "Bearer rachita17d", "Content-Type": "application/json"}'::jsonb
    );
  $$
);

-- Create cron job B: runs at 1,4,7,10... minutes of each hour (offset by 90s from Job A)
SELECT cron.schedule(
  'send-reminders-b', 
  '1,4,7,10,13,16,19,22,25,28,31,34,37,40,43,46,49,52,55,58 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://wonvdgabgxdqceugsnfp.supabase.co/functions/v1/send-reminders',
      headers := '{"Authorization": "Bearer rachita17d", "Content-Type": "application/json"}'::jsonb
    );
  $$
);

-- Verify cron jobs were created
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'send-reminders%';

-- IMPORTANT: Replace YOUR_CRON_SECRET with your actual CRON_SECRET value before running!
-- This should match the CRON_SECRET you set in the environment variables.