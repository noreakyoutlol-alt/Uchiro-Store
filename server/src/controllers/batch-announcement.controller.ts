import { Request, Response, NextFunction } from 'express';
import { BatchAnnouncementService } from '../services/batch-announcement.service';
import { AppError } from '../middleware/error-handler';

export class BatchAnnouncementController {
  /**
   * Preview pending stock batch (side-effect free)
   */
  static async preview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const preview = await BatchAnnouncementService.previewBatch();
      res.json({
        success: true,
        data: preview,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Publish all new stock to registered authorized groups
   */
  static async publish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as any).admin?.telegram_id || (req as any).user?.telegram_id || 'admin';
      const { idempotency_key } = req.body || {};

      const result = await BatchAnnouncementService.publishBatch(adminId, idempotency_key);
      if (!result.success && result.error) {
        res.status(result.error === 'PUBLISH_IN_PROGRESS' ? 409 : 400).json({
          success: false,
          error: result.error,
          message: result.message || 'Stock announcement batch publish failed',
        });
        return;
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retry failed groups for a specific batch
   */
  static async retryFailed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as any).admin?.telegram_id || (req as any).user?.telegram_id || 'admin';
      const { batchId } = req.params;
      if (!batchId) {
        throw new AppError('batchId is required', 400);
      }

      const result = await BatchAnnouncementService.retryFailedGroups(adminId, batchId);
      res.json({
        success: result.success,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get past batch history
   */
  static async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const batches = BatchAnnouncementService.getBatchHistory(limit);
      res.json({
        success: true,
        data: batches,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get batch detail & per-group delivery records
   */
  static async getBatchDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { batchId } = req.params;
      const detail = BatchAnnouncementService.getBatchDetail(batchId);
      if (!detail) {
        throw new AppError('Batch not found', 404);
      }
      res.json({
        success: true,
        data: detail,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Explicitly mark a product for announcement batch
   */
  static async markProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const event = BatchAnnouncementService.markProductPending(productId);
      res.json({
        success: true,
        data: event,
        message: 'Product added to pending announcement batch',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Explicitly remove a product from pending announcement batch
   */
  static async unmarkProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const removed = BatchAnnouncementService.removeProductPending(productId);
      res.json({
        success: true,
        removed,
        message: removed ? 'Product removed from pending announcement batch' : 'Product was not pending',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List registered announcement groups
   */
  static async listGroups(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const groups = BatchAnnouncementService.listRegisteredGroups();
      res.json({
        success: true,
        data: groups,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Register a new announcement group
   */
  static async registerGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chat_id, title, chat_type } = req.body || {};
      if (!chat_id || !title) {
        throw new AppError('chat_id and title are required', 400);
      }
      const group = BatchAnnouncementService.registerGroup({ chat_id, title, chat_type });
      res.json({
        success: true,
        data: group,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update registered group configuration
   */
  static async updateGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body || {};
      const updated = BatchAnnouncementService.updateGroup(id, updates);
      if (!updated) {
        throw new AppError('Group not found', 404);
      }
      res.json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Delete registered group
   */
  static async deleteGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = BatchAnnouncementService.deleteGroup(id);
      res.json({
        success: true,
        deleted,
      });
    } catch (err) {
      next(err);
    }
  }
}
