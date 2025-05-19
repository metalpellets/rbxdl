const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const https = require('https');
const http = require('http');
const noblox = require('noblox.js');
const Store = require('electron-store');
const request = require('request');
const axios = require('axios');

// Create a store for app configuration and cookies
const store = new Store({
  encryptionKey: 'your-encryption-key', // Replace with a strong key in production
  name: 'rbxdl-config'
});

// Create a store for debug logs
const debugLogsStore = new Store({
  name: 'rbxdl-debug-logs'
});

// Keep a global reference of the window object to prevent it from being garbage collected
let mainWindow;
let robloxCookie = null;
let debugLogs = [];

// Helper function to add debug logs
function addDebugLog(type, data) {
  const log = {
    timestamp: new Date().toISOString(),
    type,
    data
  };
  
  debugLogs.unshift(log); // Add to beginning of array
  
  // Keep only the last 50 logs
  if (debugLogs.length > 50) {
    debugLogs.pop();
  }
  
  // Store logs to persist between app restarts
  debugLogsStore.set('logs', debugLogs);
  
  // Notify renderer process about the new log
  if (mainWindow) {
    mainWindow.webContents.send('debug-log', log);
  }
  
  return log;
}

// Create the browser window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the index.html file
  mainWindow.loadFile('index.html');

  // Add keyboard shortcut to toggle DevTools (Ctrl+Shift+I or F12)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control && input.shift && input.key === 'I') || 
        input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Handle window being closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create window when Electron has finished initialization
