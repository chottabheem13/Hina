# Flow Guide - Hina Logbook Reminder Bot

## Tujuan
Bot ini dipakai untuk:
- Ngingetin user tertentu isi logbook setiap hari.
- Nerima laporan via chat biasa.
- Nyimpen jejak aktivitas di log channel.

## Aktor
- Admin: set konfigurasi bot dan channel.
- User target: user yang wajib lapor (berdasarkan `REMINDER_USER_IDS`).
- Bot Hina: kirim reminder, validasi laporan, kirim log.

## Channel yang dipakai
- `REMINDER_CHANNEL_ID`: tempat bot mention user target yang belum lapor.
- `REPORT_CHANNEL_ID`: tempat user target kirim laporan.
- `LOG_CHANNEL_ID`: tempat bot kirim log reminder + log laporan masuk.

## Flow Harian
1. Mulai jam `18:00` sampai `23:30` (timezone: `Asia/Jakarta`), bot jalan otomatis tiap 30 menit sesuai `REMINDER_CRON`.
2. Bot mention hanya user yang belum lapor hari itu ke channel reminder.
3. User target kirim chat di channel laporan, contoh:
   - `aku dah isi logbook`
   - `aku belum isi logbook, nanti jam 9`
4. Bot cek pesan:
   - Kalau pengirim bukan user target: diabaikan.
   - Kalau pesan tidak kebaca sebagai laporan logbook: bot balas template peringatan, tidak dicatat ke log.
   - Kalau valid dan itu laporan pertama hari itu: bot balas konfirmasi (`laporan tercatat`), stop reminder untuk user tersebut, dan kirim log embed ke `LOG_CHANNEL_ID`.
   - Kalau valid tapi user sudah lapor sebelumnya di hari yang sama: bot balas bahwa laporan hari ini sudah pernah tercatat.

## Rules Validasi Pesan
- Bot hanya memproses pesan dari user dalam `REMINDER_USER_IDS`.
- Bot menganggap pesan sebagai laporan jika ada kata kunci terkait logbook, seperti:
  - `isi`, `logbook`, `log book`, `udah`, `sudah`, `belum`, `dah`
- Klasifikasi status otomatis:
  - Mengandung `udah isi`/`sudah isi`/`dah isi`/`done`/`beres`/`selesai` => `Sudah isi`
  - Mengandung `belum`/`belom`/`ntar`/`nanti` => `Belum isi / akan isi nanti`
  - Selain itu => `Laporan bebas`

## Output Bot
- Ke `REMINDER_CHANNEL_ID`:
  - Pesan reminder tiap 30 menit + mention user target yang belum lapor.
- Ke `REPORT_CHANNEL_ID`:
  - Reply konfirmasi jika laporan valid.
  - Reply arahan format jika laporan tidak valid.
- Ke `LOG_CHANNEL_ID`:
  - Embed `Reminder Terkirim`.
  - Embed `Laporan Logbook Masuk` berisi user, status, channel, isi pesan.

## Checklist Setup
1. Isi `.env` sesuai server.
2. Pastikan permission bot:
   - `View Channels`
   - `Send Messages`
   - `Read Message History`
   - `Embed Links`
3. Aktifkan `Message Content Intent` di Discord Developer Portal.
4. Jalankan bot: `npm start`.
