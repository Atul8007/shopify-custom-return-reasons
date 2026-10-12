# Build prompts: reusable "custom return reasons" module

These are the prompts, in order, for turning the working `custom-return-reasons` app into a
reusable **GitHub template** with an **in-app setup page**. That's the architecture we
recommended: no backend, no npm CLI at first.

**How to use this file**

- Run the prompts **in order**. Each one starts from the result of the one before.
- 🤖 **Code agent** = an AI coding assistant working in `C:\Shopify\Apps\custom-return-reasons`.
- 🌐 **Browser assistant** = an AI that clicks through Shopify admin and the customer account.
- Paste **"Shared context"** at the top of every 🤖 prompt.
- Never skip a ✅ checkpoint. If a checkpoint fails, stop and fix it before continuing.

---

## Shared context (paste before every 🤖 prompt)

```
PROJECT CONTEXT

Repo: C:\Shopify\Apps\custom-return-reasons
(GitHub: https://github.com/Atul8007/custom-return-reasons)
Shopify app, extension-only, no backend. API version 2026-07, Preact.

Customer account UI extension: extensions/custom-return-reasons/
- Targets: customer-account.order.action.menu-item.render (RequestReturnButton.jsx)
  and customer-account.order.action.render (RequestReturnModal.jsx)
- src/api.js: Customer Account API helper, order query, eligibility logic
- src/reasons.js: default reasons, settings getters, all customer-facing text
- shopify.extension.toml: api_access = true, 12 settings (return_window_days,
  final_sale_tag, return_fees_note, hide_refund_estimate, reason_1..reason_8)

App Home extension: extensions/app-home/ (currently Shopify's FAQ sample)
App config: shopify.app.toml, with [access.admin] embedded_app_direct_api_access = true

How it works today (MUST be preserved):
- Shopify self-serve returns is OFF, so Shopify's own "Return items" button is hidden.
- The button shows on paid or partially refunded, non-cancelled orders with items
  delivered (DELIVERED event) or fulfilled within the return window (default 30 days),
  excluding products tagged final-sale (Storefront API tags), minus quantities already
  requested. It also shows when earlier requests exist.
- The pop-up shows: item picture, name, variant/SKU, quantity, price; checkbox per item;
  quantity, reason (from settings Reason 1-8, else defaults "Wac custom message",
  "Kaust custom message") and note per item; estimated refund (price minus discounts);
  fees note; validation; "Submitting…"; "Return requested for N items"; earlier
  requests with the status badge on the heading and dates like "12 Oct 2026".
- On submit it writes 4 ORDER metafields through the Customer Account API (metafieldsSet):
  custom.return_reason  single_line_text_field. ONE reason only (the main reason of the
                        latest request); used by order filters and Analytics.
  custom.return_request multi_line_text_field. Readable history for staff.
  custom.return_data    json, {"requests":[{at, items:[{id,name,quantity,reason,note}]}]}
  custom.return_status  single_line_text_field, choices Pending/Approved/Declined/Refunded.
                        Staff set it; the app sets Pending on each new request.
- The merchant creates the Shopify return by hand in admin.

RULES
- Never invent GraphQL fields, CLI flags, scopes or TOML keys. Check them with the
  Shopify Dev MCP (learn_shopify_api, search_docs_chunks, validate) or official
  shopify.dev docs, and say which source you used.
- Validate every GraphQL operation with the Dev MCP `validate` tool for API 2026-07
  (customer API for extension code, admin API for App Home code).
- Run `shopify app build` after every change, and `shopify app config validate --json`
  after any TOML change.
- No backend server. No new runtime dependencies without asking.
- Never write client_id, client secrets, tokens or store domains into committed files
  or logs.
- Don't deploy, push to git, or touch any store unless the prompt says to.
- Match the existing code style (Preact, s-* Polaris web components, comments
  explaining why).
- End with: files changed, what you verified and how, what still needs testing.
```

---

## Phase 0: Prove the unknowns (do this before any refactor)

### Prompt 0.1 🤖: Spike branch and test harness

