# Warehouse Ticket System Guide

## Overview

Warehouse Ticket System adalah fitur untuk membuat tiket warehouse dengan 4 kategori dan 13 sub-type. Tiket akan membuat thread di channel yang sesuai dengan kategori dan menugaskan staff terkait.

## Cara Membuat Tiket

Gunakan command berikut di Discord:
- `/wh-ticket` - Membuat tiket warehouse

Pilih **Kategori** dari dropdown, lalu **Sub-Type**, dan isi form yang tersedia.

---

## Kategori & Sub-Types

### 📦 Cek Fisik (4 Sub-types)
**Channel:** `#cek-fisik`
**Thread Prefix:** `{PREFIX}-{item_id/order_id}-{username}`

| Sub-Type | Deskripsi | Prefix |
|----------|-----------|--------|
| **Omega** | Cek Fisik - Omega | OMEGA |
| **Delta** | Cek Fisik - Delta | DELTA |
| **SS** | Cek Fisik - SS | SS |
| **OP** | Cek Fisik - OP | OP |

**Fields yang sama untuk semua Cek Fisik:**

| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| **Item ID** | Text | ✅ Ya | ID item yang akan dicek |
| **Order ID** | Text | ❌ Tidak | Order ID terkait |
| **Note** | Paragraph | ❌ Tidak | Catatan tambahan |
| **Assign To** | Multi-Select | ✅ Ya | Pilih staff (1-10) |

**Contoh Thread Name:**
- `OMEGA-ITEM-001-johndoe` (ada Item ID)
- `DELTA-ORD-123-janesmith` (ada Order ID, tidak ada Item ID)
- `SS-alexwu` (tidak ada keduanya)

---

### 🔄 Pindah Fisik (4 Sub-types)
**Channel:** `#pindah-fisik`

| Sub-Type | Deskripsi | Prefix | Item ID | Order ID | Note |
|----------|-----------|--------|---------|----------|------|
| **WSR** | Pindah Fisik - WSR | WSR | ❌ | ❌ | ❌ | Store Name ✅ | Batch ✅ |
| **Pickup Pelunasan** | Pickup Pelunasan | PICKUP | ❌ | ✅ | ❌ | Store Name ✅ |
| **Return Monitor** | Retur Monitor | RETMON | ❌ | ✅ | ✅ | - |
| **BDE** | Pindah Fisik - BDE | BDE | ❌ | ❌ | ❌ | - | Batch ✅ |

#### WSR
| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| **Store Name** | Select | ✅ Ya | Pilih store (Alpha, Beta, Gamma) |
| **Batch** | Text | ✅ Ya | Nomor batch |
| **Note** | Paragraph | ❌ Tidak | Catatan tambahan |
| **Assign To** | Multi-Select | ✅ Ya | Pilih staff (1-10) |

#### Pickup Pelunasan
| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| **Store Name** | Select | ✅ Ya | Pilih store (Alpha, Beta, Gamma) |
| **Order ID** | Text | ✅ Ya | Order ID |
| **Note** | Paragraph | ❌ Tidak | Catatan tambahan |
| **Assign To** | Multi-Select | ✅ Ya | Pilih staff (1-10) |

#### Return Monitor
| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| **Order ID** | Text | ✅ Ya | Order ID |
| **Note** | Paragraph | ✅ Ya | Catatan / keterangan |
| **Assign To** | Multi-Select | ✅ Ya | Pilih staff (1-10) |

#### BDE
| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| **Batch** | Text | ✅ Ya | Nomor batch |
| **Note** | Paragraph | ❌ Tidak | Catatan tambahan |
| **Assign To** | Multi-Select | ✅ Ya | Pilih staff (1-10) |

---

### 📤 WH PICK (3 Sub-types)
**Channel:** `#wh-pick`

| Sub-Type | Deskripsi | Prefix | Item ID | Order ID | Notes |
|----------|-----------|--------|---------|----------|-------|
| **Dachi** | WH Pick - Dachi | DACHI | ✅ | ❌ | ❌ |
| **Give Away** | WH Pick - Give Away | GIVEAWAY | ✅ | ❌ | ✅ |
| **Other** | WH Pick Other | WH-PICK | ✅ | ❌ | ✅ |

#### Dachi
| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| **Item ID** | Text | ✅ Ya | ID item |
| **Order ID** | Text | ❌ Tidak | Order ID |
| **Notes** | Paragraph | ❌ Tidak | Catatan tambahan |
| **Assign To** | Multi-Select | ✅ Ya | Pilih staff (1-10) |

#### Give Away
| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| **Item ID** | Text | ✅ Ya | ID item |
| **Notes** | Paragraph | ✅ Ya | Catatan / keterangan |
| **Assign To** | Multi-Select | ✅ Ya | Pilih staff (1-10) |

