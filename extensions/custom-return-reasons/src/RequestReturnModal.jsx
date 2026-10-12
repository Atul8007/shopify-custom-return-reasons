import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';
import {
  customerApi,
  FIELDS,
  loadReturnState,
  SAVE_REQUEST_MUTATION,
} from './api.js';
import {
  getFeesNote,
  getFinalSaleTag,
  getReasons,
  getReturnWindowDays,
  getShowRefundEstimate,
  NOTE_MAX_LENGTH,
  TEXT,
} from './reasons.js';

// Reasons from the customer accounts editor, or the defaults in reasons.js
let REASONS = [];

export default async () => {
  REASONS = getReasons();
  render(<RequestReturnModal />, document.body);
};

// What the customer has entered for one returnable line item
const EMPTY_CHOICE = {selected: false, quantity: '1', reasonIndex: '', note: ''};

function RequestReturnModal() {
  const orderId = shopify.orderId;

  const [status, setStatus] = useState('loading'); // loading | ready | empty | done | error
  const [items, setItems] = useState([]); // [{quantity, unitRefund, currencyCode, lineItem: {id, name}}]
  const [requests, setRequests] = useState([]); // earlier requests on this order
  const [requestStatus, setRequestStatus] = useState('');
  const [choices, setChoices] = useState({}); // lineItemId -> choice
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({}); // lineItemId -> {reason, note}
  const [submitError, setSubmitError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [submittedUnits, setSubmittedUnits] = useState(0);

  // Load the order: earlier requests, and the items that can still be returned
  useEffect(() => {
    (async () => {
      try {
        const state = await loadReturnState(orderId, {
          windowDays: getReturnWindowDays(),
          finalSaleTag: getFinalSaleTag(),
        });
        setRequests(state.requests);
        setRequestStatus(state.status);
        if (!state.items.length && !state.requests.length) {
          setStatus('empty');
          return;
        }
        // Same shape the form below uses: {quantity, lineItem: {id, name, …}}
        const nodes = state.items.map((li) => ({
          quantity: li.quantity,
          unitRefund: li.unitRefund,
          currencyCode: li.currencyCode,
          lineItem: li,
        }));
        setItems(nodes);
        // Pre-select the item when there's only one
        const initial = {};
        for (const n of nodes) {
          initial[n.lineItem.id] = {
            ...EMPTY_CHOICE,
            selected: nodes.length === 1,
          };
        }
        setChoices(initial);
        setStatus('ready');
      } catch (error) {
        console.warn(error);
        setLoadError(String(error?.message || error));
        setStatus('error');
      }
    })();
  }, [orderId]);

  function updateChoice(lineItemId, patch) {
    setChoices((prev) => ({
      ...prev,
      [lineItemId]: {...prev[lineItemId], ...patch},
    }));
    // Ticking an item answers "Please select at least one item"
    if (patch.selected) {
      setSubmitError((prev) => (prev === TEXT.pickItem ? '' : prev));
    }
    // Choosing a reason or typing a note answers that field's error
    const answered = [
      patch.reasonIndex ? 'reason' : '',
      patch.note?.trim() ? 'note' : '',
    ].filter(Boolean);
    if (answered.length) {
      setErrors((prev) => {
        if (!prev[lineItemId]) return prev;
        const rest = {...prev[lineItemId]};
        for (const field of answered) delete rest[field];
        return {...prev, [lineItemId]: rest};
      });
    }
  }

  const picked = items.filter((n) => choices[n.lineItem.id]?.selected);

  async function onSubmit() {
    // Validate
    const nextErrors = {};
    for (const n of picked) {
      const c = choices[n.lineItem.id];
      const reason =
        c.reasonIndex === '' ? null : REASONS[Number(c.reasonIndex)];
      const e = {};
      if (!reason) e.reason = TEXT.pickReason;
      if (reason?.noteRequired && !c.note.trim()) e.note = TEXT.noteNeeded;
      if (Object.keys(e).length) nextErrors[n.lineItem.id] = e;
    }
    setErrors(nextErrors);
    setSubmitError(picked.length ? '' : TEXT.pickItem);
    if (!picked.length || Object.keys(nextErrors).length) return;

    // Add this request to the earlier ones and save them all on the order
    const newRequest = {
      at: new Date().toISOString().slice(0, 10),
      items: picked.map((n) => {
        const c = choices[n.lineItem.id];
        return {
          id: n.lineItem.id,
          name: n.lineItem.name,
          quantity: Number(c.quantity),
          reason: REASONS[Number(c.reasonIndex)].label,
          note: c.note.trim(),
        };
      }),
    };
    const allRequests = [...requests, newRequest];

    setSubmitting(true);
    try {
      const data = await customerApi(SAVE_REQUEST_MUTATION, {
        metafields: [
          {
            ownerId: orderId,
            ...FIELDS.reason,
            type: 'single_line_text_field',
            value: mainReason(newRequest).slice(0, 255),
          },
          {
            ownerId: orderId,
            ...FIELDS.request,
            type: 'multi_line_text_field',
            value: allRequests.map(formatRequest).join('\n\n'),
          },
          {
            ownerId: orderId,
            ...FIELDS.data,
            type: 'json',
            value: JSON.stringify({requests: allRequests}),
          },
          {
            ownerId: orderId,
            ...FIELDS.status,
            type: 'single_line_text_field',
            value: 'Pending',
          },
        ],
      });
      const userErrors = data?.metafieldsSet?.userErrors || [];
      if (userErrors.length) {
        console.warn('Could not save return request', userErrors);
        setSubmitError(
          `${TEXT.genericError} (${userErrors.map((e) => e.message).join(' ')})`,
        );
      } else {
        setSubmittedUnits(
          newRequest.items.reduce((sum, it) => sum + it.quantity, 0),
        );
        setStatus('done');
      }
    } catch (error) {
      console.warn(error);
      setSubmitError(`${TEXT.genericError} (${error?.message || error})`);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = status === 'ready' && items.length > 0;

  return (
    <s-customer-account-action heading={TEXT.heading}>
      <Body
        status={status}
        items={items}
        requests={requests}
        requestStatus={requestStatus}
        picked={picked}
        choices={choices}
        updateChoice={updateChoice}
        errors={errors}
        submitError={submitError}
        loadError={loadError}
        submittedUnits={submittedUnits}
      />

      {status === 'loading' ? null : canSubmit ? (
        <>
          {/* A label instead of the loading prop, which renders as a blank
              blue button */}
          <s-button
            slot="primary-action"
            disabled={submitting}
            onClick={onSubmit}
          >
            {submitting ? TEXT.submitting : TEXT.submit}
          </s-button>
          <s-button slot="secondary-actions" onClick={() => shopify.close()}>
            {TEXT.cancel}
          </s-button>
        </>
      ) : (
        // Swap the primary button for "Close" rather than removing it, so
        // the submit spinner can't linger after the request is sent.
        <s-button slot="primary-action" onClick={() => shopify.close()}>
          {TEXT.close}
        </s-button>
      )}
    </s-customer-account-action>
  );
}

// The single reason stored in Return reason: the one covering the most units
// in the latest request (first one on a tie). Order filters and Analytics
// match the field's whole value, so it must never hold several reasons;
// the full breakdown stays in Return request / Return data.
function mainReason(request) {
  const units = new Map();
  for (const it of request.items) {
    units.set(it.reason, (units.get(it.reason) || 0) + it.quantity);
  }
  let best = '';
  for (const [reason, qty] of units) {
    if (!best || qty > units.get(best)) best = reason;
  }
  return best;
}

// One request as plain text for the Return request field in admin
function formatRequest(r) {
  return [
    `Requested ${formatDate(r.at)}`,
    ...r.items.map(
      (it) =>
        `- ${it.name} x ${it.quantity}: ${it.reason}${
          it.note ? ` (note: ${it.note})` : ''
        }`,
    ),
  ].join('\n');
}

// "2026-10-12" -> "12 Oct 2026": always day-month-year so it can't be misread,
// with the month name in the customer's language
function formatDate(isoDate) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  let month;
  try {
    const language = shopify.localization?.language?.value?.isoCode;
    month = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(
      language || undefined,
      {month: 'short', timeZone: 'UTC'},
    );
  } catch {
    month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
      'Oct', 'Nov', 'Dec'][m - 1];
  }
  return `${d} ${month} ${y}`;
}

function formatMoney(amount, currencyCode) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currencyCode}`;
  }
}

function Body(props) {
  const {status} = props;

  if (status === 'loading')
    return (
      <s-stack direction="inline" gap="base" alignItems="center">
        <s-spinner accessibilityLabel={TEXT.loading} />
        <s-text color="subdued">{TEXT.loading}</s-text>
      </s-stack>
    );
  if (status === 'empty')
    return <s-banner tone="info">{TEXT.nothingReturnable}</s-banner>;
  if (status === 'error')
    return (
      <s-banner tone="critical">
        {TEXT.genericError}
        {props.loadError ? ` (${props.loadError})` : ''}
      </s-banner>
    );
  if (status === 'done') {
    const n = props.submittedUnits;
    const count = `${n} ${n === 1 ? 'item' : 'items'}`;
    return (
      <s-banner tone="success">{TEXT.success.replace('{count}', count)}</s-banner>
    );
  }

  const {items, requests} = props;

  return (
    <s-stack direction="block" gap="base">
      {requests.length ? (
        <PreviousRequests
          requests={requests}
          requestStatus={props.requestStatus}
        />
      ) : null}

      {/* One container keeps the heading above the form; loose siblings
          inside fragments were rendered in the wrong order */}
      {items.length ? (
        <s-stack direction="block" gap="base">
          {requests.length ? <s-divider /> : null}
          {requests.length ? <s-heading>{TEXT.requestMore}</s-heading> : null}
          <ReturnForm {...props} />
        </s-stack>
      ) : (
        <s-text>{TEXT.nothingMoreReturnable}</s-text>
      )}
    </s-stack>
  );
}

// Earlier requests on this order. Staff set ONE status per order, so the
// badge sits on the heading and covers the whole group; a badge per request
// would show a wrong status on older ones.
function PreviousRequests({requests, requestStatus}) {
  const shown =
    !requestStatus || requestStatus === 'Pending'
      ? TEXT.statusPending
      : requestStatus;
  return (
    <s-stack direction="block" gap="base">
      <s-stack direction="inline" gap="base" alignItems="center">
        <s-heading>{TEXT.previousRequests}</s-heading>
        <s-badge>{shown}</s-badge>
      </s-stack>
      {requests.map((r, i) => (
        <s-stack key={i} direction="block" gap="small-200">
          <s-text type="strong">
            {`${TEXT.requestedOn} ${formatDate(r.at)}`}
          </s-text>
          {/* Name, quantity/reason and note on their own lines, so mixed
              Arabic/English names don't scramble the reading order */}
          {r.items.map((it) => (
            <s-stack key={it.id} direction="block" gap="small-200">
              <s-text>{it.name}</s-text>
              <s-text color="subdued">
                {`${TEXT.quantityLabel}: ${it.quantity} · ${TEXT.reasonLabel}: ${it.reason}`}
              </s-text>
              {it.note ? (
                <s-text color="subdued">
                  {`${TEXT.noteLabelShort}: ${it.note}`}
                </s-text>
              ) : null}
            </s-stack>
          ))}
        </s-stack>
      ))}
    </s-stack>
  );
}

function ReturnForm(props) {
  const {items, picked, choices, updateChoice, errors, submitError} = props;

  const estimate = picked.reduce(
    (sum, n) =>
      sum + n.unitRefund * Number(choices[n.lineItem.id]?.quantity || 0),
    0,
  );
  const currency = items[0]?.currencyCode;
  const feesNote = getFeesNote();

  const showEstimate = getShowRefundEstimate() && estimate > 0 && currency;

  return (
    <s-stack direction="block" gap="base">
      {items.length > 1 ? <s-text>{TEXT.itemsIntro}</s-text> : null}

      {items.map((n, i) => (
        <s-stack key={n.lineItem.id} direction="block" gap="base">
          {i > 0 ? <s-divider /> : null}
          <ItemRow
            node={n}
            choice={choices[n.lineItem.id] || EMPTY_CHOICE}
            onChange={(patch) => updateChoice(n.lineItem.id, patch)}
            errors={errors[n.lineItem.id] || {}}
          />
        </s-stack>
      ))}

      {/* Estimate and fees together, so it's clear the fees come off it */}
      {showEstimate || feesNote ? (
        <s-stack direction="block" gap="small-200">
          {showEstimate ? (
            <s-text type="strong">
              {`${TEXT.estimateLabel}: ${formatMoney(estimate, currency)}`}
            </s-text>
          ) : null}
          {feesNote ? <s-text>{feesNote}</s-text> : null}
          {showEstimate ? (
            <s-text color="subdued">{TEXT.estimateHint}</s-text>
          ) : null}
        </s-stack>
      ) : null}

      {/* Errors go last, beside the buttons, so they don't push the item
          list down just as the customer reaches for a checkbox */}
      {submitError ? <s-banner tone="critical">{submitError}</s-banner> : null}
    </s-stack>
  );
}

// Product name, variant, SKU, price and how many can be returned
function ItemDetails({item, returnable}) {
  const facts = [
    item.variantTitle,
    item.sku ? `SKU: ${item.sku}` : '',
  ].filter(Boolean);
  const qtyText =
    returnable < item.orderedQuantity
      ? `${TEXT.returnableLabel}: ${returnable} of ${item.orderedQuantity}`
      : `${TEXT.quantityLabel}: ${item.orderedQuantity}`;

  return (
    <s-stack direction="block" gap="small-200">
      <s-text type="strong">{item.title}</s-text>
      {facts.length ? <s-text color="subdued">{facts.join(' · ')}</s-text> : null}
      <s-text color="subdued">
        {`${qtyText} · ${formatMoney(item.unitPrice, item.currencyCode)}`}
      </s-text>
    </s-stack>
  );
}

// One returnable item: checkbox, picture and details, then quantity /
// reason / note once ticked
function ItemRow({node, choice, onChange, errors}) {
  const {lineItem, quantity: maxQty} = node;
  const reason =
    choice.reasonIndex === ''
      ? null
      : REASONS[Number(choice.reasonIndex)];

  return (
    <s-stack direction="block" gap="small-200">
      {/* A grid, not an inline stack: the text column shrinks and wraps long
          names beside the picture instead of dropping onto its own line */}
      <s-grid gridTemplateColumns="auto auto 1fr" gap="base" alignItems="center">
        <s-checkbox
          accessibilityLabel={lineItem.name}
          checked={choice.selected}
          onChange={(e) => onChange({selected: e.currentTarget.checked})}
        />
        <s-product-thumbnail
          src={lineItem.imageUrl || undefined}
          alt={lineItem.imageAlt}
          size="small"
        />
        <ItemDetails item={lineItem} returnable={maxQty} />
      </s-grid>

      {choice.selected ? (
        <s-stack direction="block" gap="base">
          {/* Quantity: only when more than one unit can be returned */}
          {maxQty > 1 ? (
            <s-select
              label={TEXT.quantityLabel}
              value={choice.quantity}
              onChange={(e) => onChange({quantity: e.currentTarget.value})}
            >
              {Array.from({length: maxQty}, (_, i) => String(i + 1)).map(
                (q) => (
                  <s-option key={q} value={q}>
                    {q}
                  </s-option>
                ),
              )}
            </s-select>
          ) : null}

          {/* YOUR custom reasons */}
          <s-select
            label={TEXT.reasonLabel}
            value={choice.reasonIndex}
            error={errors.reason}
            onChange={(e) => onChange({reasonIndex: e.currentTarget.value})}
          >
            <s-option value="" disabled>
              {TEXT.reasonPlaceholder}
            </s-option>
            {REASONS.map((r, i) => (
              <s-option key={r.label} value={String(i)}>
                {r.label}
              </s-option>
            ))}
          </s-select>

          <s-text-area
            label={
              reason?.noteRequired ? TEXT.noteLabel : TEXT.noteLabelOptional
            }
            value={choice.note}
            maxLength={NOTE_MAX_LENGTH}
            error={errors.note}
            onInput={(e) => onChange({note: e.currentTarget.value})}
          />
        </s-stack>
      ) : null}
    </s-stack>
  );
}
