-- Supabase Cron Job Setup for 5-minute intervals
-- Run this in your Supabase SQL Editor

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove old cron jobs if they exist
SELECT cron.unschedule('send-reminders-a');
SELECT cron.unschedule('send-reminders-b');

-- Create new cron job that runs every 5 minutes
SELECT cron.schedule(
  'send-reminders-5min',
  '*/5 * * * *',  -- Runs every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://schedular-34hl.vercel.app/api/cron/send-reminders',
      headers := '{"Authorization": "Bearer rachita17d", "Content-Type": "application/json"}'::jsonb
    );
  $$
);

-- Verify the new cron job was created
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'send-reminders-5min';

-- NOTES:
-- - This cron job runs every 5 minutes: 00:00, 00:05, 00:10, 00:15, etc.
-- - The endpoint checks for reminders due in the next 5 minutes
-- - Replace the URL with your actual deployed endpoint
-- - Make sure CRON_SECRET environment variable matches "rachita17d"