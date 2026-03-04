# Purchasing Tickets API Documentation

## Base URL

```
https://api.kyou.id/v2/rest
```

## Authentication

All API requests require an API key in the `Authorization` header:

```
Authorization: Bearer lyn_4ebdb660df26a0e36409254778c00ff068ed5620d9eaeacfa2e525bf75b1bb1f
```

---

## Table Structures

### `purchasing_tickets`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | VARCHAR(40) | NO | - | Primary key (UUID or custom ID) |
| `type` | ENUM | NO | - | `eta_ppo`, `eta_ureq`, `restock`, `revive`, `new_item`, `kompen` |
| `status` | ENUM | YES | `open` | `open`, `closed` |
| `priority` | ENUM | YES | `normal` | `normal`, `urgent` |
| `item_id` | INT | YES | NULL | Related item ID |
| `order_id` | INT | YES | NULL | Related order ID |
| `notes` | VARCHAR(1000) | YES | NULL | Additional notes |
| `created_by` | VARCHAR(40) | NO | - | Creator's Discord ID |
| `created_by_name` | VARCHAR(50) | NO | - | Creator's display name |
| `assigned_to` | JSON | NO | - | Array of assignee objects |
| `created_at` | DATETIME | YES | CURRENT_TIMESTAMP | Creation timestamp |
| `closed_at` | DATETIME | YES | NULL | Closure timestamp |

### `purchasing_ticket_feedbacks`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | INT | NO | AUTO_INCREMENT | Primary key |
| `ticket_id` | VARCHAR(40) | NO | - | Foreign key to `purchasing_tickets.id` |
| `assignee_id` | VARCHAR(40) | NO | - | Assignee's Discord ID |
| `assignee_name` | VARCHAR(50) | NO | - | Assignee's display name |
| `rating` | TINYINT | NO | - | Rating 1-5 |
| `feedback` | VARCHAR(500) | YES | NULL | Feedback text |
| `submitted_by` | VARCHAR(40) | NO | - | Submitter's Discord ID |
| `submitted_by_name` | VARCHAR(50) | NO | - | Submitter's display name |
| `created_at` | DATETIME | YES | CURRENT_TIMESTAMP | Submission timestamp |

---

## Endpoints

### Get Data

```
GET /:table/data
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | int | 100 | Max rows to return (max 1000) |
| `offset` | int | 0 | Number of rows to skip |

**Example Request:**
```bash
curl -X GET "https://api.kyou.id/v2/rest/purchasing_tickets/data?limit=10&offset=0" \
  -H "Authorization: Bearer lyn_your_api_key_here"
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "TKT-001",
      "type": "restock",
      "status": "open",
      "priority": "urgent",
      "item_id": 12345,
      "order_id": null,
      "notes": "Need to restock ASAP",
      "created_by": "650331064304271370",
      "created_by_name": "John",
      "assigned_to": "[{\"id\": \"123\", \"name\": \"Alice\"}]",
      "created_at": "2026-03-04T10:00:00+07:00",
      "closed_at": null
    }
  ],
  "table": "purchasing_tickets",
  "count": 1
}
```

---

### Insert Data (Single Row)

```
POST /:table/data
```

**Example Request:**
```bash
curl -X POST "https://api.kyou.id/v2/rest/purchasing_tickets/data" \
  -H "Authorization: Bearer lyn_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "TKT-001",
    "type": "restock",
    "priority": "urgent",
    "item_id": 12345,
    "notes": "Need to restock ASAP",
    "created_by": "650331064304271370",
    "created_by_name": "John",
    "assigned_to": "[{\"id\": \"123456789\", \"name\": \"Alice\"}]"
  }'
