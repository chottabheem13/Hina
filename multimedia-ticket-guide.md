# Multimedia Ticket System Guide

## Overview

Multimedia Ticket System adalah fitur untuk membuat tiket multimedia dengan 24 tipe tiket yang dikelompokkan ke dalam 4 kategori: Digital Design, Single Printing, Offset Printing, dan Promotional Design. Tiket akan membuat thread di channel yang sesuai dengan kategori.

## Cara Membuat Tiket

Gunakan command berikut di Discord:
- `/multimedia-ticket` - Membuat tiket multimedia

Pilih kategori, lalu sub-type yang sesuai, dan isi form yang tersedia.

---

## Kategori & Sub-Types

### 🎨 Digital Design (5 Sub-types)
**Channel:** `#digital`

| Sub-Type | Deskripsi | Prefix |
|----------|-----------|--------|
| **Kolase** | Desain kolase | KOLASE |
| **Singpost** | Desain singpost | SINGPOST |
| **Announcement** | Announcement graphic | ANNOUNCE |
| **Monthly Design** | Desain bulanan | MONTHLY |
| **Other** | Digital design lainnya | DIGITAL |

**Fields yang sama untuk semua Digital Design:**

| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| Priority | Select | Tidak | Normal, Urgent |
| Link | Text | Tidak | Link referensi (https://...) |
| Sub Type | Select | Tidak | Pilih sub-kategori |
| Size | Text | Tidak | Ukuran desain |
| Size & QTY | Text | Tidak | Ukuran & jumlah |
| Deadline / Additional Info | Paragraph | Tidak | Deadline dan info tambahan |
| Brief | Paragraph | Tidak | Deskripsi singkat |
| Assign To | Multi-Select | Ya | Pilih staff (1-10) |

### 🖨️ Single Printing (5 Sub-types)
**Channel:** `#singleprint`

| Sub-Type | Deskripsi | Prefix |
|----------|-----------|--------|
| **Store Design** | Desain toko | STORE |
| **Standee** | Desain standee | STANDEE |
| **Banner** | Desain banner | BANNER |
| **Wallpaper** | Desain wallpaper | WALLPAPER |
| **Other Printing** | Printing lainnya | PRINT |

**Fields yang sama untuk semua Single Printing:**

| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| Priority | Select | Tidak | Normal, Urgent |
| Link | Text | Tidak | Link referensi (https://...) |
| Sub Type | Select | Tidak | Pilih sub-kategori |
| Size | Text | Tidak | Ukuran cetakan |
| Size & QTY | Text | Tidak | Ukuran & jumlah |
| Size / Placement | Text | Tidak | Ukuran & penempatan |
| Deadline / Additional Info | Paragraph | Tidak | Deadline dan info tambahan |
| Brief | Paragraph | Tidak | Deskripsi singkat |
| Assign To | Multi-Select | Ya | Pilih staff (1-10) |

### 📄 Offset Printing (8 Sub-types)
**Channel:** `#offset`

| Sub-Type | Deskripsi | Prefix |
|----------|-----------|--------|
| **Brosur** | Brosur | BROSUR |
| **Kipas** | Kipas | KIPAS |
| **Postcard** | Kartu pos | POSTCARD |
| **Sticker** | Sticker | STICKER |
| **Paper Bag** | Paper bag | PAPERBAG |
| **Dus Kyou** | Dus Kyou | DUS |
| **Other Offset** | Offset lainnya | OFFSET |

**Fields yang sama untuk semua Offset Printing:**

| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| Priority | Select | Tidak | Normal, Urgent |
| Link | Text | Tidak | Link referensi (https://...) |
| Size / Placement | Text | Tidak | Ukuran & penempatan |
| Deadline / Additional Info | Paragraph | Tidak | Deadline dan info tambahan |
| Brief | Paragraph | Tidak | Deskripsi singkat |
| Assign To | Multi-Select | Ya | Pilih staff (1-10) |

### 🎁 Promotional Design (6 Sub-types)
**Channel:** `#digital`

| Sub-Type | Deskripsi | Prefix |
|----------|-----------|--------|
| **Thematic Sale** | Desain sale tematik | THEMATIC |
| **SP Sale** | SP Sale | SP SALE |
| **Campaign** | Campaign kampanye | CAMPAIGN |
| **Give Away** | Give away | GIVEAWAY |
| **Event** | Event design | EVENT |
| **Project** | Project design | PROJECT |

**Fields yang sama untuk semua Promotional:**

| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| Priority | Select | Tidak | Normal, Urgent |
| Link | Text | Tidak | Link referensi (https://...) |
| Deadline / Additional Info | Paragraph | Tidak | Deadline dan info tambahan |
| Brief | Paragraph | Tidak | Deskripsi singkat |
| Assign To | Multi-Select | Ya | Pilih staff (1-10) |

---

## Thread Naming Format

```
{PREFIX}-{username}
```

Contoh:
- `KOLASE-johndoe`
- `STORE-janesmith`
- `BANNER-alexwu`

---

## Common Fields (All Multimedia Tickets)

### Priority (Dropdown)
- `normal` - Standard priority (🟢 Green)
- `urgent` - High priority (🔴 Red)

### Link
- Type: Text Input
- Format: URL (https://...)
- Digunakan untuk: Referensi desain, contoh, dll

### Brief
- Type: Paragraph (multi-line text)
- Digunakan untuk: Deskripsi singkat kebutuhan desain

### Deadline / Additional Info
- Type: Paragraph (multi-line text)
- Digunakan untuk: Deadline, informasi tambahan, dll

### Size / Placement
- Type: Text Input
- Digunakan untuk: Ukuran dan penempatan desain

### Assign To (Multi-Select)
- Minimum: 1 staff
- Maximum: 10 staff
- Source: Role-based assignment (Role ID: `1336185533965144148`)

---

## Special Notes

Beberapa tipe tiket memiliki **Special Notes** yang akan ditampilkan di modal:

| Tipe Tiket | Special Note |
|------------|--------------|
| Kolase | Specialist staff yang tersedia |
| Singpost | Specialist staff yang tersedia |

Special notes ditampilkan untuk membantu user memilih staff yang tepat.

---

## Fitur Tiket

### 1. Edit Assignee

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

### 2. Close Ticket & Feedback

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

Staff diambil dari role:
- **Role ID:** `1336185533965144148`
- Semua multimedia ticket types menggunakan role yang sama

### Specific User Assignments (TICKET_USERS)

Beberapa tipe tiket memiliki user assignment spesifik:

| Tipe Tiket | Staff IDs |
|------------|-----------|
| Kolase | `463834579799638056`, `286790867329613824` |
| Singpost | `463834579799638056`, `915811508561272894` |
| Monthly Design | `463834579799638056`, `915811508561272894` |

### Assigning Multiple Staff

- **Minimum:** 1 staff
- **Maximum:** 10 staff
- Gunakan multi-select untuk memilih beberapa staff sekaligus

---

## Channel Mapping

| Kategori | Environment Variable | Channel Name |
|----------|---------------------|--------------|
| Digital Design | `CHANNEL_DIGITAL` | #digital |
| Single Printing | `CHANNEL_SINGLEPRINT` | #singleprint |
| Offset Printing | `CHANNEL_OFFSET` | #offset |

---

## Embed Format

Setiap tiket akan menampilkan embed dengan informasi:

```
Multimedia Ticket: Kolase
⚡ Priority: Normal/Urgent
🔗 Link: https://...
📋 Sub Type: [sub-kategori]
📏 Size: [ukuran]
📊 Size & QTY: [ukuran & jumlah]
📅 Deadline / Additional Info: [deadline & info]
📝 Brief: Deskripsi singkat...
🎫 Ticket ID: 123456789
👤 Assigned To: @staff1, @staff2
```

---

## Environment Variables Required

Pastikan `.env` file berisi:

```env
# Multimedia Channels
CHANNEL_DIGITAL=your_digital_channel_id
CHANNEL_SINGLEPRINT=your_singleprint_channel_id
CHANNEL_OFFSET=your_offset_channel_id

# Feedback Channel (opsional)
CHANNEL_MULMEDFB=your_multimedia_feedback_channel_id
```

---

## Troubleshooting

### Tiket tidak muncul di channel yang benar
1. Cek apakah `CHANNEL_*` environment variable sudah di-set dengan benar
2. Pastikan bot memiliki permission untuk membuat thread di channel tersebut
3. Cek console log untuk error messages

### Staff tidak muncul di dropdown
1. Pastikan staff memiliki role multimedia (`1336185533965144148`)
2. Cek apakah user bukan bot

### Special notes tidak muncul
1. Pastikan sub-type terdaftar di TICKET_SPECIAL_NOTES
2. Cek configuration di index.js

---

## Best Practices

1. **Berikan deskripsi yang jelas** - Semakin detail brief, semakin cepat staff bisa memproses
2. **Gunakan Priority dengan bijak** - Jangan gunakan Urgent jika tidak benar-benar urgent
3. **Sertakan referensi** - Link contoh desain sangat membantu staff
4. **Tentukan ukuran dengan jelas** - Hindari kesalahan cetak dengan size yang spesifik
5. **Berikan feedback** - Bantu tim improve dengan memberikan rating setelah tiket selesai
6. **Close tiket setelah selesai** - Jangan biarkan tiket terbuka jika sudah tidak diperlukan

---

## Error Messages

| Error | Penyebab | Solusi |
|-------|----------|--------|
| **Please select at least one staff** | Tidak ada staff yang dipilih | Pilih minimal 1 staff |
| **Only the ticket creator can close this ticket** | Bukan creator yang mencoba close | Hanya creator yang bisa close |
| **Only the ticket creator or assigned staff can edit assignees** | Bukan creator/assignee yang edit | Hanya creator atau staff yang ditugaskan yang bisa edit |
| **No staff available** | Tidak ada staff dengan role multimedia | Hubungi admin untuk setup role/staff |

---

*Last Updated: 2026-03-10*
*Version: 1.0.0*
