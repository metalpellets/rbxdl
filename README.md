# rbxdl

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A desktop application that allows you to download Roblox assets directly to your computer without requiring external proxies or web services.

## ✨ Features

- **Direct Downloads**: Download Roblox assets from official Roblox APIs
- **Multiple Asset Types**: Support for various asset types including:
  - Models (.rbxm)
  - Images (.png)
  - Audio (.mp3)
  - Meshes (.mesh)
  - Lua scripts (.lua)
  - Animations (.rbxanim)
  - Plugins (.rbxm)
  - And more
- **Authentication Support**: Login with your Roblox account to access private/restricted assets
- **Image Previews**: Preview images before saving them
- **Clipboard Integration**: Copy images directly to your clipboard
- **Download History**: Track your recently downloaded assets
- **Secure Authentication**: Encrypted storage of authentication cookies
- **Debug Logging**: Built-in logging system for troubleshooting

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v14 or newer
- npm (included with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/valbofs/rbxdl.git
cd rbxdl

# Install dependencies
npm install
```

### Running the App

```bash
# Start in development mode
npm start
```

### Building for Distribution

```bash
# Create an executable for your current OS
npm run build
```

The compiled application will be available in the `dist` folder.

## 📖 Usage

### Basic Usage

1. Launch the application
2. Enter a Roblox Asset ID or URL in the input field:
   - Asset ID: `1818`
   - Catalog URL: `https://www.roblox.com/catalog/1818/...`
   - Library URL: `https://www.roblox.com/library/1818/...`
3. Click "Download"
4. For non-image assets, select where to save the file
5. For images, a preview will appear allowing you to:
   - Copy the image to clipboard
   - Save the image to your computer

### Downloading Restricted Assets

Some Roblox assets require authentication to download. To use your Roblox account:

1. Navigate to the "Settings" tab
2. Get your .ROBLOSECURITY cookie:
   - Log in to Roblox in your browser
   - Open Developer Tools (F12)
   - Go to Application tab → Cookies → www.roblox.com
   - Copy the value of .ROBLOSECURITY
3. Paste the cookie in the settings input field
4. Click "Save Cookie"
5. The app will verify your authentication

## 🔒 Security Notes

- Your Roblox cookie is encrypted and stored locally using electron-store
- No authentication data is transmitted to third-party servers
- All downloads happen directly between your computer and Roblox's servers
- The application never shares your credentials

## ⚙️ Technical Details

This application is built with:
- [Electron](https://www.electronjs.org/) for the desktop framework
- [noblox.js](https://github.com/noblox/noblox.js) for Roblox API authentication
- [axios](https://axios-http.com/) for HTTP requests
- [electron-store](https://github.com/sindresorhus/electron-store) for secure data storage

The app communicates directly with Roblox's asset delivery APIs, including:
- Asset information API
- Asset delivery service
- Economy API for asset details
- Toolbox API for decal/image extraction

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## ⚠️ Disclaimer

This application is not affiliated with, endorsed by, or sponsored by Roblox Corporation. All Roblox assets remain the property of their respective owners. This tool is intended for legitimate use cases such as retrieving your own assets or publicly available content.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 