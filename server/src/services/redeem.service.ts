import crypto from 'crypto';
import { DataStore } from '../database/data-store';
import {
  RedeemCode,
  RedeemCodeUsage,
  RedeemCodeResult,
  RedeemRewardType,
  RedeemCodeUseMode,
  CouponRewardData,
} from '../types';
import { AppError } from '../middleware/error-handler';
import { NotificationService } from './notification.service';

export interface CreateRedeemCodeInput {
  code?: string;
  reward_type: RedeemRewardType;
  reward_amount?: number;
  reward_data?: Partial<CouponRewardData>;
  use_mode?: RedeemCodeUseMode;
  max_uses?: number | null;
  per_user_limit?: number;
  is_active?: boolean;
  expires_at?: string | null;
}

export interface RedeemCodeFilter {
  search?: string;
  reward_type?: string;
  status?: 'all' | 'active' | 'inactive' | 'expired' | 'exhausted';
}

export class RedeemCodeService {
  /**
   * Generates a cryptographically unpredictable code (e.g., UCH-9K2M-7X4P).
   */
  static generateUnpredictableCode(prefix = 'UCH'): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude confusing chars like 0/O, 1/I
    const getRandomBlock = (len: number) => {
      const bytes = crypto.randomBytes(len);
      let res = '';
      for (let i = 0; i < len; i++) {
        res += chars[bytes[i] % chars.length];
      }
      return res;
    };
    return `${prefix.toUpperCase().trim()}-${getRandomBlock(4)}-${getRandomBlock(4)}`;
  }

  /**
   * List all redeem codes with optional filtering.
   */
  static listCodes(filters?: RedeemCodeFilter): RedeemCode[] {
    let codes = DataStore.getRedeemCodes();

    if (!filters) return codes;

    if (filters.search) {
      const q = filters.search.trim().toUpperCase();
      codes = codes.filter((c) => c.code.toUpperCase().includes(q));
    }

    if (filters.reward_type && filters.reward_type !== 'all') {
      codes = codes.filter((c) => c.reward_type === filters.reward_type);
    }

    if (filters.status && filters.status !== 'all') {
      const now = Date.now();
      codes = codes.filter((c) => {
        const isExpired = Boolean(c.expires_at && new Date(c.expires_at).getTime() < now);
        const isExhausted = Boolean(c.max_uses !== null && c.times_used >= c.max_uses);

        if (filters.status === 'expired') return isExpired;
        if (filters.status === 'exhausted') return isExhausted;
        if (filters.status === 'inactive') return !c.is_active;
        if (filters.status === 'active') return c.is_active && !isExpired && !isExhausted;
        return true;
      });
    }

    return codes;
  }

  /**
   * Get single redeem code by ID.
   */
  static getCodeById(id: string): RedeemCode {
    const code = DataStore.getRedeemCodeById(id);
    if (!code) {
      throw new AppError('Redeem code not found', 404, 'CODE_NOT_FOUND');
    }
    return code;
  }

  /**
   * Create a new redeem code with strict server-side validation.
   */
  static createCode(adminTelegramId: number, input: CreateRedeemCodeInput): RedeemCode {
    const codeStr = input.code?.trim() || this.generateUnpredictableCode();
    const cleanCode = codeStr.toUpperCase().replace(/[^A-Z0-9_-]/g, '');

    if (!cleanCode || cleanCode.length < 3 || cleanCode.length > 32) {
      throw new AppError(
        'Redeem code must be between 3 and 32 characters (alphanumeric and dashes)',
        400,
        'INVALID_CODE_FORMAT'
      );
    }

    // Validate reward type
    const validRewardTypes: RedeemRewardType[] = ['points', 'gacha_tickets', 'discount_coupon'];
    if (!validRewardTypes.includes(input.reward_type)) {
      throw new AppError('Invalid reward type. Supported types: points, gacha_tickets, discount_coupon', 400, 'INVALID_REWARD_TYPE');
    }

    // Validate reward amount
    let rewardAmount = Math.max(0, Math.floor(Number(input.reward_amount) || 0));
    const rewardData: any = input.reward_data ? { ...input.reward_data } : {};

    if (input.reward_type === 'points') {
      if (rewardAmount <= 0) {
        throw new AppError('Points reward amount must be a positive integer', 400, 'INVALID_REWARD_AMOUNT');
      }
      if (rewardAmount > 100000) {
        throw new AppError('Points reward amount cannot exceed 100,000 per code', 400, 'EXCESSIVE_REWARD_AMOUNT');
      }
    } else if (input.reward_type === 'gacha_tickets') {
      if (rewardAmount <= 0) {
        throw new AppError('Gacha tickets reward amount must be a positive integer', 400, 'INVALID_REWARD_AMOUNT');
      }
      if (rewardAmount > 1000) {
        throw new AppError('Gacha tickets reward cannot exceed 1,000 tickets per code', 400, 'EXCESSIVE_REWARD_AMOUNT');
      }
    } else if (input.reward_type === 'discount_coupon') {
      const discountType = rewardData.discount_type === 'fixed' ? 'fixed' : 'percentage';
      const discountValue = Number(rewardData.discount_value) || 10;
      if (discountValue <= 0) {
        throw new AppError('Coupon discount value must be greater than zero', 400, 'INVALID_DISCOUNT_VALUE');
      }
      if (discountType === 'percentage' && (discountValue < 1 || discountValue > 100)) {
        throw new AppError('Percentage discount must be between 1% and 100%', 400, 'INVALID_DISCOUNT_VALUE');
      }
      if (discountType === 'fixed' && discountValue > 500) {
        throw new AppError('Fixed discount cannot exceed $500.00', 400, 'INVALID_DISCOUNT_VALUE');
      }

      rewardData.discount_type = discountType;
      rewardData.discount_value = discountValue;
      rewardData.min_order_amount = Math.max(0, Number(rewardData.min_order_amount) || 0);
      if (rewardData.max_discount_amount !== undefined && rewardData.max_discount_amount !== null) {
        rewardData.max_discount_amount = Number(rewardData.max_discount_amount);
      }
    }

    // Validate use mode & limits
    const useMode: RedeemCodeUseMode = input.use_mode || 'one_per_member';
    let maxUses = input.max_uses !== undefined && input.max_uses !== null ? Math.max(1, Math.floor(Number(input.max_uses))) : null;
    let perUserLimit = input.per_user_limit ? Math.max(1, Math.floor(Number(input.per_user_limit))) : 1;

    if (useMode === 'single_use') {
      maxUses = 1;
      perUserLimit = 1;
    } else if (useMode === 'one_per_member') {
      perUserLimit = 1;
    }

    // Validate expiry date if provided
    let expiresAt: string | null = null;
    if (input.expires_at) {
      const expDate = new Date(input.expires_at);
      if (isNaN(expDate.getTime())) {
        throw new AppError('Invalid expiry date format', 400, 'INVALID_EXPIRY_DATE');
      }
      expiresAt = expDate.toISOString();
    }

    const created = DataStore.createRedeemCode({
      code: cleanCode,
      reward_type: input.reward_type,
      reward_amount: rewardAmount,
      reward_data: rewardData,
      use_mode: useMode,
      max_uses: maxUses,
      per_user_limit: perUserLimit,
      is_active: input.is_active ?? true,
      expires_at: expiresAt,
      created_by: adminTelegramId,
    });

    DataStore.logAdminAction(adminTelegramId, 'CREATE_REDEEM_CODE', {
      codeId: created.id,
      code: created.code,
      rewardType: created.reward_type,
      rewardAmount: created.reward_amount,
      useMode: created.use_mode,
      maxUses: created.max_uses,
    });

    return created;
  }

  /**
   * Update existing redeem code.
   */
  static updateCode(
    adminTelegramId: number,
    codeId: string,
    updates: Partial<Pick<RedeemCode, 'is_active' | 'expires_at' | 'max_uses' | 'per_user_limit'>>
  ): RedeemCode {
    const updated = DataStore.updateRedeemCode(codeId, updates);
    if (!updated) {
      throw new AppError('Redeem code not found', 404, 'CODE_NOT_FOUND');
    }

    DataStore.logAdminAction(adminTelegramId, 'UPDATE_REDEEM_CODE', {
      codeId,
      code: updated.code,
      updates,
    });

    return updated;
  }

  /**
   * Toggle code active state.
   */
  static toggleActive(adminTelegramId: number, codeId: string): RedeemCode {
    const code = this.getCodeById(codeId);
    return this.updateCode(adminTelegramId, codeId, { is_active: !code.is_active });
  }

  /**
   * Deactivate a code safely without deleting history.
   */
  static deactivateCode(adminTelegramId: number, codeId: string): RedeemCode {
    return this.updateCode(adminTelegramId, codeId, { is_active: false });
  }

  /**
   * Delete code (or deactivate if usages exist).
   */
  static deleteCode(adminTelegramId: number, codeId: string): boolean {
    const code = this.getCodeById(codeId);
    const deleted = DataStore.deleteRedeemCode(codeId);

    DataStore.logAdminAction(adminTelegramId, 'DELETE_REDEEM_CODE', {
      codeId,
      code: code.code,
    });

    return deleted;
  }

  /**
   * Get usages for a code.
   */
  static getCodeUsages(codeId: string): RedeemCodeUsage[] {
    return DataStore.getRedeemCodeUsages(codeId);
  }

  /**
   * Member redemption execution with server-side validation, concurrency protection, and notifications.
   */
  static async redeem(
    telegramId: number,
    codeStr: string,
    idempotencyKey?: string
  ): Promise<RedeemCodeResult> {
    const result = await DataStore.redeemCode(telegramId, codeStr, idempotencyKey);

    if (result.success) {
      // Send optional congratulatory Telegram notification if store bot is active
      try {
        let msg = `🎁 <b>CODE REDEEMED SUCCESSFULLY!</b>\n\n`;
        msg += `Code: <code>${result.code}</code>\n`;
        msg += `Reward: <b>${result.reward_title}</b>\n\n`;
        if (result.reward_type === 'points') {
          msg += `💎 New Balance: <b>${result.points_balance?.toLocaleString()} Pts</b>`;
        } else if (result.reward_type === 'gacha_tickets') {
          msg += `🎟️ New Tickets: <b>${result.tickets_balance} Tickets</b>`;
        } else if (result.coupon) {
          msg += `🏷️ Coupon Code: <code>${result.coupon.code}</code>\n`;
          msg += `<i>Apply at checkout to receive your discount!</i>`;
        }

        NotificationService.sendStoreBotMessage(telegramId, msg).catch(() => {});
      } catch {}
    }

    return result;
  }
}
