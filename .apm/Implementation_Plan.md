# Headless WhatsApp Interface (Internal CRM) – APM Implementation Plan
**Memory Strategy:** Dynamic-MD
**Last Modification:** Plan creation by the Setup Agent.
**Project Overview:** A custom web-based chat interface serving as a "remote control" for WhatsApp Business API. Uses Next.js (App Router) frontend with Supabase as the single source of truth (Postgres + Realtime + Storage). n8n handles inbound message processing (user-built workflows). Features three views: Unified Inbox (conversations), Control Tower (automation monitoring), and Settings. Key technical challenges include 24-hour session window compliance, media URL persistence, and real-time message synchronization.

---

## Phase 1: Foundation & Data Layer

### Task 1.1 – Supabase Project Setup & Schema Creation - Agent_Database
**Objective:** Create Supabase project and implement core database schema.
**Output:** Configured Supabase project with `contacts`, `messages`, `automation_logs` tables.
**Guidance:** User creates project (Israel/EU region), agent provides schema. Verify region availability first.

1. Ad-Hoc Delegation – Verify Supabase Israel region availability
2. User Action: Create Supabase project in Israel or nearest EU region
3. Create SQL schema for `contacts` table (phone_number PK, profile_name, last_interaction_at, session_status enum, unread_count), `messages` table (id UUID, contact_phone FK, direction enum, type enum, body, media_url, meta_id unique, status enum, created_at), `automation_logs` table (id UUID, workflow_name, contact_phone, status enum, error_detail, cost_estimate float, executed_at)
4. Add indexes on `messages.contact_phone`, `messages.created_at`, `messages.meta_id`, `contacts.last_interaction_at`

### Task 1.2 – Supabase Storage & RLS Configuration - Agent_Database
**Objective:** Configure storage bucket and security policies.
**Output:** `whatsapp-media` bucket and RLS policies for all tables.
**Guidance:** **Depends on: Task 1.1 Output**

- Create `whatsapp-media` storage bucket with public read access for authenticated users
- Implement RLS policies for `contacts` table (authenticated users can read/write)
- Implement RLS policies for `messages` table (authenticated users can read/write)
- Implement RLS policies for `automation_logs` table (authenticated users can read)
- Enable Supabase Realtime on `messages` and `automation_logs` tables

### Task 1.3 – Next.js Project Scaffolding - Agent_Frontend_Setup
**Objective:** Initialize Next.js project with App Router and required tooling.
**Output:** Working project skeleton with TailwindCSS, Shadcn/UI, and modular folder structure.
**Guidance:** Prioritize modular, maintainable structure for future flexibility.

