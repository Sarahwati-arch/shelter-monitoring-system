-- ============================================================================
-- Migration: Add Audit Triggers
-- Description: Adds a generic trigger function and triggers for audit logging
-- ============================================================================

-- 1. Create the generic trigger function
CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_old_data JSONB;
    v_new_data JSONB;
    v_record_id TEXT;
    v_pk_col_name TEXT;
BEGIN
    -- Try to get user_id from auth.uid() if executed via Supabase API
    -- It might be null if executed by service_role or trigger without auth context
    BEGIN
        SELECT user_id INTO v_user_id FROM public.users WHERE supabase_user_id = auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    IF (TG_OP = 'UPDATE') THEN
        v_old_data := row_to_json(OLD)::jsonb;
        v_new_data := row_to_json(NEW)::jsonb;
    ELSIF (TG_OP = 'DELETE') THEN
        v_old_data := row_to_json(OLD)::jsonb;
    ELSIF (TG_OP = 'INSERT') THEN
        v_new_data := row_to_json(NEW)::jsonb;
    END IF;

    -- Extract primary key from trigger arguments if provided
    IF array_length(TG_ARGV, 1) > 0 THEN
        v_pk_col_name := TG_ARGV[0];
        IF (TG_OP = 'DELETE') THEN
            v_record_id := v_old_data->>v_pk_col_name;
        ELSE
            v_record_id := v_new_data->>v_pk_col_name;
        END IF;
    END IF;

    -- Insert into audit_logs
    INSERT INTO public.audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        old_values,
        new_values
    ) VALUES (
        v_user_id,
        TG_OP,
        TG_TABLE_NAME,
        v_record_id::UUID, -- Cast to UUID because audit_logs.record_id is UUID type
        v_old_data,
        v_new_data
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create triggers for target tables

-- Users
DROP TRIGGER IF EXISTS audit_users_trigger ON users;
CREATE TRIGGER audit_users_trigger
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION process_audit_log('user_id');

-- Shelters
DROP TRIGGER IF EXISTS audit_shelters_trigger ON shelters;
CREATE TRIGGER audit_shelters_trigger
AFTER INSERT OR UPDATE OR DELETE ON shelters
FOR EACH ROW EXECUTE FUNCTION process_audit_log('shelter_id');

-- Devices
DROP TRIGGER IF EXISTS audit_devices_trigger ON devices;
CREATE TRIGGER audit_devices_trigger
AFTER INSERT OR UPDATE OR DELETE ON devices
FOR EACH ROW EXECUTE FUNCTION process_audit_log('device_id');

-- Thresholds
DROP TRIGGER IF EXISTS audit_thresholds_trigger ON thresholds;
CREATE TRIGGER audit_thresholds_trigger
AFTER INSERT OR UPDATE OR DELETE ON thresholds
FOR EACH ROW EXECUTE FUNCTION process_audit_log('threshold_id');

-- Alerts
DROP TRIGGER IF EXISTS audit_alerts_trigger ON alerts;
CREATE TRIGGER audit_alerts_trigger
AFTER INSERT OR UPDATE OR DELETE ON alerts
FOR EACH ROW EXECUTE FUNCTION process_audit_log('alert_id');

-- Employees
DROP TRIGGER IF EXISTS audit_employees_trigger ON employees;
CREATE TRIGGER audit_employees_trigger
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH ROW EXECUTE FUNCTION process_audit_log('id');
