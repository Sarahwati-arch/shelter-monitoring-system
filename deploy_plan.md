# 🚀 Deploy Plan: Shelter Monitoring System — Fullstack Production

> Panduan deployment lengkap sistem monitoring shelter berbasis IoT untuk menghasilkan
> aplikasi yang bisa diakses publik 24/7 tanpa harus menjalankan server secara manual.

---

## 1. Arsitektur Sistem (Project Knowledge)

### 1.1 Komponen Utama

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      SHELTER MONITORING SYSTEM                           │
│                                                                          │
│   [ESP32 Sensor]          [IP Kamera]          [Local Machine]           │
│   accel / gyro / temp     RTSP/USB Feed        Face Recognition           │
│         │                       │                     │                  │
│         └────── MQTT ───────────┘                     │                  │
│                   │                                   │                  │
│          ┌────────▼─────────┐                         │                  │
│          │  Bridge Service  │ ◄── Cloud Deploy ──►    │                  │
│          │ (Python Worker)  │    (Railway/Render)      │                  │
│          └────────┬─────────┘                         │                  │
│                   │                                   │                  │
│          ┌────────▼─────────────────────────────────▼─┐                 │
│          │              SUPABASE (Cloud)               │                 │
│          │   PostgreSQL + Auth + Realtime + Storage     │                 │
│          └─────────────────────────┬───────────────────┘                 │
│                                    │                                     │
│                           ┌────────▼──────────┐                          │
│                           │  Frontend (React)  │ ◄── Vercel              │
│                           │  Dashboard Web App │                          │
│                           └────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Peta Komponen & Status Deploy

| Komponen | Teknologi | Status Saat Ini | Target Deploy | Platform |
|---|---|---|---|---|
| **Frontend** | React 19 + Vite 8 + TailwindCSS 4 | Dev server `localhost:5173` | ✅ Cloud Public | **Vercel** (Gratis) |
| **Bridge** | Python 3.11, paho-mqtt, supabase-py, scikit-learn, librosa | Script manual lokal | ✅ Cloud 24/7 | **Railway** (Trial $5 credit) |
| **Face Recognition** | Python, DeepFace, OpenCV, MTCNN, ArcFace | Script lokal manual | ✅ Local Service | **PC/Raspberry Pi** (Always-on) |
| **Database** | Supabase (PostgreSQL + Auth + Realtime) | Cloud ✅ | Sudah Cloud | **Supabase** |
| **Telegram Bot** | Telegram Bot API | Berjalan via Bridge | Ikut Bridge | Via Bridge |

### 1.3 Aliran Data Lengkap

```
ESP32 (MPU6050)
    │  MQTT publish: <token>/Accel, <token>/Gyro, <token>/Temp
    ▼
broker.emqx.io:1883  (MQTT Public Broker)
    │
    ▼
Bridge Worker (Railway Cloud)
    ├── mqtt_to_supabase.py  ─► Supabase: vibration_data, temperature_data, alerts
    ├── AI Model (vibration_classifier.pkl + scaler.pkl)
    │       └── Buffer 50 readings → predict class → insert metadata
    └── Telegram Bot API ─► Alert Notification

IP Camera / Webcam
    │
    ▼
Face Recognition (Local PC/RPi)
    ├── Stage 1: MTCNN Face Detection
    └── Stage 2: ArcFace Recognition
            └── Alert jika unknown person → (opsional ke Supabase)

Supabase (Cloud Database)
    │  Real-time subscription
    ▼
Frontend (Vercel Cloud)
    ├── Dashboard: Charts, Risk Level, AI Metadata
    ├── Alerts: Alert feed + acknowledge
    ├── Devices: Device management
    ├── Evidence: Snapshot history
    └── Admin: Threshold config, user management
```

---

## 2. Knowledge Project (Konteks Penting untuk Deploy)

### 2.1 Environment Variables

#### Frontend (`frontend/.env`)
```env
VITE_SUPABASE_URL=https://gmkmhgzwdgmtyxnypupu.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
VITE_SUPABASE_TIMEOUT_MS=20000
VITE_SITE_URL=https://<nama-app>.vercel.app   # ← GANTI setelah deploy
```

#### Bridge (`bridge/.env`)
```env
MQTT_BROKER=broker.emqx.io
MQTT_PORT=1883
SUPABASE_URL=https://gmkmhgzwdgmtyxnypupu.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>
BOT_TOKEN=<telegram_bot_token>
CHAT_ID=<fallback_chat_id>
```

> ⚠️ **PENTING**: Jangan commit file `.env` ke GitHub! Pastikan `.gitignore` sudah
> mengecualikannya. Semua secret di-set sebagai Environment Variables di platform deploy.

