export function throttle<T extends (...args: unknown[]) => void>(fn: T, waitMs: number) {
  let last = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = waitMs - (now - last);

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      last = now;
      fn(...args);
      return;
    }

    pendingArgs = args;
    if (!timeout) {
      timeout = setTimeout(() => {
        last = Date.now();
        timeout = null;
        if (pendingArgs) {
          fn(...pendingArgs);
          pendingArgs = null;
        }
      }, remaining);
    }
  };
}
