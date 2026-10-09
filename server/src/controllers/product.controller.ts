import { Request, Response, NextFunction } from 'express';
import { StoreService } from '../services/store.service';
import { DataStore } from '../database/data-store';

export class ProductController {
  /**
   * Get store product catalog.
   * STORE INVENTORY & "SOLD OUT" DISPLAY POLICY:
   * DO NOT HIDE sold-out products or Blox Fruits accounts from the store!
   * When an account, Blox Fruit item, or single-unit inventory item is sold
   * (status === 'consumed' || status === 'delivered' or stock === 0),
   * keep the item fully visible in the store catalog.
   */
  static getProducts(req: Request, res: Response, next: NextFunction): void {
    try {
      const { category, search, filter, sort } = req.query;
      const products = StoreService.getShopProducts({
        categorySlug: category as string,
        search: search as string,
        filter: filter as string,
        sort: sort as string,
      });

      // Ensure sold-out accounts / items are preserved with accurate stock & delivery status
      // Return live count of unsold accounts. If 0, return stock = 0.
      const catalog = products.map((p) => {
        const liveStock = DataStore.getProductAvailableStock(p.id);
        const stock = typeof liveStock === 'number' ? liveStock : 0;
        return {
          ...p,
          stock,
          stock_count: stock,
          is_available: stock > 0,
          status: stock === 0 ? 'delivered' : 'available',
        };
      });

      res.json({
        success: true,
        data: catalog,
        total: catalog.length,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Home In-Stock Products endpoint
   */
  static getInStockProducts(_req: Request, res: Response, next: NextFunction): void {
    try {
      const products = StoreService.getHomeInStockProducts();
      res.json({
        success: true,
        data: products,
        total: products.length,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Product detail endpoint
   */
  static getProductById(req: Request, res: Response, next: NextFunction): void {
    try {
      const product = StoreService.getProductById(req.params.id);
      const liveStock = DataStore.getProductAvailableStock(product.id);
      const stock = typeof liveStock === 'number' ? liveStock : 0;
      res.json({
        success: true,
        data: {
          ...product,
          stock,
          stock_count: stock,
          is_available: stock > 0,
          status: stock === 0 ? 'delivered' : 'available',
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
