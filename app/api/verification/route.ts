import { NextResponse } from 'next/server';
import { authenticated, locked, publicSession, saveSession } from '@/lib/server/store';
import { body, failure, rateLimit } from '@/lib/server/http';
import { aiClient } from '@/lib/server/ai-client';
import { prepareVerification } from '@/lib/note-review';
import { RuleError } from '@/lib/simulation';
export const maxDuration = 90;
export async function POST(req: Request) {
  try {
    await body(req);
    const first = await authenticated();
    await rateLimit('prepare:' + first.id, 6);
    return await locked(first.id, async () => {
      const s = await authenticated();
      if (!s.progress.safeDecision || !s.progress.approvedObservation)
        throw new RuleError('requestNotReady');
      if (s.progress.request) return NextResponse.json(publicSession(s));
      if (s.aiCalls >= 45) throw new Error('RATE_LIMIT');
      const client = aiClient();
      let version = s.progress.version;
      s.aiCalls++;
      s.progress.version++;
      await saveSession(s, version);
      const request = await prepareVerification(
        client,
        s,
        process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      );
      version = s.progress.version;
      s.progress.request = request;
      s.progress.lastAction = 'request-prepared';
      s.progress.version++;
      await saveSession(s, version);
      return NextResponse.json(publicSession(s));
    });
  } catch (e) {
    return failure(e);
  }
}