### 2.2 Path Dependencies Kritis (Bridge)

Bridge `mqtt_to_supabase.py` memuat AI model secara relatif:
```python
AI_MODELS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "vibration_ai", "models"
)
# Path: <root>/vibration_ai/models/vibration_classifier.pkl
#                                  /scaler.pkl
```

Saat deploy ke Railway, **seluruh repo harus di-include** agar path ke `vibration_ai/models/` tersedia. File `.pkl` harus sudah ada di repo (tidak di `.gitignore`).

### 2.3 Model Files yang Harus Ada di Repo
```
vibration_ai/models/
├── vibration_classifier.pkl   ← WAJIB ada di Git
└── scaler.pkl                 ← WAJIB ada di Git
```

### 2.4 Face Recognition — Dependency Hardware
- Membutuhkan kamera fisik (webcam / RTSP stream)
- Entry point: `face_recognition/src/stage1/webcam_test.py --recognize`
- Sebelum jalan: harus `enroll` dulu — `python src/stage2/stage2_face_recognition.py enroll`
- **TIDAK BISA di-cloud** — harus di mesin yang punya kamera

### 2.5 Supabase Auth — Redirect URL
Fitur Reset Password menggunakan email magic link yang redirect ke:
```
http://localhost:5173/reset-password  ← DEV (lokal)
https://<nama-app>.vercel.app/reset-password  ← PROD (harus ditambahkan)
```
Wajib ditambahkan di: **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**

### 2.6 Frontend Routing (SPA)
React Router DOM menggunakan client-side routing. Saat deploy ke Vercel/Netlify,
refresh halaman (`/alerts`, `/devices`, dll.) akan menghasilkan **404** tanpa konfigurasi
khusus. Solusi: tambah `vercel.json` dengan rewrite rule.

---

## 3. Strategi Deploy Per Komponen

### 3.1 Frontend → Vercel

**Mengapa Vercel?**
- Gratis unlimited untuk static sites & SPA
- Auto-detect Vite + React, zero-config
- Auto-deploy setiap push ke branch `main`
- CDN global, performa sangat baik
- Custom domain gratis (`nama.vercel.app`)

**File yang perlu dibuat:**

#### `frontend/vercel.json`
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
→ Memastikan semua route React tidak 404 saat di-refresh.

