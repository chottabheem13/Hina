# Multimedia Ticket System Guide

## Overview
The Multimedia Ticket System is a Discord bot feature that allows users to create design and printing requests with automatic staff assignment and specialist routing.

## Categories & Sub-Types

### 1. Digital Design
| Sub-Type | Description | Assignment | Specialist |
|----------|-------------|------------|------------|
| Kolase | Collage design | Direct User | - |
| Singpost | Singpost design | Direct User | - |
| Announcement | Announcement design | Role | Yudha & Farel |
| Monthly Design | Monthly design | Direct User | - |
| Other | Other digital design | Role | - |

### 2. Single Printing
| Sub-Type | Description | Assignment | Specialist |
|----------|-------------|------------|------------|
| Store Design | Store design request | Role | Farel & Yudha |
| Standee | Standee design request | Role | Yudha & Farel |
| Banner | Banner design request | Role | Yudha & Farel |
| Wallpaper | Wallpaper design request | Role | Yudha & Farel |
| Other | Other single printing request | Role | - |

### 3. Offset Printing
| Sub-Type | Description | Assignment | Specialist |
|----------|-------------|------------|------------|
| Brosur | Brochure request | Role | Farel & Yudha |
| Kipas | Fan request | Role | Farel & Yudha |
| Postcard | Postcard request | Role | Farel & Yudha |
| Sticker | Sticker request | Role | Farel & Yudha |
| Paper Bag | Paper bag request | Role | Farel & Yudha |
| Dus Kyou | Kyou box request | Role | Yudha & Farel |
| Other | Other offset printing request | Role | - |

### 4. Promotional Design
| Sub-Type | Description | Assignment | Specialist |
|----------|-------------|------------|------------|
| Thematic Sale | Thematic sale design | Role | Fatur & Tegar |
| SP Sale | SP sale design | Role | - |
| Campaign | Campaign design | Role | Fatur & Tegar |
| Give Away | Giveaway design | Role | Farel & Fatur |

### 5. Event Design
| Sub-Type | Description | Assignment | Specialist |
|----------|-------------|------------|------------|
| Event | Event design | Role | - |
| Project | Project design | Role | - |

## User IDs for Direct Assignment

| Ticket Type | Assigned User(s) |
|-------------|------------------|
| `mulmed_kolase` | 1317666401473007686 |
| `mulmed_singpost` | 1317666401473007686, 896347272307154955 |
| `mulmed_monthly_design` | 1317666401473007686, 896347272307154955 |

## Role ID for Assignment

| Role | ID |
|------|-----|
| Multimedia Role | 1480109703408390237 |

## How to Use

### Creating a Ticket
1. Use the `/mulmed-ticket` command in Discord
2. Select a category (Digital Design, Single Printing, etc.)
3. Select a sub-type (Kolase, Banner, Brosur, etc.)
4. Fill in the required fields:
   - **Priority**: Normal or Urgent (optional)
   - **Link**: Reference link (if applicable)
   - **Brief**: Description of requirements
   - **Size/Size & QTY**: Specifications for printing
   - **Additional/Deadline Info**: Extra details
5. Select staff member(s) to handle the ticket (1-10 staff)
   - The description will show specialists if available
6. Submit to create the ticket thread

### Ticket Fields by Category

#### Digital Design
- Priority (optional)
- Link (optional)
- Brief (optional)
- Additional/Additional Output (for some types)

#### Single Printing
- Priority (optional)
- Link (optional)
- Brief (required)
- Size (required)
- Additional Output (optional)

#### Offset Printing
- Priority (optional)
- Link Reference (optional)
- Brief (required)
- Size & QTY (required)
- Additional Output (optional)

#### Promotional Design
- Priority (optional)
- Link Reference (optional)
- Brief (required, Hero Link mandatory)
- Deadline / Info (required - includes deadline, size/placement)

#### Event Design
- Priority (optional)
- Link Reference (optional)
- Brief (required)
- Deadline / Info (required - includes deadline, size/scope)

## Thread Naming Convention

Tickets are named with the following format:
```
{TYPE}-{ID/ORDER-ID}-{USERNAME}
```

Examples:
- `KOLASE-123456789-johndoe`
- `BANNER-987654321-janesmith`
- `BROSUR-ORDER12345-bobwilson`

## Feedback System

