# WhatsApp Interface Enhancement – APM Implementation Plan v2
**Memory Strategy:** Dynamic-MD
**Last Modification:** Plan creation by the Setup Agent.
**Project Overview:** Enhancement to existing WhatsApp Interface: (1) Enable template messages in active sessions, (2) Display full template content in chat with visual indicator, (3) Log UI-initiated actions to automation_logs for Control Tower visibility.

---

## Phase 1: Template Enhancements

### Task 1.1 – Template Button in Active Sessions - Agent_Frontend
**Objective:** Add "Send Template" option to message input when session is active.
**Output:** Updated MessageInput component with template button alongside attachment.
**Guidance:** Template button should be secondary to regular messaging, not prominent.

1. Add template button (FileText icon) next to attachment icon in active session state
2. Wire button to trigger `onSendTemplate` callback (same as expired state)
3. Style as subtle/secondary action (outline button or icon-only)

### Task 1.2 – Fetch Template Content for Display - Agent_Integration
**Objective:** Return actual template body text when sending templates.
**Output:** Updated `/api/messages/send-template` route that stores full template text.
**Guidance:** Fetch template components from cache/API and construct display text.

1. Before sending, lookup template in cache or fetch from `/api/templates` to get components
2. Extract BODY component text, substitute any default parameter placeholders
3. Store constructed template text in message `body` field instead of "Template: {name}"
4. Return full body text in API response for UI display

### Task 1.3 – Template Message Visual Indicator - Agent_Frontend
**Objective:** Display template messages with visual distinction in chat.
**Output:** Updated MessageBubble with template indicator.
**Guidance:** **Depends on: Task 1.2 Output by Agent_Integration**. Check `type === "template"`.

- Add template badge/chip (e.g., 📋 Template) above message body when `message.type === "template"`
- Style similar to automation source badge but distinct (different icon/color)
- Keep message bubble styling consistent (green for outbound)

---

## Phase 2: Activity Logging

### Task 2.1 – Add Logging to Send Message API - Agent_Integration
**Objective:** Log text message send actions to automation_logs.
**Output:** Updated `/api/messages/send` route with logging.
**Guidance:** Log after Meta API response, whether success or failure.

1. After Meta API call (success or failure), insert row into `automation_logs`
2. Log fields: workflow_name="ui_send_message", contact_phone, status (success/failed), error_detail if failed, cost_estimate=null
3. Don't let logging failure affect message send response

### Task 2.2 – Add Logging to Send Template API - Agent_Integration
**Objective:** Log template message send actions to automation_logs.
**Output:** Updated `/api/messages/send-template` route with logging.
**Guidance:** Same pattern as Task 2.1.

1. After Meta API call, insert row into `automation_logs`
2. Log fields: workflow_name="ui_send_template", contact_phone, status, error_detail, cost_estimate (use template category costs if known)
3. Include template name in error_detail or a metadata field for context

### Task 2.3 – Add Logging to Send Image API - Agent_Integration
**Objective:** Log image message send actions to automation_logs.
**Output:** Updated image send route with logging.
**Guidance:** Same pattern as Task 2.1.

1. After Meta API call, insert row into `automation_logs`
2. Log fields: workflow_name="ui_send_image", contact_phone, status, error_detail
3. Log after both upload and send steps complete

