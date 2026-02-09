import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import './TorrentSearch.css';

// Auto-detect API URL: use same origin in production, localhost in development
const API_URL = process.env.REACT_APP_API_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:5000' 
    : window.location.origin);

function TorrentSearch({ onSelectTorrent, onClose, initialQuery, initialResults, initialHasSearched, onStateChange }) {
  const [searchQuery, setSearchQuery] = useState(initialQuery || '');
  const [searchResults, setSearchResults] = useState(initialResults || []);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(initialHasSearched || false);
  const searchInputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  
  // Update parent state when search state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        query: searchQuery,
        results: searchResults,
        hasSearched: hasSearched
      });
    }
  }, [searchQuery, searchResults, hasSearched, onStateChange]);

  useEffect(() => {
    // Focus search input when component mounts
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  const handleSearch = async (query = searchQuery) => {
    if (!query.trim()) {
      toast.error('Please enter a search term');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setSearchResults([]);

    try {
      const response = await axios.get(`${API_URL}/api/search`, {
        params: {
          query: query.trim(),
          page: 1,
          limit: 30
        }
      });

      if (response.data.success) {
        setSearchResults(response.data.results || []);
        if (response.data.results.length === 0) {
          toast.info('No video torrents found. Try a different search term.', { duration: 3000 });
        } else {
          toast.success(`Found ${response.data.results.length} torrents`, { duration: 2000 });
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed. Please try again.', { duration: 3000 });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    handleSearch();
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce search for better UX (search after 800ms of no typing)
    if (value.trim().length >= 3) {
      debounceTimerRef.current = setTimeout(() => {
        handleSearch(value);
      }, 800);
    } else {
      setSearchResults([]);
      setHasSearched(false);
    }
  };

  const handleSelectTorrent = (result) => {
    onSelectTorrent(result.magnet);
    onClose();
  };

  const getQualityBadge = (name) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('4k') || lowerName.includes('2160p')) return { text: '4K', color: '#f59e0b' };
    if (lowerName.includes('1080p')) return { text: '1080p', color: '#10b981' };
    if (lowerName.includes('720p')) return { text: '720p', color: '#3b82f6' };
    if (lowerName.includes('480p')) return { text: '480p', color: '#6b7280' };
    return null;
  };

  return (
    <div className="torrent-search-overlay" onClick={onClose}>
      <div className="torrent-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-header">
          <h2>🔍 Search Torrents</h2>
          <button className="close-search-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="search-form">
          <div className="search-input-wrapper">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              placeholder="Search for movies, TV shows, videos..."
              className="search-input"
              disabled={isSearching}
            />
            <button 
              type="submit" 
              className="search-button"
              disabled={isSearching || !searchQuery.trim()}
            >
              {isSearching ? (
                <>
                  <span className="spinner-small"></span>
                  Searching...
                </>
              ) : (
                <>
                  <span>🔍</span>
                  Search
                </>
              )}
            </button>
          </div>
        </form>

        <div className="search-results-container">
          {isSearching && (
            <div className="search-loading">
              <div className="loading-spinner"></div>
              <p>Searching torrents...</p>
            </div>
          )}

          {!isSearching && hasSearched && searchResults.length === 0 && (
            <div className="search-empty">
              <p>No results found</p>
              <p className="search-empty-hint">Try different keywords or check your spelling</p>
            </div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <div className="search-results">
              <div className="results-header">
                <span className="results-count">{searchResults.length} results</span>
              </div>
              <div className="results-list">
                {searchResults.map((result, index) => {
                  const quality = getQualityBadge(result.name);
                  return (
                    <div
                      key={result.id || index}
                      className="result-item"
                      onClick={() => handleSelectTorrent(result)}
                    >
                      <div className="result-content">
                        <h3 className="result-title">{result.name}</h3>
                        <div className="result-meta">
                          {quality && (
                            <span className="quality-badge" style={{ backgroundColor: quality.color }}>
                              {quality.text}
                            </span>
                          )}
                          <span className="result-size">📦 {result.size}</span>
                          <span className="result-seeders" title="More seeders = faster streaming">
                            ⬆️ {result.seeders} seeders
                            {result.seeders > 50 && <span className="high-seeders-badge">🔥</span>}
                          </span>
                          {result.leechers > 0 && (
                            <span className="result-leechers">⬇️ {result.leechers} leechers</span>
                          )}
                          {result.category && (
                            <span className="result-category">{result.category}</span>
                          )}
                          {result.uploaded && (
                            <span className="result-uploaded">📅 {result.uploaded}</span>
                          )}
                        </div>
                      </div>
                      <button className="stream-button">
                        <span>▶</span>
                        Stream
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!hasSearched && !isSearching && (
            <div className="search-placeholder">
              <div className="placeholder-icon">🎬</div>
              <p>Search for movies, TV shows, or videos</p>
              <p className="placeholder-hint">Start typing to search (minimum 3 characters)</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TorrentSearch;
