import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {loadReturnState} from './api.js';
import {getFinalSaleTag, getReturnWindowDays, TEXT} from './reasons.js';

// Adds a "Request a return" button to each order. It shows when the order
// has items the customer can still return, or requests they already sent
// (so they can see their status).
// A button with no onClick/href automatically opens the modal target.
export default async () => {
  let show = false;
  try {
    const {items, requests} = await loadReturnState(shopify.orderId, {
      windowDays: getReturnWindowDays(),
      finalSaleTag: getFinalSaleTag(),
    });
    show = items.length > 0 || requests.length > 0;
  } catch (error) {
    // Show the button anyway: the modal re-runs the check and shows the
    // real error to the customer instead of the button silently vanishing.
    console.warn('Could not check returnable items', error);
    show = true;
  }

  render(<RequestReturnButton show={show} />, document.body);
};

function RequestReturnButton({show}) {
  if (!show) return null;
  return <s-button>{TEXT.buttonLabel}</s-button>;
}
