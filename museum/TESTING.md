# World Museum — test report, 19 November 2026

Application commit: `003b0df`, based on current main `98afe40`. Later documentation commits do not change the tested application.

Draft PR: https://github.com/jyrkijarvi-pixel/aimes-fi/pull/21

Tested immutable preview:

- Finnish: https://952a3174.aimes-fi.pages.dev/museum/?lang=fi
- English: https://952a3174.aimes-fi.pages.dev/en/museum/?lang=en

## Passed checks

- Museum automated tests: 4/4. Existing Finna regression tests: 5/5. Pages Functions compilation and `git diff --check` passed.
- Published preview API: all eight subject entry points, Apollo 11, a second Apollo page, repeated cached search, Titanic, an empty result, guided entry and invalid input were exercised.
- Published preview in the user's installed Edge: live search, five initially visible loaded CC0 photographs, image enlargement, next image, original metadata/rights, FI → EN → FI navigation with query preservation, Show more (12 → 24 records), and returning to the existing map and back.
- Apollo 11's embedded Smithsonian Voyager loaded, rendered the command module interior and responded to a mouse drag. Closing the object dialog removed the iframe. This is actual browser rendering, not an inference from the API's 3D flag.
- Edge's 390 px viewport override: FI and EN views had a single card column and no horizontal overflow (375 px content width within a 390 px viewport). The override was reset afterward. These are emulated widths, not physical-phone tests.
- Earlier local Chrome automation covered FI/EN at 1440 and 390 px, empty results, simulated provider outage with localized errors, dialog Escape behavior and deferred 3D loading. It reported no parent-page JavaScript exceptions. Its external image/frame response failures did not reproduce in the installed Edge against the published preview; they remain a limitation of that headless test environment, not evidence of successful Chrome media rendering.
- Regression smoke test in Edge: Punkalaidun search returned a location, selected the place on the map, displayed English Wikipedia information, nearby places and 24 Commons images. The existing gallery controls became available. No old search algorithm was changed.
- Existing FI/EN map pages, eras pages, Helsinki photo page, stories/radio application pages and Office pages returned HTTP 200 in the same preview. HTTP availability is not a full functional test of every old feature. Radio audio, publishing stories and Office actions were not exercised.

## Live API sample

These are Smithsonian index matches, not counts of guaranteed relevant CC0 media. Each first page contains at most 12 records. The subject buttons use curated discovery terms, not an exhaustive taxonomy.

| Search | Index matches | First-page records with CC0 images | First-page records with CC0 3D |
|---|---:|---:|---:|
| Space exploration | 98 | 10 | 0 |
| Aviation | 1,735 | 0 | 0 |
| Science and inventions | 3,623 | 1 | 0 |
| History and culture | 379,269 | 1 | 0 |
| Art | 130,090 | 6 | 0 |
| Natural history | 2,193 | 0 | 5 |
| Historical maps | 901 | 0 | 0 |
| 3D museum objects | 1,937 | 0 | 12 |
| Apollo 11 | 139 | 6 | 1 |
| Titanic | 94 | 3 | 0 |

A separate 15-request HTTP probe of the published endpoint consumed **12 upstream Smithsonian requests**. Guided entry and invalid input made no provider call; repeating Apollo returned from cache with zero new provider calls in approximately 22 ms. The 12 uncached samples took 315–2061 ms end to end (median about 894 ms). This is a small sample, not a load test or latency guarantee. Local preparation and browser interactions are additional tests, not included in that 15-request measurement.

## Authentication and secret handling

The earlier Wrangler failures had two observed causes in its local log: certificate-chain verification failure (`UNABLE_TO_VERIFY`) and permission failure (`EPERM`) while updating local authentication data. A process-scoped `--use-system-ca` option made Node use the already trusted Windows certificate store; narrowly granting access to Wrangler's own local login directory allowed credential refresh. No certificate was installed, TLS verification was not disabled, and no Windows/Cloudflare security policy was weakened. No further OAuth/login loop was needed.

Official Node explanation: https://nodejs.org/learn/http/enterprise-network-configuration

`SMITHSONIAN_API_KEY` was added as `secret_text` to **Pages Preview only**. Production variables, configuration, production branch, domains and canonical production deployment were fingerprinted before and after: unchanged. The existing local key file was not copied into the repository or deployment directory. New public application files and the staged deployment were scanned for the exact private key; zero occurrences. Published API response bodies were also checked without printing the key; no match. Browser calls go to AIMES's own endpoint, which sends the key upstream only in the server-side X-Api-Key header.

The first direct-upload preview contained static pages without its function bundle; this was detected by a real API request and replaced with the correctly compiled Functions deployment above. It is not the preview supplied for review. No production deployment or merge was made.

## Known limitations

- Subject searches and free-text relevance are imperfect. For example, Apollo 11 can also return art about the mythological Apollo. Selecting a subject helps exploration but does not certify every match's meaning.
- Some records have metadata only, despite an Images index flag. They correctly display source links. The sampled maps and aviation first pages contained no permitted image previews; broader coverage and ranking are not claimed.
- Original titles, descriptions and field labels retain the provider's language. AIMES controls/errors are FI/EN; the external Voyager UI can remain English.
- 3D and high-resolution images can use substantial bandwidth. 3D loads only on explicit request. Only the Apollo interior viewer was exercised interactively; every one of the 1,937 indexed 3D results was not tested.
- Physical mobile devices, screen readers, comprehensive accessibility testing, audible radio playback and load testing were not performed. WebGL/browser support and Smithsonian availability can vary.
- Per-isolate throttling and distributed caches are best-effort protections, not a global hard API-budget ceiling. The provider's key quota is shared. No new paid service, namespace or dependency was introduced.

All existing features are retained. The draft remains subject to owner review; production publication requires separate explicit approval.
