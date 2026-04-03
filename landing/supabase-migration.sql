-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Add email_stage column to track which follow-up email was sent (0 = none yet)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_stage INTEGER DEFAULT 0;

-- Ensure created_at exists with default timestamp
ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Index for the scheduled function to quickly find leads that need follow-up
CREATE INDEX IF NOT EXISTS idx_leads_followup
ON leads (email_stage, created_at)
WHERE email IS NOT NULL AND email != '';
