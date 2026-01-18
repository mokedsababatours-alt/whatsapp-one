# Headless WhatsApp Interface

A custom, web-based chat interface that acts as a **remote control** for a headless WhatsApp Business API number. The system decouples the messaging logic (Meta) from the interface (Next.js), using Supabase as the single source of truth.

> **Core Philosophy:** *"The Interface is just a View; The Database is the Chat."*

---

## ✨ Features

- **📥 Unified Inbox** — Real-time chat interface with WhatsApp conversations
- **🎛️ Control Tower** — Dashboard for monitoring n8n automations, costs, and errors
- **⚙️ Settings** — Admin notifications, template sync, and configuration
- **📋 Template Messaging** — Send pre-approved templates when session expires (24h rule)
- **🖼️ Media Support** — Images, videos, audio, and documents with Supabase Storage
- **⏱️ Session Window Tracking** — Visual indicators for 24-hour messaging window
- **🔔 Admin Notifications** — Real-time alerts for new customer messages

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SYSTEM ARCHITECTURE                                │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │    WhatsApp User     │
                    │    (Customer)        │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Meta Cloud API     │
                    │   (WhatsApp Business)│
                    └──────────┬───────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
            ▼                  │                  ▼
   ┌─────────────────┐        │         ┌─────────────────┐
   │   n8n Webhook   │        │         │  Next.js API    │
   │   (Inbound)     │        │         │  (Outbound)     │
   └────────┬────────┘        │         └────────┬────────┘
            │                 │                  │
            │                 │                  │
            └────────────┬────┴────┬─────────────┘
                         │         │
                         ▼         ▼
              ┌─────────────────────────────┐
              │         SUPABASE            │
              │  ┌─────────────────────┐   │
              │  │  Postgres Database  │   │
              │  │  • contacts         │   │
              │  │  • messages         │   │
              │  │  • automation_logs  │   │
              │  └─────────────────────┘   │
              │  ┌─────────────────────┐   │
              │  │  Realtime Engine    │◄──┼──── Live Subscriptions
              │  └─────────────────────┘   │
              │  ┌─────────────────────┐   │
              │  │  Storage Bucket     │   │
              │  │  (whatsapp-media)   │   │
              │  └─────────────────────┘   │
              └──────────────┬──────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │    Next.js Frontend         │
              │    (Unified Inbox UI)       │
              └─────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |  
|-------|------------|
| **Frontend** | NodeJS v24.12.0 (App Router), React 19, TypeScript |
| **Styling** | TailwindCSS v4, Shadcn/UI, Lucide React Icons |
| **Backend** | Next.js API Routes, Supabase Edge Functions |
| **Database** | Supabase (PostgreSQL) with Row Level Security |
| **Real-time** | Supabase Realtime (WebSocket subscriptions) |
| **Storage** | Supabase Storage (whatsapp-media bucket) |
| **Auth** | Supabase Auth (email/password) |
| **Orchestration** | n8n (self-hosted webhook processing) |
| **Messaging API** | Meta WhatsApp Cloud API (v18.0) |

---

## 📋 Prerequisites

Before setting up the project, ensure you have:

