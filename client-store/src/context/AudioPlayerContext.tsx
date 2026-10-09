import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface AudioContextType {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  togglePlay: () => void;
  toggleMute: () => void;
  setVolume: (val: number) => void;
}

const AudioContext = createContext<AudioContextType>({
  isPlaying: false,
  isMuted: false,
  volume: 0.5,
  togglePlay: () => {},
  toggleMute: () => {},
  setVolume: () => {},
});

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolumeState] = useState<number>(() => {
    const saved = localStorage.getItem('uchiro_store_volume');
    return saved ? parseFloat(saved) : 0.45;
  });

  useEffect(() => {
    const audio = new Audio('/assets/music/music.mp3');
    audio.loop = true;
    audio.volume = volume;
    audioRef.current = audio;

    // Check if user previously had music enabled
    const previouslyPlaying = localStorage.getItem('uchiro_music_playing') === 'true';
    if (previouslyPlaying) {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        // Autoplay policy prevented it until user interaction
        setIsPlaying(false);
      });
    }

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      localStorage.setItem('uchiro_music_playing', 'false');
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        localStorage.setItem('uchiro_music_playing', 'true');
      }).catch((err) => {
        console.warn('Audio play prevented:', err);
      });
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    audioRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const setVolume = (val: number) => {
    if (!audioRef.current) return;
    audioRef.current.volume = val;
    setVolumeState(val);
    localStorage.setItem('uchiro_store_volume', val.toString());
  };

  return (
    <AudioContext.Provider value={{ isPlaying, isMuted, volume, togglePlay, toggleMute, setVolume }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => useContext(AudioContext);
