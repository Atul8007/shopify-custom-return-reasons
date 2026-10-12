# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-12

### Added
- Reusable GitHub template format for `shopify app init --template`.
- In-app **Setup & Health Check** page in App Home with direct API access:
  - Idempotent creation and validation of `custom.return_reason` order metafield definition with Customer Account `READ_WRITE`, Admin filterable, and Analytics capabilities.
  - Interactive store settings checklist with deep links into Shopify Admin and Partner Dashboard.
  - Recent return requests table scanning orders with direct admin order links.
- Native Customer Account UI extension (`customer-account.order.action.menu-item.render` and `customer-account.order.action.render`):
  - Return window calculation, final-sale exclusion, and multi-line return request submissions.
  - Support for app-owned TOML order metafields (`$app:return_request`, `$app:return_data`, `$app:return_status`).
  - Read fallback to legacy `custom.*` metafields for seamless backward compatibility.
- Secret and identity leak checker (`scripts/check-secrets.mjs`) and GitHub Actions CI workflow (`.github/workflows/ci.yml`).
