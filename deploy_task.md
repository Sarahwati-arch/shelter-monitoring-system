# ✅ Deploy Task: Shelter Monitoring System — Production Checklist

> Task list deployment fullstack per fase. Tandai `[x]` setelah selesai.
> Referensi detail ada di `deploy_plan.md`.

---

## 📋 Status Keseluruhan

| Fase | Deskripsi | Status |
|---|---|---|
| Fase 0 | Pre-Deploy Verification | [ ] |
| Fase 1 | Frontend → Vercel | [ ] |
| Fase 2 | Bridge → Railway | [ ] |
| Fase 3 | Face Recognition → Local Service | [ ] |
| Fase 4 | Post-Deploy Configuration | [ ] |
| Fase 5 | End-to-End Testing | [ ] |

---

## Fase 0: Pre-Deploy Verification (Wajib Sebelum Apapun)

> Pastikan semua syarat ini terpenuhi sebelum mulai deploy.

### 0.1 Verifikasi Git & GitHub
- [x] Repo sudah ada di GitHub (remote `origin` sudah di-set)
- [ ] `git status` bersih — tidak ada file penting yang belum di-commit *(pending commit file-file baru)*
- [x] Cek `.gitignore` tidak memblokir file-file kritis berikut:
  - [x] `vibration_ai/models/vibration_classifier.pkl` → **HARUS ada di Git**
  - [x] `vibration_ai/models/scaler.pkl` → **HARUS ada di Git**
  - [x] `bridge/Procfile` → dibuat, tidak di-ignore
  - [x] `frontend/vercel.json` → dibuat, tidak di-ignore

### 0.2 Verifikasi AI Model Files
- [x] File `vibration_ai/models/vibration_classifier.pkl` sudah ada
- [x] File `vibration_ai/models/scaler.pkl` sudah ada
- [x] Kedua file sudah di-track oleh Git (jalankan: `git ls-files vibration_ai/models/`)
- [x] Jika belum di-track: sudah di-track, tidak perlu action

### 0.3 Verifikasi .env Tidak Ter-commit
- [x] `frontend/.env` ada di `.gitignore` → tidak boleh masuk ke GitHub
- [x] `bridge/.env` ada di `.gitignore` → tidak boleh masuk ke GitHub
- [ ] Catat semua nilai env vars dari kedua file `.env` di tempat aman (password manager / notes private)

### 0.4 Kumpulkan Semua Credentials
Siapkan nilai berikut sebelum mulai deploy:

**Frontend env vars:**
- [ ] `VITE_SUPABASE_URL` = `https://gmkmhgzwdgmtyxnypupu.supabase.co`
- [ ] `VITE_SUPABASE_ANON_KEY` = (dari `frontend/.env`)
- [ ] `VITE_SUPABASE_TIMEOUT_MS` = `20000`
- [ ] `VITE_SITE_URL` = (diisi setelah dapat URL Vercel)

**Bridge env vars:**
- [ ] `MQTT_BROKER` = `broker.emqx.io`
- [ ] `MQTT_PORT` = `1883`
- [ ] `SUPABASE_URL` = `https://gmkmhgzwdgmtyxnypupu.supabase.co`
- [ ] `SUPABASE_SERVICE_KEY` = (dari `bridge/.env`)
- [ ] `BOT_TOKEN` = (dari `bridge/.env`)
- [ ] `CHAT_ID` = (dari `bridge/.env`)

### 0.5 Build Test Lokal (Frontend)
- [x] Jalankan `cd frontend && npm run build` — ✅ sukses, `built in 2.17s`, tidak ada error
- [ ] Preview build: `npm run preview` — buka `localhost:4173`, pastikan tampil normal

---

## Fase 1: Frontend → Vercel

### 1.1 Buat File Konfigurasi Vercel
- [x] Buat file `frontend/vercel.json` dengan isi:
  ```json
  {
    "rewrites": [
      { "source": "/(.*)", "destination": "/index.html" }
    ]
  }
  ```
- [ ] Commit dan push: `git add frontend/vercel.json && git commit -m "feat: add vercel SPA routing config" && git push`

