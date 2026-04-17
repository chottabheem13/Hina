# Hina - Discord Logbook Reminder Bot

Bot ini akan:
- Kirim reminder setiap 30 menit mulai jam `18:00` (default WIB) ke user ID yang belum lapor.
- User kirim status lewat pesan biasa di channel laporan.
- Semua reminder dan laporan masuk ke log channel.

## 1) Setup

1. Copy file environment:
```powershell
Copy-Item .env.example .env
```
2. Isi semua nilai di `.env`.
3. Install dependencies:
```bash
npm install
```

## 2) Invite Bot ke Server

Pastikan bot punya permission:
- `View Channels`
- `Send Messages`
- `Embed Links`
- `Read Message History`

Jangan lupa aktifkan juga **Message Content Intent** di Discord Developer Portal untuk bot ini.
## 3) Jalankan Bot

```bash
npm start
```

Kalau sukses, console akan menampilkan login bot dan status scheduler.

## Konfigurasi Penting

- `REMINDER_CRON=0,30 18-23 * * *` artinya tiap 30 menit dari 18:00 sampai 23:30.
- `TIMEZONE=Asia/Jakarta` supaya scheduler konsisten WIB.
- `REMINDER_USER_IDS` bisa isi 2 user atau lebih, pisahkan dengan koma.

## Alur Pakai

1. Mulai jam 18:00, bot mention user yang belum lapor di `REMINDER_CHANNEL_ID` setiap 30 menit.
2. User kirim chat biasa di `REPORT_CHANNEL_ID`. Contoh: `aku dah isi kak abi.`
3. User yang sudah lapor valid tidak akan di-remind lagi di hari itu.
4. Bot kirim log activity ke `LOG_CHANNEL_ID`.

Catatan:
- Bot hanya catat pesan yang terdeteksi sebagai laporan logbook (contoh mengandung kata seperti `isi`, `udah`, `sudah`, `belum`, `logbook`).
