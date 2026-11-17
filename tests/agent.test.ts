import test from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import { runAgent } from '../lib/agent';
import { initialProgress, type Session } from '../lib/simulation';

test('real SDK function-call loop grounds facts, preserves history, and has no write tool', async () => {
  const requests: Record<string, unknown>[] = [];
  const s: Session = {
    id: 'test',
    tokenHash: 'NEVER-SEND-THIS',
    name: 'Sara',
    lang: 'en',
    createdAt: new Date().toISOString(),
    progress: initialProgress(),
    aiCalls: 0,
  };
  const original = JSON.stringify(s);
  const client = new OpenAI({
    apiKey: 'test-only',
    maxRetries: 0,
    fetch: async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      requests.push(body);
      const turn = requests.length;
      const names =
        turn === 1
          ? ['read_patient_records']
          : turn === 2
            ? ['compare_records']
            : turn === 3
              ? ['get_readiness', 'draft_handoff']
              : [];
      const output = names.length
        ? names.map((name) => ({
            type: 'function_call',
            id: 'fc_' + name,
            call_id: 'call_' + name,
            name,
            arguments: '{}',
            status: 'completed',
          }))
        : [
            {
              type: 'message',
              id: 'msg_1',
              role: 'assistant',
              status: 'completed',
              content: [
                {
                  type: 'output_text',
                  text: 'Compare the two records. The allergy remains Pending Verification.',
                  annotations: [],
                },
              ],
            },
          ];
      return new Response(
        JSON.stringify({
          id: 'resp_' + turn,
          object: 'response',
          created_at: 1,
          status: 'completed',
          output,
        }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    },
  });
  const result = await runAgent(client, s, 'Help me review', 'gpt-4.1-mini');
  assert.equal(requests.length, 4);
  assert.equal(requests[0].tool_choice, 'required');
  assert.equal(requests[3].tool_choice, 'none');
  assert.ok(requests.every((r) => r.store === false));
  assert.deepEqual(result.tools, [
    'read_patient_records',
    'compare_records',
    'get_readiness',
    'draft_handoff',
  ]);
  assert.match(result.text, /Pending Verification/);
  const serialized = JSON.stringify(requests);
  assert.ok(!serialized.includes('NEVER-SEND-THIS'));
  assert.ok(serialized.includes('Penicillin'));
  assert.ok(serialized.includes('patient-reported'));
  assert.equal(JSON.stringify(s), original);
  assert.deepEqual(
    (requests[0].tools as { name: string }[]).map((t) => t.name),
    result.tools,
  );
  const history = requests[3].input as { type: string; name?: string; output?: string }[];
  assert.equal(history.filter((x) => x.type === 'function_call_output').length, 4);
  assert.ok(history.some((x) => x.output?.includes('clinicalMessageSent')));
});

test('Arabic agent prompt is localized and an unknown model tool cannot mutate readiness', async () => {
  let n = 0;
  const s: Session = {
    id: 'test',
    tokenHash: 'secret',
    name: 'سارة',
    lang: 'ar',
    createdAt: new Date().toISOString(),
    progress: initialProgress(),
    aiCalls: 0,
  };
  const client = new OpenAI({
    apiKey: 'test-only',
    fetch: async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.match(body.instructions, /natural Arabic/);
      n++;
      if (n === 2) assert.ok(JSON.stringify(body.input).includes('Unknown tool'));
      const output =
        n === 1
          ? [
              {
                type: 'function_call',
                id: 'fc_invalid',
                call_id: 'call_invalid',
                name: 'approve_patient',
                arguments: '{}',
                status: 'completed',
              },
            ]
          : [
              {
                type: 'message',
                id: 'msg_ar',
                role: 'assistant',
                status: 'completed',
                content: [
                  { type: 'output_text', text: 'تبقى الحالة بانتظار التحقق.', annotations: [] },
                ],
              },
            ];
      return new Response(
        JSON.stringify({ id: 'resp_' + n, object: 'response', status: 'completed', output }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    },
  });
  const result = await runAgent(client, s, undefined, 'gpt-4.1-mini');
  assert.match(result.text, /بانتظار التحقق/);
  assert.equal(s.progress.identityVerified, false);
  assert.equal(s.progress.completed, false);
});
