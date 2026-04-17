module.exports = async function handler(req, res) {

  // ── CORS ──
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST request.' });
  }

  const body = req.body || {};
  const { niche, tone, includeEmoji, includeHashtags, includeCta } = body;

  if (!niche || niche.trim().length === 0) {
    return res.status(400).json({ error: 'Enter your topic first.' });
  }

  // ── API KEY ──
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing OpenRouter API key.' });
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt   = buildUserPrompt(niche.trim(), tone, includeEmoji, includeHashtags, includeCta);

  try {
    const captions = await callOpenRouter(apiKey, systemPrompt, userPrompt);
    return res.status(200).json({ captions });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
};

// ── OPENROUTER API CALL ──
async function callOpenRouter(apiKey, systemPrompt, userPrompt) {

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://yourdomain.com', // change later
      'X-Title': 'CaptionCraft'
    },
    body: JSON.stringify({
      // ✅ FREE MODEL (change if needed)
      model: 'mistralai/mistral-7b-instruct',

      temperature: 0.8,
      max_tokens: 800,

      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(data);
    throw new Error('API ERROR');
  }

  const rawText = data?.choices?.[0]?.message?.content || '';

  if (!rawText) throw new Error('No response');

  return extractCaptions(rawText);
}

// ── PROMPTS ──
function buildSystemPrompt() {
  return `You are an expert Instagram caption writer.

Return ONLY JSON format:

{
 "captions": [
  "caption 1",
  "caption 2",
  "caption 3",
  "caption 4",
  "caption 5"
 ]
}`;
}

function buildUserPrompt(niche, tone, includeEmoji, includeHashtags, includeCta) {
  return `Create 5 Instagram captions about: "${niche}"

Tone: ${tone || 'engaging'}

${includeEmoji ? 'Use emojis.' : 'No emojis.'}
${includeHashtags ? 'Add hashtags.' : 'No hashtags.'}
${includeCta ? 'Include call to action.' : ''}

Make them engaging and scroll-stopping.`;
}

// ── PARSER ──
function extractCaptions(text) {
  try {
    const parsed = JSON.parse(text);
    if (parsed.captions) return parsed.captions;
  } catch (_) {}

  // fallback
  return text
    .split('\n')
    .map(t => t.trim())
    .filter(t => t.length > 20)
    .slice(0, 5);
}
