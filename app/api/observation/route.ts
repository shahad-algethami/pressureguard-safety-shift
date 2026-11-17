import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticated, locked, publicSession, saveSession } from '@/lib/server/store';
import { body, failure, rateLimit } from '@/lib/server/http';
import { aiClient } from '@/lib/server/ai-client';
import { reviewObservation } from '@/lib/note-review';
import { RuleError } from '@/lib/simulation';
export const maxDuration = 90;
export async function POST(req: Request) {
  try {
    const input = z
      .object({ text: z.string().trim().min(1).max(1400), kind: z.enum(['original', 'edit']) })
      .parse(await body(req));
    const first = await authenticated();
    await rateLimit('review:' + first.id, 8);
    return await locked(first.id, async () => {
      const s = await authenticated();
      if (
        s.progress.workflowVersion !== 2 ||
        !s.progress.identityVerified ||
        !s.progress.procedureChecked
      )
        throw new RuleError('procedureFirst');
      if (s.progress.approvedObservation || s.progress.completed) throw new RuleError('noteLocked');
      const last = s.progress.reviews.at(-1);
      if (last && last.input === input.text && last.kind === input.kind && last.lang === s.lang)
        return NextResponse.json(publicSession(s));
      if (input.kind === 'edit' && !s.progress.reviews.some((r) => r.status === 'sufficient'))
        throw new RuleError('reviewRequired');
      if (s.progress.reviews.length >= 20 || s.aiCalls >= 45) throw new Error('RATE_LIMIT');
      let version = s.progress.version;
      s.progress.observationOriginal ||= input.text;
      s.progress.observationDraft = input.text;
      s.progress.lastAction = 'reviewing';
      s.progress.version++;
      await saveSession(s, version); // Original survives outages and missing credentials.
      const client = aiClient();
      version = s.progress.version;
      s.aiCalls++;
      s.progress.version++;
      await saveSession(s, version);
      const review = await reviewObservation(
        client,
        s,
        input.text,
        input.kind,
        process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      );
      version = s.progress.version;
      s.progress.reviews.push(review);
      s.progress.lastAction = 'observation-reviewed';
      s.progress.version++;
      await saveSession(s, version);
      return NextResponse.json(publicSession(s));
    });
  } catch (e) {
    return failure(e);
  }
}
