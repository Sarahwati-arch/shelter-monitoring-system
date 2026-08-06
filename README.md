# 🏚️ Shelter Monitoring System

Sistem monitoring berbasis IoT, AI, dan Computer Vision untuk memantau kondisi shelter secara real-time. Sistem ini menggabungkan sensor fisik (suhu, kelembaban, getaran), kecerdasan buatan untuk klasifikasi getaran dan pengenalan wajah, serta dashboard web untuk visualisasi dan manajemen.

---

## 📑 Daftar Isi

1. [Arsitektur Sistem](#arsitektur-sistem)
2. [Struktur Project](#struktur-project)
3. [Komponen 1: Sensor Suhu & Kelembaban (ESP32 + SHT3X)](#komponen-1-sensor-suhu--kelembaban-esp32--sht3x)
4. [Komponen 2: Sensor Getaran (ESP32 + MPU6050)](#komponen-2-sensor-getaran-esp32--mpu6050)
5. [Komponen 3: Vibration AI (Random Forest Classifier)](#komponen-3-vibration-ai-random-forest-classifier)
6. [Komponen 4: MQTT Broker](#komponen-4-mqtt-broker)
7. [Komponen 5: MQTT → Supabase Bridge (Python)](#komponen-5-mqtt--supabase-bridge-python)
8. [Komponen 6: Face Recognition AI (2-Stage Pipeline)](#komponen-6-face-recognition-ai-2-stage-pipeline)
9. [Komponen 7: Supabase (Database + Auth + Storage)](#komponen-7-supabase-database--auth--storage)
10. [Komponen 8: Web Dashboard (React + Vite)](#komponen-8-web-dashboard-react--vite)
11. [Telegram Alert Notifications](#telegram-alert-notifications)
12. [Setup & Installation](#setup--installation)
13. [Environment Variables Reference](#environment-variables-reference)
14. [Deployment](#deployment)
15. [Troubleshooting](#troubleshooting)

---

## Arsitektur Sistem

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        SHELTER MONITORING SYSTEM                         │
└──────────────────────────────────────────────────────────────────────────┘

  [ESP32 + SHT3X]   ──── MQTT /Temp ─────────────────────────────┐
  [ESP32 + MPU6050] ──── MQTT /Accel + /Gyro ───────────────────►│
                                                                  │
                                               [broker.emqx.io] (Public MQTT Broker)
                                                                  │
  [Rpi 5 + 5MP Cam] ──► [Face Recognition AI] ──► Supabase       │
       MTCNN detect        Stage1 + Stage2        Storage         │
          +                      │                  │             │
       ArcFace recog             └──────────────────┘             │
                                                    │             │
                                                    ▼             ▼
                                          ┌───────────────────────────────┐
                                          │   MQTT → Supabase Bridge      │
                                          │   bridge/mqtt_to_supabase.py  │
                                          │   - Vibration AI Inference    │
                                          │   - Risk Level Calculator      │
                                          │   - Alert Generator            │
                                          │   - Telegram Bot Notifier      │
                                          │   - Config Publisher (→ ESP32) │
                                          └──────────────┬────────────────┘
                                                         │
                                                         ▼
                                              ┌──────────────────────┐
                                              │   Supabase (BaaS)    │
                                              │   PostgreSQL + Auth  │
                                              │   Storage Buckets    │
                                              │   Row Level Security │
                                              └──────────┬───────────┘
                                                         │
                                            ┌────────────▼────────────┐
                                            │   React Web Dashboard   │
                                            │   frontend/ (Vite)      │
                                            │   Deployed di Vercel    │
                                            └─────────────────────────┘
                                                         │
                                                         ▼
                                               [Telegram Bot Alerts]
                                               (critical events only)
```

---

## Struktur Project

```
 shelter-monitoring-system/
 ├── Temp_Vibra_Script/               # Arduino sketches untuk ESP32
 │   ├── temperature_monitoring.ino   # Sensor suhu & kelembaban (SHT3X)
 │   └── vibration_monitoring.ino    # Sensor getaran (MPU6050)
 │
 ├── vibration_ai/                    # Pipeline training model AI getaran
 │   ├── 1_feature_extractor.py       # Ekstraksi 14 fitur statistik dari sinyal
 │   ├── 2_model_trainer.py           # Training Random Forest Classifier
 │   ├── augment_dataset.py           # Data augmentation untuk dataset getaran
 │   ├── diagnose.py                  # Evaluasi performa model & confusion matrix
 │   ├── format_logs_to_json.py       # Converter log mentah sensor -> JSON window
 │   ├── analyze.py                   # Analisis spektral & distribusi fitur
 │   ├── test_scenarios.py            # Unit test ekstraksi 14 fitur
 │   └── models/
 │       ├── vibration_classifier.pkl # Model hasil training
 │       └── scaler.pkl               # StandardScaler
 │
 ├── bridge/                          # MQTT → Supabase bridge (Python)
 │   ├── mqtt_to_supabase.py          # Main bridge script (+ Vibration AI)
 │   ├── simulator.py                 # Simulator MQTT basic
 │   ├── simulator_earthquake.py      # Simulasi gempa bumi
 │   ├── simulator_smart.py           # Simulator pola realistis
 │   ├── simulator_advanced.py        # Simulasi skenario kompleks
 │   ├── simulator_direct.py          # Direct publish test
 │   ├── simulator_guaranteed.py      # Reliable test payload
 │   ├── requirements.txt
 │   ├── .env.example
 │   ├── Procfile                     # Untuk deploy ke Railway/Heroku
 │   └── runtime.txt
 │
 ├── face_recognition/                # Computer Vision pipeline
 │   ├── src/
 │   │   ├── pi_camera/               # Native Raspberry Pi 5 Camera integration
 │   │   │   ├── pi_camera_test.py    # Runner utama Pi Camera (Picamera2)
 │   │   │   └── supabase_uploader.py # Snapshot & alert uploader
 │   │   ├── stage1/
 │   │   │   ├── stage1_face_detect.py # MTCNN face detection core
 │   │   │   ├── webcam_test.py        # Runner webcam (OpenCV)
 │   │   │   ├── supabase_uploader.py  # Upload snapshot ke Supabase
 │   │   │   └── verify_env.py         # Diagnostic lingkungan PyTorch/OpenCV
 │   │   ├── stage2/
 │   │   │   └── stage2_face_recognition.py # ArcFace recognition
 │   │   └── sync_employees.py         # Edge sync worker (cloud → local)
 │   ├── scripts/
 │   │   └── migrate_faces_to_supabase.py # Helper migrasi foto lokal ke Storage
 │   ├── data/
 │   │   └── faces/                    # Foto enrollment per identitas
 │   │       └── <nama_orang>/
 │   │           └── photo_001.jpg ...
 │   ├── models/
 │   │   ├── embeddings.npy            # ArcFace embedding matrix
 │   │   └── employee_metadata.json    # Metadata per embedding
 │   ├── logs/                         # Log harian stage1 & stage2
 │   ├── requirements.txt
 │   ├── .env.example
 │   ├── start.bat                     # Quick start (Windows)
 │   └── start.sh                      # Quick start (Linux/Mac)
 │
 ├── supabase/                        # Database schema & migrations
 │   ├── migrations/                  # Migration SQL 001 s/d 014 + helpers
 │   ├── cloud-setup.sql               # All-in-one setup untuk Supabase cloud
 │   ├── exampledata.sql               # Seed data dummy
 │   └── config.toml                   # Supabase local config
 │
 ├── frontend/                        # Web Dashboard (React + Vite)
 │   ├── src/
 │   │   ├── pages/                   # Dashboard, Alerts, Evidence, Devices, AuditLogs,
 │   │   │                            # Reports, Admin, EmployeeEnrollment, Profile, Login
 │   │   ├── components/
 │   │   │   ├── dashboard/           # GaugeCard, SensorChart, CCTVFeed, AIVibrationCard,
 │   │   │   │                        # AlertFeed, StatusCard
 │   │   │   ├── auth/                # ProtectedRoute (Role Guard)
 │   │   │   ├── layout/              # AppLayout, Sidebar, Header
 │   │   │   └── ui/                  # Dropdown, Pagination
 │   │   ├── services/
 │   │   │   ├── dashboardService.js  # Semua query ke Supabase
 │   │   │   └── reportService.js     # Fetch data untuk export Excel
 │   │   ├── utils/
 │   │   │   ├── exportToExcel.js     # Engine export Excel (XLSX)
 │   │   │   └── helpers.js           # Utility helpers
 │   │   ├── stores/
 │   │   │   └── authStore.js         # Zustand auth state
 │   │   └── lib/
 │   │       └── supabase.js          # Supabase client
 │   ├── .env.example
 │   ├── vite.config.js
 │   └── vercel.json
 │
 ├── FACE_RECOGNITION_TECHNICAL_OVERVIEW.md # Dokumentasi mendalam Computer Vision
 ├── VIBRATION_AI_TECHNICAL_OVERVIEW.md  # Dokumentasi mendalam Vibration AI
 └── MODEL_DIAGNOSTICS.md                # Laporan evaluasi & diagnosa model AI
```

---

## Komponen 1: Sensor Suhu & Kelembaban (ESP32 + SHT3X)

**File:** `Temp_Vibra_Script/temperature_monitoring.ino`

### Hardware

| Komponen | Detail |
|---|---|
| Mikrokontroler | ESP32 |
| Sensor | SHT3X (I2C, address `0x44`) |
| Koneksi SDA | GPIO 21 |
| Koneksi SCL | GPIO 22 |
| LED Hijau (Normal) | GPIO 18 |
| LED Kuning (Warning) | GPIO 19 |
| LED Merah (Critical) | GPIO 23 |
| Buzzer | GPIO 5 |

### Library Arduino yang Dibutuhkan

Install via **Library Manager** (Tools → Manage Libraries):

- `PubSubClient` by Nick O'Leary
- `ArduinoJson` by Benoit Blanchon
- `Wire` (built-in ESP32)
- `WiFi` (built-in ESP32)

### MQTT Topics

| Topic | Arah | Payload |
|---|---|---|
| `tok_esp32_temp_alpha_001/Temp` | ESP32 → Broker | `{"temperature": 28.50, "humidity": 65.20}` |
| `tok_esp32_temp_alpha_001/Config` | Bridge → ESP32 | `{"temp_interval_ms": 5000, "temp_warn": 35.0, "temp_crit": 40.0}` |

> **Token** `tok_esp32_temp_alpha_001` harus sama persis dengan field `token` di tabel `devices` Supabase.

### Status LED & Buzzer

| Status | Suhu | LED | Buzzer |
|---|---|---|---|
| NORMAL | < 35°C | Hijau ON | OFF |
| WARNING | 35–39.9°C | Kuning ON | Blink tiap 500ms |
| CRITICAL | ≥ 40°C | Merah ON | Continuous ON |

Threshold default dapat di-override secara remote via MQTT config topic (dikirim oleh bridge).

### Konfigurasi yang Wajib Disesuaikan

```cpp
// WiFi credentials (baris 25-26)
const char* ssid     = "NamaWifi";
const char* password = "PasswordWifi";

// MQTT topics — token harus sesuai dengan database (baris 30-32)
const char* topic_temp   = "tok_esp32_temp_alpha_001/Temp";
const char* topic_config = "tok_esp32_temp_alpha_001/Config";

// Threshold default lokal (dapat di-override dari bridge)
float tempWarning  = 35.0;
float tempCritical = 40.0;
```

### Cara Flash ke ESP32

1. Buka **Arduino IDE** (versi 1.8.x atau 2.x)
2. Tambahkan ESP32 board package: **File → Preferences → Additional Board Manager URLs**:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Install board: **Tools → Board → Boards Manager** → cari "ESP32" → Install
4. Install library via Library Manager: `PubSubClient`, `ArduinoJson`
5. Pilih board: **Tools → Board → ESP32 Dev Module**
6. Pilih port COM yang sesuai
7. Klik **Upload**

---

## Komponen 2: Sensor Getaran (ESP32 + MPU6050)

**File:** `Temp_Vibra_Script/vibration_monitoring.ino`

### Hardware

| Komponen | Detail |
|---|---|
| Mikrokontroler | ESP32 |
| Sensor | MPU6050 (I2C, 400kHz) |
| Koneksi SDA | GPIO 23 |
| Koneksi SCL | GPIO 22 |
| LED Merah (Critical) | GPIO 25 |
| LED Kuning (Warning) | GPIO 26 |
| LED Hijau (Normal) | GPIO 27 |
| Buzzer | GPIO 5 |

### Library Arduino yang Dibutuhkan

- `PubSubClient` by Nick O'Leary
- `ArduinoJson` by Benoit Blanchon
- `MPU6050_light` by rfetick
- `Wire` (built-in)
- `WiFi` (built-in)

### EMA Filter (Noise Reduction)

Sensor menggunakan **Exponential Moving Average (EMA)** dengan alpha = 0.1 untuk meredam noise sebelum data dipublikasikan:

```
filtered = alpha × raw + (1 − alpha) × filtered_prev
```

Filter dijalankan di setiap iterasi `loop()` (non-blocking), terpisah dari interval publish.

### MQTT Topics

| Topic | Arah | Payload |
|---|---|---|
| `tok_esp32_vib_alpha_001/Accel` | ESP32 → Broker | `{"accel_x": 0.012, "accel_y": -0.003, "accel_z": 0.981}` |
| `tok_esp32_vib_alpha_001/Gyro` | ESP32 → Broker | `{"gyro_x": 0.001, "gyro_y": 0.002, "gyro_z": -0.001}` |
| `tok_esp32_vib_alpha_001/Config` | Bridge → ESP32 | `{"vib_interval_ms": 1000, "vib_warn": 0.3, "vib_crit": 0.7}` |

> Accel dan Gyro dipublikasikan **terpisah** lalu **di-merge oleh bridge** menggunakan pairing buffer (timeout 3 detik) sebelum disimpan ke database.

### Status LED & Buzzer

Vibration level dihitung dari magnitude accelerometer (filtered EMA):

```
vibLevel = sqrt(ax^2 + ay^2 + az^2)
```

| Status | vibLevel | LED | Buzzer |
|---|---|---|---|
| NORMAL | < `vibWarning` | Hijau ON | OFF |
| WARNING | `vibWarning` – `vibCritical` | Kuning ON | Blink tiap 500ms |
| CRITICAL | ≥ `vibCritical` | Merah ON | Continuous ON |

> **Catatan Sinkronisasi Threshold Dinamis:**
> 
> 1. **Sumber Utama (Source of Truth)**: Threshold getaran disimpan di database Supabase (tabel `thresholds`, default: `0.3` g warning / `0.7` g critical) dan diatur oleh Admin via Web App.
> 2. **Push Config via MQTT**: Bridge (`mqtt_to_supabase.py`) mem-publish threshold dari Supabase ke topic `<token>/Config` (misal: `{"vib_warn": 0.3, "vib_crit": 0.7}`).
> 3. **Update Runtime ESP32**: Fungsi `mqttCallback()` di ESP32 menerima payload JSON tersebut dan meng-override variabel `vibWarning` & `vibCritical` saat runtime tanpa perlu reflash firmware.
> 4. **Firmware Startup Fallback**: Di kode C++ (`vibration_monitoring.ino`), variabel `vibWarning = 1.5;` dan `vibCritical = 2.5;` digunakan sebagai *initial fallback* sementara saat cold-boot sebelum pesan MQTT Config dari Supabase diterima.

### Konfigurasi yang Wajib Disesuaikan

```cpp
// WiFi credentials (baris 27-28)
const char* ssid     = "NamaWifi";
const char* password = "PasswordWifi";

// MQTT topics — token harus sesuai dengan database (baris 33-35)
const char* topic_accel  = "tok_esp32_vib_alpha_001/Accel";
const char* topic_gyro   = "tok_esp32_vib_alpha_001/Gyro";
const char* topic_config = "tok_esp32_vib_alpha_001/Config";
```

---

## Komponen 3: Vibration AI (Random Forest Classifier)

**Directory:** `vibration_ai/`

Model AI untuk mengklasifikasikan **penyebab getaran** menjadi 5 kelas berdasarkan pola sinyal accelerometer.

### 5 Kelas Klasifikasi

| ID | Kelas | Risk Level | Contoh Skenario |
|---|---|---|---|
| 0 | Normal / AC | Low | Background noise, AC beroperasi |
| 1 | Footsteps | Low | Langkah kaki manusia |
| 2 | Sabotage / Maintenance | **High** | Ketukan keras, drilling, alat berat |
| 3 | Vehicle | Medium | Kendaraan melintas di dekat shelter |
| 4 | Earthquake | **High** | Gempa bumi |

### 14 Fitur Statistik yang Di-extract

Dari window **10 sample** magnitude sinyal accelerometer (pada live inference bridge):

| # | Fitur | Deskripsi |
|---|---|---|
| 1 | ZCR | Zero Crossing Rate |
| 2 | Mean | Rata-rata sinyal |
| 3 | MAD | Median Absolute Deviation |
| 4 | Skewness | Kemiringan distribusi |
| 5 | Std | Standard Deviasi |
| 6 | Kurtosis | Keruncingan distribusi |
| 7 | Crest Factor | Peak / RMS |
| 8 | Min | Nilai minimum |
| 9 | Max | Nilai maksimum |
| 10 | Range | Max - Min |
| 11 | Median | Nilai tengah |
| 12 | IQR | Interquartile Range |
| 13 | RMS | Root Mean Square |
| 14 | Energy | Jumlah kuadrat sinyal |

### Pipeline Training

```
vibration_ai/
├── class_0_normal_AC/        <- file .wav
├── class_1_foot_steps/       <- file .wav
├── class_2_sabotase_maint/   <- file .wav
├── class_3_vehicle/          <- file .wav
└── class_4_earthquake/
    └── intermediate_train_w_150000_s_150000.json
```

**Langkah training:**

```bash
cd vibration_ai

# Langkah 1: Ekstraksi fitur dari data audio
python 1_feature_extractor.py
# Output: features_X.npy, features_y.npy

# Langkah 2: Training model (80:20 stratified split)
python 2_model_trainer.py
# Output: models/vibration_classifier.pkl
#         models/scaler.pkl
#         models/evaluation_report.txt
```

> Jika akurasi model < 85%, trainer akan otomatis memunculkan peringatan.

### Cara Kerja Inference Real-time di Bridge

1. Bridge mengakumulasi **magnitude accel** `sqrt(ax^2+ay^2+az^2)` ke buffer per device.
2. Setelah **10 sample** terkumpul → 14 fitur di-extract → di-scale dengan `scaler.pkl` → model predict via `vibration_classifier.pkl`.
3. Jika confidence < **60%** atau AI fallback → sistem menggunakan `conventional_risk` berdasarkan threshold DB Supabase.
4. **Logika Hybrid Risk (Worst-Case / Safety Net)**:
   Sistem mengambil risiko tertinggi (`max(conventional_risk, ai_risk)`) berdasarkan bobot risiko (`low: 0`, `medium: 1`, `high: 2`, `critical: 3`):
   - **AI Menang**: Jika AI mendeteksi *"Sabotage"* atau *"Earthquake"* (High Risk), status otomatis menjadi **HIGH**, meskipun getaran fisiknya masih di bawah threshold.
   - **Threshold Menang (Safety Net Fisik)**: Jika AI mendeteksi *"Normal/AC"* atau *"Footsteps"* (Low Risk), TAPI guncangan fisik melebihi threshold critical DB, sistem mengabaikan penilaian AI dan tetap menetapkan status **HIGH**.
   - **Fallback/Offline**: Jika model AI mati atau error, sistem kembali 100% mengandalkan threshold DB Supabase.

**Contoh metadata yang tersimpan di `vibration_data.metadata`:**

```json
{
  "ai_label": "Earthquake",
  "ai_confidence": 0.87,
  "ai_fallback": false,
  "ai_window_size": 10
}
```

---

## Komponen 4: MQTT Broker

Sistem menggunakan **EMQX Public Broker** (`broker.emqx.io:1883`) sebagai default message broker.

### Konfigurasi Default

| Parameter | Nilai |
|---|---|
| Broker Host | `broker.emqx.io` |
| Port TCP | `1883` |
| Port TLS/SSL | `8883` |
| Protocol | MQTT 3.1.1 |
| Autentikasi | Tidak diperlukan (public) |

### Struktur & Matriks Topic MQTT

Format topic: `<device_token>/<sensor_type>`

| Komponen | Role / Arah Pesan | Topic MQTT | Subscriber (Penerima) | Retain Flag | Description / Purpose |
|---|---|---|---|---|---|
| **ESP32 Temp** | Publisher (Out) | `tok_esp32_temp_alpha_001/Temp` | Python Bridge (`+/Temp`) | False | Mengirim data suhu (°C) & kelembaban (%) |
| **ESP32 Vibra** | Publisher (Out) | `tok_esp32_vib_alpha_001/Accel` | Python Bridge (`+/Accel`) | False | Mengirim data accelerometer (X, Y, Z) |
| **ESP32 Vibra** | Publisher (Out) | `tok_esp32_vib_alpha_001/Gyro` | Python Bridge (`+/Gyro`) | False | Mengirim data gyroscope (X, Y, Z) |
| **Bridge → ESP32** | Publisher (Out) | `tok_esp32_temp_alpha_001/Config` | ESP32 Temperature | **True** (Retained) | Push interval & threshold suhu ke ESP32 |
| **Bridge → ESP32** | Publisher (Out) | `tok_esp32_vib_alpha_001/Config` | ESP32 Vibration | **True** (Retained) | Push interval & threshold getaran ke ESP32 |

> **Penjelasan Wildcard Subscription Single-Level (`+`):**
> 
> 1. **`+/Temp`**, **`+/Accel`**, **`+/Gyro`**: Python Bridge mendaftarkan subscription menggunakan wildcard single-level `+` di posisi token device. Hal ini memungkinkan 1 proses Bridge menangani banyak ESP32 shelter sekaligus tanpa perlu hardcode token di kode Bridge.
> 2. **Sebab Menggunakan `+` Bukan `#`**: Broker publik seperti `broker.emqx.io` memblokir subscription root multi-level `#` demi alasan keamanan dan efisiensi bandwidth.
> 3. **Pesan Retained Config**: Bridge mem-publish pesan config ke `<token>/Config` dengan flag `retain=True`, sehingga saat ESP32 baru dinyalakan/reconnect, broker akan **langsung memberikan pesan konfigurasi terbaru secara otomatis**.

### Monitoring MQTT (Testing)

**Menggunakan MQTT Explorer (GUI — Rekomendasi):**
1. Download di https://mqtt-explorer.com
2. Host: `broker.emqx.io`, Port: `1883` → Connect
3. Subscribe ke topic yang diinginkan

**Menggunakan mosquitto_clients (CLI):**

```bash
# Monitor semua data masuk
mosquitto_sub -h broker.emqx.io -p 1883 -t "+/#" -v

# Monitor suhu saja
mosquitto_sub -h broker.emqx.io -p 1883 -t "tok_esp32_temp_alpha_001/Temp" -v

# Publish manual untuk testing
mosquitto_pub -h broker.emqx.io -p 1883 \
  -t "tok_esp32_temp_alpha_001/Temp" \
  -m '{"temperature": 36.5, "humidity": 70.0}'
```

**Menggunakan simulator bawaan project:**

```bash
cd bridge
python simulator.py               # Basic simulator (random temp & accel)
python simulator_earthquake.py    # Simulasi gelombang getaran gempa bumi
python simulator_smart.py         # Simulator dengan transisi pola realistis
python simulator_advanced.py     # Simulasi skenario multi-device & multi-shelter
python simulator_direct.py       # Test publish pesan tunggal langsung
python simulator_guaranteed.py   # Test payload dengan jaminan interval & pairing
```

### Mengganti ke MQTT Broker Sendiri (Private)

Jika ingin menggunakan broker MQTT privat (Mosquitto, EMQX Cloud, HiveMQ, dll.):

**1. Install Mosquitto secara lokal:**

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install mosquitto mosquitto-clients

# macOS
brew install mosquitto

# Windows: download installer dari https://mosquitto.org/download/
```

**2. Jalankan Mosquitto:**

```bash
# Tanpa autentikasi (development)
mosquitto

# Dengan config file
mosquitto -c /etc/mosquitto/mosquitto.conf
```

**3. Update konfigurasi di semua komponen:**

ESP32 Temperature (`temperature_monitoring.ino`):
```cpp
const char* mqtt_server = "192.168.1.100";  // IP broker kamu
```

ESP32 Vibration (`vibration_monitoring.ino`):
```cpp
const char* mqtt_server = "192.168.1.100";
const int   mqtt_port   = 1883;
```

Bridge (`bridge/.env`):
```env
MQTT_BROKER=192.168.1.100
MQTT_PORT=1883
```

**4. Jika butuh autentikasi username/password (Mosquitto):**

Buat password file:
```bash
mosquitto_passwd -c /etc/mosquitto/passwd myusername
```

Update `/etc/mosquitto/mosquitto.conf`:
```
allow_anonymous false
password_file /etc/mosquitto/passwd
listener 1883
```

Update `bridge/.env`:
```env
MQTT_USERNAME=myusername
MQTT_PASSWORD=mypassword
```

Tambahkan di `bridge/mqtt_to_supabase.py` (sebelum `client.connect()`):
```python
if os.getenv("MQTT_USERNAME"):
    client.username_pw_set(
        os.getenv("MQTT_USERNAME"),
        os.getenv("MQTT_PASSWORD")
    )
```

**5. Menggunakan EMQX Cloud (managed broker):**
1. Daftar di https://www.emqx.com/en/cloud
2. Buat deployment → dapatkan host, port, username, password
3. Update semua konfigurasi seperti pada poin 3 & 4 di atas

---

## Komponen 5: MQTT → Supabase Bridge (Python)

**File:** `bridge/mqtt_to_supabase.py`

Bridge adalah inti backend sistem. Berjalan sebagai Python process yang selalu aktif (long-running daemon).

### Fungsi Utama

| Fungsi | Deskripsi |
|---|---|
| Subscribe MQTT | Mendengarkan `+/Accel`, `+/Gyro`, `+/Temp` dari semua device |
| Device Resolution | Mapping `device_token` -> `device_id` + `shelter_id` (cache 5 menit) |
| Buffer & Pairing | Accel + Gyro di-merge jika keduanya datang dalam 3 detik |
| Threshold Loading | Load threshold per shelter dari DB (cache 5 menit) |
| AI Inference | Klasifikasi getaran dengan Random Forest (window 10 sample) |
| Risk Level Calc | Tentukan low/medium/high berdasarkan threshold shelter |
| Insert Supabase | Simpan ke `temperature_data` dan `vibration_data` |
| Alert Generation | Insert ke tabel `alerts` jika risk medium/high |
| Telegram Notif | Kirim ke semua user terdaftar saat critical |
| Config Publisher | Push config (interval + threshold) ke ESP32 tiap 60 detik |

### Alur Data Suhu

```
MQTT /Temp -> parse JSON -> hitung risk level
                         -> insert temperature_data
                         -> jika medium/high -> insert alert
                         -> jika high (critical) -> kirim Telegram
```

### Alur Data Getaran

```
MQTT /Accel -+
             +-> pairing buffer (PAIR_TIMEOUT = 3s)
MQTT /Gyro  -+
                        |
                        v
             hitung magnitude accel
                        |
             akumulasi AI buffer (10 samples)
                        |
             setiap 10 sample:
               -> extract 14 fitur -> scale -> RF predict
               -> update metadata (ai_label, ai_confidence)
                        |
             insert vibration_data (risk_level + metadata)
                        |
             jika medium/high -> insert alert
             jika high/critical -> kirim Telegram
```

### File `.env`

```bash
# bridge/.env
MQTT_BROKER=broker.emqx.io
MQTT_PORT=1883

SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Telegram Bot (opsional, untuk alert)
BOT_TOKEN=1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ
CHAT_ID=123456789   # Fallback jika tidak ada chat_id di tabel users
```

### Cara Menjalankan

```bash
cd bridge

# 1. Buat virtual environment
python -m venv venv

# 2. Aktifkan venv
venv\Scripts\activate     # Windows
source venv/bin/activate  # Linux/Mac

# 3. Install dependencies
pip install -r requirements.txt

# 4. Siapkan .env
cp .env.example .env
# Edit .env dengan kredensial Supabase dan Telegram

# 5. Jalankan bridge
python mqtt_to_supabase.py
```

**Contoh output normal:**

```
Loading AI Model and Scaler...
AI Model loaded successfully.
Connecting to broker.emqx.io:1883 ...
Connected to MQTT broker broker.emqx.io:1883
Subscribed to: +/Accel, +/Gyro, +/Temp
[Config] Published {"temp_interval_ms": 5000, "temp_warn": 35.0, "temp_crit": 40.0} -> tok_esp32_temp_alpha_001/Config
DEBUG: received message on tok_esp32_temp_alpha_001/Temp
  -> Inserted env | shelter=xxxx | device=xxxx | temp=28.5C | humidity=65.2% | risk=low
```

---

## Komponen 6: Face Recognition AI (2-Stage Pipeline)

**Directory:** `face_recognition/`

### Arsitektur Pipeline

```
[Raspberry Pi 5 + 5MP Cam]
      |
      v
+----------------------------------------------+
|  Stage 1: Face Detection (MTCNN)             |
|  - Detect wajah di frame                     |
|  - Confidence threshold: 0.80                |
|  - Padding: 25px di sekitar wajah            |
|  - Face alignment via 5-point landmark       |
|    (mata kiri, mata kanan, hidung, mulut)    |
|  - Alert jika tidak ada wajah terdeteksi     |
+---------------------------+------------------+
                            | face crop (RGB array)
                            v
+----------------------------------------------+
|  Stage 2: Face Recognition (ArcFace)         |
|  via DeepFace library                        |
|  - Generate ArcFace embedding 512-dim        |
|  - Aggregated voting (rata-rata multi-foto)  |
|  - Cosine similarity threshold: 0.45         |
|  - Margin enforcement: 0.08                  |
|    (winner harus unggul min 0.08 dari #2)    |
|  - Adaptive per-identity threshold           |
+------------------+-----------+---------------+
                   |           |
             [MATCH]     [NO MATCH / UNKNOWN]
           Tampilkan    alert_type = "intrusion"
             nama       Upload snapshot -> Supabase Storage
                        Insert alert -> tabel alerts
                        Insert -> tabel cctv_evidence
```

### Stage 1: Face Detection

**Files:** `src/stage1/stage1_face_detect.py` + `src/stage1/webcam_test.py`

- **Model**: MTCNN (Multi-task Cascaded CNN)
- **Input**: Frame webcam (BGR -> RGB)
- **Output**: Bounding box, face crop, 5-point facial landmarks

| Konfigurasi | Nilai | Keterangan |
|---|---|---|
| `CONFIDENCE_THRESHOLD` | 0.80 | Minimum confidence untuk wajah valid |
| `PADDING` | 25px | Padding crop di sekitar bounding box |
| `CAMERA_ID` | `WEBCAM_LAPTOP` | Label kamera untuk logging |

**Keyboard controls saat webcam aktif:**

| Tombol | Fungsi |
|---|---|
| `Q` / `ESC` | Keluar |
| `S` | Simpan snapshot frame saat ini |
| `P` | Pause / Resume feed |
| `+` | Naikkan confidence threshold |
| `-` | Turunkan confidence threshold |

### Stage 2: Face Recognition

**File:** `src/stage2/stage2_face_recognition.py`

- **Model**: ArcFace via `deepface` library (detector backend: MTCNN)
- **Embedding**: 512-dimensi float32 per foto enrollment
- **Algoritma matching**:
  1. Hitung cosine similarity live embedding vs semua embedding enrollment
  2. Aggregated voting: rata-rata score dari semua foto per identitas (TOP_K_PER_IDENTITY = semua)
  3. Margin enforcement: winner harus lebih unggul >= 0.08 dari runner-up
  4. Jika max similarity < 0.45 → UNKNOWN
- **Rekomendasi**: minimal 5 foto per orang untuk akurasi optimal

### Cloud-to-Edge Enrollment

```
Admin via Dashboard                    Edge Device
      |                                     |
      v                                     |
Upload foto karyawan                        |
      |                                     |
      v                                     |
Supabase Storage (employee-faces)           |
      |                                     |
      v                                     |
tabel employees (is_synced=false)  <-- polling 60s
                                            |
                                   sync_employees.py
                                            |
                                   Download foto dari Storage
                                            |
                                   enroll_multiple_images()
                                   (generate ArcFace embedding)
                                            |
                                   Update is_synced=true
```

### Perintah Stage 2

```bash
cd face_recognition
# (aktifkan venv terlebih dahulu)

# Enroll semua wajah dari data/faces/
python src/stage2/stage2_face_recognition.py enroll

# Identifikasi satu foto
python src/stage2/stage2_face_recognition.py identify --image path/to/face.jpg

# Diagnosa intra/inter class distances
python src/stage2/stage2_face_recognition.py diagnose
```

### Menjalankan Face Recognition

#### 1. Menggunakan Webcam Laptop / USB Camera (OpenCV)

```bash
# Windows (quick start)
start.bat

# Linux/Mac
./start.sh

# Manual - deteksi saja tanpa recognition
python src/stage1/webcam_test.py

# Manual - dengan recognition
python src/stage1/webcam_test.py --recognize

# Kamera indeks spesifik (0 = default, 1 = external)
python src/stage1/webcam_test.py --recognize --cam-index 1

# Simpan semua frame otomatis
python src/stage1/webcam_test.py --recognize --save-all
```

#### 2. Menggunakan Raspberry Pi 5 Camera Module 5MP Rev 1.3 (Native `Picamera2`)

Untuk pengujian langsung di perangkat Raspberry Pi 5 menggunakan **Camera Module 5MP Rev 1.3** via `libcamera` / `Picamera2`:

```bash
cd face_recognition

# Jalankan face recognition live via Pi Camera 2
python src/pi_camera/pi_camera_test.py
```

- Modul ini menangkap buffer RGB888 secara native via `picam2.capture_array()`.
- Jika terdeteksi *unknown person*, snapshot gambar otomatis diunggah ke Supabase Storage (`cctv-evidence`), lalu mencatat alert intrusion di tabel `alerts` dan `cctv_evidence`.
- Untuk wajah terdaftar (recognized), hanya mencetak log timestamp tanpa mengunggah file gambar (menghemat storage).

**Jalankan Edge Sync Worker di terminal terpisah:**

```bash
python src/sync_employees.py
```

### Struktur Folder Faces

```
face_recognition/data/faces/
├── Budi_Santoso/
│   ├── photo_001.jpg
│   ├── photo_002.jpg
│   ├── photo_003.jpg
│   ├── photo_004.jpg
│   └── photo_005.jpg      <- minimal 5 foto untuk akurasi optimal
├── Sarah_Wijaya/
│   └── ...
└── Nanda_Pratama/
    └── ...
```

> Nama folder = nama yang ditampilkan saat recognition. Gunakan format tanpa spasi (`Nama_Lengkap`).

---

## Komponen 7: Supabase (Database + Auth + Storage)

**Directory:** `supabase/`

### Tabel Database

#### `users` — Pengguna Sistem

| Kolom | Tipe | Keterangan |
|---|---|---|
| `user_id` | UUID | Primary key |
| `supabase_user_id` | UUID | FK ke `auth.users` (auto-created via trigger) |
| `name` | VARCHAR | Nama user |
| `email` | VARCHAR | Email login |
| `role` | VARCHAR | `admin` atau `technician` |
| `telegram_chat_id` | VARCHAR | Untuk notifikasi alert personal |

#### `shelters` — Data Shelter

| Kolom | Tipe | Keterangan |
|---|---|---|
| `shelter_id` | UUID | Primary key |
| `shelter_name` | VARCHAR | Nama shelter |
| `location` | VARCHAR | Alamat/lokasi |
| `latitude` | DECIMAL | Koordinat GPS |
| `longitude` | DECIMAL | Koordinat GPS |

#### `devices` — Perangkat IoT

| Kolom | Tipe | Keterangan |
|---|---|---|
| `device_id` | UUID | Primary key |
| `shelter_id` | UUID | FK ke shelters |
| `device_type` | VARCHAR | `temperature`, `vibration`, `camera` |
| `token` | VARCHAR | **Unique — prefix MQTT topic di ESP32** |
| `status` | VARCHAR | `active`, `inactive`, `maintenance` |
| `last_seen` | TIMESTAMPTZ | Terakhir kali data diterima oleh bridge |

> **Penting**: Field `token` harus sama persis dengan prefix topic MQTT yang dikonfigurasi di kode ESP32.

#### `thresholds` — Threshold Per Shelter

| Kolom | Default | Keterangan |
|---|---|---|
| `temp_warning` | 35.0 | Suhu warning (C) |
| `temp_critical` | 40.0 | Suhu critical (C) |
| `humidity_warning` | 80.0 | Kelembaban warning (%) |
| `humidity_critical` | 90.0 | Kelembaban critical (%) |
| `vibration_warning` | 10.0 | Getaran warning (g magnitude) |
| `vibration_critical` | 20.0 | Getaran critical (g magnitude) |
| `temp_interval_ms` | 5000 | Interval sensor suhu (ms) |
| `vibration_interval_ms` | 1000 | Interval sensor getaran (ms) |

> Perubahan threshold di dashboard akan di-push otomatis ke ESP32 oleh bridge dalam <= 60 detik.

#### `temperature_data` — Data Time-Series Suhu

| Kolom | Tipe | Keterangan |
|---|---|---|
| `temperature` | FLOAT | Suhu dalam C |
| `humidity` | FLOAT | Kelembaban dalam % |
| `risk_level` | VARCHAR | `low`, `medium`, `high` |
| `timestamp` | TIMESTAMPTZ | Waktu pengukuran |

#### `vibration_data` — Data Time-Series Getaran

| Kolom | Tipe | Keterangan |
|---|---|---|
| `accel_x/y/z` | FLOAT | Data accelerometer (g) |
| `gyro_x/y/z` | FLOAT | Data gyroscope (deg/s) |
| `risk_level` | VARCHAR | `low`, `medium`, `high` |
| `metadata` | JSONB | AI label, confidence, ai_fallback |

#### `alerts` — Event Alert

| Kolom | Tipe | Keterangan |
|---|---|---|
| `alert_type` | VARCHAR | `temp`, `vibration`, `intrusion`, `offline` |
| `status` | VARCHAR | `open`, `acknowledged`, `closed` |
| `severity` | VARCHAR | `warning`, `critical` |
| `message` | TEXT | Deskripsi detail alert |
| `resolution_notes` | TEXT | Catatan resolusi dari operator |
| `acknowledged_at` | TIMESTAMPTZ | Waktu diakui |
| `resolved_at` | TIMESTAMPTZ | Waktu diselesaikan |

#### `cctv_evidence` — Snapshot Kamera

| Kolom | Tipe | Keterangan |
|---|---|---|
| `storage_path` | VARCHAR | Path di bucket `cctv-evidence` |
| `public_url` | VARCHAR | URL gambar untuk ditampilkan di dashboard |
| `captured_at` | TIMESTAMPTZ | Waktu kamera menangkap |
| `faces_detected` | INTEGER | Jumlah wajah yang terdeteksi |
| `face_metadata` | JSONB | Data recognition (nama, confidence, dll) |

#### `employees` — Data Enrollment Karyawan

| Kolom | Tipe | Keterangan |
|---|---|---|
| `name` | TEXT | Nama karyawan |
| `role` | TEXT | Jabatan/posisi |
| `image_paths` | TEXT[] | Array path foto di bucket `employee-faces` |
| `is_synced` | BOOLEAN | `false` = belum di-sync ke edge device |

#### `audit_logs` — Jejak Audit Keamanan Sistem

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK ke `users.user_id` (pengubah data) |
| `action` | VARCHAR | `INSERT`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT` |
| `entity_name` | VARCHAR | Nama tabel / entitas yang diubah |
| `entity_id` | VARCHAR | ID entitas yang diubah |
| `old_data` | JSONB | State data sebelum perubahan |
| `new_data` | JSONB | State data setelah perubahan |
| `ip_address` | VARCHAR | Alamat IP pengakses |
| `created_at` | TIMESTAMPTZ | Waktu aktivitas dicatat |

#### `system_settings` — Konfigurasi Sistem Global

| Kolom | Tipe | Keterangan |
|---|---|---|
| `key` | VARCHAR | Primary Key (nama konfigurasi) |
| `value` | JSONB | Nilai konfigurasi |
| `description` | TEXT | Deskripsi parameter |
| `updated_at` | TIMESTAMPTZ | Waktu terakhir di-update |

### Storage Buckets

| Bucket | Akses | Isi |
|---|---|---|
| `cctv-evidence` | Private (authenticated) | Snapshot kamera saat ada intrusion/alert |
| `employee-faces` | Private (auth + service_role) | Foto enrollment wajah karyawan |

### Setup Database (Supabase Cloud)

1. Buat project baru di https://supabase.com
2. Buka **SQL Editor** di dashboard
3. Jalankan file `supabase/cloud-setup.sql` (all-in-one) **ATAU** jalankan migrations satu per satu secara berurutan:
   ```
   001_init_schema.sql -> 002_rls_policies.sql -> 003_storage_buckets.sql -> 004_seed_data.sql ->
   005_migrate_device_types.sql -> 006_auth_trigger.sql -> 007_vibration_thresholds.sql ->
   008_create_employees_table.sql -> 009_alter_employees_image_paths.sql -> 010_audit_triggers.sql ->
   011_log_action_rpc.sql -> 012_index_supabase_user_id.sql -> 013_system_settings.sql ->
   014_enable_realtime.sql -> add_sensor_intervals.sql -> fix_vibration_thresholds.sql
   ```
4. Aktifkan Email Auth: **Authentication → Providers → Email → Enable**
5. Buat user pertama: **Authentication → Users → Add User**
6. Set role admin:
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'admin@email.com';
   ```
7. Dari **Settings → API**, catat:
   - `Project URL`
   - `anon` key (public, untuk frontend)
   - `service_role` key (secret, untuk bridge & face recognition)

---

## Komponen 8: Web Dashboard (React + Vite)

**Directory:** `frontend/`

### Tech Stack

| Teknologi | Versi | Kegunaan |
|---|---|---|
| React | 19 | UI framework |
| Vite | 8 | Build tool & dev server |
| Tailwind CSS | 4 | Utility-first styling |
| Supabase JS | 2.x | DB client & Auth |
| React Router | 7 | Client-side routing |
| Chart.js + react-chartjs-2 | 4 + 5 | Grafik sensor real-time |
| Zustand | 5 | Global state (auth) |
| XLSX | 0.18 | Export Excel |
| Lucide React | Latest | Icon set |

### Halaman & Fitur Web Dashboard

#### 1. Login (`/login`)

- Form autentikasi Email + Password via Supabase Auth.
- Validation, error feedback, dan automatic redirect ke dashboard setelah berhasil login.
- Link "Forgot Password" untuk mengirimkan email reset password.

#### 2. Reset Password (`/reset-password`)

- Halaman reset kata sandi berbasis token konfirmasi dari email Supabase Auth.
- Input password baru + konfirmasi password dengan validasi kekuatan password.

#### 3. Dashboard (`/`)

- **Shelter Selector** — Dropdown real-time untuk memilih lokasi shelter yang sedang dipantau.
- **3 Risk Level Cards** — Indicator status terkini Temperature, Humidity, dan Vibration (`LOW` / `MEDIUM` / `HIGH`).
- **3 Gauge Cards** — Visualisasi radial gauge untuk Suhu (°C), Kelembaban (%), dan Magnitude Getaran (g) lengkap dengan marker batas threshold warning/critical.
- **Time Range Selector** — Pilihan interval waktu grafik (30m, 1h, 3h, 6h, 12h, 24h).
- **Chart Trends** — Grafik linier real-time Sensor Temperature, Humidity, dan Vibration (append data tanpa reload).
- **AI Vibration Card** — Menampilkan hasil klasifikasi AI getaran terbaru, tingkat confidence (%), dan status fallback.
- **CCTV Feed** — Snapshot CCTV real-time dari tangkapan terdekat saat terdeteksi *unrecognized person*.
- **Alert Feed & Status Card** — Ticker alert cepat dan ringkasan status kesehatan seluruh perangkat IoT shelter.
- **Auto-Refresh** — Polling ringan setiap 3 detik hanya untuk memperbarui data sensor terbaru.

#### 4. Alerts (`/alerts`)

- **Multi-Filter**: Filter berdasarkan Status (`all`/`open`/`acknowledged`/`closed`), Alert Type (`temp`/`vibration`/`intrusion`/`offline`), Severity (`warning`/`critical`), Shelter, dan pencarian teks.
- **Pagination**: 10 rekord alert per halaman.
- **Detail Modal**: Menampilkan informasi lengkap penyebab alert, sensor pengirim, dan metadata AI.
- **Tindakan Penanganan (Actions)**:
  - *Acknowledge*: Mengubah status alert dari `open` → `acknowledged` dan mencatat timestamp `acknowledged_at`.
  - *Close*: Mengubah status alert → `closed` serta menginput catatan penanganan (`resolution_notes`) dari teknisi.

#### 5. Evidence (`/evidence`)

- **Grid Snapshot CCTV**: Tampilan galeri foto bukti intrusi kamera 3 kolom (9 snapshot per halaman).
- **Filter Shelter**: Memilih galeri snapshot berdasarkan shelter.
- **Hover Overlay**: Menampilkan nama shelter, waktu penangkapan, dan jumlah wajah terdeteksi.
- **Fullscreen Lightbox**: Modul visualizer gambar ukuran penuh saat thumbnail diklik.

#### 6. Devices (`/devices`)

- **Daftar Perangkat IoT**: Tabel lengkap perangkat dengan ikon tipe (`Temperature`, `Vibration`, `Camera`).
- **Status Badges**: Indikator status perangkat (`Active`, `Inactive`, `Maintenance`).
- **Last Seen Relative**: Timestamp waktu terakhir device terhubung ("2 menit lalu").
- **Detail Modal**: Menampilkan statistik detail perangkat + 10 riwayat pembacaan sensor terakhir.
- **CRUD Device (Admin Only)**: Menambah, mengubah token MQTT, atau menghapus perangkat dari sistem.

#### 7. Reports (`/reports`)

- **Shelter Selector**: Memilih shelter untuk laporan.
- **Date Range Picker**: Pemilih rentang tanggal kustom (Start Date s/d End Date).
- **Quick Presets**: Tombol cepat untuk rentang `Hari Ini`, `7 Hari Terakhir`, `30 Hari Terakhir`.
- **Export Excel**: Generasi otomatis file spreadsheet `.xlsx` berisi 3 sheet terpisah:
  - *Sheet 1*: Temperature & Humidity Data
  - *Sheet 2*: Vibration Data & AI Classification
  - *Sheet 3*: Alerts & Resolution History
- **Penanamaan File Otomatis**: `<NamaShelter>_<TanggalMulai>_to_<TanggalSelesai>.xlsx`.

#### 8. Admin Panel (`/admin`) — 5 Tab Utama (Admin Only)

- **Tab 1: Shelters**:
  - CRUD Data Shelter (Nama Shelter, Lokasi, Deskripsi, Koordinat Latitude & Longitude).
  - Pagination 6 shelter per halaman + Modal Peta/Detail lokasi.
- **Tab 2: Users**:
  - Manajemen Pengguna Sistem (Tambah User, Edit Role `admin`/`technician`, Hapus User).
  - Pengaturan **Telegram Chat ID** per user untuk notifikasi alert personal.
- **Tab 3: Thresholds**:
  - Pengaturan nilai Ambang Batas (Threshold) per shelter: Suhu Warning/Critical (°C), Kelembaban Warning/Critical (%), Getaran Warning/Critical (g).
  - **Sensor Polling Interval**: Pengaturan frekuensi kirim data ESP32 (`1s`, `2s`, `5s`, `10s`, `30s`, `60s`).
  - *Sync Automatis*: Perubahan threshold/interval di-push oleh bridge ke ESP32 via MQTT dalam waktu <=60 detik.
- **Tab 4: Face Enrollment**:
  - Form pendaftaran wajah karyawan baru (Nama & Jabatan/Role dengan autocomplete).
  - Multi-photo upload dengan preview thumbnail & validasi foto.
  - *Automated Edge Sync*: Foto disimpan di Supabase Storage `employee-faces` → di-sync otomatis ke Raspberry Pi 5 Edge Device via `sync_employees.py` dalam <=60 detik.
- **Tab 5: System**:
  - Ringkasan informasi versi sistem, status server backend, dan statistik database.

#### 9. Audit Logs (`/audit-logs`) — Admin Only

- **Jejak Audit Keamanan**: Memantau seluruh riwayat aktivitas admin dan perubahan data sistem secara transparan.
- **Filter Action**: Filter berdasarkan jenis aksi (`ALL`, `INSERT`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`).
- **Live Search**: Pencarian instan berdasarkan nama user, entitas yang diubah, atau detail aksi.
- **Real-time Live Stream**: Otomatis memperbarui daftar log saat ada perubahan data di Supabase via Supabase Realtime channel.
- **JSON Diff Viewer**: Menganalisis perbedaan data sebelum (`old_data`) dan sesudah (`new_data`) perubahan dilakukan.

#### 10. Profile (`/profile`)

- Menampilkan informasi profil akun terautentikasi (Nama, Email, Role, ID User).
- Pengaturan personal nama pengguna dan **Telegram Chat ID**.
- Formulir penggantian kata sandi (dengan verifikasi password saat ini).

### File `.env` Frontend

```env
# frontend/.env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Telegram Alert Notifications

Sistem mengirim notifikasi Telegram secara otomatis untuk event **critical**.

### Setup Telegram Bot

1. Buka Telegram, cari **@BotFather**
2. Kirim `/newbot` → ikuti instruksi → catat **Bot Token**
3. Kirim pesan ke bot kamu (wajib dilakukan agar bot bisa mengirim ke kamu)
4. Dapatkan Chat ID:

   ```bash
   curl https://api.telegram.org/bot<BOT_TOKEN>/getUpdates
   # Cari: "chat":{"id": 123456789}
   ```

   Atau gunakan bot **@userinfobot** di Telegram

5. Isi `BOT_TOKEN` di `bridge/.env`
6. Isi Telegram Chat ID di profil user via halaman `/profile` di dashboard **ATAU** isi `CHAT_ID` di `bridge/.env` sebagai fallback

### Kapan Alert Telegram Dikirim

Notifikasi Telegram dikirim untuk level **Warning (Medium)**, **Critical (High)**, dan **Intrusion (CCTV Wajah Tidak Dikenal)**:

| Event | Status / Severity | Icon | Kondisi Trigger | Format Pesan Telegram |
|---|---|---|---|---|
| **Intrusion (CCTV)** | Critical | 🚨 | Terdeteksi *unrecognized person* (`unknown`) di kamera | `🚨 [SHELTER xxxx] CCTV Alert: Unrecognized person detected.<br>Evidence: <public_url>` |
| **Suhu / Kelembaban** | Warning (Medium) | ⚠️ | Suhu/Kelembaban melebihi threshold warning | `⚠️ [SHELTER xxxx] Environment warning: Temp: 36.5°C (limit: 35.0°C)` |
| **Suhu / Kelembaban** | Critical (High) | 🚨 | Suhu/Kelembaban melebihi threshold critical | `🚨 [SHELTER xxxx] Environment critical: Temp: 42.3°C (limit: 40.0°C)` |
| **Getaran** | Warning (Medium) | ⚠️ | Getaran melebihi threshold warning / AI medium risk | `⚠️ [SHELTER xxxx] Vibration warning: magnitude 0.45 g (limit: 0.3 g)` |
| **Getaran** | Critical (High) | 🚨 | Getaran melebihi threshold critical / AI High Risk | `🚨 [SHELTER xxxx] Vibration critical: magnitude 25.30 g (limit: 20.0 g) \| AI Detected: Earthquake (87%)` |

> **Catatan Event Normal (`low`):** Data sensor dengan status `low` (normal) hanya disimpan ke time-series database dan **tidak memicu** alert maupun notifikasi Telegram.

### Multi-User Notification

Bridge mengambil semua `telegram_chat_id` dari tabel `users` (cache 5 menit) dan mengirim ke **semua yang terdaftar**. Setiap operator dapat mendaftarkan Chat ID masing-masing di halaman **Profile** dashboard.

---

## Setup & Installation

### Prasyarat

| Tool | Versi Min | Kegunaan |
|---|---|---|
| Python | 3.11+ | Bridge, Face Recognition, Vibration AI |
| Node.js | 18+ | Frontend |
| npm | 8+ | Package manager frontend |
| Arduino IDE | 1.8.x / 2.x | Flash ESP32 |
| Git | any | Clone repo |

### Urutan Setup yang Direkomendasikan

```
1. Supabase   (database dulu, agar komponen lain bisa konek)
2. Bridge     (agar data sensor sudah bisa masuk DB)
3. ESP32 x2  (flash firmware sensor)
4. Face Recognition (setup kamera)
5. Frontend   (dashboard terakhir)
```

---

### Step 1: Clone Repository

```bash
git clone https://github.com/yourusername/shelter-monitoring-system.git
cd shelter-monitoring-system
```

---

### Step 2: Setup Supabase

1. Buat project baru di https://supabase.com
2. Buka **SQL Editor** -> paste dan jalankan isi file `supabase/cloud-setup.sql`
3. Aktifkan Email Auth: **Authentication -> Providers -> Email -> Enable**
4. Buat user pertama: **Authentication -> Users -> Add User**
5. Set role admin:
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'admin@email.com';
   ```
6. Dari **Settings -> API**, catat Project URL, anon key, dan service_role key

---

### Step 3: Setup Bridge

```bash
cd bridge
python -m venv venv

# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env dengan kredensial Supabase dan Telegram

python mqtt_to_supabase.py
```

---

### Step 4: Flash ESP32 Temperature

1. Buka `Temp_Vibra_Script/temperature_monitoring.ino` di Arduino IDE
2. Install library: `PubSubClient`, `ArduinoJson`
3. Sesuaikan WiFi credentials dan token MQTT
4. Tambahkan device di dashboard: **Admin -> Devices -> Add**
   - Device Type: `temperature`, Token: `tok_esp32_temp_alpha_001`
5. Upload ke ESP32

---

### Step 5: Flash ESP32 Vibration

1. Buka `Temp_Vibra_Script/vibration_monitoring.ino` di Arduino IDE
2. Install library: `PubSubClient`, `ArduinoJson`, `MPU6050_light`
3. Sesuaikan WiFi credentials dan token MQTT
4. Tambahkan device di dashboard:
   - Device Type: `vibration`, Token: `tok_esp32_vib_alpha_001`
5. Upload ke ESP32

---

### Step 6: Setup Face Recognition

```bash
cd face_recognition
python -m venv venv

# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env dengan Supabase credentials dan Shelter ID
```

```bash
# Siapkan foto di data/faces/<nama>/ lalu enroll
python src/stage2/stage2_face_recognition.py enroll

# Jalankan recognition
start.bat   # Windows
./start.sh  # Linux/Mac

# Di terminal terpisah: sync worker
python src/sync_employees.py
```

---

### Step 7: Setup Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env dengan Supabase URL dan anon key

# Development
npm run dev
# Buka: http://localhost:5173

# Build production
npm run build
```

---

### Step 8: (Opsional) Re-training Vibration AI

```bash
cd vibration_ai

# Siapkan data audio per class folder
# Ekstraksi fitur
python 1_feature_extractor.py

# Training
python 2_model_trainer.py
```

---

## Environment Variables Reference

### `bridge/.env`

| Variabel | Contoh | Keterangan |
|---|---|---|
| `MQTT_BROKER` | `broker.emqx.io` | Host MQTT broker |
| `MQTT_PORT` | `1883` | Port MQTT |
| `SUPABASE_URL` | `https://xxxx.supabase.co` | URL project Supabase |
| `SUPABASE_SERVICE_KEY` | `eyJhbGci...` | Service role key (Settings -> API) |
| `BOT_TOKEN` | `1234567890:ABCdef...` | Token Telegram Bot |
| `CHAT_ID` | `123456789` | Fallback Chat ID Telegram |

### `face_recognition/.env`

| Variabel | Contoh | Keterangan |
|---|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` | URL project Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_KEY` | `eyJhbGci...` | Service role key (diperlukan sync worker) |
| `SHELTER_ID` | `uuid-from-db` | UUID shelter untuk kamera ini |

### `frontend/.env`

| Variabel | Contoh | Keterangan |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | URL project Supabase |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` | Anon/public key (Settings -> API) |

> File `.env` sudah ada di `.gitignore`. **Jangan pernah commit file `.env` ke repository.**

---

## Deployment

### Bridge — Railway (Rekomendasi)

File `bridge/Procfile` sudah tersedia:

```
worker: python mqtt_to_supabase.py
```

1. Push repo ke GitHub
2. Buat project di https://railway.app
3. Connect repo -> set **Root Directory** ke `bridge`
4. Tambahkan semua environment variables di Railway dashboard
5. Deploy otomatis setiap push ke main branch

### Frontend — Vercel

File `frontend/vercel.json` sudah dikonfigurasi untuk SPA routing.

1. Import project di https://vercel.com
2. Set **Root Directory** ke `frontend`
3. Tambahkan environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
4. Deploy otomatis setiap push

### Face Recognition — Edge Device (Lokal)

Face recognition berjalan lokal pada **Raspberry Pi 5** yang terhubung dengan **Camera Module 5MP Rev 1.3**.

Jalankan dua proses di terminal terpisah:

```bash
# Terminal 1: Face recognition (Webcam / USB Cam)
python src/stage1/webcam_test.py --recognize --cam-index 0

# ATAU via Pi Camera 5MP Native (Raspberry Pi 5 Picamera2)
python src/pi_camera/pi_camera_test.py

# Terminal 2: Cloud sync worker
python src/sync_employees.py
```

---

## Troubleshooting

**Bridge tidak menerima data MQTT**
- Pastikan token di kode ESP32 sesuai dengan field `token` di tabel `devices`
- Test: `mosquitto_sub -h broker.emqx.io -p 1883 -t "+/#" -v`
- Cek log bridge untuk pesan "SKIP: Unknown device token"

**ESP32 tidak bisa connect ke MQTT broker**
- Pastikan WiFi credentials benar di kode ESP32
- Cek Serial Monitor Arduino untuk error message
- Pastikan broker dapat dijangkau dari jaringan ESP32

**Face recognition tidak mendeteksi wajah**
- Test kamera dulu (tanpa recognition): `python src/stage1/webcam_test.py`
- Turunkan confidence threshold dengan menekan `-` saat app berjalan
- Pastikan pencahayaan cukup

**Face recognition tidak mengenali orang yang sudah enrolled**
- Jalankan ulang: `python src/stage2/stage2_face_recognition.py enroll`
- Tambah lebih banyak foto (minimal 5) dengan variasi ekspresi dan sudut
- Jalankan diagnosa: `python src/stage2/stage2_face_recognition.py diagnose`

**Dashboard tidak tampil data sensor**
- Pastikan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` benar di `.env`
- Pastikan bridge aktif dan ESP32 mengirim data
- Buka browser DevTools -> Console untuk cek error

**Telegram alert tidak terkirim**
- Verifikasi token bot: `curl https://api.telegram.org/bot<TOKEN>/getMe`
- Pastikan sudah pernah kirim pesan ke bot (bot tidak bisa inisiasi chat)
- Cek `telegram_chat_id` di tabel `users` sudah terisi
- Periksa `CHAT_ID` di `bridge/.env` sebagai fallback
