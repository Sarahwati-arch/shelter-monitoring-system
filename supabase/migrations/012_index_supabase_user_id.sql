-- Migration: Add index on users.supabase_user_id
-- Description: Improves performance of audit log triggers which frequently lookup users by auth.uid()

CREATE INDEX IF NOT EXISTS idx_users_supabase_user_id ON public.users(supabase_user_id);