#### Other (WH Pick Other)
| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| **Item ID** | Text | ✅ Ya | ID item |
| **Order ID** | Text | ❌ Tidak | Order ID |
| **Notes** | Paragraph | ✅ Ya | Catatan / keterangan |
| **Assign To** | Multi-Select | ✅ Ya | Pilih staff (1-10) |

---

### 📊 WH Stock Management (3 Sub-types)
**Channel:** `#wh-stock-management`

| Sub-Type | Deskripsi | Prefix | Item ID | Order ID | Notes |
|----------|-----------|--------|---------|----------|-------|
| **WS Kor** | WH Stock Management - WS Kor | WS-KOR | ✅ | ❌ | ✅ |
| **Adjust Stock (QTY)** | Adjust Stock berdasarkan Quantity | ADJ-QTY | ✅ | ❌ | ✅ |
| **Adjust Stock (Transfer)** | Adjust Stock berdasarkan Transfer | ADJ-XFER | ✅ | ❌ | ✅ |

#### WS Kor
| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| **Item ID** | Text | ✅ Ya | ID item |
| **Notes** | Paragraph | ✅ Ya | Catatan / keterangan |
| **Assign To** | Multi-Select | ✅ Ya | Pilih staff (1-10) |

#### Adjust Stock (QTY)
| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| **Item ID** | Text | ✅ Ya | ID item |
| **Order ID** | Text | ❌ Tidak | Order ID |
| **Notes** | Paragraph | ✅ Ya | Catatan / keterangan |
| **Assign To** | Multi-Select | ✅ Ya | Pilih staff (1-10) |

#### Adjust Stock (Transfer)
| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| **Item ID** | Text | ✅ Ya | ID item |
| **Order ID** | Text | ❌ Tidak | Order ID |
| **Notes** | Paragraph | ✅ Ya | Catatan / keterangan |
| **Assign To** | Multi-Select | ✅ Ya | Pilih staff (1-10) |

---

## Fitur Utama

### 1. Link Otomatis untuk Item ID & Order ID

Jika Anda mengisi **Item ID** atau **Order ID**, sistem akan otomatis membuat link di embed:

- **Item ID** → Menampilkan field:
  - `Item ID: ITEM-XXX`
  - `Item Link: https://kyou.id/items/ITEM-XXX`

- **Order ID** → Menampilkan field:
  - `Order ID: ORD-XXX`
  - `Order Link: https://old.kyou.id/admin/order/ORD-XXX`

### 2. Thread Naming dengan Identifier

**Format:**
```
{PREFIX}-{identifier}-{username}
```

**Priority identifier:** Item ID > Order ID > Tanpa identifier

**Contoh:**
- `OMEGA-ITEM-KY001-johndoe` (Item ID ada)
- `DELTA-ORD-2024-001-janesmith` (Order ID ada, Item ID tidak ada)
- `WSR-alexwu` (Tidak ada keduanya)

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

**Feedback Embed Title:**
```
Warehouse-Ticket Feedback
```

**What happens:**
- Tiket akan di-archive (thread ditutup)
- Semua member di-remove dari thread
- Feedback dikirim ke channel feedback
- Status tiket di database diubah menjadi 'closed'

---

## Store Name Options

Untuk sub-type yang memiliki field **Store Name** (WSR, Pickup Pelunasan):

| Option | Value | Deskripsi |
|--------|-------|-----------|
| Alpha | `alpha` | Alpha Store |
| Beta | `beta` | Beta Store |
| Gamma | `gamma` | Gamma Store |

---

## Staff Assignment

### Staff Selection Source

Staff diambil dari 2 source (berurutan):

1. **TICKET_USERS** - User assignment spesifik
2. **TICKET_ROLES** - Role-based assignment

### Role Mappings

| Kategori | Role ID | Channel |
|----------|---------|---------|
| Cek Fisik | `1204414986815012906` | #cek-fisik |
| Pindah Fisik | `1204414986815012906` | #pindah-fisik |
| WH PICK | `1204414986815012906` | #wh-pick |
| WH Stock Management | `1481152177492852840` | #wh-stock-management |

### Assigning Multiple Staff

- **Minimum:** 1 staff
- **Maximum:** 10 staff
- Gunakan multi-select untuk memilih beberapa staff sekaligus

---

## Channel Mapping

| Kategori | Environment Variable | Channel Name |
|----------|---------------------|--------------|
| Cek Fisik | `CHANNEL_CEKFISIK` | #cek-fisik |
| Pindah Fisik | `CHANNEL_PINDAHFISIK` | #pindah-fisik |
| WH PICK | `CHANNEL_WHPICK` | #wh-pick |
| WH Stock Management | `CHANNEL_WHSTOCKMANAGEMENT` | #wh-stock-management |

