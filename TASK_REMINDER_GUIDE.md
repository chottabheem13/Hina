# Task Reminder Guide

Panduan penggunaan fitur **Task Reminder** pada Discord Bot Hina.

---

## Daftar Isi

1. [Gambaran Umum](#gambaran-umum)
2. [Konfigurasi](#konfigurasi)
3. [Slash Commands](#slash-commands)
4. [Logika Reminder](#logika-reminder)
5. [Format Pesan Bot](#format-pesan-bot)
6. [Contoh Penggunaan](#contoh-penggunaan)
7. [Troubleshooting](#troubleshooting)

---

## Gambaran Umum

Fitur **Task Reminder** memungkinkan admin untuk:
- Menugaskan task ke member dengan deadline tertentu
- Bot mengirim reminder otomatis sampai task selesai
- Member bisa menandai task sebagai selesai
- Admin bisa membatalkan task yang sudah tidak relevan

Bot menyimpan semua task di Google Sheets dengan tab `task_log`.

---

## Konfigurasi

### Environment Variables

Tambahkan variabel berikut ke file `.env`:

```env
# Channel untuk notifikasi task (task baru, selesai, overdue)
TASK_NOTIFICATION_CHANNEL_ID=your_channel_id_here

# Google Sheets - gunakan spreadsheet yang sama dengan shift_checkins
GSHEET_SPREADSHEET_ID=your_spreadsheet_id_here
GSHEET_TASK_TAB_NAME=task_log
```

### Google Sheets Setup

1. Buka Google Spreadsheet yang sudah terhubung dengan bot
2. Buat tab baru dengan nama `task_log` (atau sesuai `GSHEET_TASK_TAB_NAME`)
3. Bot akan otomatis membuat header row saat pertama kali dijalankan

**Struktur Kolom:**

| Kolom | Nama | Deskripsi |
|-------|------|-----------|
| A | task_id | ID unik task (T001, T002, dst) |
| B | discord_id | User ID member yang di-assign |
| C | nama | Username member |
| D | task_desc | Deskripsi task |
| E | deadline | Deadline (DD/MM/YYYY HH:MM) |
| F | status | pending / done / cancelled |
| G | created_by | Username admin yang assign |
| H | created_at | Waktu pembuatan task |
| I | done_at | Waktu task selesai |
| J | last_reminded | Waktu reminder terakhir |
| K | cancelled_at | Waktu pembatalan task |

### Role/Permission Setup

Pastikan `ADMIN_USER_IDS` di `.env` sudah diisi dengan Discord User ID admin:

```env
# Multiple admin, pisahkan dengan koma
ADMIN_USER_IDS=851340340425129994,123456789012345678
```

---

## Slash Commands

### `/task assign`

**Permission:** Admin Only

Assign task baru ke member.

| Option | Type | Required | Deskripsi |
|--------|------|----------|-----------|
| `member` | User | Ya | Member yang akan di-assign |
| `deskripsi` | String | Ya | Deskripsi task |
| `deadline` | String | Ya | Deadline format `DD/MM HH:MM` |

**Contoh:**
```
/task assign @Cilla Isi laporan keuangan Desember 25/12 17:30
```

---

### `/task list`

**Permission:** Admin & Member

- **Admin**: Bisa lihat semua task aktif seluruh tim, atau task member tertentu
- **Member**: Hanya bisa lihat task milik sendiri

| Option | Type | Required | Deskripsi |
|--------|------|----------|-----------|
| `member` | User | Tidak | Lihat task member tertentu (Admin only) |

**Contoh:**
```
/task list                    # Lihat task sendiri
/task list @Cilla             # Lihat task Cilla (Admin only)
```

---

### `/task done`

**Permission:** Member yang di-assign

Tandai task sebagai selesai.

| Option | Type | Required | Deskripsi |
|--------|------|----------|-----------|
| `task_id` | String | Ya | ID task (contoh: T001) |

**Contoh:**
```
/task done T001
```

---

### `/task cancel`

**Permission:** Admin Only

Batalkan task yang sudah tidak relevan.

| Option | Type | Required | Deskripsi |
|--------|------|----------|-----------|
| `task_id` | String | Ya | ID task (contoh: T001) |

**Contoh:**
```
/task cancel T001
```

---

## Logika Reminder

Bot mengecek task setiap **30 menit** dan mengirim reminder berdasarkan kondisi:

| Kondisi | Aksi |
|---------|------|
| **H-1 (24 jam sebelum deadline)** | DM reminder ke member |
| **1 jam sebelum deadline** | DM reminder ke member |
| **Tepat saat deadline terlewat** | DM warning ke member + Notif ke channel admin |
| **Setiap 2 jam setelah overdue** | DM ulang ke member sampai status berubah jadi done |

### Pencegahan Duplikat

Bot menggunakan kolom `last_reminded` untuk mencegah pengiriman reminder duplikat dalam window waktu yang sama:
- Reminder H-1 dan 1 jam: tidak akan dikirim ulang dalam 1 jam
- Reminder overdue: tidak akan dikirim ulang dalam 2 jam

---

## Format Pesan Bot

### DM Task Baru ke Member

```
📋 Task Baru!
──────────────
ID: T001
Dari: admin_username
Deadline: Senin, 25/12/2024 17:30

Deskripsi:
Isi laporan keuangan Desember

──────────────
Ketik /task done T001 kalau sudah selesai.
```

---

### DM Reminder (H-1)

```
⏰ Reminder Task - H-1
──────────────
ID: T001
Deadline: 25/12/2024 17:30
Waktu Tersisa: 1 hari lagi, besok jam 17:30

Task: Isi laporan keuangan Desember

──────────────
Jangan lupa selesaikan ya!
```

---

### DM Reminder (1 Jam)

```
⏰ Reminder Task - 1 Jam Lagi
──────────────
ID: T001
Deadline: 25/12/2024 17:30
Waktu Tersisa: 1 jam 0 menit lagi

Task: Isi laporan keuangan Desember

──────────────
Segera selesaikan sebelum deadline!
```

---

### DM Overdue (Warning)

```
🚨 Task Overdue!
──────────────
ID: T001
Deadline: 25/12/2024 17:30
Status: sudah lewat 2 jam yang lalu

Task: Isi laporan keuangan Desember

──────────────
Segera selesaikan dan ketik /task done T001
```

---

### Notifikasi Channel Admin (Task Selesai)

```
✅ Task Selesai
──────────────
ID: T001
Member: Cilla
Selesai pada: Senin, 25/12/2024 16:45
Task: Isi laporan keuangan Desember
```

---

### Notifikasi Channel Admin (Task Overdue)

```
🚨 Task Overdue - Warning
──────────────
Task ID: T001
Assignee: Cilla (783336546157592637)
Deadline: 25/12/2024 17:30
Task: Isi laporan keuangan Desember
```

---

## Contoh Penggunaan

### Skenario 1: Admin Assign Task

1. Admin menjalankan command:
   ```
   /task assign @Cilla Rekap penjualan minggu ini 20/12 15:00
   ```

2. Bot akan:
   - Membuat task dengan ID T001
   - Menyimpan ke Google Sheets
   - Mengirim DM ke Cilla dengan detail task
   - Reply konfirmasi ke admin

---

### Skenario 2: Member Lihat Task

1. Member menjalankan command:
   ```
   /task list
   ```

2. Bot menampilkan semua task aktif yang di-assign ke member tersebut.

---

### Skenario 3: Member Selesaikan Task

1. Member menjalankan command:
   ```
   /task done T001
   ```

2. Bot akan:
   - Update status task jadi "done"
   - Mengirim notifikasi ke channel admin
   - Reply konfirmasi ke member

---

### Skenario 4: Admin Batalkan Task

1. Admin menjalankan command:
   ```
   /task cancel T001
   ```

2. Bot akan:
   - Update status task jadi "cancelled"
   - Mengirim DM ke member bahwa task dibatalkan
   - Reply konfirmasi ke admin

---

## Troubleshooting

### Error: "Format deadline salah"

**Penyebab:** Format deadline tidak sesuai `DD/MM HH:MM`

**Solusi:** Gunakan format yang benar, contoh:
- Benar: `25/12 17:30`
- Salah: `25-12-2024 17:30` atau `17:30 25/12`

---

### Error: "Deadline tidak boleh di waktu yang sudah lewat"

**Penyebab:** Deadline yang dimasukkan sudah lewat dari waktu sekarang

**Solusi:** Masukkan deadline di waktu yang akan datang

---

### Error: "Task T001 tidak ditemukan"

**Penyebab:** ID task tidak ada atau salah ketik

**Solusi:**
- Cek daftar task dengan `/task list`
- Pastikan ID task benar (T001, T002, dst)

---

### Error: "Task T001 bukan diassign ke kamu"

**Penyebab:** Member mencoba menyelesaikan task yang di-assign ke orang lain

**Solusi:** Hanya member yang di-assign yang bisa menyelesaikan task tersebut

---

### Error: "Perintah ini khusus admin"

**Penyebab:** User bukan admin mencoba menggunakan command admin-only

**Solusi:**
- `/task assign` dan `/task cancel` hanya untuk admin
- Pastikan user ID ada di `ADMIN_USER_IDS` di `.env`

---

### Reminder tidak terkirim

**Penyebab:**
1. Bot interval belum berjalan
2. Member memblokir DM dari bot

**Solusi:**
- Restart bot jika interval belum aktif
- Member harus mengizinkan DM dari server

---

### Google Sheets error

**Penyebab:**
1. Spreadsheet ID salah
2. Service account tidak punya akses

**Solusi:**
- Pastikan `GSHEET_SPREADSHEET_ID` benar
- Share spreadsheet ke email service account dengan permission **Editor**
