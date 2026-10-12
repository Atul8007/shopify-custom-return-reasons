# Architecture Decisions & Spike Findings

This document records the empirical results from Phase 0 (branch `spike/verify-assumptions`) and the resulting architectural decisions for the custom return reasons app.

---

## Checkpoint 0: Spike Findings

| Question | Answer from the spike | Evidence | Decision |
|---|---|---|---|
| Can an app set `customerAccount: READ_WRITE` on a `custom.*` definition? | **YES** | `metafieldDefinitionCreate` succeeded with `access: { customerAccount: "READ_WRITE" }`, returning empty `userErrors`. | App Home setup can automatically configure merchant-owned definitions for customer account access. |
| Is `analyticsQueryable` enabled, and is it eligible on this plan? | **YES** | Succeeded returning `analyticsQueryable: { enabled: true, eligible: true }`. | Enable `analyticsQueryable: true` by default on `custom.return_reason` so merchants can group/filter reports in Shopify Analytics. |
| Minimum Admin scope for `metafieldDefinitionCreate` on `ORDER`? | **`write_orders`** | Verified when CLI warned that `[order]` required `write_orders`. Adding `write_orders` permitted definition mutations. | Retain `write_orders` in `access_scopes.scopes` with documentation comment. |
| Can the customer extension write and read `$app` order metafields? | **YES** | Customer Account API `metafieldsSet` with `$app:spike_status` succeeded and `order.spikeStatus.value` read back `"Spike-Test-2026-10-12T16:53:58.741Z"`. | **Move `return_request`, `return_data`, and `return_status` to app-owned TOML definitions (`$app`). Keep only `custom.return_reason` merchant-owned for Analytics.** |
| Do TOML definitions support choices validation? | **NO** | Shopify CLI TOML specification for app-owned metafields does not expose predefined `choices` array validation syntax. | Define `return_status` as `single_line_text_field` in TOML and validate allowed values (`Pending`, `Approved`, `Declined`, `Refunded`) in code. |

---

## Data Model Architecture Decision

Based on the spike results proving that `$app` order metafields work from the customer account UI extension:

1. **App-owned definitions (in `shopify.app.toml`)**:
   - `[order.metafields.app.return_request]`: `multi_line_text_field` (readable history for staff).
   - `[order.metafields.app.return_data]`: `json` (machine-readable state for customer extension eligibility).
   - `[order.metafields.app.return_status]`: `single_line_text_field` (Pending / Approved / Declined / Refunded).
   - Access: `customer_account = "read_write"`, `admin = "merchant_read_write"`.

2. **Merchant-owned definition (`custom.return_reason`)**:
   - `custom.return_reason`: `single_line_text_field` (one main reason per request).
   - Purpose: Shopify Analytics order grouping and Admin order list filter (whole string matches).
   - Created / verified automatically via the in-app App Home Setup wizard.

3. **Backward Compatibility**:
   - Reads: When reading previous requests, check `$app` first. If empty, fall back to legacy `custom.*` fields so historic orders remain visible.
   - Writes: Write to new `$app` fields and `custom.return_reason`.
