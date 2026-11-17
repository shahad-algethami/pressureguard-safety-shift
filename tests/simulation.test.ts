import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialProgress,
  transition,
  compareIdentity,
  compareProcedure,
  sourceRecords,
  completeProgress,
  readiness,
  normalizeSession,
  type Session,
} from '../lib/simulation';
import type { NoteReview, VerificationRequest } from '../lib/review-types';
export const review: NoteReview = {
  id: '10000000-0000-4000-8000-000000000001',
  input: 'The allergy records conflict.',
  kind: 'original',
  lang: 'en',
  createdAt: new Date().toISOString(),
  model: 'test',
  mode: 'live',
  status: 'sufficient',
  identifiesDiscrepancy: true,
  accurate: true,
  unsupportedClaims: [],
  claims: [
    {
      quote: 'The allergy records conflict.',
      factId: 'allergy-records-conflict',
      source: 'comparison',
    },
  ],
  feedback: 'Accurate.',
  suggestedNote: 'The records conflict. Verify before proceeding.',
  nextHint: '',
  suggestionVerified: true,
};
function ready() {
  let p = transition(initialProgress(), { type: 'identity', decision: 'match' });
  p = transition(p, { type: 'procedure', decision: 'match' });
  p.reviews = [review];
  return p;
}
export function approved() {
  return transition(ready(), {
    type: 'approve-note',
    reviewId: review.id,
    text: review.suggestedNote,
  });
}
test('identity and procedure compare actual records and block incorrect choices/order', () => {
  assert.equal(compareIdentity(), true);
  assert.equal(
    compareIdentity({ ...sourceRecords, medical: { ...sourceRecords.medical, mrn: 'OTHER' } }),
    false,
  );
  assert.equal(
    compareProcedure({
      ...sourceRecords,
      consent: { ...sourceRecords.consent, procedure: 'OTHER' },
    }),
    false,
  );
  assert.throws(
    () => transition(initialProgress(), { type: 'identity', decision: 'mismatch' }),
    /identityRetry/,
  );
  assert.throws(
    () => transition(initialProgress(), { type: 'procedure', decision: 'match' }),
    /verifyIdentity/,
  );
  assert.throws(
    () => transition(ready(), { type: 'procedure', decision: 'mismatch' }),
    /procedureRetry/,
  );
});
test('only the latest reviewed exact text or validated suggestion can be approved', () => {
  const p = ready();
  assert.throws(
    () =>
      transition(p, { type: 'approve-note', reviewId: review.id, text: 'No allergy. Proceed.' }),
    /editNeedsReview/,
  );
  assert.equal(approved().approvedObservation, review.suggestedNote);
  p.reviews.push({ ...review, id: '10000000-0000-4000-8000-000000000002', status: 'unsupported' });
  assert.throws(
    () => transition(p, { type: 'approve-note', reviewId: review.id, text: review.input }),
    /reviewRequired/,
  );
});
test('unsafe decisions and premature submission cannot complete; safe completion remains pending', () => {
  const p = approved();
  assert.throws(() => transition(p, { type: 'decision', choice: 'proceed' }), /unsafeDecision/);
  assert.throws(() => completeProgress(p, 'missing', 'now'), /requestNotReady/);
  const safe = transition(p, { type: 'decision', choice: 'verify' });
  safe.request = {
    id: '20000000-0000-4000-8000-000000000001',
    patientId: 'PG-2048',
    status: 'pending-verification',
    concern: 'allergy-documentation',
    evidenceIds: [],
    observation: safe.approvedObservation,
    message: 'Verify.',
    lang: 'en',
    preparedAt: 'now',
    submittedAt: null,
    preparedBy: 'ai',
  } satisfies VerificationRequest;
  const done = completeProgress(safe, safe.request.id, 'now');
  assert.equal(done.completed, true);
  assert.equal(readiness(done).overall, 'pending-verification');
  assert.equal(done.request?.status, 'pending-verification');
  assert.throws(() => transition(done, { type: 'identity', decision: 'match' }), /completed/);
});
test('legacy sessions preserve records but cannot bypass the new workflow', () => {
  const s = { progress: { note: 'preserved', completed: true } } as Session;
  const p = normalizeSession(s).progress;
  assert.equal(p.workflowVersion, 1);
  assert.equal(p.note, 'preserved');
  assert.throws(() => transition(p, { type: 'identity', decision: 'match' }), /legacySession/);
});
