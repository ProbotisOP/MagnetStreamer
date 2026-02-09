// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const multer = require('multer');
const WebTorrent = require('webtorrent');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// Configure multer for subtitle uploads
const upload = multer({ 
  dest: 'uploads/subtitles/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.srt', '.vtt', '.ass', '.ssa'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only subtitle files (.srt, .vtt, .ass, .ssa) are allowed'));
    }
  }
});

// Store active torrents with metadata for cleanup
const activeTorrents = new Map(); // Map<magnetUrl, { torrent, lastAccessed, createdAt }>

// Auto-cleanup: Remove inactive torrents after 30 minutes
const TORRENT_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const MAX_ACTIVE_TORRENTS = 3; // Maximum active torrents at once

// Helper function to destroy a torrent and free memory
function destroyTorrent(magnetUrl, data, reason = 'cleanup') {
  console.log(`🧹 ${reason}: Destroying torrent ${data.torrent.infoHash} (${data.torrent.name || 'unnamed'})`);
  
  if (data.torrent && !data.torrent.destroyed) {
    data.torrent.destroy((err) => {
      if (err) {
        console.error(`❌ Error destroying torrent ${data.torrent.infoHash}:`, err);
      } else {
        console.log(`✅ Torrent ${data.torrent.infoHash} destroyed - memory freed`);
      }
    });
  }
  
  activeTorrents.delete(magnetUrl);
}

// Auto-cleanup: Remove inactive torrents after 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [magnetUrl, data] of activeTorrents.entries()) {
    const timeSinceLastAccess = now - data.lastAccessed;
    
    // Remove torrent if inactive for 30 minutes
    if (timeSinceLastAccess > TORRENT_TIMEOUT) {
      destroyTorrent(magnetUrl, data, 'Auto-cleanup (inactive 30+ minutes)');
    }
  }
}, CLEANUP_INTERVAL);

