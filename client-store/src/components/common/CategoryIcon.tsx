import React from 'react';
import {
  CategoryIcon as BaseCategoryIcon,
  CategoryIconProps as BaseCategoryIconProps,
} from '../../config/emoji';

export interface CategoryIconProps extends Omit<BaseCategoryIconProps, 'name' | 'slug'> {
  slug?: string;
  name?: string;
  category?: string;
  size?: number | string;
  fallbackEmoji?: string;
  className?: string;
  imgClassName?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  name,
  slug,
  size,
  className,
  ...props
}) => {
  const resolvedName = category || name;
  const sizeClass = size ? `w-[${size}px] h-[${size}px]` : '';
  const combinedClass = [className, sizeClass].filter(Boolean).join(' ');

  return (
    <BaseCategoryIcon
      name={resolvedName}
      slug={slug}
      className={combinedClass || undefined}
      {...props}
    />
  );
};

export default CategoryIcon;