When a ticket is closed:
1. Users are prompted to rate each assigned staff member (1-5 stars)
2. Optional feedback text can be provided
3. Feedback is sent to:
   - **Multimedia tickets**: `CHANNEL_FEEDBACKMULMED`
   - **Purchasing tickets**: `CHANNEL_FEEDBACK`

## Channel Mapping

| Category | Channel |
|----------|---------|
| Digital Design | `CHANNEL_DIGITAL` |
| Single Printing | `CHANNEL_SINGLEPRINT` |
| Offset Printing | `CHANNEL_OFFSET` |
| Promotional Design | `CHANNEL_PROMO` |
| Event Design | `CHANNEL_EVENT` |

## Database Schema

```sql
CREATE TABLE tickets (
  id VARCHAR(255) PRIMARY KEY,  -- Thread ID
  type VARCHAR(100),             -- mulmed_kolase, mulmed_brosur, etc.
  status VARCHAR(20),            -- open, closed
  priority VARCHAR(20),          -- normal, urgent
  created_by VARCHAR(255),
  created_at TIMESTAMP,
  item_id INT,
  order_id INT,
  notes TEXT,
  brief TEXT,
  link TEXT,
  size_qty TEXT,
  size_placement TEXT,
  deadline_info TEXT,
  assigned_to TEXT                -- JSON array of assignee IDs
);
```

## Code Structure

### Files
- `index.js` - Main bot logic with ticket handlers
- `commands/mulmed-ticket.js` - Slash command definition
- `modals/ticketModals.js` - Modal form definitions

### Key Constants

#### TICKET_USERS
Direct user assignments for specific ticket types.

#### TICKET_ROLES
Role-based assignments for most ticket types.

#### TICKET_SPECIAL_NOTES
Specialist team notes displayed in staff selection:
```javascript
const TICKET_SPECIAL_NOTES = {
  mulmed_announcement: 'Yudha & Farel',
  mulmed_store_design: 'Farel & Yudha',
  mulmed_standee: 'Yudha & Farel',
  mulmed_banner: 'Yudha & Farel',
  mulmed_wallpaper: 'Yudha & Farel',
  mulmed_brosur: 'Farel & Yudha',
  mulmed_kipas: 'Farel & Yudha',
  mulmed_postcard: 'Farel & Yudha',
  mulmed_sticker: 'Farel & Yudha',
  mulmed_paper_bag: 'Farel & Yudha',
  mulmed_dus_kyou: 'Yudha & Farel',
  mulmed_thematic_sale: 'Fatur & Tegar',
  mulmed_campaign: 'Fatur & Tegar',
  mulmed_give_away: 'Farel & Fatur',
};
```

## Assignment Logic

1. **Direct User Assignment**: For tickets with specific assigned users (Kolase, Singpost, Monthly Design)
   - Only the specified users appear in staff selection

2. **Role-Based Assignment**: For most tickets
   - All members with the Multimedia role (1480109703408390237) appear
   - Specialist notes indicate preferred team members

3. **Staff Selection Description**:
   - With specialist: `"Select staff to handle this ticket (Specialist: X & Y)"`
   - Without specialist: `"Select staff to handle this ticket"`

## Environment Variables Required

```
DISCORD_TOKEN=your_bot_token
GUILD_ID=your_guild_id (optional, for faster command registration)
CHANNEL_DIGITAL=digital_design_channel_id
CHANNEL_SINGLEPRINT=single_printing_channel_id
CHANNEL_OFFSET=offset_printing_channel_id
CHANNEL_PROMO=promotional_design_channel_id
CHANNEL_EVENT=event_design_channel_id
CHANNEL_FEEDBACKMULMED=multimedia_feedback_channel_id
CHANNEL_FEEDBACK=purchasing_feedback_channel_id
```

## Troubleshooting

### Staff not appearing in selection
- Verify users have the correct role (1480109703408390237)
- Check if bot has permission to fetch guild members
- Ensure user IDs are correct for direct assignments

### Tickets not creating
- Verify all required channels are configured
- Check bot permissions in target channels
- Ensure database connection is working

### Specialist notes not showing
- Confirm TICKET_SPECIAL_NOTES constant is properly defined
- Check that modal functions are receiving the specialNote parameter
- Restart bot after code changes

## Version History

- **v1.0** - Initial release with 23 sub-types across 5 categories
- **v1.1** - Added direct user assignments for Kolase, Singpost, Monthly Design
- **v1.2** - Added specialist notes to staff selection
- **v1.3** - Updated feedback title for multimedia tickets
