# Squadcast-Slack Connector

A Cloudflare Worker middleware that receives webhook events from Squadcast and forwards them to a Slack workflow webhook trigger.

## Overview

This worker acts as a bridge between Squadcast's outgoing webhooks and Slack workflows. When Squadcast sends incident events (Operational, Degraded, Major Outage, Partial Outage), this worker forwards the entire event payload to your configured Slack workflow.

## Features

- Receives POST requests from Squadcast outgoing webhooks
- Forwards complete event payload to Slack workflow webhook
- Handles errors gracefully with logging
- Simple, stateless middleware design

## Prerequisites

- Node.js 18+ and npm
- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)
- Squadcast account with outgoing webhooks configured
- Slack workflow with webhook trigger configured

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Slack Workflow

1. In Slack, go to **Workflow Builder**
2. Create a new workflow that starts with a **Webhook** trigger
3. Define variables you want to extract from the Squadcast payload (see [Slack Workflow Variables](#slack-workflow-variables) below)
4. Publish the workflow to get your webhook URL

### 3. Configure Cloudflare Worker

Set the Slack webhook URL as a secret:

```bash
wrangler secret put SLACK_WEBHOOK_URL
```

When prompted, paste your Slack workflow webhook URL.

### 4. Configure Squadcast Outgoing Webhook

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

### 5. Deploy

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
SLACK_WEBHOOK_URL=https://hooks.slack.com/workflows/your-workflow-url
```

## Slack Workflow Variables

The worker receives the Squadcast webhook payload and **flattens all nested objects** into a single-level structure with underscored keys. This is because Slack workflow webhook variables don't support nested objects or dot notation.

### Flattening Example

**Original Squadcast payload:**
```json
{
  "event_type": "incident_triggered",
  "incident": {
    "id": "inc-123",
    "message": "Service Degraded",
    "description": "HTTP errors above threshold"
  },
  "service": {
    "name": "API Service",
    "id": "svc-456"
  }
}
```

**Flattened payload sent to Slack:**
```json
{
  "event_type": "incident_triggered",
  "incident_id": "inc-123",
  "incident_message": "Service Degraded",
  "incident_description": "HTTP errors above threshold",
  "service_name": "API Service",
  "service_id": "svc-456"
}
```

### Common Flattened Variables

Based on typical Squadcast webhook payloads, you can configure these variables in your Slack workflow:

- `event_type` or `eventName` - Type of event (e.g., `incident_triggered`, `incident_updated`, `incident_resolved`)
- `incident_id` - Incident ID
- `incident_message` - Incident message/title
- `incident_description` - Incident description
- `incident_priority` - Priority level (P1-P5)
- `incident_status` - Current status
- `incident_event_id` - Unique event identifier
- `service_name` - Service name
- `service_id` - Service ID
- `team_name` - Team name
- `team_id` - Team ID
- `timestamp` - Event timestamp

### Configuring Slack Workflow Variables

When setting up your Slack workflow webhook trigger:

1. Add variables using the **flattened** underscore-separated names (e.g., `incident_message`, not `incident.message`)
2. Set the appropriate variable type (usually "Text" for most fields)
3. The workflow can extract only the variables it needs

**Example Slack Workflow Variables to configure:**
- `event_type` (Text)
- `incident_message` (Text)
- `incident_description` (Text)
- `incident_priority` (Text)
- `service_name` (Text)
- `team_name` (Text)

**Note**: Variable names are case-sensitive and must match the flattened field names exactly. Arrays are JSON-stringified, so if you need array data, you'll receive it as a JSON string.

## Testing

After deployment, you can test by:

1. Triggering a test incident in Squadcast
2. Checking Cloudflare Worker logs: `wrangler tail`
3. Verifying the Slack workflow receives and processes the event

## Error Handling

The worker logs errors to Cloudflare Workers logs. To view logs:

```bash
wrangler tail
```

Errors are logged with context including:
- Invalid JSON payloads
- Missing configuration
- Slack webhook failures

## Project Structure

```
.
├── src/
│   └── index.ts          # Main worker handler
├── wrangler.toml         # Cloudflare Worker configuration
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```