```
Create a git branch `spike/verify-assumptions`. Don't change production behaviour.

Add a TEMPORARY App Home test page (extensions/app-home/src/pages/SpikePage.jsx, linked
from the home page) with buttons that run these Admin GraphQL operations through direct
API access (fetch('shopify:admin/api/graphql.json')), each showing the raw JSON result:

1. Query metafieldDefinitions(ownerType: ORDER, namespace: "custom", first: 20): key,
   type{name}, access{customerAccount}, capabilities{analyticsQueryable{enabled eligible}
   adminFilterable{enabled}}, validations{name value}.
2. metafieldDefinitionCreate for a THROWAWAY key custom.spike_reason
   (single_line_text_field, ORDER, access.customerAccount READ_WRITE, storefront NONE,
   capabilities adminFilterable + analyticsQueryable enabled).
3. metafieldDefinitionDelete for custom.spike_reason (clean-up button).

Also add a throwaway app-owned TOML definition in shopify.app.toml:
[order.metafields.app.spike_status], single_line_text_field, access.customer_account =
"read_write", access.admin = "merchant_read_write", with a choices validation if TOML
supports it (check the docs; if not, note it).

In the customer extension, add a temporary dev-only button (hidden unless setting
reason_8 equals "SPIKE") that writes and reads $app:spike_status on the current order
through the Customer Account API, and shows the result.

Add Admin scope `write_orders` (and anything else the docs say metafieldDefinitionCreate
on ORDER needs). Validate every operation, build, and validate config.
Don't deploy; tell me the exact commands to run.
```

### Prompt 0.2 🌐: Run the spike on the dev store

```
On the DEV store (checkoutblock) only. The spike build is running via `shopify app dev`.

1. Accept any new-permission prompt for the app (write_orders).
2. Open the app in admin > Spike page. Run test 1 and screenshot the result.
3. Run test 2 (create custom.spike_reason). Report: did it succeed? Was
   access.customerAccount accepted as READ_WRITE? Was analyticsQueryable enabled, and
   what is `eligible`? Copy any userErrors exactly.
4. Settings > Custom data > Orders: open "spike_reason" and confirm Customer Account
   access and the Analytics option are set.
5. Customize > Custom return reasons: set Reason 8 = "SPIKE", save. In the customer
   account, open the pop-up on #1016 and press the spike button. Report whether
   writing and reading $app:spike_status worked, with the exact output.
6. Clean up: run test 3 (delete spike_reason), clear Reason 8, save.

Report a table: test | result | exact output | screenshot.
```

### ✅ Checkpoint 0

Record the answers in `docs/DECISIONS.md` (prompt 0.3) before continuing:

| Question | Answer from the spike |
|---|---|
| Can an app set customerAccount READ_WRITE on a `custom.*` definition? | |
| Is analyticsQueryable enabled, and is it eligible on this plan? | |
| Minimum Admin scope for metafieldDefinitionCreate on ORDER | |
| Can the customer extension write and read `$app` order metafields? | |
| Do TOML definitions support choices validation? | |

### Prompt 0.3 🤖: Record decisions and remove the spike

```
Here are the spike results: <paste the table from 0.2>.

1. Write docs/DECISIONS.md: each question, the answer, evidence (doc link or test
   result) and the decision taken. Decide the data model:
   - If $app order metafields work from the extension: return_request, return_data and
     return_status become app-owned TOML definitions; return_reason stays merchant-owned
     (custom.return_reason) for Analytics.
   - If not: keep all four as custom.*, created by the App Home setup.
2. Remove ALL spike code, the spike TOML definition and the spike button. Keep only the
   scopes the spike proved necessary.
3. Build, validate config, and commit to the spike branch with a clear message.
   Don't push.
```

---

## Phase 1: Clean up the app

### Prompt 1.1 🤖: Remove leftovers and minimise scopes

```
Branch: feature/reusable-template (from main, with docs/DECISIONS.md cherry-picked).

1. Remove Shopify's FAQ sample from App Home (FAQ pages, the metaobject and the product
   metafield definitions in shopify.app.toml, the [sidekick] section and app-tools if it
   only serves the FAQ). Keep a minimal App Home landing page.
2. Set scopes to the minimum proven in DECISIONS.md. Remove write_products. For each
   remaining scope, add a TOML comment saying what needs it.
3. Make sure nothing else referenced the removed parts.
4. Build and validate config. List the removed files.
```

### Prompt 1.2 🤖: Move fields to app-owned TOML (only if Checkpoint 0 allows it)

