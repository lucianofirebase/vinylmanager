'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Youtube, 
  Music, 
  Volume2, 
  VolumeX, 
  Loader2, 
  AlertCircle,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

const DISCOGS_KEY = 'kTXBUunaWzBTXwJZlRga';
const DISCOGS_SECRET = 'uZxBlMTEDrEMcPblPAoQChIrhlZivIwz';

interface VideoItem {
  uri: string;
  title: string;
  duration: number;
}

interface iTunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  previewUrl: string;
  trackNumber: number;
}

interface AudioPreviewPlayerProps {
  discogsId?: number | null;
  artist: string;
  title: string;
}

export default function AudioPreviewPlayer({ discogsId, artist, title }: AudioPreviewPlayerProps) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'youtube' | 'itunes'>('youtube');
  
  // YouTube states
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedVideoIdx, setSelectedVideoIdx] = useState<number>(0);
  
  // iTunes states
  const [tracks, setTracks] = useState<iTunesTrack[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackProgress, setTrackProgress] = useState(0);
  const [trackDuration, setTrackDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Helper to extract YouTube ID
  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  useEffect(() => {
    let active = true;

    async function loadAudioPreviews() {
      setLoading(true);
      let foundDiscogsVideos = false;
      let foundiTunesTracks = false;

      // 1. Try Discogs API first if ID is present
      if (discogsId) {
        try {
          const res = await fetch(`https://api.discogs.com/releases/${discogsId}?key=${DISCOGS_KEY}&secret=${DISCOGS_SECRET}`);
          if (res.ok) {
            const data = await res.json();
            if (active && data.videos && data.videos.length > 0) {
              setVideos(data.videos);
              foundDiscogsVideos = true;
            }
          }
        } catch (err) {
          console.error("Error loading Discogs release videos:", err);
        }
      }

      // 2. Fetch iTunes search previews
      try {
        const searchTerm = `${artist} ${title}`;
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&media=music&entity=song&limit=10`);
        if (res.ok) {
          const data = await res.json();
          if (active && data.results && data.results.length > 0) {
            // Map and filter results to match artist as closely as possible (or just use search order)
            const mappedTracks: iTunesTrack[] = data.results.map((item: any, idx: number) => ({
              trackId: item.trackId || idx,
              trackName: item.trackName,
              artistName: item.artistName,
              previewUrl: item.previewUrl,
              trackNumber: item.trackNumber || idx + 1
            }));
            setTracks(mappedTracks);
            foundiTunesTracks = true;
          }
        }
      } catch (err) {
        console.error("Error searching iTunes API:", err);
      }

      if (active) {
        // Set default active tab based on what was found
        if (foundDiscogsVideos) {
          setActiveTab('youtube');
        } else if (foundiTunesTracks) {
          setActiveTab('itunes');
        } else {
          setActiveTab('youtube'); // Will show empty/not found message
        }
        setLoading(false);
      }
    }

    loadAudioPreviews();

    return () => {
      active = false;
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [discogsId, artist, title]);

  // Handle iTunes Audio Elements
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      setTrackProgress(audio.currentTime);
    };

    const handleDurationChange = () => {
      setTrackDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setTrackProgress(0);
      
      // Auto-play next track if available
      const currentIdx = tracks.findIndex(t => t.trackId === currentTrackId);
      if (currentIdx !== -1 && currentIdx < tracks.length - 1) {
        const nextTrack = tracks[currentIdx + 1];
        playTrack(nextTrack.previewUrl, nextTrack.trackId);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [tracks, currentTrackId]);

  // Adjust volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const playTrack = (url: string, trackId: number) => {
    if (!audioRef.current) return;

    if (currentTrackId === trackId) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().catch(err => console.error(err));
        setIsPlaying(true);
      }
    } else {
      audioRef.current.src = url;
      audioRef.current.load();
      audioRef.current.play()
        .then(() => {
          setCurrentTrackId(trackId);
          setIsPlaying(true);
        })
        .catch(err => console.error(err));
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || trackDuration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    audioRef.current.currentTime = percentage * trackDuration;
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col items-center justify-center min-h-[220px] select-none">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
        <span className="text-xs text-gray-400">Buscando muestras de audio...</span>
      </div>
    );
  }

  const hasVideos = videos.length > 0;
  const hasiTunes = tracks.length > 0;

  if (!hasVideos && !hasiTunes) {
    return (
      <div className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col items-center justify-center text-center min-h-[160px] select-none">
        <AlertCircle className="w-10 h-10 text-gray-500 mb-3" />
        <h4 className="text-sm font-semibold text-white">No se encontraron muestras</h4>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">
          No hay videos de YouTube en Discogs ni demos de iTunes disponibles para este disco.
        </p>
      </div>
    );
  }

  const activeVideo = videos[selectedVideoIdx];
  const activeVideoId = activeVideo ? getYoutubeId(activeVideo.uri) : null;

  return (
    <div className="glass-card rounded-2xl border border-white/5 overflow-hidden flex flex-col">
      {/* Tabs Header */}
      <div className="flex bg-slate-950/40 border-b border-white/5 p-1">
        {hasVideos && (
          <button
            onClick={() => {
              if (audioRef.current && isPlaying) {
                audioRef.current.pause();
                setIsPlaying(false);
              }
              setActiveTab('youtube');
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'youtube'
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Youtube className="w-4 h-4" />
            <span>Videos de YouTube</span>
          </button>
        )}
        {hasiTunes && (
          <button
            onClick={() => {
              setActiveTab('itunes');
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'itunes'
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>Muestras iTunes (30s)</span>
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="p-5">
        {activeTab === 'youtube' && activeVideo && activeVideoId ? (
          <div className="space-y-4">
            {/* Embed Video Iframe */}
            <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-2xl border border-white/5 bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${activeVideoId}`}
                title={activeVideo.title}
                className="absolute inset-0 w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            
            {/* Video Selector Dropdown or List */}
            {videos.length > 1 && (
              <div className="space-y-1.5">
                <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Ver otros videos del álbum:</span>
                <div className="grid grid-cols-1 gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                  {videos.map((vid, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedVideoIdx(idx)}
                      className={`w-full text-left py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-between transition-all select-none ${
                        selectedVideoIdx === idx
                          ? 'bg-red-500/5 border-red-500/20 text-white font-semibold'
                          : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="truncate pr-4">{vid.title}</span>
                      <span className="text-[10px] text-gray-500 shrink-0">
                        {vid.duration ? `${Math.floor(vid.duration / 60)}:${(vid.duration % 60).toString().padStart(2, '0')}` : 'YouTube'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {activeTab === 'itunes' && hasiTunes ? (
          <div className="space-y-4">
            {/* Custom Audio Controller */}
            {currentTrackId !== null && (
              <div className="bg-slate-950/50 border border-white/5 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider block">Escuchando Preview</span>
                    <h5 className="text-xs font-bold text-white truncate">
                      {tracks.find(t => t.trackId === currentTrackId)?.trackName}
                    </h5>
                    <p className="text-[10px] text-gray-500 truncate">
                      {tracks.find(t => t.trackId === currentTrackId)?.artistName}
                    </p>
                  </div>
                  
                  {/* Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const t = tracks.find(t => t.trackId === currentTrackId);
                        if (t) playTrack(t.previewUrl, t.trackId);
                      }}
                      className="w-8 h-8 rounded-full bg-indigo-500 hover:bg-indigo-600 flex items-center justify-center text-white transition-all shadow-md active:scale-95"
                    >
                      {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white translate-x-0.5" />}
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div 
                    onClick={handleProgressBarClick}
                    className="w-full h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer relative"
                  >
                    <div 
                      className="absolute inset-y-0 left-0 bg-indigo-500 transition-all duration-100"
                      style={{ width: `${(trackProgress / (trackDuration || 30)) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-gray-500 select-none">
                    <span>{formatTime(trackProgress)}</span>
                    <span>{formatTime(trackDuration || 30)}</span>
                  </div>
                </div>

                {/* Volume bar */}
                <div className="flex items-center gap-2 select-none border-t border-white/5 pt-2">
                  <button 
                    onClick={() => setIsMuted(!isMuted)} 
                    className="text-gray-400 hover:text-white transition-all"
                  >
                    {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(e) => {
                      setVolume(parseFloat(e.target.value));
                      setIsMuted(false);
                    }}
                    className="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Playlist Tracklist */}
            <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block mb-1.5">Lista de pistas encontradas:</span>
              {tracks.map((track) => {
                const isCurrent = track.trackId === currentTrackId;
                return (
                  <div
                    key={track.trackId}
                    onClick={() => playTrack(track.previewUrl, track.trackId)}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer border select-none transition-all ${
                      isCurrent
                        ? 'bg-indigo-500/10 border-indigo-500/20 text-white'
                        : 'bg-white/5 border-white/5 text-gray-450 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-4">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center bg-slate-900/60 font-semibold text-[10px] text-gray-400 shrink-0">
                        {isCurrent && isPlaying ? (
                          <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                        ) : (
                          track.trackNumber
                        )}
                      </div>
                      <span className={`truncate font-medium ${isCurrent ? 'font-bold' : ''}`}>
                        {track.trackName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isCurrent && isPlaying ? (
                        <Pause className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400/20" />
                      ) : (
                        <Play className="w-3.5 h-3.5 text-gray-400 fill-transparent group-hover:text-white transition-all" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
