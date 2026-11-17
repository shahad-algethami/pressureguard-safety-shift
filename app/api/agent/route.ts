import { aiClient } from '@/lib/server/ai-client';
import { runAgent, commentOnObservation } from '@/lib/agent';
import { documentationFallback } from '@/lib/smart-messages';
import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fallbackGuide } from '@/lib/simulation';
import { authenticated, locked, saveSession } from '@/lib/server/store';
import { body, failure, rateLimit } from '@/lib/server/http';
export const runtime = 'nodejs';
export const maxDuration = 90;
export async function POST(req: Request) {
  try {
    const raw = await body(req);
    if (raw.purpose === 'observation-feedback') {
      const input = z
        .object({ observation: z.string().max(1400), lang: z.enum(['en', 'ar']) })
        .parse(raw);
      const s = await authenticated();
      if (!s.progress.identityVerified || !s.progress.procedureChecked)
        throw new Error('FORBIDDEN');
      const fallback = () =>
        NextResponse.json({ text: documentationFallback[input.lang], mode: 'guidance', tools: [] });
      if (!input.observation.trim() || !process.env.OPENAI_API_KEY) return fallback();
      try {
        await rateLimit('feedback:' + s.id, 18);
        // Read-only feedback: no session lock, version change, or result write
        // can race with or delay the visitor's Continue action.
        const text = await commentOnObservation(
          aiClient(),
          { ...s, lang: input.lang },
          input.observation,
          process.env.OPENAI_MODEL || 'gpt-4.1-mini',
          req.signal,
        );
        return NextResponse.json({ text, mode: 'live', tools: [] });
      } catch {
        return fallback();
      }
    }
    const input = z.object({ message: z.string().trim().max(500).optional() }).parse(raw);
    const s = await authenticated();
    await rateLimit('agent:' + s.id, 18);
    if (!process.env.OPENAI_API_KEY)
      return NextResponse.json({ text: fallbackGuide(s), mode: 'demo', tools: [] });
    await locked(s.id, async () => {
      const fresh = await authenticated();
      if (fresh.aiCalls >= 45) throw new Error('RATE_LIMIT');
      const version = fresh.progress.version;
      fresh.aiCalls++;
      fresh.progress.version++;
      await saveSession(fresh, version);
    });
    const client = aiClient();
    return NextResponse.json(
      await runAgent(client, s, input.message, process.env.OPENAI_MODEL || 'gpt-4.1-mini'),
    );
  } catch (e) {
    if (
      e instanceof OpenAI.APIError ||
      (e instanceof Error && /timeout|connection/i.test(e.message))
    ) {
      try {
        return NextResponse.json({
          text: fallbackGuide(await authenticated()),
          mode: 'unavailable',
          tools: [],
        });
      } catch {}
    }
    return failure(e);
  }
}
