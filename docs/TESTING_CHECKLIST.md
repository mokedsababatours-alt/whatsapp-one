# Integration Testing Checklist

Comprehensive testing checklist for verifying the Headless WhatsApp Interface system functionality.

**Test Environment:**
- Application URL: `________________`
- Test Phone Number: `________________`
- Test Date: `________________`
- Tester: `________________`

---

## Test Summary

| Section | Tests | Passed | Failed | Blocked |
|---------|-------|--------|--------|---------|
| Inbound Flow | 6 | ☐ | ☐ | ☐ |
| Outbound Flow | 5 | ☐ | ☐ | ☐ |
| Template Messages | 5 | ☐ | ☐ | ☐ |
| Control Tower | 4 | ☐ | ☐ | ☐ |
| Settings | 4 | ☐ | ☐ | ☐ |
| Edge Cases | 5 | ☐ | ☐ | ☐ |
| Authentication | 3 | ☐ | ☐ | ☐ |
| **TOTAL** | **32** | ☐ | ☐ | ☐ |

---

## 1. Inbound Flow Tests

Test receiving messages from WhatsApp users.

### 1.1 Text Message Reception
- [ ] **Test:** Send text message from WhatsApp to business number
- **Expected:** Message appears in UI within 2-3 seconds (real-time)
- **Verify:** 
  - Message bubble shows on left (inbound)
  - Correct message content displayed
  - Timestamp is accurate
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 1.2 New Contact Creation
- [ ] **Test:** Send message from a phone number not in system
- **Expected:** Contact auto-created with WhatsApp profile name
- **Verify:**
  - Contact appears in contact list
  - `profile_name` populated from WhatsApp
  - `created_at` timestamp is correct
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 1.3 Existing Contact Update
- [ ] **Test:** Send message from existing contact
- **Expected:** Contact record updated
- **Verify:**
  - `last_interaction_at` updated to now
  - `unread_count` incremented by 1
  - Contact moves to top of list (sorted by recent)
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 1.4 Session Status Active
- [ ] **Test:** Send message and check session indicator
- **Expected:** Session shows "active" (green dot)
- **Verify:**
  - Green dot visible on contact
  - `session_status` = `active` in database
  - Input area is enabled (not showing "Window Closed")
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 1.5 Image Message Reception
- [ ] **Test:** Send image from WhatsApp to business number
- **Expected:** Image downloaded to Supabase Storage and displayed
- **Verify:**
  - n8n workflow downloads image from Meta
  - Image uploaded to `whatsapp-media` bucket
  - `media_url` populated in messages table
  - Image thumbnail visible in conversation
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 1.6 Image Lightbox Display
- [ ] **Test:** Click on received image in conversation
- **Expected:** Image opens in lightbox/modal for full view
- **Verify:**
  - Full-size image loads
  - Can close lightbox
  - Original image quality preserved
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

---

## 2. Outbound Flow Tests

Test sending messages from the UI.

### 2.1 Send Text Message
- [ ] **Test:** Type message in input and click Send
- **Expected:** API returns success, message sent
- **Verify:**
  - API response status 200
  - Meta API call successful
  - Message inserted in database with `direction: 'outbound'`
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 2.2 Optimistic UI Update
- [ ] **Test:** Send message and observe UI
- **Expected:** Message appears immediately (before API confirms)
- **Verify:**
  - Message bubble shows on right (outbound)
  - Shows "pending" status initially
  - No delay waiting for API
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 2.3 Status Updates
- [ ] **Test:** Send message and wait for delivery confirmations
- **Expected:** Status progresses: pending → sent → delivered → read
- **Verify:**
  - Single checkmark (sent)
  - Double checkmark grey (delivered)
  - Double checkmark blue (read)
  - Database `status` field updated
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 2.4 Session Validation
- [ ] **Test:** Attempt to send text message with expired session (>24h)
- **Expected:** Request blocked with appropriate error
- **Verify:**
  - Error message: "Session window expired. Use template message."
  - HTTP 400 status returned
  - No message sent to Meta API
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 2.5 Image Sending
- [ ] **Test:** Attach and send image from UI
- **Expected:** Image uploaded to storage, sent via Meta
- **Verify:**
  - Image uploaded to Supabase Storage
  - Meta API called with media message
  - Image appears in conversation
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

