# n8n Admin Notification Specification

Specification for adding admin notification functionality to the inbound WhatsApp message pipeline. This document extends `docs/N8N_INBOUND_SPEC.md` with a notification branch.

**Related Documents:**
- Inbound Pipeline: `docs/N8N_INBOUND_SPEC.md`
- API Reference: `docs/META_API_REFERENCE.md`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Trigger Integration](#2-trigger-integration)
3. [Notification Message Format](#3-notification-message-format)
4. [Admin Number Configuration](#4-admin-number-configuration)
5. [Rate Limiting](#5-rate-limiting)
6. [Sending via Meta API](#6-sending-via-meta-api)
7. [Complete Workflow Diagram](#7-complete-workflow-diagram)
8. [Implementation Checklist](#8-implementation-checklist)

---

## 1. Overview

### Purpose
Alert administrators when new WhatsApp messages arrive, enabling quick response to customer inquiries.

### Key Features
- Real-time notifications for new inbound messages
- Rate limiting to prevent notification spam
- Flexible admin configuration (environment variable or database)
- Message preview with sender identification

### Integration Point
This workflow branches from the existing inbound pipeline AFTER successful message database insertion.

---

## 2. Trigger Integration

### Integration Location

The notification branch should be added **after** the message is successfully saved to the database. This ensures:
- Notifications only fire for valid, stored messages
- Duplicate messages (caught by dedup) don't trigger notifications
- Failed webhook processing doesn't send false alerts

### Branch Point in Inbound Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INBOUND PIPELINE (from N8N_INBOUND_SPEC.md)       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Webhook] → [Route] → [Dedup] → [Contact Upsert] → [Message Insert] │
│                                                          │           │
│                                                          │           │
│                                          ┌───────────────┴───────────┐
│                                          │                           │
│                                          ▼                           │
│                               ┌─────────────────────┐               │
│                               │  NOTIFICATION       │               │
│                               │  BRANCH (NEW)       │◄── ADD HERE   │
│                               └─────────────────────┘               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Node Configuration

**Add after: Message Insert node**

| Node Type | Purpose |
|-----------|---------|
| **IF** node | Check if message is inbound (direction = 'inbound') |
| **Function** node | Rate limit check |
| **HTTP Request** node | Send notification via Meta API |

### IF Node Configuration

**Name:** `Is Inbound Message`

| Setting | Value |
|---------|-------|
| **Condition** | `{{ $json.direction }}` equals `inbound` |
| **True Branch** | Continue to notification flow |
| **False Branch** | End (outbound messages don't need notification) |

```javascript
// IF node expression
{{ $json.direction === 'inbound' }}
```

---

## 3. Notification Message Format

### Message Template

```
🔔 New message from {sender}: {body_preview}...
```

### Field Mapping

| Field | Source | Fallback |
|-------|--------|----------|
| `{sender}` | `profile_name` from contacts | `phone_number` |
| `{body_preview}` | First 50 chars of message body | "[Media message]" for non-text |

### Format Logic (Code Node)

**Name:** `Format Notification`

```javascript
// Input: $json from Message Insert node contains the saved message
const message = $input.item.json;

// Get sender name with fallback to phone number
const senderName = message.profile_name || message.contact_phone;

// Get message body preview
let bodyPreview = '';

if (message.type === 'text' && message.body) {
  // Truncate to 50 characters with ellipsis
  if (message.body.length > 50) {
    bodyPreview = message.body.substring(0, 50) + '...';
  } else {
    bodyPreview = message.body;
  }
} else if (message.type === 'image') {
  bodyPreview = '[📷 Image message]';
} else if (message.type === 'video') {
  bodyPreview = '[🎥 Video message]';
} else if (message.type === 'audio') {
  bodyPreview = '[🎵 Audio message]';
} else if (message.type === 'document') {
  bodyPreview = '[📄 Document: ' + (message.body || 'file') + ']';
} else {
  bodyPreview = '[' + message.type + ' message]';
}

// Compose notification message
const notificationText = `🔔 New message from ${senderName}: ${bodyPreview}`;

return {
  json: {
    notification_text: notificationText,
    contact_phone: message.contact_phone,
    message_type: message.type,
    timestamp: new Date().toISOString()
  }
};
```

### Example Outputs

| Input | Output |
|-------|--------|
| Text from "John Doe": "Hey, I wanted to ask about your pricing plans and availability" | `🔔 New message from John Doe: Hey, I wanted to ask about your pricing plans and a...` |
| Text from +972501234567 (no profile): "Hello" | `🔔 New message from +972501234567: Hello` |
| Image from "Jane Smith" with caption | `🔔 New message from Jane Smith: [📷 Image message]` |
| Document from "Client" filename "invoice.pdf" | `🔔 New message from Client: [📄 Document: invoice.pdf]` |

---

## 4. Admin Number Configuration

### Option A: Environment Variable (Recommended)

**Simplicity:** No database query required, instant access.

#### Configuration

| Setting | Location | Example |
|---------|----------|---------|
| Variable Name | n8n Environment Variables | `ADMIN_PHONE` |
| Format | E.164 format | `+972501234567` |

#### Access in n8n

```javascript
// In any Code/Function node
const adminPhone = $env.ADMIN_PHONE;

// Or in expressions
{{ $env.ADMIN_PHONE }}
```

#### Setup Instructions

1. In n8n, go to **Settings → Environment Variables**
2. Add variable: `ADMIN_PHONE` = `+972501234567`
3. Restart n8n if required (depends on hosting setup)

**Docker Compose:**
```yaml
environment:
  - ADMIN_PHONE=+972501234567
```

**Pros:**
- ✅ No database query overhead
- ✅ Simple to configure
- ✅ Works even if Supabase is down

**Cons:**
- ❌ Requires n8n restart to change
- ❌ Can't have multiple admin numbers easily

---

### Option B: Supabase Settings Table

**Flexibility:** Changeable without workflow restart, supports multiple admins.

#### Database Setup

```sql
-- Create settings table if not exists
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert admin phone
INSERT INTO settings (key, value)
VALUES ('admin_phone', '+972501234567')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- For multiple admins (comma-separated)
INSERT INTO settings (key, value)
VALUES ('admin_phones', '+972501234567,+972509876543');
```

#### n8n Supabase Query Node

**Name:** `Get Admin Phone`

| Setting | Value |
|---------|-------|
| **Operation** | Select |
| **Table** | `settings` |
| **Filters** | `key` equals `admin_phone` |
| **Limit** | 1 |

```javascript
// Access in next node
const adminPhone = $('Get Admin Phone').item.json.value;
```

#### Multiple Admins Support

```javascript
// If using comma-separated admin_phones
const adminPhonesStr = $('Get Admin Phone').item.json.value;
const adminPhones = adminPhonesStr.split(',').map(p => p.trim());

// Return array for loop processing
return adminPhones.map(phone => ({ json: { admin_phone: phone } }));
```

**Pros:**
- ✅ Change admin number without restart
- ✅ Support multiple admin numbers
- ✅ Audit trail with updated_at

**Cons:**
- ❌ Extra database query per notification
- ❌ Notification fails if Supabase unavailable

---

### Recommendation

**Use Option A (Environment Variable)** for:
- Single admin setups
- Simpler architecture
- Reliability (no DB dependency)

**Use Option B (Database)** for:
- Multiple admin numbers
- Frequently changing admin assignments
- Teams that need UI-based configuration

---

## 5. Rate Limiting

### Purpose
Prevent notification spam when the same contact sends multiple messages in quick succession.

### Recommended Limit
**Maximum 1 notification per contact per 5 minutes**

---

### Approach A: In-Memory Cache (n8n Static Data)

Uses n8n's built-in static data storage for simple rate limiting.

#### Code Node: Rate Limit Check

**Name:** `Check Rate Limit`

```javascript
// Rate limit configuration
const RATE_LIMIT_MINUTES = 5;
const contactPhone = $input.item.json.contact_phone;

// Access n8n static data (persists across executions)
const staticData = $getWorkflowStaticData('global');

// Initialize cache if not exists
if (!staticData.notificationCache) {
  staticData.notificationCache = {};
}

const cache = staticData.notificationCache;
const now = Date.now();
const rateLimitMs = RATE_LIMIT_MINUTES * 60 * 1000;

// Check if contact was notified recently
const lastNotified = cache[contactPhone];

if (lastNotified && (now - lastNotified) < rateLimitMs) {
  // Rate limited - skip notification
  const remainingSeconds = Math.ceil((rateLimitMs - (now - lastNotified)) / 1000);
  
  return {
    json: {
      rate_limited: true,
      contact_phone: contactPhone,
      remaining_seconds: remainingSeconds,
      action: 'skip_notification'
    }
  };
}

// Update cache with current timestamp
cache[contactPhone] = now;

// Clean up old entries (older than 1 hour) to prevent memory bloat
const oneHourAgo = now - (60 * 60 * 1000);
for (const phone in cache) {
  if (cache[phone] < oneHourAgo) {
    delete cache[phone];
  }
}

// Allow notification
return {
  json: {
    ...$input.item.json,
    rate_limited: false,
    action: 'send_notification'
  }
};
```

#### IF Node After Rate Limit Check

**Name:** `Rate Limit Decision`

| Setting | Value |
|---------|-------|
| **Condition** | `{{ $json.rate_limited }}` equals `false` |
| **True Branch** | Send notification |
| **False Branch** | End (skip notification) |

**Pros:**
- ✅ No database overhead
- ✅ Fast execution
- ✅ Built into n8n

**Cons:**
- ❌ Resets on n8n restart
- ❌ Not shared across n8n instances (if scaled)

---

### Approach B: Supabase Tracking

Uses database to track last notification time, persists across restarts.

#### Database Schema Addition

```sql
-- Add column to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS last_notification_at TIMESTAMPTZ;
```

#### Check Rate Limit Query

**Name:** `Check Notification Rate Limit`

```javascript
// First, query contact's last_notification_at
const contactPhone = $input.item.json.contact_phone;
const RATE_LIMIT_MINUTES = 5;

// This comes from a Supabase Select node before this
const contact = $('Get Contact').item.json;
const lastNotification = contact.last_notification_at;

if (lastNotification) {
  const lastTime = new Date(lastNotification).getTime();
  const now = Date.now();
  const rateLimitMs = RATE_LIMIT_MINUTES * 60 * 1000;
  
  if ((now - lastTime) < rateLimitMs) {
    return {
      json: {
        rate_limited: true,
        action: 'skip_notification'
      }
    };
  }
}

// Allow notification - will update last_notification_at after sending
return {
  json: {
    ...$input.item.json,
    rate_limited: false,
    action: 'send_notification'
  }
};
```

#### Update After Sending

**Node:** Supabase Update

```sql
UPDATE contacts 
SET last_notification_at = NOW() 
WHERE phone_number = $1
```

**Pros:**
- ✅ Persists across restarts
- ✅ Works with multiple n8n instances
- ✅ Trackable in database

**Cons:**
- ❌ Extra database queries
- ❌ Slightly higher latency

---

### Recommendation

**Use Approach A (In-Memory)** for:
- Single n8n instance
- Simpler setup
- Lower latency requirements

**Use Approach B (Supabase)** for:
- Multiple n8n instances
- Need for persistence
- Audit/tracking requirements

---

## 6. Sending via Meta API

### Session Window Consideration

**Important:** The admin phone number is also subject to WhatsApp's 24-hour session window rules.

| Scenario | Solution |
|----------|----------|
| Admin has active session | Send free-form text notification |
| Admin session expired | Must use pre-approved template message |
| Admin never messaged | Must use template message |

### Recommended Approach: Template Message

For **reliable** admin notifications, create and use a pre-approved template message.

#### Template Setup in Meta Business Suite

**Template Name:** `new_message_alert`

**Category:** Utility

**Language:** English (en_US)

**Content:**
```
🔔 New WhatsApp Message

From: {{1}}
Preview: {{2}}

Reply to this message to respond.
```

#### n8n HTTP Request Node: Send Template Notification

**Name:** `Send Admin Notification (Template)`

| Setting | Value |
|---------|-------|
| **Method** | POST |
| **URL** | `https://graph.facebook.com/v18.0/{{ $env.META_PHONE_NUMBER_ID }}/messages` |
| **Authentication** | Header Auth |
| **Header Name** | `Authorization` |
| **Header Value** | `Bearer {{ $env.META_ACCESS_TOKEN }}` |
| **Body Content Type** | JSON |

**Request Body:**

```json
{
  "messaging_product": "whatsapp",
  "to": "{{ $env.ADMIN_PHONE }}",
  "type": "template",
  "template": {
    "name": "new_message_alert",
    "language": {
      "code": "en_US"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "{{ $json.sender_name }}"
          },
          {
            "type": "text",
            "text": "{{ $json.body_preview }}"
          }
        ]
      }
    ]
  }
}
```

### Alternative: Free-Form Text (If Admin Has Active Session)

If you're certain the admin maintains an active session (e.g., admin regularly messages the business number), you can use free-form text:

**Name:** `Send Admin Notification (Text)`

```json
{
  "messaging_product": "whatsapp",
  "to": "{{ $env.ADMIN_PHONE }}",
  "type": "text",
  "text": {
    "body": "{{ $json.notification_text }}"
  }
}
```

### Error Handling

```javascript
// After HTTP Request node
const response = $input.item.json;

if (response.error) {
  // Check if session window error
  if (response.error.code === 131047) {
    // Log: Admin session expired, template required
    console.log('Admin notification failed: Session expired. Use template message.');
  }
  
  return {
    json: {
      notification_sent: false,
      error: response.error.message
    }
  };
}

return {
  json: {
    notification_sent: true,
    message_id: response.messages?.[0]?.id
  }
};
```

---

## 7. Complete Workflow Diagram

### Full Notification Branch Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        ADMIN NOTIFICATION BRANCH                                 │
│                   (Extension to n8n_inbound workflow)                           │
└─────────────────────────────────────────────────────────────────────────────────┘

From Inbound Pipeline:
                                    
  [Message Insert] ──successful──►┐
         │                        │
         │                        ▼
         │              ┌───────────────────┐
         │              │ IS INBOUND?       │
         │              │ (IF node)         │
         │              └─────────┬─────────┘
         │                        │
         │            ┌───────────┴───────────┐
         │            │                       │
         │      inbound                  outbound
         │            │                       │
         │            ▼                       ▼
         │   ┌─────────────────┐        ┌─────────┐
         │   │ FORMAT          │        │ END     │
         │   │ NOTIFICATION    │        │ (skip)  │
         │   │ (Code node)     │        └─────────┘
         │   └────────┬────────┘
         │            │
         │            ▼
         │   ┌─────────────────┐
         │   │ CHECK RATE      │
         │   │ LIMIT           │
         │   │ (Code node)     │
         │   └────────┬────────┘
         │            │
         │     ┌──────┴──────┐
         │     │             │
         │   allowed      blocked
         │     │             │
         │     ▼             ▼
         │ ┌────────────┐ ┌─────────┐
         │ │ SEND       │ │ END     │
         │ │ NOTIFICATION│ │ (skip)  │
         │ │ (HTTP)     │ └─────────┘
         │ └─────┬──────┘
         │       │
         │       ▼
         │ ┌────────────┐
         │ │ LOG RESULT │
         │ │ (optional) │
         │ └────────────┘
         │
         ▼
  [Continue to automation_logs insert...]
```

### Node Sequence Table

| # | Node Name | Node Type | Purpose | Input | Output |
|---|-----------|-----------|---------|-------|--------|
| 1 | Is Inbound | IF | Filter inbound only | Message Insert result | Branch decision |
| 2 | Format Notification | Code | Build notification text | Message data | Formatted text |
| 3 | Check Rate Limit | Code | Prevent spam | Contact phone | Allow/block |
| 4 | Rate Limit Decision | IF | Route based on limit | Rate limit result | Branch decision |
| 5 | Send Notification | HTTP Request | Call Meta API | Notification payload | API response |
| 6 | Log Result | Code (optional) | Track notification | API response | Log entry |

### Integration with Full Inbound Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        COMPLETE INBOUND PIPELINE WITH NOTIFICATIONS              │
└─────────────────────────────────────────────────────────────────────────────────┘

  [Webhook]
      │
      ▼
  [Verify/Route]
      │
      ├──► statuses[] ──► [Update Message Status]
      │
      └──► messages[] ──► [Dedup Check]
                              │
                              ▼ (not duplicate)
                         [Contact Upsert]
                              │
                              ▼
                         [Media Handler?]
                              │
                              ▼
                         [Message Insert]
                              │
                              ├────────────────────────────────────┐
                              │                                    │
                              ▼                                    ▼
                    [Log Execution]                    ┌─────────────────────┐
                              │                        │ NOTIFICATION BRANCH │
                              ▼                        │ (parallel)          │
                    [Return 200 OK]                    │                     │
                                                       │ [Is Inbound?]       │
                                                       │       │             │
                                                       │       ▼             │
                                                       │ [Format Message]    │
                                                       │       │             │
                                                       │       ▼             │
                                                       │ [Rate Limit]        │
                                                       │       │             │
                                                       │       ▼             │
                                                       │ [Send Notification] │
                                                       └─────────────────────┘
```

---

## 8. Implementation Checklist

### Prerequisites

- [ ] n8n inbound workflow operational (`N8N_INBOUND_SPEC.md`)
- [ ] Meta API credentials configured
- [ ] Admin phone number determined

### Setup Steps

1. **Configure Admin Number**
   - [ ] Option A: Set `ADMIN_PHONE` environment variable in n8n
   - [ ] Option B: Create `settings` table and insert `admin_phone` key

2. **Create Template (Recommended)**
   - [ ] Go to Meta Business Suite → WhatsApp Manager → Message Templates
   - [ ] Create `new_message_alert` template with two body parameters
   - [ ] Wait for template approval (usually 24-48 hours)

3. **Add Workflow Nodes**
   - [ ] Add IF node after Message Insert to check `direction === 'inbound'`
   - [ ] Add Code node for notification formatting
   - [ ] Add Code node for rate limit check
   - [ ] Add IF node for rate limit decision
   - [ ] Add HTTP Request node for Meta API call

4. **Test Notification Flow**
   - [ ] Send test message to webhook
   - [ ] Verify notification received on admin phone
   - [ ] Verify rate limiting works (send multiple messages quickly)

5. **Monitor**
   - [ ] Check n8n execution logs for notification errors
   - [ ] Verify template messages sent successfully
   - [ ] Monitor rate limit effectiveness

### Environment Variables Summary

| Variable | Purpose | Example |
|----------|---------|---------|
| `ADMIN_PHONE` | Admin WhatsApp number | `+972501234567` |
| `META_ACCESS_TOKEN` | Meta API authentication | `EAAxxxx...` |
| `META_PHONE_NUMBER_ID` | WhatsApp Business phone ID | `123456789` |

---

## Quick Reference

### Notification Format
```
🔔 New message from {profile_name || phone}: {body.substring(0,50)}...
```

### Rate Limit
```
1 notification per contact per 5 minutes
```

### Template Name
```
new_message_alert
```

### Meta API Endpoint
```
POST https://graph.facebook.com/v18.0/{phone_number_id}/messages
```

---

*Document Version: 1.0*
*Last Updated: January 2026*
*Extends: N8N_INBOUND_SPEC.md*
