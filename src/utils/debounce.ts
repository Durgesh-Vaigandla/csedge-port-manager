export function debounce<T extends (...args: never[]) => void>(fn: T, delayMs: number): T {
  let timer: NodeJS.Timeout | undefined;

  return ((...args: Parameters<T>) => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      fn(...args);
    }, delayMs);
  }) as T;
}
