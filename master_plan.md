# 🤖 Master Plan: AI Vibration Cause Detection

> Plan implementasi sistem klasifikasi penyebab getaran (vibration cause detection)
> menggunakan Machine Learning untuk Shelter Monitoring System.

---

## 1. Aliran Data (Data Flow)

```
┌───────────────────────┐
│  DATA LATIH LOKAL     │  vibration_ai/class_0 ~ class_4 (.wav + .json)
│  (5 kelas, ±200 file) │
└──────────┬────────────┘
           ▼
┌───────────────────────┐
│  FEATURE EXTRACTION   │  vibration_ai/1_feature_extractor.py
│  (Fitur Statistik     │  Extract: mean, std, rms, zcr, kurtosis,
│   Domain-Agnostic)    │  skewness, crest_factor, energy, range, dll.
└──────────┬────────────┘
           ▼
┌───────────────────────┐
│  MODEL TRAINING       │  vibration_ai/2_model_trainer.py
│  (Random Forest)      │  Train → Evaluate → Save .pkl
└──────────┬────────────┘
           ▼
┌───────────────────────┐
│  MODEL MATANG         │  vibration_ai/models/vibration_classifier.pkl
│  (.pkl files)         │  + scaler.pkl
└──────────┬────────────┘
           ▼
┌───────────────────────┐
│  INFERENCE ENGINE     │  bridge/mqtt_to_supabase.py
│  (Real-time)          │  Buffer N reading → extract fitur SAMA
│                       │  → predict class → simpan ke Supabase
└──────────┬────────────┘
           ▼
┌───────────────────────┐
│  SUPABASE DB          │  vibration_data.metadata → hasil prediksi
└──────────┬────────────┘
           ▼
┌───────────────────────┐
│  DASHBOARD WEB        │  Label penyebab, confidence, risk level AI
└───────────────────────┘
```

---

## 2. Pendekatan: Satu Model, Fitur Statistik Domain-Agnostic

### Mengapa?

Dataset training (.wav audio) dan data sensor real-time (MPU6050 accel/gyro)
berasal dari sumber yang berbeda. Fitur audio-specific seperti MFCC tidak bisa
dihitung dari 6 angka akselerometer.

**Solusi**: Gunakan hanya fitur **statistik** yang bisa di-extract dari sinyal
apapun — baik waveform audio (.wav) maupun window data sensor numerik.

### Fitur yang Digunakan (Domain-Agnostic)

| # | Fitur | Rumus/Deskripsi |
|---|-------|-----------------|
| 1 | `mean` | Rata-rata amplitudo |
| 2 | `std` | Standar deviasi |
| 3 | `rms` | Root Mean Square — `√(Σx²/N)` |
| 4 | `energy` | Rata-rata kuadrat — `Σx²/N` |
| 5 | `zcr` | Zero Crossing Rate — seberapa sering sinyal melewati nol |
| 6 | `skewness` | Kemiringan distribusi |
| 7 | `kurtosis` | Ketajaman puncak distribusi |
| 8 | `crest_factor` | Peak / RMS ratio |
| 9 | `min` | Nilai minimum |
| 10 | `max` | Nilai maksimum |
| 11 | `range` | max − min |
| 12 | `median` | Nilai tengah |
| 13 | `iqr` | Interquartile Range (Q75 − Q25) |
| 14 | `mad` | Median Absolute Deviation |

> **Keuntungan**: Fitur yang sama persis bisa di-extract dari .wav (training)
> maupun dari windowed sensor data (inference). Methodology konsisten
> dan bisa dipertanggungjawabkan secara akademis.

---

## 3. Klasifikasi Getaran (5 Kelas)

| Class | Folder Dataset | Label | Risk Level |
|-------|----------------|-------|------------|
| 0 | `class_0_normal_AC` | Normal | Low |
| 1 | `class_1_foot_steps` | Foot Steps | Low |
| 2 | `class_2_sabotase_maint` | Sabotase / Maintenance | High |
| 3 | `class_3_vehicle` | Vehicle | Medium |
| 4 | `class_4_earthquake` | Earthquake | Critical |

### Dataset Status

