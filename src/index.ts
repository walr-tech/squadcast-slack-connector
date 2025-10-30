export interface Env {
  SLACK_WEBHOOK_URL: string;
}

/**
 * Flattens a nested object into a single-level object with underscored keys
 * Example: { incident: { message: "test" } } -> { incident_message: "test" }
 */
function flattenObject(obj: any, prefix = '', result: Record<string, any> = {}): Record<string, any> {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}_${key}` : key;
      const value = obj[key];

      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        // Recursively flatten nested objects
        flattenObject(value, newKey, result);
      } else {
        // For arrays, dates, and primitives, convert to string if needed
        result[newKey] = Array.isArray(value) ? JSON.stringify(value) : value;
      }
    }
  }
  return result;
}

/**
 * Main Cloudflare Worker handler
 * Receives Squadcast webhook events and forwards them to Slack workflow
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Log all incoming requests for debugging
    console.log('Incoming request:', {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
    });

    // Only accept POST requests
    if (request.method !== 'POST') {
      console.log('Rejected non-POST request:', request.method);
      return new Response('Method not allowed', { status: 405 });
    }

    // Validate Slack webhook URL is configured
    if (!env.SLACK_WEBHOOK_URL) {
      console.error('SLACK_WEBHOOK_URL environment variable is not set');
      return new Response('Server configuration error', { status: 500 });
    }

    try {
      // Parse incoming Squadcast webhook payload
      const squadcastPayload = await request.json();
      console.log('Received Squadcast webhook:', JSON.stringify(squadcastPayload, null, 2));

      // Flatten the payload so Slack workflow variables can access all fields
      // Slack workflow webhooks don't support nested objects or dot notation
      const flattenedPayload = flattenObject(squadcastPayload);
      console.log('Flattened payload for Slack:', JSON.stringify(flattenedPayload, null, 2));

      // Forward the flattened payload to Slack workflow webhook
      const slackResponse = await fetch(env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(flattenedPayload),
      });

      // Check if Slack webhook call was successful
      if (!slackResponse.ok) {
        const errorText = await slackResponse.text();
        console.error('Slack webhook failed:', {
          status: slackResponse.status,
          statusText: slackResponse.statusText,
          body: errorText,
        });
        return new Response(
          `Failed to forward webhook to Slack: ${slackResponse.status} ${slackResponse.statusText}`,
          { status: slackResponse.status }
        );
      }

      console.log('Successfully forwarded webhook to Slack');
      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Error processing webhook:', error);
      
      // Return error response
      if (error instanceof SyntaxError) {
        return new Response('Invalid JSON payload', { status: 400 });
      }
      
      return new Response('Internal server error', { status: 500 });
    }
  },
};

