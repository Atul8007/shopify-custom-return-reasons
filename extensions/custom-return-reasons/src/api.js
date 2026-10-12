// Small helper for calling the Customer Account API from the extension.
// Requests are authenticated automatically by Shopify.

const API_VERSION = '2026-07';
const ENDPOINT = `shopify://customer-account/api/${API_VERSION}/graphql.json`;

export async function customerApi(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({query, variables}),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  if (json.errors && json.errors.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  return json.data;
}

// Order fields the requests are saved to. The merchant creates these
// definitions in Shopify admin > Settings > Custom data > Orders:
//   return_reason  - single line text; ONE reason (the main one from the
//                    latest request), used in Analytics and to filter the
//                    order list, which only match whole values. Customer
//                    Account API: Read and write.
//   return_request - multi-line text; every request, readable by staff.
//                    Customer Account API: Read and write.
//   return_data    - JSON; the same requests for the app to read back
//                    (which quantities were already requested).
//                    Customer Account API: Read and write.
//   return_status  - single line text, preset choices Pending / Approved /
//                    Declined / Refunded. Staff update it; the app sets
//                    Pending on each new request. Customer Account API:
//                    Read and write.
export const FIELDS = {
  reason: {namespace: 'custom', key: 'return_reason'},
  request: {namespace: 'custom', key: 'return_request'},
  data: {namespace: 'custom', key: 'return_data'},
  status: {namespace: 'custom', key: 'return_status'},
};

export const ORDER_FOR_RETURN_QUERY = `
  query OrderForReturn($orderId: ID!) {
    order(id: $orderId) {
      id
      financialStatus
      cancelledAt
      lineItems(first: 50) {
        nodes {
          id
          name
          title
          variantTitle
          sku
          image { url altText }
          quantity
          productId
          price { amount currencyCode }
          discountAllocations { allocatedAmount { amount } }
        }
      }
      fulfillments(first: 20) {
        nodes {
          status
          createdAt
          events(first: 20) { nodes { status happenedAt } }
          fulfillmentLineItems(first: 50) {
            nodes { quantity lineItem { id } }
          }
        }
      }
      returnData: metafield(namespace: "custom", key: "return_data") { value }
      returnStatus: metafield(namespace: "custom", key: "return_status") { value }
    }
  }
`;

export const SAVE_REQUEST_MUTATION = `
  mutation SaveReturnRequest($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { key value }
      userErrors { field message }
    }
  }
`;

// Storefront API (needs api_access in shopify.extension.toml)
const PRODUCT_TAGS_QUERY = `
  query ProductTags($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product { id tags }
    }
  }
`;

/**
 * Product IDs tagged with `tag` (case-insensitive). Products that aren't
 * published to the online store can't be read and count as not tagged.
 */
export async function productsWithTag(productIds, tag) {
  const wanted = String(tag || '').trim().toLowerCase();
  const ids = [...new Set(productIds.filter(Boolean))];
  if (!wanted || !ids.length) return new Set();
  try {
    const {data} = await shopify.query(PRODUCT_TAGS_QUERY, {variables: {ids}});
    return new Set(
      (data?.nodes || [])
        .filter((p) => p?.tags?.some((t) => t.toLowerCase() === wanted))
        .map((p) => p.id),
    );
  } catch (error) {
    console.warn('Could not read product tags', error);
    return new Set();
  }
}

/** Previous requests saved on the order: [{at, items: [{id, name, quantity, reason, note}]}] */
export function readRequests(order) {
  try {
    const parsed = JSON.parse(order?.returnData?.value || '{}');
    return Array.isArray(parsed.requests) ? parsed.requests : [];
  } catch {
    return [];
  }
}

const PAID_STATUSES = ['PAID', 'PARTIALLY_REFUNDED'];
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Works out what the customer may still return, without Shopify's
 * self-serve returns (which stay off so Shopify's own button is hidden).
 *
 * An item is returnable when the order is paid and not cancelled, the item
 * was delivered (or, without delivery tracking, fulfilled) within the last
 * `windowDays` days, it isn't a final-sale product, and it hasn't already
 * been requested.
 *
 * Returns {items: [{id, name, title, variantTitle, sku, imageUrl, imageAlt,
 *                   unitPrice, orderedQuantity, quantity, unitRefund,
 *                   currencyCode}],
 *          requests, status}
 */
export function returnableFromOrder(order, {windowDays, finalSaleIds}) {
  const requests = readRequests(order);
  const status = order?.returnStatus?.value || '';
  const none = {items: [], requests, status};
  if (!order || order.cancelledAt) return none;
  if (!PAID_STATUSES.includes(order.financialStatus)) return none;

  const cutoff = Date.now() - windowDays * DAY_MS;
  const inWindowQty = {}; // lineItemId -> quantity delivered/fulfilled in window
  for (const f of order.fulfillments?.nodes || []) {
    if (f.status !== 'SUCCESS') continue;
    const delivered = (f.events?.nodes || []).find(
      (e) => e.status === 'DELIVERED',
    );
    const startedAt = new Date(delivered?.happenedAt || f.createdAt).getTime();
    if (startedAt < cutoff) continue;
    for (const fl of f.fulfillmentLineItems?.nodes || []) {
      const id = fl.lineItem?.id;
      if (id) inWindowQty[id] = (inWindowQty[id] || 0) + fl.quantity;
    }
  }

  const alreadyRequested = {}; // lineItemId -> quantity in earlier requests
  for (const r of requests) {
    for (const it of r.items || []) {
      alreadyRequested[it.id] = (alreadyRequested[it.id] || 0) + it.quantity;
    }
  }

  const items = (order.lineItems?.nodes || [])
    .filter((li) => !finalSaleIds.has(li.productId))
    .map((li) => {
      const discount = (li.discountAllocations || []).reduce(
        (sum, d) => sum + Number(d.allocatedAmount?.amount || 0),
        0,
      );
      const unitRefund =
        Number(li.price?.amount || 0) - discount / Math.max(li.quantity, 1);
      return {
        id: li.id,
        name: li.name,
        title: li.title || li.name,
        // Shopify uses "Default Title" for products without variants
        variantTitle:
          li.variantTitle && li.variantTitle !== 'Default Title'
            ? li.variantTitle
            : '',
        sku: li.sku || '',
        imageUrl: li.image?.url || '',
        imageAlt: li.image?.altText || li.title || li.name,
        unitPrice: Number(li.price?.amount || 0),
        orderedQuantity: li.quantity,
        quantity:
          Math.min(li.quantity, inWindowQty[li.id] || 0) -
          (alreadyRequested[li.id] || 0),
        unitRefund: Math.max(unitRefund, 0),
        currencyCode: li.price?.currencyCode || '',
      };
    })
    .filter((li) => li.quantity > 0);

  return {items, requests, status};
}

/**
 * Loads the order and works out what can still be returned. Used by both the
 * button and the pop-up, so they always agree.
 */
export async function loadReturnState(orderId, {windowDays, finalSaleTag}) {
  const data = await customerApi(ORDER_FOR_RETURN_QUERY, {orderId});
  const order = data?.order;
  const finalSaleIds = await productsWithTag(
    (order?.lineItems?.nodes || []).map((li) => li.productId),
    finalSaleTag,
  );
  return returnableFromOrder(order, {windowDays, finalSaleIds});
}
