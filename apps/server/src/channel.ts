/** A minimal push-based async iterable: the LLM side pushes sentences, TTS consumes them. */
export function createChannel<T>() {
  const items: T[] = [];
  let closed = false;
  let wake: (() => void) | null = null;

  const iterable: AsyncIterable<T> = {
    async *[Symbol.asyncIterator]() {
      while (true) {
        if (items.length) {
          yield items.shift()!;
          continue;
        }
        if (closed) return;
        await new Promise<void>((r) => (wake = r));
      }
    },
  };

  const notify = () => {
    wake?.();
    wake = null;
  };

  return {
    iterable,
    push(item: T) {
      items.push(item);
      notify();
    },
    close() {
      closed = true;
      notify();
    },
  };
}
