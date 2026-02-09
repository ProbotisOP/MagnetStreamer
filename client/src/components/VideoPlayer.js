import React, { useRef, useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import PlayerControls from './PlayerControls';
import PlayerSettings from './PlayerSettings';
import './VideoPlayer.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function VideoPlayer({ streamUrl, torrentInfo, onReset }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [subtitles, setSubtitles] = useState([]);
  const [activeSubtitle, setActiveSubtitle] = useState(null);
  const [skipInterval, setSkipInterval] = useState(10); // seconds
  const [audioTracks, setAudioTracks] = useState([]);
  const [activeAudioTrack, setActiveAudioTrack] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const controlsTimeoutRef = useRef(null);
  const isPlayOperationInProgress = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Video event listeners
    const handleTimeUpdate = () => {
      const time = video.currentTime;
      if (isFinite(time) && time >= 0) {
        setCurrentTime(time);
      }
    };
    const handleDurationChange = () => {
      const duration = video.duration;
      if (isFinite(duration) && duration > 0) {
        setDuration(duration);
      }
    };
    const handlePlay = () => {
      setIsPlaying(true);
      isPlayOperationInProgress.current = false;
    };
    const handlePause = () => {
      setIsPlaying(false);
      isPlayOperationInProgress.current = false;
    };
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handleError = (e) => {
      const error = video.error;
      if (error) {
        let errorMsg = 'Unknown error';
        switch (error.code) {
          case error.MEDIA_ERR_ABORTED:
            errorMsg = 'Video loading aborted';
            break;
          case error.MEDIA_ERR_NETWORK:
            errorMsg = 'Network error - trying to reconnect...';
            // Try to reload the video source
            setTimeout(() => {
              if (video && video.networkState === video.NETWORK_NO_SOURCE) {
                video.load();
              }
            }, 1000);
            break;
          case error.MEDIA_ERR_DECODE:
            errorMsg = 'Video decode error';
            break;
          case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMsg = 'Video format not supported';
            break;
        }
        console.error('Video error:', errorMsg, error);
        toast.error(errorMsg, { duration: 3000 });
      }
    };

    const handleStalled = () => {
      console.warn('Video stalled - buffering...');
      // Video is buffering, this is normal for streaming
    };

    const handleWaiting = () => {
      // Video is waiting for data, this is normal for streaming
      console.log('Video waiting for data...');
    };

    const handleCanPlay = () => {
      // Video can start playing
      console.log('Video ready to play');
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('error', handleError);
    video.addEventListener('stalled', handleStalled);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Keyboard controls
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowleft':
          e.preventDefault();
          // Only skip if video is ready
          if (video.readyState >= 2) { // HAVE_CURRENT_DATA or higher
            skip(-skipInterval);
          }
          break;
        case 'arrowright':
          e.preventDefault();
          // Only skip if video is ready
          if (video.readyState >= 2) { // HAVE_CURRENT_DATA or higher
            skip(skipInterval);
          }
          break;
        case 'arrowup':
          e.preventDefault();
          changeVolume(0.1);
          break;
        case 'arrowdown':
          e.preventDefault();
          changeVolume(-0.1);
          break;
        case 'm':
          toggleMute();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'escape':
          if (showSettings) setShowSettings(false);
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Mouse movement for controls
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 3000);
    };

    const handleMouseLeave = () => {
      if (isPlaying) {
        controlsTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 1000);
      }
    };

    video.addEventListener('mousemove', handleMouseMove);
    video.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('error', handleError);
      video.removeEventListener('stalled', handleStalled);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
      video.removeEventListener('mousemove', handleMouseMove);
      video.removeEventListener('mouseleave', handleMouseLeave);
      clearTimeout(controlsTimeoutRef.current);
    };
  }, [skipInterval, isPlaying, showSettings]);

  // Load audio tracks if available (both embedded and separate files)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Check for embedded audio tracks in video container (MKV/MP4 dual audio)
    const checkEmbeddedAudioTracks = () => {
      if (video.audioTracks && video.audioTracks.length > 0) {
        const embeddedTracks = Array.from(video.audioTracks).map((track, index) => ({
          id: index,
          label: track.label || track.language || `Audio Track ${index + 1}`,
          language: track.language || 'unknown',
          kind: 'embedded',
          enabled: track.enabled
        }));
        
        if (embeddedTracks.length > 0) {
          setAudioTracks(embeddedTracks);
          // Set first track as active if none selected
          if (activeAudioTrack === null && embeddedTracks.length > 0) {
            setActiveAudioTrack(0);
          }
          return true;
        }
      }
      return false;
    };

    // Try to detect embedded tracks when video metadata loads
    const handleLoadedMetadata = () => {
      const hasEmbedded = checkEmbeddedAudioTracks();
      
      // Also check for embedded text tracks (subtitles)
      if (video.textTracks && video.textTracks.length > 0) {
        const embeddedSubtitles = Array.from(video.textTracks)
          .filter(track => track.kind === 'subtitles' || track.kind === 'captions')
          .map((track, index) => ({
            id: `embedded-${index}`,
            label: track.label || track.language || `Subtitle ${index + 1}`,
            language: track.language || 'unknown',
            src: null, // Embedded, no URL
            kind: 'subtitles',
            embedded: true,
            default: track.mode === 'showing'
          }));
        
        if (embeddedSubtitles.length > 0) {
          setSubtitles(prev => {
            // Merge with existing uploaded subtitles
            const existing = prev.filter(s => !s.embedded);
            return [...existing, ...embeddedSubtitles];
          });
          
          // Set default embedded subtitle as active if none selected
          const defaultSub = embeddedSubtitles.find(s => s.default);
          if (defaultSub && !activeSubtitle) {
            setActiveSubtitle(defaultSub);
          }
        }
      }
    };

    // Also check for separate audio files from torrent
    if (torrentInfo && torrentInfo.audioFiles && torrentInfo.audioFiles.length > 0) {
      const separateTracks = torrentInfo.audioFiles.map((file, index) => ({
        id: index,
        label: file.name || `Audio Track ${index + 1}`,
        language: 'unknown',
        kind: 'separate',
        file: file
      }));
      setAudioTracks(separateTracks);
    } else {
      // Check for embedded tracks
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      // Check immediately if metadata already loaded
      if (video.readyState >= 1) {
        handleLoadedMetadata();
      }
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [torrentInfo, activeAudioTrack, activeSubtitle]);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    // Prevent multiple simultaneous play/pause operations
    if (isPlayOperationInProgress.current) {
      return;
    }

    try {
      if (video.paused) {
        isPlayOperationInProgress.current = true;
        // play() returns a Promise that resolves when playback starts
        await video.play();
        // State will be updated by the 'play' event listener
      } else {
        video.pause();
        // State will be updated by the 'pause' event listener
      }
    } catch (error) {
      // Handle play() promise rejection (e.g., autoplay policy)
      console.warn('Play operation failed:', error);
      // Don't show error for user-initiated play (autoplay policy errors are expected)
      if (error.name !== 'NotAllowedError') {
        toast.error('Failed to play video', { duration: 2000 });
      }
    } finally {
      isPlayOperationInProgress.current = false;
    }
  };

  const skip = (seconds) => {
    const video = videoRef.current;
    if (video) {
      // Check if video is ready and duration is valid
      if (!isFinite(video.duration) || video.duration <= 0) {
        toast.error('Video not ready yet. Please wait...', { duration: 2000 });
        return;
      }

      // Check if currentTime is valid
      const currentTime = isFinite(video.currentTime) ? video.currentTime : 0;
      const newTime = Math.max(0, Math.min(video.duration, currentTime + seconds));
      
      // Ensure the new time is finite
      if (isFinite(newTime)) {
        video.currentTime = newTime;
        toast.success(`${seconds > 0 ? 'Forwarded' : 'Rewound'} ${Math.abs(seconds)}s`, {
          duration: 1000,
        });
      } else {
        toast.error('Cannot skip: Invalid video time', { duration: 2000 });
      }
    }
  };

  const changeVolume = (delta) => {
    const video = videoRef.current;
    if (video) {
      const newVolume = Math.max(0, Math.min(1, video.volume + delta));
      video.volume = newVolume;
      setVolume(newVolume);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
    }
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (!document.fullscreenElement) {
      video.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleSeek = (time) => {
    const video = videoRef.current;
    if (video) {
      // Validate time is finite and within valid range
      if (!isFinite(time) || time < 0) {
        return;
      }
      
      // Check if duration is valid
      if (isFinite(video.duration) && video.duration > 0) {
        // Clamp time to valid range
        const clampedTime = Math.max(0, Math.min(video.duration, time));
        if (isFinite(clampedTime)) {
          video.currentTime = clampedTime;
        }
      } else {
        // If duration not ready, just set time if it's finite
        if (isFinite(time) && time >= 0) {
          video.currentTime = time;
        }
      }
    }
  };

  const handleSubtitleUpload = async (file) => {
    const formData = new FormData();
    formData.append('subtitle', file);

    try {
      const response = await axios.post(`${API_URL}/api/subtitles/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const subtitleUrl = `${API_URL}${response.data.path}`;
        const language = file.name.split('.')[0] || 'en';
        const newSubtitle = {
          id: Date.now(),
          label: file.name.replace(/\.[^/.]+$/, ''),
          language: language,
          src: subtitleUrl,
          kind: 'subtitles',
          default: subtitles.length === 0,
        };

        const updatedSubtitles = [...subtitles, newSubtitle];
        setSubtitles(updatedSubtitles);
        
        // Add track to video element
        const video = videoRef.current;
        if (video) {
          const track = document.createElement('track');
          track.kind = 'subtitles';
          track.label = newSubtitle.label;
          track.srclang = newSubtitle.language;
          track.src = subtitleUrl;
          track.default = newSubtitle.default;
          
          // Wait for track to load before setting mode
          track.addEventListener('load', () => {
            const textTracks = video.textTracks;
            for (let i = 0; i < textTracks.length; i++) {
              if (textTracks[i].label === newSubtitle.label) {
                if (newSubtitle.default) {
                  textTracks[i].mode = 'showing';
                  setActiveSubtitle(newSubtitle);
                } else {
                  textTracks[i].mode = 'hidden';
                }
                break;
              }
            }
          });
          
          video.appendChild(track);
        }

        toast.success('Subtitle uploaded successfully!');
      }
    } catch (error) {
      console.error('Error uploading subtitle:', error);
      toast.error('Failed to upload subtitle');
    }
  };

  const handleSubtitleToggle = (subtitle) => {
    const video = videoRef.current;
    if (!video) return;

    // Handle embedded subtitles
    if (subtitle.embedded) {
      const tracks = video.textTracks;
      let found = false;
      
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].label === subtitle.label || tracks[i].language === subtitle.language) {
          found = true;
          if (tracks[i].mode === 'showing') {
            tracks[i].mode = 'hidden';
            setActiveSubtitle(null);
            toast.success('Subtitles disabled', { duration: 1500 });
          } else {
            // Hide all other tracks first
            for (let j = 0; j < tracks.length; j++) {
              if (j !== i) {
                tracks[j].mode = 'hidden';
              }
            }
            tracks[i].mode = 'showing';
            setActiveSubtitle(subtitle);
            toast.success(`Subtitles: ${subtitle.label}`, { duration: 1500 });
          }
          break;
        }
      }
      
      if (!found) {
        toast.error('Subtitle track not found', { duration: 2000 });
      }
    } else {
      // Handle uploaded subtitles (with src URL)
      const tracks = video.textTracks;
      let found = false;
      
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].label === subtitle.label || 
            (tracks[i].srclang && tracks[i].srclang === subtitle.language)) {
          found = true;
          if (tracks[i].mode === 'showing') {
            tracks[i].mode = 'hidden';
            setActiveSubtitle(null);
            toast.success('Subtitles disabled', { duration: 1500 });
          } else {
            // Hide all other tracks first
            for (let j = 0; j < tracks.length; j++) {
              if (j !== i) {
                tracks[j].mode = 'hidden';
              }
            }
            tracks[i].mode = 'showing';
            setActiveSubtitle(subtitle);
            toast.success(`Subtitles: ${subtitle.label}`, { duration: 1500 });
          }
          break;
        }
      }
      
      if (!found) {
        toast.error('Subtitle track not found. Try reloading the video.', { duration: 2000 });
      }
    }
  };

  const handleAudioTrackChange = (trackIndex) => {
    const video = videoRef.current;
    if (!video) return;

    const track = audioTracks[trackIndex];
    if (!track) return;

    if (track.kind === 'embedded') {
      // Handle embedded audio tracks (MKV/MP4 dual audio)
      if (video.audioTracks && video.audioTracks.length > trackIndex) {
        // Disable all tracks first
        for (let i = 0; i < video.audioTracks.length; i++) {
          video.audioTracks[i].enabled = false;
        }
        // Enable selected track
        video.audioTracks[trackIndex].enabled = true;
        setActiveAudioTrack(trackIndex);
        toast.success(`Audio: ${track.label}`, { duration: 1500 });
      } else {
        toast.error('Audio track not available', { duration: 2000 });
      }
    } else if (track.kind === 'separate') {
      // Handle separate audio files (would need different implementation)
      // For now, just show a message
      toast.info('Separate audio file switching not yet implemented', { duration: 2000 });
      setActiveAudioTrack(trackIndex);
    }
  };

  const formatTime = (seconds) => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownload = () => {
    if (!torrentInfo || !torrentInfo.infoHash) {
      toast.error('Torrent information not available');
      return;
    }

    const downloadUrl = `${API_URL}/api/torrent/${torrentInfo.infoHash}/download`;
    const fileName = torrentInfo.videoFile?.name || torrentInfo.name || 'video.mp4';
    
    toast.loading('Preparing download...', { id: 'download' });
    
    // Create a temporary anchor element to trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    
    // Trigger download
    link.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(link);
      toast.success('Download started!', { id: 'download' });
    }, 500);
  };

  return (
    <div className="video-player-container">
      <div className="video-wrapper">
        <video
          ref={videoRef}
          src={streamUrl}
          className="video-element"
          crossOrigin="anonymous"
          onDoubleClick={toggleFullscreen}
          preload="metadata"
          playsInline
        >
          <source src={streamUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {showControls && (
          <div className="video-controls-overlay">
            <PlayerControls
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              volume={volume}
              isMuted={isMuted}
              playbackRate={playbackRate}
              onPlayPause={togglePlay}
              onSeek={handleSeek}
              onVolumeChange={(vol) => {
                videoRef.current.volume = vol;
                setVolume(vol);
              }}
              onMute={toggleMute}
              onPlaybackRateChange={(rate) => {
                videoRef.current.playbackRate = rate;
                setPlaybackRate(rate);
              }}
              onSkipForward={() => skip(skipInterval)}
              onSkipBackward={() => skip(-skipInterval)}
              onFullscreen={toggleFullscreen}
              onSettings={() => setShowSettings(!showSettings)}
              onDownload={handleDownload}
              onReset={onReset}
              formatTime={formatTime}
            />
          </div>
        )}

        {showSettings && (
          <PlayerSettings
            skipInterval={skipInterval}
            onSkipIntervalChange={setSkipInterval}
            subtitles={subtitles}
            activeSubtitle={activeSubtitle}
            onSubtitleUpload={handleSubtitleUpload}
            onSubtitleToggle={handleSubtitleToggle}
            audioTracks={audioTracks}
            activeAudioTrack={activeAudioTrack}
            onAudioTrackChange={handleAudioTrackChange}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>

      <div className="keyboard-shortcuts">
        <div className="shortcuts-title">Keyboard Shortcuts</div>
        <div className="shortcuts-grid">
          <div className="shortcut-item"><kbd>Space</kbd> Play/Pause</div>
          <div className="shortcut-item"><kbd>←</kbd> / <kbd>→</kbd> Skip</div>
          <div className="shortcut-item"><kbd>↑</kbd> / <kbd>↓</kbd> Volume</div>
          <div className="shortcut-item"><kbd>M</kbd> Mute</div>
          <div className="shortcut-item"><kbd>F</kbd> Fullscreen</div>
        </div>
      </div>
    </div>
  );
}

export default VideoPlayer;
