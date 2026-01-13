# Meta/WhatsApp Cloud API Reference

This document serves as the primary API reference for WhatsApp Cloud API integration. All agents working on messaging features should reference this document for compliance and implementation details.

---

## Table of Contents

1. [Text Message Sending](#1-text-message-sending)
2. [Webhook Payload Structures](#2-webhook-payload-structures)
3. [Template Message API](#3-template-message-api)
4. [24-Hour Session Window Rules](#4-24-hour-session-window-rules)
5. [Rate Limits](#5-rate-limits)
6. [Official Documentation Links](#6-official-documentation-links)

---

## 1. Text Message Sending

### Endpoint

```
POST https://graph.facebook.com/v18.0/{phone-number-id}/messages
```

### Headers

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer {access_token}` |
| `Content-Type` | `application/json` |

### Request Payload Schema

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "{recipient_phone}",
  "type": "text",
  "text": {
    "preview_url": false,
    "body": "{message_content}"
  }
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messaging_product` | string | Yes | Must be `"whatsapp"` |
| `recipient_type` | string | No | Default: `"individual"` |
| `to` | string | Yes | Recipient phone number in E.164 format (e.g., `"15551234567"`) |
| `type` | string | Yes | Message type: `"text"`, `"image"`, `"document"`, `"template"`, etc. |
| `text.preview_url` | boolean | No | Set `true` to render URL previews |
| `text.body` | string | Yes | Message content (max 4096 characters) |

### Example Request

```bash
curl -X POST "https://graph.facebook.com/v18.0/123456789/messages" \
  -H "Authorization: Bearer EAAxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "15551234567",
    "type": "text",
    "text": {
      "body": "Hello! Thank you for contacting us."
    }
  }'
```

### Success Response

```json
{
  "messaging_product": "whatsapp",
  "contacts": [
    {
      "input": "15551234567",
      "wa_id": "15551234567"
    }
  ],
  "messages": [
    {
      "id": "wamid.HBgLMTU1NTEyMzQ1NjcVAgARGBI1QjJGRjI2RDY1RjY0QTYyQUEA"
    }
  ]
}
```

---

## 2. Webhook Payload Structures

Webhooks deliver real-time notifications for incoming messages and message status updates.

### 2.1 Incoming Message Structure

**Path:** `entry[].changes[].value.messages[]`

#### Full Webhook Payload Structure

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "{whatsapp_business_account_id}",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "{your_phone_number}",
              "phone_number_id": "{phone_number_id}"
            },
            "contacts": [
              {
                "profile": {
                  "name": "{sender_name}"
                },
                "wa_id": "{sender_phone}"
              }
            ],
            "messages": [
              {
                "id": "{message_id}",
                "from": "{sender_phone}",
                "timestamp": "{unix_timestamp}",
                "type": "text",
                "text": {
                  "body": "{message_content}"
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

#### Message Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique message identifier (wamid) |
| `from` | string | Sender's phone number |
| `timestamp` | string | Unix timestamp of message |
| `type` | string | Message type: `text`, `image`, `document`, `audio`, `video`, `sticker`, `location`, `contacts`, `interactive`, `button`, `reaction` |
| `text.body` | string | Text content (when type is `text`) |
| `image.id` | string | Media ID (when type is `image`) |
| `image.mime_type` | string | MIME type of image |
| `image.sha256` | string | SHA256 hash of media |
| `image.caption` | string | Image caption if provided |
| `document.id` | string | Media ID (when type is `document`) |
| `document.filename` | string | Original filename |
| `audio.id` | string | Media ID (when type is `audio`) |
| `video.id` | string | Media ID (when type is `video`) |
| `location.latitude` | number | Latitude (when type is `location`) |
| `location.longitude` | number | Longitude |
| `location.name` | string | Location name |
| `location.address` | string | Location address |
| `context.from` | string | Phone number of quoted message sender |
| `context.id` | string | Message ID being replied to |

#### Example: Text Message Webhook

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "123456789",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15550001111",
              "phone_number_id": "987654321"
            },
            "contacts": [
              {
                "profile": { "name": "John Doe" },
                "wa_id": "15551234567"
              }
            ],
            "messages": [
              {
                "id": "wamid.HBgLMTU1NTEyMzQ1NjcVAgASGBQzQUY3",
                "from": "15551234567",
                "timestamp": "1704067200",
                "type": "text",
                "text": { "body": "Hello, I need help with my order" }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

#### Example: Image Message Webhook

```json
{
  "messages": [
    {
      "id": "wamid.HBgLMTU1NTEyMzQ1NjcVAgASGBQzQUY4",
      "from": "15551234567",
      "timestamp": "1704067300",
      "type": "image",
      "image": {
        "id": "1234567890",
        "mime_type": "image/jpeg",
        "sha256": "abc123...",
        "caption": "Here is my receipt"
      }
    }
  ]
}
```

### 2.2 Status Update Structure

**Path:** `entry[].changes[].value.statuses[]`

#### Status Webhook Payload

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "{whatsapp_business_account_id}",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "{your_phone_number}",
              "phone_number_id": "{phone_number_id}"
            },
            "statuses": [
              {
                "id": "{message_id}",
                "status": "{status}",
                "timestamp": "{unix_timestamp}",
                "recipient_id": "{recipient_phone}",
                "conversation": {
                  "id": "{conversation_id}",
                  "origin": {
                    "type": "{origin_type}"
                  }
                },
                "pricing": {
                  "billable": true,
                  "pricing_model": "CBP",
                  "category": "{category}"
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

#### Status Field Values

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Message ID this status refers to |
| `status` | string | One of: `sent`, `delivered`, `read`, `failed` |
| `timestamp` | string | Unix timestamp of status change |
| `recipient_id` | string | Recipient's phone number |
| `conversation.id` | string | Conversation identifier |
| `conversation.origin.type` | string | `user_initiated`, `business_initiated`, `referral_conversion` |
| `errors` | array | Present when status is `failed` |
| `errors[].code` | number | Error code |
| `errors[].title` | string | Error title |
| `errors[].message` | string | Error description |

#### Status Progression

```
sent → delivered → read
         ↘
          failed (with error details)
```

#### Example: Delivered Status

```json
{
  "statuses": [
    {
      "id": "wamid.HBgLMTU1NTEyMzQ1NjcVAgARGBI1QjJG",
      "status": "delivered",
      "timestamp": "1704067250",
      "recipient_id": "15551234567",
      "conversation": {
        "id": "conv_abc123",
        "origin": { "type": "business_initiated" }
      },
      "pricing": {
        "billable": true,
        "pricing_model": "CBP",
        "category": "marketing"
      }
    }
  ]
}
```

#### Example: Failed Status

```json
{
  "statuses": [
    {
      "id": "wamid.HBgLMTU1NTEyMzQ1NjcVAgARGBI1QjJG",
      "status": "failed",
      "timestamp": "1704067250",
      "recipient_id": "15551234567",
      "errors": [
        {
          "code": 131047,
          "title": "Re-engagement message",
          "message": "More than 24 hours have passed since the recipient last replied"
        }
      ]
    }
  ]
}
```

---

## 3. Template Message API

Template messages are pre-approved message formats required for initiating conversations or messaging outside the 24-hour window.

### Endpoint

```
POST https://graph.facebook.com/v18.0/{phone-number-id}/messages
```

### Request Payload Schema

```json
{
  "messaging_product": "whatsapp",
  "to": "{recipient_phone}",
  "type": "template",
  "template": {
    "name": "{template_name}",
    "language": {
      "code": "{language_code}"
    },
    "components": []
  }
}
```

### Template Object Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Exact template name as registered |
| `language.code` | string | Yes | Language code (e.g., `"en_US"`, `"es"`, `"pt_BR"`) |
| `components` | array | No | Dynamic content for template variables |

### Component Types

#### Header Component

For templates with dynamic header content (text, image, document, video).

```json
{
  "type": "header",
  "parameters": [
    {
      "type": "text",
      "text": "Order #12345"
    }
  ]
}
```

**Image Header:**
```json
{
  "type": "header",
  "parameters": [
    {
      "type": "image",
      "image": {
        "link": "https://example.com/image.jpg"
      }
    }
  ]
}
```

**Document Header:**
```json
{
  "type": "header",
  "parameters": [
    {
      "type": "document",
      "document": {
        "link": "https://example.com/invoice.pdf",
        "filename": "Invoice_12345.pdf"
      }
    }
  ]
}
```

#### Body Component

For templates with variable placeholders ({{1}}, {{2}}, etc.).

```json
{
  "type": "body",
  "parameters": [
    {
      "type": "text",
      "text": "John"
    },
    {
      "type": "text",
      "text": "December 15, 2024"
    },
    {
      "type": "currency",
      "currency": {
        "fallback_value": "$100.00",
        "code": "USD",
        "amount_1000": 100000
      }
    }
  ]
}
```

#### Button Component

For templates with dynamic button content.

**Quick Reply Button:**
```json
{
  "type": "button",
  "sub_type": "quick_reply",
  "index": "0",
  "parameters": [
    {
      "type": "payload",
      "payload": "confirm_order_123"
    }
  ]
}
```

**URL Button with Dynamic Suffix:**
```json
{
  "type": "button",
  "sub_type": "url",
  "index": "0",
  "parameters": [
    {
      "type": "text",
      "text": "order/12345"
    }
  ]
}
```

### Complete Template Message Example

**Template:** "order_confirmation" with header, body variables, and buttons

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "template",
  "template": {
    "name": "order_confirmation",
    "language": {
      "code": "en_US"
    },
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "text",
            "text": "ORD-2024-12345"
          }
        ]
      },
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "John"
          },
          {
            "type": "text",
            "text": "MacBook Pro 14\""
          },
          {
            "type": "currency",
            "currency": {
              "fallback_value": "$1,999.00",
              "code": "USD",
              "amount_1000": 1999000
            }
          }
        ]
      },
      {
        "type": "button",
        "sub_type": "quick_reply",
        "index": "0",
        "parameters": [
          {
            "type": "payload",
            "payload": "track_ORD-2024-12345"
          }
        ]
      }
    ]
  }
}
```

### Simple Template (No Variables)

```json
{
  "messaging_product": "whatsapp",
  "to": "15551234567",
  "type": "template",
  "template": {
    "name": "hello_world",
    "language": {
      "code": "en_US"
    }
  }
}
```

---

## 4. 24-Hour Session Window Rules

WhatsApp enforces strict messaging windows to prevent spam and ensure user consent.

### How the Session Window Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    24-HOUR SESSION WINDOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Customer sends message                                          │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────┐       │
│  │         WINDOW OPENS (24 hours starts)               │       │
│  │                                                      │       │
│  │  ✓ Free-form text messages allowed                   │       │
│  │  ✓ Media messages allowed                            │       │
│  │  ✓ Interactive messages allowed                      │       │
│  │  ✓ Template messages allowed                         │       │
│  │                                                      │       │
│  │  Each new customer message RESETS the 24-hour timer  │       │
│  └──────────────────────────────────────────────────────┘       │
│                        │                                         │
│                        ▼ (24 hours pass without customer reply)  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              WINDOW CLOSES                           │       │
│  │                                                      │       │
│  │  ✗ Free-form messages BLOCKED                        │       │
│  │  ✗ Media messages BLOCKED                            │       │
│  │  ✓ Template messages ONLY                            │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Rules

| Rule | Description |
|------|-------------|
| **Window Opening** | Triggered when customer sends any message to your business |
| **Window Duration** | Exactly 24 hours from the last customer message |
| **Window Reset** | Each new customer message resets the 24-hour timer |
| **Inside Window** | Any message type allowed (text, media, interactive, templates) |
| **Outside Window** | Only pre-approved template messages allowed |
| **Reopening Window** | Customer must reply to a template message to reopen |

### Conversation Categories

| Category | Trigger | Pricing |
|----------|---------|---------|
| **User-Initiated** | Customer messages first | Lower cost |
| **Business-Initiated** | Business sends template first | Higher cost |
| **Marketing** | Promotional templates | Highest cost |
| **Utility** | Transactional templates (confirmations, updates) | Medium cost |
| **Authentication** | OTP/verification templates | Lower cost |
| **Service** | Customer service within window | Included in conversation |

### Implementation Guidelines

1. **Track Window Expiration**
   - Store `last_customer_message_timestamp` for each contact
   - Calculate window expiration: `timestamp + 24 hours`
   - Check window status before sending non-template messages

2. **Handle Window Expiration Gracefully**
   ```
   IF current_time > (last_customer_message + 24 hours):
       USE template_message()
   ELSE:
       USE any_message_type()
   ```

3. **Error Handling**
   - Error code `131047`: "More than 24 hours have passed since the recipient last replied"
   - On this error: Queue a template message instead

4. **Best Practices**
   - Always have relevant templates approved and ready
   - Send important information before window expires
   - Use templates to re-engage inactive customers
   - Track conversation pricing category for cost management

---

## 5. Rate Limits

### Messaging Tiers

WhatsApp Business accounts have messaging limits based on quality and volume history.

| Tier | Daily Limit | Unlock Criteria |
|------|-------------|-----------------|
| **Unverified** | 250 unique contacts/day | New business accounts |
| **Tier 1** | 1,000 unique contacts/day | Verify business + send 500 messages |
| **Tier 2** | 10,000 unique contacts/day | Maintain quality + reach Tier 1 limit |
| **Tier 3** | 100,000 unique contacts/day | Maintain quality + reach Tier 2 limit |
| **Tier 4** | Unlimited | Maintain quality + reach Tier 3 limit |

### Tier Progression Rules

- **Upgrade**: Automatic when you reach 2x your current limit with good quality
- **Downgrade**: Automatic if quality rating drops to "Low"
- **Quality Score**: Based on user feedback (blocks, reports)

### Throughput Limits

| Metric | Limit |
|--------|-------|
| **Cloud API Throughput** | 80 messages/second |
| **On-Premise API Throughput** | 70 messages/second |
| **Media Upload** | 500 requests/minute per phone number |
| **Media Download** | 2000 requests/minute per phone number |

### Rate Limit Headers

Check response headers for current limits:

```
X-Business-Use-Case-Usage: {
  "messaging": {
    "call_count": 28,
    "total_cputime": 50,
    "total_time": 50,
    "estimated_time_to_regain_access": 0
  }
}
```

### Handling Rate Limits

1. **Error Response** (HTTP 429 or error in response):
   ```json
   {
     "error": {
       "message": "Rate limit exceeded",
       "type": "OAuthException",
       "code": 4,
       "error_subcode": 2207051,
       "fbtrace_id": "ABC123"
     }
   }
   ```

2. **Retry Strategy**:
   - Implement exponential backoff
   - Start with 1-second delay, double on each retry
   - Max 5 retries before queuing for later

3. **Best Practices**:
   - Implement message queuing system
   - Batch messages when possible
   - Monitor quality score regularly
   - Keep under 80% of throughput limit for headroom

---

## 6. Official Documentation Links

### Primary References

| Resource | URL |
|----------|-----|
| **Cloud API Overview** | https://developers.facebook.com/docs/whatsapp/cloud-api/overview |
| **Send Messages** | https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages |
| **Webhooks Setup** | https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components |
| **Webhook Payload Reference** | https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples |
| **Message Templates** | https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates |
| **Template Components** | https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages#template-object |

### Additional References

| Resource | URL |
|----------|-----|
| **API Reference (Messages)** | https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages |
| **Error Codes** | https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes |
| **Rate Limits** | https://developers.facebook.com/docs/whatsapp/cloud-api/overview/rate-limiting |
| **Conversation Pricing** | https://developers.facebook.com/docs/whatsapp/pricing |
| **Quality Rating** | https://developers.facebook.com/docs/whatsapp/messaging-limits |
| **Media Messages** | https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media |
| **Phone Numbers API** | https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers |

### Meta Business Suite

| Resource | URL |
|----------|-----|
| **Business Manager** | https://business.facebook.com/ |
| **WhatsApp Manager** | https://business.facebook.com/wa/manage/home/ |
| **Template Manager** | https://business.facebook.com/wa/manage/message-templates/ |

---

## Quick Reference Card

### Send Text Message
```bash
POST /v18.0/{phone_number_id}/messages
Authorization: Bearer {token}

{"messaging_product":"whatsapp","to":"{phone}","type":"text","text":{"body":"{msg}"}}
```

### Send Template
```bash
POST /v18.0/{phone_number_id}/messages
Authorization: Bearer {token}

{"messaging_product":"whatsapp","to":"{phone}","type":"template","template":{"name":"{name}","language":{"code":"en_US"}}}
```

### Webhook Message Path
```
entry[0].changes[0].value.messages[0]
```

### Webhook Status Path
```
entry[0].changes[0].value.statuses[0]
```

### Key Limits
- **Throughput**: 80 msg/sec
- **Session Window**: 24 hours
- **Text Length**: 4096 chars

---

*Document Version: 1.0*  
*Last Updated: January 2026*  
*API Version: v18.0*
