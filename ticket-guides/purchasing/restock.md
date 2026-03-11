# Restock

- Command: `/purchasing-ticket`
- Ticket value: `restock`
- Channel env: `CHANNEL_PST`
- Thread prefix: `RESTOCK`

## Field

- Wajib: `item_id`, `assigned_to`
- Opsional: `priority`, `order_id`, `notes`

## Cara Buat

1. Jalankan `/purchasing-ticket`
2. Pilih `Restock`
3. Isi `Item ID`
4. Isi `Order ID` bila relevan
5. Pilih minimal 1 assignee
6. Submit modal

## Catatan

- `priority` default ke `Normal`
- Embed otomatis membuat link item dan order jika field diisi
