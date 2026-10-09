import { DataStore } from '../database/data-store';
import { Product, Category } from '../types';
import { AppError } from '../middleware/error-handler';

export class StoreService {
  // Categories
  static getCategories(): Category[] {
    return DataStore.getCategories();
  }

  // Home: ALL currently in-stock products
  static getHomeInStockProducts(): Product[] {
    return DataStore.getInStockProducts();
  }

  // Shop: Discovery, filtering, categories, searching, sorting
  static getShopProducts(query: {
    categorySlug?: string;
    search?: string;
    filter?: string;
    sort?: string;
  }): Product[] {
    return DataStore.getShopProducts(query);
  }

  // Product Detail
  static getProductById(id: string): Product {
    const product = DataStore.getProductById(id);
    if (!product) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }
    return product;
  }
}