| Class | Sumber | Format | Catatan |
|-------|--------|--------|---------|
| 0 — Normal AC | 40 file | `.wav` (~690 KB/file) | Audio getaran AC normal |
| 1 — Foot Steps | 40 file | `.wav` (~431 KB/file) | Audio langkah kaki |
| 2 — Sabotase/Maint | 40 file | `.wav` (690 KB–2.2 MB) | Audio sabotase/maintenance |
| 3 — Vehicle | 40 file | `.wav` (~690 KB/file) | Audio kendaraan |
| 4 — Earthquake | 1 file | `.json` (~3.4 MB) | **Data seismik pre-extracted** |

### ⚠️ Penanganan Class 4 (Earthquake)

File `intermediate_train_w_150000_s_150000.json` berisi **ribuan segment**
data seismik yang sudah di-extract fiturnya. Setiap segment memiliki:
- `features`: objek dengan fitur statistik (mean, std, rms, zcr, kurtosis, dll.)
- `y`: nilai kontinu (kemungkinan magnitude gempa, **bukan label kelas**)

**Yang perlu dilakukan:**
1. Semua segment dari file ini = Class 4 (earthquake)
2. **Downsample** ke ~40 segment (random sampling) agar seimbang dengan class lain
3. Map fitur yang ada ke format 14 fitur yang sama
4. Abaikan field `y` — kita hanya butuh fiturnya, label = 4 (earthquake)

---

## 4. Contoh Output (Apa yang Dihasilkan Sistem)

### A. Output Training (Fase 3) — File di Disk

```
vibration_ai/models/
├── vibration_classifier.pkl    # Model Random Forest
├── scaler.pkl                  # StandardScaler untuk normalisasi
└── evaluation_report.txt       # Hasil evaluasi
```

Isi `evaluation_report.txt`:
```
Accuracy: 0.88 (88%)

Classification Report:
                     precision  recall  f1-score  support
Normal               0.90      0.85    0.87      8
Foot Steps           0.82      0.88    0.85      8
Sabotase/Maint       0.91      0.95    0.93      8
Vehicle              0.86      0.82    0.84      8
Earthquake           0.95      0.90    0.92      8

Confusion Matrix:
              Normal  Foot  Sabo  Vehicle  Quake
Normal        [  7     1     0      0       0  ]
Foot Steps    [  1     7     0      0       0  ]
Sabotase      [  0     0     8      0       0  ]
Vehicle       [  0     1     0      7       0  ]
Earthquake    [  0     0     0      1       7  ]
```

### B. Output Real-time (Fase 4) — Console Bridge

```
[tok_esp32_vib_alpha_001/Accel] {"accel_x": 1.15, "accel_y": -1.56, "accel_z": -0.78}
[tok_esp32_vib_alpha_001/Gyro]  {"gyro_x": -4.20, "gyro_y": 12.30, "gyro_z": -2.10}
  -> Buffered reading 47/50 for device e5f6a7b8...
  -> Buffered reading 48/50 for device e5f6a7b8...
  -> Buffered reading 49/50 for device e5f6a7b8...
  -> Buffered reading 50/50 for device e5f6a7b8...
  -> AI Window complete! Extracting features...
  -> AI Prediction: class=2 label=sabotase_maint confidence=87.3% risk=high
  -> Inserted | shelter=a1b2c3d4 | device=e5f6a7b8 | risk=high (AI)
  -> ALERT created: AI detected sabotase_maint (87.3% confidence)
  -> [TG] Alert sent.
```

### C. Output Database (Supabase `vibration_data`)

Setiap kali window penuh, insert 1 row dengan metadata AI:

```json
{
  "data_id": "uuid-xxx",
  "shelter_id": "a1b2c3d4-e5f6-...",
  "device_id": "e5f6a7b8-c9d0-...",
  "accel_x": 1.15,
  "accel_y": -1.56,
  "accel_z": -0.78,
  "gyro_x": -4.20,
  "gyro_y": 12.30,
  "gyro_z": -2.10,
  "risk_level": "high",
  "metadata": {
    "ai_class": 2,
    "ai_label": "sabotase_maint",
    "ai_confidence": 0.873,
    "ai_risk": "high",
    "ai_window_size": 50,
    "model_version": "v1.0"
  },
  "timestamp": "2026-05-29T12:01:03+07:00"
}
```

### D. Output Dashboard (Fase 5) — Yang Dilihat User

