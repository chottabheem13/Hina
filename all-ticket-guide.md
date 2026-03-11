# Complete Ticket Guide

## Overview

Panduan ini merangkum semua ticket yang saat ini didukung bot:

- Purchasing: 6 tipe
- Multimedia: 23 sub-type
- Warehouse: 14 sub-type

Total: **43 tipe ticket**

Panduan ini disusun dari implementasi aktif di:

- `commands/*.js`
- `modals/ticketModals.js`
- `index.js`

---

## Slash Commands

Gunakan slash command berikut di Discord:

- `/purchasing-ticket`
- `/mulmed-ticket`
- `/warehouse-ticket`

---

## Alur Umum

### Purchasing
1. Jalankan `/purchasing-ticket`
2. Pilih tipe ticket
3. Isi modal
4. Pilih minimal 1 assignee
5. Bot membuat thread di channel tujuan

### Multimedia
1. Jalankan `/mulmed-ticket`
2. Pilih kategori
3. Pilih sub-type
4. Isi modal
5. Pilih minimal 1 assignee
6. Bot membuat thread di channel tujuan

### Warehouse
1. Jalankan `/warehouse-ticket`
2. Pilih kategori
3. Pilih sub-type
4. Isi modal
5. Pilih minimal 1 assignee
6. Bot membuat thread di channel tujuan

---

## Purchasing Tickets

### Ringkasan

| Tipe | Value | Channel Env | Thread Prefix | Field Utama |
|------|-------|-------------|---------------|-------------|
| ETA (PO) | `eta_ppo` | `CHANNEL_PPO` | `PPO` | priority, item_id opsional, order_id wajib, notes opsional |
| ETA (UREQ) | `eta_ureq` | `CHANNEL_UREQ` | `UREQ` | priority, order_id wajib, notes opsional |
| Restock | `restock` | `CHANNEL_PST` | `RESTOCK` | priority, item_id wajib, order_id opsional, notes opsional |
| Revive | `revive` | `CHANNEL_REVIVE` | `REVIVE` | item_id wajib, notes opsional |
| New Item (Pre-order) | `new_item_preorder` | `CHANNEL_PPO` | `NEWDB` | item description wajib, link opsional |
| Kompensasi | `kompen` | `CHANNEL_KOMPEN` | `KOMPEN` | priority, order_id wajib, description wajib |

### Detail Field

#### ETA (PO)
- Priority: opsional, default `Normal`
- Item ID: opsional
- Order ID: wajib
- Notes: opsional
- Assign To: wajib

#### ETA (UREQ)
- Priority: opsional, default `Normal`
- Order ID: wajib
- Notes: opsional
- Assign To: wajib

#### Restock
- Priority: opsional, default `Normal`
- Item ID: wajib
- Order ID: opsional
- Notes: opsional
- Assign To: wajib

#### Revive
- Item ID: wajib
- Notes: opsional
- Assign To: wajib

#### New Item (Pre-order)
- Item Description: wajib
- Link: opsional
- Assign To: wajib

#### Kompensasi
- Priority: opsional, default `Normal`
- Order ID: wajib
- Description: wajib
- Assign To: wajib

---

## Multimedia Tickets

### Kategori dan Channel

| Kategori | Value | Channel Env |
|----------|-------|-------------|
| Digital Design | `digital_design` | `CHANNEL_KOLASE` untuk Kolase, `CHANNEL_DIGITAL` untuk subtype lain |
| Single Printing | `single_printing` | `CHANNEL_SINGLEPRINT` |
| Offset Printing | `offset_printing` | `CHANNEL_OFFSET` |
| Promotional Design | `promotional_design` | `CHANNEL_PROMO` |
| Event Design | `event_design` | `CHANNEL_EVENT` |

### Digital Design

| Sub-Type | Value | Prefix | Field Utama |
|----------|-------|--------|-------------|
| Kolase | `kolase` | `KOLASE` | priority opsional, link opsional, brief opsional |
| Singpost | `singpost` | `SINGPOST` | priority opsional, link opsional, brief opsional |
| Announcement | `announcement` | `ANNOUNCE` | priority opsional, link opsional, brief opsional |
| Monthly Design | `monthly_design` | `MONTHLY` | priority opsional, link opsional, brief opsional |
| Other | `other` | `OTHER-DIGI` | priority opsional, link opsional, brief opsional |

### Single Printing

