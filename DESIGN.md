---
version: alpha
name: kasq-mobile-theme
description: Sistem desain minimalis premium untuk aplikasi POS mobile offline-first KasQ.
colors:
  primary: "#6366f1"      # Indigo 500
  primary-dark: "#4f46e5" # Indigo 600
  secondary: "#a855f7"    # Purple 500
  success: "#10b981"      # Emerald 500
  danger: "#ef4444"       # Red 500
  warning: "#f59e0b"      # Amber 500
  background: "#09090b"   # Zinc 950 (Dark mode default)
  surface: "#18181b"      # Zinc 900
  surface-hover: "#27272a" # Zinc 800
  text: "#fafafa"         # Zinc 50
  text-muted: "#a1a1aa"   # Zinc 400
typography:
  fontFamily: "Inter, system-ui, -apple-system, sans-serif"
  fontFamilyMono: "JetBrains Mono, monospace"
rounded:
  sm: "6px"
  md: "12px"
  lg: "20px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
---

# Design System KasQ Mobile

## 1. Overview
KasQ Mobile mengadopsi gaya visual **Sleek & Contemporary** bernuansa gelap (*dark mode*) yang premium untuk mengurangi ketegangan mata kasir yang menatap layar dalam waktu lama. Desain berfokus pada ketepatan sentuh (*touch target* >= 48px), transisi halus, dan animasi mikro yang responsif.

## 2. Colors
* **Primary (Indigo):** `{colors.primary}` dan `{colors.primary-dark}` sebagai aksen utama tindakan positif (checkout, bayar).
* **Secondary (Purple):** `{colors.secondary}` untuk aksen kecerdasan buatan (AI Voice).
* **Background & Surface (Dark Zinc):** `{colors.background}` dan `{colors.surface}` memberikan kontras tinggi bagi teks putih `{colors.text}`.

## 3. Typography
Menggunakan font **Inter** untuk keterbacaan tinggi pada layar mobile berukuran kecil.
* **Heading 1:** 20px, Semi-Bold (Header halaman / total belanja)
* **Body:** 14px, Regular (Nama produk, menu item)
* **Caption/Helper:** 12px, Regular (Stok produk, status sync)

## 5. Components

### 5.1. Bottom Navigation Bar
* Tinggi: 64px
* Background: `{colors.surface}` dengan border-top 1px `{colors.surface-hover}`.
* Transisi: Perubahan warna ikon dan label aktif ke `{colors.primary}` menggunakan efek transisi 200ms.

### 5.2. AI Voice FAB (Floating Action Button)
* Ukuran: 56px x 56px, lingkaran penuh `{rounded.full}`.
* Background: Gradasi dari `{colors.secondary}` ke `{colors.primary}`.
* Animasi: Efek denyut (*pulse ring*) saat merekam suara secara aktif.

### 5.3. Bottom Sheet
* Radius atas: `{rounded.lg}` (20px).
* Background: `{colors.surface}` dengan overlay backdrop blur 8px.

## 6. Do's and Don'ts
* **DO:** Gunakan target sentuhan minimal 48px untuk semua tombol interaktif.
* **DO:** Berikan umpan balik getaran (*haptic*) saat tombol suara ditekan.
* **DON'T:** Gunakan warna teks abu-abu terang di atas latar belakang abu-abu (kontras rendah).
* **DON'T:** Munculkan modal/dialog pop-up yang menutupi seluruh layar secara mendadak. Gunakan bottom sheet.
