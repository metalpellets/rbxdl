# Roblox Asset Downloader (Local)

A desktop application for downloading Roblox assets without the need for proxies.

## Features

- Download Roblox assets directly to your computer
- Authentication with Roblox account (optional) for accessing restricted assets
- Supports various asset types (Models, Images, Audio, etc.)
- Simple, user-friendly interface
- Download history tracking
- Secure cookie storage
- Completely local - no proxies needed

## Installation

### Prerequisites

- Node.js (v14 or above)
- npm or yarn

### Setup

1. Clone or download this repository
2. Open a terminal in the project directory
3. Install dependencies:

```
npm install
```

### Running the Application

To start the application in development mode:

```
npm start
```

### Building an Executable

To build an executable for your operating system:

```
npm run build
```

The compiled application will be available in the `dist` folder.

## Usage

### Basic Usage

1. Launch the application
2. Enter a Roblox Asset ID or URL in the input field
   - Examples:
     - Direct Asset ID: `1818`
     - Catalog URL: `https://www.roblox.com/catalog/1818/...`
     - Asset URL: `https://www.roblox.com/library/1818/...`
3. Click the "Download" button
4. Choose where to save the file
5. Your download history will be displayed at the bottom of the application

### Authentication (For Restricted Assets)

Some Roblox assets require authentication to download. To use your Roblox account:

1. Go to the "Settings" tab
2. Get your .ROBLOSECURITY cookie from Roblox:
   - Log in to Roblox in your browser
   - Open Developer Tools (F12 or right-click → Inspect)
   - Go to the Application tab
   - Select Cookies → www.roblox.com
   - Find .ROBLOSECURITY and copy its value
3. Paste the cookie into the input field
4. Click "Save Cookie"
5. The app will securely store your cookie and use it for downloading assets

## Security

- Your Roblox cookie is stored securely on your local machine using encryption
- The app never sends your cookie to any third-party servers
- All downloads happen directly between your computer and Roblox's servers

## How It Works

This application communicates directly with Roblox's asset delivery API to download assets. It handles various types of assets and automatically selects the appropriate file extension based on the asset type. For authenticated requests, it uses noblox.js to communicate with Roblox's API.

## License

MIT 