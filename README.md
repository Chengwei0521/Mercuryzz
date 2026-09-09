# Mercury Observatory

A public, interactive Mercury observatory at [mercuryzz.com](https://www.mercuryzz.com).

## Local Development

Node.js 22.12+ or 24+. Install dependencies with `npm ci`, then run `npm run dev`.

`npm run build` creates `dist/`. Vercel builds and publishes this directory on pushes to `master`.

## Experience

- Three.js globe with spacecraft-derived surface texture, mouse/touch rotation, pinch zoom, and animated coordinate flights.
- Surface, Nightfall, and Contours views. Contours are an artistic visualization of image brightness, not scientific elevation data.
- Public messages pinned to coordinates, persistent in Supabase and delivered across browsers with Realtime.
- Frequency filters, search, individual signal links, composition drafts retained on failure, and explicit offline/retry states.
- Opt-in synthesized ambient audio, observation PNG export, focus view, and reduced-motion support.

## Data

Supabase project: `jgigvgysiykcyclxvjpn`. Table: `public.observatory_signals`.

The frontend uses a publishable key, not a privileged server key. RLS and column grants permit public reads and bounded inserts only. Visitors cannot update/delete messages, forge opening-log badges, or supply timestamps. Database constraints enforce message length and coordinate bounds. A transaction lock serializes insert quotas: 3 signals per visitor per minute, 20 total per minute, and 500 total per day. Visitor IDs are browser-generated convenience limits, not identities; the global limits bound total inserts.

The three opening logs are explicitly marked as observatory entries. The feed and globe display the latest 100 signals. Exact total counts come from the database. Realtime reconnects are reconciled with fresh reads; visible tabs also reconcile every 45 seconds.

The schema was applied through the connected Supabase account as migration `create_observatory_signals`. Existing `public.messages` test data is untouched. `database/observatory.sql` documents the application schema.

## Verification

`npm test` checks coordinate round-trips and input boundaries.

`scripts/verify-browser.mjs` exercises desktop/mobile rendering, nonblank canvas pixels, view modes, drag and touch input, search, dialogs, downloads, and recovery from an API outage. It requires Playwright and a Chrome executable; set `PLAYWRIGHT_MODULE` and `CHROME_PATH` when they are outside the normal install paths. `VERIFY_URL` targets a deployed build. `VERIFY_WRITE=1` additionally creates one temporary signal to check cross-tab delivery, reload persistence, and shared links. The ID is recorded in `artifacts/verification.json`; remove only that test row afterward using the project database tools. The default does not write to the database.

## Credits

- Mercury texture: [Solar System Scope](https://www.solarsystemscope.com/textures/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The source image is unchanged; rendered lighting, relief and color treatment vary by view.
- Planetary facts: [NASA Mercury Facts](https://science.nasa.gov/mercury/facts/).
- Space Grotesk and IBM Plex Mono: self-hosted through Fontsource, SIL Open Font License.
- Three.js, GSAP, Lucide, Supabase JS and Vite: exact versions in `package.json` and `package-lock.json`.

Nightfall is a lighting study, not a live ephemeris. Signals are a guestbook on a digital planet, not real spacecraft transmissions.
