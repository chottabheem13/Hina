# ETA (PO)

- Command: `/purchasing-ticket`
- Ticket value: `eta_ppo`
- Channel env: `CHANNEL_PPO`
- Thread prefix: `PPO`

## Field

- Wajib: `order_id`, `assigned_to`
- Opsional: `priority`, `item_id`, `notes`

## Cara Buat

1. Jalankan `/purchasing-ticket`
2. Pilih `ETA (PO)`
3. Isi `Order ID`
4. Tambahkan `Item ID` jika ada
5. Pilih minimal 1 assignee
6. Submit modal

## Catatan

- `priority` default ke `Normal`
- Jika `item_id` diisi, embed akan memuat link item
- Jika `order_id` diisi, embed akan memuat link order
