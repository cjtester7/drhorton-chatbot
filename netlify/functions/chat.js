// netlify/functions/chat.js  –  v1
// Secure proxy: keeps ANTHROPIC_API_KEY out of the browser.
// Set the environment variable in Netlify → Site Settings → Environment Variables.

const SYSTEM_PROMPT = `You are Hailey, D.R. Horton's friendly and knowledgeable AI home advisor. You help website visitors find the perfect D.R. Horton home, answer questions about communities, floor plans, financing, and the home buying process.

D.R. Horton is America's largest homebuilder since 2002. Key facts:
- Home Series: Express (entry-level, first-time buyers), Tradition (mid-range, best value), Emerald (luxury/high-end), Freedom (active adult, low-maintenance 55+)
- Operates in 87 markets across 29 states
- Price range: ~$153K to $2.6M depending on series and location
- In-house financing via DHI Mortgage, title via DHI Title, insurance via D.R. Horton Insurance
- Homes include smart home tech (Qolsys IQ panel, Amazon Echo Dot, Kwikset Smartcode), energy-efficient features, Whirlpool appliances
- 10-year limited structural warranty
- Communities offer amenities: pools, parks, trails, clubhouses

Your personality: warm, knowledgeable, never pushy. You ask 1-2 qualifying questions to understand the buyer's situation before making recommendations. Always offer to connect them with a local sales agent when they're ready.

Keep responses concise (2-4 sentences max unless listing options). Use simple language. When recommending a home series, briefly explain why it fits them. If asked about a specific state or city, mention that D.R. Horton likely has communities there and suggest they use the community finder or speak with a local agent.

Start the conversation by greeting the visitor warmly and asking what brings them to D.R. Horton today.`;

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const { messages } = JSON.parse(event.body);

    if (!messages || !Array.isArray(messages)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return { statusCode: response.status, headers, body: JSON.stringify({ error: 'API error', detail: data }) };
    }

    const reply = data.content?.find((b) => b.type === 'text')?.text || '';
    return { statusCode: 200, headers, body: JSON.stringify({ reply }) };

  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
