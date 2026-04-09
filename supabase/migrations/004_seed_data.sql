-- ============================================
-- 004_seed_data.sql
-- Development Seed Data
-- ============================================

-- Insert sample shelters
INSERT INTO shelters (shelter_id, shelter_name, location, description, latitude, longitude) VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Shelter Alpha', 'Jl. Raya Cikarang No. 15, Bekasi', 'Main monitoring shelter near industrial zone', -6.30200000, 107.17100000),
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Shelter Beta', 'Jl. Industri Blok A3, Karawang', 'Secondary shelter in agricultural area', -6.32300000, 107.33700000),
    ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'Shelter Gamma', 'Jl. Pergudangan Lot 7, Cikarang Utara', 'Warehouse district monitoring point', -6.28500000, 107.15800000);

-- Insert sample thresholds
INSERT INTO thresholds (shelter_id, temp_warning, temp_critical, vibration_limit, humidity_warning) VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 35.0, 40.0, 2.0, 80.0),
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 33.0, 38.0, 1.8, 85.0),
    ('c3d4e5f6-a7b8-9012-cdef-123456789012', 36.0, 42.0, 2.5, 75.0);

-- Insert sample devices
INSERT INTO devices (device_id, shelter_id, device_type, device_name, token, status) VALUES
    ('d4e5f6a7-b8c9-0123-defa-234567890123', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'sensor', 'ESP32-TEMP-Alpha', 'tok_esp32_temp_alpha_001', 'active'),
    ('e5f6a7b8-c9d0-1234-efab-345678901234', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'sensor', 'ESP32-VIB-Alpha', 'tok_esp32_vib_alpha_001', 'active'),
    ('f6a7b8c9-d0e1-2345-fabc-456789012345', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'camera', 'RPi-CAM-Alpha', 'tok_rpi_cam_alpha_001', 'active'),
    ('a7b8c9d0-e1f2-3456-abcd-567890123456', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'sensor', 'ESP32-TEMP-Beta', 'tok_esp32_temp_beta_001', 'active'),
    ('b8c9d0e1-f2a3-4567-bcde-678901234567', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'camera', 'RPi-CAM-Beta', 'tok_rpi_cam_beta_001', 'inactive');

-- Insert sample sensor data (recent readings for dashboard)
INSERT INTO sensor_data (shelter_id, device_id, temperature, humidity, vibration, risk_level, timestamp) VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-defa-234567890123', 32.5, 65.0, 0.45, 'low', NOW() - INTERVAL '5 minutes'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-defa-234567890123', 33.1, 63.2, 0.52, 'low', NOW() - INTERVAL '10 minutes'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-defa-234567890123', 34.8, 61.5, 0.68, 'medium', NOW() - INTERVAL '15 minutes'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-defa-234567890123', 36.2, 58.0, 1.15, 'medium', NOW() - INTERVAL '20 minutes'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-defa-234567890123', 38.7, 55.3, 1.82, 'high', NOW() - INTERVAL '25 minutes'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-defa-234567890123', 35.4, 60.1, 0.71, 'medium', NOW() - INTERVAL '30 minutes'),
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'a7b8c9d0-e1f2-3456-abcd-567890123456', 30.2, 72.0, 0.32, 'low', NOW() - INTERVAL '5 minutes'),
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'a7b8c9d0-e1f2-3456-abcd-567890123456', 29.8, 73.5, 0.28, 'low', NOW() - INTERVAL '10 minutes'),
    ('c3d4e5f6-a7b8-9012-cdef-123456789012', NULL, 31.0, 68.0, 0.40, 'low', NOW() - INTERVAL '5 minutes');

-- Insert sample alerts
INSERT INTO alerts (shelter_id, alert_type, status, severity, message, created_at) VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'temp', 'open', 'critical', 'Temperature exceeded critical threshold: 38.7°C (limit: 40.0°C)', NOW() - INTERVAL '25 minutes'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'vibration', 'acknowledged', 'warning', 'Vibration level elevated: 1.82 g (limit: 2.0 g)', NOW() - INTERVAL '1 hour'),
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'offline', 'open', 'warning', 'Device RPi-CAM-Beta has been offline for 30+ minutes', NOW() - INTERVAL '30 minutes'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'intrusion', 'closed', 'critical', 'Unknown person detected at Shelter Alpha entrance', NOW() - INTERVAL '2 hours'),
    ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'temp', 'closed', 'warning', 'Temperature approaching warning threshold: 34.5°C', NOW() - INTERVAL '3 hours');

-- Insert scheduled data retention jobs
SELECT cron.schedule(
    'cleanup-sensor-data',
    '0 2 * * *',
    $$DELETE FROM sensor_data WHERE timestamp < NOW() - INTERVAL '90 days'$$
);

SELECT cron.schedule(
    'cleanup-old-alerts',
    '0 3 * * *',
    $$DELETE FROM alerts WHERE status = 'closed' AND resolved_at < NOW() - INTERVAL '1 year'$$
);

SELECT cron.schedule(
    'cleanup-old-evidence',
    '0 4 * * *',
    $$DELETE FROM cctv_evidence WHERE created_at < NOW() - INTERVAL '6 months'$$
);
