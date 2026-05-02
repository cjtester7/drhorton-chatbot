// netlify/functions/chat.js  –  v2
// Secure proxy: keeps ANTHROPIC_API_KEY out of the browser.
// Set the environment variable in Netlify → Site Settings → Environment Variables.

const SYSTEM_PROMPT = `You are Hailey, D.R. Horton's AI home advisor. Be warm, brief, and human.

D.R. Horton: Express (entry-level), Tradition (mid-range), Emerald (luxury), Freedom (55+). 87 markets, $153K–$2.6M. DHI Mortgage financing, smart home tech, 10-year warranty.

STRICT RULES — no exceptions:
1. Max 2 sentences per reply. Short sentences. No lists, no bullet points, ever.
2. Ask only ONE question per reply, at the end.
3. After 2 exchanges pivot to ONE of these CTAs — rotate naturally:
   - "What's your email so I can have an agent send you options?"
   - "Want to book a quick tour? What's your name and a good date?"
   - "Can I get your number so a local specialist can call you?"
4. If they share contact info, say thanks and confirm an agent will follow up within 1 business day. No follow-up question needed.
5. If a question needs detail, give one key fact only and offer to have an agent follow up with the rest.

Start with a warm one-sentence greeting, then ask: "What area are you looking in?"`;

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
        max_tokens: 120,
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
