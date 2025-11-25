# Squadcast-Slack Connector

A Cloudflare Worker that receives webhook events from Squadcast and posts beautifully formatted alerts to Slack using the Slack Bot API.

## Overview

This worker acts as a bridge between Squadcast's outgoing webhooks and Slack on behalf of the Walr platform. It handles two types of webhooks:

- **Incident Webhooks**: When Squadcast sends incident events (Operational, Degraded, Major Outage, Partial Outage), this worker formats them using Slack's Block Kit and posts them directly to your configured Slack channel.
- **Status Page Webhooks**: When Squadcast sends status page updates (Identified, Investigating, Resolved, etc.), this worker formats them with status-specific emojis and clear issue information.

## Features

- Receives POST requests from Squadcast outgoing webhooks (incidents and status page updates)
- Formats alerts with rich Block Kit messages (headers, fields, buttons)
- Automatically detects webhook type (incident vs status page)
- Status-specific emojis for status page updates (✅ Resolved, 🔍 Investigating, ⚠️ Issues)
- Posts directly to Slack channels using Bot API
- Handles errors gracefully with detailed logging
- Simple, stateless design

## Prerequisites

- Node.js 18+ and npm
- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)
- Squadcast account with outgoing webhooks configured
- Slack workspace with permissions to create apps

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Slack App and Bot

You can create the Slack app in two ways:

#### Option A: Using the App Manifest (Recommended)

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**
2. Choose **From an app manifest**
3. Select your workspace
4. Choose **JSON** format
5. Copy and paste the contents of `slack-manifest.json` from this repository
6. Click **Next** to review the configuration
7. Click **Create** to create the app
8. Go to **OAuth & Permissions** in the sidebar
9. Scroll to the top and click **Install to Workspace**
10. Review permissions and click **Allow**
11. Copy the **Bot User OAuth Token** (starts with `xoxb-`) - you'll need this in the next step

#### Option B: Manual Setup

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**
2. Choose **From scratch**
3. Enter an app name (e.g., "Walr Squadcast Alerts") and select your workspace
4. Click **Create App**

##### Configure Bot Token Scopes

1. In your app settings, go to **OAuth & Permissions** in the sidebar
2. Scroll down to **Scopes** > **Bot Token Scopes**
3. Add the following scopes:
   - `chat:write` - Send messages as the bot
   - `chat:write.public` - Send messages to channels the bot isn't in (optional, if you want to post to channels without inviting the bot)
4. Scroll to the top and click **Install to Workspace**
5. Review permissions and click **Allow**
6. Copy the **Bot User OAuth Token** (starts with `xoxb-`) - you'll need this in the next step

#### Get Channel ID

You'll need the Slack channel ID where alerts should be posted. You can use either:
- Channel ID (e.g., `C1234567890`) - Right-click the channel in Slack > **View channel details** > Copy the Channel ID
- Channel name (e.g., `#incidents`) - The bot must be invited to the channel if using this format

### 3. Configure Cloudflare Worker

Set the Slack bot token and channel ID as secrets:

```bash
wrangler secret put SLACK_BOT_TOKEN
```

When prompted, paste your Bot User OAuth Token (the `xoxb-...` token).

```bash
wrangler secret put SLACK_CHANNEL_ID
```

When prompted, enter your channel ID (e.g., `C1234567890`) or channel name (e.g., `#incidents`).

### 4. Invite Bot to Channel (if using channel name)

If you're using a channel name (e.g., `#incidents`) instead of a channel ID, you need to invite the bot to the channel:

