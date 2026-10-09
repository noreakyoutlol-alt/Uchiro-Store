import React, { useState } from 'react';
import { Volume2, VolumeX, Play, Pause, Music } from 'lucide-react';
import { useAudio } from '../../context/AudioPlayerContext';

export const MusicPlayerControl: React.FC = () => {
  const { isPlaying, isMuted, volume, togglePlay, toggleMute, setVolume } = useAudio();
  const [showVolumePopup, setShowVolumePopup] = useState(false);

  return (
    <div className="relative flex items-center">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 dark:bg-white/5 border border-white/15 dark:border-white/10 backdrop-blur-sm shadow-sm">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className="p-1 rounded-full text-slate-300 hover:text-[#FFD166] transition-colors flex items-center justify-center"
          title={isPlaying ? 'Pause Music' : 'Play Music'}
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5 text-[#FFD166] animate-pulse" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Animated equalizer waves when playing */}
        <button
          onClick={() => setShowVolumePopup(!showVolumePopup)}
          className="flex items-center gap-0.5 px-1 py-0.5 group"
        >
          <div className={`w-0.5 h-3 rounded-full bg-[#FFD166] ${isPlaying ? 'animate-bounce' : 'opacity-40'}`} style={{ animationDuration: '0.6s' }} />
          <div className={`w-0.5 h-4 rounded-full bg-[#E63946] ${isPlaying ? 'animate-bounce' : 'opacity-40'}`} style={{ animationDuration: '0.4s', animationDelay: '0.1s' }} />
          <div className={`w-0.5 h-2.5 rounded-full bg-[#FFD166] ${isPlaying ? 'animate-bounce' : 'opacity-40'}`} style={{ animationDuration: '0.5s', animationDelay: '0.2s' }} />
        </button>

        {/* Volume Mute Toggle */}
        <button
          onClick={toggleMute}
          className="p-1 text-slate-400 hover:text-white transition-colors"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="w-3.5 h-3.5 text-rose-400" />
          ) : (
            <Volume2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Volume Slider Popover */}
      {showVolumePopup && (
        <div className="absolute right-0 top-full mt-2 w-36 p-2.5 rounded-xl bg-[#161B26]/95 border border-white/15 shadow-2xl backdrop-blur-md z-50 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[10px] text-slate-300 font-medium">
            <span className="flex items-center gap-1">
              <Music className="w-3 h-3 text-[#FFD166]" /> Volume
            </span>
            <span>{Math.round((isMuted ? 0 : volume) * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              if (isMuted) toggleMute();
              setVolume(parseFloat(e.target.value));
            }}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#FFD166]"
          />
        </div>
      )}
    </div>
  );
};