```
Per DECISIONS.md, move return_request, return_data and return_status to app-owned
definitions in shopify.app.toml:
- [order.metafields.app.return_request] multi_line_text_field
- [order.metafields.app.return_data] json
- [order.metafields.app.return_status] single_line_text_field, choices Pending /
  Approved / Declined / Refunded (if TOML can't set choices, keep it free text and
  validate in code)
Each gets access.customer_account = "read_write" and access.admin = "merchant_read_write"
so staff can read the history and change the status in admin. Use admin_filterable where
useful.

Update extensions/custom-return-reasons/src/api.js (FIELDS, ORDER_FOR_RETURN_QUERY) and
RequestReturnModal.jsx to use the $app namespace exactly as the docs specify for the
Customer Account API. Keep custom.return_reason unchanged.

Backward compatibility: when reading, if the $app field is empty, fall back to the old
custom.* field, so orders created before this change keep their history. Writes go only
to the new fields. Comment why.

Validate all GraphQL (customer API 2026-07), build, validate config.
```

---

## Phase 2: In-app setup and health check

### Prompt 2.1 🤖: App Home "Setup & health check" page

```
Build the App Home landing page as a setup wizard and health check (App Home UI
extension, Preact, s-* components, direct API access).

Section 1: "Order fields" (automatic)
- Query metafieldDefinitions(ownerType: ORDER, namespace: "custom") and check
  custom.return_reason (plus any other merchant-owned fields per DECISIONS.md).
- Status per field: Ready / Missing / Wrong type / Wrong access / Analytics off /
  Analytics not available.
- A "Set up" button that is idempotent:
  - missing                  → metafieldDefinitionCreate (customerAccount READ_WRITE,
                               storefront NONE, adminFilterable, analyticsQueryable if
                               eligible)
  - wrong access/capability  → metafieldDefinitionUpdate
  - wrong type               → DON'T change anything; explain the conflict and how to
                               fix it manually (types can't be changed and deleting
                               loses data)
  - analytics not eligible   → create without it and show a warning
- Show userErrors verbatim. Never delete definitions automatically.
- The app-owned TOML fields are shown as "Managed by the app" (read-only check).

Section 2: "Store settings" (manual checklist, can't be automated, no API)
Checkbox items, each with a short explanation and a direct admin link:
- Protected customer data approved (link to the Dev Dashboard)
- Self-serve returns and cancellations is OFF (Settings > Customer accounts)
- "Custom return reasons" block added to "Orders and Order status"
  (Settings > Customer accounts > Customize)
- Optional: Analytics report "Orders by return reason" created (short how-to)
Remember ticks per store with shopify.storage (browser storage); say in the UI that
they're reminders, not verified.

Section 3: "Recent requests" (read-only)
- List the latest 10 orders with a return reason (orders query filtered on the
  metafield if supported, else recent orders scanned for it): order name, reason,
  status, date, link to the order.

Validate every Admin GraphQL operation (2026-07) and report the required scopes the
validator prints. Build, validate config. Add short code comments explaining why each
step is manual or automatic.
```

### ✅ Checkpoint 2 🌐: Test the setup page on the dev store

```
On the DEV store only, running the branch via `shopify app dev`:
1. Settings > Custom data > Orders: note which return fields exist. Don't delete
   anything that holds data.
2. Open the app in admin. Screenshot the setup page. Confirm each field's status
   matches what you saw in step 1.
3. If custom.return_reason exists and is correct, the page should say Ready and "Set up"
   should do nothing harmful. Press it and confirm "already set up".
4. Tick the checklist items you can confirm (self-serve OFF, block added) and reload:
   ticks are remembered.
5. Recent requests: submit one test request on #1016 via the customer account, then
   confirm it appears here with its reason and status.
6. Clean up: clear #1016's return fields.
Report pass/fail per step with screenshots, plus any confusing wording.
```

---

## Phase 3: Make it a GitHub template

### Prompt 3.1 🤖: Template-ize the repo