```
╔══════════════════════════════════════════════════╗
║  🔴 VIBRATION ALERT — Shelter Jakarta Timur      ║
║                                                   ║
║  Penyebab:    Sabotase / Maintenance              ║
║  Confidence:  87%  ████████░░                     ║
║  Risk Level:  HIGH                                ║
║  Waktu:       29 Mei 2026, 12:01:03 WIB          ║
║                                                   ║
║  [Lihat Detail]  [Acknowledge]  [Assign Teknisi]  ║
╚══════════════════════════════════════════════════╝

Dashboard Widget:
┌─────────────────────────┐  ┌─────────────────────────┐
│  🟢 Getaran Terakhir    │  │  📊 Distribusi Prediksi  │
│                         │  │                          │
│  Status: Normal         │  │  Normal    ████████  45% │
│  Confidence: 94%        │  │  Foot Step ███       15% │
│  Risk: LOW              │  │  Sabotase  ██        10% │
│  Updated: 12:05:30 WIB  │  │  Vehicle   ████      20% │
│                         │  │  Earthquake █         5% │
└─────────────────────────┘  └─────────────────────────┘
```

**UI Behavior Mechanics (How it updates when the next 50 data points come in):**
1. **The Detected Class (Top Section) will REPLACE / CHANGE**: The big text at the top (e.g., "Vehicle") always displays the absolute latest prediction. When the bridge receives the next 50 data points, the buffer resets, the AI makes a brand new prediction based only on those new 50 points, and the UI text will immediately change to reflect this new result.
2. **The Class Distribution Chart (Bottom Section) will ADD UP**: The donut chart at the bottom acts as a historical log. It looks at all the predictions made within your selected time range (e.g., the last 6 hours). So, if the previous 50 data points resulted in "Vehicle", and the next 50 data points result in "Earthquake", the chart will add them up and show both pieces of the pie (1 Vehicle, 1 Earthquake). Essentially, the top is your real-time status, and the bottom chart is your historical tally!

---

## 5. Logika Fallback (Confidence Rendah)

Jika AI confidence **< 60%**, hasil prediksi tidak reliable. Sistem perlu fallback:

```
Data sensor masuk → AI predict
  │
  ├─ confidence ≥ 60% → PAKAI hasil AI (label, risk level)
  │                      Simpan ke metadata, update risk_level
  │
  └─ confidence < 60% → FALLBACK ke threshold-based
                         risk_level = hitung dari magnitude (seperti sekarang)
                         metadata.ai_confidence = rendah
                         metadata.ai_fallback = true
```

**Contoh metadata saat fallback:**
```json
{
  "ai_class": 1,
  "ai_label": "foot_steps",
  "ai_confidence": 0.43,
  "ai_risk": "low",
  "ai_fallback": true,
  "fallback_reason": "confidence_below_threshold",
  "model_version": "v1.0"
}
```

Risk level tetap pakai kalkulasi magnitude (threshold-based), bukan dari AI.

---

## 6. Breakdown Fase Eksekusi

### Fase 1: Penyesuaian Lingkungan ✅

- [ ] Install library ML ke `bridge/requirements.txt`:
  ```
  scikit-learn>=1.5.0
  librosa>=0.10.0
  joblib>=1.4.0
  numpy>=1.26.0
  soundfile>=0.12.0
  ```
- [ ] Install ke venv:
  ```bash
  cd bridge
  .\venv\Scripts\activate
  pip install -r requirements.txt
  ```
- [ ] Buat folder output: `vibration_ai/models/`

---

### Fase 2: Feature Extraction dari Dataset ✅

**File**: `vibration_ai/1_feature_extractor.py`

**Proses:**
1. **Class 0–3** (dari .wav):
   - Load setiap `.wav` dengan `librosa.load()`
   - Dari raw waveform (array 1D), hitung 14 fitur statistik
   - Hasilkan 1 vektor fitur per file → 40 sample per class
2. **Class 4** (dari .json):
   - Load `intermediate_train_w_150000_s_150000.json`
   - Setiap segment sudah punya fitur (mean, std, rms, zcr, dll.)
   - Map ke format 14 fitur yang sama, abaikan field `y`
   - **Random sample 40 segment** agar seimbang dengan class lain
3. Gabungkan semua → simpan:
   - `vibration_ai/features_X.npy` — matriks fitur (200 × 14)
   - `vibration_ai/features_y.npy` — label kelas (200,)

---

### Fase 3: Model Training & Evaluasi ✅

**File**: `vibration_ai/2_model_trainer.py`