---

## Embed Format

Setiap tiket akan menampilkan embed dengan informasi:

```
Warehouse Ticket: Cek Fisik - Omega
📁 Category: Cek Fisik
🆔 Item ID: ITEM-XXX
🔗 Item Link: https://kyou.id/items/ITEM-XXX
🛒 Order ID: ORD-XXX (jika diisi)
🔗 Order Link: https://old.kyou.id/admin/order/ORD-XXX (jika diisi)
🏪 Store Name: Alpha (jika applicable)
📦 Batch: BATCH-XXX (jika applicable)
📝 Note/Notes: Catatan...
🎫 Ticket ID: 123456789
👤 Assigned To: @staff1, @staff2
```

---

## Environment Variables Required

Pastikan `.env` file berisi:

```env
# Warehouse Channels
CHANNEL_CEKFISIK=your_cek_fisik_channel_id
CHANNEL_PINDAHFISIK=your_pindah_fisik_channel_id
CHANNEL_WHPICK=your_wh_pick_channel_id
CHANNEL_WHSTOCKMANAGEMENT=your_wh_stock_management_channel_id

# Feedback Channel
CHANNEL_WHFEEDBACK=your_warehouse_feedback_channel_id
```

---

## Troubleshooting

### Tiket tidak muncul di channel yang benar
1. Cek apakah `CHANNEL_*` environment variable sudah di-set dengan benar
2. Pastikan bot memiliki permission untuk membuat thread di channel tersebut
3. Cek console log untuk error messages

### Staff tidak muncul di dropdown
1. Pastikan staff memiliki role yang sesuai dengan kategori tiket
2. Cek apakah TICKET_USERS config sudah benar
3. Pastikan bukan bot user

### "Session expired. Please start over."
- Terlalu lama antara pilih sub-type dan submit modal
- Ulangi dari awal (pilih kategori dan sub-type lagi)

### Thread name terpotong
Discord membatasi thread name maksimal 100 karakter. Nama akan otomatis di-truncate.

### Tidak bisa close tiket
Hanya ticket creator yang bisa close tiket. Pastikan Anda adalah pembuat tiket.

---

## Error Messages

| Error | Penyebab | Solusi |
|-------|----------|--------|
| **Session expired** | Terlalu lama antara pilih sub-type dan submit modal | Ulangi dari awal |
| **Target channel not found** | Channel tiket tidak ditemukan | Hubungi admin untuk setup channel |
| **Please select a staff member to assign** | Tidak ada staff yang dipilih | Pilih minimal 1 staff |
| **Only the ticket creator can close this ticket** | Bukan creator yang mencoba close | Hanya creator yang bisa close |
| **Only the ticket creator or assigned staff can edit assignees** | Bukan creator/assignee yang edit | Hanya creator atau staff yang ditugaskan yang bisa edit |
| **No staff available** | Tidak ada staff dengan role yang sesuai | Hubungi admin untuk setup role/staff |

---

## Best Practices

1. **Isi field dengan jelas** - Semakin detail informasi, semakin cepat staff bisa memproses
2. **Gunakan Store Name dengan benar** - Pilih store yang sesuai untuk WSR dan Pickup Pelunasan
3. **Isi Batch number dengan lengkap** - Memudahkan tracking untuk WSR dan BDE
4. **Berikan feedback** - Bantu tim improve dengan memberikan rating dan feedback setelah tiket selesai
5. **Close tiket setelah selesai** - Jangan biarkan tiket terbuka jika sudah tidak diperlukan

---

## Quick Reference Table

| Pattern | Sub-Types | Fields |
|---------|-----------|--------|
| **Pattern A** | Cek Fisik (4) | item_id (req), order_id (opt), note (opt) |
| **Pattern B1** | WSR | store_name (req/select), batch (req), note (opt) |
| **Pattern B2** | Pickup Pelunasan | store_name (req/select), order_id (req), note (opt) |
| **Pattern B3** | Retur Monitor | order_id (req), note (req) |
| **Pattern B4** | BDE | batch (req), note (opt) |
| **Pattern C1** | Dachi | item_id (req), order_id (opt), notes (opt) |
| **Pattern C2** | Give Away | item_id (req), notes (req) |
| **Pattern C3** | Other | item_id (req), order_id (opt), notes (req) |
| **Pattern D1** | WS Kor | item_id (req), notes (req) |
| **Pattern D2** | Adj Stock QTY, Adj Stock Xfer | item_id (req), order_id (opt), notes (req) |

---

*Last Updated: 2026-03-10*
*Version: 2.0.0 - Revised Parameters*
