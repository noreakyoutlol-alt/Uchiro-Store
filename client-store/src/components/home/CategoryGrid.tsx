import React from 'react';
import { CollectionsGrid, CollectionsGridProps, GAME_COLLECTIONS, GameCollectionItem } from './CollectionsGrid';

export type CategoryGridProps = CollectionsGridProps;
export { GAME_COLLECTIONS };
export type { GameCollectionItem };

export const CategoryGrid: React.FC<CategoryGridProps> = (props) => {
  return <CollectionsGrid {...props} />;
};

export default CategoryGrid;
