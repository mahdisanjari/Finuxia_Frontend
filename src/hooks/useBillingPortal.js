import { useState } from "react";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";

/**
 * Opens Stripe's hosted billing page, where the customer updates their card and sees their invoices.
 *
 *   const { opening, openPortal } = useBillingPortal();
 *   <button onClick={() => openPortal()}>Manage payment method</button>
 *   <button onClick={() => openPortal("payment_method_update")}>Update card</button>   // straight to the card form
 *
 * The browser is sent away to Stripe, which sends it back to the billing page; where it returns to is chosen by the server, not here.
 * A failure is a toast and the page stays as it is.
 */
export default function useBillingPortal() {
  const { addToast } = useToast();
  const [opening, setOpening] = useState(false);

  const openPortal = async (flow) => {
    setOpening(true);
    try {
      const { url } = await api.openBillingPortal(flow);
      window.location.href = url;
    } catch (err) {
      addToast(err.message || "Could not open billing management. Try again in a moment.");
      setOpening(false);
    }
    // on success the page is being left, so `opening` stays true: no second click while the browser navigates
  };

  return { opening, openPortal };
}
