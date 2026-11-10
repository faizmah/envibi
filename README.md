# NARAYAN VIRTUAL SMART BANK — TAHAP 7.1
### Realtime Self-Saving NFC System & 3D Virtual Branch

Narayan Virtual Bank adalah sistem pengelolaan tabungan mandiri realtime berbasis Web NFC, arsitektur JavaScript Framework (React 18 + Vite), Supabase PostgreSQL backend, Row Level Security (RLS), Double-Entry Ledger, serta Kantor Virtual 3D interaktif Three.js.

---

## 🏛️ Konsep Utama: Tabungan Mandiri Berbasis NFC

- **Uang Fisik di Rumah, Pembukuan Resmi di Cloud:** Member menyimpan uang fisik di rumah menggunakan kotak tabungan ber-tag NFC. Sistem mencatat transaksi secara atomik dan membedakan saldo pembukuan dengan saldo fisik yang dilaporkan.
- **Web NFC API NDEF URL:** Tag NFC diformat dengan URL publik acak (`https://domain/nfc/BOX_PUBLIC_TOKEN`). Tidak ada data sensitif yang tersimpan di dalam tag fisik.
- **Kantor Virtual 3D (Three.js):** Visualisasi gedung bank 3 lantai, lift animasi, 8 karakter staf chibi (Sari, Budi, Dodi, Pak Rudi, dll), kontrol kamera 360°, HUD, dan dock operasional.
- **Backend Supabase PostgreSQL:** 11 tabel relasional, RLS (Row Level Security), dan database functions (RPC) atomik anti-minus.

---

## 🚀 Menjalankan Proyek

1. **Instalasi dependensi:**
   ```bash
   cd app
   npm install
   ```

2. **Konfigurasi Environment:**
   Salin `.env.example` menjadi `.env.local` di dalam folder `app/`:
   ```bash
   cp app/.env.example app/.env.local
   ```

3. **Jalankan Development Server:**
   ```bash
   npm run dev
   # Atau dari root:
   npm --prefix app run dev
   ```
   Buka `http://localhost:5173`.

---

## 📂 Struktur Repositori

- `app/` — Source code lengkap React 18 + Vite + Three.js + Supabase client & migrations.
- `app/supabase/migrations/` — SQL Migration skema tabel, RLS policies, dan stored procedures (RPC).
- `Narayan_Virtual_Bank_Tahap_7_1_Portal_Fix.html` — Sumber kode awal prototype sebelum migrasi.
- `konsep1.txt` — Master prompt arsitektur dan spesifikasi teknis lengkap.
