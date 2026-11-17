import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('PostgreSQL migration enforces private sessions, consent-only writes, rate limits, and cleanup', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      'create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role; create publication supabase_realtime;',
    );
    await db.exec(
      await readFile(
        new URL('../supabase/migrations/001_pressureguard.sql', import.meta.url),
        'utf8',
      ),
    );
    await db.exec('set role service_role');
    const id = '00000000-0000-4000-8000-000000000001';
    await db.query('insert into public.simulation_sessions(id,payload) values($1,$2)', [
      id,
      { name: 'Private visitor', tokenHash: 'private' },
    ]);
    await db.query('insert into public.participants(id,name) values($1,$2)', [
      id,
      'Consenting visitor',
    ]);
    for (const expected of [true, true, false]) {
      const r = await db.query<{ consume_rate_limit: boolean }>(
        'select public.consume_rate_limit($1,$2)',
        ['hashed-test-key', 2],
      );
      assert.equal(r.rows[0].consume_rate_limit, expected);
    }
    for (const role of ['anon', 'authenticated']) {
      await db.exec('reset role; set role ' + role);
      const r = await db.query<{ name: string }>('select name from public.participants');
      assert.deepEqual(r.rows, [{ name: 'Consenting visitor' }]);
      await assert.rejects(
        db.query('select * from public.simulation_sessions'),
        /permission denied/,
      );
      await assert.rejects(db.query('select * from public.request_limits'), /permission denied/);
      await assert.rejects(
        db.query("select public.consume_rate_limit('test',2)"),
        /permission denied/,
      );
      await assert.rejects(
        db.query('insert into public.participants(id,name) values($1,$2)', [
          '00000000-0000-4000-8000-000000000002',
          'Unconsented name',
        ]),
        /permission denied/,
      );
      await assert.rejects(db.query('delete from public.participants'), /permission denied/);
    }
    await db.exec('reset role; set role service_role');
    await db.query('delete from public.simulation_sessions where id=$1', [id]);
    assert.equal((await db.query('select * from public.participants')).rows.length, 0);
  } finally {
    await db.close();
  }
});
