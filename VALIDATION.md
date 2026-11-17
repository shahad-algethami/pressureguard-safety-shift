# Validation — 16 November 2026

The application was built and tested locally on Windows, independently of the original website.

| Check                                                           | Result                           |
| --------------------------------------------------------------- | -------------------------------- |
| Strict TypeScript check                                         | Passed                           |
| Next.js production build                                        | Passed                           |
| Deterministic safety tests                                      | 8 passed                         |
| OpenAI SDK tool-loop tests with mocked API responses            | 2 passed                         |
| PostgreSQL migration, RLS/grants, rate limits, cascade cleanup  | 1 passed in PGlite               |
| English complete journey, desktop and phone emulation           | Passed against production server |
| Arabic complete journey and RTL, desktop and phone emulation    | Passed against production server |
| API ownership, cross-origin rejection, shortcut prevention      | Passed against production server |
| Consent required, wall join, immediate withdrawal               | Passed                           |
| Captured browser JavaScript errors during English journeys      | None                             |
| Smartphone horizontal overflow at completion                    | None                             |
| Fullscreen exhibition display and reduced motion, desktop/phone | 2 browser tests passed           |

Screenshots in `artifacts/` were reviewed for the supplied visual identity, readable Arabic, responsive cards, patient room, results, and network. Exhibition screenshots use explicitly mocked test names, not actual participants. The official palette PDF was extracted and rendered; its colors and suggested fonts were applied. The shield mark was reconstructed from the screenshots because a separate logo asset was not supplied. In total, 11 unit/database/AI tests and 8 browser cases passed.

Live OpenAI account/model access, Supabase hosted connectivity, and cross-device Supabase Realtime were **not tested**, because no API key or Supabase credentials were supplied. The application includes the real integrations, environment template, migration, and setup instructions. Mocked AI tests verify SDK request structure, required tool calls, tool results, retained history, language selection, and lack of write/approval tools; they do not evaluate real model behavior.

Manual Computer Use was stopped by its safety check because it could not reliably determine the browser URL. Browser verification used the application's Playwright test suite and its screenshots.

No public deployment was made. Local production tests explicitly enabled `ALLOW_LOCAL_DEMO=true` on port 3001. Production hosting should use HTTPS and Supabase with that override disabled. The participant table used for local rehearsal is empty after tests.
