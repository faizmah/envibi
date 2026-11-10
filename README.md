# NARAYAN VIRTUAL BANK — REALTIME SELF-SAVING NFC SYSTEM (TAHAP 7.1)

Narayan Virtual Bank adalah sistem pengelolaan tabungan mandiri realtime berbasis Web NFC, arsitektur JavaScript Framework (React 18 + Vite), Supabase PostgreSQL backend, Row Level Security (RLS), Double-Entry Ledger, serta Kantor Virtual 3D interaktif Three.js.

---

## 1. Arsitektur Proyek

```
app/
├── public/
├── src/
│   ├── app/
│   │   ├── router/          # React Router v6 dengan role-based protection
│   │   └── providers/       # AuthProvider (Supabase Auth & Role RBAC)
│   ├── components/          # Komponen UI umum, form, kartu KPI
│   ├── features/
│   │   ├── auth/            # Login, Registrasi, Reset Password
│   │   ├── members/         # Dashboard Member, Profil, Notifikasi, 3D Office
│   │   ├── accounts/        # Formulir Pengajuan, Rincian Rekening & Mutasi
│   │   ├── savings/         # Aktivasi Kotak NFC, Rekonsiliasi Saldo Fisik, Target
│   │   ├── transactions/    # Lapor Setor Mandiri, Tarik Mandiri, Riwayat
│   │   ├── nfc/             # NFC Scanner, NFC Diagnostic, URL Landing `/nfc/:token`
│   │   ├── admin/           # Dashboard Admin, Member, Rekening, Kotak & Resi, Tulis NFC
│   │   ├── reports/         # Analisis Keuangan, Ekspor CSV & Cetak PDF
│   │   └── audit/           # Audit Trail Viewer (Append-only & immutable)
│   ├── services/
│   │   ├── supabase/        # Supabase Client Singleton
│   │   ├── realtime/        # Supabase Realtime Channels (Notif, Akun, Transaksi)
│   │   └── nfc/             # Web NFC API Service (NDEF URL Record, Read, Write)
│   ├── styles/              # Global CSS & Design Tokens (Dark & Light theme)
│   └── utils/               # Formatting Rupiah, Date, Idempotency Generator
├── supabase/
│   ├── migrations/
│   │   ├── 001_schema_foundation.sql   # Skema PostgreSQL lengkap
│   │   ├── 002_rls_policies.sql        # Row Level Security per tabel
│   │   └── 003_database_functions.sql  # Atomic RPC Functions (Setor, Tarik, dll)
│   └── seed.sql             # Data awal & konfigurasi default bank
├── .env.example
├── package.json
└── vite.config.js
```

---

## 2. Fitur Utama & Konsep Tabungan Mandiri

1. **Uang Fisik di Rumah, Pembukuan Resmi di Cloud:**
   - Member menyimpan uang tunai di kotak tabungan fisik ber-NFC di rumah masing-masing.
   - Sistem mencatat transaksi secara atomik dan membedakan saldo pembukuan digital dengan uang tunai fisik yang dilaporkan.

2. **Web NFC API NDEF URL:**
   - Tag NFC pada kotak fisik menyimpan tautan URL publik: `https://domain.com/nfc/BOX_PUBLIC_TOKEN`.
   - **Zero Sensitive Data on NFC:** Tidak ada nomor rekening, PIN, atau data pribadi yang disimpan di tag fisik. Semua validasi dilakukan di backend.

3. **Autentikasi & Otorisasi RBAC:**
   - Menggunakan Supabase Auth (bcrypt).
   - Tiga tingkatan role: `MEMBER`, `ADMIN`, `SUPER_ADMIN`.
   - Row Level Security (RLS) mencegah akses data silang antar-member.

4. **Operasi Keuangan Atomik (Database RPC):**
   - Perubahan saldo tidak pernah dilakukan langsung dari JavaScript browser.
   - Menggunakan PostgreSQL Stored Procedures dengan row-level lock (`FOR UPDATE`), idempotency key pencegah mutasi ganda, dan pembukuan berpasangan (Double-Entry Ledger).

5. **Kantor Virtual 3D (Three.js):**
   - Visualisasi kantor bank 3D 3 lantai (Lobby/Teller, Operasional/Owner, Digital/Server).
   - Animasi karakter staf chibi (Sari, Budi, Dodi, Pak Rudi, dll) dengan sistem antrean dan kontrol kamera interaktif (Orbit, Pan, Zoom).

---

## 3. Panduan Instalasi & Menjalankan Proyek

### A. Prasyarat
- Node.js versi 18 ke atas (Direkomendasikan Node.js 20+).
- Akun proyek Supabase (gratis atau self-hosted).

### B. Langkah Instalasi

1. Masuk ke folder aplikasi:
   ```bash
   cd app
   ```

2. Salin environment variable:
   ```bash
   cp .env.example .env.local
   ```
   Buka file `.env.local` dan isi URL dan Anon Key dari Supabase Dashboard:
   ```env
   VITE_SUPABASE_URL=https://proyek-anda.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   VITE_NFC_BASE_URL=https://proyek-anda.vercel.app
   ```

3. Jalankan Migrasi Database di Supabase:
   - Buka **Supabase Dashboard** -> **SQL Editor**.
   - Buka dan jalankan file secara berurutan:
     1. `supabase/migrations/001_schema_foundation.sql`
     2. `supabase/migrations/002_rls_policies.sql`
     3. `supabase/migrations/003_database_functions.sql`

4. Jalankan Development Server:
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di `http://localhost:5173`.

---

## 4. Panduan Menetapkan Akun Admin

Setelah mendaftarkan akun baru melalui halaman Register:
1. Buka Supabase SQL Editor.
2. Jalankan query berikut dengan UUID user Anda:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('UUID-USER-ANDA', 'ADMIN')
   ON CONFLICT (user_id, role) DO UPDATE SET role = 'ADMIN';
   ```
3. Refresh halaman web, dan tombol **Panel Admin** akan otomatis muncul di navigasi atas.

---

## 5. Deployment ke Vercel

1. Push repository ke GitHub / GitLab.
2. Import repository di dashboard **Vercel**.
3. Pastikan **Root Directory** adalah root repository (`./` atau biarkan kosong / default).
4. Pastikan **Output Directory** adalah `dist` (default Vite).
4. Tambahkan Environment Variables pada menu Project Settings Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_NFC_BASE_URL` (Domain Vercel production Anda)
5. Klik **Deploy**.
