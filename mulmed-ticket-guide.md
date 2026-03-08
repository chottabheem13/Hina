# Multimedia Ticket System - Guide

## Overview

Multimedia Ticket System adalah sistem ticketing untuk menangani permintaan desain dan printing. Sistem ini dibagi menjadi **5 kategori utama** dengan **23 sub-tipe**.

## Kategori & Sub-tipe

### 1. Digital Design
Channel: `CHANNEL_DIGITAL`
Role: `1480109703408390237` (Multimedia)

| Sub-tipe | Modal ID | Priority | Link | Brief | Additional Output |
|----------|----------|----------|------|-------|-------------------|
| Kolase | `modal_mulmed_kolase` | Optional | Optional | Optional | - |
| Singpost | `modal_mulmed_singpost` | Optional | Optional | Optional | Optional |
| Announcement | `modal_mulmed_announcement` | Optional | Optional | Optional | Optional |
| Monthly Design | `modal_mulmed_monthly_design` | Optional | Optional | Optional | Optional |
| Other | `modal_mulmed_other` | Optional | Optional | Optional | Optional |

**Format Tiket:** `KOLASE-{ticket_id}`

### 2. Single Printing
Channel: `CHANNEL_SINGLEPRINT`
Role: `1480109703408390237` (Multimedia)

| Sub-tipe | Modal ID | Priority | Link | Brief | Size |
|----------|----------|----------|------|-------|------|
| Store Design | `modal_mulmed_store_design` | Required | Optional | Required | Required |
| Standee | `modal_mulmed_standee` | Required | Required | Required | Optional |
| Banner | `modal_mulmed_banner` | Required | Optional | Required | Required |
| Wallpaper | `modal_mulmed_wallpaper` | Required | Optional | Required | Required |
| Other Printing | `modal_mulmed_other_print` | Required | Optional | Optional | Optional |

**Format Tiket:** `STORE-{ticket_id}`, `STANDEE-{ticket_id}`, dll

### 3. Offset Printing
Channel: `CHANNEL_OFFSET`
Role: `1480109703408390237` (Multimedia)

| Sub-tipe | Modal ID | Priority | Link | Brief | Size & QTY |
|----------|----------|----------|------|-------|------------|
| Brosur | `modal_mulmed_brosur` | Required | Optional | Required | Required |
| Kipas | `modal_mulmed_kipas` | Required | Optional | Required | Required |
| Postcard | `modal_mulmed_postcard` | Required | Optional | Required | Required |
| Sticker | `modal_mulmed_sticker` | Required | Optional | Required | Required |
| Paper Bag | `modal_mulmed_paper_bag` | Required | Optional | Required | Required |
| Dus Kyou | `modal_mulmed_dus_kyou` | Required | Optional | Required | Required |
| Other Offset | `modal_mulmed_other_offset` | Required | Optional | Optional | Optional |

**Format Tiket:** `BROSUR-{ticket_id}`, `KIPAS-{ticket_id}`, dll

### 4. Promotional Design
Channel: `CHANNEL_PROMO`
Role: `1480109703408390237` (Multimedia)

| Sub-tipe | Modal ID | Priority | Link | Brief | Deadline / Info |
|----------|----------|----------|------|-------|-----------------|
| Thematic Sale | `modal_mulmed_thematic_sale` | Required | Optional | Required | Required |
| SP Sale | `modal_mulmed_sp_sale` | Required | Optional | Required | Required |
| Campaign | `modal_mulmed_campaign` | Required | Optional | Required | Required |
| Give Away | `modal_mulmed_give_away` | Required | Optional | Required | Required |

**Format Tiket:** `THEMATIC-{ticket_id}`, `SPSALE-{ticket_id}`, dll

**Catatan Brief:** Harap sertakan Hero Link untuk Thematic Sale dan SP Sale.

### 5. Event Design
Channel: `CHANNEL_EVENT`
Role: `1480109703408390237` (Multimedia)

| Sub-tipe | Modal ID | Priority | Link | Brief | Deadline / Info |
|----------|----------|----------|------|-------|-----------------|
| Event | `modal_mulmed_event` | Required | Optional | Required | Required |
| Project | `modal_mulmed_project` | Required | Optional | Required | Optional |

**Format Tiket:** `EVENT-{ticket_id}`, `PROJECT-{ticket_id}`

## Field Penjelasan

### Priority
- **Options:** Normal, Urgent
- **Default:** Normal (jika tidak dipilih)
- **Display:** Ditampilkan sebagai field di embed tiket

