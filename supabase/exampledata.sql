-- ========================================================
-- SCRIPT UNTUK MENAMBAH DATA CONTOH (SEED DATA)
-- Jalankan script ini di SQL Editor Supabase
-- ========================================================

DO $$
DECLARE
    v_shelter_id UUID;
    v_sensor_id UUID;
    v_temp_data_id UUID;
    v_vib_data_id UUID;
BEGIN
    -- 1. Tambah Shelter Baru
    INSERT INTO shelters (shelter_name, location, description, latitude, longitude)
    VALUES ('Shelter Merapi - 01', 'Sleman, Yogyakarta', 'Shelter pemantauan utama sektor selatan', -7.607, 110.439)
    RETURNING shelter_id INTO v_shelter_id;

    -- 2. Tambah Threshold (Batas Aman) untuk Shelter tersebut
    INSERT INTO thresholds (shelter_id, temp_warning, temp_critical, vibration_limit, humidity_warning)
    VALUES (v_shelter_id, 35.0, 40.0, 2.5, 85.0);

    -- 3. Tambah Perangkat (Devices)
    INSERT INTO devices (shelter_id, device_type, device_name, token, status)
    VALUES (v_shelter_id, 'sensor', 'Multi-Sensor Node A1', 'token_unique_001', 'active')
    RETURNING device_id INTO v_sensor_id;

    INSERT INTO devices (shelter_id, device_type, device_name, token, status)
    VALUES (v_shelter_id, 'camera', 'CCTV Sektor Selatan', 'token_unique_002', 'active');

    -- 4. Tambah Data Temperature
    INSERT INTO temperature_data (shelter_id, device_id, temperature, humidity, risk_level, timestamp)
    VALUES (v_shelter_id, v_sensor_id, 28.5, 65.0, 'low', NOW())
    RETURNING data_id INTO v_temp_data_id;

    -- 5. Tambah Data Vibration
    INSERT INTO vibration_data (shelter_id, device_id, accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z, risk_level, timestamp)
    VALUES (v_shelter_id, v_sensor_id, 0.1, 0.2, 9.8, 0.0, 0.0, 0.0, 'low', NOW())
    RETURNING data_id INTO v_vib_data_id;

    -- 6. Tambah Data Historis untuk Grafik (Data 1 jam terakhir)
    INSERT INTO temperature_data (shelter_id, device_id, temperature, humidity, risk_level, timestamp)
    VALUES (v_shelter_id, v_sensor_id, 27.8, 64.2, 'low', NOW() - INTERVAL '1 hour');
    
    INSERT INTO vibration_data (shelter_id, device_id, accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z, risk_level, timestamp)
    VALUES (v_shelter_id, v_sensor_id, 0.11, 0.21, 9.79, 0.01, 0.01, 0.0, 'low', NOW() - INTERVAL '1 hour');

    -- 7. Tambah Contoh Alert (Peringatan)
    INSERT INTO alerts (shelter_id, temp_data_id, vibration_data_id, alert_type, status, severity, message, created_at)
    VALUES (v_shelter_id, v_temp_data_id, v_vib_data_id, 'vibration', 'open', 'warning', 'Terdeteksi getaran kecil di sektor selatan', NOW());

    RAISE NOTICE 'Berhasil menambah data contoh untuk Shelter: Shelter Merapi - 01';
END $$;