**Langkah Deploy Frontend:**
1. Push repo ke GitHub (pastikan `frontend/dist/` masuk `.gitignore`)
2. Buka [vercel.com](https://vercel.com) → New Project → Import GitHub Repo
3. Vercel akan auto-detect Vite. Set:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Tambah Environment Variables di Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_TIMEOUT_MS`
   - `VITE_SITE_URL` → isi dengan URL Vercel setelah dapat
5. Deploy → dapat URL: `https://shelter-monitoring-xxx.vercel.app`
6. Update `VITE_SITE_URL` dengan URL tersebut → Redeploy

---

### 3.2 Bridge (MQTT→Supabase) → Railway

**Mengapa Railway?**
- Mendukung Python worker (bukan web server) — cocok untuk MQTT subscriber
- Auto-deploy dari GitHub
- Gratis trial $5 credit (~500 jam uptime)
- Tidak ada cold-start (tidak seperti Render free tier) — MQTT bridge harus selalu up

> ⚠️ **PENTING**: Render free tier punya cold-start 50 detik setelah idle.
> Ini fatal untuk MQTT subscriber. **Gunakan Railway.**

**File yang perlu dibuat:**

#### `bridge/Procfile`
```
worker: python mqtt_to_supabase.py
```
→ Railway membaca Procfile untuk menentukan command startup.
→ Tipe `worker` artinya proses background, tidak butuh port HTTP.

#### `bridge/runtime.txt`
```
python-3.11.9
```
→ Menentukan versi Python yang digunakan Railway.

**Langkah Deploy Bridge:**
1. Buka [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Pilih repo → Set **Root Directory** ke `bridge`
3. Railway otomatis baca `Procfile` → jalankan `python mqtt_to_supabase.py`
4. Tambah semua Environment Variables di Railway dashboard (sama persis dengan `bridge/.env`)
5. Deploy → cek logs, pastikan: `"Connected to MQTT broker broker.emqx.io:1883"`

---

### 3.3 Face Recognition → Local Service (PC / Raspberry Pi)

**Mengapa Local?**
- Membutuhkan akses kamera fisik (USB webcam / RTSP stream)
- DeepFace + MTCNN terlalu berat untuk free tier cloud
- Latency kamera tidak bisa melalui internet

**File yang perlu dibuat:**

#### `face_recognition/requirements.txt`
```
torch>=2.2.0
torchvision>=0.17.0
opencv-python>=4.9.0
deepface>=0.0.92
mtcnn>=0.1.1
facenet-pytorch>=2.5.3
numpy>=1.26.0
Pillow>=10.2.0
```

#### `face_recognition/start.bat` (Windows)
```bat
@echo off
cd /d %~dp0
call venv\Scripts\activate.bat
echo Memulai Face Recognition...
python src/stage1/webcam_test.py --recognize --cam-index 0
pause
```

#### `face_recognition/start.sh` (Linux / Raspberry Pi)
```bash
#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
echo "Memulai Face Recognition..."
python src/stage1/webcam_test.py --recognize --cam-index 0
```

**Langkah Setup Face Recognition (Pertama Kali):**
1. Pastikan Python 3.10+ terinstall di mesin target
2. Buat venv: `python -m venv venv`
3. Aktifkan venv dan install: `pip install -r requirements.txt`
4. Enroll wajah: `python src/stage2/stage2_face_recognition.py enroll`
5. Jalankan: `start.bat` (Windows) atau `bash start.sh` (Linux)

**Agar Berjalan Otomatis Saat Boot (Windows):**
- Buat Scheduled Task → Trigger: At startup → Action: jalankan `start.bat`
- Atau taruh shortcut `start.bat` di `shell:startup`

**Agar Berjalan Otomatis Saat Boot (Linux/Raspberry Pi):**
```bash
# Edit crontab
crontab -e
# Tambahkan:
@reboot /path/to/face_recognition/start.sh >> /path/to/face_recognition/logs/startup.log 2>&1
```

---

## 4. Konfigurasi Post-Deploy (Checklist Wajib Setelah Deploy)

### 4.1 Update Supabase Auth Redirect URLs
Buka: **Supabase Dashboard → Authentication → URL Configuration**
Tambahkan di **Redirect URLs**:
```
https://<nama-app>.vercel.app/reset-password
```

### 4.2 Update VITE_SITE_URL
Setelah dapat URL Vercel, update di:
1. Vercel dashboard → Environment Variables → `VITE_SITE_URL`
2. Redeploy (Vercel → Deployments → Redeploy)

### 4.3 Verifikasi Model PKL Ada di Repo
```bash
git ls-files vibration_ai/models/
# Harus ada:
# vibration_ai/models/vibration_classifier.pkl
# vibration_ai/models/scaler.pkl
```
Jika belum di-track:
```bash
git add vibration_ai/models/vibration_classifier.pkl
git add vibration_ai/models/scaler.pkl
git commit -m "chore: add AI model files for Railway deploy"
git push
```

### 4.4 Verifikasi .gitignore Tidak Block .pkl
Cek `vibration_ai/` tidak diignore dan `.pkl` tidak dalam `.gitignore`.

---

## 5. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| `.env` ter-commit ke GitHub | Kebocoran kredensial Supabase & Telegram | Cek `.gitignore`, scan dengan `git secrets` |
| `vibration_ai/models/*.pkl` di `.gitignore` | Bridge Railway gagal load model → AI disabled | Pastikan `.pkl` di-track oleh Git |
| Railway free credit habis | Bridge mati → tidak ada data masuk | Monitor usage, upgrade plan jika perlu |
| MQTT broker publik tidak stabil | Data loss, out-of-order delivery | Lihat Lesson Learned di `master_plan.md` §8 |
| Supabase Auth redirect URL lupa diupdate | Reset password gagal di production | Checklist §4.1 wajib dilakukan |
| Face recognition crash di background | Tidak ada deteksi wajah | Setup auto-restart (crontab/scheduled task) |
| Model DeepFace belum di-download | Face recognition gagal start | Jalankan sekali manual, biarkan DeepFace download model |

---

## 6. Ringkasan Platform & Biaya

| Platform | Komponen | Plan | Biaya | Keterangan |
|---|---|---|---|---|
| **Vercel** | Frontend (React Dashboard) | Hobby | **Gratis** | 100GB bandwidth/bln, auto HTTPS, CDN global |
| **Railway** | Bridge Python (MQTT Worker) | Hobby | **$5/bulan** | Worker 24/7, tidak ada cold-start, ~$0.5–1 actual compute |
| **Supabase** | Database + Auth + Realtime | Free Tier | **Gratis** | 500MB DB, 50MB storage, 2 juta baris/bln |
| **Local Machine** | Face Recognition (Kamera) | — | **Gratis** | Hardware sendiri, butuh PC/RPi nyala |
| **Telegram Bot** | Notifikasi Alert | — | **Gratis** | Tidak ada limit pesan |
| **broker.emqx.io** | MQTT Broker | Free | **Gratis** | Max 10 concurrent connections |

**Total biaya bulanan: $5/bulan (~Rp 82.000)** — hanya untuk Railway Hobby plan.

> **Catatan Railway Hobby $5/bln:**
> - $5 adalah biaya langganan plan, bukan hanya credit
> - Actual compute untuk Python worker ringan biasanya hanya $0.50–1/bulan
> - Plan ini memberikan uptime 24/7 tanpa sleep (penting untuk MQTT bridge)
> - Tidak perlu khawatir credit habis seperti free trial

---

## 7. Diagram Deployment Final

```
                        PRODUCTION ARCHITECTURE
                        ========================

  ┌──────────────┐     ┌──────────────────────────────────────────────┐
  │  ESP32 Node  │────►│           broker.emqx.io (MQTT)              │
  │  (Sensor)    │     └──────────────────────┬───────────────────────┘
  └──────────────┘                            │
                                              ▼
  ┌───────────────┐    ┌──────────────────────────────────────────────┐
  │  IP Camera /  │    │         RAILWAY.APP (Cloud Worker)            │
  │  Webcam       │    │  ┌────────────────────────────────────────┐  │
  └───────┬───────┘    │  │  mqtt_to_supabase.py                   │  │
          │            │  │  ├── Sensor data processing             │  │
          │            │  │  ├── AI Vibration Classification        │  │
          │            │  │  │   (vibration_classifier.pkl)        │  │
          │            │  │  └── Telegram Alert                    │  │
          │            │  └────────────────────────────────────────┘  │
          │            └──────────────────────┬───────────────────────┘
          │                                   │
          ▼                                   ▼
  ┌───────────────────────────────────────────────────────────────────┐
  │  LOCAL PC / RASPBERRY PI                                          │
  │  ┌─────────────────────────────────────────────────┐             │
  │  │  face_recognition/                              │             │
  │  │  ├── Stage 1: MTCNN Detection                   │             │
  │  │  └── Stage 2: ArcFace Recognition               │             │
  │  └─────────────────────────────────────────────────┘             │
  └───────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
  ┌───────────────────────────────────────────────────────────────────┐
  │                    SUPABASE (Cloud BaaS)                          │
  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
  │  │  PostgreSQL  │  │     Auth     │  │  Realtime Websocket  │   │
  │  │  - vibration │  │  - Sessions  │  │  - Live data feed    │   │
  │  │  - temp data │  │  - JWT token │  │  - Alert broadcast   │   │
  │  │  - alerts    │  │  - Reset pwd │  │                      │   │
  │  │  - devices   │  │              │  │                      │   │
  │  └──────────────┘  └──────────────┘  └──────────────────────┘   │
  └───────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
  ┌───────────────────────────────────────────────────────────────────┐
  │                    VERCEL (Frontend CDN)                          │
  │  https://<nama-app>.vercel.app                                    │
  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
  │  │  Dashboard   │  │   Alerts     │  │       Devices        │   │
  │  │  - Charts    │  │   - Feed     │  │   - Management       │   │
  │  │  - AI Status │  │   - Ack      │  │   - last_seen        │   │
  │  │  - Risk Level│  │   - Assign   │  │                      │   │
  │  └──────────────┘  └──────────────┘  └──────────────────────┘   │
  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
  │  │  Evidence    │  │    Admin     │  │      Profile         │   │
  │  │  - Snapshots │  │  - Threshold │  │  - Telegram setup    │   │
  │  └──────────────┘  └──────────────┘  └──────────────────────┘   │
  └───────────────────────────────────────────────────────────────────┘
```

---

## 8. Referensi File

| File | Lokasi | Fungsi |
|---|---|---|
| `frontend/vercel.json` | [NEW] | SPA routing fix untuk Vercel |
| `bridge/Procfile` | [NEW] | Railway worker startup command |
| `bridge/runtime.txt` | [NEW] | Python version untuk Railway |
| `bridge/requirements.txt` | [EXISTS] | Python dependencies bridge |
| `face_recognition/requirements.txt` | [NEW] | Python dependencies face recognition |
| `face_recognition/start.bat` | [NEW] | Windows startup script |
| `face_recognition/start.sh` | [NEW] | Linux/RPi startup script |
| `frontend/.env` | [MODIFY] | Update VITE_SITE_URL ke URL Vercel |
| `vibration_ai/models/*.pkl` | [CHECK] | Harus ada di Git untuk Railway |
