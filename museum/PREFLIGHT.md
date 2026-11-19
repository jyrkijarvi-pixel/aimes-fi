# Release preparation — 19 November 2026

This follow-up supersedes the earlier best-effort quota protection described in the initial test report. No merge or production deployment was performed.

## Cost verification

The authenticated Cloudflare Billing → Subscriptions view showed **Workers Free — Active** and **aimes.fi Free Plan — Active**. The inspection was read-only; no subscription, upgrade, payment or security setting was changed. The earlier billing API returned 403, so its absence of data was not treated as proof of a free plan.

One dedicated **free** D1 database was created for preview guard tests, bringing the account's D1 database count from two to three, below the Free plan database-count limit. Production's existing database and bindings were not modified. Production can use its existing D1 database for the independent singleton after owner approval; no new production subscription or package is needed. There is no KV, Durable Object, scheduled job, paid rate-limit service or new npm dependency.

Free quotas remain finite: exhaustion can stop requests rather than create a paid allowance. The plan must stay Free; an upgrade is not authorized. Domain registration/renewal is separate from these hosting costs.

## Protection implemented

- A single shared D1 row reserves attempts atomically before calling Smithsonian: **200 attempts per UTC hour, 600 per UTC day**. Failed upstream attempts also consume credit; cache hits do not. All instances/locations using that binding consult the same budget. A fixed-hour boundary can allow 400 in a rolling hour.
- A transient supplementary IP limit is now **5 requests/minute per isolate**, including cache hits. It is not advertised as a globally coordinated IP limit.
- The global `enabled` switch is checked before cached results are served. Set it to zero through authenticated Cloudflare D1 administration to stop new museum searches without a deployment. Re-enabling does not clear counters.
- Missing/disabled guard, missing table or D1 outage fails closed. It never bypasses accounting to call Smithsonian. A provider 429 stores its Retry-After cooldown in the same shared row.
- The existing 12-record batches, explicit Show more, 15-minute caches, request coalescing, 10-second provider timeout, CC0 rules and UI layout remain. Only the disabled-message text was made suitable for both preview and production.

## Tests completed

**15/15 automated tests passed**: ten museum/guard tests and five existing Finna regression tests. The guard tests execute the real SQL in in-memory SQLite, not a mock that merely repeats the implementation. They cover simultaneous reservation attempts, period reset, hourly/daily limits, disabled default, missing binding, database outage, shared cooldown, cached-response shutdown and cache-inclusive IP limiting. Pages Functions build and diff whitespace checks passed.

Live test against application commit `88a5dc8`:

https://e168e414.aimes-fi.pages.dev/museum/?lang=fi

| Scenario | Observed result |
|---|---|
| Real Apollo 11 search | HTTP 200, 12 records, one upstream request, 1671 ms |
| Same search repeated | HTTP 200, cached, zero upstream requests, 68 ms; shared counter unchanged |
| Emergency stop, same cached search | HTTP 503, disabled state, 54 ms; shared counter unchanged |
| Map during emergency stop | HTTP 200; existing map HTML present |
| Re-enable, same search | HTTP 200, cached, zero upstream requests, 57 ms |
| Temporarily exhausted shared hour budget | HTTP 429 with Retry-After 2546 s; no new provider attempt |
| Sixth same-IP request, including cache hits | HTTP 429, Retry-After 60 s |

The tests used **one** real Smithsonian API call. Preview guard settings were restored to enabled, 200/hour and 600/day; the used-credit counter was preserved. Production was not used for these tests. Secret scanning of the deployment directory passed; live response bodies did not contain the private key.

The guarded preview was also checked in installed Edge: FI and EN each displayed 12 results at 390 px, with 375 px content width and no horizontal overflow. Five visible photographs loaded, language switching retained Apollo 11, and the enlarged image dialog opened. The temporary viewport override was reset. These are browser emulation checks, not physical-phone tests. The shared counter still showed one provider attempt after these cached browser checks.

## Release and residual risks

The safe activation, emergency-stop and previous-version rollback procedures are in [RELEASE.md](RELEASE.md). Production's key and guard binding have deliberately not been added or enabled yet. Its configuration fingerprint and canonical production deployment remained unchanged.

Before release, retire older unguarded museum previews or obtain a separate free production API key. No old deployment was deleted during this task. The new counter cannot account for other applications or older deployments that do not use it. A separate preview budget and production budget also need to be considered together if sharing one provider key.

The account's free Workers/D1 quotas are shared with other services. This simple guard protects upstream usage and ordinary hobby traffic; it cannot promise immunity to distributed volumetric flooding. No per-visitor/search data is persisted in the counter table. Already loaded pictures/viewers and already in-flight upstream requests cannot be recalled by the stop switch.

Physical-phone testing, radio audio, a production rollback rehearsal and adversarial load testing were not performed. UI/3D behavior from the preceding live Edge tests remains documented in [TESTING.md](TESTING.md). The museum layout and normal controls were not rebuilt in this follow-up.