| Sub-Type | Value | Prefix | Field Utama |
|----------|-------|--------|-------------|
| Store Design | `store_design` | `STORE` | priority opsional, link opsional, brief wajib |
| Standee | `standee` | `STANDEE` | priority opsional, link wajib, brief wajib, size opsional |
| Banner | `banner` | `BANNER` | priority opsional, link opsional, brief wajib, size wajib |
| Wallpaper | `wallpaper` | `WALLPAPER` | priority opsional, link opsional, brief wajib, size wajib |
| Other Printing | `other_print` | `OTHER-PRINT` | priority opsional, link opsional, brief opsional |

### Offset Printing

| Sub-Type | Value | Prefix | Field Utama |
|----------|-------|--------|-------------|
| Brosur | `brosur` | `BROSUR` | priority opsional, link opsional, brief wajib |
| Kipas | `kipas` | `KIPAS` | priority opsional, link opsional, brief wajib |
| Postcard | `postcard` | `POSTCARD` | priority opsional, link opsional, brief wajib |
| Sticker | `sticker` | `STICKER` | priority opsional, link opsional, brief wajib |
| Paper Bag | `paper_bag` | `PAPERBAG` | priority opsional, link opsional, brief wajib |
| Dus Kyou | `dus_kyou` | `DUSKYOU` | priority opsional, link opsional, brief wajib |
| Other Offset | `other_offset` | `OTHER-OFFSET` | priority opsional, link opsional, brief opsional |

### Promotional Design

| Sub-Type | Value | Prefix | Field Utama |
|----------|-------|--------|-------------|
| Thematic Sale | `thematic_sale` | `THEMATIC` | priority opsional, link opsional, brief wajib |
| SP Sale | `sp_sale` | `SPSALE` | priority opsional, link opsional, brief wajib |
| Campaign | `campaign` | `CAMPAIGN` | priority opsional, link opsional, brief wajib |
| Give Away | `give_away` | `GIVEAWAY` | priority opsional, link opsional, brief wajib |

### Event Design

| Sub-Type | Value | Prefix | Field Utama |
|----------|-------|--------|-------------|
| Event | `event` | `EVENT` | priority opsional, link opsional, brief wajib |
| Project | `project` | `PROJECT` | priority opsional, link opsional, brief opsional |

### Catatan Multimedia

- Semua multimedia ticket mewajibkan `Assign To`
- Semua subtype mendukung `Priority` kecuali field tersebut tetap opsional
- `Kolase`, `Singpost`, dan `Monthly Design` punya assignment user spesifik di `TICKET_USERS`
- Beberapa subtype menampilkan specialist note dari `TICKET_SPECIAL_NOTES`

---

## Warehouse Tickets

### Kategori dan Channel

| Kategori | Value | Channel Env |
|----------|-------|-------------|
| Cek Fisik | `cek_fisik` | `CHANNEL_CEKFISIK` |
| Pindah Fisik | `pindah_fisik` | `CHANNEL_PINDAHFISIK` |
| WH Pick | `wh_pick` | `CHANNEL_WHPICK` |
| WH Stock Management | `wh_stock_mgmt` | `CHANNEL_WHSTOCKMANAGEMENT` |

### Cek Fisik

| Sub-Type | Value | Prefix | Field Utama |
|----------|-------|--------|-------------|
| Omega | `omega` | `OMEGA` | item_id wajib, order_id opsional, note opsional |
| Delta | `delta` | `DELTA` | item_id wajib, order_id opsional, note opsional |
| SS | `ss` | `SS` | item_id wajib, order_id opsional, note opsional |
| OP | `op` | `OP` | item_id wajib, order_id opsional, note opsional |

### Pindah Fisik

| Sub-Type | Value | Prefix | Field Utama |
|----------|-------|--------|-------------|
| WSR | `wsr` | `WSR` | store_name wajib, batch wajib, note opsional |
| Pickup Pelunasan | `pickup_pelunasan` | `PICKUP` | store_name wajib, order_id wajib, note opsional |
| Retur Monitor | `return_monitor` | `RETMON` | order_id wajib, note wajib |
| BDE | `bde` | `BDE` | batch wajib, note opsional |

### WH Pick

| Sub-Type | Value | Prefix | Field Utama |
|----------|-------|--------|-------------|
| Dachi | `dachi` | `DACHI` | item_id wajib, order_id opsional, notes opsional |
| Give Away | `give_away` | `GIVEAWAY` | item_id wajib, notes wajib |
| Other | `wh_pick_other` | `WH-PICK` | item_id wajib, order_id opsional, notes wajib |

### WH Stock Management

