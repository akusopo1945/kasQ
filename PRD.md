# Product Requirement Document (PRD) - KasQ (Hybrid Offline-First POS)

## 1. Pendahuluan
### 1.1 Latar Belakang
UMKM di Indonesia sering kali menghadapi masalah konektivitas internet yang tidak stabil, terutama di daerah pelosok. Aplikasi POS (Point of Sale) berbasis cloud murni sering kali gagal beroperasi saat koneksi terputus. KasQ hadir sebagai solusi aplikasi kasir dan pembukuan keuangan hybrid offline-first yang dapat berjalan 100% offline untuk transaksi harian, dengan kemampuan pemrosesan AI cerdas (online/offline) menggunakan perintah suara (voice command).

### 1.2 Tujuan
Transformasi web POS KasQ menjadi aplikasi mobile Android native (.APK) menggunakan CapacitorJS yang tangguh, responsif, dan hemat kuota, dengan integrasi Hybrid AI.

---

## 2. Arsitektur & Teknologi (Tech Stack)
* **Frontend:** React.js, Vite, Tailwind CSS (migrasi dari web eksisting).
* **Mobile Wrapper:** CapacitorJS (`@capacitor/android` v6.x).
* **Penyimpanan Lokal (Offline DB):** IndexedDB dengan Dexie.js (optimasi query cepat, cegah auto-clear OS).
* **Orkestrasi AI:**
  * **Online Mode:** Google Gemini API (`@google/generative-ai`) dengan *Structured Outputs* (JSON).
  * **Offline Mode:** Native Android Speech Recognition API (`@capacitor-community/speech-recognition`) + parser Regex/Rule-Based lokal.
* **CI/CD:** GitHub Actions runner (`ubuntu-latest`) + Java JDK 17 + Android SDK Tools untuk otomatisasi build `.apk`.

---

## 3. Fitur & Spesifikasi Fungsional

### 3.1 Mode Offline-First & Penyimpanan Lokal
* **Kebutuhan:** Aplikasi harus dapat dibuka, mencatat transaksi, melihat riwayat, dan mengelola stok tanpa koneksi internet.
* **Detail Implementasi:**
  * Database lokal menggunakan Dexie.js.
  * Skema DB: `transactions` (id, type, items, total, date, status_sync), `products` (id, name, price, stock), `debts` (id, customer_name, amount, date).
  * Banner status koneksi (`HeaderStatus.jsx`) untuk menunjukkan status Online/Offline secara real-time.

### 3.2 Pemrosesan Perintah Suara Hybrid (Hybrid Voice Command AI)
* **Kebutuhan:** Pengguna dapat mencatat transaksi lewat suara secara cepat.
* **Detail Implementasi:**
  * Tombol input suara (`VoiceButton.jsx`) dengan animasi pulse saat merekam dan Haptic Feedback (getaran) saat ditekan.
  * **Alur Hybrid AI (`ai.service.js`):**
    1. Aplikasi menangkap suara via `@capacitor-community/speech-recognition` menjadi teks.
    2. Aplikasi mendeteksi status koneksi internet.
    3. **Jika Online:** Kirim teks ke Google Gemini API dengan prompt khusus agar mengembalikan format JSON terstruktur (misal: `{ action: "SELL", items: [{ name: "kopi susu", qty: 2 }], total: 20000 }`).
    4. **Jika Offline:** Jalankan *Local Rule-Based Parser* (Regex) untuk mencocokkan pola teks sederhana (misal: `"jual [nama barang] [jumlah]"`).
    5. Masukkan hasil parsing ke database lokal Dexie.js.

### 3.3 Sinkronisasi Data (Sync)
* **Kebutuhan:** Data transaksi lokal disinkronkan ke server cloud ketika perangkat mendeteksi adanya koneksi internet (skema opsional/masa depan, tetapi disiapkan kolom status_sync di DB).

---

## 4. Persyaratan Non-Fungsional (Non-Functional Requirements)
* **Performa:** Waktu respons pencatatan lokal < 200ms.
* **Keandalan:** Data lokal di IndexedDB tidak boleh terhapus secara otomatis oleh mekanisme optimasi storage Android.
* **User Experience (UX):** Tombol suara harus mudah diakses dengan indikator visual dan fisik (haptic feedback) yang jelas.
* **Kompabilitas:** Berjalan lancar di Android 8.0 (Oreo) ke atas.

---

## 5. Struktur Direktori Proyek
```text
├── .github/
│   └── workflows/
│       └── build-apk.yml       # CI/CD otomatisasi build APK
├── android/                    # Folder proyek native Android
├── src/
│   ├── components/
│   │   ├── HeaderStatus.jsx    # Banner status online/offline
│   │   └── VoiceButton.jsx     # Tombol input suara + Haptic Feedback
│   ├── services/
│   │   ├── ai.service.js       # Hub orkestrasi AI (Gemini / Offline Fallback)
│   │   └── db.service.js       # Konfigurasi Dexie.js & operasi DB
│   ├── App.jsx
│   └── index.css
├── capacitor.config.json       # Konfigurasi Capacitor
├── package.json
└── vite.config.js
```

---

## 6. Rencana Rilis & Kriteria Penerimaan (Acceptance Criteria)
1. **Kriteria POS Offline:** Pengguna bisa input produk dan transaksi dalam keadaan offline, dan data bertahan setelah aplikasi di-restart.
2. **Kriteria Hybrid AI:**
   - Dalam kondisi online, suara "jual kopi dua" berhasil diparsing via Gemini API menjadi objek transaksi terstruktur.
   - Dalam kondisi offline, suara "jual kopi dua" berhasil diparsing via Regex lokal menjadi objek transaksi terstruktur yang sama.
3. **Kriteria Build:** GitHub Actions berhasil mengompilasi APK tanpa error dan menghasilkan file artifact `.apk` yang bisa di-install di HP Android.
