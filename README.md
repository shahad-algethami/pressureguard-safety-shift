# PressureGuard AI — The Safety Shift

Independent Next.js / TypeScript / Tailwind / Supabase educational experience. Start with **[SETUP_GUIDE.md](SETUP_GUIDE.md)** for the complete Arabic beginner guide, exact keys, SQL setup, testing and Vercel deployment.

## Run

```powershell
npm.cmd ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm.cmd run dev
```

Routes: `/` welcome, `/review` four progressive tasks, `/complete` personalized results, `/shift-wall` opt-in participation, `/wall` standalone exhibition. Original palette, fonts, patient SVG geometry and organic network are retained. Original source backup: `artifacts/pre-refinement-source.zip` (no secrets/data).

## Integrations

New Supabase project: run `supabase/migrations/001_pressureguard.sql` once, then `002_observations_and_requests.sql`. Existing project with 001 applied: run only additive migration 002. Sessions and requests are private. Only consenting names are publicly readable. Final submission uses an atomic PostgreSQL function, version checking and a unique session constraint. Consent names are upserted by session ID. Realtime plus polling refreshes the existing wall.

Set `.env.local` from `.env.example`: Supabase URL, publishable/anon key, server secret/service_role key, OpenAI key/model and canonical APP_ORIGIN. Restart after edits. Production requires Supabase; keep ALLOW_LOCAL_DEMO=false. Local JSON persistence is a single-process development fallback, not serverless storage.

**A real OpenAI key is required to complete note review and request preparation.** Missing credentials provide clearly labeled scripted guidance, but cannot manufacture note approval or completion. The Responses API uses read-only tools for proactive guidance and structured outputs for semantic note review. An independent second model pass audits generated wording; server code checks schema, exact quoted provenance, allowed evidence/source mappings and workflow prerequisites. These checks reduce errors but do not make semantic model judgments infallible. Rehearse varied real API responses before the exhibition.

Original observation, draft, review history, suggested wording, approved text and request are stored separately. Only the latest successfully reviewed exact text or verified suggestion can be approved. Edits require another review. No model can approve readiness, alter source records or skip the explicit safe decision and confirmation. Pending Verification remains invariant after completion.

Fictional case remains unchanged: Omar Abdullah Al-Harbi, PG-2048; laparoscopic cholecystectomy. Admission: no known drug allergies. Anesthesia: patient-reported penicillin rash. Neither source is independently confirmed. Identity and procedure comparisons are deterministic. Documentation consistency is not proof of informed consent or surgical clearance.

## Validation

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
```

E2E runs Edge desktop and iPhone-sized Chromium, a test-only provider on port4011 and isolated Next server on3002 (`.next-e2e`, `.local-data/e2e`). The test fixture is never used by production. `PG_BUILD_DIR`, `PG_DATA_DIR`, and `OPENAI_BASE_URL` are server-only test overrides; leave them unset for ordinary operation. See [VALIDATION.md](VALIDATION.md) for results and limits. External live OpenAI, hosted Supabase/Realtime and Vercel were not tested without account credentials.

Security: HttpOnly token cookie, stored token hashes, eight-hour sessions, strict same-origin mutations, Zod validation, private RLS tables, server-only secrets, bounded requests and optimistic concurrency. Display names and fictional note context are sent to OpenAI when enabled (`store:false`; provider retention policies still apply). No real patient data. Names are public only after explicit consent and removable from the active session. Set event retention policy before collecting names.

This is a selected educational subset of [WHO surgical safety principles](https://www.who.int/teams/integrated-health-services/patient-safety/research/safe-surgery), not the entire checklist or a clinically validated medical device. Airway, anesthesia equipment, pulse oximetry, blood loss, time-out and sign-out remain outside this short activity. Requests never contact a real clinical team.