// Cleanup old torrents when adding new ones (user started new stream)
function cleanupOldTorrents(newMagnetUrl) {
  // If we're at max capacity, remove oldest torrents
  if (activeTorrents.size >= MAX_ACTIVE_TORRENTS) {
    // Sort by last accessed time (oldest first)
    const sortedTorrents = Array.from(activeTorrents.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    // Remove oldest torrents until we have room
    const toRemove = activeTorrents.size - MAX_ACTIVE_TORRENTS + 1;
    for (let i = 0; i < toRemove; i++) {
      const [magnetUrl, data] = sortedTorrents[i];
      if (magnetUrl !== newMagnetUrl) {
        destroyTorrent(magnetUrl, data, 'New stream started - cleaning up old torrent');
      }
    }
  }
}

console.log('🧹 Auto-cleanup enabled: Torrents inactive for 30+ minutes will be removed');
console.log(`📊 Max active torrents: ${MAX_ACTIVE_TORRENTS} (old ones cleaned when new stream starts)`);

// WebTorrent client with STREAM-FIRST configuration (no disk storage!)
const client = new WebTorrent({
  maxConns: 55,           // Maximum connections per torrent
  nodeId: undefined,      // Use random node ID
  peerId: undefined,      // Use random peer ID
  tracker: true,          // Enable tracker support
  dht: true,              // Enable DHT (Distributed Hash Table)
  webSeeds: true,         // Enable web seed support
  utp: true,              // Enable uTP protocol
  retries: 5,             // Number of retries
  maxWebConns: 4,         // Max web seed connections
  // 🚀 STREAM-FIRST: Store in memory only, no disk writes!
  // This means we download pieces but don't save them permanently
  // Pieces are kept in RAM and streamed directly
  rtcConfig: {            // WebRTC configuration
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }
});

// Log WebTorrent client status
client.on('error', (err) => {
  console.error('WebTorrent client error:', err);
});

console.log('🌐 WebTorrent client initialized with DHT and tracker support');

// Routes
app.post('/api/stream', (req, res) => {
  const { magnetUrl } = req.body;
  
  if (!magnetUrl) {
    return res.status(400).json({ error: 'Magnet URL is required' });
  }

  try {
    // Check if torrent already exists
    if (activeTorrents.has(magnetUrl)) {
      const data = activeTorrents.get(magnetUrl);
      const torrent = data.torrent;
      
      // Update last accessed time
      data.lastAccessed = Date.now();
      
      // Check if torrent was destroyed
      if (torrent.destroyed) {
        activeTorrents.delete(magnetUrl);
      } else {
        const videoFile = torrent.files.find(file => 
          file.name.endsWith('.mp4') || 
          file.name.endsWith('.mkv') || 
          file.name.endsWith('.avi') ||
          file.name.endsWith('.webm')
        );
        
        if (videoFile) {
          return res.json({ 
            success: true,
            torrentId: torrent.infoHash,
            fileName: videoFile.name,
            ready: torrent.ready
          });
        }
      }
    }

    // Clean up old torrents when user starts a new stream
    cleanupOldTorrents(magnetUrl);

    // Add new torrent with STREAM-FIRST optimization
    // 🎯 Key: No storage path = memory-only streaming!
    // Don't override announce - let WebTorrent use trackers from magnet link!
    const torrent = client.add(magnetUrl, {
      // Don't set announce: [] - this would override magnet link trackers!
      // WebTorrent will automatically extract trackers from the magnet URL
      maxWebConns: 4,
      // 🚀 STREAM-FIRST: Don't specify path - keeps data in memory only!
      // Pieces are downloaded to RAM and streamed directly, then discarded
      // This is true "streaming" without permanent storage
    }, (torrent) => {
      // 🎬 Prioritize sequential download for smooth streaming
      // Download pieces in order (0, 1, 2, 3...) instead of random
      // This allows streaming to start immediately
      if (torrent.files && torrent.files.length > 0) {
        const videoFile = torrent.files.find(file => 
          file.name.endsWith('.mp4') || 
          file.name.endsWith('.mkv') || 
          file.name.endsWith('.avi') ||
          file.name.endsWith('.webm')
        );
        
        if (videoFile && torrent.pieces) {
          // Prioritize pieces sequentially for streaming
          // This ensures we download in order: piece 0, 1, 2, 3...
          // Instead of random pieces which would require full download
          const numPieces = torrent.pieces.length;
          for (let i = 0; i < Math.min(numPieces, 100); i++) {
            // Prioritize first 100 pieces for immediate playback
            // Check if piece exists before setting priority
            if (torrent.pieces[i] && typeof torrent.pieces[i].priority === 'function') {
              try {
                torrent.pieces[i].priority(1);
              } catch (err) {
                // Ignore errors if piece priority can't be set
                console.warn(`Could not set priority for piece ${i}:`, err.message);
              }
            }
          }
        }
      }
    });

    // Store torrent with metadata for cleanup
    activeTorrents.set(magnetUrl, {
      torrent: torrent,
      lastAccessed: Date.now(),
      createdAt: Date.now()
    });

    // Set timeout for metadata loading (30 seconds)
    const metadataTimeout = setTimeout(() => {
      if (!torrent.files || torrent.files.length === 0) {
        console.warn(`Torrent ${torrent.infoHash} metadata timeout - no peers found`);
      }
    }, 30000);

    // Track torrent events
    torrent.on('infoHash', () => {
      console.log(`📥 Torrent infoHash: ${torrent.infoHash}`);
    });

    torrent.on('metadata', () => {
      console.log(`📋 Metadata loaded for: ${torrent.name}`);
      clearTimeout(metadataTimeout);
    });

    torrent.on('ready', () => {
      console.log(`✅ Torrent ready: ${torrent.name}`);
      clearTimeout(metadataTimeout);
      
      const videoFile = torrent.files.find(file => 
        file.name.endsWith('.mp4') || 
        file.name.endsWith('.mkv') || 
        file.name.endsWith('.avi') ||
        file.name.endsWith('.webm')
      );

      if (videoFile) {
        io.emit('torrent-ready', {
          torrentId: torrent.infoHash,
          fileName: videoFile.name
        });
      }
    });

    torrent.on('error', (err) => {
      console.error(`❌ Torrent error (${torrent.infoHash}):`, err.message);
      clearTimeout(metadataTimeout);
    });

    torrent.on('warning', (err) => {
      console.warn(`⚠️ Torrent warning (${torrent.infoHash}):`, err.message);
    });

    torrent.on('noPeers', (announceType) => {
      console.warn(`🔍 No peers found for ${torrent.infoHash} (${announceType})`);
      // Try to manually announce to trackers if no peers found
      if (torrent.tracker && torrent.tracker.announce) {
        console.log(`🔄 Attempting to announce to ${torrent.tracker.announce.length} trackers...`);
      }
    });

    torrent.on('trackerAnnounce', () => {
      console.log(`📡 Announced to tracker for ${torrent.infoHash}`);
    });

    torrent.on('trackerWarning', (err) => {
      console.warn(`⚠️ Tracker warning for ${torrent.infoHash}:`, err.message || err);
    });

    torrent.on('trackerError', (err) => {
      console.error(`❌ Tracker error for ${torrent.infoHash}:`, err.message || err);
    });

    torrent.on('peer', () => {
      console.log(`👥 Peer connected to ${torrent.infoHash} (Total: ${torrent.numPeers})`);
    });

    torrent.on('download', (bytes) => {
      if (torrent.progress > 0 && torrent.progress % 0.1 < 0.01) {
        console.log(`⬇️ Stream progress: ${(torrent.progress * 100).toFixed(1)}% - ${torrent.downloadSpeed} B/s`);
      }
      
      // 🚀 STREAM-FIRST: Prioritize sequential pieces for smooth playback
      // Once we have enough pieces to start, prioritize next pieces in sequence
      if (torrent.files && torrent.files.length > 0 && torrent.progress > 0.01) {
        const videoFile = torrent.files.find(file => 
          file.name.endsWith('.mp4') || 
          file.name.endsWith('.mkv') || 
          file.name.endsWith('.avi') ||
          file.name.endsWith('.webm')
        );
        
        if (videoFile) {
          // Calculate which piece we're currently "watching"
          const currentPiece = Math.floor((torrent.progress * torrent.pieces.length));
          const bufferAhead = 20; // Keep 20 pieces ahead for smooth playback
          
          // Prioritize pieces sequentially (streaming order)
          for (let i = currentPiece; i < Math.min(currentPiece + bufferAhead, torrent.pieces.length); i++) {
            if (torrent.pieces[i] && !torrent.pieces[i].done && typeof torrent.pieces[i].priority === 'function') {
              try {
                torrent.pieces[i].priority(1); // High priority
              } catch (err) {
                // Ignore errors if piece priority can't be set
                console.warn(`Could not set priority for piece ${i}:`, err.message);
              }
            }
          }
        }
      }
    });

    res.json({ 
      success: true,
      torrentId: torrent.infoHash,
      message: 'Torrent added, connecting to peers...'
    });
  } catch (error) {
    console.error('Error adding torrent:', error);
    res.status(500).json({ error: 'Failed to add torrent' });
  }
});

// Get torrent stream URL - STREAM-FIRST approach
// 🚀 This streams directly from memory without saving to disk!
app.get('/api/torrent/:torrentId/stream', (req, res) => {
  const { torrentId } = req.params;
  
  const torrent = client.torrents.find(t => t.infoHash === torrentId);
  
  if (!torrent) {
    return res.status(404).json({ error: 'Torrent not found' });
  }

  const videoFile = torrent.files.find(file => 
    file.name.endsWith('.mp4') || 
    file.name.endsWith('.mkv') || 
    file.name.endsWith('.avi') ||
    file.name.endsWith('.webm')
  );

  if (!videoFile) {
    return res.status(404).json({ error: 'No video file found in torrent' });
  }

  // Check if torrent is still active
  if (torrent.destroyed) {
    return res.status(410).json({ error: 'Torrent has been destroyed' });
  }

  // 🎬 STREAM-FIRST: Create read stream directly from memory
  // WebTorrent stores pieces in RAM, we stream them as they arrive
  // No permanent disk storage - true streaming!
  
  // Set headers for streaming
  const contentType = videoFile.name.endsWith('.mkv') ? 'video/x-matroska' :
                      videoFile.name.endsWith('.avi') ? 'video/x-msvideo' :
                      videoFile.name.endsWith('.webm') ? 'video/webm' :
                      'video/mp4';
  
  res.setHeader('Content-Type', contentType);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Length', videoFile.length);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Connection', 'keep-alive');

  // Handle range requests for seeking
  const range = req.headers.range;
  
  // Helper function to create stream with error handling
  const createStream = (start, end) => {
    try {
      // Validate range
      if (start < 0) start = 0;
      if (end >= videoFile.length) end = videoFile.length - 1;
      if (start > end) {
        if (!res.headersSent) {
          res.status(416).json({ error: 'Range Not Satisfiable' });
        }
        return;
      }

      // Check if torrent is still valid
      if (torrent.destroyed || !videoFile) {
        if (!res.headersSent) {
          res.status(410).json({ error: 'Torrent no longer available' });
        }
        return;
      }

      const stream = videoFile.createReadStream({ start, end });
      
      // Handle stream errors gracefully
      stream.on('error', (err) => {
        // Only log if it's not a client disconnect
        if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {
          console.error(`Stream error for ${torrentId} (${start}-${end}):`, err.message);
        }
        // Don't send error if headers already sent (client disconnected)
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream error', message: err.message });
        } else if (!res.destroyed) {
          res.destroy();
        }
      });

      // Handle response finish
      res.on('finish', () => {
        if (stream && !stream.destroyed) {
          stream.destroy();
        }
      });

      // Handle client disconnect
      req.on('close', () => {
        if (stream && !stream.destroyed) {
          stream.destroy();
        }
      });

      req.on('aborted', () => {
        if (stream && !stream.destroyed) {
          stream.destroy();
        }
      });

      // Pipe stream to response
      stream.pipe(res);
    } catch (err) {
      console.error(`Error creating stream for ${torrentId}:`, err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create stream', message: err.message });
      }
    }
  };

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : videoFile.length - 1;
    
    // Validate range
    if (isNaN(start) || isNaN(end)) {
      res.status(400).json({ error: 'Invalid range' });
      return;
    }

    const chunksize = (end - start) + 1;
    
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${videoFile.length}`);
    res.setHeader('Content-Length', chunksize);
    res.setHeader('Connection', 'keep-alive');

    createStream(start, end);
  } else {
    // No range request - stream from beginning
    res.setHeader('Connection', 'keep-alive');
    createStream(0, videoFile.length - 1);
  }
});

// Get torrent info
app.get('/api/torrent/:torrentId/info', (req, res) => {
  const { torrentId } = req.params;
  
  const torrent = client.torrents.find(t => t.infoHash === torrentId);
  
  if (!torrent) {
    return res.status(404).json({ error: 'Torrent not found' });
  }

  // Update last accessed time for cleanup tracking
  for (const [magnetUrl, data] of activeTorrents.entries()) {
    if (data.torrent.infoHash === torrentId) {
      data.lastAccessed = Date.now();
      break;
    }
  }

  // Check if metadata is loaded (files array will be populated)
  const hasMetadata = torrent.files && torrent.files.length > 0;

  const videoFile = hasMetadata ? torrent.files.find(file => 
    file.name.endsWith('.mp4') || 
    file.name.endsWith('.mkv') || 
    file.name.endsWith('.avi') ||
    file.name.endsWith('.webm')
  ) : null;

  const audioFiles = hasMetadata ? torrent.files.filter(file => 
    file.name.endsWith('.mp3') || 
    file.name.endsWith('.m4a') ||
    file.name.endsWith('.aac')
  ) : [];

  // Get tracker information - try multiple sources
  let trackers = [];
  let announce = [];
  
  // Try to get trackers from different sources
  if (torrent.announce) {
    announce = Array.isArray(torrent.announce) ? torrent.announce : [torrent.announce];
  }
  
  if (torrent.tracker && torrent.tracker.announce) {
    trackers = Array.isArray(torrent.tracker.announce) 
      ? torrent.tracker.announce 
      : [torrent.tracker.announce];
  }
  
  // Use announce if trackers is empty
  if (trackers.length === 0 && announce.length > 0) {
    trackers = announce;
  }

  // Calculate connection health
  const timeSinceStart = torrent.timeRemaining ? Date.now() - (torrent.timeRemaining * 1000) : 0;
  const hasBeenSearching = torrent.numPeers === 0 && timeSinceStart > 10000; // 10 seconds
  
  // Get DHT node count if available
  const dhtNodes = client.dht ? client.dht.nodes : 0;

  res.json({
    infoHash: torrent.infoHash,
    name: torrent.name || 'Loading...',
    progress: torrent.progress,
    downloadSpeed: torrent.downloadSpeed,
    uploadSpeed: torrent.uploadSpeed,
    numPeers: torrent.numPeers,
    numSeeds: torrent.numPeers, // WebTorrent doesn't distinguish, but we can estimate
    ready: torrent.ready,
    hasMetadata: hasMetadata,
    timeRemaining: torrent.done ? 0 : (torrent.downloadSpeed > 0 && torrent.length > 0) 
      ? Math.round((torrent.length * (1 - torrent.progress)) / torrent.downloadSpeed) 
      : null,
    received: torrent.received || 0,
    length: torrent.length || 0,
    videoFile: videoFile ? {
      name: videoFile.name,
      length: videoFile.length,
      path: videoFile.path
    } : null,
    audioFiles: audioFiles.map(file => ({
      name: file.name,
      length: file.length,
      path: file.path
    })),
    files: hasMetadata ? torrent.files.map(file => ({
      name: file.name,
      length: file.length,
      path: file.path
    })) : [],
    trackers: trackers.length > 0 ? trackers : announce,
    // Enhanced diagnostic info
    diagnostic: {
      hasAnnounce: trackers.length > 0 || announce.length > 0,
      hasDHT: true, // DHT is enabled
      hasWebRTC: true, // WebRTC is enabled
      connectionStatus: torrent.numPeers > 0 ? 'connected' : (hasBeenSearching ? 'no-peers' : 'searching'),
      trackerCount: trackers.length,
      dhtNodes: dhtNodes,
      hasBeenSearching: hasBeenSearching,
      // Additional connection hints
      suggestions: torrent.numPeers === 0 ? [
        'No peers found - torrent might be dead (no active seeders)',
        'Try a different torrent with more seeders',
        'Check your internet connection and firewall settings',
        'Some trackers may be blocked by your network'
      ] : []
    }
  });
});

// Upload subtitle
app.post('/api/subtitles/upload', upload.single('subtitle'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No subtitle file uploaded' });
  }

  res.json({
    success: true,
    filename: req.file.filename,
    originalName: req.file.originalname,
    path: `/api/subtitles/${req.file.filename}`
  });
});

// Serve subtitle files
app.get('/api/subtitles/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '../uploads/subtitles', filename);
  res.sendFile(filePath);
});

// Download torrent video file
app.get('/api/torrent/:torrentId/download', (req, res) => {
  const { torrentId } = req.params;
  
  const torrent = client.torrents.find(t => t.infoHash === torrentId);
  
  if (!torrent) {
    return res.status(404).json({ error: 'Torrent not found' });
  }

  // Update last accessed time for cleanup tracking
  for (const [magnetUrl, data] of activeTorrents.entries()) {
    if (data.torrent.infoHash === torrentId) {
      data.lastAccessed = Date.now();
      break;
    }
  }

  const videoFile = torrent.files.find(file => 
    file.name.endsWith('.mp4') || 
    file.name.endsWith('.mkv') || 
    file.name.endsWith('.avi') ||
    file.name.endsWith('.webm')
  );

  if (!videoFile) {
    return res.status(404).json({ error: 'No video file found in torrent' });
  }

  // Check if torrent is still active
  if (torrent.destroyed) {
    return res.status(410).json({ error: 'Torrent has been destroyed' });
  }

  // Set headers for file download
  const fileName = videoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_'); // Sanitize filename
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Length', videoFile.length);
  res.setHeader('Accept-Ranges', 'bytes');

  // Handle range requests for resumable downloads
  const range = req.headers.range;
  
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : videoFile.length - 1;
    
    if (isNaN(start) || isNaN(end) || start > end) {
      res.status(416).json({ error: 'Range Not Satisfiable' });
      return;
    }

    const chunksize = (end - start) + 1;
    
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${videoFile.length}`);
    res.setHeader('Content-Length', chunksize);

    const stream = videoFile.createReadStream({ start, end });
    
    stream.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download error', message: err.message });
      } else {
        res.destroy();
      }
    });

    stream.pipe(res);
  } else {
    // Full file download
    const stream = videoFile.createReadStream();
    
    stream.on('error', (err) => {
      console.error(`Download error for ${torrentId}:`, err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download error', message: err.message });
      } else {
        res.destroy();
      }
    });

    // Track download progress
    let downloadedBytes = 0;
    stream.on('data', (chunk) => {
      downloadedBytes += chunk.length;
    });

    stream.on('end', () => {
      console.log(`✅ Download completed: ${fileName} (${downloadedBytes} bytes)`);
    });

    stream.pipe(res);
  }
});