1. Go to your Slack channel
2. Type `/invite @YourBotName` (replace with your bot's name)
3. Or add the bot through channel settings

### 5. Configure Squadcast Outgoing Webhook

You can configure webhooks for both incidents and status page updates:

**For Incident Webhooks:**
1. In Squadcast, navigate to **Settings** > **Webhooks**
2. Click **Add Webhook** and select **Automatic Webhook**
3. Choose **v2** as the version
4. Under **Triggers**, select:
   - Incident Triggered
   - Incident Updated
   - Incident Resolved
   - Or other events as needed
5. Set the **URL** to your Cloudflare Worker endpoint (you'll get this after deployment)
6. Configure any filters as needed (Teams, Services, Priorities, Tags)
7. Save the webhook

**For Status Page Webhooks:**
1. In Squadcast, navigate to your **Status Page** settings
2. Go to **Subscriptions** or **Webhooks** section
3. Add a webhook URL pointing to your Cloudflare Worker endpoint
4. Configure which status page events should trigger the webhook
5. Save the configuration

### 6. Deploy

```bash
npm run deploy
```

After deployment, Wrangler will output your Worker URL. Use this URL in your Squadcast webhook configuration.

## Development

Run locally for testing:

```bash
npm run dev
```

This starts a local development server. You'll need to create a `.dev.vars` file for local development:

```bash
# .dev.vars
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_CHANNEL_ID=C1234567890
```

## Message Format

The worker formats Squadcast webhook payloads into rich Slack messages using Block Kit. The format differs based on webhook type:

### Status Page Updates

Status page webhooks are formatted with:

- **Header**: Status emoji + status (e.g., "✅ Resolved", "🔍 Identified")
- **Issue & Status Page**: Issue title and status page name
- **Affected Components**: List of affected components (if available)
- **Update**: Formatted message text with markdown support
- **Action Button**: Link to https://status.walr.com

Example:
```
┌─────────────────────────────────┐
│ ✅ Resolved                    │  ← Header (emoji + status)
├─────────────────────────────────┤
│ Issue:        Status Page:      │
│ Something     BPTest            │
│ is wrong                         │
├─────────────────────────────────┤
│ Affected Components:            │
│ Main                            │
├─────────────────────────────────┤
│ Update:                         │
│ We've determined that...        │
├─────────────────────────────────┤
│ [View Status Page]              │  ← Button
└─────────────────────────────────┘
```

### Incident Webhooks

Incident webhooks are formatted with:

- **Header**: Alert emoji + incident message
- **Fields Section**: Event type, status, severity, and alert source
- **Service/Team Info**: Service name and team name (if available)
- **Description**: Full incident description (if available)
- **Action Button**: Link to https://status.walr.com

Example:
```
┌─────────────────────────────────┐
│ 🚨 Service Degraded            │  ← Header
├─────────────────────────────────┤
│ Event Type:  Status:            │
│ incident_    Resolved           │
│ triggered                       │
│                                 │
│ Severity:   Source:             │
│ P2          Prometheus          │
├─────────────────────────────────┤
│ Service:    Team:               │
│ API Service Engineering         │
├─────────────────────────────────┤
│ Description:                    │
│ HTTP errors above threshold     │
├─────────────────────────────────┤
│ [View Status Page]              │  ← Button
└─────────────────────────────────┘
```

### Supported Squadcast Payload Fields

**Status Page Webhooks:**
- `issue.title` - Issue title
- `message.text` - Status update message
- `message.status` or `issue.currentState` - Current status
- `issue.affected_components` - Array of affected components
- `status_page_name` - Status page name

**Incident Webhooks:**
- `event_type` or `eventName` - Type of event
- `incident.message` - Incident title/message
- `incident.description` - Incident description
- `incident.status` - Current status
- `incident.severity` or `incident.priority` - Severity/priority level
- `incident.alert_source` - Source of the alert
- `service.name` - Service name
- `team.name` - Team name

All fields are optional - the message will display whatever information is available in the payload.

## Testing

After deployment, you can test by:

1. Triggering a test incident in Squadcast
2. Checking Cloudflare Worker logs: `wrangler tail`
3. Verifying the message appears in your configured Slack channel

## Error Handling

The worker logs errors to Cloudflare Workers logs. To view logs:

```bash
wrangler tail
```

Errors are logged with context including:
- Invalid JSON payloads
- Missing configuration (bot token or channel ID)
- Slack API errors (with specific error messages from Slack)

## Troubleshooting

### Channel Not Found Error

If you see a `channel_not_found` error, check the following:

1. **Verify the channel ID format**:
   - Channel IDs start with `C` (e.g., `C1234567890`)
   - To get the channel ID: Right-click the channel in Slack → **View channel details** → Copy the Channel ID
   - If using a channel name, use just the name without `#` (e.g., `incidents` not `#incidents`)

2. **Check if the bot is in the channel**:
   - If using a channel name, the bot must be invited to the channel
   - Type `/invite @Walr Platform Alerts` in the channel
   - Or add the bot through channel settings → **Integrations** → **Add apps**

3. **Verify the secret is set correctly**:
   ```bash
   wrangler secret list
   ```
   Make sure `SLACK_CHANNEL_ID` is listed and has the correct value.

4. **Test with a channel ID instead of name**:
   - Channel IDs are more reliable than channel names
   - Use the channel ID format (`C1234567890`) if you're having issues

5. **Check bot permissions**:
   - Ensure the bot has `chat:write` and `chat:write.public` scopes
   - Reinstall the app to workspace if you added scopes after initial installation

### Other Common Issues

- **Invalid token**: Verify `SLACK_BOT_TOKEN` is set correctly and starts with `xoxb-`
- **Missing secrets**: Use `wrangler secret list` to verify all required secrets are set
- **View logs**: Run `wrangler tail` or `npm run tail` to see real-time error messages

## Project Structure

```
.
├── src/
│   └── index.ts          # Main worker handler
├── wrangler.toml         # Cloudflare Worker configuration
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── slack-manifest.json   # Slack app manifest
└── README.md             # This file
```