# n8n Webhook Configuration Guide

Complete guide for connecting n8n workflows to Meta WhatsApp Cloud API and the Headless WhatsApp Interface application.

**Related Documents:**
- [N8N_INBOUND_SPEC.md](./N8N_INBOUND_SPEC.md) — Detailed inbound workflow specification
- [N8N_NOTIFICATION_SPEC.md](./N8N_NOTIFICATION_SPEC.md) — Admin notification workflow specification
- [META_API_REFERENCE.md](./META_API_REFERENCE.md) — WhatsApp Cloud API reference

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Meta Webhook Subscription](#2-meta-webhook-subscription)
3. [n8n Webhook Verification Setup](#3-n8n-webhook-verification-setup)
4. [Supabase Connection in n8n](#4-supabase-connection-in-n8n)
5. [Building the Inbound Workflow](#5-building-the-inbound-workflow)
6. [Adding Notification Branch](#6-adding-notification-branch)
7. [Environment Variables](#7-environment-variables)
8. [End-to-End Testing](#8-end-to-end-testing)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

Before starting, ensure you have:

| Requirement | Details |
|-------------|---------|
| **n8n Instance** | Self-hosted or n8n Cloud with public URL |
| **Meta App** | WhatsApp product added, phone number configured |
| **Supabase Project** | Database with schema applied (see `supabase/schema.sql`) |
| **Meta Access Token** | System User token with messaging permissions |

### n8n Public URL

Your n8n instance must be publicly accessible for Meta webhooks:

```
# Self-hosted example
https://n8n.your-domain.com

# n8n Cloud example
https://your-instance.app.n8n.cloud

# Local development (use ngrok)
ngrok http 5678
# Returns: https://abc123.ngrok.io
```

---

## 2. Meta Webhook Subscription

### Step 1: Navigate to Webhooks Configuration

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Open your app
3. Navigate to **WhatsApp** → **Configuration**
4. Find the **Webhooks** section

### Step 2: Configure Webhook

Click **Edit** on the Webhooks configuration:

| Field | Value |
|-------|-------|
| **Callback URL** | `https://your-n8n-url/webhook/whatsapp-inbound` |
| **Verify Token** | A secret string you create (e.g., `my_secret_verify_token_2024`) |

> ⚠️ **Important:** Save the verify token — you'll need it in n8n!

### Step 3: Subscribe to Webhook Fields

After verification succeeds, subscribe to these fields:

| Field | Required | Purpose |
|-------|----------|---------|
| **messages** | ✅ Yes | Incoming messages and status updates |
| **message_template_status_update** | Optional | Template approval notifications |

### Step 4: Webhook Verification Flow

When you click **Verify and Save**, Meta sends a GET request:

```
GET /webhook/whatsapp-inbound?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE_STRING
```

Your n8n workflow must:
1. Check `hub.verify_token` matches your secret
2. Return `hub.challenge` value as plain text

---

## 3. n8n Webhook Verification Setup

### Create the Webhook Workflow

1. In n8n, create a new workflow: **WhatsApp Inbound**
2. Add a **Webhook** node as the trigger

### Webhook Node Configuration

| Setting | Value |
|---------|-------|
| **HTTP Method** | GET, POST |
| **Path** | `whatsapp-inbound` |
| **Authentication** | None |
| **Respond** | Using 'Respond to Webhook' node |

### Add Verification Logic

Add a **Code** node after the Webhook:

**Name:** `Handle Verification`

```javascript
// Check if this is a verification request (GET with hub params)
const query = $input.item.json.query || {};
const method = $input.item.json.headers?.['method'] || 
               $input.item.json.method || 
               $('Webhook').item.json.method;

// Your verify token (must match what's in Meta dashboard)
const VERIFY_TOKEN = $env.META_VERIFY_TOKEN || 'your_secret_token';

if (query['hub.mode'] === 'subscribe') {
  // This is a verification request
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];
  
  if (token === VERIFY_TOKEN) {
    // Valid token - return challenge
    return {
      json: {
        isVerification: true,
        challenge: challenge,
        success: true
      }
    };
  } else {
    // Invalid token
    return {
      json: {
        isVerification: true,
        success: false,
        error: 'Invalid verify token'
      }
    };
  }
}

// Not a verification request - continue to message processing
return {
  json: {
    ...($input.item.json.body || $input.item.json),
    isVerification: false
  }
};
```

### Add Response Routing

Add an **IF** node:

**Name:** `Is Verification?`

| Setting | Value |
|---------|-------|
| **Condition** | `{{ $json.isVerification }}` equals `true` |

### Verification Response Node

Add **Respond to Webhook** node (True branch):

| Setting | Value |
|---------|-------|
| **Respond With** | Text |
| **Response Body** | `{{ $json.challenge }}` |
| **Response Code** | `200` |

### Test Verification with curl

Before configuring in Meta, test locally:

```bash
# Test verification request
curl -X GET "https://your-n8n-url/webhook/whatsapp-inbound?hub.mode=subscribe&hub.verify_token=your_secret_token&hub.challenge=test123"

# Expected response: test123
```

### Complete Verification Flow Diagram

```
[Webhook Trigger]
       │
       ▼
[Handle Verification] (Code node)
       │
       ▼
[Is Verification?] (IF node)
       │
  ┌────┴────┐
  │         │
 YES        NO
  │         │
  ▼         ▼
[Return     [Continue to
Challenge]  Message Processing]
```

---

## 4. Supabase Connection in n8n

### Create Supabase Credentials

1. In n8n, go to **Credentials** → **Add Credential**
2. Search for **Supabase**
3. Fill in the fields:

| Field | Value | Where to Find |
|-------|-------|---------------|
| **Host** | `https://your-project.supabase.co` | Supabase Dashboard → Settings → API → URL |
| **Service Role Key** | `eyJhbGciOiJIUzI1NiIs...` | Supabase Dashboard → Settings → API → service_role |

> ⚠️ **Use Service Role Key** — It bypasses RLS for server-side operations

### Alternative: PostgreSQL Direct Connection

For advanced use cases, connect directly to Postgres:

1. Add **Postgres** credential
2. Use connection string from Supabase Dashboard → Settings → Database

```
Host: db.your-project.supabase.co
Port: 5432
Database: postgres
User: postgres
Password: [your database password]
SSL: Require
```

### Testing the Connection

Add a **Supabase** node with:

| Setting | Value |
|---------|-------|
| **Operation** | Get All Rows |
| **Table** | `contacts` |
| **Limit** | 1 |

Execute the node — it should return data (or empty array if no contacts).

### Supabase Node Operations Reference

| Operation | Use Case |
|-----------|----------|
| **Insert** | Create new contact/message |
| **Get All Rows** | Fetch templates, check duplicates |
| **Update** | Update message status |
| **Upsert** | Contact upsert (ON CONFLICT) |

### Insert Node Example (Messages)

| Setting | Value |
|---------|-------|
| **Operation** | Insert |
| **Table** | `messages` |
| **Columns** | contact_phone, direction, type, body, meta_id, status, source |

---

## 5. Building the Inbound Workflow

### Quick-Start Node Sequence

```
[Webhook]
    │
    ▼
[Handle Verification]
    │
    ▼
[Is Verification?] ──YES──► [Return Challenge]
    │
   NO
    │
    ▼
[Extract Webhook Data]
    │
    ▼
[Route: Message or Status?]
    │
    ├──► messages[] ──► [Dedup Check] ──► [Contact Upsert] ──► [Message Insert]
    │
    └──► statuses[] ──► [Update Message Status]
```

### Step-by-Step Setup

#### 1. Extract Webhook Data (Code Node)

```javascript
const body = $input.item.json.body || $input.item.json;
const entry = body.entry?.[0];
const changes = entry?.changes?.[0];
const value = changes?.value;

return {
  json: {
    metadata: {
      phone_number_id: value?.metadata?.phone_number_id,
      display_phone_number: value?.metadata?.display_phone_number
    },
    messages: value?.messages || [],
    statuses: value?.statuses || [],
    contacts: value?.contacts || [],
    event_type: value?.messages?.length ? 'message' : 
                value?.statuses?.length ? 'status' : 'other'
  }
};
```

#### 2. Route by Event Type (Switch Node)

| Output | Condition |
|--------|-----------|
| **Message** | `{{ $json.event_type }}` equals `message` |
| **Status** | `{{ $json.event_type }}` equals `status` |
| **Other** | Fallback (do nothing) |

#### 3. Deduplication Check (Supabase Select)

| Setting | Value |
|---------|-------|
| **Operation** | Get All Rows |
| **Table** | `messages` |
| **Filter** | `meta_id` equals `{{ $json.messages[0].id }}` |
| **Limit** | 1 |

#### 4. Skip If Exists (IF Node)

| Condition | Check if result array is empty |
|-----------|-------------------------------|
| **Continue** | `{{ $json.length === 0 }}` |

#### 5. Contact Upsert (Code + Supabase)

Use raw SQL via Postgres node or build with Code node:

```javascript
const message = $input.first().json.messages[0];
const contact = $input.first().json.contacts[0];

return {
  json: {
    phone_number: message.from,
    profile_name: contact?.profile?.name || null,
    last_interaction_at: new Date().toISOString(),
    session_status: 'active',
    unread_count: 1  // Will be incremented in ON CONFLICT
  }
};
```

#### 6. Message Insert (Supabase Insert)

Map fields:

| Database Column | Expression |
|-----------------|------------|
| `contact_phone` | `{{ $json.messages[0].from }}` |
| `direction` | `inbound` |
| `type` | `{{ $json.messages[0].type }}` |
| `body` | `{{ $json.messages[0].text?.body }}` |
| `meta_id` | `{{ $json.messages[0].id }}` |
| `status` | `delivered` |
| `source` | `n8n_inbound` |

### Detailed Specification

For complete implementation details including:
- Media handling (download from Meta, upload to Supabase)
- Message type mapping
- Status update handling
- Error handling

**→ See [N8N_INBOUND_SPEC.md](./N8N_INBOUND_SPEC.md)**

---

## 6. Adding Notification Branch

### Integration Point

Add the notification branch **after** successful message insert:

```
[Message Insert]
       │
       ├──────────────────────┐
       │                      │
       ▼                      ▼
[Log Execution]      [Notification Branch]
       │                      │
       ▼                      ▼
[Return 200]         [Format Notification]
                              │
                              ▼
                     [Rate Limit Check]
                              │
                              ▼
                     [Send to Admin]
```

### Required Nodes

#### 1. Check If Inbound (IF Node)

| Condition | `{{ $json.direction === 'inbound' }}` |

#### 2. Format Notification (Code Node)

```javascript
const message = $input.item.json;
const senderName = message.profile_name || message.contact_phone;

let bodyPreview = '';
if (message.type === 'text' && message.body) {
  bodyPreview = message.body.length > 50 
    ? message.body.substring(0, 50) + '...' 
    : message.body;
} else {
  bodyPreview = `[${message.type} message]`;
}

return {
  json: {
    notification_text: `🔔 New message from ${senderName}: ${bodyPreview}`,
    contact_phone: message.contact_phone
  }
};
```

#### 3. Send Notification (HTTP Request Node)

| Setting | Value |
|---------|-------|
| **Method** | POST |
| **URL** | `https://graph.facebook.com/v18.0/{{ $env.META_PHONE_NUMBER_ID }}/messages` |
| **Authentication** | Header Auth |
| **Header** | `Authorization: Bearer {{ $env.META_ACCESS_TOKEN }}` |

**Body:**
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

### Detailed Specification

For complete notification implementation including:
- Rate limiting (1 per contact per 5 minutes)
- Template message fallback
- Error handling

**→ See [N8N_NOTIFICATION_SPEC.md](./N8N_NOTIFICATION_SPEC.md)**

---

## 7. Environment Variables

### Required Variables in n8n

Configure in n8n Settings → Environment Variables (or Docker/PM2 config):

| Variable | Description | Example |
|----------|-------------|---------|
| `META_VERIFY_TOKEN` | Webhook verification token | `my_secret_verify_token_2024` |
| `META_ACCESS_TOKEN` | Meta Graph API token | `EAAxxxxxxx...` |
| `META_PHONE_NUMBER_ID` | WhatsApp phone number ID | `123456789012345` |
| `ADMIN_PHONE` | Admin notification number | `+972501234567` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | `eyJhbGci...` |

### Setting Environment Variables

#### n8n Cloud

1. Go to **Settings** → **Environment Variables**
2. Add each variable

#### Self-Hosted (Docker)

```yaml
# docker-compose.yml
services:
  n8n:
    environment:
      - META_VERIFY_TOKEN=my_secret_token
      - META_ACCESS_TOKEN=EAAxxxxx
      - META_PHONE_NUMBER_ID=123456789
      - ADMIN_PHONE=+972501234567
```

#### Self-Hosted (PM2)

```javascript
// ecosystem.config.js
env: {
  META_VERIFY_TOKEN: 'my_secret_token',
  META_ACCESS_TOKEN: 'EAAxxxxx',
  // ...
}
```

### Accessing in n8n

```javascript
// In Code nodes
const token = $env.META_ACCESS_TOKEN;

// In expressions
{{ $env.META_PHONE_NUMBER_ID }}
```

---

## 8. End-to-End Testing

### Test Procedure

Follow these steps to verify the complete integration:

### Step 1: Send Test Message

1. Open WhatsApp on your phone
2. Send a message to your business number
3. Example: "Hello, testing integration"

### Step 2: Verify n8n Execution

1. Open n8n → Your workflow
2. Check **Executions** tab
3. Verify:
   - ✅ Workflow executed
   - ✅ No errors (green status)
   - ✅ All nodes completed

If errors occur, click the execution to see details.

### Step 3: Verify Supabase Records

**Check contacts table:**
```sql
SELECT * FROM contacts 
WHERE phone_number = '+YOUR_PHONE_NUMBER'
ORDER BY created_at DESC
LIMIT 1;
```

Expected:
- `phone_number`: Your phone number
- `profile_name`: Your WhatsApp name
- `session_status`: `active`

**Check messages table:**
```sql
SELECT * FROM messages 
WHERE contact_phone = '+YOUR_PHONE_NUMBER'
ORDER BY created_at DESC
LIMIT 1;
```

Expected:
- `direction`: `inbound`
- `type`: `text`
- `body`: Your message text
- `status`: `delivered`
- `source`: `n8n_inbound`

### Step 4: Verify UI Real-time Update

1. Open the application: `http://localhost:3000/inbox`
2. Login with your credentials
3. The new message should appear automatically (real-time)

### Step 5: Verify Admin Notification (Optional)

If notification branch is configured:
1. Check admin phone for notification
2. Message format: "🔔 New message from [Name]: [Preview]..."

### Test Checklist

| Test | Expected Result | ✓ |
|------|-----------------|---|
| Send WhatsApp message | Message received by Meta | ☐ |
| n8n webhook triggered | Workflow executes | ☐ |
| Dedup check passes | No duplicate error | ☐ |
| Contact created/updated | Row in contacts table | ☐ |
| Message inserted | Row in messages table | ☐ |
| UI updates | Message appears in Inbox | ☐ |
| Notification sent | Admin receives alert | ☐ |

---

## 9. Troubleshooting

### Webhook Not Triggering

1. **Check Meta Dashboard**
   - Go to WhatsApp → Configuration → Webhooks
   - Click "Test" to see delivery attempts

2. **Check n8n Logs**
   ```bash
   # Docker
   docker logs n8n
   
   # PM2
   pm2 logs n8n
   ```

3. **Verify URL is accessible**
   ```bash
   curl https://your-n8n-url/webhook/whatsapp-inbound
   # Should return something (not connection error)
   ```

### Verification Failing

1. **Token mismatch**
   - Verify `META_VERIFY_TOKEN` in n8n matches Meta dashboard
   - Check for extra spaces or characters

2. **Response format**
   - Must return `hub.challenge` as plain text
   - Not JSON wrapped

3. **Test manually**
   ```bash
   curl "https://your-n8n-url/webhook/whatsapp-inbound?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test"
   # Should return: test
   ```

### Messages Not Saving

1. **Check Supabase credentials**
   - Verify service role key is correct
   - Test connection with Select node

2. **Check RLS policies**
   - Service role should bypass RLS
   - If using anon key, check policies exist

3. **Check for constraint errors**
   - `meta_id` must be unique
   - `contact_phone` must exist (create contact first)

### Duplicates Being Created

1. **Dedup node not working**
   - Verify `meta_id` filter is correct
   - Check IF node condition

2. **Meta retrying webhooks**
   - Ensure workflow returns 200 within 20 seconds
   - Add timeout handling

### Real-time Not Updating

1. **Check Supabase Realtime**
   ```sql
   SELECT * FROM pg_publication_tables 
   WHERE pubname = 'supabase_realtime';
   ```

2. **Check browser console**
   - Look for WebSocket errors
   - Verify subscription established

### Notification Not Sending

1. **Check admin phone format**
   - Must be E.164: `+972501234567`
   - No spaces or dashes

2. **Check session window**
   - Admin must have active session OR use template
   - Look for error code 131047

3. **Rate limiting**
   - May be blocked if sent recently
   - Check rate limit logic

---

## Quick Reference

### Webhook URL Format
```
https://your-n8n-url/webhook/whatsapp-inbound
```

### Verification Response
```
Return: hub.challenge value as plain text
```

### Message Insert Fields
```
contact_phone, direction, type, body, meta_id, status, source
```

### Environment Variables
```
META_VERIFY_TOKEN, META_ACCESS_TOKEN, META_PHONE_NUMBER_ID, ADMIN_PHONE
```

### Test Command
```bash
curl "https://n8n-url/webhook/whatsapp-inbound?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=test"
```

---

*Document Version: 1.0*
*Last Updated: January 2026*
