Kamu adalah senior ai software engineer. 

🗒️ AI Vibration Cause Detection: Detailed Task Plan📁 

Fase 1: Penyesuaian Lingkungan & Inisialisasi Struktur
Tujuan: Memastikan workspace siap dan dependensi terinstall tanpa konflik.

[x] 1.1 Perbarui file bridge/requirements.txt dengan library ML yang sesuai spesifikasi.
[x] 1.2 Jalankan virtual environment (venv) dan lakukan instalasi dependensi (pip install -r requirements.txt).
    *(Catatan: Karena venv di-ignore, wajib membuat venv dan install requirements tiap kali clone repo baru)*
[x] 1.3 Buat struktur direktori untuk penyimpanan model: vibration_ai/models/.
[x] 1.4 Buat file placeholder untuk script utama:
[x] vibration_ai/1_feature_extractor.py
[x] vibration_ai/2_model_trainer.py
[x] 1.5 Lakukan verifikasi instalasi dengan script pengecekan versi library (pastikan scikit-learn dan librosa terbaca).


📊 Fase 2: Feature Extraction dari Dataset (Audio & JSON)
Tujuan: Mengubah data mentah heterogen menjadi matriks fitur numerik homogen (200 × 14).

[x] 2.1 Amankan dataset lokal dan pastikan folder class_0 hingga class_4 berada di jalur yang benar.
[x] 2.2 Tulis fungsi ekstraktor 14 fitur statistik dasar di 1_feature_extractor.py (Input: 1D array/signal $\rightarrow$ Output: 14 fitur).
[x] 2.3 Pipeline Class 0–3 (Audio):
[x] Implementasikan fungsi librosa.load() untuk membaca .wav.[x] Loop semua file di folder class_0 sampai class_3.
[x] Ekstrak 14 fitur per file dan simpan ke array sementara.
[x] 2.4 Pipeline Class 4 (Earthquake JSON):
[x] Buka dan parsing intermediate_train_w_150000_s_150000.json.
[x] Lakukan random sampling secara programatik untuk mengambil tepat 40 segmen.
[x] Mapping nama fitur dari JSON ke format 14 fitur statistik standar.
[x] 2.5 Gabungkan data fitur ($X$) dan label ($y$) dari semua kelas.
[x] 2.6 Simpan hasil ekstraksi menjadi file biner numpy: features_X.npy dan features_y.npy.


🤖 Fase 3: Model Training & Evaluasi Pipeline
Tujuan: Melatih model Random Forest dan menghasilkan artefak model yang matang.

[x] 3.1 Setup pemisahan data di 2_model_trainer.py menggunakan train_test_split (80:20) dengan parameter stratify=y agar proporsi kelas seimbang.
[x] 3.2 Inisialisasi dan fit data training menggunakan StandardScaler. Simpan konfigurasi scaler ke scaler.pkl.
[x] 3.3 Inisialisasi model RandomForestClassifier(n_estimators=100, random_state=42) dan lakukan training (.fit()).
[x] 3.4 Lakukan prediksi pada data test untuk kebutuhan evaluasi.[x] 3.5 Hitung metrik performa: Accuracy, Classification Report (Precision, Recall, F1-Score), dan Confusion Matrix.
[x] 3.6 Buat logika otomatis: Jika Akurasi < 85%, cetak warning untuk tuning/hyperparameter adjustment.
[x] 3.7 Ekspor file matang ke vibration_ai/models/:
[x] vibration_classifier.pkl
[x] scaler.pkl
[x] evaluation_report.txt


🔌 Fase 4: Integrasi Inferensi ke Bridge (MQTT to Supabase)
Tujuan: Memasang sistem sliding window buffer dan mesin inferensi real-time.

