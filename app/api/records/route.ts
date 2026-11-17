import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticated } from '@/lib/server/store';
import { body, failure, rateLimit } from '@/lib/server/http';
import { currentTask, RuleError } from '@/lib/simulation';
import { recordContext } from '@/lib/records';
export async function POST(req: Request) {
  try {
    const { stage } = z.object({ stage: z.number().int().min(0).max(3) }).parse(await body(req));
    const s = await authenticated();
    await rateLimit('records:' + s.id, 90);
    if (stage > currentTask(s.progress)) throw new RuleError('reviewFirst');
    return NextResponse.json(recordContext(stage, s.lang));
  } catch (e) {
    return failure(e);
  }
}
