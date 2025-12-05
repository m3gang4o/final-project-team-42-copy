-- Fix notes privacy issue by making group_id nullable
-- This allows personal notes (group_id = null) and shared group notes (group_id = <group_id>)

-- First, check if the column is already nullable
-- If not, alter the table to make group_id nullable
ALTER TABLE messages 
ALTER COLUMN group_id DROP NOT NULL;

-- Add a comment to document the schema
COMMENT ON COLUMN messages.group_id IS 'Group ID for shared notes. NULL for personal notes.';
