# PRD: Mornye Purchasing Ticketing System

## Overview

A Discord bot ticketing system for kyou.id purchasing team to manage customer inquiries, order tracking, and compensation requests.

## Problem Statement

The purchasing team needs a structured way to handle various ticket types (ETA checks, restocks, revives, new items, compensation) with proper tracking, assignment, and feedback collection.

## Users

| Role | Description |
|------|-------------|
| **Customer** | Creates tickets, provides feedback on resolution |
| **Staff** | Handles tickets, updates status, resolves issues |
| **Admin** | Manages staff, views analytics, configures bot |

---

## Features

### Phase 1: Core Ticketing (Current)

| Feature | Status | Description |
|---------|--------|-------------|
| `/ticket` command | Done | Single command with dropdown menu |
| Ticket types | Done | ETA (PPO/PST), ETA (UREQ), Restock, Revive, New Item, Kompensasi |
| Thread creation | Done | Auto-creates thread with ticket details |
| Dynamic thread naming | Done | Includes ticket type, item ID, order ID, username |
| Staff assignment | Done | Multi-select dropdown to assign staff on creation |
| Role-based staff list | Done | Shows only relevant staff per ticket type |
| Close ticket | Done | Button to close with individual ratings |
| Individual feedback | Done | Rate each assignee separately |
| Feedback logging | Done | Sends feedback to dedicated channel |

### Phase 2: Staff Management

| Feature | Status | Description |
|---------|--------|-------------|
| Staff roles | Done | Role-based filtering per ticket type |
| Ticket assignment | Done | Assign multiple staff on ticket creation |
| `/claim` command | Planned | Staff claims a ticket |
| `/transfer` command | Planned | Transfer ticket to another staff |
| Staff notifications | Planned | Ping staff when new ticket in their area |

### Phase 3: Ticket Lifecycle

| Feature | Status | Description |
|---------|--------|-------------|
| Status tracking | Planned | Open → In Progress → Resolved → Closed |
| `/status` command | Planned | Update ticket status |
| SLA warnings | Planned | Alert if ticket open too long |
| Auto-close | Planned | Close inactive tickets after X days |
| Reopen ticket | Planned | Allow reopening closed tickets |

### Phase 4: Database & Analytics

| Feature | Status | Description |
|---------|--------|-------------|
| Database integration | Planned | SQLite/PostgreSQL for persistence |
| Ticket history | Planned | Full audit log of ticket changes |
| `/stats` command | Planned | View ticket statistics |
| Dashboard | Planned | Web dashboard for analytics |
| Export reports | Planned | CSV/PDF export of ticket data |

### Phase 5: Advanced Features

| Feature | Status | Description |
|---------|--------|-------------|
| Canned responses | Planned | Pre-written replies for common issues |
| Ticket templates | Planned | Custom fields per ticket type |
| Priority escalation | Planned | Auto-escalate urgent tickets |
| Integration | Planned | Connect to kyou.id API for order lookup |
| Multi-language | Planned | Support ID/EN languages |

---

## Ticket Types

### ETA (PPO/PST)
- **Purpose**: Check estimated arrival of order/item
- **Channel**: PPO Discussion
- **Fields**: Priority, Item ID, Order ID, Notes
- **Assignable Roles**: `1300285037241045073`
- **SLA**: 24 hours

### ETA (UREQ)
- **Purpose**: Check ETA for unique request orders
- **Channel**: UREQ Discussion
- **Fields**: Priority, Order ID, Notes
- **Assignable Roles**: `1336223205601316936`
- **SLA**: 24 hours

### Restock
- **Purpose**: Inquire about item restock
- **Channel**: PPO Discussion
- **Fields**: Item ID, Order ID, Notes
- **Assignable Roles**: `1337705127703871488`
- **SLA**: 48 hours

### Revive
- **Purpose**: Request late/revive preorder
- **Channel**: PPO Discussion
- **Fields**: Item ID, Notes
- **Assignable Roles**: `1300285037241045073`, `1337705127703871488`
- **SLA**: 48 hours

### New Item
- **Purpose**: Request new item to be added
- **Channel**: PPO Discussion
- **Fields**: Notes, Link (optional)
- **Assignable Roles**: `1300285037241045073`
- **SLA**: 72 hours

### Kompensasi
- **Purpose**: Report defect/damage for compensation
- **Channel**: Kompensasi User
- **Fields**: Notes, Image (follow-up)
- **Assignable Users**: `392321900577161219`, `421215427696394241`
- **SLA**: 24 hours (urgent)

---

## User Flows

### Create Ticket
```
User runs /ticket
    ↓
Select ticket type from dropdown
    ↓
Fill modal form (priority, IDs, notes)
    ↓
Select staff to assign (multi-select, role-filtered)
    ↓
Thread created: {TYPE}-{ITEM_ID}-{ORDER_ID}-{username}
    ↓
Ticket embed posted with Close button
    ↓
User + assigned staff added to thread
```

### Close Ticket (Single Assignee)
```
User/Staff clicks "Close Ticket" button
    ↓
Rating & feedback modal appears
    ↓
Submit feedback
    ↓
Feedback logged to feedback channel
    ↓
Members removed from thread
    ↓
Thread archived
```

### Close Ticket (Multiple Assignees)
```
User/Staff clicks "Close Ticket" button
    ↓
Modal: "Rate [Staff 1] (1/2)"
    ↓
Submit → Feedback sent to logs
    ↓
Button: "Rate [Staff 2] (2/2)"
    ↓
Click → Modal: "Rate [Staff 2] (2/2)"
    ↓
Submit → Feedback sent to logs
    ↓
Members removed from thread
    ↓
Thread archived
```

### Claim Ticket (Phase 2)
```
Staff sees new ticket notification
    ↓
Staff runs /claim in thread
    ↓
Ticket assigned to staff
    ↓
Status changes to "In Progress"
    ↓
Customer notified of assignment
```

---

## Technical Requirements

### Discord Permissions
- Manage Threads
- Send Messages
- Embed Links
- Read Message History
- Add Reactions

### Discord Intents
- Guilds
- GuildMembers (Privileged)

### Environment Variables
```
DISCORD_TOKEN=
GUILD_ID=
CHANNEL_PPO=1478627839514513439
CHANNEL_UREQ=1478627863745007616
CHANNEL_KOMPEN=1478627884582178906
CHANNEL_FEEDBACK=1478635097988136980
```

### Database Schema (Phase 4)
See database.md for ERD

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Ticket response time | < 4 hours |
| Ticket resolution time | < 24 hours |
| Customer satisfaction | > 4.0/5.0 |
| Ticket volume handled | Track weekly |
| Staff workload balance | Even distribution |

---

## Milestones

| Phase | Status |
|-------|--------|
| Phase 1: Core | Done |
| Phase 2: Staff | Partial (assignment done, claim/transfer pending) |
| Phase 3: Lifecycle | Planned |
| Phase 4: Database | Planned |
| Phase 5: Advanced | Planned |

---

## Open Questions

1. ~~Should tickets auto-assign or require manual claim?~~ **Resolved: Manual assignment on creation**
2. What's the escalation path for unresolved tickets?
3. Should we integrate with kyou.id API for order lookup?
4. Multi-server support needed?
5. Archive strategy for old tickets?
6. Should staff be able to re-assign tickets after creation?
