import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  authenticated,
  db,
  joinWall,
  locked,
  participants,
  publicSession,
  saveSession,
} from '@/lib/server/store';
import { body, failure, rateLimit } from '@/lib/server/http';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return NextResponse.json(
      { participants: await participants(), storage: db() ? 'supabase' : 'local' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    const { consent } = z.object({ consent: z.boolean() }).parse(await body(req));
    const first = await authenticated();
    await rateLimit('wall:' + first.id, 10);
    return await locked(first.id, async () => {
      const s = await authenticated();
      if (!s.progress.completed) throw new Error('FORBIDDEN');
      await joinWall(s, consent);
      const version = s.progress.version;
      s.progress.joined = consent;
      s.progress.version++;
      await saveSession(s, version);
      return NextResponse.json(publicSession(s));
    });
  } catch (e) {
    return failure(e);
  }
}
