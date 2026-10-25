import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { GamingDoodlePattern } from './GamingDoodlePattern';
import { HalloweenAtmosphere } from './themes/HalloweenAtmosphere';
import { ChristmasAtmosphere } from './themes/ChristmasAtmosphere';
import { AngkorAtmosphere } from './themes/AngkorAtmosphere';
import { SeasonalSoundControl } from './themes/SeasonalSoundControl';

export const SeasonalAtmosphere: React.FC = () => {
  const { activeSeasonalTheme } = useTheme();

  return (
    <>
      {/* 1. Base Uchiro Gaming Space-Doodle Pattern Layer (Preserved as default and fallback) */}
      <GamingDoodlePattern />

      {/* 2. Active Seasonal Layer (Strictly pointer-events-none & behind interactive content) */}
      {activeSeasonalTheme === 'halloween' && <HalloweenAtmosphere />}
      {activeSeasonalTheme === 'christmas' && <ChristmasAtmosphere />}
      {activeSeasonalTheme === 'angkor-khmer' && <AngkorAtmosphere />}

      {/* 3. Accessible Sound Toggle & Preview Banner */}
      <SeasonalSoundControl />
    </>
  );
};