**Proses:**
1. Load `features_X.npy` dan `features_y.npy`
2. Split: 80% train / 20% test (stratified)
3. Normalisasi fitur → `StandardScaler`
4. Train `RandomForestClassifier(n_estimators=100, random_state=42)`
5. Evaluasi → accuracy, confusion matrix, classification report
6. Simpan:
   - `vibration_ai/models/vibration_classifier.pkl`
   - `vibration_ai/models/scaler.pkl`
   - `vibration_ai/models/evaluation_report.txt`

**Target**: ≥ 85% accuracy.
**Jika < 85%**: Coba XGBoost/SVM, tuning hyperparameter, atau augmentasi data.

---

### Fase 4: Integrasi Inferensi ke Bridge ✅

**File**: `bridge/mqtt_to_supabase.py` (modifikasi)

**Windowed Buffer — arsitektur baru:**

Saat ini bridge langsung insert per 1 pair accel+gyro. Untuk AI, perlu
kumpulkan **N reading** dulu (sliding window) baru extract fitur & predict.

```
Reading 1 ─┐
Reading 2  ─┤
  ...       ├── Window (N=50) ──→ Extract 14 fitur ──→ model.predict()
Reading N ─┘
```

**Implementasi:**
1. **Saat startup**: Load `.pkl` model + scaler
2. **Tambah window buffer** per device:
   - Setiap accel+gyro masuk → hitung magnitude `√(ax² + ay² + az²)`
   - Simpan magnitude ke array buffer
   - Jika buffer penuh (N=50):
     - Extract 14 fitur statistik dari array magnitude
     - `scaler.transform()` → `model.predict()` + `model.predict_proba()`
     - Cek confidence ≥ 60%? → pakai AI risk : fallback threshold
     - Insert ke Supabase dengan metadata AI
     - Reset buffer
3. **Data insert tetap berjalan** per reading (seperti sekarang) — AI hanya
   menambahkan metadata di reading terakhir setiap window
4. **Notifikasi Telegram**: Mengirimkan peringatan dini melalui bot API jika risk level `high` atau `critical`.

---

### Fase 5: Integrasi Dashboard ✅

**Perubahan di frontend React:**

1. **Dashboard** — Tambah widget:
   - Status getaran terakhir + label AI (Normal / Sabotase / dll.)
   - Confidence bar (persentase)
   - AI risk level badge
   - Indicator jika fallback aktif
2. **Alert feed** — Tampilkan AI label di setiap alert vibrasi
3. **Trend chart** — Distribusi class prediksi selama 24 jam terakhir

**Query data:**
```javascript
const { data } = await supabase
  .from('vibration_data')
  .select('*, metadata')
  .eq('shelter_id', shelterId)
  .not('metadata->ai_class', 'is', null)
  .order('timestamp', { ascending: false })
  .limit(20)
```

---

### Fase 6: Collect & Label Data Sensor Fisik ⬜

> **Dilakukan TERAKHIR** setelah pipeline AI jalan end-to-end.
> Tujuan: validasi dan tingkatkan akurasi dengan data dunia nyata.

**Proses:**
1. Colokkan sensor MPU6050 ke ESP32, pastikan data masuk ke bridge
2. Simulasikan tiap skenario dan catat label:
   - Class 0: Sensor idle di dekat AC / kondisi normal
   - Class 1: Jalan kaki di dekat sensor
   - Class 2: Goyangkan/ketuk shelter secara sengaja
   - Class 3: Lewatkan kendaraan di dekat sensor
   - Class 4: Getarkan sensor dengan kuat (simulasi gempa)
3. Record window data dari bridge → label manual → simpan ke CSV/NPY
4. Retrain model dengan data gabungan (.wav + sensor fisik)
5. Evaluasi ulang → bandingkan akurasi sebelum/sesudah

**Target**: ≥ 50 window per class dari sensor fisik.

---

## 7. Urutan Kerja (Summary)

```
 SEKARANG                                             NANTI
    │                                                    │
    ▼                                                    ▼
┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
│ Fase 1 │─▶│ Fase 2 │─▶│ Fase 3 │─▶│ Fase 4 │─▶│ Fase 5 │─▶│ Fase 6 │
│ Setup  │  │Extract │  │ Train  │  │Inferensi│  │Dashboard│  │Sensor  │
│  Env   │  │ Fitur  │  │ Model  │  │ Bridge │  │  Web   │  │ Fisik  │
└────────┘  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘
              .wav          .pkl      windowed    tampilkan   collect
             + .json       output     buffer     hasil AI    & retrain
                                    + fallback
```

