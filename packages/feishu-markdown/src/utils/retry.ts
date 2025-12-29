/**
 * 延迟指定毫秒数
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带指数退避的重试函数
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    baseDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: unknown) => boolean;
    calculateDelay?: (error: unknown, attempt: number) => number;
  } = {}
): Promise<T> {
  const {
    retries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = () => true,
    calculateDelay,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === retries || !shouldRetry(error)) {
        throw error;
      }

      let delayMs: number;
      if (calculateDelay) {
        delayMs = calculateDelay(error, attempt);
      } else {
        // 计算指数退避延迟
        delayMs = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        // 添加抖动（±25%）
        const jitter = delayMs * (0.75 + Math.random() * 0.5);
        delayMs = jitter;
      }

      await delay(delayMs);
    }
  }

  throw lastError;
}
