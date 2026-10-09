import React from 'react';
import { HeaderTopBar, HeaderTopBarProps, GoldCoin3DIcon } from '../navigation/HeaderTopBar';

export { HeaderTopBar, GoldCoin3DIcon };
export type { HeaderTopBarProps };

export const TopBar: React.FC<HeaderTopBarProps> = (props) => {
  return <HeaderTopBar {...props} />;
};

export default TopBar;
