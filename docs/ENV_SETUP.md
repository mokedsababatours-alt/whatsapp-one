# Environment Configuration Guide

This document describes all environment variables required for the Headless WhatsApp Interface.

## Setup Instructions

1. Create a file named `.env.local` in the project root
2. Copy the template below and fill in your values
3. Never commit `.env.local` to version control

---

## Environment Variables Template

```env
# =============================================================================
# Headless WhatsApp Interface - Environment Configuration
# =============================================================================
# Copy this entire block to .env.local and fill in your values
# =============================================================================

# =============================================================================
# SUPABASE CONFIGURATION
# Get these from: Supabase Dashboard → Settings → API
# =============================================================================

# Your Supabase project URL
# Example: https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# Supabase Anonymous (Public) Key
# Safe to expose in browser - used for client-side queries with RLS
# Found in: Settings → API → Project API Keys → anon public
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Service Role Key (KEEP SECRET!)
# ⚠️ NEVER expose this in frontend code - bypasses RLS
# Used by: n8n workflows, server-side admin operations
# Found in: Settings → API → Project API Keys → service_role secret
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# =============================================================================
# META WHATSAPP CLOUD API CONFIGURATION
# Get these from: Meta Business Suite / Facebook Developers
# =============================================================================

# Meta Graph API Access Token
# Generate from: Meta Business Suite → System Users → Generate Token
# Required permissions: whatsapp_business_messaging, whatsapp_business_management
# Note: Tokens expire after 60 days - regenerate as needed
META_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# WhatsApp Phone Number ID
# Found in: Meta App Dashboard → WhatsApp → Getting Started → Phone Number ID
# This is the ID of your WhatsApp Business phone number
META_PHONE_NUMBER_ID=123456789012345

# WhatsApp Business Account ID (Optional)
# Found in: Meta Business Suite → Settings → WhatsApp Accounts
# Used for: Fetching message templates
# If not set, falls back to META_PHONE_NUMBER_ID
META_WABA_ID=987654321098765
```

---

## Variable Reference

### Supabase Variables

| Variable | Required | Public | Description |
|----------|----------|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | ✅ Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | ✅ Yes | Anonymous key for client-side queries |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ n8n only | ❌ No | Service role key (bypasses RLS) |

#### Where to Find Supabase Keys

1. Go to [supabase.com](https://supabase.com/) and open your project
2. Navigate to **Settings** → **API**
3. Copy values from **Project API Keys** section:
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`
4. Copy the **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`

---

### Meta WhatsApp API Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `META_ACCESS_TOKEN` | ✅ Yes | Graph API access token for WhatsApp |
| `META_PHONE_NUMBER_ID` | ✅ Yes | Your WhatsApp Business phone number ID |
| `META_WABA_ID` | Optional | WhatsApp Business Account ID (for templates) |

#### Where to Find Meta API Keys

##### Access Token

1. Go to [Meta Business Suite](https://business.facebook.com/)
2. Navigate to **Settings** → **Users** → **System Users**
3. Select your system user (or create one)
4. Click **Generate New Token**
5. Select your WhatsApp app
6. Grant permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
7. Set expiration (60 days max for non-permanent tokens)
8. Copy the generated token

##### Phone Number ID

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Open your app → **WhatsApp** → **Getting Started**
3. Find **Phone Number ID** in the API Setup section

##### WABA ID

1. Go to [Meta Business Suite](https://business.facebook.com/)
2. Navigate to **Settings** → **WhatsApp Accounts**
3. Copy the **WhatsApp Business Account ID**

---

### n8n Workflow Variables

These variables are configured in n8n, not in the Next.js application:

| Variable | Description | Where to Set |
|----------|-------------|--------------|
| `META_VERIFY_TOKEN` | Webhook verification token | n8n Credentials or Environment |
| `ADMIN_PHONE` | Phone number for notifications | n8n Environment Variables |
| `SUPABASE_URL` | Same as NEXT_PUBLIC_SUPABASE_URL | n8n Credentials |
| `SUPABASE_SERVICE_KEY` | Same as SUPABASE_SERVICE_ROLE_KEY | n8n Credentials |
| `META_ACCESS_TOKEN` | Same as above | n8n Credentials |
| `META_PHONE_NUMBER_ID` | Same as above | n8n Environment |

---

## Security Notes

### ⚠️ Never Expose These Publicly

- `SUPABASE_SERVICE_ROLE_KEY` — Bypasses all RLS policies
- `META_ACCESS_TOKEN` — Full access to your WhatsApp Business API

### ✅ Safe for Browser (NEXT_PUBLIC_ prefix)

- `NEXT_PUBLIC_SUPABASE_URL` — Just the project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Protected by RLS policies

### Token Rotation

| Token | Expiration | Action |
|-------|------------|--------|
| Supabase Anon Key | Never | Rotate if compromised |
| Supabase Service Key | Never | Rotate if compromised |
| Meta Access Token | 60 days | Regenerate before expiry |

---

## Verification

After setting up your `.env.local`, verify the configuration:

```bash
# Start the development server
npm run dev

# Check for errors in the console
# - "NEXT_PUBLIC_SUPABASE_URL is not defined" = missing Supabase URL
# - "META_ACCESS_TOKEN not configured" = missing Meta token
```

### Test API Connectivity

1. **Supabase**: Navigate to `/login` — should show login form
2. **Meta API**: After login, go to Settings → Templates — should fetch templates

---

*Document Version: 1.0*
*Last Updated: January 2026*
