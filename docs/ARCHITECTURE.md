# Architecture & Data Model

This document outlines the architecture, data model, and automation boundaries for **Custom Return Reasons**.

---

## 1. Zero-Backend Architecture

The app has **no backend server**, **no database**, and **no recurring infrastructure costs**. It is built entirely on native Shopify extensibility:

1. **Customer Account UI Extension** (`extensions/custom-return-reasons`):
   - Targets `customer-account.order.action.menu-item.render` (menu button on Order list and Order details) and `customer-account.order.action.render` (return modal).
   - Evaluates return eligibility directly in the browser using the **Customer Account API** and **Storefront API**.
   - Submits return requests directly to Shopify Order Metafields using `metafieldsSet`.
2. **App Home UI Extension** (`extensions/app-home`):
   - Provides an embedded admin wizard using Shopify Polaris Web Components (`s-*`) and direct Admin GraphQL access (`shopify:admin/api/graphql.json`).
   - Verifies field definitions, creates missing fields idempotently, and provides recent request visibility.

---

## 2. Metafield Data Model

| Metafield | Ownership | Namespace | Type | Customer Account Access | Admin Access | Purpose |
|---|---|---|---|---|---|---|
| `return_reason` | **Merchant-owned** | `custom` | `single_line_text_field` | `READ_WRITE` | `merchant_read_write` | Main reason of the latest request. Used for **Shopify Analytics** reporting and Admin order list filtering. |
| `return_request` | **App-owned (TOML)** | `$app` | `multi_line_text_field` | `read_write` | `merchant_read_write` | Human-readable chronological history of requests submitted for the order. |
| `return_data` | **App-owned (TOML)** | `$app` | `json` | `read_write` | `merchant_read_write` | Machine-readable JSON tracking items, quantities, reasons, and notes for eligibility recalculation. |
| `return_status` | **App-owned (TOML)** | `$app` | `single_line_text_field` | `read_write` | `merchant_read_write` | Staff review status (`Pending`, `Approved`, `Declined`, `Refunded`). |

### Why `custom.return_reason` is Merchant-Owned
Shopify Analytics only allows grouping and filtering on **merchant-owned** (`custom.*`) definitions when `analyticsQueryable` capability is enabled. App-owned (`$app`) definitions are private to the app and do not show up in Shopify's native Analytics query builder.

### Backward Compatibility Fallback
For stores migrating from earlier versions:
- **Reads**: If `$app:return_data` or `$app:return_status` are empty, the customer UI extension automatically falls back to `custom.return_data` and `custom.return_status`.
- **Writes**: All new requests write to `$app` and `custom.return_reason`.

---

## 3. Automation Boundaries

The following operations can and cannot be automated due to Shopify platform APIs:

| Step | Type | Automation Status | Details |
|---|---|---|---|
| Create/Update `custom.return_reason` | Metafield Definition | **Automated** | Done in one click via App Home Setup page using Admin direct API. |
| Define `return_request`, `return_data`, `return_status` | App Definitions | **Automated** | Managed declaratively via `shopify.app.toml`. Deployed on `shopify app deploy`. |
| Protected Customer Data Access | Permission | **Manual** | Requires developer to request Level 1 access in the Shopify Partner Dashboard. |
| Self-Serve Returns OFF | Store Setting | **Manual** | Must be disabled in `Settings > Customer accounts` (no public API). |
| Add block to customer account | Theme / Editor | **Manual** | Added once in Customer Accounts theme editor (`Settings > Customer accounts > Customize`). |
| Processing Return & Refund | Operations | **Manual (by design)** | Staff approve/decline and create the return or refund in Shopify Admin. |

---

## 4. Platform References

- [Customer Account UI Extensions](https://shopify.dev/docs/apps/build/customer-accounts)
- [Customer Account API Metafields](https://shopify.dev/docs/apps/build/customer-accounts/metafields-in-customer-accounts)
- [App Home UI Extensions (Direct API)](https://shopify.dev/docs/api/app-home-ui-extension/2026-07)
- [Shopify Admin GraphQL MetafieldDefinitionInput (2026-07)](https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/MetafieldDefinitionInput)
- [Analytics Queryable Metafields](https://shopify.dev/changelog/posts/new-analyticsqueryable-capability-for-metafield-definitions)
