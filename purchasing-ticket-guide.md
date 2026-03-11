# Purchasing Ticket System Guide

## Overview

Purchasing Ticket System adalah fitur untuk membuat tiket purchasing dengan 6 tipe tiket. Tiket akan membuat thread di channel yang sesuai dengan tipe tiket dan menugaskan staff terkait.

## Cara Membuat Tiket

Gunakan command berikut di Discord:
- `/purchasing-ticket` - Membuat tiket purchasing

Pilih tipe tiket dari dropdown yang muncul, lalu isi form yang tersedia.

---

## Tipe Tiket

### 1. ETA (General/PPO)
**Channel:** `#ppo`
**Prefix Thread:** `PPO-{identifier}-{username}`

| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| Priority | Select | Tidak | Normal, Urgent (default: Normal) |
| Item ID | Text | Tidak | ID item yang ditanyakan |
| Order ID | Text | Ya | Nomor order |
| Notes | Paragraph | Tidak | Catatan tambahan |
| Assign To | Multi-Select | Ya | Pilih staff (1-10) |

### 2. ETA (UREQ)
**Channel:** `#ureq`
**Prefix Thread:** `UREQ-{identifier}-{username}`

| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| Priority | Select | Tidak | Normal, Urgent (default: Normal) |
| Order ID | Text | Ya | Nomor order |
| Notes | Paragraph | Tidak | Catatan tambahan |
| Assign To | Multi-Select | Ya | Pilih staff (1-10) |

### 3. Restock Request
**Channel:** `#pst`
**Prefix Thread:** `RESTOCK-{identifier}-{username}`

| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| Priority | Select | Tidak | Normal, Urgent (default: Normal) |
| Item ID | Text | Ya | ID item yang direstock |
| Order ID | Text | Tidak | Nomor order |
| Notes | Paragraph | Tidak | Catatan tambahan |
| Assign To | Multi-Select | Ya | Pilih staff (1-10) |

### 4. Revive
**Channel:** `#revive`
**Prefix Thread:** `REVIVE-{identifier}-{username}`

| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| Item ID | Text | Ya | ID item yang di-revive |
| Notes | Paragraph | Tidak | Catatan tambahan |
| Assign To | Multi-Select | Ya | Pilih staff (1-10) |

### 5. New DB Request (New Item Preorder)
**Channel:** `#ppo`
**Prefix Thread:** `NEWDB-{username}`

| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| Item Description | Paragraph | Ya | Deskripsi item preorder yang diinginkan |
| Link | Text | Tidak | Link referensi (https://...) |
| Assign To | Multi-Select | Ya | Pilih staff (1-10) |

### 6. Kompensasi
**Channel:** `#kompen`
**Prefix Thread:** `KOMPEN-{username}`

| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| Priority | Select | Tidak | Normal, Urgent (default: Normal) |
| Notes | Paragraph | Tidak | Catatan tambahan |
| Assign To | Multi-Select | Ya | Pilih staff (1-10) |

---

## Fitur Tiket

### 1. Link Otomatis

Jika Anda mengisi **Item ID** atau **Order ID**, sistem akan otomatis membuat link:

- **Item ID** → `https://kyou.id/items/{item_id}`
- **Order ID** → `https://old.kyou.id/admin/order/{order_id}`

### 2. Thread Naming Format

**Jika ada identifier (Item ID atau Order ID):**
```
{PREFIX}-{identifier}-{username}
```

Contoh:
- `PPO-ITEM-001-johndoe`
- `UREQ-ORD-123-janesmith`

**Jika tidak ada identifier:**
```
{PREFIX}-{username}
```

Contoh:
- `REVIVE-johndoe`
- `KOMPEN-janesmith`

### 3. Edit Assignee

**Who can edit:**
- Ticket creator (pembuat tiket)
- Assigned staff (staff yang ditugaskan)

**How to edit:**
1. Klik tombol **"Edit Assignee"** di tiket
2. Pilih staff yang ingin ditugaskan (bisa tambah atau kurangi)
3. Isi alasan perubahan (opsional)
4. Submit

**What happens:**
- Staff baru akan ditambahkan ke thread
- Staff yang dihapus akan di-remove dari thread
- Tiket akan di-update dengan daftar staff terbaru

### 4. Close Ticket & Feedback

**Who can close:** Hanya ticket creator

**How to close:**
1. Klik tombol **"Close Ticket"** di tiket
2. Isi feedback form untuk setiap staff yang ditugaskan:
   - Rating: ⭐ (1-5)
   - Feedback: Opsional

**What happens:**
- Tiket akan di-archive (thread ditutup)
- Semua member di-remove dari thread
- Feedback dikirim ke channel feedback
- Status tiket di database diubah menjadi 'closed'

---

## Priority Levels

| Priority | Warna | Penggunaan |
|----------|-------|------------|
| **Normal** | 🟢 Green | Standard request, normal processing time |
| **Urgent** | 🔴 Red | High priority, perlu attention segera |

---

## Staff Assignment

### Staff Selection Source

Staff diambil dari 2 source (berurutan):

1. **TICKET_USERS** - User assignment spesifik
2. **TICKET_ROLES** - Role-based assignment

### Role Mappings

| Tipe Tiket | Role ID | Channel |
|------------|---------|---------|
| ETA (PPO) | `1300285037241045073`, `1337705127703871488` | #ppo |
| ETA (UREQ) | `1336223205601316936` | #ureq |
| Restock | `1204414544550821978` | #pst |
| Revive | `1204414544550821978` | #revive |
| New DB Request | (same as PPO) | #ppo |
| Kompensasi | (specific users) | #kompen |

### Assigning Multiple Staff

- **Minimum:** 1 staff
- **Maximum:** 10 staff
- Gunakan multi-select untuk memilih beberapa staff sekaligus

---

## Embed Format

Setiap tiket akan menampilkan embed dengan informasi:

```
Purchasing Ticket: ETA (General)
⚡ Priority: Normal/Urgent
🆔 Item ID: ITEM-XXX (jika diisi)
🔗 Item Link: https://kyou.id/items/ITEM-XXX (otomatis)
🛒 Order ID: ORD-XXX (jika diisi)
🔗 Order Link: https://old.kyou.id/admin/order/ORD-XXX (otomatis)
📝 Notes: Catatan tambahan...
🎫 Ticket ID: 123456789
👤 Assigned To: @staff1, @staff2
```

---

## Environment Variables Required

Pastikan `.env` file berisi:

```env
# Purchasing Channels
CHANNEL_PPO=your_ppo_channel_id
CHANNEL_UREQ=your_ureq_channel_id
CHANNEL_PST=your_pst_channel_id
CHANNEL_REVIVE=your_revive_channel_id
CHANNEL_KOMPEN=your_kompen_channel_id

# Feedback Channel (opsional)
CHANNEL_POFB=your_purchasing_feedback_channel_id
```

---

## Best Practices

1. **Isi Order ID dengan lengkap** - Memudahkan staff untuk tracking
2. **Gunakan Priority dengan bijak** - Jangan gunakan Urgent jika tidak benar-benar urgent
3. **Berikan feedback setelah tiket selesai** - Bantu tim improve dengan memberikan rating
4. **Pilih staff yang tepat** - Pertimbangkan workload dan expertise staff
5. **Close tiket setelah selesai** - Jangan biarkan tiket terbuka jika sudah tidak diperlukan

---

## Troubleshooting

### Tiket tidak muncul di channel yang benar
1. Cek apakah `CHANNEL_*` environment variable sudah di-set dengan benar
2. Pastikan bot memiliki permission untuk membuat thread di channel tersebut
3. Cek console log untuk error messages

### Staff tidak muncul di dropdown
1. Pastikan staff memiliki role yang sesuai
2. Cek apakah TICKET_USERS config sudah benar
3. Pastikan bukan bot user

### Thread name terpotong
Discord membatasi thread name maksimal 100 karakter. Nama akan otomatis di-truncate.

### Tidak bisa close tiket
Hanya ticket creator yang bisa close tiket. Pastikan Anda adalah pembuat tiket.

---

## Error Messages

| Error | Penyebab | Solusi |
|-------|----------|--------|
| **Please select at least one staff** | Tidak ada staff yang dipilih | Pilih minimal 1 staff |
| **Only the ticket creator can close this ticket** | Bukan creator yang mencoba close | Hanya creator yang bisa close |
| **Only the ticket creator or assigned staff can edit assignees** | Bukan creator/assignee yang edit | Hanya creator atau staff yang ditugaskan yang bisa edit |
| **No staff available** | Tidak ada staff dengan role yang sesuai | Hubungi admin untuk setup role/staff |

---

*Last Updated: 2026-03-10*
*Version: 1.0.0*