- **Node.js 20+** — [Download](https://nodejs.org/)
- **npm, yarn, or pnpm** — Package manager
- **Supabase Account** — [Sign up](https://supabase.com/)
- **Meta Business Account** — [Meta Business Suite](https://business.facebook.com/)
- **WhatsApp Business API Access** — [Apply here](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- **n8n Instance** — Self-hosted or [n8n Cloud](https://n8n.io/)

---

## 🚀 Local Development Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd whatsapp-interface

# Install dependencies
npm install
```

### 2. Configure Environment Variables

```bash
# Create environment file from template
cp .env.example .env.local

# Edit with your credentials
nano .env.local
```

> 📄 See [Environment Variables](#-environment-variables) section below for complete reference.

### 3. Supabase Project Setup

1. Create a new project at [supabase.com](https://supabase.com/)
2. Select **Frankfurt (eu-central-1)** region for EU/Israel deployments
3. Copy your project URL and keys from **Settings → API**
4. Run the database schema:

```sql
-- Execute the contents of supabase/schema.sql in the SQL Editor
-- This creates: contacts, messages, automation_logs tables
-- Plus: RLS policies, indexes, storage bucket, and realtime config
```

> 📄 See [`supabase/schema.sql`](./supabase/schema.sql) for the complete schema.

### 4. Meta WhatsApp Business API Setup

1. Create a Meta App at [developers.facebook.com](https://developers.facebook.com/)
2. Add the **WhatsApp** product to your app
3. Set up a test phone number (free tier: 1000 conversations/month)
4. Generate a **System User Access Token** with permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Note your **Phone Number ID** and **WABA ID**

**Where to Find Meta Credentials:**

- **Access Token:** Meta Business Suite → Settings → Users → System Users → Generate Token (permissions: `whatsapp_business_messaging`, `whatsapp_business_management`)
- **Phone Number ID:** Meta App Dashboard → WhatsApp → Getting Started → Phone Number ID
- **WABA ID:** Meta Business Suite → Settings → WhatsApp Accounts → WhatsApp Business Account ID

> ⚠️ **Note:** Meta Access Tokens expire after 60 days. Regenerate before expiry.

### 5. n8n Webhook Setup

1. Create n8n webhook workflow to receive Meta webhooks (GET for verification, POST for events)
2. Configure the webhook URL in Meta App Dashboard → WhatsApp → Configuration → Webhooks
3. Set the verify token for webhook verification (must match n8n workflow)
4. Test with a message from your phone

> 📄 For detailed n8n workflow specifications, refer to the official [n8n documentation](https://docs.n8n.io/).

### 6. Create Test User

In Supabase Dashboard → **Authentication → Users → Add User**:
- Email: `admin@example.com`
- Password: `your-secure-password`
- Auto Confirm User: ✅

### 7. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — You'll be redirected to `/login`.

---

## 📁 Project Structure

```
whatsapp-interface/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (views)/           # Protected routes (inbox, activity, settings)
│   │   ├── api/               # API routes
│   │   │   ├── messages/      # Send message, send template
│   │   │   └── templates/     # Fetch templates list
│   │   └── login/             # Authentication page
│   ├── components/            # React components
│   │   └── ui/                # Shadcn/UI components
│   ├── lib/                   # Utilities
│   │   ├── supabase/          # Supabase client (browser/server)
│   │   └── auth.ts            # Auth utilities
│   └── types/                 # TypeScript definitions
│       └── database.ts        # Supabase schema types
├── supabase/
│   └── schema.sql             # Database schema
└── .env.example               # Environment variables template
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/messages/send` | Send text message (requires active session) |
| `POST` | `/api/messages/send-template` | Send template message (works anytime) |
| `GET` | `/api/templates` | Fetch approved templates from Meta |

---

## 🔧 Environment Variables

### Required Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous (public) key |
| `META_ACCESS_TOKEN` | ✅ | Meta Graph API access token |
| `META_PHONE_NUMBER_ID` | ✅ | WhatsApp phone number ID |
| `META_WABA_ID` | ✅ | WhatsApp Business Account ID (required for templates) |

### Optional Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ | Service role key (for n8n only, not frontend) |

### Where to Find Credentials

#### Supabase Configuration

1. Go to [supabase.com](https://supabase.com/) and open your project
2. Navigate to **Settings** → **API**
3. Copy values from **Project API Keys** section:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY` (for n8n only)

#### Meta WhatsApp API Configuration

1. **Access Token:** Meta Business Suite → Settings → Users → System Users → Generate Token
   - Required permissions: `whatsapp_business_messaging`, `whatsapp_business_management`
   - ⚠️ **Expires after 60 days** - regenerate before expiry

2. **Phone Number ID:** Meta App Dashboard → WhatsApp → Getting Started → Phone Number ID

3. **WABA ID:** Meta Business Suite → Settings → WhatsApp Accounts → WhatsApp Business Account ID

### Security Notes

- ✅ **Safe to expose** (used in browser): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ❌ **Never expose** (server-side only): `SUPABASE_SERVICE_ROLE_KEY`, `META_ACCESS_TOKEN`
- The service role key bypasses RLS policies and should only be used in n8n workflows, never in frontend code

---

## 🐛 Troubleshooting

### Webhook Not Receiving Messages

1. **Meta Verification Failed**
   - Check that your n8n webhook returns `hub.challenge` for GET requests
   - Verify the `verify_token` matches what's configured in Meta

2. **n8n URL Not Accessible**
   - Ensure n8n is publicly accessible (not localhost)
   - Check firewall/CORS settings
   - Use ngrok for local testing: `ngrok http 5678`

3. **Check Meta Webhook Logs**
   - Go to Meta App Dashboard → WhatsApp → Configuration → Webhooks
   - Click "Test" to see delivery attempts and errors

### Real-time Updates Not Working

1. **Supabase Realtime Not Enabled**
   - Verify tables are added to publication:
     ```sql
     SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
     ```
   - Run if missing:
     ```sql
     ALTER PUBLICATION supabase_realtime ADD TABLE messages;
     ALTER PUBLICATION supabase_realtime ADD TABLE automation_logs;
     ```

2. **RLS Policies Blocking Access**
   - Check RLS is enabled: `ALTER TABLE messages ENABLE ROW LEVEL SECURITY;`
   - Verify policies exist:
     ```sql
     SELECT * FROM pg_policies WHERE schemaname = 'public';
     ```

3. **Browser Console Errors**
   - Look for WebSocket connection errors
   - Check Supabase URL and anon key are correct

### Token Errors (Meta API)

1. **Token Expired**
   - System User tokens last 60 days
   - Generate a new token in Meta Business Suite

2. **Invalid Permissions**
   - Ensure token has `whatsapp_business_messaging` permission
   - Check token is associated with correct WABA

3. **Rate Limited**
   - Check `X-Business-Use-Case-Usage` header in responses
   - Implement exponential backoff for retries

### Session Window Issues

1. **Messages Blocked Despite Active Session**
   - Check `contacts.last_interaction_at` timestamp accuracy
   - Verify timezone handling (should use UTC)

2. **Session Shows Expired Incorrectly**
   - The 24h window is from the **last customer message**, not last business message
   - Check that inbound messages update `last_interaction_at`

3. **Template Required Error (131047)**
   - Session has truly expired — must use template message
   - Create approved templates in Meta Business Suite

### Database Connection Issues

1. **"Failed to fetch" Errors**
   - Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
   - Check network connectivity to Supabase

2. **Authentication Errors**
   - Clear browser cookies and re-login
   - Check Supabase Auth is configured

---

## 🚀 Production Deployment

### Quick Start

#### Docker Deployment

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

#### PM2 Deployment

```bash
# Install dependencies and build
npm ci
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production

# View logs
pm2 logs whatsapp-interface

# Stop
pm2 stop whatsapp-interface
```

### Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **CPU** | 1 vCPU | 2 vCPU |
| **RAM** | 1 GB | 2 GB |
| **Disk** | 10 GB | 20 GB |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### Health Check

The application includes a health check endpoint for monitoring:

```bash
curl http://localhost:3000/api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-13T12:00:00.000Z",
  "version": "0.1.0",
  "environment": "production"
}
```

### Reverse Proxy & SSL (Nginx)

For production on Hetzner or other servers, configure Nginx as a reverse proxy with SSL:

1. Install Nginx and Certbot
2. Create server block pointing to `http://127.0.0.1:3000`
3. Obtain SSL certificate: `sudo certbot --nginx -d your-domain.com`

> 📄 See [Next.js Deployment Documentation](https://nextjs.org/docs/deployment) for detailed setup instructions.

---

## 📚 External Documentation

- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [n8n Documentation](https://docs.n8n.io/)

---

## 📝 License

Private project — All rights reserved.

---

## 🤝 Contributing

This is an internal project. Contact the project maintainers for contribution guidelines.
