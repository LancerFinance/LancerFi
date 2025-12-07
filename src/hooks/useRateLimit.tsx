import { useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface UseRateLimitOptions {
  minTimeBetweenCalls?: number; // Minimum time in milliseconds between calls (default: 2000ms)
  actionName?: string; // Name of the action for error messages
}

/**
 * Hook to prevent spam clicking and rate limit actions
 * Returns a function that checks if enough time has passed since last call
 */
export function useRateLimit(options: UseRateLimitOptions = {}) {
  const { minTimeBetweenCalls = 2000, actionName = 'action' } = options;
  const lastCallTimeRef = useRef<number>(0);
  const { toast } = useToast();

  /**
   * Check if action can be performed (enough time has passed)
   * Returns true if action can proceed, false if rate limited
   */
  const canProceed = (): boolean => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTimeRef.current;

    if (timeSinceLastCall < minTimeBetweenCalls) {
      const remainingTime = Math.ceil((minTimeBetweenCalls - timeSinceLastCall) / 1000);
      toast({
        title: "Please Wait",
        description: `Please wait ${remainingTime} second${remainingTime > 1 ? 's' : ''} before ${actionName} again.`,
        variant: "destructive",
      });
      return false;
    }

    // Update last call time
    lastCallTimeRef.current = now;
    return true;
  };

  /**
   * Wrapper function that can be used to wrap async handlers
   * Automatically checks rate limit before executing
   */
  const rateLimited = <T extends (...args: any[]) => Promise<any>>(
    handler: T
  ): T => {
    return (async (...args: Parameters<T>) => {
      if (!canProceed()) {
        throw new Error(`Rate limited: ${actionName}`);
      }
      return handler(...args);
    }) as T;
  };

  return {
    canProceed,
    rateLimited,
  };
}

