# AIMES 2.0 — limited prototype

Branch: `feature/aimes-2-prototype`. Based on main `0e1cbb326f483430df32405a485a26963620b099`. Draft review only: no merge or production release is authorized.

## Scope

One shared additive navigation shell links Map, History, Museum and More on existing FI/EN pages. Original page controls and IDs remain in the DOM for compatibility. Map/history/museum links pass a bounded, validated research context in URL parameters (`jname`, `jlat`, `jlon`, `jarticle`, `jcountry`, `jperiod`). No visitor profile or server-side journey storage is introduced. An explicit journey link restores the existing page search once, bypassing repeated geocoding where coordinates are already known. Direct searches still use the original handlers. Leave research trail clears the context while keeping the current service usable.

The historical page and museum retain their current search algorithms, sources, batches and rights checks. A museum keyword match is explicitly not geographical provenance. The museum can open the curated Apollo object from its existing bounded search response; loading 3D still requires a separate action.

Provider Functions, API key handling, D1 schemas/bindings, quota guard, emergency switch, routes, production settings and subscription tiers are unchanged. No new runtime package, paid service, scheduled job or external font is added.

## Daily discoveries

The home page imports only a static three-item catalogue and local WebP previews. There is no collection API request on an ordinary empty home-page load or when changing the preview selector. The selection is deterministic for the Finnish calendar day (`Europe/Helsinki`), including daylight-saving transitions. An open page updates on the next minute check or when it becomes visible again. It is a rotating checked selection, not an automatic daily discovery crawler.

Preview controls appear only on localhost, or a branch/hash `*.aimes-fi.pages.dev` URL with `?preview=1`. `aimes.fi`, `www.aimes.fi` and `aimes-fi.pages.dev` cannot enable them. Final production approval must include reviewing this gate; no preview environment setting is required.

Sources and media rights checked on 24 November 2026:

1. Arvo Kajantie, Kolera-allas/Kauppatori, **1950–1959**, Helsinki City Museum. [Finna record](https://hkm.finna.fi/Record/hkm.87455276-66CB-47DF-98AF-DF2A3EA7C062): image PDM. Reuses the existing local archival photograph. Its precise year is unknown; the existing photo-depth interpretation remains labelled.
2. Michal Pise, Suomenlinna from a ferry, **7 June 2005**, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Suomenlinna_(cropped).jpg), **CC BY 2.0**. Attribution retained. The map point is the source photograph's coordinates (60.137222, 24.991389), not an invented fortress-centre coordinate.
3. Apollo 11 Command Module Columbia, [National Air and Space Museum source](https://n2t.net/ark:/65665/nv9ce74610f-62de-46b6-904f-58abfecb555c). The existing guarded API returned media-specific **CC0** for `NASM-A19700102000-NASM2016-04272` and the Voyager models. 1969 identifies the Apollo 11 mission, not the photograph's capture year. Original image URL: `https://ids.si.edu/ids/deliveryService?id=NASM-A19700102000-NASM2016-04272`.

Previews are resized WebP derivatives (25–42 kB each), with the change stated beside the credits. Existing home-card previews also use smaller/lazy images instead of eagerly loading a 2 MB archival original. Existing source links and the larger original remain available.

## Validation and limits

Initial local validation: 19/19 tests passed (`aimes2`, existing Finna, museum and shared guard suites); JavaScript syntax checks passed. New tests cover Finnish midnight/DST, three-day rotation, production-host preview gating, research-context round trips and catalogue rights/image budget. The existing tests use synthetic providers/guard state and do not alter production databases.

Local Edge: original map search was tested, plus Punkalaidun → history (45 records in this bounded sample) → museum (one keyword result) → same map point. Browser/preview test completion is recorded in the final PR report. Counts depend on upstream availability and are not claims of exhaustive coverage.

Physical Android testing has not been performed. Existing historical-search coverage limits, source-language museum descriptions, source metadata uncertainty and large external 3D payloads remain. This prototype does not implement the whole earlier development plan or repair unrelated legacy issues. Production remains unchanged until separate owner approval.
