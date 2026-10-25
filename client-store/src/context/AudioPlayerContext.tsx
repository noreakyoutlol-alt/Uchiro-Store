import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

interface AudioContextType {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  hasError: boolean;
  errorMessage: string | null;
  isLoading: boolean;
  togglePlay: () => Promise<void>;
  toggleMute: () => void;
  setVolume: (val: number) => void;
  retryAudio: () => void;
}

const AudioContext = createContext<AudioContextType>({
  isPlaying: false,
  isMuted: false,
  volume: 0.45,
  hasError: false,
  errorMessage: null,
  isLoading: false,
  togglePlay: async () => {},
  toggleMute: () => {},
  setVolume: () => {},
  retryAudio: () => {},
});

const AUDIO_SOURCES = ['/assets/music/music.mp3', '/music.mp3'];

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceIndexRef = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('uchiro_store_volume');
      return saved ? parseFloat(saved) : 0.45;
    } catch {
      return 0.45;
    }
  });

  const setupAudio = useCallback(() => {
    // Clean up existing instance to prevent duplicate overlapping playback
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load();
      } catch {}
      audioRef.current = null;
    }

    const currentSrc = AUDIO_SOURCES[sourceIndexRef.current] || AUDIO_SOURCES[0];
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.loop = true;
    audio.volume = volume;
    audio.muted = isMuted;

    audio.addEventListener('play', () => {
      setIsPlaying(true);
      setIsLoading(false);
      setHasError(false);
      setErrorMessage(null);
    });

    audio.addEventListener('pause', () => {
      setIsPlaying(false);
    });

    audio.addEventListener('waiting', () => {
      setIsLoading(true);
    });

    audio.addEventListener('canplay', () => {
      setIsLoading(false);
      setHasError(false);
      setErrorMessage(null);
    });

    audio.addEventListener('error', () => {
      setIsLoading(false);
      setIsPlaying(false);

      // Attempt fallback source if available
      if (sourceIndexRef.current < AUDIO_SOURCES.length - 1) {
        sourceIndexRef.current += 1;
        const fallbackSrc = AUDIO_SOURCES[sourceIndexRef.current];
        audio.src = fallbackSrc;
        audio.load();
        return;
      }

      setHasError(true);
      const code = audio.error?.code;
      if (code === 1) setErrorMessage('Audio playback aborted.');
      else if (code === 2) setErrorMessage('Network error loading audio.');
      else if (code === 3) setErrorMessage('Audio decoding error.');
      else if (code === 4) setErrorMessage('Audio format not supported or file not found.');
      else setErrorMessage('Unable to load background audio.');
    });

    audio.src = currentSrc;
    audioRef.current = audio;

    // Check if user previously had music enabled
    let previouslyPlaying = false;
    try {
      previouslyPlaying = localStorage.getItem('uchiro_music_playing') === 'true';
    } catch {}

    if (previouslyPlaying) {
      audio.play().catch(() => {
        // Autoplay policy prevented playback until user interaction; keep state clean
        setIsPlaying(false);
      });
    }
  }, [volume, isMuted]);

  useEffect(() => {
    setupAudio();

    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.src = '';
        } catch {}
        audioRef.current = null;
      }
    };
  }, [setupAudio]);

  const togglePlay = async () => {
    if (!audioRef.current) {
      setupAudio();
    }
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      try {
        localStorage.setItem('uchiro_music_playing', 'false');
      } catch {}
    } else {
      setIsLoading(true);
      setHasError(false);
      setErrorMessage(null);
      try {
        await audio.play();
        setIsPlaying(true);
        try {
          localStorage.setItem('uchiro_music_playing', 'true');
        } catch {}
      } catch (err: any) {
        setIsPlaying(false);
        if (err?.name === 'NotAllowedError') {
          setErrorMessage('Tap anywhere to enable audio (browser autoplay policy)');
        } else {
          setHasError(true);
          setErrorMessage(err?.message || 'Unable to start audio playback');
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    audioRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const setVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    setVolumeState(clamped);
    try {
      localStorage.setItem('uchiro_store_volume', clamped.toString());
    } catch {}
  };

  const retryAudio = () => {
    sourceIndexRef.current = 0;
    setupAudio();
    togglePlay();
  };

  return (
    <AudioContext.Provider
      value={{
        isPlaying,
        isMuted,
        volume,
        hasError,
        errorMessage,
        isLoading,
        togglePlay,
        toggleMute,
        setVolume,
        retryAudio,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => useContext(AudioContext);
