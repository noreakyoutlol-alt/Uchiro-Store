import React from 'react';
import {
  Home,
  Compass,
  Sparkles,
  Coins,
  Activity,
  User,
  Settings,
  HelpCircle,
  UserCheck,
  Gift,
  ArrowLeftRight,
  KeyRound,
  CreditCard,
  PackageCheck,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  Ticket,
  Tag,
  ShieldAlert,
  Crown,
  Key,
  Shield,
  LucideProps,
} from 'lucide-react';
import { EMOJI } from '../../config/emoji';

export type SemanticIconKey = keyof typeof EMOJI;

const ICON_MAP: Record<SemanticIconKey, React.ComponentType<LucideProps>> = {
  HOME: Home,
  SHOP: Compass,
  GACHA: Sparkles,
  POINTS: Coins,
  ACTIVITY: Activity,
  PROFILE: User,
  SETTINGS: Settings,
  SUPPORT: HelpCircle,
  ACCOUNT: UserCheck,
  GIFT: Gift,
  TRADE: ArrowLeftRight,
  DIGITAL_CODE: KeyRound,
  PAYMENT: CreditCard,
  DELIVERY: PackageCheck,
  ORDER: Receipt,
  SUCCESS: CheckCircle2,
  WARNING: AlertTriangle,
  ERROR: AlertCircle,
  SECURITY: ShieldCheck,
  COIN: Coins,
  TICKET: Ticket,
  SALE: Tag,
  ADMIN: ShieldAlert,
  CROWN: Crown,
  KEY: Key,
  SHIELD: Shield,
};

export interface AppIconProps extends Omit<LucideProps, 'ref'> {
  name: SemanticIconKey;
  size?: number | string;
  className?: string;
  fallbackText?: string;
}

/**
 * Centralized semantic icon component for Uchiro Store.
 * Safely renders crisp Lucide SVG vector icons when Telegram Custom Emoji IDs
 * are unconfigured (null), preventing blank squares or missing glyphs.
 */
export const AppIcon: React.FC<AppIconProps> = ({
  name,
  size = 18,
  className = '',
  fallbackText,
  ...restProps
}) => {
  const customEmojiId = EMOJI[name];

  // If Telegram Premium custom emoji ID is configured and present, render <tg-emoji>
  if (customEmojiId) {
    const CustomTag = 'tg-emoji' as any;
    return (
      <CustomTag emoji-id={customEmojiId} className={className}>
        {fallbackText || '•'}
      </CustomTag>
    );
  }

  // Safe vector icon rendering: never render blank squares or broken glyphs
  const IconComponent = ICON_MAP[name] || Shield;
  return (
    <IconComponent
      size={size}
      className={`inline-block shrink-0 ${className}`}
      {...restProps}
    />
  );
};
