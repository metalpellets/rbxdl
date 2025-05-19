const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    downloadAsset: (input) => ipcRenderer.invoke('download-asset', input),
    setCookie: (cookie) => ipcRenderer.invoke('set-cookie', cookie),
    getAuthStatus: async () => {
      console.log('Preload: Requesting auth status');
      try {
        const result = await ipcRenderer.invoke('get-auth-status');
        console.log('Preload: Auth status result:', result);
        return result;
      } catch (error) {
        console.error('Preload: Auth status error:', error);
        throw error;
      }
    },
    saveImage: (data) => ipcRenderer.invoke('save-image', data),
    copyImageToClipboard: (imageData) => ipcRenderer.invoke('copy-image-to-clipboard', imageData),
    debugLogs: () => ipcRenderer.invoke('debug-logs')
  }
); 

// Set up listener for debug logs
ipcRenderer.on('debug-log', (event, logData) => {
  const logEvent = new CustomEvent('debug-log', { detail: logData });
  window.dispatchEvent(logEvent);
}); 

// Set up listener for auth notifications
ipcRenderer.on('auth-notification', (event, data) => {
  console.log('Auth notification received:', data);
  const authEvent = new CustomEvent('auth-notification', { detail: data });
  window.dispatchEvent(authEvent);
});

// Log when preload script has loaded
console.log('Preload script initialized successfully'); 