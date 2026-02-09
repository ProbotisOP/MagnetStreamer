# 🎬 MagnetStreamer

A sleek SaaS application that allows you to stream torrent videos directly in your browser. Built with attention to detail, featuring a professional video player with advanced controls.

**Built by [ProbotisOP](https://github.com/ProbotisOP)**

## ✨ Features

### 🎥 Advanced Video Player
- **Customizable Skip Intervals**: Set how many seconds to skip forward/backward (5-60 seconds)
- **Keyboard Controls**: Full keyboard support for all player functions
- **Subtitle Support**: Upload and display subtitles (.srt, .vtt, .ass, .ssa formats)
- **Multi-Language Audio**: Select from multiple audio tracks if available
- **Playback Speed Control**: Adjust playback rate from 0.25x to 2x
- **Volume Control**: Precise volume adjustment with visual feedback
- **Fullscreen Mode**: Immersive viewing experience
- **Sleek UI**: Modern, gradient-based design with smooth animations

### 🎮 Keyboard Shortcuts
- `Space` - Play/Pause
- `←` / `→` - Skip backward/forward (customizable interval)
- `↑` / `↓` - Increase/Decrease volume
- `M` - Mute/Unmute
- `F` - Toggle fullscreen
- `Esc` - Close settings

### 🚀 Quick Start
1. Paste a magnet URL
2. Wait for the torrent to load
3. Start streaming instantly!

## 🛠️ Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ProbotisOP/magnetStreamer.git
   cd magnetStreamer
   ```

2. **Install dependencies**
   ```bash
   npm run install-all
   ```

3. **Create environment file** (optional)
   ```bash
   # Create .env file in root directory
   PORT=5000
   CLIENT_URL=http://localhost:3000
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

   This will start:
   - Backend server on `http://localhost:5000`
   - Frontend React app on `http://localhost:3000`

### Production Build

1. **Build the React app**
   ```bash
   npm run build
   ```

2. **Start the production server**
   ```bash
   npm start
   ```

## 📁 Project Structure

```
magnetStreamer/
├── server/
│   └── index.js          # Express backend with WebTorrent
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── VideoPlayer.js      # Main video player component
│   │   │   ├── PlayerControls.js  # Video controls
│   │   │   ├── PlayerSettings.js  # Settings panel
│   │   │   └── UrlInput.js        # Magnet URL input
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── uploads/
│   └── subtitles/        # Uploaded subtitle files
├── package.json
└── README.md
```

## 🎯 Usage

1. **Enter Magnet URL**: Paste your magnet link in the input field
2. **Wait for Loading**: The app will add the torrent and prepare the stream
3. **Enjoy Streaming**: Use the advanced controls to customize your viewing experience
4. **Upload Subtitles**: Click the settings icon to upload subtitle files
5. **Adjust Settings**: Customize skip intervals, select audio tracks, and more

## 🔧 Technology Stack

### Backend
- **Express.js** - Web server framework
- **WebTorrent** - BitTorrent client for streaming
- **Socket.io** - Real-time updates
- **Multer** - File upload handling

### Frontend
- **React** - UI framework
- **Video.js** - Video player foundation
- **Axios** - HTTP client
- **React Hot Toast** - Notifications

## 🎨 Features in Detail

### Customizable Skip Intervals
Set your preferred skip interval (5-60 seconds) in the settings panel. This affects both keyboard shortcuts and button clicks.

### Subtitle Management
- Upload subtitle files in multiple formats
- Toggle subtitles on/off
- Multiple subtitle tracks support
- Visual indicator for active subtitle

### Audio Track Selection
When a torrent contains multiple audio files, you can switch between them in the settings panel.

### Responsive Design
The player adapts to different screen sizes, ensuring a great experience on desktop, tablet, and mobile devices.

## 🔒 Security Notes

- The application runs torrents in the browser using WebTorrent
- Subtitle files are stored temporarily on the server
- No user data is permanently stored
- Always ensure you have the right to stream the content

## 📝 License

MIT License - See LICENSE file for details

## 👤 Author

**ProbotisOP**
- GitHub: [@ProbotisOP](https://github.com/ProbotisOP)
- Website: [probotisop.in](https://probotisop.in)

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/ProbotisOP/magnetStreamer/issues).

## ⚠️ Disclaimer

This tool is for educational purposes. Ensure you have the legal right to stream any content you access through this application. The developers are not responsible for any misuse of this software.

---

Made with ❤️ by [ProbotisOP](https://github.com/ProbotisOP)
