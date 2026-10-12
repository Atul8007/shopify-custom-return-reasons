/**
 * ============================================================
 *  Default reasons customers see.
 * ============================================================
 *
 * You can change the reasons without code in Shopify admin >
 * Settings > Customer accounts > Customize (the "Reason 1-8" boxes).
 * The list below is only used when all of those boxes are empty.
 *
 * label        - exactly what the customer sees in the dropdown.
 * noteRequired - true = the customer must type an explanation.
 *
 * The chosen reason is saved on the order (Return reason field), where it
 * shows in the order list filter and in Analytics.
 *
 * Other settings in the same editor: Return window (days), Final-sale tag,
 * Return fees note, Hide refund estimate.
 */
export const CUSTOM_REASONS = [
  {label: 'Wac custom message'},
  {label: 'Kaust custom message'},
];

/** How many "Reason N" boxes shopify.extension.toml defines. */
const SETTINGS_REASON_SLOTS = 8;

/** Return window used when the "Return window (days)" box is empty. */
const DEFAULT_RETURN_WINDOW_DAYS = 30;

/**
 * The reasons to show: the ones typed into the customer accounts editor
 * (Settings > Customer accounts > Customize), or CUSTOM_REASONS above if
 * every box there is empty.
 */
export function getReasons() {
  const settings = shopify.settings?.value || {};
  const fromSettings = [];
  for (let i = 1; i <= SETTINGS_REASON_SLOTS; i++) {
    const label = String(settings[`reason_${i}`] ?? '').trim();
    if (label) fromSettings.push({label});
  }
  return fromSettings.length ? fromSettings : CUSTOM_REASONS;
}

/** Days after delivery/fulfillment that items can be returned (editor setting). */
export function getReturnWindowDays() {
  const days = Number(shopify.settings?.value?.return_window_days);
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_RETURN_WINDOW_DAYS;
}

/** Products with this tag can't be returned (editor setting). */
export function getFinalSaleTag() {
  const tag = String(shopify.settings?.value?.final_sale_tag ?? '').trim();
  return tag || 'final-sale';
}

/** Fees text shown in the pop-up, e.g. "Return shipping: $5" (editor setting). */
export function getFeesNote() {
  return String(shopify.settings?.value?.return_fees_note ?? '').trim();
}

/** Whether to show the estimated refund (editor setting, on by default). */
export function getShowRefundEstimate() {
  return shopify.settings?.value?.hide_refund_estimate !== true;
}

/** Text shown in the modal. Change freely. */
export const TEXT = {
  buttonLabel: 'Request a return',
  heading: 'Request a return',
  itemsIntro: 'Select the items you want to return.',
  quantityLabel: 'Quantity',
  returnableLabel: 'Can return',
  reasonLabel: 'Reason',
  reasonPlaceholder: 'Select a reason',
  noteLabel: 'Tell us more',
  noteLabelOptional: 'Tell us more (optional)',
  submit: 'Submit request',
  submitting: 'Submitting…',
  loading: 'Loading your items…',
  requestedOn: 'Requested',
  noteLabelShort: 'Note',
  cancel: 'Cancel',
  close: 'Close',
  // {count} is replaced with "1 item" / "2 items"
  success:
    "Return requested for {count}. We'll review it and email you with the next steps.",
  previousRequests: 'Your return requests',
  statusPending: 'Pending review',
  nothingMoreReturnable: 'There are no more items in this order that can be returned.',
  requestMore: 'Return more items',
  estimateLabel: 'Estimated refund (before fees)',
  estimateHint: 'The final amount is confirmed when we process your return.',
  nothingReturnable: 'There are no items in this order that can be returned.',
  pickItem: 'Please select at least one item to return.',
  pickReason: 'Please choose a reason.',
  noteNeeded: 'Please tell us a little more.',
  genericError: 'Something went wrong. Please try again, or contact us.',
};

/** Keep notes short so the saved request stays readable. */
export const NOTE_MAX_LENGTH = 250;
