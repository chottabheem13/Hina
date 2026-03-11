# OP

- Command: `/warehouse-ticket`
- Kategori: `Cek Fisik`
- Ticket value: `op`
- Channel env: `CHANNEL_CEKFISIK`
- Thread prefix: `OP`

## Field

- Wajib: `item_id`, `assigned_to`
- Opsional: `order_id`, `note`

## Cara Buat

1. Jalankan `/warehouse-ticket`
2. Pilih `Cek Fisik`
3. Pilih `OP`
4. Isi `Item ID`
5. Tambahkan `Order ID` bila ada
6. Pilih minimal 1 assignee lalu submit

## Catatan

- Prioritas identifier thread: `item_id` lalu `order_id`