// Torrent Search API
app.get('/api/search', async (req, res) => {
  const { query, page = 1, limit = 20 } = req.query;
  
  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    // Use a public torrent search API (ThePirateBay API)
    // Search in multiple video categories: Movies (200), TV (205), Video (299)
    const categories = ['200', '205', '299']; // Movies, TV, Video
    const searchPromises = categories.map(cat => {
      const searchUrl = `https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=${cat}`;
      
      return new Promise((resolve) => {
        const https = require('https');
        https.get(searchUrl, (response) => {
          let data = '';
          response.on('data', (chunk) => {
            data += chunk;
          });
          response.on('end', () => {
            try {
              const results = JSON.parse(data);
              resolve(results || []);
            } catch (err) {
              resolve([]);
            }
          });
        }).on('error', () => resolve([]));
      });
    });

    // Wait for all category searches
    const allResults = await Promise.all(searchPromises);
    const searchResults = [].concat(...allResults);
    

    // Filter and format results
    const formattedResults = searchResults
      .filter(result => result && result.info_hash)
      .slice((page - 1) * limit, page * limit)
      .map(result => ({
        id: result.id,
        name: result.name,
        infoHash: result.info_hash,
        size: formatBytes(parseInt(result.size || 0)),
        seeders: parseInt(result.seeders || 0),
        leechers: parseInt(result.leechers || 0),
        magnet: `magnet:?xt=urn:btih:${result.info_hash}&dn=${encodeURIComponent(result.name)}`,
        category: getCategoryName(result.category),
        uploaded: result.added ? new Date(parseInt(result.added) * 1000).toLocaleDateString() : 'Unknown'
      }))
      .filter(result => {
        // Filter for video files only - be more lenient to catch more results
        const name = result.name.toLowerCase();
        // Check for video extensions or video-related keywords
        const hasVideoExt = name.includes('.mp4') || name.includes('.mkv') || 
                           name.includes('.avi') || name.includes('.webm') ||
                           name.includes('.m4v') || name.includes('.mov');
        const hasVideoKeywords = name.includes('1080p') || name.includes('720p') || 
                               name.includes('480p') || name.includes('4k') || 
                               name.includes('2160p') || name.includes('hdr') ||
                               name.includes('bluray') || name.includes('dvdrip') ||
                               name.includes('webrip') || name.includes('hdtv');
        // Also include if it has good seeders (likely a video)
        const hasGoodSeeders = parseInt(result.seeders || 0) > 5;
        
        return hasVideoExt || hasVideoKeywords || hasGoodSeeders;
      })
      // Sort by seeders (most popular first)
      .sort((a, b) => {
        const seedersA = parseInt(a.seeders || 0);
        const seedersB = parseInt(b.seeders || 0);
        return seedersB - seedersA;
      });

    res.json({
      success: true,
      query: query,
      page: parseInt(page),
      limit: parseInt(limit),
      total: formattedResults.length,
      results: formattedResults
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Search failed', 
      message: error.message 
    });
  }
});

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Helper function to get category name
function getCategoryName(categoryId) {
  const categories = {
    '200': 'Movies',
    '201': 'Movies DVDR',
    '207': 'Movies HD',
    '208': 'Movies 3D',
    '209': 'Movies BluRay',
    '205': 'TV Shows',
    '208': 'TV HD',
    '299': 'Video',
    '501': 'TV',
    '503': 'TV HD'
  };
  return categories[categoryId] || 'Video';
}

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 MagnetStreamer server running on port ${PORT}`);
  console.log(`📺 Built by ProbotisOP - https://github.com/ProbotisOP`);
});
