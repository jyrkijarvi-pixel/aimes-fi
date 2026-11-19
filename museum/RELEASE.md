# Owner-approved release procedure — NOT executed in production

The module and all existing UI/routes remain on PR #21. Production is still the successful deployment `e3805c76-ea0c-475b-8418-7b95c034f1cf`, commit `98afe40dc888e35517ecaa07c21a7c7772661251` (18 November 2026).

## Free-plan requirement

On 19 November 2026 the authenticated Cloudflare Billing → Subscriptions view showed **Workers Free / Active** and **aimes.fi Free Plan / Active**. No Upgrade, subscription or payment action was used. Domain registration renewal is separate from these hosting plans.

The protection uses one SQLite singleton in D1, without a new npm dependency or a paid service. The preview has its own free guard database and does not use production's story database. For production the existing D1 database can host the independent guard table, using a separate `MUSEUM_GUARD` binding to that same database. No story table or existing binding needs replacing. At the 600/day provider-attempt cap, normal guard writes are a small fraction of D1 Free's 100,000-row daily write allowance; requests still consume free Workers/D1 quotas. Exceeding free quotas can interrupt services, but no automatic paid upgrade is authorized.

References: [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/), [D1 Free limits](https://developers.cloudflare.com/d1/platform/pricing/).

## Before publishing — requires separate owner approval

1. Verify Workers Free and aimes.fi Free are still active. Do not subscribe to anything paid.
2. Retire old **unguarded** museum previews, or obtain a separate free production Smithsonian key. An old immutable preview can retain its own secret binding; changing only the latest branch does not protect its endpoint. **No old preview was deleted in this preparation task.** Never remove the known-good production deployment.
3. In the existing production D1 database, execute `museum/guard.sql` once. This creates only `aimes_museum_guard` with `enabled=0`; it does not alter story tables or reset an existing row. Add the production `MUSEUM_GUARD` D1 binding to that database, preserving `DB` and every other binding.
4. Add `SMITHSONIAN_API_KEY` as a **Production secret_text** binding before the deployment. Read it from the external private file; never paste it in GitHub, a terminal command argument, source files or client code. Preserve all existing production variables. The preview secret alone does not configure production.
5. Merge/deploy only the owner-approved commit, using Pages' complete Functions build and `_routes.json`. Until step 6, guided entry works but museum searches remain disabled. Check FI/EN routes, the old map/services, and that API errors expose no secrets.
6. Enable the museum in Cloudflare D1's authenticated console:

   ```sql
   UPDATE aimes_museum_guard SET enabled=1 WHERE id=1;
   ```

7. Smoke-test one live search, image enlargement, one 3D object and a cached repeat. Read the counters to check that only the uncached source request was charged. Check an actual phone before announcing broad availability. Phone hardware was not tested by the agent.

## Emergency stop — no redeployment or API key exposure

In the **production guard database's authenticated Cloudflare D1 console** run:

```sql
UPDATE aimes_museum_guard SET enabled=0 WHERE id=1;
```

The next new museum search, including cache hits, returns a localized unavailable/configuration message without a Smithsonian request. Other provider functions do not consult this row. Guided museum entry still opens. Already displayed images/3D frames are not remotely removed from visitors' browsers, and requests already sent upstream cannot be recalled.

To re-enable after investigation, set `enabled=1`. Do **not** clear the counters or `retry_until`. If D1 is unavailable the server fails closed; it never ignores the guard. Access to this control uses existing Cloudflare administrative authentication; no public admin endpoint was added.

Inspect without changing state:

```sql
SELECT enabled,hour_key,hour_used,hour_limit,day_key,day_used,day_limit,retry_until
FROM aimes_museum_guard WHERE id=1;
```

Limits are 200/UTC hour and 600/UTC day; SQL constraints prevent raising those caps accidentally through this row. Cache hits use no provider credit. Small in-flight requests may complete after stopping. Switching off does not stop inbound HTTP requests from reaching Cloudflare, so account-level flooding remains a shared-quota risk.

## Restore the previous production application

1. Stop the museum with the SQL above, if available.
2. In Pages → aimes-fi → Deployments, select the previous successful **production** deployment recorded at the top and choose **Rollback to this deployment**. Preview deployments are not rollback targets. This affects the whole application, so confirm the selected deployment carefully.
3. Check the world map, historical search, stories/radio and Office. Check project secrets/bindings separately; do not assume a code rollback restores every project setting.
4. Prevent the same change returning at the next build by making an owner-reviewed Git revert if needed. A Pages rollback does not revert Git main. Do not drop the story database or the guard table.

No database content migration is needed to undo the museum. Production rollback was documented, not executed in this task. Official [Pages rollback documentation](https://developers.cloudflare.com/pages/configuration/rollbacks/).