app.whenReady().then(async () => {
  createWindow();
  
  // Load saved debug logs
  debugLogs = debugLogsStore.get('logs') || [];
  
  // Load saved cookie on startup
  const savedCookie = store.get('robloxCookie');
  if (savedCookie) {
    try {
      // Set cookie directly in noblox.js first
      await noblox.setCookie(savedCookie);
      console.log('Direct noblox.js cookie set on startup');
      
      // Small delay to ensure cookie is properly registered
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Now call our setCookie function
      await setCookie(savedCookie);
    } catch (err) {
      console.error('Error loading cookie on startup:', err);
      // Clear the invalid cookie
      store.delete('robloxCookie');
      robloxCookie = null;
    }
  }

  app.on('activate', () => {
    // On macOS it's common to re-create a window when the dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Extract asset ID from URL or direct input
function extractAssetId(input) {
  // Regular expression to match an assetid (numeric digits)
  const regex = /(\d{3,100})/;
  const match = input.match(regex);

  if (match && match[0]) {
    return match[0]; // Return the matched group (assetid)
  } else {
    return null; // Return null if no assetid is found
  }
}

// Function to set Roblox cookie
async function setCookie(cookie) {
  try {
    if (!cookie) {
      robloxCookie = null;
      store.delete('robloxCookie');
      return { success: true, authenticated: false };
    }
    
    console.log('Attempting to set cookie...');
    
    // Format the cookie properly for noblox.js
    robloxCookie = cookie;
    let formattedCookie = cookie;
    console.log(robloxCookie);

    // Check if the cookie is valid by getting the authenticated user
    console.log('Validating cookie with noblox.js...');
    
    // Try with alternative methods if direct setCookie fails
    let currentUser;
    try {
      currentUser = await noblox.setCookie(formattedCookie);
    } catch (err) {
      console.error('First authentication attempt failed:', err.message);
      
      // Try alternative method - manually setting up the jar
      try {
        // Create a jar manually with the cookie
        const jar = request.jar();
        const cookieObj = request.cookie(`.ROBLOSECURITY=${formattedCookie}`);
        jar.setCookie(cookieObj, 'https://www.roblox.com');
        
        // Try to get current user with this jar
        currentUser = await noblox.getAuthenticatedUser({ jar });
      } catch (altErr) {
        console.error('Alternative authentication method failed:', altErr.message);
        throw err; // Throw the original error
      }
    }
    
    if (!currentUser || !currentUser.name) {
      console.error('Authentication successful but user information is incomplete:', currentUser);
      throw new Error('Failed to retrieve user information');
    }
    
    console.log('Authenticated successfully as:', currentUser.name);
    
    // Save the cookie to the secure store
    store.set('robloxCookie', formattedCookie);
    
    return { 
      success: true, 
      authenticated: true,
      username: currentUser.name,
      userId: currentUser.UserID || currentUser.id
    };
  } catch (error) {
    console.error('Authentication error details:', error);
    
    // Try to get more information about the cookie
    let debugInfo = '';
    try {
      debugInfo = `Cookie length: ${cookie.length}, First 10 chars: ${cookie.substring(0, 10)}...`;
      console.log(debugInfo);
    } catch (e) {
      console.error('Error analyzing cookie:', e);
    }
    
    robloxCookie = null;
    store.delete('robloxCookie');
    return { 
      success: false, 
      error: error.message,
      debug: debugInfo
    };
  }
}

/**
 * Makes an authenticated GET request to a Roblox API endpoint
 * @param {string} url - The full URL of the API endpoint
 * @returns {Promise<Object>} - The response data
 * @throws {Error} - If the request fails or authentication is missing
 */
async function generalGetRequest(url) {
  if (!robloxCookie) {
    throw new Error('Not authenticated. Please set a Roblox cookie first.');
  }
  
  // Log the request
  const requestLogId = addDebugLog('API_REQUEST', {
    url: url,
    method: 'GET',
    timestamp: new Date().toISOString()
  }).timestamp;
  
  try {
    // Get CSRF token for authentication
    const XCSRF = await noblox.getGeneralToken();
    
    // Ensure cookie is correctly formatted - it should include the cookie name
    let formattedCookie = robloxCookie;
    if (!formattedCookie.includes('.ROBLOSECURITY=') && !formattedCookie.startsWith('.ROBLOSECURITY=')) {
      formattedCookie = `.ROBLOSECURITY=${robloxCookie}`;
    }
    
    console.log(`Making authenticated request to: ${url}`);
    console.log(`Using CSRF token: ${XCSRF.substring(0, 6)}...`);
    
    // Set up headers with authentication info
    const headers = {
      'X-CSRF-Token': XCSRF,
      Cookie: formattedCookie
    };
    
    // Add headers to the log
    addDebugLog('API_REQUEST_HEADERS', {
      requestId: requestLogId,
      headers: {
        'X-CSRF-Token': XCSRF.substring(0, 6) + '...',
        Cookie: 'HIDDEN FOR SECURITY'
      }
    });
    
    // Make the GET request
    const response = await axios.get(url, { headers });
    console.log(`Response status: ${response.status}`);
    
    // Log the successful response
    addDebugLog('API_RESPONSE', {
      requestId: requestLogId,
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      url: url
    });
    
    return response.data;
  } catch (error) {
    console.error('Error in generalGetRequest:', error.message);
    
    // Handle different types of errors
    if (error.response) {
      // The request was made and the server responded with a non-2xx status code
      console.error('Response error:', error.response.status, error.response.data);
      
      // Log the error response
      addDebugLog('API_ERROR', {
        requestId: requestLogId,
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: url
      });
      
      throw new Error(`API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received');
      
      // Log the network error
      addDebugLog('API_NETWORK_ERROR', {
        requestId: requestLogId,
        error: 'No response received',
        url: url
      });
      
      throw new Error('No response received from Roblox servers');
    } else {
      // Something happened in setting up the request
      addDebugLog('API_ERROR', {
        requestId: requestLogId,
        error: error.message,
        url: url
      });
      
      throw error;
    }
  }
}

// Function to download asset by ID with authentication
async function downloadAsset(assetId) {
  try {
    if (!robloxCookie) {
      throw new Error('Authentication required. Please log in with your Roblox account first.');
    }

    // First, get asset info to determine type
    let assetInfo;
    
    // Get asset details using the economy API with authentication
    const assetDetailsUrl = `https://economy.roblox.com/v2/assets/${assetId}/details`;
    const detailsResponse = await generalGetRequest(assetDetailsUrl);
    
    console.log(detailsResponse);

    assetInfo = detailsResponse;
    let finalAssetId = assetId;
    let fileExtension = '.rbxm';
    let contentType = 'application/octet-stream';

    // If it's a decal, we need to get the texture ID
    const assetTypeId = assetInfo.AssetTypeId || assetInfo.assetTypeId;
    if (assetTypeId === 13) {
      const toolboxUrl = `https://apis.roblox.com/toolbox-service/v1/items/details?assetIds=${assetId}`;
      const toolboxResponse = await generalGetRequest(toolboxUrl);
      
      console.log("Toolbox response:", toolboxResponse);

      // Match the expected structure from the example provided by the user
      if (toolboxResponse.data && 
          Array.isArray(toolboxResponse.data) && 
          toolboxResponse.data.length > 0 && 
          toolboxResponse.data[0].asset && 
          toolboxResponse.data[0].asset.textureId) {
        finalAssetId = toolboxResponse.data[0].asset.textureId;
        fileExtension = '.png';
        contentType = 'image/png';
      } else if (toolboxResponse.data && 
                toolboxResponse.data.data && 
                Array.isArray(toolboxResponse.data.data) && 
                toolboxResponse.data.data.length > 0 && 
                toolboxResponse.data.data[0].asset && 
                toolboxResponse.data.data[0].asset.textureId) {
        // Alternative structure that might be returned
        finalAssetId = toolboxResponse.data.data[0].asset.textureId;
        fileExtension = '.png';
        contentType = 'image/png';
      }
    } else {
      // Determine file extension based on asset type
      switch (assetTypeId) {
        case 1: // Image
          fileExtension = '.png';
          contentType = 'image/png';
          break;
        case 3: // Audio
          fileExtension = '.mp3';
          contentType = 'audio/mpeg';
          break;
        case 4: // Mesh
          fileExtension = '.mesh';
          break;
        case 5: // Lua
          fileExtension = '.lua';
          contentType = 'text/plain';
          break;
        case 10: // Model
        case 38: // Plugin
          fileExtension = '.rbxm';
          break;
        case 24: // Animation
          fileExtension = '.rbxanim';
          break;
      }
    }

    // Build the filename with proper property name based on API response
    let assetName = "Unknown";
    if (assetInfo.Name) {
      assetName = assetInfo.Name;
    } else if (assetInfo.name) {
      assetName = assetInfo.name;
    }
    
    const fileName = `${assetName.replace(/[/\\?%*:|"<>]/g, '_')}_${assetId}${fileExtension}`;
    
    // Get the download URL from assetdelivery with authentication
    const deliveryUrl = `https://assetdelivery.roblox.com/v2/asset/?id=${finalAssetId}`;
    const deliveryResponse = await generalGetRequest(deliveryUrl);
    
    // Get the actual download location
    let downloadUrl;
    console.log("Delivery response:", deliveryResponse);
    
    // Handle different possible response formats
    if (deliveryResponse.locations && deliveryResponse.locations.length > 0) {
      downloadUrl = deliveryResponse.locations[0].location;
    } else if (deliveryResponse.data && deliveryResponse.data.locations && deliveryResponse.data.locations.length > 0) {
      // Alternative structure where response might be nested under data
      downloadUrl = deliveryResponse.data.locations[0].location;
    } else {
      console.error("Unexpected response format from assetdelivery API:", JSON.stringify(deliveryResponse));
      throw new Error('Download location not found in response');
    }
    
    console.log("Download URL:", downloadUrl);
    
    // Download the file content from the location URL
    // This URL already has authentication tokens embedded, but we'll include cookies for good measure
    const XCSRF = await noblox.getGeneralToken();
    
    // Format cookie properly
    let formattedCookie = robloxCookie;
    if (!formattedCookie.includes('.ROBLOSECURITY=') && !formattedCookie.startsWith('.ROBLOSECURITY=')) {
      formattedCookie = `.ROBLOSECURITY=${robloxCookie}`;
    }
    
    const headers = {
      'X-CSRF-Token': XCSRF,
      Cookie: formattedCookie
    };
    
    // Log the file download request
    const downloadRequestId = addDebugLog('FILE_DOWNLOAD_REQUEST', {
      url: downloadUrl,
      assetId: finalAssetId,
      timestamp: new Date().toISOString()
    }).timestamp;
    
    try {
      const fileResponse = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        headers: headers
      });
      
      // Log successful download
      addDebugLog('FILE_DOWNLOAD_SUCCESS', {
        requestId: downloadRequestId,
        assetId: finalAssetId,
        status: fileResponse.status,
        contentType: fileResponse.headers['content-type'],
        contentLength: fileResponse.headers['content-length'],
        fileName
      });
      
      return {
        fileName,
        data: Buffer.from(fileResponse.data),
        contentType
      };
    } catch (error) {
      // Log download failure
      addDebugLog('FILE_DOWNLOAD_ERROR', {
        requestId: downloadRequestId,
        assetId: finalAssetId,
        error: error.message
      });
      throw error; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error('Download error details:', error);
    throw new Error(`Error downloading asset: ${error.message}`);
  }
}

// Handle IPC messages from renderer
ipcMain.handle('download-asset', async (event, input) => {
  try {
    const assetId = extractAssetId(input);
    if (!assetId) {
      return { success: false, error: 'Invalid asset ID or URL' };
    }
    
    console.log(`Downloading asset: ${assetId}`);
    const result = await downloadAsset(assetId);
    
    // Check if this is an image that should be previewed
    if (result.contentType.startsWith('image/')) {
      // Return the image data for preview instead of showing save dialog
      return { 
        success: true, 
        isImage: true,
        fileName: result.fileName,
        data: result.data.toString('base64'),
        contentType: result.contentType
      };
    }
    
    // For non-image assets, continue with direct download
    const { filePath } = await dialog.showSaveDialog({
      title: 'Save Asset',
      defaultPath: result.fileName,
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!filePath) {
      return { success: false, error: 'Save cancelled' };
    }
    
    // Save the file
    fs.writeFileSync(filePath, result.data);
    
    return { 
      success: true, 
      filePath,
      assetName: path.basename(filePath)
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle saving image after preview
ipcMain.handle('save-image', async (event, { fileName, data }) => {
  try {
    // Convert base64 data back to buffer if needed
    const imageBuffer = typeof data === 'string' ? Buffer.from(data, 'base64') : data;
    
    // Show save dialog
    const { filePath } = await dialog.showSaveDialog({
      title: 'Save Image',
      defaultPath: fileName,
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!filePath) {
      return { success: false, error: 'Save cancelled' };
    }
    
    // Save the file
    fs.writeFileSync(filePath, imageBuffer);
    
    return { 
      success: true, 
      filePath,
      assetName: path.basename(filePath)
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle copying image to clipboard
ipcMain.handle('copy-image-to-clipboard', async (event, imageData) => {
  try {
    // Convert base64 data back to buffer if needed
    const imageBuffer = typeof imageData === 'string' ? Buffer.from(imageData, 'base64') : imageData;
    
    // Create a NativeImage from the buffer
    const { nativeImage, clipboard } = require('electron');
    const image = nativeImage.createFromBuffer(imageBuffer);
    
    // Copy the image to clipboard
    clipboard.writeImage(image);
    
    return { success: true };
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    return { success: false, error: error.message };
  }
});

// Handle authentication
ipcMain.handle('set-cookie', async (event, cookie) => {
  try {
    const result = await setCookie(cookie);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-auth-status', async () => {
  if (!robloxCookie) {
    console.log('Auth check: No cookie stored');
    if (mainWindow) {
      mainWindow.webContents.send('auth-notification', { message: 'No cookie stored in app' });
    }
    return { authenticated: false };
  }
  
  try {
    // First try to use the direct noblox.js function
    let currentUser;
    
    try {
      // Ensure the cookie is properly set before checking status
      await noblox.setCookie(robloxCookie);
      console.log('Refreshed noblox.js cookie before auth status check');
      
      // Get the authenticated user
      currentUser = await noblox.getAuthenticatedUser();
    } catch (err) {
      console.error('Standard auth check failed:', err.message);
      
      // Try alternative method with manual jar setup
      try {
        // Create a jar manually with the cookie
        const jar = request.jar();
        const cookieObj = request.cookie(`.ROBLOSECURITY=${robloxCookie}`);
        jar.setCookie(cookieObj, 'https://www.roblox.com');
        
        // Try to get current user with this jar
        currentUser = await noblox.getAuthenticatedUser({ jar });
      } catch (altErr) {
        console.error('Alternative auth check failed:', altErr.message);
        throw err; // Throw the original error
      }
    }
    
    if (!currentUser || !currentUser.name) {
      console.error('Auth check returned incomplete user:', currentUser);
      if (mainWindow) {
        mainWindow.webContents.send('auth-notification', { 
          message: 'Authentication succeeded but user info is incomplete',
          userData: JSON.stringify(currentUser)
        });
      }
      throw new Error('User information incomplete');
    }
    
    console.log('Auth status check successful for user:', currentUser.name);
    if (mainWindow) {
      mainWindow.webContents.send('auth-notification', { 
        message: `Auth check successful for user: ${currentUser.name}` 
      });
    }
    
    return { 
      authenticated: true,
      username: currentUser.name,
      userId: currentUser.UserID || currentUser.id
    };
  } catch (error) {
    console.error('Auth status check error:', error.message);
    if (mainWindow) {
      mainWindow.webContents.send('auth-notification', { 
        message: `Auth check error: ${error.message}` 
      });
    }
    robloxCookie = null;
    store.delete('robloxCookie');
    return { authenticated: false, error: error.message };
  }
});

// Add debug logs handler
ipcMain.handle('debug-logs', async () => {
  return {
    logs: debugLogs
  };
}); 