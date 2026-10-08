/**
 * One place that caught errors are reported from. The error-tracking service (OPS-01) is not chosen yet, so
 * this is the seam it plugs into: call `setErrorReporter(fn)` once at start-up (src/main.jsx) with a function
 * that sends the error to the service. Until then errors go to the console.
 *
 * `reportError` never throws: it is called from inside error boundaries, where a second failure would be the
 * one thing worse than the first.
 */
let reporter = (error, context) => {
  console.error("Unhandled UI error", context.errorId, error, context.componentStack || "");
};

export function setErrorReporter(fn) {
  reporter = typeof fn === "function" ? fn : () => {};
}

export function newErrorId() {
  return Math.random().toString(36).slice(2, 10);
}

/** `context`: { errorId, componentStack, boundary: "app" | "route", route }. */
export function reportError(error, context = {}) {
  try {
    reporter(error, { errorId: newErrorId(), ...context });
  } catch {
    // Reporting must never be what breaks the recovery screen.
  }
}
