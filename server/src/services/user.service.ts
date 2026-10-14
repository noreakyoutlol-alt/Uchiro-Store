import {
  getUser as storeGetUser,
  saveUser as storeSaveUser,
  claimDailyReward as storeClaimDailyReward,
  getUserSnapshot,
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
  const snap = await getUserSnapshot(telegramId);
  return {
    telegram_id: String(telegramId),
    points: snap.points,
    streak_count: snap.streak,
    last_daily_claim_at: snap.lastDailyClaimAt,
    server_now: new Date().toISOString(),
  };
}
