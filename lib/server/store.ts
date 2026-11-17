import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { cookies } from 'next/headers';
import { normalizeSession, completeProgress, assertSubmission, type Session } from '../simulation';
// Runtime-only demo data must never be traced into a deployment bundle.
const root = path.resolve(
  /* turbopackIgnore: true */ process.cwd(),
  process.env.PG_DATA_DIR || '.local-data',
);
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key
    ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
}
export function localAllowed() {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_LOCAL_DEMO === 'true';
}
function requireLocal() {
  if (!localAllowed()) throw new Error('DATABASE_NOT_CONFIGURED');
}
export function credentials() {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: createHash('sha256').update(token).digest('hex') };
}
async function localRead<T>(file: string, fallback: T): Promise<T> {
  requireLocal();
  try {
    return JSON.parse(await readFile(path.join(/* turbopackIgnore: true */ root, file), 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw e;
  }
}
async function localWrite(file: string, value: unknown) {
  requireLocal();
  await mkdir(root, { recursive: true });
  const dest = path.join(/* turbopackIgnore: true */ root, file),
    tmp = dest + '.' + randomBytes(5).toString('hex') + '.tmp';
  await writeFile(tmp, JSON.stringify(value), 'utf8');
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(tmp, dest);
      break;
    } catch (e) {
      if (
        attempt >= 5 ||
        !['EPERM', 'EACCES', 'EBUSY'].includes((e as NodeJS.ErrnoException).code || '')
      )
        throw e;
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
    }
  }
}
export async function getSession(id: string): Promise<Session | null> {
  const client = db();
  if (!client) {
    const s = await localRead<Session | null>(`${id}.json`, null);
    return s ? normalizeSession(s) : null;
  }
  const { data, error } = await client
    .from('simulation_sessions')
    .select('payload')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data?.payload ? normalizeSession(data.payload) : null;
}
export async function saveSession(s: Session, expectedVersion?: number) {
  const client = db();
  if (!client) {
    if (expectedVersion !== undefined) {
      const current = await getSession(s.id);
      if (current?.progress.version !== expectedVersion) throw new Error('CONFLICT');
    }
    return localWrite(`${s.id}.json`, s);
  }
  if (expectedVersion === undefined) {
    const { error } = await client
      .from('simulation_sessions')
      .insert({ id: s.id, payload: s, version: s.progress.version });
    if (error) throw error;
  } else {
    const { data, error } = await client
      .from('simulation_sessions')
      .update({ payload: s, version: s.progress.version })
      .eq('id', s.id)
      .eq('version', expectedVersion)
      .select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('CONFLICT');
  }
}
export async function submitRequest(s: Session, requestId: string): Promise<Session> {
  assertSubmission(s.progress, requestId);
  if (s.progress.completed && s.progress.request?.submittedAt) return s;
  const submittedAt = new Date().toISOString();
  const next = { ...s, progress: completeProgress(s.progress, requestId, submittedAt) };
  const client = db();
  if (client) {
    const { data, error } = await client.rpc('submit_verification_request', {
      session_id: s.id,
      expected_version: s.progress.version,
      new_payload: next,
      request_payload: next.progress.request,
    });
    if (error) {
      if (error.message.includes('CONFLICT')) throw new Error('CONFLICT');
      throw error;
    }
    return normalizeSession(data as Session);
  }
  // Stable per-session filename and request ID make retries idempotent after partial disk failures.
  const existing = await localRead<{ id: string; submittedAt: string } | null>(
    `request-${s.id}.json`,
    null,
  );
  if (existing && existing.id !== requestId) throw new Error('CONFLICT');
  if (existing) next.progress.request!.submittedAt = existing.submittedAt;
  else
    await localWrite(`request-${s.id}.json`, {
      ...next.progress.request,
      sessionId: s.id,
      originalObservation: s.progress.observationOriginal,
    });
  await saveSession(next, s.progress.version);
  return next;
}
export async function authenticated(): Promise<Session> {
  const raw = (await cookies()).get('pg_session')?.value || '';
  const [id, token] = raw.split('.');
  if (!/^[0-9a-f-]{36}$/.test(id || '') || !/^[0-9a-f]{64}$/.test(token || ''))
    throw new Error('UNAUTHORIZED');
  const s = await getSession(id);
  const hash = createHash('sha256').update(token).digest('hex');
  if (
    !s ||
    !timingSafeEqual(Buffer.from(s.tokenHash), Buffer.from(hash)) ||
    Date.now() - Date.parse(s.createdAt) > 8 * 60 * 60 * 1000
  )
    throw new Error('UNAUTHORIZED');
  return s;
}
export function publicSession(s: Session) {
  return {
    id: s.id,
    name: s.name,
    lang: s.lang,
    createdAt: s.createdAt,
    progress: s.progress,
    storage: db() ? 'supabase' : 'local',
    aiConfigured: !!process.env.OPENAI_API_KEY,
  };
}
export interface Participant {
  id: string;
  name: string;
  created_at: string;
}
export async function participants(): Promise<Participant[]> {
  const client = db();
  if (!client) return (await localRead<Participant[]>('participants.json', [])).slice(-150);
  const { data, error } = await client
    .from('participants')
    .select('id,name,created_at')
    .order('created_at', { ascending: false })
    .limit(150);
  if (error) throw error;
  return data || [];
}
export async function joinWall(s: Session, consent: boolean) {
  const client = db();
  if (client) {
    const result = consent
      ? await client.from('participants').upsert({ id: s.id, name: s.name }, { onConflict: 'id' })
      : await client.from('participants').delete().eq('id', s.id);
    if (result.error) throw result.error;
  } else {
    await locked('participants', async () => {
      const existing = (await localRead<Participant[]>('participants.json', [])).filter(
        (p) => p.id !== s.id,
      );
      if (consent) existing.push({ id: s.id, name: s.name, created_at: new Date().toISOString() });
      await localWrite('participants.json', existing);
    });
  }
}
const globalLocks = globalThis as unknown as { pgLocks?: Map<string, Promise<unknown>> };
const locks = (globalLocks.pgLocks ||= new Map());
export async function locked<T>(key: string, task: () => Promise<T>): Promise<T> {
  const prior = locks.get(key) || Promise.resolve();
  const next = prior.catch(() => {}).then(task);
  locks.set(key, next);
  try {
    return await next;
  } finally {
    if (locks.get(key) === next) locks.delete(key);
  }
}