```
Make the repo usable with `shopify app init --template <github-url>`. Check the exact
--template syntax (branch and subpath) in the Shopify CLI docs and quote it.

1. Remove client_id from shopify.app.toml and uid from every shopify.extension.toml
   in the TEMPLATE. Find out from the docs or a test how the CLI assigns them on
   init/link/dev/deploy, and document it.
2. Remove any store domain, application_url pointing at a real app, and personal data.
3. Make sure package.json and workspace files work with npm AND pnpm (the CLI chose
   pnpm earlier and failed without it); document the requirement.
4. Add .github/workflows/ci.yml that runs on push and PR: install, `shopify app build`
   (or the extension build equivalent that doesn't need login), lint, and a script
   that FAILS if client_id, a uid, "myshopify.com", "shpat_", "shpss_" or ".env" content
   appears in tracked files.
5. Add scripts/check-secrets.mjs for that check (plain Node, no dependencies).
6. Add LICENSE (ask me which licence; default to a placeholder until I answer),
   CHANGELOG.md (Keep a Changelog format, version 1.0.0) and a .gitattributes for
   consistent line endings.
Build and run the secret check locally. Don't push.
```

### Prompt 3.2 🤖: Documentation

```
Rewrite README.md for a developer who has never seen this project:
1. What it does (3 lines + a screenshot placeholder).
2. Requirements (Node 20+, Shopify CLI, pnpm if needed, Partner account, dev store with
   new customer accounts).
3. Install: the exact `shopify app init --template ...` command, then `shopify app deploy`.
4. Setup: "Open the app in admin and follow the Setup page", plus the 4 manual steps
   with links (protected data, install, self-serve OFF, add block).
5. Settings reference (all 12 extension settings).
6. Handling requests (filter by Return reason, read Return request, set Return status,
   create the return/refund in admin; don't clear fields after processing).
7. Analytics (start the report from Orders, group by Return reason; counts orders).
8. Limitations (Shopify can't auto-create returns while self-serve is off; no automatic
   emails; mobile "…" menu; one status per order; 50 items/20 fulfillments read).
9. Upgrading (pull template changes, deploy; definitions update on deploy).
10. Troubleshooting table (button missing, error on submit, duplicate button during
    `app dev`, Analytics option missing, final-sale not applied).
Also write docs/ARCHITECTURE.md: data model, why each field is merchant- or app-owned,
the automation boundaries table, and links to every Shopify doc used.
Keep the language plain; no internal jargon.
```

### ✅ Checkpoint 3 🌐 + you: Fresh install from the template

```
(You) On a NEW dev store or a fresh app name:
  shopify app init --template <your GitHub URL and branch>
  cd <new folder>
  shopify app deploy
Install the app on the dev store.

(🌐 Browser assistant) On that NEW dev store:
1. Open the app > Setup page > press "Set up". Confirm all fields show Ready.
2. Follow the checklist: self-serve OFF, add the block, save.
3. Create a test order for a test customer, mark it paid and fulfilled.
4. In the customer account: exactly one "Request a return" button; pop-up shows the
   default reasons; submit one item.
5. Admin: the order has the return fields filled; the Setup page "Recent requests"
   shows it.
Report pass/fail per step, every place the README was unclear, and how long it took.
```

---

## Phase 4: Release

### Prompt 4.1 🤖: Pre-release review

```
Review the branch feature/reusable-template against main before merging:
1. Diff summary: what changed and why.
2. Re-check every customer-facing behaviour listed in the shared context still works
   in code (point to the lines).
3. Confirm no secrets or identities are in tracked files (run the secret check).
4. Confirm all GraphQL validates for 2026-07, the build passes and config validates.
5. List anything that needs a data migration on the EXISTING dev store (old custom.*
   fields) and confirm the read fallback covers it.
Output a go/no-go list. Don't merge or push.
```

### Prompt 4.2 🌐: Full regression on the dev store

```
Use the full regression test prompt from the earlier rounds (sections A-G, 21 tests:
setup, button and pop-up, submit and admin, several requests and status, settings,
reporting, clean-up), plus:
- the App Home Setup page shows every field Ready and the checklist is ticked;
- an order created BEFORE the migration still shows its earlier requests (fallback).
Report a pass/fail table with screenshots and confirm every change was restored.
```

### Prompt 4.3 🤖: Merge, tag, deploy

```
After I confirm go:
1. Merge feature/reusable-template into main.
2. Update CHANGELOG.md (1.0.0, date), tag v1.0.0.
3. Tell me the exact commands to push (git push, git push --tags) and to deploy
   (shopify app deploy) — I'll run the deploy myself.
4. Remind me to re-add the Customize block if it was removed during testing, and to
   wait ~5 minutes before checking customer accounts.
```

---

## Phase 5: Real store rollout

### Prompt 5.1 🌐: Real store setup via the Setup page

