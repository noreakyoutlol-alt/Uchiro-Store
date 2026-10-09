import React from 'react';
import { HeaderTopBar, HeaderTopBarProps, GoldCoin3DIcon } from '../navigation/HeaderTopBar';

export { HeaderTopBar, GoldCoin3DIcon };
export type { HeaderTopBarProps };

export const Header: React.FC<HeaderTopBarProps> = (props) => {
  return <HeaderTopBar {...props} />;
};

export default Header;
