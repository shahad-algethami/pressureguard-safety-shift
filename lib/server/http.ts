import 'server-only';
import { NextResponse } from 'next/server';
import { RuleError } from '../simulation';
import { createHash } from 'node:crypto';
import { db } from './store';
import OpenAI from 'openai';
import { ZodError } from 'zod';
export function guard(req: Request) {
  const origin = req.headers.get('origin');
  if (origin) {
    const incoming = new URL(origin);
    const allowed = process.env.APP_ORIGIN;
    if (
      allowed
        ? incoming.origin !== new URL(allowed).origin
        : incoming.host !== req.headers.get('host')
    )
      throw new Error('FORBIDDEN');
  }
  if (req.headers.get('sec-fetch-site') === 'cross-site') throw new Error('FORBIDDEN');
  if (Number(req.headers.get('content-length') || 0) > 16000) throw new Error('TOO_LARGE');
}
export async function body(req: Request) {
  guard(req);
  const text = await req.text();
  if (text.length > 16000) throw new Error('TOO_LARGE');
  return JSON.parse(text);
}
export function failure(e: unknown) {
  if (e instanceof OpenAI.APIError)
    return NextResponse.json(
      {
        error:
          e.status === 401
            ? 'AI_AUTH_ERROR'
            : e.status === 429
              ? 'AI_RATE_LIMIT'
              : 'AI_UNAVAILABLE',
      },
      { status: 503 },
    );
  if (e instanceof ZodError) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  if (e instanceof Error && e.message === 'AI_NOT_CONFIGURED')
    return NextResponse.json({ error: 'AI_NOT_CONFIGURED' }, { status: 503 });
  if (e instanceof Error && e.message === 'DATABASE_NOT_CONFIGURED')
    return NextResponse.json({ error: 'DATABASE_NOT_CONFIGURED' }, { status: 503 });
  if (e instanceof RuleError) return NextResponse.json({ error: e.code }, { status: 422 });
  const message = e instanceof Error ? e.message : '';
  const status =
    message === 'UNAUTHORIZED'
      ? 401
      : message === 'FORBIDDEN'
        ? 403
        : message === 'CONFLICT'
          ? 409
          : message === 'RATE_LIMIT'
            ? 429
            : message === 'TOO_LARGE'
              ? 413
              : 400;
  const known = ['UNAUTHORIZED', 'FORBIDDEN', 'CONFLICT', 'RATE_LIMIT', 'TOO_LARGE'];
  if (!known.includes(message))
    console.error(
      'Request failed:',
      (e as { code?: string })?.code || (e instanceof Error ? e.name : 'unknown'),
    );
  return NextResponse.json(
    { error: known.includes(message) ? message : 'REQUEST_FAILED' },
    { status },
  );
}
const buckets = new Map<string, { n: number; reset: number }>();
export async function rateLimit(key: string, max = 30) {
  const client = db();
  if (client) {
    const { data, error } = await client.rpc('consume_rate_limit', {
      bucket_key: createHash('sha256').update(key).digest('hex'),
      max_requests: max,
    });
    if (error) throw error;
    if (!data) throw new Error('RATE_LIMIT');
    return;
  }
  const now = Date.now();
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + 60000 });
    return;
  }
  if (++b.n > max) throw new Error('RATE_LIMIT');
}
