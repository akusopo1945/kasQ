# KasQ - Hybrid Offline-First POS

KasQ adalah aplikasi kasir (Point of Sale) dan pembukuan keuangan UMKM berbasis web/mobile yang tangguh, mengadopsi prinsip **Offline-First**. Seluruh UI, database lokal, dan mesin parsing perintah suara berjalan lokal di HP/browser secara offline, dengan sinkronisasi awan secara realtime saat internet terhubung.

## Fitur Utama
* **Offline-First Database**: Kecepatan respons query < 200ms menggunakan [db.service.js](file:///var/www/html/kasQ/src/services/db.service.js) (IndexedDB via Dexie.js).
* **Hybrid AI Voice Input**: Input transaksi via suara. Memakai Google Gemini API saat online, dan parser lokal regex saat offline.
* **Realtime Cloud Sync**: Replikasi data otomatis ke Firebase Firestore dan Google Sheets saat terdeteksi koneksi internet.

## Panduan Arsitektur & Sinkronisasi
Alur kerja sinkronisasi data realtime (IndexedDB ↔ Firestore ↔ Google Sheets) didokumentasikan secara lengkap pada berkas panduan:
* **[SYNC_GUIDE.md](file:///var/www/html/kasQ/SYNC_GUIDE.md)**

## Cara Menjalankan Project
1. Instal dependensi: `npm install`
2. Konfigurasi file `.env` untuk API Key Firebase dan URL Apps Script Google Sheets.
3. Jalankan server lokal: `npm run dev`
4. Bangun versi produksi: `npm run build`
