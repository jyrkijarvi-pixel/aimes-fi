# AIMES World Museum 1.0

An isolated Smithsonian collection browser at `/museum/` and `/en/museum/`. The existing map, historical photo search, Finna, Commons, Wikipedia, stories, radio, Office and Helsinki experience retain their implementations. The homepage navigation gains one link.

## Runtime

`functions/museum/api/search.js` serves `GET /museum/api/search?q=...&topic=...&start=...`. The optional topic is one of `space`, `aviation`, `science`, `history`, `art`, `nature`, `maps`, `models`. At least a query or topic is needed: an empty entry makes no upstream request. Subject buttons use discovery terms, not exhaustive museum classifications. Free-text searches are not translated; collection metadata is normally English.

The server needs a **secret binding** named `SMITHSONIAN_API_KEY` and a D1 binding named `MUSEUM_GUARD`. Never add a key to HTML, client JavaScript, source control, a build argument, an upstream URL or a static deployment folder. For preview review, configure these in **Pages Preview only**, preserving existing bindings and production configuration. The guard schema is in `museum/guard.sql` and starts disabled. No paid service or new package dependency is required. Production activation remains a separate owner decision; see [RELEASE.md](RELEASE.md).

One uncached search requests 12 records. Pagination advances by 12, up to start=240; the UI then asks users to refine the search. In-memory caching and in-flight coalescing are bounded to 128 cached queries, with 15-minute TTL. Cloudflare's existing Cache API provides a 15-minute edge cache without a new KV namespace. Search normalization and UI language do not create separate upstream cache entries. Failed responses are not cached. A cache failure falls back to the provider; an upstream failure returns a museum-specific error.

The shared D1 singleton atomically reserves each upstream attempt, including failed attempts: **200 per UTC hour and 600 per UTC day**, across all isolates/locations using that guard database. A UTC-hour boundary can permit up to 400 in a rolling hour. Counters do not reset when the switch is re-enabled. Cache hits consume no upstream credit. Every non-guided search checks the primary D1 control row before serving cached data, so setting `enabled=0` stops new search responses without a deployment. Missing binding/table, disabled guard or D1 failure stops Smithsonian calls rather than bypassing protection. Provider Retry-After is shared in the same row.

An additional limit of 5 requests/minute/IP **per running isolate** covers cache hits as well as misses. This is best-effort supplementary protection, not global per-IP enforcement. IPs stay only in a bounded transient map; D1 stores no IPs, search terms or visitor records. The 10-second upstream timeout, cross-origin browser-request checks and explicit-only searches remain. Inbound Function traffic still consumes the account's shared free Workers quota. Distributed flooding cannot be eliminated by this application guard. Older unguarded deployments and other applications using the same provider key are outside its budget; retire those previews or use a separate production key before launch.

The authenticated Cloudflare Billing UI was checked on 19 November 2026: **Workers Free — Active; aimes.fi Free Plan — Active**. A single dedicated free preview guard database was added; no paid plan, new package, KV namespace or production database change was made. Free-tier exhaustion can interrupt service; it must not be solved by silently upgrading to a paid plan.

## Content and rights

Only each media item's `usage.access === 'CC0'` permits previews or the embedded 3D viewer. Metadata CC0 alone never authorizes images. Objects with no permitted media remain source links. Original date/place labels, creators' roles, donor credits and rights are preserved. Object manufacture, photographic capture, later prints and specimen collection dates are not merged into one invented year. The museum does not change the historical-era algorithm.

Image failures try the other approved URLs for that same media item before showing an explanation and original-source link. Images can be enlarged, and object detail dialogs can navigate available CC0 images. Only validated Smithsonian image hosts and `3d-api.si.edu/voyager/3d_package:UUID` viewer addresses are accepted. Provider titles/notes are rendered as text, never as HTML.

3D is embedded using the [official Voyager iframe approach](https://smithsonian.github.io/dpo-voyager/explorer/usage/), only after a separate user action. Closing the dialog removes the iframe and stops its activity. It is a cross-origin Smithsonian service with sandbox restrictions and a direct-viewer fallback. It may use substantial bandwidth and require WebGL; its own controls are not translated by AIMES. API metadata does not prove successful 3D rendering on a particular device. The page's CSP allows only the necessary Smithsonian image/frame hosts.

Descriptions and original field labels stay in the source language; AIMES controls, guidance, errors and navigation are FI/EN. The shared language preference and explicit language URLs remain in use. Search state is retained when switching museum language.

## Validation

Run `node --test tests/museum.test.mjs` and `node --test tests/finna.test.mjs`. Museum tests cover guided entry, pagination bounds, literal query handling, media rights versus metadata rights, media/viewer URL validation, date/place-role preservation, request coalescing, caching, timeouts, upstream errors, cooldown, method/origin guards and secret-free errors. They use a fake key and synthetic responses; live-provider/browser checks are documented in the PR separately.

Official provider documentation: [Developer Tools](https://www.si.edu/openaccess/devtools), [rights FAQ](https://www.si.edu/openaccess/faq). The preceding feasibility test informed the design but its snapshots are not presented as live search results.
