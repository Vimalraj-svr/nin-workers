/**
 * Ninaivugal — Cloudflare Diary Text Generation Worker
 * Model: @cf/meta/llama-3.3-70b-instruct-fp8-fast
 *
 * Deploy: wrangler deploy
 * Expects: POST application/json { prompt: "..." }
 * Returns: { result: { title_original, content_original, title_english,
 *                      content_english, mood_summary, detected_language_code } }
 *
 * Protect with CF_WORKER_SECRET env var:
 *   wrangler secret put CF_WORKER_SECRET
 */

const SYSTEM_PROMPT = `You are Ninaivugal — a warm, deeply empathetic diary companion.
Given the user's raw thoughts or voice transcript, you shape them into a beautifully written diary entry.
You write with intimacy, literary care, and emotional intelligence.

IMPORTANT: You MUST respond with valid JSON and nothing else — no markdown, no explanation.
The JSON must follow this exact schema:
{
  "title_original": "string — an evocative title in the diary's primary language",
  "content_original": "string — the full diary entry in the primary language, 3-6 paragraphs",
  "title_english": "string — English title (same as title_original if already English)",
  "content_english": "string — English version of the entry (same if already English)",
  "mood_summary": "string — one or two words describing the emotional tone (e.g. 'reflective', 'joyful', 'anxious')",
  "detected_language_code": "string — ISO 639-1 code of the input language (e.g. 'ta', 'en', 'hi', 'ml', 'te', 'kn')"
}`;

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type, X-Worker-Secret',
        },
      });
    }

    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    // Auth check
    if (env.CF_WORKER_SECRET) {
      const secret = request.headers.get('X-Worker-Secret');
      if (secret !== env.CF_WORKER_SECRET) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    try {
      const body = await request.json();
      const { prompt } = body;

      if (!prompt) {
        return Response.json({ error: 'No prompt provided' }, { status: 400 });
      }

      const aiResult = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.75,
        max_tokens: 2048,
      });

      // Parse and validate the response
      let parsed;
      try {
        parsed = typeof aiResult.response === 'string'
          ? JSON.parse(aiResult.response)
          : aiResult.response;
      } catch {
        return Response.json({ error: 'Model did not return valid JSON', raw: aiResult.response }, { status: 502 });
      }

      return Response.json(
        { result: parsed },
        { headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    } catch (err) {
      console.error('Text worker error:', err);
      return Response.json({ error: String(err) }, { status: 500 });
    }
  },
};