---

## 3. Template Message Tests

Test template messaging for expired sessions.

### 3.1 Session Expired State
- [ ] **Test:** Wait 24+ hours or manually expire session, view conversation
- **Expected:** UI shows "Window Closed" state
- **Verify:**
  - Input area disabled/greyed out
  - Message: "Window Closed. Send a Template to reopen."
  - "Select Template" button visible
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 3.2 Template Modal Opens
- [ ] **Test:** Click "Select Template" button
- **Expected:** Modal opens with template list
- **Verify:**
  - Modal displays correctly
  - Loading state shown while fetching
  - Templates list populated
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 3.3 Templates Display with Categories
- [ ] **Test:** View template list in modal
- **Expected:** Templates show with category badges
- **Verify:**
  - Template names displayed
  - Category badges (Marketing, Utility, Authentication)
  - Language codes shown
  - Only APPROVED templates visible
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 3.4 Send Template Message
- [ ] **Test:** Select template and send
- **Expected:** Template sent, message appears in conversation
- **Verify:**
  - API returns success
  - Message shows in conversation with "Template: {name}"
  - `type: 'template'` in database
  - Modal closes after send
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 3.5 Template Reopens Session
- [ ] **Test:** After sending template, customer replies
- **Expected:** Session reopens (24h window starts fresh)
- **Verify:**
  - Session status changes to "active"
  - Green dot appears on contact
  - Text input re-enabled
  - `last_interaction_at` updated
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

---

## 4. Control Tower Tests

Test the automation monitoring dashboard.

### 4.1 Pulse Cards Statistics
- [ ] **Test:** Navigate to Control Tower (Activity) view
- **Expected:** Statistics cards show accurate data
- **Verify:**
  - Total Messages (24h) count correct
  - Error Rate percentage accurate
  - Estimated Cost calculated
  - Data matches `automation_logs` table
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 4.2 Activity Feed Population
- [ ] **Test:** View activity feed table
- **Expected:** Logs from `automation_logs` displayed
- **Verify:**
  - Workflow names shown
  - Target phone numbers (masked)
  - Status badges (Success/Failed)
  - Timestamps accurate
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 4.3 Real-time Log Updates
- [ ] **Test:** Trigger n8n workflow while watching Activity view
- **Expected:** New log appears in real-time
- **Verify:**
  - Log appears without page refresh
  - Correct position in list (newest first)
  - Statistics update automatically
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 4.4 Filter Functionality
- [ ] **Test:** Use status filter dropdown
- **Expected:** Logs filtered by selected status
- **Verify:**
  - "All" shows all logs
  - "Success" shows only success logs
  - "Failed" shows only failed logs
  - Count updates in UI
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

---

## 5. Settings Tests

Test the settings and configuration view.

### 5.1 Admin Phone Validation
- [ ] **Test:** Enter admin phone number in settings
- **Expected:** E.164 format validation applied
- **Verify:**
  - Valid format accepted (e.g., +972501234567)
  - Invalid format rejected with error
  - Value saved to database/config
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 5.2 Notification Toggle
- [ ] **Test:** Toggle notification switch on/off
- **Expected:** State persists across page reload
- **Verify:**
  - Toggle updates immediately
  - State saved to database
  - Setting affects n8n notification behavior
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 5.3 Test Ping Functionality
- [ ] **Test:** Click "Send Test Ping" button
- **Expected:** Test message sent to admin phone
- **Verify:**
  - Loading state shown
  - Success/error feedback displayed
  - Admin receives WhatsApp message
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 5.4 Template Cache Refresh
- [ ] **Test:** Click "Refresh Templates" button
- **Expected:** Templates reloaded from Meta API
- **Verify:**
  - Loading state shown
  - Cache timestamp updated
  - New/removed templates reflected
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

---

## 6. Edge Case Tests

Test boundary conditions and error scenarios.