| Sub-Type | Value | Prefix | Field Utama |
|----------|-------|--------|-------------|
| WS Kor | `ws_kor` | `WS-KOR` | item_id wajib, notes wajib |
| Adjust Stock (QTY) | `adjust_stock_qty` | `ADJ-QTY` | item_id wajib, order_id opsional, notes wajib |
| Adjust Stock (Transfer) | `adjust_stock_transfer` | `ADJ-XFER` | item_id wajib, order_id opsional, notes wajib |

### Store Name Options

Field `store_name` memakai opsi berikut:

- `alpha` => Alpha
- `beta` => Beta
- `gamma` => Gamma

---

## Thread Naming

### Purchasing

Format umum:

```text
{PREFIX}-{identifier}-{username}
```

Jika tidak ada identifier:

```text
{PREFIX}-{username}
```

Identifier biasanya mengambil `item_id` atau `order_id`.

### Multimedia

Format:

```text
{PREFIX}-{username}
```

### Warehouse

Format:

```text
{PREFIX}-{identifier}-{username}
```

Prioritas identifier:

1. `item_id`
2. `order_id`
3. tanpa identifier

---

## Link Otomatis

Jika field berikut diisi, bot akan membuat link otomatis di embed:

- Item ID: `https://kyou.id/items/{item_id}`
- Order ID: `https://old.kyou.id/admin/order/{order_id}`

Ini berlaku untuk ticket yang memang memiliki field `item_id` atau `order_id`.

---

## Assignment Rules

- Semua ticket mewajibkan minimal 1 assignee
- Bot membatasi pilihan assignee maksimal 10 user
- Sumber assignee:
  - `TICKET_USERS` lebih diprioritaskan
  - jika kosong, bot fallback ke `TICKET_ROLES`

### Role-Based Notes

- Purchasing memakai kombinasi role dan user spesifik tergantung tipe
- Multimedia umumnya memakai role `1336185533965144148`
- Warehouse memakai role per kategori, dengan `WH Stock Management` berbagi role yang sama untuk semua subtype

---

## Edit Assignee dan Close Ticket

### Edit Assignee

Bisa dilakukan oleh:

- pembuat ticket
- staff yang sedang di-assign

Field edit:

- `Assign To` wajib
- `Edit Notes` opsional

### Close Ticket

Yang bisa close:

- pembuat ticket

Saat close, bot akan:

- meminta feedback per assignee
- mengirim feedback ke channel feedback terkait
- mengubah status ticket menjadi `closed`
- mengarsipkan thread

### Feedback Channel Env

- Purchasing dan multimedia memakai channel feedback terpisah di environment
- Warehouse memakai `CHANNEL_WHFEEDBACK`

---

## Environment Variables

Pastikan `.env` memuat channel berikut:

```env
CHANNEL_PPO=
CHANNEL_UREQ=
CHANNEL_PST=
CHANNEL_REVIVE=
CHANNEL_KOMPEN=

CHANNEL_KOLASE=
CHANNEL_DIGITAL=
CHANNEL_SINGLEPRINT=
CHANNEL_OFFSET=
CHANNEL_PROMO=
CHANNEL_EVENT=

CHANNEL_CEKFISIK=
CHANNEL_PINDAHFISIK=
CHANNEL_WHPICK=
CHANNEL_WHSTOCKMANAGEMENT=

CHANNEL_WHFEEDBACK=
CHANNEL_FEEDBACK=
CHANNEL_FEEDBACKMULMED=
```

---

## Quick Reference

### Ticket yang memakai Item ID

- Purchasing: ETA (PO) opsional, Restock wajib, Revive wajib
- Warehouse: hampir semua subtype Cek Fisik, WH Pick, dan WH Stock Management

### Ticket yang memakai Order ID

- Purchasing: ETA (PO), ETA (UREQ), Restock opsional, Kompensasi
- Warehouse: Cek Fisik opsional, Pickup Pelunasan wajib, Retur Monitor wajib, beberapa subtype lain opsional

### Ticket yang memakai Store Name

- Warehouse: WSR, Pickup Pelunasan

### Ticket yang berbasis Brief

- Hampir semua multimedia subtype

---

## Notes

- Nama command multimedia yang aktif adalah `/mulmed-ticket`, bukan `/multimedia-ticket`
- Channel Kolase dipisah ke `CHANNEL_KOLASE`
- Kategori `Event Design` aktif dan memakai `CHANNEL_EVENT`
- Guide lama per divisi masih ada, tetapi panduan ini mengikuti implementasi bot yang aktif saat ini