---

## 8. Lesson Learned & Praktik Terbaik (Dari Simulasi AI)

Selama menjalankan simulasi *end-to-end* (Fase 5.5), kita menemukan beberapa teori teknis penting yang harus diperhatikan saat sistem berjalan di lapangan:

1. **Sensitivitas Model ML terhadap Random Noise**: 
   Model Random Forest yang dilatih menggunakan data getaran dunia nyata sangat sensitif. Jika kita menguji sistem menggunakan angka acak murni (seperti `np.random.uniform`), AI akan kebingungan dan membuahkan tingkat *confidence* yang rendah (<60%), yang memicu status "Unknown". Untuk simulasi yang akurat, data yang ditembakkan harus memiliki pola distribusi khusus (misal: *Gaussian Noise* terkalibrasi) atau memutar ulang rekaman sensor asli.
2. **Limitasi Broker MQTT Publik (Out-of-Order Delivery)**:
   Broker publik (seperti `broker.emqx.io`) sering mengalami *delay* dan *message batching*. Karena sistem *bridge* kita mengandalkan kedatangan data *Accel* dan *Gyro* secara berpasangan dan berurutan untuk mengisi *buffer* `N=50`, pengiriman pesan yang *out-of-order* akan merusak logika *cache* dan menyebabkan lebih dari 60% data terbuang (*dropped*). **Solusi Produksi**: Gunakan broker MQTT *private* (seperti Mosquitto lokal) atau terapkan QoS 1/2 dengan *timestamp* internal di *payload* agar *bridge* bisa menyusun ulang data yang acak.
3. **Strategi Caching Metadata AI (Bridge)**:
   AI hanya melakukan prediksi setiap kali *buffer window* penuh (setiap 50 data). Namun, sensor terus mengirimkan data individu ke *database*. Agar UI Dashboard tidak berkedip atau menunjukkan data kosong pada 49 baris lainnya, *bridge* harus menyimpan hasil prediksi terakhir (`_last_ai_metadata`) dan melampirkannya ke setiap baris *database* yang baru dimasukkan sampai siklus *window* berikutnya selesai.
4. **Penggabungan Data Asinkron di Frontend**:
   Data Suhu (*Temperature*) dan Getaran (*Vibration*) seringkali masuk dengan *timestamp* yang tidak sinkron sempurna di skala detik. *Frontend* tidak boleh menggunakan `Array.map` dengan `find` yang kaku (`===`). Alih-alih, gunakan objek `historyMap` sebagai kamus untuk menambal data yang bolong secara dinamis, sehingga grafik tetap utuh meskipun salah satu sensor mati atau terlambat.

### Panduan Cepat Menjalankan Simulasi (Demo UI)

Jika ingin melakukan demonstrasi antarmuka tanpa alat fisik, pastikan `bridge/mqtt_to_supabase.py` selalu menyala di *background*, lalu jalankan salah satu skrip berikut:
- **`python simulator.py`**: Simulasi acak natural (via MQTT publik). Karena sifatnya sangat acak, AI kadang mengeluarkan status *Unknown* (<60%).
- **`python simulator_direct.py`** *(Sangat Disarankan)*: Memintas *broker* MQTT dan langsung menyuntikkan data bersih (bukan acak murni) ke Supabase. 100% dijamin memunculkan peringatan getaran *Vehicle* pada antarmuka *Dashboard*.
- **`python simulator_guaranteed.py`**: Pengujian *Gaussian noise* yang dikirim dengan perlahan via MQTT agar tidak terpotong (meniru transmisi stabil).

---

## 9. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Dataset kecil (~40/class) | Augmentasi: time shift, noise injection, pitch shift |
| Class 4 imbalanced (ribuan segment) | Downsample ke ~40 segment (random sampling) |
| Class 4 format beda (.json vs .wav) | Map fitur ke format 14 fitur yang sama |
| Window size belum optimal | Eksperimen: N=30, 50, 100 → pilih akurasi terbaik |
| Akurasi < 85% | Coba XGBoost/SVM, tuning hyperparameter, tambah fitur |
| Confidence rendah pada data real | Fallback ke threshold-based (magnitude) |
| Sensor fisik beda karakteristik dari .wav | Fase 6: retrain dengan data sensor asli |