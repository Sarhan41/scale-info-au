import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const VALID_EVENTS = new Set(['view', 'lead', 'booking']);
const VALID_VARIANTS = new Set(['old', 'new']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const event = String(req.query.e || '');
  const variant = String(req.query.v || '');

  if (!VALID_EVENTS.has(event) || !VALID_VARIANTS.has(variant)) {
    return res.status(204).end();
  }

  try {
    const redis = Redis.fromEnv();
    const today = new Date().toISOString().slice(0, 10);
    await Promise.all([
      redis.incr(`vsl:${variant}:${event}:total`),
      redis.incr(`vsl:${variant}:${event}:${today}`),
      redis.setnx('vsl:started_at', new Date().toISOString()),
    ]);
  } catch {}

  return res.status(204).end();
}