1. Initialize Next.js 14+ project with App Router, TypeScript, TailwindCSS, ESLint
2. Install dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `lucide-react`
3. Initialize Shadcn/UI with default theme configuration
4. Create folder structure: `app/(views)/inbox/`, `app/(views)/activity/`, `app/(views)/settings/`, `app/api/`, `components/ui/`, `components/inbox/`, `components/activity/`, `components/settings/`, `lib/`, `types/`, `hooks/`
5. Create `.env.local.example` with placeholders: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`

### Task 1.4 – Meta API Reference Documentation - Agent_Integration
**Objective:** Create reference document for Meta/WhatsApp Cloud API compliance.
**Output:** `docs/META_API_REFERENCE.md` with endpoints, schemas, and official documentation links.
**Guidance:** This file ensures agents use current API versions. Include practical examples.

- Document text message sending: `POST /{phone-number-id}/messages` with payload schema (messaging_product, recipient_type, to, type, text.body)
- Document webhook payload structure for incoming messages (entry.changes.value.messages) and status updates (entry.changes.value.statuses)
- Document template message API: payload structure with template name, language, and components array
- Document 24-hour customer service window rules, rate limits, and link to official Meta WhatsApp Cloud API documentation

### Task 1.5 – n8n Inbound Pipeline Specification - Agent_Integration
**Objective:** Create specification for user to build n8n inbound message workflow.
**Output:** `docs/N8N_INBOUND_SPEC.md` with complete workflow logic and Supabase integration patterns.
**Guidance:** **Depends on: Task 1.1 Output by Agent_Database**. User builds workflow using this spec.

- Specify webhook trigger setup: endpoint URL, Meta webhook verification (hub.mode, hub.verify_token, hub.challenge)
- Document message vs status update differentiation logic (check for messages array vs statuses array)
- Specify deduplication: check if `meta_id` exists in messages table before insert
- Document contact upsert logic: INSERT ON CONFLICT (phone_number) DO UPDATE last_interaction_at
- Specify media handling flow: detect media message → GET media URL from Meta → download binary → upload to Supabase Storage → store public URL in media_url field
- Provide complete Supabase insert SQL patterns for messages table

### Task 1.6 – User: Meta Token Acquisition - User
**Objective:** Obtain permanent access token from Meta Developer Console.
**Output:** Valid permanent token in `.env.local`.
**Guidance:** User-executed task. Agent provides guidance only.

1. Navigate to Meta Business Suite → WhatsApp Manager → API Setup (or developers.facebook.com → App Dashboard)
2. Under "Permanent Token" section, create System User with admin permissions
3. Generate permanent access token with `whatsapp_business_messaging` and `whatsapp_business_management` permissions
4. Copy token to `.env.local` as `META_ACCESS_TOKEN`; copy Phone Number ID as `META_PHONE_NUMBER_ID`

---

## Phase 2: Core Interface

### Task 2.1 – Supabase Client & Auth Setup - Agent_Frontend_Setup
**Objective:** Configure Supabase client utilities and basic authentication.
**Output:** Supabase client files in `lib/supabase/` and auth utilities.
**Guidance:** **Depends on: Task 1.3 Output**. Follow Supabase SSR patterns for App Router.

- Create `lib/supabase/client.ts` for browser-side client initialization using `createBrowserClient`
- Create `lib/supabase/server.ts` for server component client using `createServerClient`
- Implement `lib/auth.ts` with sign in (email/password), sign out, and get session utilities
- Create `middleware.ts` for auth session refresh on each request

### Task 2.2 – TypeScript Type Definitions - Agent_Frontend_Setup
**Objective:** Create TypeScript interfaces matching database schema.
**Output:** Type definition files in `types/` directory.
**Guidance:** **Depends on: Task 1.1 Output by Agent_Database**. Types must align exactly with schema.

- Create `types/database.ts` with `Contact`, `Message`, `AutomationLog` interfaces matching Supabase schema
- Create `types/ui.ts` with component prop types (`ContactListItemProps`, `MessageBubbleProps`, etc.) and UI state types
- Define TypeScript enums: `MessageDirection` (inbound/outbound), `MessageType` (text/image/template), `MessageStatus` (sent/delivered/read/failed), `SessionStatus` (active/expired)

### Task 2.3 – Application Layout Shell - Agent_Frontend_Setup
**Objective:** Create three-pane application layout with navigation.
**Output:** Root layout structure and navigation component.
**Guidance:** **Depends on: Task 1.3 Output**. Three-pane: left rail (icons), middle panel (350px), right panel (flex-grow).

- Create root layout in `app/(views)/layout.tsx` with three-pane CSS grid/flex structure
- Create `components/layout/Navigation.tsx` with Lucide icons for Inbox, Activity (Control Tower), Settings
- Apply TailwindCSS: left rail ~60px, middle panel 350px fixed, right panel flex-grow, full height layout
- Configure route groups so `/inbox`, `/activity`, `/settings` share the layout

### Task 2.4 – Contact List Component - Agent_Frontend_Inbox
**Objective:** Create contact list panel with search, sorting, and status badges.
**Output:** Contact list components in `components/inbox/`.
**Guidance:** **Depends on: Task 2.2 Output by Agent_Frontend_Setup, Task 2.3 Output by Agent_Frontend_Setup**. Sort by last_interaction_at descending.

1. Create `components/inbox/ContactList.tsx` container with Shadcn ScrollArea
2. Create `components/inbox/ContactListItem.tsx` displaying avatar (initials), contact name/phone, last message snippet (truncated), timestamp
3. Implement search bar component filtering contacts by name or phone number
4. Add status badges: red dot (unread_count > 0), green dot (session active: last inbound < 24h), grey dot (session expired: last inbound > 24h)

### Task 2.5 – Conversation View Component - Agent_Frontend_Inbox
**Objective:** Create conversation view with message bubbles and header.
**Output:** Conversation components in `components/inbox/`.
**Guidance:** **Depends on: Task 2.2 Output by Agent_Frontend_Setup, Task 2.3 Output by Agent_Frontend_Setup**. Include automation source chips.

1. Create `components/inbox/ConversationView.tsx` container with header section and scrollable message area
2. Create conversation header displaying contact name, phone number, and session timer (countdown or "Window Closed" indicator)
3. Create `components/inbox/MessageBubble.tsx` with: inbound (left-aligned, light background), outbound (right-aligned, green-50 background), status checkmarks (grey=sent, blue=read), automation source chip (🤖 workflow_name) if source !== manual
4. Implement auto-scroll to bottom on new messages and initial load

### Task 2.6 – Real-time Subscription Hooks - Agent_Frontend_Inbox
**Objective:** Create React hooks for Supabase real-time subscriptions.
**Output:** Custom hooks in `hooks/` directory.
**Guidance:** **Depends on: Task 2.1 Output by Agent_Frontend_Setup**. Subscribe to INSERT and UPDATE events.

- Create `hooks/useMessages.ts` subscribing to `messages` table filtered by active contact_phone, handling INSERT (new message) and UPDATE (status change) events
- Create `hooks/useContacts.ts` subscribing to `contacts` table for list updates (new contacts, unread count changes, last_interaction updates)
- Implement connection state management with reconnection on disconnect
- Return loading states and real-time data arrays for component consumption

---

## Phase 3: Outbound Messaging

### Task 3.1 – Send Message API Route - Agent_Integration
**Objective:** Create API route for sending text messages via Meta Graph API.
**Output:** `/api/messages/send` endpoint with Meta integration and DB recording.
**Guidance:** **Depends on: Task 1.4 Output, Task 2.1 Output by Agent_Frontend_Setup**. Reference META_API_REFERENCE.md for payload format.

1. Create `app/api/messages/send/route.ts` accepting POST with `{ recipient: string, body: string }`
2. Validate session window: query contact's last inbound message timestamp, reject if > 24h with appropriate error
3. Send POST to Meta Graph API `/{PHONE_NUMBER_ID}/messages` with text payload, using META_ACCESS_TOKEN
4. On success: insert outbound message into Supabase (direction: outbound, status: sent, source: manual_ui), return message record

### Task 3.2 – Message Input Component - Agent_Frontend_Inbox
**Objective:** Create message input area with session-aware state.
**Output:** MessageInput component with active/expired states.
**Guidance:** **Depends on: Task 2.5 Output by Agent_Frontend_Inbox**. Clear visual distinction between states.

1. Create `components/inbox/MessageInput.tsx` with Shadcn Textarea and Send button for active sessions
2. Implement expired session state: disabled textarea with overlay "Window Closed. Send a Template to reopen." and "Select Template" button placeholder
3. Add attachment icon (non-functional placeholder, implemented in Phase 4)

### Task 3.3 – Message Sending UI Logic - Agent_Frontend_Inbox
**Objective:** Connect input component to send API with optimistic updates.
**Output:** Complete send flow integrated into conversation view.
**Guidance:** **Depends on: Task 3.1 Output by Agent_Integration, Task 3.2 Output**.

- Implement send handler in conversation view calling `/api/messages/send` endpoint
- Add optimistic UI update: append message to list immediately with "sending" status indicator
- Handle API errors: display toast notification, remove or mark failed the optimistic message
- Disable send button and show loading indicator during API call

### Task 3.4 – n8n Admin Notification Specification - Agent_Integration
**Objective:** Create specification for admin notification workflow.
**Output:** `docs/N8N_NOTIFICATION_SPEC.md` with trigger logic and message format.
**Guidance:** **Depends on: Task 1.5 Output**. User builds workflow; this extends inbound pipeline.

- Specify trigger: add branch in inbound workflow when direction=inbound to fire notification
- Document notification message format: "🔔 New msg from {profile_name}: {body.substring(0,50)}..."
- Specify admin number source: recommend Supabase `settings` table or n8n environment variable `ADMIN_PHONE`
- Include guidance on rate limiting (e.g., max 1 notification per contact per 5 minutes) to prevent spam

---

## Phase 4: Session & Templates

### Task 4.1 – Session Window Utility & Display - Agent_Frontend_Features
**Objective:** Create session window calculation logic and timer display.
**Output:** Session utilities in `lib/` and SessionTimer component.
**Guidance:** **Depends on: Task 2.5 Output by Agent_Frontend_Inbox**. 24h window is critical UX element.

- Create `lib/session.ts` with `calculateSessionStatus(lastInboundAt: Date)` returning `{ isActive: boolean, timeRemaining: number | null, status: 'active' | 'expired' }`
- Create `components/inbox/SessionTimer.tsx` displaying countdown ("23h 15m remaining") when active, or "Window Closed" badge when expired
- Export `isSessionActive(lastInboundAt: Date): boolean` utility for use in API validation and UI conditions
- Integrate SessionTimer into ConversationHeader, auto-refresh every 60 seconds

### Task 4.2 – Template Message API Route - Agent_Integration
**Objective:** Create API routes for fetching and sending template messages.
**Output:** `/api/templates` and `/api/messages/send-template` endpoints.
**Guidance:** **Depends on: Task 3.1 Output**. Templates required when session expired.

1. Create `app/api/templates/route.ts` GET handler calling Meta API to list approved message templates
2. Create `app/api/messages/send-template/route.ts` POST accepting `{ recipient, templateName, languageCode, parameters? }`
3. Build template payload per Meta format: `{ messaging_product, to, type: "template", template: { name, language, components } }`
4. On success: insert outbound message (type: template, body: template name) into Supabase

### Task 4.3 – Template Selector Modal - Agent_Frontend_Features
**Objective:** Create UI for selecting and sending template messages.
**Output:** TemplateSelector modal component.
**Guidance:** **Depends on: Task 4.2 Output by Agent_Integration**. Accessible from expired session state.

1. Create `components/inbox/TemplateSelector.tsx` using Shadcn Dialog, triggered by "Select Template" button
2. Fetch templates from `/api/templates` on open, display as selectable list with template name and category
3. On selection, call `/api/messages/send-template` with selected template, show success toast, close modal

### Task 4.4 – Media Display Component - Agent_Frontend_Features
**Objective:** Create components to display media messages in conversation.
**Output:** MediaMessage component for image rendering.
**Guidance:** **Depends on: Task 2.5 Output by Agent_Frontend_Inbox**. Images stored in Supabase Storage.

- Create `components/inbox/MediaMessage.tsx` rendering images from `media_url` field with proper sizing (max-width: 300px)
- Implement loading skeleton placeholder and error fallback for failed image loads
- Add click handler opening image in Shadcn Dialog lightbox for full-size viewing

### Task 4.5 – Image Upload & Send - Agent_Frontend_Features
**Objective:** Enable image upload and sending from the UI.
**Output:** Image upload flow integrated into message input.
**Guidance:** **Depends on: Task 3.2 Output by Agent_Frontend_Inbox**. Upload to Supabase first, then send via Meta.

1. Add file input (hidden) triggered by attachment icon in MessageInput, accepting image/* files
2. Create `app/api/media/upload/route.ts`: receive file, upload to `whatsapp-media` bucket, return public URL
3. Extend `/api/messages/send` or create `/api/messages/send-image`: upload image to Meta media endpoint first, then send image message referencing media_id
4. Insert outbound message (type: image, media_url: Supabase URL) into database

---

## Phase 5: Control Tower & Settings

### Task 5.1 – Control Tower Dashboard Cards - Agent_Frontend_Dashboard
**Objective:** Create top metrics cards for automation monitoring.
**Output:** PulseCards component displaying 24h statistics.
**Guidance:** **Depends on: Task 1.1 Output by Agent_Database**. Query automation_logs table.

- Create `components/activity/PulseCards.tsx` with three Shadcn Card components in horizontal layout
- Implement "Total Messages (24h)" card: count rows from automation_logs where executed_at > now - 24h
- Implement "Error Rate" card: calculate (failed count / total count * 100)% with red highlight if > 5%
- Implement "Estimated Cost (Month)" card: sum cost_estimate for current month, format as "₪ XX.XX"

### Task 5.2 – Automation Activity Feed - Agent_Frontend_Dashboard
**Objective:** Create real-time data table showing automation log entries.
**Output:** ActivityFeed component with live updates and filtering.
**Guidance:** **Depends on: Task 2.1 Output by Agent_Frontend_Setup**. Subscribe to automation_logs for real-time.

1. Create `components/activity/ActivityFeed.tsx` with Shadcn Table inside ScrollArea
2. Define columns: Time (executed_at as "HH:MM AM"), Workflow (workflow_name), Target (phone masked: +972...XXX), Status (green/red Badge), Details (Tooltip on hover showing error_detail or metadata)
3. Create `hooks/useAutomationLogs.ts` subscribing to automation_logs INSERT events for live feed
4. Add dropdown filter: "All", "Success Only", "Failed Only" filtering by status column

### Task 5.3 – Settings: Notification Bridge - Agent_Frontend_Dashboard
**Objective:** Create settings section for admin notification configuration.
**Output:** NotificationBridge component with save and test functionality.
**Guidance:** **Depends on: Task 1.3 Output by Agent_Frontend_Setup**. Settings stored in Supabase.

1. Create `components/settings/NotificationBridge.tsx` with labeled input for "Admin Alert Number" in E.164 format
2. Create `app/api/settings/route.ts` with GET (read current) and POST (update) handlers using Supabase settings table
3. Add "Send Test Ping" button calling `/api/settings/test-notification` which triggers n8n webhook to send test message

### Task 5.4 – Settings: Template Cache Management - Agent_Frontend_Dashboard
**Objective:** Create template management section in settings view.
**Output:** TemplateManager component with refresh capability.
**Guidance:** **Depends on: Task 4.2 Output by Agent_Integration**. Uses templates API.

- Create `components/settings/TemplateManager.tsx` displaying list of cached templates (name, category, status)
- Add "Refresh from Meta" button calling `/api/templates` with cache invalidation to fetch latest approved templates
- Display "Last synced: [timestamp]" and total template count below the list

---

## Phase 6: Deployment & Integration

### Task 6.1 – Environment Configuration & Documentation - Agent_Integration
**Objective:** Create comprehensive environment setup documentation.
**Output:** README.md and environment configuration guide.
**Guidance:** Final documentation consolidating all setup requirements.

- Create/update `README.md` with project overview, feature list, tech stack, and architecture diagram (text-based)
- Document all environment variables in `.env.local.example` with descriptions and example values
- Write step-by-step local development setup guide covering: Supabase project, Meta app, n8n connection, running locally
- Add troubleshooting section for common issues: webhook not receiving, real-time not updating, token errors

### Task 6.2 – Deployment Configuration - Agent_Integration
**Objective:** Create deployment configuration for self-hosted setup.
**Output:** Dockerfile, docker-compose.yml, PM2 config, and deployment guide.
**Guidance:** **Depends on: Task 1.3 Output by Agent_Frontend_Setup**. Provide Docker and non-Docker options.

1. Create `Dockerfile` with multi-stage build: deps stage, build stage, runner stage with standalone output
2. Create `docker-compose.yml` for single-command deployment with environment variable mapping
3. Create `ecosystem.config.js` for PM2 deployment alternative (for users who prefer non-Docker)
4. Write `docs/DEPLOYMENT.md` explaining both options, server requirements, SSL/reverse proxy considerations

### Task 6.3 – n8n Webhook Configuration Guide - Agent_Integration
**Objective:** Create guide for connecting n8n to Meta and the application.
**Output:** `docs/N8N_SETUP_GUIDE.md` with complete configuration steps.
**Guidance:** **Depends on: Task 1.5 Output, Task 3.4 Output**. User follows this to build and connect workflows.

- Document Meta webhook subscription: navigating to App Dashboard → Webhooks → Subscribe to messages field with n8n URL
- Explain webhook verification: setting verify_token in n8n, handling hub.challenge response
- Provide Supabase connection setup in n8n: creating credentials, testing connection, configuring Supabase nodes
- Write end-to-end test procedure: send WhatsApp message → check n8n execution → verify Supabase row → confirm UI display

### Task 6.4 – Integration Testing Checklist - Agent_Integration
**Objective:** Create testing checklist for complete system verification.
**Output:** `docs/TESTING_CHECKLIST.md` with verification steps.
**Guidance:** User performs manual testing using this checklist.

- Inbound flow tests: new message appears in UI in real-time, contact created/updated, media downloaded and displayed
- Outbound flow tests: text message sends successfully, status updates reflected, optimistic UI works correctly
- Feature tests: session timer accurate, templates send when expired, Control Tower metrics correct, settings save properly
- Edge case tests: 24h window boundary, duplicate meta_id handling, API error recovery, large image upload

