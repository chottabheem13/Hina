# Hina - Discord Shift Monitoring Bot

Bot ini akan:
- Kirim pengingat otomatis saat shift dimulai sesuai jadwal tetap lewat DM (private).
- Mention petugas utama + backup (`Eric`) per shift.
- Terima check-in lewat:
  - ketik `start` di channel check-in, atau
  - klik tombol **Start** dari bot.
- Saat shift berakhir, bot kirim tombol **Selesai** (atau ketik `selesai`) untuk finalisasi.
- Tampilkan status check-in real-time: `? Sudah` / `? Belum`.
- Kirim reminder ulang setiap X menit untuk yang belum check-in (via DM).
- (Opsional) simpan log ke Google Sheets dan kirim recap harian.

## 1) Setup

1. Copy env:
```powershell
Copy-Item .env.example .env
```
2. Isi semua nilai di `.env`.
3. Install dependencies:
```bash
npm install
```

## 2) Konfigurasi Utama

- `SHIFT_USER_IDS` wajib berisi mapping:
  - `Abi`
  - `Cilla`
  - `Sharon`
  - `Eric`
- `SHIFT_REMINDER_CHANNEL_ID` khusus reminder shift piket.
- `LOGBOOK_REMINDER_CHANNEL_ID` khusus reminder logbook (opsional, harus beda channel).
- `REMINDER_REPEAT_MINUTES` untuk interval reminder ulang.
- `LATE_AFTER_MINUTES` untuk klasifikasi `On time` vs `Late`.
- `FINISH_GRACE_MINUTES` untuk batas waktu klik tombol `Selesai` setelah shift berakhir.
- `CHECKIN_CHANNEL_ID` channel khusus check-in `start`.
- `TIMEZONE=Asia/Jakarta` supaya jadwal konsisten WIB.

## 3) Setup Google Sheets (Opsional)

1. Buat Google Sheet baru, lalu copy `spreadsheetId` dari URL.
2. Buat Service Account, aktifkan Google Sheets API.
3. Share sheet ke email service account sebagai `Editor`.
4. Isi variabel:
   - `GSHEET_SPREADSHEET_ID`
   - `GSHEET_TAB_NAME`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`

## 4) Setup AI Assistant (Opsional)

1. Dapatkan OpenAI API key dari https://platform.openai.com/api-keys
2. Isi variabel:
   - `OPENAI_API_KEY` - API key dari OpenAI
   - `AI_MODEL` - Model yang dipakai (default: `gpt-4o-mini`)
   - `AI_MAX_TOKENS` - Max tokens per response (default: 1000)
   - `AI_TEMPERATURE` - Kreativitas 0-10 (default: 7)
   - `AI_CONVERSATION_MEMORY_MINUTES` - Durasi memori percakapan (default: 30)
   - `AI_SYSTEM_PROMPT` - Custom system prompt (opsional)
   - `AI_ALLOWED_USER_IDS` - Whitelist user IDs (kosongkan untuk semua user)
   - `AI_RATE_LIMIT_PER_MINUTE` - Rate limit per user (default: 10)

## 4) Jalankan Bot

```bash
npm start
```

## Jadwal Shift (Hardcoded sesuai requirement)

- Shift 1 (09:00-12:00)
  - Senin: Abi
  - Selasa: Cilla
  - Rabu: Sharon
  - Kamis: Abi
  - Jumat: Cilla
  - Sabtu: Sharon
  - Minggu: Libur
- Shift 2 (12:00-15:00)
  - Senin: Cilla
  - Selasa: Sharon
  - Rabu: Cilla
  - Kamis: Cilla
  - Jumat: Sharon
  - Sabtu: Cilla
  - Minggu: Libur
- Shift 3 (16:00-19:00)
  - Senin: Sharon
  - Selasa: Abi
  - Rabu: Abi
  - Kamis: Sharon
  - Jumat: Abi
  - Sabtu: Abi
  - Minggu: Libur
- Backup harian: Eric (ikut dimonitor di setiap shift)

## Command User (Teks)

- `start` (hanya di channel check-in): check-in mulai shift aktif.
- `selesai <link>` (hanya di channel check-in): finalisasi setelah shift berakhir dengan link bukti.
- Tombol `Selesai`: akan membuka modal untuk input link bukti.

## Command AI (Slash)

- `/ai ask <prompt>`: Tanya pertanyaan sekali tanpa memori percakapan.
- `/ai chat <message>`: Chat dengan AI yang ingat konteks percakapan (memori 30 menit).
- `/ai clear`: Hapus riwayat percakapan AI.
- `/ai tasks`: Dapatkan analisis AI untuk task-task kamu (prioritas, deadline, dsb).
- `/ai help`: Tampilkan bantuan AI assistant.

## Command Admin (Slash)

- `/tes-shift nomor:<1|2|3>`: trigger manual shift.
- `/tes-reminder-logbook`: kirim reminder logbook manual.
- `/status-shift`: lihat status shift aktif.
- `/rekap-hari-ini`: lihat ringkasan hari ini.
