import test from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import { commentOnObservation } from '../lib/agent';
import {
  initialProgress,
  transition,
  currentTask,
  readiness,
  actionSchema,
  type Session,
} from '../lib/simulation';
import { documentationFallback } from '../lib/smart-messages';

test('YES accepts any optional text without a review and preserves raw writing', () => {
  for (const text of [
    '',
    'The allergy records conflict.',
    'سجل الدخول يقول ما عنده حساسية، لكن تقييم التخدير يقول عنده حساسية من البنسلين.',
    'The patient is cleared and has no allergies.',
    '  original whitespace  ',
  ]) {
    let p = transition(initialProgress(), { type: 'identity', decision: 'match' });
    p = transition(p, { type: 'procedure', decision: 'match' });
    p = transition(p, { type: 'notice-discrepancy', noticed: true, text, lang: 'ar' });
    assert.equal(currentTask(p), 3);
    assert.equal(p.observationOriginal, text);
    assert.equal(p.observationDraft, text);
    assert.equal(p.reviews.length, 0);
    assert.equal(readiness(p).overall, 'pending-verification');
    assert.equal(p.approvedReviewId, 'visitor-discrepancy-acknowledgement');
    assert.ok(!p.approvedObservation.includes('cleared'));
    assert.equal(transition(p, { type: 'decision', choice: 'verify' }).safeDecision, true);
  }
});
test('YES still requires identity/procedure, NO cannot be posted as an acknowledgement', () => {
  assert.throws(
    () =>
      transition(initialProgress(), {
        type: 'notice-discrepancy',
        noticed: true,
        text: '',
        lang: 'en',
      }),
    /reviewFirst/,
  );
  assert.equal(
    actionSchema.safeParse({ type: 'notice-discrepancy', noticed: false, text: '', lang: 'en' })
      .success,
    false,
  );
});
test('documentation comments use one real SDK call, never validation, and no call for empty notes', async () => {
  for (const lang of ['en', 'ar'] as const) {
    let calls = 0;
    const s: Session = {
      id: 'test',
      name: 'Sara',
      lang,
      tokenHash: 'PRIVATE_TOKEN',
      aiCalls: 0,
      createdAt: 'now',
      progress: initialProgress(),
    };
    const before = JSON.stringify(s);
    const client = new OpenAI({
      apiKey: 'test-only',
      maxRetries: 0,
      fetch: async (_u, init) => {
        calls++;
        const b = JSON.parse(String(init?.body));
        assert.equal(b.store, false);
        assert.equal(b.tools, undefined);
        assert.equal(b.text, undefined);
        assert.ok(b.instructions.includes('Never approve, reject, grade'));
        assert.ok(!JSON.stringify(b).includes('PRIVATE_TOKEN'));
        assert.equal(JSON.parse(b.input).status, 'Pending Verification');
        return new Response(
          JSON.stringify({
            id: 'test',
            object: 'response',
            status: 'completed',
            output: [
              {
                type: 'message',
                id: 'msg',
                role: 'assistant',
                status: 'completed',
                content: [
                  {
                    type: 'output_text',
                    text:
                      lang === 'ar'
                        ? 'اطلب التحقق قبل الاعتماد على المعلومات.'
                        : 'Request verification before relying on the information.',
                    annotations: [],
                  },
                ],
              },
            ],
          }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      },
    });
    assert.equal(await commentOnObservation(client, s, '   ', 'test'), documentationFallback[lang]);
    assert.equal(calls, 0);
    await commentOnObservation(client, s, 'ملاحظة عامية', 'test');
    assert.equal(calls, 1);
    assert.equal(JSON.stringify(s), before);
  }
});
