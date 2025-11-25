export interface Env {
  SLACK_BOT_TOKEN: string;
  SLACK_CHANNEL_ID: string;
}

// Constants
const SLACK_API_URL = 'https://slack.com/api/chat.postMessage';
const STATUS_PAGE_URL = 'https://status.walr.com';

/**
 * Squadcast webhook payload structure
 */
interface SquadcastWebhook {
  event_type?: string;
  eventName?: string;
  incident?: {
    id?: string;
    message?: string;
    description?: string;
    status?: string;
    severity?: string;
    priority?: string;
    alert_source?: string;
    created_at?: string;
    incident_url?: string;
    [key: string]: any;
  };
  // Status page webhook structure
  message?: {
    timestamp?: string;
    text?: string;
    status?: string;
    id?: number;
  };
  issue?: {
    title?: string;
    id?: number;
    currentState?: string;
    affected_components?: Array<{
      type?: string;
      name?: string;
      id?: number;
    }>;
  };
  status_page_name?: string;
  status_page_url?: string;
  service?: {
    name?: string;
    id?: string;
    [key: string]: any;
  };
  team?: {
    name?: string;
    id?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Slack API response structure
 */
interface SlackApiResponse {
  ok: boolean;
  error?: string;
  channel?: string;
  ts?: string;
  message?: {
    text: string;
    [key: string]: any;
  };
}

/**
 * Slack Block Kit block structure
 */
interface SlackBlock {
  type: string;
  [key: string]: any;
}

/**
 * Gets the appropriate emoji for a given status
 */
function getStatusEmoji(status: string): string {
  const lowerStatus = status.toLowerCase();
  if (lowerStatus.includes('resolved') || lowerStatus.includes('operational')) {
    return '✅';
  }
  if (lowerStatus.includes('identified') || lowerStatus.includes('investigating')) {
    return '🔍';
  }
  if (lowerStatus.includes('monitoring')) {
    return '👀';
  }
  return '⚠️';
}

/**
 * Normalizes a Slack channel ID by removing # prefix and trimming whitespace
 */
function normalizeChannelId(channelId: string): string {
  return channelId.trim().replace(/^#/, '');
}

/**
 * Formats a Squadcast webhook payload into a Slack Block Kit message
 * Handles both incident webhooks and status page webhooks
 */
function formatSlackMessage(payload: SquadcastWebhook): any {
  // Check if this is a status page webhook (has status_page_name or both issue and message fields)
  const isStatusPage = !!payload.status_page_name || (!!payload.issue && !!payload.message);
  
  if (isStatusPage) {
    return formatStatusPageMessage(payload);
  } else {
    return formatIncidentMessage(payload);
  }
}

/**
 * Formats a status page webhook into a Slack Block Kit message
 */
function formatStatusPageMessage(payload: SquadcastWebhook): any {
  const issue = payload.issue || {};
  const statusMessage = payload.message || {};
  const statusPageName = payload.status_page_name || 'Status Page';
  
  const title = issue.title || 'Status Update';
  const messageText = statusMessage.text || '';
  const status = statusMessage.status || issue.currentState || 'Unknown';
  const affectedComponents = issue.affected_components || [];
  const statusEmoji = getStatusEmoji(status);
  
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${statusEmoji} ${status}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Issue:*\n${title}`,
        },
        {
          type: 'mrkdwn',
          text: `*Status Page:*\n${statusPageName}`,
        },
      ],
    },
  ];

  // Add affected components if available
  if (affectedComponents.length > 0) {
    const componentNames = affectedComponents.map(c => c.name || 'Unknown').join(', ');
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Affected Components:*\n${componentNames}`,
        },
      ],
    });
  }

  // Add message text if available
  if (messageText) {
    // Convert markdown bold (**text**) to Slack markdown (*text*)
    const formattedText = messageText.replace(/\*\*(.*?)\*\*/g, '*$1*');
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Update:*\n${formattedText}`,
      },
    });
  }

  // Add button to view status page
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View Status Page',
          emoji: true,
        },
        url: STATUS_PAGE_URL,
        style: 'primary',
      },
    ],
  });

  return {
    channel: undefined, // Will be set from env
    text: `${statusPageName}: ${title} - ${status}`,
    blocks,
  };
}

/**
 * Formats an incident webhook into a Slack Block Kit message
 */
function formatIncidentMessage(payload: SquadcastWebhook): any {
  const incident = payload.incident || {};
  const service = payload.service || {};
  const team = payload.team || {};
  const eventType = payload.event_type || payload.eventName || 'Unknown Event';
  
  const message = incident.message || 'New Incident';
  const description = incident.description || '';
  const status = incident.status || 'Unknown';
  const severity = incident.severity || incident.priority || 'N/A';
  const alertSource = incident.alert_source || 'N/A';
  
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `🚨 ${message}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Event Type:*\n${eventType}`,
        },
        {
          type: 'mrkdwn',
          text: `*Status:*\n${status}`,
        },
        {
          type: 'mrkdwn',
          text: `*Severity:*\n${severity}`,
        },
        {
          type: 'mrkdwn',
          text: `*Source:*\n${alertSource}`,
        },
      ],
    },
  ];

  // Add service information if available
  if (service.name || team.name) {
    const fields = [];
    if (service.name) {
      fields.push({
        type: 'mrkdwn',
        text: `*Service:*\n${service.name}`,
      });
    }
    if (team.name) {
      fields.push({
        type: 'mrkdwn',
        text: `*Team:*\n${team.name}`,
      });
    }
    blocks.push({
      type: 'section',
      fields,
    });
  }

  // Add description if available
  if (description) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Description:*\n${description}`,
      },
    });
  }

  // Add button to view status page
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View Status Page',
          emoji: true,
        },
        url: STATUS_PAGE_URL,
        style: 'primary',
      },
    ],
  });

  return {
    channel: undefined, // Will be set from env
    text: `Squadcast Alert: ${message}`,
    blocks,
  };
}

