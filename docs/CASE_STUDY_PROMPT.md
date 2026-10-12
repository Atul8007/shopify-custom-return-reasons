# Prompt: Generate Portfolio Case Study for "Custom Return Reasons on Shopify"

Use the exact technical structure, tone, pixel diagrams, and styling found on [atul-ai.pages.dev/case-studies/option-values](https://atul-ai.pages.dev/case-studies/option-values).

---

```markdown
You are an expert Shopify Solutions Architect and Technical Writer writing a deep-dive portfolio case study for Atul Mundakkal's portfolio (https://atul-ai.pages.dev).

TARGET PAGE: /case-studies/custom-return-reasons.html
STYLE: Developer documentation meets high-impact technical case study. Compact, authoritative, bullet-heavy, direct ("Shopify Dev Docs" meets clean engineering audit style). Includes SVG pixel-style diagrams, before/after comparisons, and business impact metrics.

CONTEXT & ARCHITECTURE ACHIEVED:
- Title: "Custom Return Reasons on Shopify"
- Tag: "SHOPIFY CUSTOMER ACCOUNT EXTENSIBILITY CASE STUDY"
- Subtitle / Lead: "Custom return reasons. Native Order Metafields. Native Shopify Analytics. Zero backend servers. No monthly SaaS fees."
- Repo: https://github.com/Atul8007/shopify-custom-return-reasons
- Tech Stack: Preact, Shopify Customer Account UI Extensions (2026-07), App Home Direct Admin GraphQL API, Shopify Order Metafields, Polaris Web Components (s-*).

SECTION OUTLINE TO GENERATE (Matching option-values.html 10-section structure):

1. The limit
- Third-party return apps charge $30–$300+/month + per-return fees.
- Customer is redirected to external portals that break brand experience.
- Proprietary lock-in: return data is trapped on third-party servers, inaccessible in native Shopify reports.
- Shopify native self-serve returns has NO customizable reasons and NO native analytics breakdown per reason.

2. The unlock
- 100% serverless, zero-backend architecture.
- Customer Account UI extension renders a native "Request a return" modal directly in New Customer Accounts.
- App Home extension uses Direct Admin GraphQL API (`shopify:admin/api/graphql.json`) for a 1-click idempotent setup wizard.
- Dual-layer data model:
  * Merchant-owned `custom.return_reason` for native Shopify Analytics and Order list filtering.
  * App-owned `$app:return_request`, `$app:return_data`, `$app:return_status` in TOML for staff history and audit trails.
- Backward compatibility fallback so existing orders retain history.

[DIAGRAM 1: SVG Pixel Diagram]
Architecture Flow: Customer Account UI Extension → Order Metafields (`custom.return_reason` & `$app:*`) → Native Shopify Analytics & Admin Orders.

3. What this unlocks
- Fully customizable return reasons (up to 8 in theme customizer, plus defaults).
- Native Shopify Analytics: group and filter orders by Return Reason directly in Shopify Reports.
- Return window enforcement (default 30 days) and automatic final-sale exclusion.
- Estimated refund calculation & return fee notices.
- $0 recurring server or subscription cost forever.

4. What it costs
- Requires New Customer Accounts (not supported on legacy/classic accounts).
- Initial 5-minute setup (turning off native self-serve returns and adding block in theme customize).
- Protected Customer Data (Level 1) approval in Partner Dashboard.
- Return fulfillment and refunds remain manual staff actions in Admin (by design).

5. How it fits together
- Step-by-step pipeline: Order fulfilled → Customer clicks "Request a return" → Extension evaluates eligibility → Customer selects item, reason, note → `metafieldsSet` writes to Order → Merchant filters in Admin & views in Analytics.

[DIAGRAM 2: SVG Pixel Diagram]
Flow Chart: Order Eligibility → Customer Account UI → Customer Account API (`metafieldsSet`) → Order Metafields → Native Analytics & Staff View.

6. The Data Model & Automation Boundaries
- Breakdown table of fields:
  * `custom.return_reason`: `single_line_text_field`, `READ_WRITE`, Analytics Queryable.
  * `$app:return_request`: `multi_line_text_field`, staff chronological history.
  * `$app:return_data`: `json`, machine-readable requested item breakdown.
  * `$app:return_status`: `single_line_text_field`, review lifecycle (Pending, Approved, Declined, Refunded).
- Explanation of why `custom.return_reason` is merchant-owned (Shopify Analytics capability requirement).

7. In practice (Case Study / Rebuild Results)
- High-volume merchant scenario paying $250/mo for a SaaS return app just to ask "why are you returning this?".
- Rebuilt with this open-source template.
- Results box:
  * $3,000+ annual SaaS app spend eliminated.
  * 100% data ownership inside native Shopify Reports.
  * Zero external customer data leakage (GDPR/privacy compliant).
  * 0ms extra server latency (100% native Shopify CDN).

[DIAGRAM 3: SVG Pixel Diagram]
Before / After Chart: $199/mo external portal vs. $0/mo Native Customer Account Extension.

8. Where this fits
- Breakdown table of store types and return workflows (Fashion/Apparel, Footwear, Electronics, Luxury, Custom Goods).

9. The bottom line
- The conclusion: Returns shouldn't cost merchants a monthly SaaS tax. Native extensibility + metafields + analytics queryable makes external portals obsolete for custom return collection.

10. Next steps & Open Source Template Links
- Card grid with links:
  * GitHub Repository: https://github.com/Atul8007/shopify-custom-return-reasons
  * 1-Click Init CLI Command: `shopify app init --template https://github.com/Atul8007/shopify-custom-return-reasons`
  * Architecture Document: docs/ARCHITECTURE.md
  * Setup Wizard Guide: App Home Setup page reference.

OUTPUT FORMAT:
Generate the complete HTML file matching the exact layout, CSS classes (`doc-layout`, `doc-header`, `pixel-diagram-card`, `heading-anchor-group`, `doc-callout`, `gated-links-grid`), fonts, and dark theme of https://atul-ai.pages.dev/case-studies/option-values.
```
