/**
 * Ninaivugal — Cloudflare Audio Transcription Worker
 * Model: @cf/openai/whisper-large-v3-turbo
 *
 * Deploy: wrangler deploy
 * Expects: POST multipart/form-data with field "audio" (any audio file)
 * Returns: { text: "transcript" }
 *
 * Protect with CF_WORKER_SECRET env var:
 *   wrangler secret put CF_WORKER_SECRET
 * Then set the same value in your backend .env as CF_WORKER_SECRET.
 */

export default {
  async fetch(request, env) {
    // CORS preflight
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
      const formData = await request.formData();
      const audio = formData.get('audio');

      if (!audio) {
        return Response.json({ error: 'No audio field in form data' }, { status: 400 });
      }

      const audioBuffer = await audio.arrayBuffer();
      if (audioBuffer.byteLength === 0) {
        return Response.json({ error: 'Audio file is empty' }, { status: 400 });
      }

      const result = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
        audio: [...new Uint8Array(audioBuffer)],
      });

      const text = result.text?.trim() ?? '';
      return Response.json(
        { text },
        { headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    } catch (err) {
      console.error('Audio worker error:', err);
      return Response.json({ error: String(err) }, { status: 500 });
    }
  },
};
