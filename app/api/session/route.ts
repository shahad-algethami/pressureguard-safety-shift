import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { actionSchema, initialProgress, nameSchema, transition } from '@/lib/simulation';
import {
  authenticated,
  credentials,
  locked,
  publicSession,
  saveSession,
  submitRequest,
} from '@/lib/server/store';
import { body, failure, rateLimit } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function GET() {
  try {
    return NextResponse.json(publicSession(await authenticated()));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    const input = await body(req);
    if (input.type === 'start') {
      await rateLimit(
        'create:' + (req.headers.get('x-forwarded-for')?.split(',')[0] || 'local'),
        12,
      );
      const data = z.object({ name: nameSchema, lang: z.enum(['en', 'ar']) }).parse(input);
      const { token, tokenHash } = credentials();
      const s = {
        id: randomUUID(),
        tokenHash,
        name: data.name,
        lang: data.lang,
        createdAt: new Date().toISOString(),
        progress: initialProgress(),
        aiCalls: 0,
      };
      await saveSession(s);
      const response = NextResponse.json(publicSession(s));
      response.cookies.set('pg_session', `${s.id}.${token}`, {
        httpOnly: true,
        sameSite: 'strict',
        secure:
          (process.env.NODE_ENV === 'production' && process.env.ALLOW_LOCAL_DEMO !== 'true') ||
          new URL(req.url).protocol === 'https:',
        path: '/',
        maxAge: 8 * 60 * 60,
      });
      return response;
    }
    const original = await authenticated();
    await rateLimit(original.id, 90);
    const action = actionSchema.parse(input);
    return await locked(original.id, async () => {
      const s = await authenticated(),
        version = s.progress.version;
      if (action.type === 'submit-request')
        return NextResponse.json(publicSession(await submitRequest(s, action.requestId)));
      s.progress = transition(s.progress, action);
      if (action.type === 'language') s.lang = action.lang;
      await saveSession(s, version);
      return NextResponse.json(publicSession(s));
    });
  } catch (e) {
    return failure(e);
  }
}
