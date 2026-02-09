import React, { useRef } from 'react';
import './PlayerSettings.css';

function PlayerSettings({
  skipInterval,
  onSkipIntervalChange,
  subtitles,
  activeSubtitle,
  onSubtitleUpload,
  onSubtitleToggle,
  audioTracks,
  activeAudioTrack,
  onAudioTrackChange,
  onClose,
}) {
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      onSubtitleUpload(file);
      e.target.value = ''; // Reset input
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="player-settings-overlay" onClick={onClose}>
      <div className="player-settings" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Player Settings</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="settings-content">
          {/* Skip Interval */}
          <div className="settings-section">
            <label className="settings-label">
              Skip Interval (seconds)
            </label>
            <div className="skip-interval-control">
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={skipInterval}
                onChange={(e) => onSkipIntervalChange(parseInt(e.target.value))}
                className="skip-slider"
              />
              <span className="skip-value">{skipInterval}s</span>
            </div>
            <p className="settings-description">
              Set how many seconds to skip when using arrow keys or skip buttons
            </p>
          </div>

          {/* Subtitles */}
          <div className="settings-section">
            <label className="settings-label">Subtitles</label>
            <div className="subtitle-controls">
              <button
                className="upload-btn"
                onClick={handleUploadClick}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
                </svg>
                Upload Subtitle
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".srt,.vtt,.ass,.ssa"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>

            {subtitles.length > 0 && (
              <div className="subtitle-list">
                {subtitles.map((subtitle) => (
                  <div
                    key={subtitle.id}
                    className={`subtitle-item ${activeSubtitle?.id === subtitle.id ? 'active' : ''}`}
                    onClick={() => onSubtitleToggle(subtitle)}
                  >
                    <span className="subtitle-label">
                      {subtitle.label}
                      {subtitle.embedded && (
                        <span className="embedded-badge" title="Embedded in video">📦</span>
                      )}
                    </span>
                    {activeSubtitle?.id === subtitle.id && (
                      <span className="subtitle-active-badge">Active</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {subtitles.length === 0 && (
              <p className="settings-description">
                No subtitles uploaded. Click "Upload Subtitle" to add one.
              </p>
            )}
          </div>

          {/* Audio Tracks */}
          {audioTracks.length > 0 && (
            <div className="settings-section">
              <label className="settings-label">Audio Tracks</label>
              <div className="audio-tracks-list">
                {audioTracks.map((track, index) => (
                  <div
                    key={track.id || index}
                    className={`audio-track-item ${activeAudioTrack === index ? 'active' : ''}`}
                    onClick={() => onAudioTrackChange(index)}
                  >
                    <span className="audio-track-label">
                      {track.label || track.name || `Track ${index + 1}`}
                      {track.kind === 'embedded' && (
                        <span className="embedded-badge" title="Embedded in video">📦</span>
                      )}
                      {track.language && track.language !== 'unknown' && (
                        <span className="language-badge">{track.language}</span>
                      )}
                    </span>
                    {activeAudioTrack === index && (
                      <span className="audio-track-active-badge">Active</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="settings-description">
                Select audio track for multi-language content
              </p>
            </div>
          )}

          {audioTracks.length === 0 && (
            <div className="settings-section">
              <label className="settings-label">Audio Tracks</label>
              <p className="settings-description">
                No additional audio tracks detected. 
                {typeof document !== 'undefined' && !document.createElement('video').audioTracks && (
                  <span className="browser-warning">
                    {' '}Note: Your browser may not support embedded audio track detection. 
                    Try Chrome or Edge for full dual-audio support.
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlayerSettings;
