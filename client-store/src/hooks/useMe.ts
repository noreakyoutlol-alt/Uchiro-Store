import { useUser, UserState, dispatchPointsSync } from './useUser';

/**
 * Shared hook to access current user data, real-time points balance, and streak status.
 */
export function useMe(initialTelegramId?: string | number) {
  return useUser(initialTelegramId);
}

export type { UserState };
export { dispatchPointsSync };
export default useMe;