```
On the REAL store (<store>.myshopify.com). The app is installed and protected customer
data is approved.
1. Plan check: Settings > Custom data > Orders > Add definition. Does "Filter or group
   data in Analytics" exist? (Cancel without saving.)
2. Open the app > Setup page > "Set up". Report each field's status.
3. Follow the checklist: Self-serve returns OFF, add the block to "Orders and Order
   status", save. Set Reason 1-8, Return window, Final-sale tag and Fees note only if I
   gave values: <values or "leave defaults">.
4. Create the Analytics report "Orders by return reason" (start from Orders, group by
   Return reason) and saved order views per reason.
5. Wait 5 minutes. Check one real paid, fulfilled order in a test customer account:
   exactly one "Request a return". DON'T submit unless I say so.
Report pass/fail with screenshots. Change nothing else.
```

### Prompt 5.2 🌐: Real store smoke test (with my OK)

```
I approve one test request on order <order number> (my own test order).
Submit one item with reason <reason>. Confirm the 4 fields in admin and the Setup
page's Recent requests. Then clear the 4 fields on that order and confirm they're empty.
Don't decline, refund or email anything.
```

---

## Phase 6 (optional): npm helper CLI

Only build this if other developers need to add the module to apps they already have.

### Prompt 6.1 🤖: Design check first

```
Before writing code: given docs/ARCHITECTURE.md and DECISIONS.md, list exactly which
commands an `npx custom-return-reasons` CLI would add over the template + Setup page
(e.g. `add` into an existing app, `check` readiness). For each command: what it changes,
what it can't do (logins, Shopify approval, admin-only settings), and how it avoids
overwriting existing TOML (merge strategy, dry-run, backups). Note that
`shopify app execute` only allows mutations on dev stores, and production would need
`shopify store auth` + `shopify store execute --allow-mutations`. Recommend build or
don't build, with reasons. No code yet.
```

### Prompt 6.2 🤖: Build the CLI (only if 6.1 says build)

```
Create a separate package `custom-return-reasons-cli` (Node 20+, ESM, no heavy deps)
with commands from 6.1. Requirements:
- `--dry-run` by default for anything that edits files; show a diff; back up files.
- Never write client_id, uid, tokens or store domains; never log tokens.
- Idempotent: running twice changes nothing the second time.
- Call Shopify CLI as a subprocess for auth/deploy; never handle credentials itself.
- package.json "files" allow-list (not .npmignore), `npm pack --dry-run` checked in CI,
  provenance publishing, semver, CHANGELOG.
- Tests: snapshot tests for file generation, merge tests on sample TOML files, and a
  mocked GraphQL layer. NO tests against real stores in CI.
Publish nothing; tell me the commands for a private test publish.
```

---

## Quick reference: what can't be automated (no documented API)

| Step | Who |
|---|---|
| Shopify CLI / Partner login | Developer |
| Protected customer data approval | Shopify review |
| Installing the app (custom distribution link) | Merchant |
| Turning self-serve returns OFF | Merchant (Settings > Customer accounts) |
| Adding the block in Customize | Merchant |
| Creating the Shopify return/refund for a request | Merchant (by design) |

## Sources used for this plan

- [app init --template](https://shopify.dev/docs/api/shopify-cli/app/app-init)
- [app execute (mutations on dev stores only)](https://shopify.dev/docs/apps/build/apis/graphql-admin/api-exploration/admin-cli-app-execute)
- [store auth](https://shopify.dev/docs/api/shopify-cli/store/store-auth) and [store execute](https://shopify.dev/docs/api/shopify-cli/store/store-execute)
- [MetafieldDefinitionInput 2026-07](https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/MetafieldDefinitionInput)
- [Manage metafield definitions (TOML limits)](https://shopify.dev/docs/apps/build/metafields/definitions)
- [About metafields (access rules)](https://shopify.dev/docs/apps/build/metafields)
- [Changelog: apps can manage access on merchant definitions](https://shopify.dev/changelog/posts/apps-can-now-manage-access-settings-for-merchant-metafield-definitions)
- [Changelog: analyticsQueryable](https://shopify.dev/changelog/posts/new-analyticsqueryable-capability-for-metafield-definitions)
- [App Home UI extension (direct API access)](https://shopify.dev/docs/api/app-home-ui-extension/2026-07)
- [Customer account metafields](https://shopify.dev/docs/apps/build/customer-accounts/metafields-in-customer-accounts)
