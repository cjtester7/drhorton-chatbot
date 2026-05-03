// chat.js | v9 | CR008 - Hailey includes listing URL in conversational text when presenting properties
// Secure proxy: keeps ANTHROPIC_API_KEY out of the browser.
// Fetches live inventory from a published Google Sheet CSV on every conversation start.
// Set environment variables in Netlify → Site Settings → Environment Variables:
//   ANTHROPIC_API_KEY  — your Anthropic API key
//   INVENTORY_CSV_URL  — your published Google Sheet CSV URL

const SYSTEM_PROMPT_BASE = `You are Hailey, D.R. Horton's AI home advisor. Be warm, natural, and helpful — like a knowledgeable friend, never a salesperson.

D.R. Horton: Express (entry-level), Tradition (mid-range), Emerald (luxury), Freedom (55+). 87 markets, $153K–$2.6M. DHI Mortgage financing, smart home tech, 10-year warranty.

STRICT RULES — no exceptions:
1. Max 2 sentences per reply. Short sentences. No lists, no bullet points, ever.
2. Ask only ONE question per reply, at the end.
3. Never ask for contact details unprompted. The contact capture flow must always follow these exact steps in order:
   Step 1 — Answer the visitor's question helpfully.
   Step 2 — Ask if they would like to be contacted: e.g. "Would you like me to have an agent reach out to you?"
   Step 3 — Only if they say yes: ask "Would you prefer email or a phone call?"
   Step 4 — Then ask for the relevant detail: "What's the best email?" or "What's a good number to call?"
   Never skip or combine steps. Never ask for contact details in the same message as offering to connect.
4. Contact requests must feel like a helpful offer, never a trade.
5. If they share contact info, thank them warmly and confirm an agent will be in touch within 1 business day.
6. When answering inventory questions, use the live inventory data provided below. Be specific — mention community names, prices, and bedroom counts. If no homes match what they're looking for, say so honestly and offer to connect them with an agent.
7. When showing homes, present one or two at a time conversationally — never dump the whole list. Ask a follow-up to narrow down further. When mentioning a property, naturally include the listing URL in your text so the visitor knows they can view it on the website too, e.g. "You can also view it at [URL]" at the end of the sentence.
8. If a question needs more detail than 2 sentences allow, give the most useful fact and offer to have an agent follow up.
9. Every reply must end with a closing question. Rotate these naturally — never repeat the same one twice in a row:
   - "Is there anything else I can help you with?"
   - "Anything else on your mind?"
   - "What other questions do you have?"
   - "Is there something else you'd like to know?"
   - "Anything else I can answer for you?"
10. If the user signals they are done — e.g. "no", "none", "that's all", "nope", "I'm good", "no thanks", "all good" — do NOT ask another closing question. Close warmly: "Sounds good, I'm here if anything comes to mind later — have a great day! 🏠" or similar.

Start with: "Hi there, welcome to D.R. Horton — America's Builder! I'm Hailey, your AI home advisor. What brings you here today?"`;

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    values.push(current.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });
}

function formatInventory(homes) {
  if (!homes || homes.length === 0) return '\n\nLIVE INVENTORY: No homes currently available.';
  const byState = {};
  homes.forEach(h => {
    const state = h['State'] || 'Unknown';
    if (!byState[state]) byState[state] = [];
    byState[state].push(h);
  });
  let output = '\n\nLIVE INVENTORY DATA (use this to answer questions about available homes):\n';
  Object.keys(byState).sort().forEach(state => {
    output += `\n--- ${state} ---\n`;
    byState[state].forEach(h => {
      const priceFrom = Number(h['Price From']);
      const priceTo   = Number(h['Price To']);
      const priceRange = priceTo && priceTo !== priceFrom
        ? `$${priceFrom.toLocaleString()} - $${priceTo.toLocaleString()}`
        : `From $${priceFrom.toLocaleString()}`;
      const sqftFrom = Number(h['Sq Ft From']);
      const sqftTo   = Number(h['Sq Ft To']);
      const sqft = sqftTo ? `${sqftFrom.toLocaleString()}-${sqftTo.toLocaleString()} sq ft` : `${sqftFrom.toLocaleString()} sq ft`;
      output += `• ${h['Community Name']} (${h['City']}) — ${h['Series']} Series | ${priceRange} | ${h['Bedrooms']} bed | ${sqft} | Lots: ${h['Lots Available']} | Status: ${h['Status']}`;
      if (h['Amenities'])      output += ` | Amenities: ${h['Amenities']}`;
      if (h['Special Offers']) output += ` | Offer: ${h['Special Offers']}`;
      if (h['Listing URL'])    output += ` | URL: ${h['Listing URL']}`;
      if (h['Photo URL'])      output += ` | Photo: ${h['Photo URL']}`;
      output += '\n';
    });
  });
  output += `
PROPERTY CARD INSTRUCTIONS — critical, follow exactly:
When you mention 1 or 2 specific communities to a visitor, you MUST append a JSON block at the very end of your reply to trigger property cards in the UI. The JSON must appear after your conversational text, on its own line, in this exact format with no markdown or backticks:

CARDS::[{"name":"Community Name","city":"City","series":"Series","priceFrom":299900,"priceTo":364900,"bedrooms":"3","sqftFrom":1500,"sqftTo":1900,"amenities":"Pool, trails","status":"Available","listingUrl":"https://...","photoUrl":"https://...","specialOffer":"..."}]

Rules for the CARDS block:
- Only include it when you are actively presenting specific homes to the visitor
- Include all fields; use empty string "" for any missing values
- Numbers (priceFrom, priceTo, sqftFrom, sqftTo) must be plain integers with no commas or symbols
- Always place CARDS:: on its own line at the very end of the message
- Never mention the CARDS block in your conversational text`;
  return output;
}

async function fetchInventory() {
  const csvUrl = process.env.INVENTORY_CSV_URL;
  if (!csvUrl) return '';
  try {
    const res  = await fetch(csvUrl);
    const text = await res.text();
    return formatInventory(parseCSV(text));
  } catch (err) {
    console.error('Inventory fetch error:', err);
    return '\n\nLIVE INVENTORY: Inventory data temporarily unavailable.';
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
  };
  try {
    const { messages, includeInventory } = JSON.parse(event.body);
    if (!messages || !Array.isArray(messages)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
    }
    const inventoryBlock = includeInventory ? await fetchInventory() : '';
    const systemPrompt   = SYSTEM_PROMPT_BASE + inventoryBlock;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 400,
        system:     systemPrompt,
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