### 6.1 24-Hour Window Boundary
- [ ] **Test:** Send message at exactly 24 hours from last interaction
- **Expected:** Session correctly evaluated as expired
- **Verify:**
  - Comparison includes seconds precision
  - No race condition at boundary
  - Consistent behavior on retry
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 6.2 Duplicate meta_id Handling
- [ ] **Test:** Simulate webhook retry (same meta_id sent twice)
- **Expected:** Duplicate message rejected (deduplication)
- **Verify:**
  - First message inserted
  - Second message skipped (no error)
  - Only one row in database
  - No duplicate in UI
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 6.3 Large Image Upload
- [ ] **Test:** Send image near 16MB limit
- **Expected:** Image handled correctly or graceful error
- **Verify:**
  - Image within limit: uploads successfully
  - Image over limit: clear error message
  - No server crash or timeout
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 6.4 API Error Recovery
- [ ] **Test:** Trigger API error (e.g., invalid token temporarily)
- **Expected:** Error displayed, can retry
- **Verify:**
  - Error toast/notification shown
  - User-friendly error message
  - Retry mechanism works
  - No data corruption
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 6.5 Network Disconnection Recovery
- [ ] **Test:** Disconnect network, then reconnect
- **Expected:** Realtime subscription recovers
- **Verify:**
  - Disconnection indicated in UI (optional)
  - Reconnection automatic
  - Missed messages appear on reconnect
  - No manual refresh needed
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

---

## 7. Authentication Tests

Test login and session management.

### 7.1 Valid Login
- [ ] **Test:** Login with valid email and password
- **Expected:** Successful login, redirect to inbox
- **Verify:**
  - Login form accepts credentials
  - Redirect to /inbox after success
  - User session established
  - Auth cookie set
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 7.2 Protected Route Redirect
- [ ] **Test:** Access /inbox without being logged in
- **Expected:** Redirect to /login page
- **Verify:**
  - Automatic redirect occurs
  - No protected content visible
  - Login page loads correctly
  - Return URL preserved (optional)
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

### 7.3 Session Persistence
- [ ] **Test:** Login, refresh page, verify still logged in
- **Expected:** Session persists across page refresh
- **Verify:**
  - User remains logged in
  - No re-login required
  - Session data intact
  - Works across multiple tabs
- **Result:** ☐ Pass ☐ Fail ☐ Blocked
- **Notes:** `________________________________`

---

## Test Completion Sign-off

### Summary

| Metric | Value |
|--------|-------|
| Total Tests | 32 |
| Tests Passed | ___ |
| Tests Failed | ___ |
| Tests Blocked | ___ |
| Pass Rate | ___% |

### Failed Tests (if any)

| Test ID | Issue Description | Severity | Ticket |
|---------|-------------------|----------|--------|
| | | | |
| | | | |
| | | | |

### Blocked Tests (if any)

| Test ID | Blocking Reason | Resolution Needed |
|---------|-----------------|-------------------|
| | | |
| | | |

### Sign-off

- **Tester Name:** `________________________________`
- **Test Date:** `________________________________`
- **Environment:** `________________________________`
- **Build/Version:** `________________________________`

**Test Status:** ☐ All Passed ☐ Passed with Issues ☐ Failed

**Approval Signature:** `________________________________`

---

## Quick Reference

### Test Data Setup

```sql
-- Create test contact with expired session
INSERT INTO contacts (phone_number, profile_name, last_interaction_at, session_status)
VALUES ('+15551234567', 'Test User', NOW() - INTERVAL '25 hours', 'expired');

-- Create test contact with active session
INSERT INTO contacts (phone_number, profile_name, last_interaction_at, session_status)
VALUES ('+15559876543', 'Active User', NOW() - INTERVAL '1 hour', 'active');
```

### Test Cleanup

```sql
-- Remove test data (run after testing)
DELETE FROM messages WHERE contact_phone IN ('+15551234567', '+15559876543');
DELETE FROM contacts WHERE phone_number IN ('+15551234567', '+15559876543');
```

### Useful Queries

```sql
-- Check session status
SELECT phone_number, session_status, last_interaction_at,
       NOW() - last_interaction_at AS time_since_interaction
FROM contacts
WHERE phone_number = '+15551234567';

-- Check recent messages
SELECT id, contact_phone, direction, type, status, created_at
FROM messages
ORDER BY created_at DESC
LIMIT 10;

-- Check automation logs
SELECT workflow_name, status, error_detail, executed_at
FROM automation_logs
ORDER BY executed_at DESC
LIMIT 10;
```

---

*Document Version: 1.0*
*Last Updated: January 2026*
