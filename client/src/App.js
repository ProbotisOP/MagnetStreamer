import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import VideoPlayer from './components/VideoPlayer';
import UrlInput from './components/UrlInput';
import './App.css';

function App() {
  const [streamUrl, setStreamUrl] = useState(null);
  const [torrentInfo, setTorrentInfo] = useState(null);

  const handleStreamStart = (url, info) => {
    setStreamUrl(url);
    setTorrentInfo(info);
  };

  const handleReset = () => {
    setStreamUrl(null);
    setTorrentInfo(null);
  };

  return (
    <div className="App">
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1a1a1a',
            color: '#fff',
            borderRadius: '8px',
          },
        }}
      />
      
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">
            <span className="title-icon">🎬</span>
            MagnetStreamer
          </h1>
          <p className="app-subtitle">
            Stream torrent videos directly in your browser
          </p>
          <p className="app-credit">
            Built by <a href="https://github.com/ProbotisOP" target="_blank" rel="noopener noreferrer">ProbotisOP</a>
          </p>
        </div>
      </header>

      <main className="app-main">
        {!streamUrl ? (
          <UrlInput onStreamStart={handleStreamStart} />
        ) : (
          <VideoPlayer 
            streamUrl={streamUrl}
            torrentInfo={torrentInfo}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
}

export default App;
