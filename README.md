# Custom Return Reasons (Shopify App Template)

> **Free, open-source, zero-backend return management for Shopify.**  
> Created by **[Atul](https://github.com/Atul8007)**.  
> Ask customers *why* they are returning an item, save custom reasons directly to native Order Metafields, and build native **Shopify Analytics** return reports without third-party monthly subscriptions.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Shopify CLI](https://img.shields.io/badge/Shopify%20CLI-Template-brightgreen)](https://shopify.dev/docs/apps)

---

## What It Does
- **Seamless Customer Experience**: Adds a native "Request a return" action to New Customer Accounts on eligible orders (paid, delivered/fulfilled within your return window, excluding final-sale products).
- **Customizable Return Reasons**: Configure up to 8 custom reasons in Shopify Admin theme customize editor without code.
- **Native Shopify Metafields**: Automatically records requests to native order metafields:
  - `custom.return_reason`: Main reason for order filtering and Shopify Analytics reports.
  - `custom.return_request` / `$app:return_request`: Human-readable history for staff.
  - `custom.return_status` / `$app:return_status`: Review status (`Pending`, `Approved`, `Declined`, `Refunded`).
- **Zero Backend**: 100% serverless, Preact UI extensions, and direct API access. No hosting, no database, no privacy leaks.

---

## Requirements
- **Node.js**: v20 or newer
- **Shopify CLI**: Latest (`npm install -g @shopify/cli`)
- **Shopify Partner Account** and a development or live store with **New Customer Accounts** enabled.

---

## Installation

### 1. Initialize from Template
Create a new project using the Shopify CLI template flag:
```bash
shopify app init --template https://github.com/Atul8007/shopify-custom-return-reasons
```
*(Or clone this repository directly and run `npm install`)*

### 2. Deploy the App
Link and deploy the extensions to your app:
```bash
cd shopify-custom-return-reasons
shopify app deploy
```

---

## Setup (5 Minutes)

### Step 1: Open App Setup Page
In Shopify Admin, open your installed app. On the **Setup & Health Check** page:
- Click **"Set Up custom.return_reason"**. The app will automatically create and configure the `custom.return_reason` order definition with Customer Account `READ_WRITE` access, Admin filterable, and Analytics capabilities.

### Step 2: Configure Store Settings
Complete the checklist displayed on the setup page:
1. **Protected Customer Data**: In your [Shopify Partner Dashboard](https://partners.shopify.com), ensure Level 1 Protected Customer Data access is granted for your app (needed for Customer Account order queries).
2. **Turn Self-Serve Returns OFF**: Go to `Settings > Customer accounts > Returns` and turn off Shopify native self-serve returns so this module manages requests.
3. **Add the Extension Block**:
   - Go to `Settings > Customer accounts > Customize`.
   - On the **Orders** page, add the **"Custom return reasons"** block.
   - Configure your return window (default 30 days), final-sale tag, fees note, and custom reasons 1 to 8.
   - Click **Save**.

---

## Extension Settings Reference

Configure these in `Settings > Customer accounts > Customize`:
| Setting | Type | Default | Description |
|---|---|---|---|
| `return_window_days` | Number | `30` | Number of days after delivery/fulfillment returns are allowed. |
| `final_sale_tag` | Text | `final-sale` | Product tag that excludes items from return eligibility. |
| `return_fees_note` | Text | *(empty)* | Optional note shown in modal, e.g. "Return shipping fee: $5". |
| `hide_refund_estimate` | Boolean | `false` | Set to True to hide the calculated refund estimate. |
| `reason_1` .. `reason_8` | Text | *(default reasons)* | The return reason options available in the customer dropdown. |

---

## Processing Returns in Admin
1. **Filter Orders**: Filter the Order list by **Return reason** or **Return status**.
2. **Review Request**: View the order details card to read the submitted item history and customer notes.
3. **Update Status**: Set `Return status` to `Approved` or `Declined`.
4. **Fulfill Return**: Click **Return items** or **Refund** directly in Shopify Admin to process inventory and payment.

---

## Native Shopify Analytics Report
To view orders by return reason:
1. Go to **Analytics > Reports > Create custom report**.
2. Start from **Orders**.
3. Group or breakdown by **Return reason** (`custom.return_reason`).

---

## Known Limitations
- Requires **New Customer Accounts** (Customer Account UI extensions are not supported on Classic Accounts).
- Mobile devices collapse customer account order actions into the `...` menu.
- Shopify Admin returns and refunds are completed manually by staff.

---

## Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| Button does not appear | Order not eligible or self-serve ON | Verify order is paid, fulfilled within return window, products lack final-sale tag, and self-serve returns is OFF. |
| "Level 1 protected customer data access is required" | Partner dashboard permission | Request Level 1 Protected Customer Data access in your Partner Dashboard for the app. |
| "Setup page shows Missing" | Field not initialized | Click "Set Up custom.return_reason" on the App Home page. |

---

## Author & Maintainer
- **Developer**: **Atul** ([@Atul8007](https://github.com/Atul8007))
- **Repository**: [Atul8007/shopify-custom-return-reasons](https://github.com/Atul8007/shopify-custom-return-reasons)

---

## License
[MIT](LICENSE) - Free to use, fork, and adapt for personal and commercial Shopify stores.

