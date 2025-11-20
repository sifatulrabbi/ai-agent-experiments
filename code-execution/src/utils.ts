type TryCatchResult<T> =
  | { data: T; error: null }
  | { data: null; error: Error };

export async function tryCatch<T>(
  fn: () => Promise<T>,
): Promise<TryCatchResult<T>> {
  try {
    const res = await fn();
    return { data: res, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
