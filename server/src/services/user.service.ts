import {
  getUser as storeGetUser,
  saveUser as storeSaveUser,
  claimDailyReward as storeClaimDailyReward,
  SaveUserInput,
  StoredUser,
  ClaimResult,
} from '../database/data-store';

export type { SaveUserInput, StoredUser, ClaimResult };

export async function getUser(telegramId: string | number): Promise<StoredUser | null> {
  return storeGetUser(telegramId);
}

export async function saveUser(input: SaveUserInput): Promise<StoredUser> {
  return storeSaveUser(input);
}

export async function claimDailyReward(telegramId: string | number): Promise<ClaimResult> {
  return storeClaimDailyReward(telegramId);
}

export interface ClientUser {
  telegram_id: string;
  points: number;
  streak_count: number;
  last_daily_claim_at: string | null;
  server_now: string;
}

/** Shape the store UI needs for the daily bar. `server_now` lets the client fix its clock skew. */
export async function getUserForClient(telegramId: string | number): Promise<ClientUser> {
  const user = await storeGetUser(telegramId);
  return {
    telegram_id: String(telegramId),
    points: user?.points ?? 0,
    streak_count: user?.streakCount ?? 0,
    last_daily_claim_at: user?.lastDailyClaimAt ?? null,
    server_now: new Date().toISOString(),
  };
}
