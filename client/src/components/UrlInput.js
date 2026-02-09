import React, { useState, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import TorrentSearch from './TorrentSearch';
import './UrlInput.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const MAX_RETRIES = 60; // 2 minutes (60 * 2 seconds)
const POLL_INTERVAL = 2000; // 2 seconds

function UrlInput({ onStreamStart }) {
  const [magnetUrl, setMagnetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const timeoutRef = useRef(null);
  const retryCountRef = useRef(0);

  const clearPolling = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    retryCountRef.current = 0;
  };

  const handleTorrentFromSearch = (magnet) => {
    setMagnetUrl(magnet);
    setShowSearch(false);
    // Automatically start streaming
    setTimeout(() => {
      handleStreamStart(magnet);
    }, 100);
  };

  const handleStreamStart = async (magnet = magnetUrl) => {
    if (!magnet || !magnet.trim()) {
      toast.error('Please enter a magnet URL');
      return;
    }

    // Clear any existing polling
    clearPolling();
    setLoading(true);
    setProgress(0);
    setLoadingStatus({
      stage: 'initializing',
      message: 'Starting up...',
      description: 'We\'re preparing to connect to the torrent network.',
      details: {}
    });
    toast.loading('Adding torrent...', { id: 'torrent-loading' });

    try {
      const response = await axios.post(`${API_URL}/api/stream`, {
        magnetUrl: magnet.trim()
      });

      if (response.data.success) {
        toast.success('Torrent added! Preparing stream...', { id: 'torrent-loading' });
        setLoadingStatus({
          stage: 'connecting',
          message: 'Connecting to torrent...',
          description: 'We\'re connecting to the torrent network to find the video file.',
          details: {}
        });
        
        // Poll for torrent readiness with retry limit
        const checkTorrent = async () => {
          try {
            // Check retry limit
            if (retryCountRef.current >= MAX_RETRIES) {
              clearPolling();
              setLoading(false);
              setLoadingStatus({
                stage: 'error',
                message: 'Connection timeout',
                description: 'The torrent is taking too long to load. This might be because there are no active seeders (people sharing the file) or your internet connection is slow.',
                details: {}
              });
              toast.error('Torrent is taking too long to load. Please try again or check your connection.', { 
                id: 'torrent-loading',
                duration: 5000 
              });
              return;
            }

            retryCountRef.current += 1;
            const progressPercent = Math.min((retryCountRef.current / MAX_RETRIES) * 100, 95);
            setProgress(progressPercent);

            const infoResponse = await axios.get(`${API_URL}/api/torrent/${response.data.torrentId}/info`);
            const info = infoResponse.data;
            
            // Check if metadata is loaded
            if (!info.hasMetadata) {
              // Check if we've been trying for a while with no peers
              const noPeersForLongTime = retryCountRef.current > 15 && info.numPeers === 0;
              const connectionStatus = info.diagnostic?.connectionStatus || 'searching';
              const isNoPeers = connectionStatus === 'no-peers';
              
              let description = 'We\'re downloading the list of files in this torrent. This tells us what video file is available.';
              if (isNoPeers || noPeersForLongTime) {
                description = '⚠️ No peers found. This torrent might be dead (no active seeders) or your network might be blocking connections.';
              } else if (info.numPeers === 0) {
                description = `We're searching for other users who have this file. Found ${info.trackers?.length || 0} trackers, connecting...`;
              }

              setLoadingStatus({
                stage: isNoPeers ? 'warning' : 'metadata',
                message: isNoPeers ? '⚠️ No peers found' : (noPeersForLongTime ? 'No peers found - still searching...' : 'Loading file information...'),
                description: description,
                details: {
                  retryCount: retryCountRef.current,
                  maxRetries: MAX_RETRIES,
                  peers: info.numPeers,
                  connectionStatus: connectionStatus,
                  hasTrackers: info.diagnostic?.hasAnnounce || false,
                  trackerCount: info.diagnostic?.trackerCount || info.trackers?.length || 0,
                  suggestions: info.diagnostic?.suggestions || []
                }
              });
              toast.loading(
                `Loading torrent metadata... (${retryCountRef.current}/${MAX_RETRIES})`, 
                { id: 'torrent-loading' }
              );
              timeoutRef.current = setTimeout(checkTorrent, POLL_INTERVAL);
              return;
            }
            
            // Check if torrent has files (even if not ready yet)
            if (info.files && info.files.length > 0) {
              // Find video file in files array
              const videoFile = info.files.find(file => 
                file.name.endsWith('.mp4') || 
                file.name.endsWith('.mkv') || 
                file.name.endsWith('.avi') ||
                file.name.endsWith('.webm')
              );

              if (videoFile) {
                // Torrent has video file - we can start streaming once metadata is loaded
                // WebTorrent supports streaming even with minimal download progress
                if (info.ready || info.hasMetadata) {
                  // Use the video file from files array if videoFile is null
                  const finalVideoFile = info.videoFile || videoFile;
                  const streamUrl = `${API_URL}/api/torrent/${response.data.torrentId}/stream`;
                  
                  // Update info with video file
                  const updatedInfo = {
                    ...info,
                    videoFile: finalVideoFile
                  };
                  
                  clearPolling();
                  setLoading(false);
                  setProgress(100);
                  setLoadingStatus({
                    stage: 'ready',
                    message: '🚀 Stream ready!',
                    description: info.progress < 0.01 
                      ? '✨ Streaming from memory - no disk storage! The video will stream as you watch!' 
                      : '✨ The video is ready to stream! Starting the player...',
                    details: {
                      fileName: updatedInfo.name || 'Video',
                      progress: Math.round(info.progress * 100),
                      streamingMode: true
                    }
                  });
                  setTimeout(() => {
                    onStreamStart(streamUrl, updatedInfo);
                    toast.success('Stream ready!', { id: 'torrent-loading' });
                  }, 500);
                  return;
                }
              } else {
                // Metadata loaded but no video file found
                clearPolling();
                setLoading(false);
                setLoadingStatus({
                  stage: 'error',
                  message: 'No video file found',
                  description: 'This torrent doesn\'t contain a video file. Please use a torrent with MP4, MKV, AVI, or WebM video files.',
                  details: {}
                });
                toast.error('No video file found in this torrent. Please use a torrent with MP4, MKV, AVI, or WebM files.', { 
                  id: 'torrent-loading',
                  duration: 5000 
                });
                return;
              }
            }
            
            // Format download speed
            const formatSpeed = (bytesPerSec) => {
              if (!bytesPerSec || bytesPerSec === 0) return '0 B/s';
              const kb = bytesPerSec / 1024;
              const mb = kb / 1024;
              if (mb >= 1) return `${mb.toFixed(2)} MB/s`;
              return `${kb.toFixed(2)} KB/s`;
            };

            // Update progress message and status
            if (info.progress > 0) {
              const progressPercent = Math.round(info.progress * 100);
              setLoadingStatus({
                stage: 'downloading',
                message: `Downloading video... ${progressPercent}%`,
                description: `We're downloading the video file from other users (peers) on the network. The more peers, the faster it downloads.`,
                details: {
                  progress: progressPercent,
                  downloadSpeed: formatSpeed(info.downloadSpeed),
                  uploadSpeed: formatSpeed(info.uploadSpeed),
                  peers: info.numPeers,
                  fileName: info.name || 'Loading...'
                }
              });
              toast.loading(
                `Loading torrent... ${progressPercent}% (${retryCountRef.current}/${MAX_RETRIES})`, 
                { id: 'torrent-loading' }
              );
            } else if (info.numPeers > 0) {
              setLoadingStatus({
                stage: 'connecting',
                message: `Connected to ${info.numPeers} peer${info.numPeers > 1 ? 's' : ''}`,
                description: `Great! We found ${info.numPeers} other user${info.numPeers > 1 ? 's' : ''} who have this file. We're now starting to download the video.`,
                details: {
                  peers: info.numPeers,
                  downloadSpeed: formatSpeed(info.downloadSpeed),
                  fileName: info.name || 'Loading...'
                }
              });
              toast.loading(
                `Connected to ${info.numPeers} peer(s), downloading... (${retryCountRef.current}/${MAX_RETRIES})`, 
                { id: 'torrent-loading' }
              );
            } else {
              // No peers after many retries
              const noPeersWarning = retryCountRef.current > 20 && info.numPeers === 0;
              
              let message = 'Searching for peers...';
              let description = 'We\'re looking for other users who have this video file. This might take a moment. Popular videos load faster!';
              
              if (noPeersWarning) {
                message = '⚠️ No peers found';
                description = 'We can\'t find anyone sharing this file right now. This torrent might be dead (no active seeders). Try a different torrent or check back later.';
              }

              setLoadingStatus({
                stage: noPeersWarning ? 'warning' : 'searching',
                message: message,
                description: description,
                details: {
                  retryCount: retryCountRef.current,
                  maxRetries: MAX_RETRIES,
                  peers: info.numPeers,
                  connectionStatus: info.diagnostic?.connectionStatus || 'searching',
                  hasTrackers: info.diagnostic?.hasAnnounce || false,
                  hasDHT: info.diagnostic?.hasDHT || false
                }
              });
              toast.loading(
                `Connecting to peers... (${retryCountRef.current}/${MAX_RETRIES})`, 
                { id: 'torrent-loading' }
              );
            }

            // Continue polling
            timeoutRef.current = setTimeout(checkTorrent, POLL_INTERVAL);
          } catch (error) {
            console.error('Error checking torrent:', error);
            
            // If torrent not found, stop polling
            if (error.response?.status === 404) {
              clearPolling();
              setLoading(false);
              setLoadingStatus({
                stage: 'error',
                message: 'Torrent not found',
                description: 'The torrent connection was lost. Please try again with a fresh magnet link.',
                details: {}
              });
              toast.error('Torrent not found. Please try again.', { id: 'torrent-loading' });
              return;
            }
            
            // Continue polling on other errors
            if (retryCountRef.current < MAX_RETRIES) {
              setLoadingStatus({
                stage: 'retrying',
                message: 'Retrying connection...',
                description: 'We encountered a small issue. Don\'t worry, we\'re trying again automatically.',
                details: {
                  retryCount: retryCountRef.current,
                  maxRetries: MAX_RETRIES
                }
              });
              timeoutRef.current = setTimeout(checkTorrent, POLL_INTERVAL);
            } else {
              clearPolling();
              setLoading(false);
              setLoadingStatus({
                stage: 'error',
                message: 'Connection failed',
                description: 'We couldn\'t connect to the torrent after multiple attempts. Please check your internet connection and try again.',
                details: {}
              });
              toast.error('Failed to load torrent. Please try again.', { id: 'torrent-loading' });
            }
          }
        };

        timeoutRef.current = setTimeout(checkTorrent, 1000);
      }
    } catch (error) {
      console.error('Error adding torrent:', error);
      clearPolling();
      setLoading(false);
      setLoadingStatus({
        stage: 'error',
        message: 'Failed to add torrent',
        description: error.response?.data?.error || 'Something went wrong. Please check your magnet link and try again.',
        details: {}
      });
      toast.error(error.response?.data?.error || 'Failed to add torrent', { id: 'torrent-loading' });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleStreamStart();
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      clearPolling();
    };
  }, []);

  return (
    <div className="url-input-container">
      <div className="url-input-card">
        <h2 className="url-input-title">Enter Magnet URL</h2>
        <p className="url-input-description">
          Paste your magnet link below or search for torrents
        </p>

        <div className="search-toggle-section">
          <button
            type="button"
            className="search-toggle-button"
            onClick={() => setShowSearch(true)}
          >
            <span>🔍</span>
            Search Torrents
          </button>
        </div>
        
        <div className="divider">
          <span>OR</span>
        </div>
        
        <form onSubmit={handleSubmit} className="url-input-form">
          <div className="input-wrapper">
            <input
              type="text"
              value={magnetUrl}
              onChange={(e) => setMagnetUrl(e.target.value)}
              placeholder="magnet:?xt=urn:btih:..."
              className="url-input"
              disabled={loading}
            />
            <button 
              type="submit" 
              className="submit-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Loading...
                </>
              ) : (
                <>
                  <span>▶</span>
                  Stream
                </>
              )}
            </button>
            {loading && progress > 0 && (
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
              </div>
            )}
          </div>
        </form>

        {loading && loadingStatus && (
          <LoadingStatusPanel status={loadingStatus} progress={progress} />
        )}

        <div className="url-input-example">
          <p className="example-label">Example format:</p>
          <code className="example-code">
            magnet:?xt=urn:btih:...
          </code>
        </div>
      </div>

      {showSearch && (
        <TorrentSearch
          onSelectTorrent={handleTorrentFromSearch}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}

// Loading Status Panel Component
function LoadingStatusPanel({ status, progress }) {
  const getStageIcon = (stage) => {
    switch (stage) {
      case 'initializing':
      case 'connecting':
      case 'searching':
        return '🔍';
      case 'metadata':
        return '📋';
      case 'downloading':
        return '⬇️';
      case 'retrying':
        return '🔄';
      case 'warning':
        return '⚠️';
      case 'ready':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '⏳';
    }
  };

  const getStageColor = (stage) => {
    switch (stage) {
      case 'ready':
        return '#4ade80';
      case 'error':
        return '#f87171';
      case 'downloading':
        return '#60a5fa';
      default:
        return '#a78bfa';
    }
  };

  return (
    <div className="loading-status-panel">
      <div className="status-header">
        <span className="status-icon">{getStageIcon(status.stage)}</span>
        <div className="status-title-group">
          <h3 className="status-title">{status.message}</h3>
          {status.details.fileName && (
            <p className="status-filename">{status.details.fileName}</p>
          )}
        </div>
      </div>
      
      <p className="status-description">{status.description}</p>

      {status.details.progress !== undefined && (
        <div className="status-progress-detail">
          <div className="progress-info">
            <span>Progress: {status.details.progress}%</span>
            {status.details.downloadSpeed && (
              <span>Speed: {status.details.downloadSpeed}</span>
            )}
          </div>
        </div>
      )}

      {status.details.peers !== undefined && (
        <div className="status-details">
          <div className="detail-item">
            <span className="detail-label">👥 Peers:</span>
            <span className="detail-value">{status.details.peers}</span>
          </div>
          {status.details.downloadSpeed && (
            <div className="detail-item">
              <span className="detail-label">⬇️ Download:</span>
              <span className="detail-value">{status.details.downloadSpeed}</span>
            </div>
          )}
          {status.details.uploadSpeed && (
            <div className="detail-item">
              <span className="detail-label">⬆️ Upload:</span>
              <span className="detail-value">{status.details.uploadSpeed}</span>
            </div>
          )}
        </div>
      )}

      {status.details.retryCount && (
        <div className="status-retry-info">
          <span>Attempt {status.details.retryCount} of {status.details.maxRetries}</span>
        </div>
      )}

      {status.details.connectionStatus && (
        <div className="status-connection-info">
          <div className="connection-status">
            <span className="connection-label">Connection:</span>
            <span className={`connection-value ${status.details.connectionStatus}`}>
              {status.details.connectionStatus === 'connected' ? '✅ Connected' : '🔍 Searching'}
            </span>
          </div>
          {status.details.hasTrackers && (
            <div className="connection-detail">Trackers: Enabled</div>
          )}
          {status.details.hasDHT && (
            <div className="connection-detail">DHT: Enabled</div>
          )}
        </div>
      )}

      {status.stage === 'warning' && (
        <div className="status-warning-box">
          <strong>💡 Tips:</strong>
          {status.details.suggestions && status.details.suggestions.length > 0 ? (
            <ul>
              {status.details.suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          ) : (
            <ul>
              <li>Try a different torrent with more seeders</li>
              <li>Check if the torrent is still active</li>
              <li>Popular/newer videos load faster</li>
              <li>Check your firewall/network settings</li>
            </ul>
          )}
          {status.details.trackerCount > 0 && (
            <div className="tracker-info">
              <span>📡 Found {status.details.trackerCount} tracker(s) but no peers responding</span>
            </div>
          )}
        </div>
      )}

      {status.stage === 'downloading' && progress > 0 && (
        <div className="status-progress-bar">
          <div 
            className="status-progress-fill" 
            style={{ 
              width: `${progress}%`,
              backgroundColor: getStageColor(status.stage)
            }}
          />
        </div>
      )}

      {status.details.streamingMode && (
        <div className="streaming-mode-badge">
          <span className="streaming-icon">🚀</span>
          <span className="streaming-text">Streaming from Memory - No Disk Storage!</span>
        </div>
      )}
    </div>
  );
}

export default UrlInput;
