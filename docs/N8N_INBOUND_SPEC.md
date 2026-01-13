# n8n Inbound Pipeline Specification

Complete workflow specification for processing inbound WhatsApp messages via n8n. This document enables building a functional n8n workflow without additional guidance.

**Related Documents:**
- Schema Reference: `supabase/schema.sql`
- API Reference: `docs/META_API_REFERENCE.md`

---

## Table of Contents

1. [Workflow Overview](#1-workflow-overview)
2. [Webhook Trigger Setup](#2-webhook-trigger-setup)
3. [Message vs Status Routing](#3-message-vs-status-routing)
4. [Deduplication Logic](#4-deduplication-logic)
5. [Contact Upsert Logic](#5-contact-upsert-logic)
6. [Media Handling Flow](#6-media-handling-flow)
7. [Message Insert Pattern](#7-message-insert-pattern)
8. [Status Update Handler](#8-status-update-handler)
9. [Automation Logging](#9-automation-logging)
10. [Error Handling](#10-error-handling)
11. [Complete Workflow Diagram](#11-complete-workflow-diagram)

---

## 1. Workflow Overview

### Purpose
Process all inbound WhatsApp webhook events:
- New messages from customers → Store in database, update contact
- Status updates (sent/delivered/read/failed) → Update message status

### Workflow Name
`n8n_inbound` (used in `messages.source` field)

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        n8n INBOUND PIPELINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Webhook Trigger]                                                           │
│        │                                                                     │
│        ▼                                                                     │
│  [Verification Check] ──GET request──► Return hub.challenge                  │
│        │                                                                     │
│        │ POST request                                                        │
│        ▼                                                                     │
│  [Route: Message or Status?]                                                 │
│        │                     │                                               │
│        │ messages[]          │ statuses[]                                    │
│        ▼                     ▼                                               │
│  ┌─────────────┐      ┌─────────────┐                                       │
│  │ MESSAGE     │      │ STATUS      │                                       │
│  │ PIPELINE    │      │ PIPELINE    │                                       │
│  └─────────────┘      └─────────────┘                                       │
│        │                     │                                               │
│        ▼                     ▼                                               │
│  [Dedup Check]         [Update Message Status]                               │
│        │                     │                                               │
│        ▼                     │                                               │
│  [Contact Upsert]            │                                               │
│        │                     │                                               │
│        ▼                     │                                               │
│  [Media Handler?]            │                                               │
│        │                     │                                               │
│        ▼                     │                                               │
│  [Message Insert]            │                                               │
│        │                     │                                               │
│        └──────────┬──────────┘                                               │
│                   ▼                                                          │
│            [Log Execution]                                                   │
│                   │                                                          │
│                   ▼                                                          │
│            [Return 200 OK]                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Webhook Trigger Setup

### Node Configuration

| Setting | Value |
|---------|-------|
| **Node Type** | Webhook |
| **HTTP Method** | GET, POST (both required) |
| **Path** | `/whatsapp-webhook` (or custom unique path) |
| **Authentication** | None (Meta handles via verify_token) |
| **Response Mode** | Respond immediately |

### Meta Webhook Verification Flow

Meta sends a GET request during webhook setup to verify ownership. Your workflow must handle this.

#### Verification Request (GET)

```
GET /whatsapp-webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE_STRING
```

#### Verification Handler Logic

```javascript
// IF node or Code node to check request type
const method = $input.item.json.headers['method'] || $request.method;
const query = $input.item.json.query;

if (method === 'GET' && query['hub.mode'] === 'subscribe') {
  // Verification request
  const verifyToken = query['hub.verify_token'];
  const challenge = query['hub.challenge'];
  
  // Compare with stored token
  const expectedToken = $env.META_VERIFY_TOKEN; // or from n8n credential
  
  if (verifyToken === expectedToken) {
    // Return challenge value as plain text
    return { response: challenge };
  } else {
    // Return error
    return { response: 'Forbidden', statusCode: 403 };
  }
}

// Otherwise, continue to POST handling
```

#### Verify Token Storage Options

| Option | Configuration | Recommendation |
|--------|--------------|----------------|
| **n8n Credential** | Create "Header Auth" credential with verify_token | ✅ Recommended for security |
| **Environment Variable** | Set `META_VERIFY_TOKEN` in n8n environment | Good for Docker deployments |
| **Static Value** | Hardcode in Code node (not recommended) | ❌ Avoid in production |

### Webhook Response

Always return HTTP 200 within 20 seconds or Meta will retry (causing duplicates).

```javascript
// At end of workflow
return { statusCode: 200, body: 'OK' };
```

---

## 3. Message vs Status Routing

### Routing Logic

Use a **Switch** node or **IF** node to route based on payload content.

#### Data Extraction Path

```javascript
const webhookData = $input.item.json.body;
const entry = webhookData.entry?.[0];
const changes = entry?.changes?.[0];
const value = changes?.value;

// Check what type of event this is
const hasMessages = value?.messages && value.messages.length > 0;
const hasStatuses = value?.statuses && value.statuses.length > 0;
```

#### Switch Node Configuration

| Output | Condition | Route To |
|--------|-----------|----------|
| **Message** | `{{ $json.body.entry[0].changes[0].value.messages }}` exists | Message Pipeline |
| **Status** | `{{ $json.body.entry[0].changes[0].value.statuses }}` exists | Status Pipeline |
| **Fallback** | Neither exists | Log & Exit (webhook test events) |

#### Full Extraction Code Node

```javascript
// Extract all relevant data for downstream nodes
const body = $input.item.json.body;
const entry = body.entry?.[0];
const changes = entry?.changes?.[0];
const value = changes?.value;

// Metadata (always present)
const metadata = {
  phone_number_id: value?.metadata?.phone_number_id,
  display_phone_number: value?.metadata?.display_phone_number
};

// Messages array (if present)
const messages = value?.messages || [];

// Statuses array (if present)  
const statuses = value?.statuses || [];

// Contacts array (if present - contains profile info)
const contacts = value?.contacts || [];

return {
  json: {
    metadata,
    messages,
    statuses,
    contacts,
    event_type: messages.length > 0 ? 'message' : (statuses.length > 0 ? 'status' : 'other')
  }
};
```

---

## 4. Deduplication Logic

### Purpose
Prevent duplicate message inserts from Meta webhook retries. Meta retries webhooks if no 200 response within 20 seconds.

### Check Before Insert

**Node Type:** Supabase (Select) or Postgres Query

```sql
SELECT id FROM messages WHERE meta_id = $1 LIMIT 1
```

#### n8n Supabase Node Configuration

| Setting | Value |
|---------|-------|
| **Operation** | Select |
| **Table** | `messages` |
| **Filters** | `meta_id` equals `{{ $json.messages[0].id }}` |
| **Limit** | 1 |

#### Deduplication Decision (IF Node)

```javascript
// After Supabase Select
const existingMessage = $input.item.json;

// If we got a result, message already exists
if (existingMessage && existingMessage.id) {
  // SKIP - Return early, don't insert
  return []; // Empty array stops this branch
}

// Continue to insert
return $input.item;
```

#### Alternative: Code Node Implementation

```javascript
const metaId = $input.item.json.messages[0].id;

// Query Supabase via HTTP Request node before this
const existingResults = $('Supabase Select').item.json;

if (existingResults.length > 0) {
  // Duplicate detected - skip processing
  return {
    json: {
      action: 'skipped',
      reason: 'duplicate_message',
      meta_id: metaId
    }
  };
}

// Continue processing
return $input.item;
```

---

## 5. Contact Upsert Logic

### Data Extraction

```javascript
// From webhook payload
const message = $json.messages[0];
const contact = $json.contacts[0];

const phone_number = message.from;  // e.g., "15551234567"
const profile_name = contact?.profile?.name || null;
```

### Upsert SQL Pattern

**Node Type:** Supabase (Upsert) or Postgres Query

```sql
INSERT INTO contacts (phone_number, profile_name, last_interaction_at, session_status, unread_count)
VALUES ($1, $2, NOW(), 'active', 1)
ON CONFLICT (phone_number) DO UPDATE SET
  profile_name = COALESCE(EXCLUDED.profile_name, contacts.profile_name),
  last_interaction_at = NOW(),
  session_status = 'active',
  unread_count = contacts.unread_count + 1
RETURNING phone_number, profile_name, session_status, unread_count;
```

#### n8n Supabase Node Configuration

| Setting | Value |
|---------|-------|
| **Operation** | Upsert |
| **Table** | `contacts` |
| **Conflict Columns** | `phone_number` |

**Fields to Set:**

| Field | Expression |
|-------|------------|
| `phone_number` | `{{ $json.messages[0].from }}` |
| `profile_name` | `{{ $json.contacts[0]?.profile?.name }}` |
| `last_interaction_at` | `{{ new Date().toISOString() }}` |
| `session_status` | `active` |
| `unread_count` | (handled by ON CONFLICT) |

#### Code Node for Upsert Payload

```javascript
const message = $input.item.json.messages[0];
const contact = $input.item.json.contacts[0];

return {
  json: {
    phone_number: message.from,
    profile_name: contact?.profile?.name || null,
    last_interaction_at: new Date().toISOString(),
    session_status: 'active',
    // Note: unread_count increment handled in SQL ON CONFLICT
  }
};
```

---

## 6. Media Handling Flow

### Detect Media Message

```javascript
const message = $input.item.json.messages[0];
const type = message.type;

// Media types that require download
const mediaTypes = ['image', 'video', 'audio', 'document'];
const isMedia = mediaTypes.includes(type);
```

### Media Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    MEDIA HANDLING FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Check Message Type]                                            │
│        │                                                         │
│        ├─── text ──────► [Skip Media Handler]                    │
│        │                                                         │
│        ├─── image/video/audio/document                           │
│        │                                                         │
│        ▼                                                         │
│  [Get Media URL from Meta]                                       │
│  GET https://graph.facebook.com/v18.0/{media_id}                 │
│        │                                                         │
│        ▼                                                         │
│  [Download Binary from URL]                                      │
│  GET {media_url} with Authorization header                       │
│        │                                                         │
│        ▼                                                         │
│  [Upload to Supabase Storage]                                    │
│  POST to whatsapp-media bucket                                   │
│        │                                                         │
│        ▼                                                         │
│  [Return Supabase Public URL]                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Step 1: Get Media URL from Meta

**Node Type:** HTTP Request

```
GET https://graph.facebook.com/v18.0/{{ $json.messages[0].image.id }}
```

| Setting | Value |
|---------|-------|
| **Method** | GET |
| **URL** | `https://graph.facebook.com/v18.0/{{ $json.media_id }}` |
| **Authentication** | Header Auth |
| **Header Name** | `Authorization` |
| **Header Value** | `Bearer {{ $env.META_ACCESS_TOKEN }}` |

**Response:**
```json
{
  "url": "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=...",
  "mime_type": "image/jpeg",
  "sha256": "abc123...",
  "file_size": 12345,
  "id": "1234567890"
}
```

### Step 2: Download Media Binary

**Node Type:** HTTP Request

```
GET {{ $json.url }}
Authorization: Bearer {{ $env.META_ACCESS_TOKEN }}
```

| Setting | Value |
|---------|-------|
| **Method** | GET |
| **URL** | `{{ $json.url }}` (from previous step) |
| **Response Format** | File |
| **Authentication** | Header Auth |
| **Header Name** | `Authorization` |
| **Header Value** | `Bearer {{ $env.META_ACCESS_TOKEN }}` |

### Step 3: Upload to Supabase Storage

**Node Type:** HTTP Request (Supabase Storage API)

```
POST https://{{ $env.SUPABASE_URL }}/storage/v1/object/whatsapp-media/{{ $json.filename }}
```

| Setting | Value |
|---------|-------|
| **Method** | POST |
| **URL** | `{{ $env.SUPABASE_URL }}/storage/v1/object/whatsapp-media/{{ $json.filename }}` |
| **Body Content Type** | Binary |
| **Body** | Binary data from previous node |
| **Headers** | See below |

**Required Headers:**

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer {{ $env.SUPABASE_SERVICE_KEY }}` |
| `Content-Type` | `{{ $json.mime_type }}` |
| `x-upsert` | `true` |

### Step 4: Generate Filename

```javascript
// Generate unique filename for storage
const message = $input.item.json.messages[0];
const type = message.type;
const mediaId = message[type].id;
const mimeType = message[type].mime_type;

// Map mime type to extension
const mimeToExt = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'application/pdf': 'pdf'
};

const ext = mimeToExt[mimeType] || 'bin';
const timestamp = Date.now();
const filename = `${type}_${mediaId}_${timestamp}.${ext}`;

return {
  json: {
    ...message,
    media_id: mediaId,
    mime_type: mimeType,
    filename: filename,
    storage_path: `whatsapp-media/${filename}`
  }
};
```

### Step 5: Construct Supabase Public URL

```javascript
// After successful upload
const filename = $input.item.json.filename;
const supabaseUrl = $env.SUPABASE_URL;

// Construct public URL (if bucket is public) or signed URL
const mediaUrl = `${supabaseUrl}/storage/v1/object/public/whatsapp-media/${filename}`;

// For private bucket, generate signed URL via Supabase API
// POST /storage/v1/object/sign/whatsapp-media/{filename}

return {
  json: {
    media_url: mediaUrl
  }
};
```

### Complete Media Handler Code Node

```javascript
const message = $input.item.json.messages[0];
const type = message.type;

// Non-media types
if (!['image', 'video', 'audio', 'document'].includes(type)) {
  return {
    json: {
      has_media: false,
      media_url: null,
      media_id: null
    }
  };
}

// Extract media info based on type
const mediaObj = message[type];

return {
  json: {
    has_media: true,
    media_id: mediaObj.id,
    mime_type: mediaObj.mime_type,
    caption: mediaObj.caption || null,
    filename: mediaObj.filename || null, // Only for documents
    sha256: mediaObj.sha256
  }
};
```

---

## 7. Message Insert Pattern

### SQL Insert Statement

```sql
INSERT INTO messages (
  contact_phone,
  direction,
  type,
  body,
  media_url,
  meta_id,
  status,
  source
)
VALUES ($1, 'inbound', $2, $3, $4, $5, 'delivered', 'n8n_inbound')
RETURNING id, contact_phone, type, created_at;
```

### Message Type Mapping

| WhatsApp Type | `type` Column | `body` Value | `media_url` Value |
|---------------|---------------|--------------|-------------------|
| `text` | `text` | `message.text.body` | `NULL` |
| `image` | `image` | `message.image.caption` or `NULL` | Supabase URL |
| `video` | `video` | `message.video.caption` or `NULL` | Supabase URL |
| `audio` | `audio` | `NULL` | Supabase URL |
| `document` | `document` | `message.document.filename` | Supabase URL |
| `location` | `text` | `"Location: {lat}, {lng}"` | `NULL` |
| `sticker` | `image` | `NULL` | Supabase URL |
| `contacts` | `text` | `"Shared contact: {name}"` | `NULL` |

### n8n Supabase Node Configuration

| Setting | Value |
|---------|-------|
| **Operation** | Insert |
| **Table** | `messages` |

**Fields:**

| Field | Expression |
|-------|------------|
| `contact_phone` | `{{ $json.messages[0].from }}` |
| `direction` | `inbound` |
| `type` | `{{ $json.mapped_type }}` |
| `body` | `{{ $json.mapped_body }}` |
| `media_url` | `{{ $json.media_url }}` |
| `meta_id` | `{{ $json.messages[0].id }}` |
| `status` | `delivered` |
| `source` | `n8n_inbound` |

### Complete Message Mapping Code Node

```javascript
const message = $input.item.json.messages[0];
const type = message.type;
const mediaUrl = $input.item.json.media_url || null; // From media handler

let mappedType;
let mappedBody;

switch (type) {
  case 'text':
    mappedType = 'text';
    mappedBody = message.text.body;
    break;
    
  case 'image':
    mappedType = 'image';
    mappedBody = message.image?.caption || null;
    break;
    
  case 'video':
    mappedType = 'video';
    mappedBody = message.video?.caption || null;
    break;
    
  case 'audio':
    mappedType = 'audio';
    mappedBody = null;
    break;
    
  case 'document':
    mappedType = 'document';
    mappedBody = message.document?.filename || null;
    break;
    
  case 'location':
    mappedType = 'text'; // Store as text type
    const lat = message.location.latitude;
    const lng = message.location.longitude;
    const name = message.location.name || '';
    const addr = message.location.address || '';
    mappedBody = `Location: ${lat}, ${lng}${name ? ' - ' + name : ''}${addr ? ' (' + addr + ')' : ''}`;
    break;
    
  case 'sticker':
    mappedType = 'image'; // Treat stickers as images
    mappedBody = null;
    break;
    
  case 'contacts':
    mappedType = 'text';
    const contactName = message.contacts?.[0]?.name?.formatted_name || 'Unknown';
    mappedBody = `Shared contact: ${contactName}`;
    break;
    
  default:
    mappedType = 'text';
    mappedBody = `[Unsupported message type: ${type}]`;
}

return {
  json: {
    contact_phone: message.from,
    direction: 'inbound',
    type: mappedType,
    body: mappedBody,
    media_url: mediaUrl,
    meta_id: message.id,
    status: 'delivered',
    source: 'n8n_inbound'
  }
};
```

---

## 8. Status Update Handler

### Purpose
Update existing outbound message status when Meta sends delivery receipts.

### Status Values

| Meta Status | Database Status | Description |
|-------------|-----------------|-------------|
| `sent` | `sent` | Message accepted by WhatsApp servers |
| `delivered` | `delivered` | Message delivered to recipient device |
| `read` | `read` | Recipient opened/read the message |
| `failed` | `failed` | Delivery failed (check error) |

### Update SQL Pattern

```sql
UPDATE messages
SET status = $1
WHERE meta_id = $2
  AND status != 'failed'  -- Don't overwrite failed status
RETURNING id, status;
```

### n8n Implementation

**Node Type:** Supabase (Update) or Postgres Query

```javascript
// Extract status data
const status = $input.item.json.statuses[0];

return {
  json: {
    meta_id: status.id,
    new_status: status.status,
    timestamp: status.timestamp,
    recipient_id: status.recipient_id,
    error: status.errors?.[0] || null
  }
};
```

### Supabase Update Node Configuration

| Setting | Value |
|---------|-------|
| **Operation** | Update |
| **Table** | `messages` |
| **Filters** | `meta_id` equals `{{ $json.meta_id }}` |

**Fields to Update:**

| Field | Expression |
|-------|------------|
| `status` | `{{ $json.new_status }}` |

### Error Status Handling

```javascript
const status = $input.item.json.statuses[0];

if (status.status === 'failed' && status.errors?.length > 0) {
  const error = status.errors[0];
  
  // Log error details for debugging
  console.log(`Message ${status.id} failed: ${error.code} - ${error.message}`);
  
  // Could also store error in a separate field or log table
  return {
    json: {
      meta_id: status.id,
      status: 'failed',
      error_code: error.code,
      error_message: error.message,
      error_title: error.title
    }
  };
}

return {
  json: {
    meta_id: status.id,
    status: status.status
  }
};
```

---

## 9. Automation Logging

### Purpose
Log all workflow executions for the Control Tower dashboard.

### Insert Pattern

```sql
INSERT INTO automation_logs (
  workflow_name,
  contact_phone,
  status,
  error_detail,
  executed_at
)
VALUES ($1, $2, $3, $4, NOW())
RETURNING id;
```

### Success Log

```javascript
// At end of successful message processing
return {
  json: {
    workflow_name: 'n8n_inbound',
    contact_phone: $input.item.json.contact_phone,
    status: 'success',
    error_detail: null
  }
};
```

### Error Log

```javascript
// In error handler branch
return {
  json: {
    workflow_name: 'n8n_inbound',
    contact_phone: $input.item.json.contact_phone || null,
    status: 'failed',
    error_detail: $input.item.json.error?.message || 'Unknown error'
  }
};
```

### n8n Supabase Node Configuration

| Setting | Value |
|---------|-------|
| **Operation** | Insert |
| **Table** | `automation_logs` |

**Fields:**

| Field | Expression |
|-------|------------|
| `workflow_name` | `n8n_inbound` |
| `contact_phone` | `{{ $json.contact_phone }}` |
| `status` | `{{ $json.log_status }}` |
| `error_detail` | `{{ $json.error_detail }}` |

---

## 10. Error Handling

### Global Error Handler

Add an Error Trigger node to catch any workflow failures.

```javascript
// Error Trigger node output
const error = $input.item.json;

return {
  json: {
    workflow_name: 'n8n_inbound',
    contact_phone: null, // May not be available
    status: 'failed',
    error_detail: `${error.message} at node: ${error.node}`
  }
};
```

### Retry Configuration

| Setting | Value | Reason |
|---------|-------|--------|
| **Retry on Fail** | Yes | Handle transient network issues |
| **Max Retries** | 2 | Prevent infinite loops |
| **Wait Between Retries** | 1000ms | Allow temporary issues to resolve |

### Common Error Scenarios

| Error | Cause | Resolution |
|-------|-------|------------|
| Duplicate meta_id | Webhook retry | Dedup check catches this - skip insert |
| Invalid media URL | Media expired | Log error, insert message without media |
| Supabase timeout | Network issue | Retry handles this |
| Invalid phone format | Malformed webhook | Log and skip |

---

## 11. Complete Workflow Diagram

### ASCII Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              n8n_inbound WORKFLOW                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────┐
                                    │   WEBHOOK   │
                                    │   TRIGGER   │
                                    │  /whatsapp  │
                                    └──────┬──────┘
                                           │
                                           ▼
                              ┌────────────────────────┐
                              │    IS GET REQUEST?     │
                              │   (Verification)       │
                              └────────────┬───────────┘
                                          │
                         ┌────────────────┼────────────────┐
                         │ YES            │                │ NO
                         ▼                │                ▼
               ┌─────────────────┐        │      ┌─────────────────┐
               │ CHECK VERIFY    │        │      │ EXTRACT WEBHOOK │
               │ TOKEN           │        │      │ DATA            │
               └────────┬────────┘        │      └────────┬────────┘
                        │                 │               │
                        ▼                 │               ▼
               ┌─────────────────┐        │      ┌─────────────────┐
               │ RETURN          │        │      │ ROUTE: MESSAGE  │
               │ hub.challenge   │        │      │ OR STATUS?      │
               └─────────────────┘        │      └────────┬────────┘
                                          │               │
                                          │    ┌──────────┴──────────┐
                                          │    │                     │
                                          │    │ messages[]          │ statuses[]
                                          │    ▼                     ▼
                                          │  ┌───────────┐    ┌───────────┐
                                          │  │ DEDUP     │    │ STATUS    │
                                          │  │ CHECK     │    │ UPDATE    │
                                          │  │ (meta_id) │    │ HANDLER   │
                                          │  └─────┬─────┘    └─────┬─────┘
                                          │        │                │
                                          │        ▼                │
                                          │  ┌───────────┐          │
                                          │  │ EXISTS?   │          │
                                          │  └─────┬─────┘          │
                                          │        │                │
                                          │   ┌────┴────┐           │
                                          │   │ NO      │ YES       │
                                          │   ▼         ▼           │
                                          │ ┌─────┐  ┌──────┐       │
                                          │ │CONT.│  │ SKIP │       │
                                          │ └──┬──┘  └──┬───┘       │
                                          │    │        │           │
                                          │    ▼        │           │
                                          │ ┌────────────────┐      │
                                          │ │ CONTACT UPSERT │      │
                                          │ │ (phone_number) │      │
                                          │ └───────┬────────┘      │
                                          │         │               │
                                          │         ▼               │
                                          │ ┌────────────────┐      │
                                          │ │ IS MEDIA TYPE? │      │
                                          │ └───────┬────────┘      │
                                          │         │               │
                                          │    ┌────┴────┐          │
                                          │    │ YES     │ NO       │
                                          │    ▼         │          │
                                          │ ┌────────┐   │          │
                                          │ │ GET    │   │          │
                                          │ │ MEDIA  │   │          │
                                          │ │ URL    │   │          │
                                          │ └───┬────┘   │          │
                                          │     │        │          │
                                          │     ▼        │          │
                                          │ ┌────────┐   │          │
                                          │ │DOWNLOAD│   │          │
                                          │ │ BINARY │   │          │
                                          │ └───┬────┘   │          │
                                          │     │        │          │
                                          │     ▼        │          │
                                          │ ┌────────┐   │          │
                                          │ │UPLOAD  │   │          │
                                          │ │SUPABASE│   │          │
                                          │ └───┬────┘   │          │
                                          │     │        │          │
                                          │     └────┬───┘          │
                                          │          │              │
                                          │          ▼              │
                                          │ ┌────────────────┐      │
                                          │ │ MAP MESSAGE    │      │
                                          │ │ TYPE & BODY    │      │
                                          │ └───────┬────────┘      │
                                          │         │               │
                                          │         ▼               │
                                          │ ┌────────────────┐      │
                                          │ │ INSERT MESSAGE │      │
                                          │ │ (messages)     │      │
                                          │ └───────┬────────┘      │
                                          │         │               │
                                          │         ▼               │
                                          │ ┌────────────────┐      │
                                          │ │ UPDATE MESSAGE │◄─────┘
                                          │ │ STATUS         │
                                          │ └───────┬────────┘
                                          │         │
                                          │         ▼
                                          │ ┌────────────────┐
                                          │ │ LOG EXECUTION  │
                                          │ │(automation_logs│
                                          │ └───────┬────────┘
                                          │         │
                                          │         ▼
                                          │ ┌────────────────┐
                                          │ │ RETURN 200 OK  │
                                          │ └────────────────┘
                                          │
                                          └─────────────────────────────────────────────
```

### Node Summary Table

| # | Node Name | Node Type | Purpose |
|---|-----------|-----------|---------|
| 1 | Webhook Trigger | Webhook | Receive Meta webhooks |
| 2 | Check Method | IF | Route GET (verify) vs POST (events) |
| 3 | Verify Token | Code | Compare hub.verify_token |
| 4 | Return Challenge | Respond | Return hub.challenge |
| 5 | Extract Data | Code | Parse webhook payload |
| 6 | Route Event | Switch | Message vs Status routing |
| 7 | Dedup Check | Supabase Select | Check meta_id exists |
| 8 | Skip If Exists | IF | Stop if duplicate |
| 9 | Contact Upsert | Supabase Upsert | Create/update contact |
| 10 | Check Media | IF | Route media vs text |
| 11 | Get Media URL | HTTP Request | Fetch URL from Meta |
| 12 | Download Media | HTTP Request | Download binary |
| 13 | Upload Supabase | HTTP Request | Upload to storage |
| 14 | Map Message | Code | Transform to DB schema |
| 15 | Insert Message | Supabase Insert | Store message |
| 16 | Update Status | Supabase Update | Update delivery status |
| 17 | Log Execution | Supabase Insert | Log to automation_logs |
| 18 | Return OK | Respond | HTTP 200 response |

---

## Environment Variables Required

| Variable | Description | Example |
|----------|-------------|---------|
| `META_ACCESS_TOKEN` | WhatsApp Cloud API access token | `EAAxxxxxxxx` |
| `META_VERIFY_TOKEN` | Webhook verification token | `my_secret_token_123` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | `eyJhbGci...` |

---

## Quick Reference

### Webhook Paths
```
Messages:  entry[0].changes[0].value.messages[0]
Statuses:  entry[0].changes[0].value.statuses[0]
Contacts:  entry[0].changes[0].value.contacts[0]
Metadata:  entry[0].changes[0].value.metadata
```

### Key SQL Patterns
```sql
-- Dedup check
SELECT id FROM messages WHERE meta_id = $1 LIMIT 1

-- Contact upsert
INSERT INTO contacts (...) VALUES (...) ON CONFLICT (phone_number) DO UPDATE SET ...

-- Message insert
INSERT INTO messages (...) VALUES (..., 'inbound', ..., 'n8n_inbound')

-- Status update
UPDATE messages SET status = $1 WHERE meta_id = $2
```

### Message Type Mapping Quick Reference
```
text     → type: 'text',     body: text.body
image    → type: 'image',    body: caption,    media_url: supabase_url
video    → type: 'video',    body: caption,    media_url: supabase_url
audio    → type: 'audio',    body: null,       media_url: supabase_url
document → type: 'document', body: filename,   media_url: supabase_url
location → type: 'text',     body: "Location: lat, lng"
```

---

*Document Version: 1.0*
*Last Updated: January 2026*
*Workflow: n8n_inbound*