```

**Example Response:**
```json
{
  "message": "Row inserted",
  "table": "purchasing_tickets",
  "inserted_id": 0
}
```

> Note: `inserted_id` is 0 for tables with VARCHAR primary keys

---

### Insert Data (Batch)

```
POST /:table/data
```

Wrap rows in a `data` array for batch insert:

**Example Request:**
```bash
curl -X POST "https://api.kyou.id/v2/rest/purchasing_tickets/data" \
  -H "Authorization: Bearer lyn_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      {
        "id": "TKT-002",
        "type": "new_item",
        "priority": "normal",
        "item_id": 12346,
        "created_by": "650331064304271370",
        "created_by_name": "John",
        "assigned_to": "[]"
      },
      {
        "id": "TKT-003",
        "type": "eta_ppo",
        "priority": "normal",
        "order_id": 5001,
        "created_by": "650331064304271370",
        "created_by_name": "John",
        "assigned_to": "[{\"id\": \"987654321\", \"name\": \"Bob\"}]"
      }
    ]
  }'
```

**Example Response:**
```json
{
  "message": "Batch insert completed",
  "inserted": 2,
  "table": "purchasing_tickets"
}
```

---

### Insert Feedback

```bash
curl -X POST "https://api.kyou.id/v2/rest/purchasing_ticket_feedbacks/data" \
  -H "Authorization: Bearer lyn_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "TKT-001",
    "assignee_id": "123456789",
    "assignee_name": "Alice",
    "rating": 5,
    "feedback": "Great job handling this ticket!",
    "submitted_by": "650331064304271370",
    "submitted_by_name": "John"
  }'
```

**Example Response:**
```json
{
  "message": "Row inserted",
  "table": "purchasing_ticket_feedbacks",
  "inserted_id": 1
}
```

---

### Update Data

```
PUT /:table/data
```

**Required Fields:**
- `where` - Object with conditions for filtering rows to update
- Other fields - Values to update

**Example Request:**
```bash
curl -X PUT "https://api.kyou.id/v2/rest/purchasing_tickets/data" \
  -H "Authorization: Bearer lyn_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "where": {
      "id": "TKT-001"
    },
    "status": "closed",
    "closed_at": "2026-03-04T15:00:00+07:00"
  }'
```

**Example Response:**
```json
{
  "message": "Rows updated",
  "table": "purchasing_tickets",
  "affected": 1
}
```

---

## Enum Values Reference

### `purchasing_tickets.type`
| Value | Description |
|-------|-------------|
| `eta_ppo` | ETA PPO request |
| `eta_ureq` | ETA User Request |
| `restock` | Restock request |
| `revive` | Revive item |
| `new_item` | New item request |
| `kompen` | Compensation |

### `purchasing_tickets.status`
| Value | Description |
|-------|-------------|
| `open` | Ticket is open |
| `closed` | Ticket is closed |

### `purchasing_tickets.priority`
| Value | Description |
|-------|-------------|
| `normal` | Normal priority |
| `urgent` | Urgent priority |

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request body",
  "message": "json: cannot unmarshal string into Go value of type int"
}
```

### 401 Unauthorized
```json
{
  "error": "Authorization header required"
}
```

### 403 Forbidden
```json
{
  "error": "Permission denied",
  "message": "You don't have INSERT permission on table 'purchasing_tickets'"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to insert row",
  "message": "Error 1062 (23000): Duplicate entry 'TKT-001' for key 'PRIMARY'"
}
```

---

## Python Example

```python
import requests

API_KEY = "lyn_your_api_key_here"
BASE_URL = "https://api.kyou.id/v2/rest"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Create a ticket
ticket = {
    "id": "TKT-001",
    "type": "restock",
    "priority": "urgent",
    "item_id": 12345,
    "notes": "Urgent restock needed",
    "created_by": "650331064304271370",
    "created_by_name": "John",
    "assigned_to": '[{"id": "123", "name": "Alice"}]'
}

response = requests.post(
    f"{BASE_URL}/purchasing_tickets/data",
    json=ticket,
    headers=headers
)
print(response.json())

# Get tickets
response = requests.get(
    f"{BASE_URL}/purchasing_tickets/data",
    params={"limit": 10},
    headers=headers
)
print(response.json())

# Close a ticket
response = requests.put(
    f"{BASE_URL}/purchasing_tickets/data",
    json={
        "where": {"id": "TKT-001"},
        "status": "closed",
        "closed_at": "2026-03-04T15:00:00+07:00"
    },
    headers=headers
)
print(response.json())
```

