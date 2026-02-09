# 🚀 Quick Setup Guide

## Installation Steps

1. **Install all dependencies**
   ```bash
   npm run install-all
   ```

2. **Start development servers**
   ```bash
   npm run dev
   ```

   This will start:
   - Backend server: `http://localhost:5000`
   - Frontend app: `http://localhost:3000`

3. **Open your browser**
   Navigate to `http://localhost:3000`

## First Time Setup

The application will automatically:
- Create the `uploads/subtitles/` directory for subtitle files
- Set up WebTorrent client for streaming
- Configure CORS for local development

## Testing with a Magnet URL

1. Find a magnet URL for an MP4 video file
2. Paste it in the input field
3. Click "Stream" and wait for the torrent to load
4. Enjoy streaming!

## Troubleshooting

### Port Already in Use
If port 5000 or 3000 is already in use:
- Change `PORT` in `.env` file (backend)
- React will automatically use next available port

### Torrent Not Loading
- Ensure the magnet URL is valid
- Check browser console for errors
- Some torrents may take time to connect to peers

### Subtitle Not Showing
- Ensure subtitle file format is supported (.srt, .vtt, .ass, .ssa)
- Check that the subtitle file is properly formatted
- Try a different subtitle file

## Production Deployment

1. Build the React app:
   ```bash
   npm run build
   ```

2. Set environment variables:
   ```bash
   PORT=5000
   CLIENT_URL=https://yourdomain.com
   NODE_ENV=production
   ```

3. Start the server:
   ```bash
   npm start
   ```

The server will serve the built React app from the `client/build` directory.
