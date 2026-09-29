# SUPER ADMIN SAL

Aplikasi web lead time laporan deliveryman untuk Distribution Center. Data tersimpan di Google Sheets. Otak aturan ada di Google Apps Script.

## Alur

1. Deliveryman buka tautan dari barcode Security, masuk dengan No. Polisi + No. FO. Waktu masuk = kolom TIMESTAMP.
2. Deliveryman scan barcode dinding pos (`TRANSPORT_ANTRIAN`, `FG_ANTRIAN`, `BS_ANTRIAN`, `KASIR_ANTRIAN`).
3. Petugas pos masuk dengan NIK + PIN (sheet `NIK_AKSES`) lalu scan barcode HP supir `NOPOL|NOFO|POS|STATUS`.
4. Transport adalah control tower: semua pos, penugasan Ada / Tidak ada / Pending, dan pengaturan URL Apps Script.

## Sheet

File Google Sheets (contoh nama `LEADTIME_APP`) berisi:

| Tab | Isi |
|---|---|
| `MONITORING_LEADTIME` | Trip dan cap waktu |
| `MASTER_EQUIPMENT` | Nopol, mobil, vendor, WA |
| `OPERATING_HOURS` | Jam buka pos |
| `NIK_AKSES` | NIK, NAMA, POS, PIN |

Kolom POS di `NIK_AKSES`: `TRANSPORT` / `FG` / `BS` / `KASIR`.

## Hubungkan Google Sheet

1. Buka file Sheets → **Ekstensi → Apps Script**.
2. Tempel isi `apps-script/Code.gs`.
3. **Deploy → Aplikasi web**
   - Jalankan sebagai: akun Anda
   - Siapa yang memiliki akses: **Siapa saja**
4. Salin URL `/exec`.
5. Login sebagai Transport di aplikasi → **Pengaturan** → tempel URL → Simpan.

## Menjalankan aplikasi

```bash
npm install
npm run dev
```

Bangun produksi:

```bash
npm run build
```

## Struktur

```
apps-script/Code.gs          Otak aturan Google Sheets
src/routes/                  Halaman beranda, deliveryman, petugas
src/components/leadtime/     Antrean, pemindai, QR, rekap, pengaturan
src/lib/leadtime/            Aturan bisnis, API server, tema pos
src/styles.css               Warna pastel per pos
```

Warna pos: Transport kuning, FG biru, BS hijau, Kasir pink.
