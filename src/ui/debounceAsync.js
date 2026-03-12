export default function debounceAsync(fn, waitMs) {
  let timeoutId = 0;
  let pendingPromise = null;
  let resolvePending = null;
  let rejectPending = null;

  return (...args) => {
    if (timeoutId !== 0) {
      clearTimeout(timeoutId);
    }

    // Reuse one pending promise so callers inside the debounce window share one request.
    if (!pendingPromise) {
      pendingPromise = new Promise((resolve, reject) => {
        resolvePending = resolve;
        rejectPending = reject;
      });
    }

    timeoutId = setTimeout(async () => {
      try {
        const result = await fn(...args);
        resolvePending(result);
      } catch (error) {
        rejectPending(error);
      } finally {
        timeoutId = 0;
        pendingPromise = null;
        resolvePending = null;
        rejectPending = null;
      }
    }, waitMs);

    return pendingPromise;
  };
}
