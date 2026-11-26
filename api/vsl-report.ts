import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

type VariantStats = { view: number; lead: number; booking: number };

function pct(num: number, denom: number): string {
  if (!denom) return '—';
  return ((num / denom) * 100).toFixed(2) + '%';
}

function liftPct(a: number, b: number): string {
  if (!b) return a > 0 ? '+∞%' : '—';
  const lift = ((a - b) / b) * 100;
  const sign = lift >= 0 ? '+' : '';
  return `${sign}${lift.toFixed(1)}%`;
}

function daysSince(iso: string | null): string {
  if (!iso) return '0d';
  const ms = Date.now() - new Date(iso).getTime();
  const days = ms / (1000 * 60 * 60 * 24);
  if (days < 1) return `${(days * 24).toFixed(1)}h`;
  return `${days.toFixed(1)}d`;
}

async function readStats(redis: Redis, variant: 'old' | 'new'): Promise<VariantStats> {
  const [view, lead, booking] = await Promise.all([
    redis.get<number>(`vsl:${variant}:view:total`),
    redis.get<number>(`vsl:${variant}:lead:total`),
    redis.get<number>(`vsl:${variant}:booking:total`),
  ]);
  return {
    view: Number(view) || 0,
    lead: Number(lead) || 0,
    booking: Number(booking) || 0,
  };
}

function buildMessage(old: VariantStats, neo: VariantStats, startedAt: string | null): string {
  const totalViews = old.view + neo.view;
  const oldLeadCvr = pct(old.lead, old.view);
  const newLeadCvr = pct(neo.lead, neo.view);
  const oldBookCvr = pct(old.booking, old.view);
  const newBookCvr = pct(neo.booking, neo.view);

  const bookingLift = liftPct(neo.booking / Math.max(neo.view, 1), old.booking / Math.max(old.view, 1));
  const leader =
    totalViews < 100
      ? '⏳ Not enough data yet'
      : neo.booking / Math.max(neo.view, 1) > old.booking / Math.max(old.view, 1)
      ? '🏆 NEW VSL ahead'
      : old.booking / Math.max(old.view, 1) > neo.booking / Math.max(neo.view, 1)
      ? '🏆 OLD VSL ahead'
      : '🤝 Tied';

  return [
    '🎬 *VSL Split Test — ' + new Date().toUTCString() + '*',
    '',
    `Running: ${daysSince(startedAt)}  |  Total views: ${totalViews}`,
    '',
    '```',
    '              OLD VSL     NEW VSL',
    `Views        ${String(old.view).padEnd(10)} ${neo.view}`,
    `Leads        ${String(old.lead).padEnd(10)} ${neo.lead}`,
    `Bookings     ${String(old.booking).padEnd(10)} ${neo.booking}`,
    `Lead CVR     ${oldLeadCvr.padEnd(10)} ${newLeadCvr}`,
    `Book CVR     ${oldBookCvr.padEnd(10)} ${newBookCvr}`,
    '```',
    '',
    `Booking CVR lift (new vs old): *${bookingLift}*`,
    leader,
  ].join('\n');
}

async function sendTelegram(text: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) {
    throw new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set');
  }
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Telegram API ${resp.status}: ${body}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isCron = req.headers['user-agent']?.includes('vercel-cron');
  const authHeader = req.headers.authorization;
  const hasSecret =
    process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isCron && !hasSecret && req.query.manual !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const redis = Redis.fromEnv();
    const [old, neo, startedAt] = await Promise.all([
      readStats(redis, 'old'),
      readStats(redis, 'new'),
      redis.get<string>('vsl:started_at'),
    ]);

    const message = buildMessage(old, neo, startedAt);
    await sendTelegram(message);
    return res.status(200).json({ ok: true, sent: true, stats: { old, neo } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
}