[x] 4.1 Modifikasi bridge/mqtt_to_supabase.py untuk memuat (joblib.load) model dan scaler saat startup.
[x] 4.2 Implementasikan struktur data dict di memori untuk menyimpan sliding window buffer (array magnitude) per device_id.
[x] 4.3 Tulis fungsi kalkulasi magnitude akselerometer: $\text{magnitude} = \sqrt{a_x^2 + a_y^2 + a_z^2}$.
[x] 4.4 Atur logika ingestion MQTT:
[x] Setiap data masuk, hitung magnitude, masukkan ke buffer perangkat terkait.
[x] Data mentah tetap langsung di-insert ke Supabase (skema existing).
[x] 4.5 Atur logika Trigger AI saat Buffer penuh ($N=50$):
[x] Ekstrak 14 fitur statistik dari array magnitude di buffer.
[x] Lakukan normalisasi fitur menggunakan scaler.transform().
[x] Panggil model.predict() dan model.predict_proba().
[x] 4.6 Implementasikan Logika Fallback:
[x] Cek jika confidence tertinggi < 60% ($0.60$).
[x] Jika YA: set ai_fallback = true, gunakan kalkulasi berbasis threshold magnitude konvensional untuk menentukan risk_level.
[x] Jika TIDAK: gunakan hasil label dan risk_level langsung dari prediksi AI.
[x] 4.7 Bungkus hasil akhir ke dalam objek metadata JSON dan sisipkan pada row data terakhir yang masuk ke Supabase.
[x] 4.8 Reset buffer perangkat ke kosong ([]) untuk bersiap menerima window berikutnya.
[x] 4.9 Implementasikan pengiriman alert real-time ke Telegram menggunakan HTTP Request (requests.post) saat mendeteksi risiko `high` atau `critical`.


💻 Fase 5: Integrasi Dashboard Web Frontend
Tujuan: Menyajikan visualisasi data AI yang informatif kepada pengguna.

[x] 5.1 Perbarui query Supabase di komponen React untuk menarik field metadata dari tabel vibration_data.
[x] 5.2 Sediakan komponen UI baru untuk status getaran: menampilkan teks label AI dan badge tingkat risiko (Low, Medium, High, Critical).
[x] 5.3 Buat komponen Progress Bar visual untuk menampilkan persentase Confidence Score dari AI.
[x] 5.4 Tambahkan indikator visual (misal: ikon warning kecil atau text "Mode Fallback Aktif") jika metadata.ai_fallback bernilai true.
[x] 5.5 Buat chart baru (bisa menggunakan Chart.js / Recharts) untuk menampilkan visualisasi grafik distribusi prediksi kelas AI dalam kurun waktu 24 jam terakhir.

🔬 Fase 5.5: Pengujian Simulasi End-to-End (Data Tiruan)
Tujuan: Memverifikasi berjalannya AI dan pembaruan UI Dashboard tanpa alat fisik nyata.

[x] 5.5.1 Buat skrip `bridge/simulator.py` yang berpura-pura menjadi ESP32.
[x] 5.5.2 Simulasikan pengiriman data getaran dengan variasi tertentu (Normal -> Gempa) menggunakan `device_id` simulasi. (Termasuk penambahan `simulator_advanced.py` dan `simulator_guaranteed.py` / `simulator_direct.py` untuk mengatasi limitasi broker publik).
[x] 5.5.3 Jalankan `bridge/mqtt_to_supabase.py` agar menangkap payload dari MQTT dan melakukan inferensi AI. (Berhasil mengimplementasikan cache `_last_ai_metadata` agar status stabil).
[x] 5.5.4 Verifikasi perubahan secara real-time pada UI Dashboard web. (Berhasil memperbaiki bug penggabungan data di `dashboardService.js` dan menambahkan fitur auto-refresh interval 5 detik).


📡 Fase 6: Pengumpulan Data Sensor Fisik & Siklus Retrain
Tujuan: Mengkalibrasi model dengan karakteristik data sensor MPU6050 asli di lapangan.

[ ] 6.1 Hubungkan hardware ESP32 + MPU6050 ke broker MQTT, pastikan transmisi data stabil.
[ ] 6.2 Lakukan simulasi fisik terkontrol untuk mengambil sampel tiap kelas (minimal 50 window per kelas):
[ ] [ ] Kondisi AC menyala (Class 0)[ ] 
[ ] Langkah kaki di sekitar shelter (Class 1)[ ] 
[ ] Getaran ketukan/sabotase sengaja (Class 2)[ ] 
[ ] Kendaraan lewat di dekat sensor (Class 3)[ ] 
[ ] Simulasi guncangan gempa intensitas tinggi (Class 4)
[ ] 6.3 Simpan data ekstraksi fitur dari sensor fisik ini ke dalam dataset sekunder (physical_features.npy).
[ ] 6.4 Modifikasi 2_model_trainer.py untuk menggabungkan dataset audio awal dengan dataset sensor fisik baru.
[ ] 6.5 Jalankan Retraining model, bandingkan akurasinya di evaluation_report.txt, lalu timpa model lama jika akurasi meningkat.


💡 Senior Engineer Note: > Untuk memulai eksekusi, saya sarankan kita fokus ke Fase 1 dan Fase 2 terlebih dahulu untuk memastikan ekstraksi fitur dari .wav dan .json berjalan sinkron tanpa kendala array mismatch.