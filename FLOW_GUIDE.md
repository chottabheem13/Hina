# Flow Guide - Hina Shift Monitoring Bot

## Tujuan
- Monitoring kedisiplinan piket berbasis shift.
- Semua orang bisa lihat siapa sudah check-in dan siapa belum.
- Reminder otomatis berjalan tanpa manual follow-up.

## Channel
- `SHIFT_REMINDER_CHANNEL_ID`: channel referensi shift (opsional/legacy config).
- `LOGBOOK_REMINDER_CHANNEL_ID`: channel terpisah untuk reminder logbook (opsional).
- `CHECKIN_CHANNEL_ID`: tempat user check-in dengan `start`.
- `LOG_CHANNEL_ID`: jejak aktivitas bot (shift mulai, check-in, shift ditutup).

## Alur Inti
1. Saat jam shift mulai, bot kirim pesan via DM ke petugas:
   - mention petugas utama hari itu,
   - mention backup (`Eric`),
   - tampilkan status awal `?`.
2. User check-in dengan:
   - ketik `start` di channel check-in, atau
   - klik tombol **Start** di pesan bot.
3. Setelah check-in, status Start berubah jadi `?` otomatis.
4. Saat shift berakhir, bot kirim tombol **Selesai** (atau user ketik `selesai`) untuk finalisasi.
5. Jika dalam `REMINDER_REPEAT_MINUTES` belum check-in:
   - bot kirim reminder ulang via DM,
   - mention yang masih `?`.
6. Saat fase selesai ditutup:
   - yang belum `start` ditandai `tidak hadir`,
   - yang sudah `start` tapi belum `selesai` ditandai `tidak selesai`.

## Status
- `?` = sudah check-in.
- `?` = belum check-in.
- `On time` = check-in sebelum/melewati batas `LATE_AFTER_MINUTES`?
  - `<= LATE_AFTER_MINUTES`: `On time`
  - `> LATE_AFTER_MINUTES`: `Late`

## Rekap
- Command admin `/rekap-hari-ini` menampilkan:
  - per shift: siapa on time/late/tidak hadir.
- Jika Google Sheets aktif, bot juga simpan log permanen per check-in/absen.
