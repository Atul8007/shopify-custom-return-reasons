# Custom return reasons for Shopify customer accounts

Adds a **"Request a return"** button to each order in your customer accounts.
It opens a pop-up with **your own reasons** in the dropdown. The request is saved
**on the order** (reason + item details); you then create the return in Shopify
admin yourself. Shopify's self-serve returns stay **off**, so customers see only
this one button.

Files you will edit most:
- `extensions/custom-return-reasons/src/reasons.js`: default reasons and all on-screen text

---

## What you need (one time)

1. **Node.js 20+**: https://nodejs.org
2. **Shopify CLI**: in a terminal run `npm install -g @shopify/cli@latest`
3. **A free Shopify Partner / Dev Dashboard account**: https://www.shopify.com/partners
4. A **development store** to test on (create one from the Dev Dashboard).
   Turn on new customer accounts in it and place a test order.

## Setup

### 1. Create an empty app

```bash
shopify app init
```
- Name it e.g. `custom-return-reasons`
- When asked for a template, choose **"Build an extension-only app"**

### 2. Add a customer account extension

```bash
cd custom-return-reasons
shopify app generate extension --template customer_account_ui --name custom-return-reasons
```
Pick **JavaScript (Preact)** if asked. If it fails with `'pnpm' is not recognized`,
run `npm install -g pnpm` and `pnpm install`; the extension folder is usually created anyway.

### 3. Drop in these files

Copy from this folder into `extensions/custom-return-reasons/`:

| From this folder | Do this |
|---|---|
| `src/reasons.js`, `src/api.js`, `src/RequestReturnButton.jsx`, `src/RequestReturnModal.jsx` | Copy into `src/`. Delete the sample file the CLI created there. |
| `shopify.extension.toml` | Replace the generated one, **but keep the `uid = "..."` line the CLI wrote**. |

### 4. Add the access scopes

Open `shopify.app.toml` in the app's root folder and set:

```toml
[access_scopes]
scopes = "customer_read_customers,customer_read_orders,customer_write_orders,customer_write_customers"
```
(Needed to read orders and to save the request on the order.)

### 5. Deploy and install

```bash
shopify app deploy
```
Then install the app on the store (Dev Dashboard > your app > Distribution
> **Custom distribution** > enter your store domain > open the install link).
In Dev Dashboard > your app > API access, fill in **Protected customer data**.
Real (non-development) stores need Shopify's approval of it before the button works.

### 6. Create the four order fields (once per store)

Shopify admin > **Settings > Custom data > Orders > Add definition**, four times.
All four need **Customer Account API access: Read and write**.

| Name | Namespace and key | Type | Extra options |
|---|---|---|---|
| Return reason | `custom.return_reason` | Single line text | **Filter or group data in Analytics** on; **Filter on the order list** on |
| Return request | `custom.return_request` | Multi-line text | (none) |
| Return data | `custom.return_data` | JSON | (none). The app's own record; don't edit it. |
| Return status | `custom.return_status` | Single line text, **Limit to preset choices**: `Pending`, `Approved`, `Declined`, `Refunded` | (none) |

Without them, customers get an error when they submit.
Shopify allows only **5** order fields with "Filter on the order list" on; if the
store already uses all 5, turn one off first.

### 7. Store settings

1. **Settings > Customer accounts** > turn **Self-serve returns and cancellations off**.
   This hides Shopify's own "Return items" button. The app checks eligibility itself.
2. **Settings > Customer accounts > Customize** > **Order status** page > **Apps** >
   **Custom return reasons** > add it to "Orders and Order status" > **Save**.
   Until you do this, the store doesn't load the extension at all.
3. In the same place, optionally set:
   - **Return window (days)**: days after delivery (or fulfillment, when there's no
     tracking) that items can be returned (empty = 30)
   - **Final-sale tag**: products with this tag are never offered for return
     (empty = `final-sale`). Add the tag to those products in Products.
   - **Return fees note**: text shown in the pop-up, e.g. "Return shipping: $5"
   - **Hide refund estimate**: tick to stop showing the estimated refund
   - **Reason 1–8**: your reasons. Empty boxes are hidden; if all are empty, the
     defaults in `src/reasons.js` are shown.

### 8. Analytics report

Analytics > Reports > new report. Start with an **orders metric (Orders)**, then add
the **Return reason** dimension. If you start from "Returned quantity", Shopify won't
offer the field. Save it (e.g. "Orders by return reason"). It counts orders, not items.

Return reason always holds **one** reason: the main one (most units) from the
customer's latest request. Filters and reports only match whole values, so a
combined value would match nothing. Every item's reason is still in Return request.

---

## Handling a request

1. Shopify admin > **Orders** > add a filter **Return reason** is *your reason*
   (e.g. "Kaust custom message"), once per reason. Save each as a view (tab) so new
   requests are one click away. Shopify's filter has no "is not empty" option.
2. Open the order: the **Return request** field lists every request with items,
   quantities, reasons and notes.
3. Click **Return** (or **Refund**) on the order and process it as usual.
4. Set **Return status** to Approved, Declined or Refunded. The customer sees it in
   the pop-up. It goes back to Pending when they send another request.

Customers can send more requests later for items they haven't requested yet.
The pop-up shows their earlier requests and the current status above the form.

## Which orders show the button

Paid (or partially refunded) and not cancelled, with items delivered or fulfilled
within the return window that aren't final-sale and haven't been requested yet.
Orders with earlier requests also show it, so the customer can see their status.

## What Shopify's built-in returns do that this app can't

- Create the Shopify return automatically: Shopify blocks it while self-serve
  returns is off, so you click Return yourself.
- Send emails automatically: extensions can't send email. Shopify emails the
  customer once you create the return.
- Alert you about new requests: use the saved order view, or a Shopify Flow
  workflow if your store offers a suitable trigger.
- Exact refund amounts: the estimate is price minus discounts, before tax,
  shipping and fees.

## Troubleshooting

| Problem | Fix |
|---|---|
| Button doesn't appear | Check the extension is added in Customize (step 7.2), and the order is paid, fulfilled and within the return window. |
| Error after submitting | One of the four order fields from step 6 is missing, has the wrong type, or its Customer Account API access isn't **Read and write**. The error text in the pop-up names the field. |
| A final-sale product is still offered | The product must have the exact tag (step 7.3) and be published to the Online Store; unpublished products can't be checked. |
| "Access denied" errors | The scopes in step 4 are missing, or protected customer data isn't approved. Deploy and accept the new permissions in Shopify admin > Apps. |
| Shopify's "Return items" button is back | Self-serve returns was switched on again (step 7.1). |