/**
 * Main Cloudflare Worker handler
 * Receives Squadcast webhook events and posts them to Slack using the Bot API
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Validate Slack bot configuration
    if (!env.SLACK_BOT_TOKEN) {
      console.error('SLACK_BOT_TOKEN environment variable is not set');
      return new Response('Server configuration error', { status: 500 });
    }

    if (!env.SLACK_CHANNEL_ID) {
      console.error('SLACK_CHANNEL_ID environment variable is not set');
      return new Response('Server configuration error', { status: 500 });
    }

    try {
      // Parse incoming Squadcast webhook payload
      // Handle both application/json and application/octet-stream content types
      let squadcastPayload: SquadcastWebhook;
      const contentType = request.headers.get('content-type') || '';
      
      // Read the request body as text first (works for both content types)
      const text = await request.text();
      
      try {
        // Parse the text as JSON
        squadcastPayload = JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse webhook payload as JSON:', {
          contentType,
          textPreview: text.substring(0, 200),
          parseError,
        });
        return new Response('Invalid JSON payload', { status: 400 });
      }

      // Format message using Block Kit
      const slackMessage = formatSlackMessage(squadcastPayload);
      
      // Normalize channel ID
      const channelId = normalizeChannelId(env.SLACK_CHANNEL_ID);
      slackMessage.channel = channelId;

      // Post message to Slack using Web API
      const slackResponse = await fetch(SLACK_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(slackMessage),
      });

      const result: SlackApiResponse = await slackResponse.json();

      // Check if Slack API call was successful
      if (!result.ok) {
        // Build channel info for error messages
        const channelInfo = {
          isChannelId: channelId.startsWith('C'),
          length: channelId.length,
          preview: channelId.length > 10 ? `${channelId.substring(0, 10)}...` : channelId,
        };
        
        console.error('Slack API error:', {
          error: result.error,
          channelInfo,
          response: result,
        });
        
        // Provide helpful error messages for common issues
        let errorMessage = `Failed to post message to Slack: ${result.error || 'Unknown error'}`;
        if (result.error === 'channel_not_found') {
          errorMessage += `. Channel configured: "${channelInfo.preview}" (${channelInfo.isChannelId ? 'ID format' : 'name format'}). `;
          errorMessage += 'Please verify: 1) The channel ID/name is correct, 2) The bot is invited to the channel (if using channel name), 3) The channel exists in your workspace. ';
          errorMessage += `To get channel ID: Right-click channel → View channel details → Copy Channel ID. Current value length: ${channelInfo.length} characters.`;
        }
        
        return new Response(errorMessage, { status: 500 });
      }

      console.log('Successfully posted to Slack');
      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Error processing webhook:', error);
      return new Response('Internal server error', { status: 500 });
    }
  },
};

