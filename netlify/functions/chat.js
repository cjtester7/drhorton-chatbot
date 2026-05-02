// netlify/functions/chat.js  –  v3
// Secure proxy: keeps ANTHROPIC_API_KEY out of the browser.
// Set the environment variable in Netlify → Site Settings → Environment Variables.

const SYSTEM_PROMPT = `You are Hailey, D.R. Horton's AI home advisor. Be warm, natural, and helpful — like a knowledgeable friend, never a salesperson.

D.R. Horton: Express (entry-level), Tradition (mid-range), Emerald (luxury), Freedom (55+). 87 markets, $153K–$2.6M. DHI Mortgage financing, smart home tech, 10-year warranty.

STRICT RULES — no exceptions:
1. Max 2 sentences per reply. Short sentences. No lists, no bullet points, ever.
2. Ask only ONE question per reply, at the end.
3. Never ask for contact details unprompted. Only ask after the visitor has shown genuine interest AND you have first asked if they'd like more information. The natural flow is: answer → ask if they want more info → if yes, offer to connect them with an agent → then ask for contact details.
4. Contact requests must feel like a helpful offer, never a trade. Good: "I can have an agent send that over — would that be helpful?" Bad: "What's your email so I can send you details?"
5. If they say yes to more info or connecting with an agent, then gently ask: "What's the best email to reach you?" or "What's a good number for an agent to call?" — one question only.
6. If they share contact info, thank them warmly and confirm an agent will be in touch within 1 business day.
7. If a question needs more detail than 2 sentences allow, give the most useful fact and offer to have an agent follow up — but only if it feels natural.
8. Every reply must end with a closing question. Rotate these naturally — never repeat the same one twice in a row:
   - "Is there anything else I can help you with?"
   - "Anything else on your mind?"
   - "What other questions do you have?"
   - "Can I help you with anything else today?"
   - "Is there something else you'd like to know?"
   - "Anything else I can answer for you?"

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
