import { DataStore } from '../database/data-store';
import { GachaPool, GachaPrize, GachaSpin, GachaClaim } from '../types';
import { AppError } from '../middleware/error-handler';
import { NotificationService } from './notification.service';

export class GachaService {
  static getPools(): (GachaPool & { prizes: GachaPrize[] })[] {
    return DataStore.getGachaPools();
  }

  static getPoolById(poolId: string): (GachaPool & { prizes: GachaPrize[] }) {
    const pool = DataStore.getGachaPoolById(poolId);
    if (!pool) {
      throw new AppError('Gacha pool not found', 404, 'POOL_NOT_FOUND');
    }
    return pool;
  }

  // Server-Authoritative Gacha Spin
  static async spin(params: {
    poolId: string;
    customerId: string;
    telegramId: number;
    idempotencyKey?: string;
  }): Promise<{
    spin: GachaSpin;
    claim: GachaClaim;
    prize: GachaPrize;
    ticketsRemaining?: number;
    nextRollAt?: string;
  }> {
    const pool = DataStore.getGachaPoolById(params.poolId);
    if (!pool || !pool.is_active) {
      throw new AppError('Gacha pool is currently unavailable', 400, 'POOL_INACTIVE');
    }

    const result = DataStore.spinGacha(
      params.poolId,
      params.customerId,
      params.telegramId,
      params.idempotencyKey
    );

    if (!result) {
      throw new AppError('Failed to execute gacha spin', 500, 'SPIN_FAILED');
    }

    if (result.error) {
      throw new AppError(result.error, 400, result.code || 'SPIN_ERROR');
    }

    // Route notifications for manual service & trade dispatch
    if (result.prize.delivery_mode === 'manual_service') {
      NotificationService.alertAdminManualServiceGachaWin(
        params.telegramId,
        result.prize.title,
        result.claim.id
      ).catch(console.error);
    } else if (result.prize.delivery_mode === 'trade_item') {
      NotificationService.alertAdminTradeItemGachaWin(
        params.telegramId,
        result.prize.title,
        result.claim.id,
        result.claim.delivery_data?.trade_id
      ).catch(console.error);
    }

    // If Mythical Win, send immediate alert to Admin Bot!
    if (result.prize.rarity === 'MYTHICAL') {
      NotificationService.alertAdminMythicalGachaWin(
        params.telegramId,
        result.prize.title
      ).catch(console.error);
    }

    return result as {
      spin: GachaSpin;
      claim: GachaClaim;
      prize: GachaPrize;
      ticketsRemaining?: number;
      nextRollAt?: string;
    };
  }

  static buyTickets(telegramId: number, quantity: number = 1) {
    const res = DataStore.buyGachaTickets(telegramId, quantity);
    if (!res.success) {
      throw new AppError(res.error || 'Failed to purchase gacha tickets', 400, res.error);
    }
    return res;
  }

  static getStatus(telegramId: number) {
    return DataStore.getGachaStatus(telegramId);
  }

  static getRecentWinners(limit: number = 10) {
    return DataStore.getRecentWinners(limit);
  }

  static getCustomerPrizes(telegramId: number): GachaClaim[] {
    return DataStore.getCustomerGachaPrizes(telegramId);
  }

  static submitClaimData(
    claimId: string,
    telegramId: number,
    deliveryData: any
  ): GachaClaim {
    const claims = DataStore.getCustomerGachaPrizes(telegramId);
    const userClaim = claims.find((c) => c.id === claimId);
    if (!userClaim) {
      throw new AppError('Claim not found or unauthorized', 404, 'CLAIM_NOT_FOUND');
    }

    userClaim.delivery_data = deliveryData;
    userClaim.status = 'pending_review';
    return userClaim;
  }
}
