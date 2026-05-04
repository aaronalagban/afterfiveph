export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 60000,
  jitter: boolean = true
): Promise<T> {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        throw error;
      }

      let delay = baseDelay * Math.pow(2, attempt - 1);
      if (jitter) {
        delay = delay * (0.5 + Math.random());
      }
      delay = Math.min(delay, maxDelay);

      console.warn(`Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Retry failed"); // Should not reach here
}
