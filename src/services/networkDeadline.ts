// Bound small bootstrap requests, never large attachment downloads.
export async function withNetworkDeadline<T>(
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException(
          'Сервер не отвечает. Сохранённые данные доступны без сети.',
          'TimeoutError',
        ),
      ),
    5_000,
  );
  try {
    return await work(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}
