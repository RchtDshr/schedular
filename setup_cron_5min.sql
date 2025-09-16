-- Supabase Cron Job Setup for 5-minute intervals
-- Run this in your Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove ALL existing reminder cron jobs to avoid conflicts
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname LIKE '%reminder%';

-- Create new cron job that runs every 5 minutes
SELECT cron.schedule(
  'send-reminders-5min',
  '*/5 * * * *',  -- Runs every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://wonvdgabgxdqceugsnfp.supabase.co/functions/v1/send-reminders',
      headers := '{"Authorization": "Bearer rachita17d", "Content-Type": "application/json"}'::jsonb
    );
  $$
);

-- Verify the new cron job was created and see all existing jobs
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE '%reminder%';

-- Show all cron jobs if you want to see everything
-- SELECT jobname, schedule, active FROM cron.job;

-- NOTES:
-- - Added pg_net extension which is required for net.http_post()
-- - Removes ALL existing reminder cron jobs to prevent conflicts
-- - This cron job runs every 5 minutes: 00:00, 00:05, 00:10, 00:15, etc.
-- - The endpoint checks for reminders due in the next 5 minutes
-- - Make sure CRON_SECRET environment variable matches "rachita17d"