### 1.2 Deploy ke Vercel
- [ ] Buka [vercel.com](https://vercel.com) → Login (bisa pakai GitHub account)
- [ ] Klik **"Add New Project"** → **"Import Git Repository"**
- [ ] Pilih repo `shelter-monitoring-system`
- [ ] Di bagian **Configure Project**, set:
  - [ ] **Root Directory** → klik "Edit" → isi `frontend`
  - [ ] **Framework Preset** → Vite (auto-detected)
  - [ ] **Build Command** → `npm run build` (default sudah benar)
  - [ ] **Output Directory** → `dist` (default sudah benar)
- [ ] Di bagian **Environment Variables**, tambahkan semua:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
  - [ ] `VITE_SUPABASE_TIMEOUT_MS`
  - [ ] `VITE_SITE_URL` → isi sementara dengan `http://localhost:5173` (akan diupdate)
- [ ] Klik **Deploy**
- [ ] Tunggu build selesai (~2-3 menit)
- [ ] Catat URL yang diberikan Vercel (contoh: `https://shelter-monitoring-abc123.vercel.app`)

### 1.3 Update VITE_SITE_URL dengan URL Asli
- [ ] Buka Vercel dashboard → Project → **Settings** → **Environment Variables**
- [ ] Edit `VITE_SITE_URL` → ganti dengan URL Vercel yang baru didapat
  - Contoh: `https://shelter-monitoring-abc123.vercel.app`
- [ ] Klik **Save**
- [ ] Pergi ke **Deployments** → klik titik 3 pada deployment terakhir → **Redeploy**

### 1.4 Verifikasi Frontend
- [ ] Buka URL Vercel di browser
- [ ] Halaman **Login** muncul dengan normal (tidak blank/error)
- [ ] Login menggunakan akun yang sudah ada → masuk ke Dashboard
- [ ] Navigasi ke `/alerts` → **tidak 404** (routing fix berhasil)
- [ ] Navigasi ke `/devices` → **tidak 404**
- [ ] Data real-time muncul di chart Dashboard
- [ ] Console browser tidak ada error merah

---

## Fase 2: Bridge (MQTT→Supabase) → Railway

### 2.1 Buat File Konfigurasi Railway
- [x] Buat file `bridge/Procfile` dengan isi:
  ```
  worker: python mqtt_to_supabase.py
  ```
- [x] Buat file `bridge/runtime.txt` dengan isi:
  ```
  python-3.11.9
  ```
- [ ] Commit dan push:
  ```bash
  git add bridge/Procfile bridge/runtime.txt
  git commit -m "feat: add Railway deploy config for bridge"
  git push
  ```

### 2.2 Verifikasi `bridge/requirements.txt`
- [x] Pastikan file `bridge/requirements.txt` sudah include semua dependency:
  ```
  paho-mqtt==2.1.0
  supabase==2.13.0
  python-dotenv==1.1.0
  scikit-learn
  librosa
  numpy
  joblib
  requests
  scipy
  ```
- [x] `scipy` ditambahkan ke `bridge/requirements.txt`

### 2.3 Deploy ke Railway
- [ ] Buka [railway.app](https://railway.app) → Login (bisa pakai GitHub)
- [ ] Klik **"New Project"** → **"Deploy from GitHub repo"**
- [ ] Pilih repo `shelter-monitoring-system`
- [ ] Setelah project dibuat, klik pada service yang muncul → **Settings**
- [ ] Set **Root Directory** → `bridge`
- [ ] Railway akan otomatis baca `Procfile` dan jalankan `python mqtt_to_supabase.py`
- [ ] Pergi ke tab **Variables** → tambahkan semua env vars:
  - [ ] `MQTT_BROKER` = `broker.emqx.io`
  - [ ] `MQTT_PORT` = `1883`
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_KEY`
  - [ ] `BOT_TOKEN`
  - [ ] `CHAT_ID`
- [ ] Klik **Deploy** → tunggu build selesai (~3-5 menit, pip install banyak)

### 2.4 Verifikasi Bridge
- [ ] Buka tab **Logs** di Railway
- [ ] Pastikan log menampilkan:
  - [ ] `Loading AI Model and Scaler...`
  - [ ] `AI Model loaded successfully.`
  - [ ] `Connecting to broker.emqx.io:1883 ...`
  - [ ] `Connected to MQTT broker broker.emqx.io:1883`
  - [ ] `Subscribed to: +/Accel, +/Gyro, +/Temp`
- [ ] Jika log menampilkan error model tidak ditemukan:
  - [ ] Cek apakah `.pkl` files sudah di-push ke GitHub
  - [ ] Cek Railway sudah pull commit terbaru (trigger redeploy jika perlu)
- [ ] Jalankan simulator lokal untuk test: `cd bridge && python simulator_direct.py`
- [ ] Cek logs Railway → data masuk dan ter-insert ke Supabase
- [ ] Buka Frontend di Vercel → data baru muncul di Dashboard

---

## Fase 3: Face Recognition → Local Service

### 3.1 Buat File Requirements Face Recognition
- [x] Buat file `face_recognition/requirements.txt` dengan isi:
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

### 3.2 Buat Startup Scripts
- [x] Buat `face_recognition/start.bat` (untuk Windows):
  ```bat
  @echo off
  cd /d %~dp0
  call venv\Scripts\activate.bat
  echo ============================================
  echo  Shelter Monitoring - Face Recognition
  echo ============================================
  echo.
  echo Memastikan wajah sudah di-enroll...
  python src/stage2/stage2_face_recognition.py diagnose
  echo.
  echo Memulai face recognition...
  python src/stage1/webcam_test.py --recognize --cam-index 0
  pause
  ```
- [x] Buat `face_recognition/start.sh` (untuk Linux / Raspberry Pi):
  ```bash
  #!/bin/bash
  cd "$(dirname "$0")"
  source venv/bin/activate
  echo "============================================"
  echo " Shelter Monitoring - Face Recognition"
  echo "============================================"
  echo ""
  echo "Memastikan wajah sudah di-enroll..."
  python src/stage2/stage2_face_recognition.py diagnose
  echo ""
  echo "Memulai face recognition..."
  python src/stage1/webcam_test.py --recognize --cam-index 0
  ```
- [ ] Commit dan push semua file baru

### 3.3 Setup Environment di Mesin Target
- [ ] Pastikan Python 3.10+ terinstall di mesin target (PC / Raspberry Pi)
- [ ] Buat virtual environment di dalam folder `face_recognition`:
  ```bash
  cd face_recognition
  python -m venv venv
  ```
- [ ] Aktifkan venv:
  - Windows: `venv\Scripts\activate`
  - Linux: `source venv/bin/activate`
- [ ] Install semua dependencies:
  ```bash
  pip install -r requirements.txt
  ```
  *(proses ini lama — torch + deepface besar, bisa 10-30 menit)*
- [ ] Verifikasi instalasi:
  ```bash
  python -c "import cv2, mtcnn, deepface; print('OK')"
  ```

### 3.4 Enroll Wajah (Jika Belum)
- [ ] Pastikan folder `face_recognition/data/faces/` sudah berisi subfolder per orang
  - Contoh: `data/faces/sarah/`, `data/faces/nanda/`
  - Minimal 5 foto per orang (`.jpg` / `.png`)
- [ ] Jalankan enrollment:
  ```bash
  cd face_recognition
  python src/stage2/stage2_face_recognition.py enroll
  ```
- [ ] Pastikan output: `Embeddings saved → models/embeddings.npy`
- [ ] Verifikasi dengan diagnostics:
  ```bash
  python src/stage2/stage2_face_recognition.py diagnose
  ```

### 3.5 Uji Coba Face Recognition
- [ ] Hubungkan webcam ke mesin target
- [ ] Jalankan dengan script startup:
  - Windows: double-click `start.bat`
  - Linux: `bash start.sh`
- [ ] Window OpenCV terbuka → kamera tampil ✅
- [ ] Wajah yang dikenal → label nama muncul (kotak oranye) ✅
- [ ] Wajah tidak dikenal → label `UNKNOWN` muncul (kotak merah) ✅
- [ ] Tekan `Q` untuk keluar

### 3.6 Setup Auto-Start (Opsional tapi Dianjurkan)
**Windows — Scheduled Task:**
- [ ] Buka **Task Scheduler** → Create Basic Task
- [ ] Trigger: **When the computer starts**
- [ ] Action: **Start a program** → browse ke `start.bat`
- [ ] Centang: **Run whether user is logged on or not** (headless tidak bisa untuk GUI OpenCV)
- [ ] Simpan task

**Linux / Raspberry Pi — crontab:**
- [ ] Edit crontab: `crontab -e`
- [ ] Tambahkan:
  ```
  @reboot sleep 30 && /path/to/face_recognition/start.sh >> /path/to/face_recognition/logs/startup.log 2>&1
  ```
- [ ] `sleep 30` untuk beri waktu OS selesai boot sebelum kamera siap

---

## Fase 4: Post-Deploy Configuration (Supabase)

### 4.1 Update Redirect URLs di Supabase
- [ ] Buka [supabase.com](https://supabase.com) → masuk ke project
- [ ] Pergi ke **Authentication** → **URL Configuration**
- [ ] Di bagian **Redirect URLs**, klik **Add URL** → tambahkan:
  ```
  https://<nama-app>.vercel.app/reset-password
  ```
- [ ] Klik **Save**

### 4.2 Update Site URL di Supabase
- [ ] Di halaman yang sama, ubah **Site URL** dari `http://localhost:5173` ke:
  ```
  https://<nama-app>.vercel.app
  ```
- [ ] Klik **Save**

### 4.3 Verifikasi Reset Password (End-to-End)
- [ ] Buka Frontend Vercel → halaman Login
- [ ] Klik **Lupa Password** / **Reset Password**
- [ ] Masukkan email → kirim
- [ ] Buka email → klik link reset → pastikan redirect ke URL Vercel (bukan localhost)
- [ ] Halaman reset password muncul dengan normal

---

## Fase 5: End-to-End Testing

### 5.1 Test Data Flow (Sensor → Database → Dashboard)
- [ ] Jalankan simulator lokal (bukan di Railway, tapi di PC):
  ```bash
  cd bridge
  python simulator_direct.py
  ```
- [ ] Buka Frontend Vercel di browser
- [ ] Data baru muncul di Dashboard chart dalam ~5 detik ✅
- [ ] Alert muncul di halaman Alerts jika risk level high ✅

### 5.2 Test Telegram Alert
- [ ] Dari simulator_direct.py, pastikan data yang dikirim memiliki risk level `high`
- [ ] Cek apakah Telegram bot mengirimkan pesan ke chat yang terdaftar
- [ ] Jika tidak ada pesan: cek logs Railway → pastikan `BOT_TOKEN` dan `CHAT_ID` benar

### 5.3 Test Authentication
- [ ] Login dengan akun yang ada → berhasil masuk Dashboard ✅
- [ ] Logout → redirect ke halaman Login ✅
- [ ] Akses `/dashboard` tanpa login → redirect ke `/login` ✅
- [ ] Reset password end-to-end (lihat Fase 4.3) ✅

### 5.4 Test Routing (SPA Fix)
- [ ] Buka `https://<nama-app>.vercel.app/alerts` langsung → **tidak 404** ✅
- [ ] Buka `https://<nama-app>.vercel.app/devices` langsung → **tidak 404** ✅
- [ ] Refresh halaman saat berada di `/alerts` → **tetap di halaman alerts** ✅

### 5.5 Test Face Recognition (Local)
- [ ] Face recognition berjalan di mesin lokal
- [ ] Tampilkan wajah yang dikenal → label nama muncul ✅
- [ ] Tampilkan wajah tidak dikenal → label UNKNOWN ✅
- [ ] Log tersimpan di `face_recognition/logs/` ✅

### 5.6 Final Health Check
- [ ] Frontend (Vercel): URL publik bisa diakses dari HP / device lain ✅
- [ ] Bridge (Railway): Logs Railway aktif, tidak ada crash ✅
- [ ] Database (Supabase): Data terus masuk setiap beberapa detik ✅
- [ ] Face Recognition: Berjalan di mesin lokal ✅
- [ ] Telegram: Alert terkirim saat threshold terlampaui ✅

---

## 🎉 Deployment Selesai!

Setelah semua fase selesai, sistem dapat diakses di:
- **Dashboard**: `https://<nama-app>.vercel.app`
- **Bridge Worker**: Berjalan di Railway (24/7)
- **Face Recognition**: Berjalan di mesin lokal (selalu nyala)
- **Database**: Supabase cloud (selalu tersedia)

> Untuk troubleshooting dan detail teknis, lihat `deploy_plan.md`.
> Untuk dokumentasi AI Vibration, lihat `master_plan.md`.
