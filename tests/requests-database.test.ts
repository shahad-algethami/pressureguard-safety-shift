import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { initialProgress, completeProgress } from '../lib/simulation';
test('additive migration preserves existing data; request submission is atomic, private and idempotent', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      'create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to anon,authenticated,service_role;create publication supabase_realtime;',
    );
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/001_pressureguard.sql', import.meta.url),
        'utf8',
      ),
    );
    const id = '30000000-0000-4000-8000-000000000001',
      rid = '40000000-0000-4000-8000-000000000001';
    const p = {
      ...initialProgress(),
      identityVerified: true,
      procedureChecked: true,
      discrepancy: true,
      safeDecision: true,
      approvedReviewId: rid,
      observationOriginal: 'My original observation',
      approvedObservation: 'Reviewed note',
      request: {
        id: rid,
        patientId: 'PG-2048' as const,
        status: 'pending-verification' as const,
        concern: 'allergy-documentation' as const,
        evidenceIds: [],
        observation: 'Reviewed note',
        message: 'Verify before proceeding',
        lang: 'en' as const,
        preparedAt: new Date().toISOString(),
        submittedAt: null,
        preparedBy: 'ai' as const,
      },
    };
    await db.query('insert into public.simulation_sessions(id,payload,version) values($1,$2,0)', [
      id,
      { progress: p },
    ]);
    await db.query('insert into public.participants(id,name) values($1,$2)', [id, 'Existing name']);
    const migration = await readFile(
      new URL('../supabase/migrations/002_observations_and_requests.sql', import.meta.url),
      'utf8',
    );
    await db.exec(migration);
    await db.exec(migration);
    assert.equal((await db.query('select * from public.participants')).rows.length, 1);
    await db.exec('set role anon');
    await assert.rejects(
      () => db.query('select * from public.verification_requests'),
      /permission denied/,
    );
    await db.exec('reset role;set role service_role');
    const done = completeProgress(p, rid, new Date().toISOString());
    await assert.rejects(
      () =>
        db.query('select public.submit_verification_request($1,$2,$3,$4)', [
          id,
          9,
          { progress: done },
          done.request,
        ]),
      /CONFLICT/,
    );
    await db.query('update public.simulation_sessions set payload=$1 where id=$2', [
      { progress: { ...p, safeDecision: false } },
      id,
    ]);
    await assert.rejects(
      () =>
        db.query('select public.submit_verification_request($1,$2,$3,$4)', [
          id,
          0,
          { progress: done },
          done.request,
        ]),
      /REQUEST_NOT_READY/,
    );
    assert.equal((await db.query('select * from public.verification_requests')).rows.length, 0);
    await db.query('update public.simulation_sessions set payload=$1 where id=$2', [
      { progress: p },
      id,
    ]);
    for (let i = 0; i < 2; i++)
      await db.query('select public.submit_verification_request($1,$2,$3,$4)', [
        id,
        0,
        { progress: done },
        done.request,
      ]);
    const rows = await db.query<{ status: string; original_observation: string }>(
      'select * from public.verification_requests',
    );
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].status, 'pending-verification');
    assert.equal(rows.rows[0].original_observation, 'My original observation');
    assert.equal(
      (await db.query<{ version: number }>('select version from public.simulation_sessions'))
        .rows[0].version,
      1,
    );
  } finally {
    await db.close();
  }
});
