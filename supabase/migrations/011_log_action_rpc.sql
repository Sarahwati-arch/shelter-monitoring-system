-- Migration: Create RPC to log user actions manually from frontend (e.g. LOGIN / LOGOUT)
CREATE OR REPLACE FUNCTION log_user_action(p_action VARCHAR)
RETURNS void AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get internal user_id based on the currently authenticated Supabase Auth user
    SELECT user_id INTO v_user_id FROM public.users WHERE supabase_user_id = auth.uid();
    
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.audit_logs (
            user_id, action, table_name
        ) VALUES (
            v_user_id, p_action, 'auth'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
