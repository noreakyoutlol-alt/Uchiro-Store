import { Request, Response, NextFunction } from 'express';
import { StoreService } from '../services/store.service';
import { DataStore } from '../database/data-store';
import { supabase, isSupabaseConfigured } from '../database/supabase';

export class ProductController {
  /**
   * Get store product catalog.
   * Connected 100% to Supabase tables.
   */
  static async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category, search, filter, sort } = req.query;

      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[Supabase Products Error]:', error);
        }

        const items = data && Array.isArray(data) ? data : [];
        res.json({
          success: true,
          data: items,
          total: items.length,
        });
        return;
      }

      const products = StoreService.getShopProducts({
        categorySlug: category as string,
        search: search as string,
        filter: filter as string,
        sort: sort as string,
      });

      const catalog = products.map((p) => {
        const liveStock = DataStore.getProductAvailableStock(p.id);
        const stock = typeof liveStock === 'number' ? liveStock : 0;
        return {
          ...p,
          stock,
          stock_count: stock,
          is_available: stock > 0,
          status: (p as any).status || (stock === 0 ? 'delivered' : 'available'),
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
   * Home In-Stock Products endpoint (Connected 100% to Supabase)
   */
  static async getInStockProducts(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[Supabase Products Error]:', error);
        }

        const items =
          data && Array.isArray(data)
            ? data.filter((p: any) => (p.stock || p.stock_count || 0) > 0)
            : [];

        res.json({
          success: true,
          data: items,
          total: items.length,
        });
        return;
      }

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
   * Product detail
   */
  static async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
          res.json({
            success: true,
            data,
          });
          return;
        }
      }

      const product = StoreService.getProductById(id);
      res.json({
        success: true,
        data: product,
      });
    } catch (err) {
      next(err);
    }
  }
}
