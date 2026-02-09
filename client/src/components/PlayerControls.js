import React from 'react';
import './PlayerControls.css';

function PlayerControls({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  playbackRate,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onMute,
  onPlaybackRateChange,
  onSkipForward,
  onSkipBackward,
  onFullscreen,
  onSettings,
  onDownload,
  onReset,
  formatTime,
}) {
  const handleProgressClick = (e) => {
    if (!isFinite(duration) || duration <= 0) {
      return; // Don't seek if duration is not valid
    }
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    if (isFinite(newTime) && newTime >= 0) {
      onSeek(newTime);
    }
  };

  const handleVolumeClick = (e) => {
    const volumeBar = e.currentTarget;
    const rect = volumeBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    onVolumeChange(percent);
  };

  return (
    <div className="player-controls">
      {/* Progress Bar */}
      <div className="progress-container">
        <div
          className="progress-bar"
          onClick={handleProgressClick}
        >
          <div
            className="progress-filled"
            style={{ width: `${isFinite(duration) && duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
          <div
            className="progress-handle"
            style={{ left: `${isFinite(duration) && duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>
        <div className="time-display">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Main Controls */}
      <div className="controls-main">
        <div className="controls-left">
          <button className="control-btn" onClick={onPlayPause} title="Play/Pause (Space)">
            {isPlaying ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          <button className="control-btn" onClick={onSkipBackward} title="Rewind (←)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/>
            </svg>
          </button>

          <button className="control-btn" onClick={onSkipForward} title="Forward (→)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
            </svg>
          </button>

          <div className="volume-control">
            <button className="control-btn" onClick={onMute} title="Mute (M)">
              {isMuted || volume === 0 ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                </svg>
              ) : volume < 0.5 ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.83 16h-1.75l1.56-1.56c.24-.24.24-.64 0-.88l-.88-.88c-.24-.24-.64-.24-.88 0L14.75 14H13v-2h1.75l1.56-1.56c.24-.24.24-.64 0-.88l-.88-.88c-.24-.24-.64-.24-.88 0L12.75 10H11c-.55 0-1 .45-1 1v2H8c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1h2v2c0 .55.45 1 1 1h1.75l1.56-1.56c.24-.24.64-.24.88 0l.88.88c.24.24.64.24.88 0L16.75 20H18.83c.36 0 .67-.25.74-.6l.9-4.5c.05-.3-.15-.58-.45-.63-.3-.05-.58.15-.63.45l-.23 1.15z"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              )}
            </button>
            <div className="volume-slider-container" onClick={handleVolumeClick}>
              <div className="volume-slider">
                <div
                  className="volume-filled"
                  style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="playback-rate">
            <select
              className="rate-select"
              value={playbackRate}
              onChange={(e) => onPlaybackRateChange(parseFloat(e.target.value))}
            >
              <option value="0.25">0.25x</option>
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1">1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="1.75">1.75x</option>
              <option value="2">2x</option>
            </select>
          </div>
        </div>

        <div className="controls-right">
          {onDownload && (
            <button className="control-btn download-btn" onClick={onDownload} title="Download Video">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
            </button>
          )}

          <button className="control-btn" onClick={onSettings} title="Settings">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
          </button>

          <button className="control-btn" onClick={onFullscreen} title="Fullscreen (F)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
            </svg>
          </button>

          <button className="control-btn reset-btn" onClick={onReset} title="New Stream">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlayerControls;