### Link
- **Format:** URL (https://...)
- **Usage:** Referensi desain, contoh, atau inspirasi

### Brief
- **Format:** Paragraph text
- **Usage:** Deskripsi detail requirements

### Size / Size & QTY
- **Format:** Text input
- **Usage:** Dimensi atau ukuran + quantity untuk printing

### Deadline / Additional Info
- **Format:** Text input
- **Usage:** Tenggat waktu atau informasi tambahan

### Additional Output
- **Format:** Text input
- **Usage:** Output tambahan yang dibutuhkan

### Assigned To
- **Type:** Multi-select dropdown
- **Options:** Semua member dengan role `1480109703408390237`
- **Limit:** Max 10 staff
- **Default:** Tidak ada default (harus dipilih)

## Alur Kerja

### 1. User membuat tiket
```
User: /mulmed-ticket
Bot: Show dropdown 5 kategori
User: Pilih kategori (misal: Digital Design)
Bot: Show dropdown sub-tipe
User: Pilih sub-tipe (misal: Kolase)
Bot: Show modal form
User: Isi form dan submit
```

### 2. Bot membuat tiket
- Create thread di channel sesuai kategori
- Generate embed dengan detail tiket
- Assign ke staff yang dipilih
- Tag staff yang ditunjuk
- Simpan ke database

### 3. Staff bekerja
- Staff yang di-assign dapat mengedit assignee lain
- Hanya staff yang di-assign atau creator yang bisa edit

### 4. Feedback
- User mengirim feedback
- Feedback di-rute ke `CHANNEL_FEEDBACKMULMED`
- Staff dinilai berdasarkan feedback

## Database Schema

```sql
CREATE TABLE tickets (
  id VARCHAR(255) PRIMARY KEY,  -- Thread ID
  type VARCHAR(100),             -- mulmed_kolase, mulmed_brosur, dll
  status VARCHAR(20),            -- open, closed
  priority VARCHAR(20),          -- normal, urgent
  created_by VARCHAR(255),        -- User ID creator
  created_at TIMESTAMP,
  item_id INT,
  order_id INT,
  notes TEXT,
  brief TEXT,
  link TEXT,
  size_qty TEXT,
  size_placement TEXT,
  deadline_info TEXT
);

CREATE TABLE ticket_assignees (
  ticket_id VARCHAR(255),
  user_id VARCHAR(255),
  PRIMARY KEY (ticket_id, user_id),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);
```

## Role & Permission

### Role Configuration
```javascript
TICKET_ROLES = {
  // Semua multimedia sub-tipe menggunakan role yang sama
  mulmed_kolase: ['1480109703408390237'],
  mulmed_singpost: ['1480109703408390237'],
  // ... semua 23 sub-tipe
}
```

### Permissions

| Action | Creator | Assigned Staff | Others |
|--------|---------|----------------|--------|
| View Ticket | ✅ | ✅ | ✅ |
| Reply to Ticket | ✅ | ✅ | ✅ |
| Edit Assignees | ✅ | ✅ | ❌ |
| Close Ticket | ✅ | ✅ | ❌ |
| Give Feedback | ✅ | - | ❌ |

## Channel Configuration

| Channel ID | Purpose |
|------------|---------|
| `CHANNEL_DIGITAL` | Digital Design tickets |
| `CHANNEL_SINGLEPRINT` | Single Printing tickets |
| `CHANNEL_OFFSET` | Offset Printing tickets |
| `CHANNEL_PROMO` | Promotional Design tickets |
| `CHANNEL_EVENT` | Event Design tickets |
| `CHANNEL_FEEDBACKMULMED` | Multimedia ticket feedback |

## Contoh Embed Tiket

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ticket: Multimedia Ticket - Kolase
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Created by: username#1234 (123456789)
Created at: 2026-03-08 10:30:00

Priority: Normal
Link: https://example.com/reference
Brief: Mohon buat kolase untuk campaign sale

Assigned To: @staff1 @staff2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Commands

### Slash Commands
- `/mulmed-ticket` - Buat multimedia ticket baru

### Button Actions
- **Edit Assignees** - Ubah staff yang ditugaskan (creator & assigned staff only)
- **Close Ticket** - Tutup tiket (creator & assigned staff only)

## Troubleshooting

### Staff tidak muncul di dropdown
**Solusi:** Pastikan staff memiliki role `1480109703408390237`

### Tiket masuk ke channel yang salah
**Solusi:** Cek mapping di `getChannelForTicket()` function

### Feedback tidak muncul di channel yang benar
**Solusi:** Pastikan `CHANNEL_FEEDBACKMULMED` sudah di-set di .env

### Field tidak muncul di modal
**Solusi:** Discord batas 5 field per modal, field dikombinasikan jika melebihi

## File Reference

### Core Files
- `commands/multimedia-ticket.js` - Slash command handler
- `modals/ticketModals.js` - Modal form definitions
- `index.js` - Main bot logic & interaction handlers

### Configuration
- `.env` - Environment variables (channel IDs, tokens)
- `package.json` - Dependencies

## Quick Reference: Thread Naming

| Prefix | Sub-tipe |
|--------|----------|
| KOLASE | Kolase |
| SINGPOST | Singpost |
| ANNOUNCE | Announcement |
| MONTHLY | Monthly Design |
| OTHER | Other (Digital) |
| STORE | Store Design |
| STANDEE | Standee |
| BANNER | Banner |
| WALLPAPER | Wallpaper |
| OTHERPRT | Other Printing |
| BROSUR | Brosur |
| KIPAS | Kipas |
| POSTCARD | Postcard |
| STICKER | Sticker |
| PAPERBAG | Paper Bag |
| DUSKYOU | Dus Kyou |
| OTHEROFF | Other Offset |
| THEMATIC | Thematic Sale |
| SPSALE | SP Sale |
| CAMPAIGN | Campaign |
| GIVEAWAY | Give Away |
| EVENT | Event |
| PROJECT | Project |

---

*Dokumentasi ini dibuat untuk Multimedia Ticket System v1.0*
*Last updated: 2026-03-08*
