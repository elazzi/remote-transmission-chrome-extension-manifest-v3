// When the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('Transmission Remote Control extension installed.');

  // Create context menu for downloading torrents
  chrome.contextMenus.create({
    id: 'downloadWithTransmission',
    title: 'Download with Transmission',
    contexts: ['link']
  });
  // Note: There was a duplicate onInstalled listener here, which is redundant.
  // I'm keeping one for simplicity from the last read_files output.
  // If a second distinct onInstalled was intended, its logic would need to be merged.
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "handleMagnetLink" && message.magnetLink) {
    console.log('Background: Received handleMagnetLink action with URL:', message.magnetLink); // Added log
    handleTorrentLink(message.magnetLink); // Existing function to add torrent

    // Acknowledge receipt to the content script.
    // This doesn't wait for handleTorrentLink to fully complete.
    sendResponse({ status: "success", message: "Magnet link received by background script for processing." });

    // Return true here if sendResponse might be called later (e.g. after an async operation within handleTorrentLink)
    // For now, sendResponse is called synchronously after initiating handleTorrentLink.
    // However, good practice if there's any doubt or future refactoring.
    return true; // Indicate that sendResponse will be called (even if it's "synchronously" in this turn of the event loop)
  }
  // Optional: handle other message types if any in the future
  // else if (message.type === 'someOtherType') { ... }

  // If no specific message is handled, and sendResponse isn't called,
  // it's often good practice to return undefined or false (or nothing)
  // to avoid keeping the message channel open unnecessarily if not returning true.
  // However, if there's only one message type, the return true for that type is key.
});

// Handle clicks on context menu items
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'downloadWithTransmission') {
    const url = info.linkUrl;
    
      handleTorrentLink(url);
    
  }
});

// Function to handle adding torrent link to Transmission
function handleTorrentLink(url) {
  chrome.storage.sync.get(['serverUrl', 'username', 'password'], (items) => {
    const rawServerUrl = items.serverUrl; // User-provided server URL
    const username = items.username;
    const password = items.password;

    if (!rawServerUrl || !username) { // Password can be empty for some setups
      console.error('Transmission server URL or username not set. Please configure in options.');
      showBadge('cfg', [255, 165, 0, 255]); // Orange for config error
      showNotification('Configuration Error', 'Server URL or username not set.');
      return;
    }

    // Construct the RPC endpoint URL intelligently
    let rpcEndpoint = rawServerUrl;
    if (rpcEndpoint) { // Ensure rpcEndpoint is not null or empty after assignment
        // Remove trailing slash(es) if any
        while (rpcEndpoint.endsWith('/')) {
            rpcEndpoint = rpcEndpoint.substring(0, rpcEndpoint.length - 1);
        }

        // Check if path already ends with /rpc or /transmission/rpc
        if (!rpcEndpoint.endsWith('/rpc') && !rpcEndpoint.endsWith('/transmission/rpc')) {
            rpcEndpoint += '/transmission/rpc';
        }
    } else { // Should not happen if !rawServerUrl check above is robust
        console.error('Critical: rpcEndpoint became undefined or empty after processing rawServerUrl. Aborting fetch.');
        showNotification('Configuration Error', 'Invalid server URL processed.');
        return;
    }
    // Now 'rpcEndpoint' is the URL to use in fetch calls.

    chrome.storage.local.get(['sessionId'], (sessionItems) => {
      const headers = new Headers({
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(username + ':' + (password || '')) // Use empty string if password is null/undefined
      });
      if (sessionItems.sessionId) {
        headers.set('X-Transmission-Session-Id', sessionItems.sessionId);
      }

      fetch(rpcEndpoint, { // Use the new rpcEndpoint
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          method: 'torrent-add',
          arguments: { filename: url }
        })
      })
      .then(response => {
        console.log('Fetch response:', response); // Keep this log
        if (response.status === 409) {
          const newSessionId = response.headers.get('X-Transmission-Session-Id');
          if (newSessionId) {
            chrome.storage.local.set({ sessionId: newSessionId });
            headers.set('X-Transmission-Session-Id', newSessionId); // Update headers for retry
            // Retry the fetch with the new session ID
            return fetch(rpcEndpoint, { // Use the new rpcEndpoint
              method: 'POST',
              headers: headers, // Use updated headers
              body: JSON.stringify({
                method: 'torrent-add',
                arguments: { filename: url }
              })
            });
          } else {
            // This case should ideally not happen if server behaves correctly on 409
            throw new Error('Server responded with 409 but no new session ID was provided.');
          }
        } else { // If response.status is not 409
          if (!response.ok) {
              return response.text().then(responseText => {
                console.error(
                  `--- ERROR: Problematic Server Response ---
` +
                  `Response Status: ${response.status} ${response.statusText}
` +
                  `Response URL: ${response.url}
` +
                  `Response Body (first 500 chars):
${responseText.substring(0, 500)}
` +
                  `--- End of Server Response Details ---`
                );
                throw new Error(`Failed to process server response. Status: ${response.status}. See console for full response details.`);
              }).catch(err => {
                // Catch errors from response.text() itself or the new Error thrown,
                // and ensure a consistent error object is propagated.
                // This helps if response.text() itself fails for some reason.
                console.error("Error attempting to log server response body:", err);
                throw new Error(`Failed to process server response. Status: ${response.status}. Additionally, an error occurred while trying to log the response body.`);
              });
            } else {
              // Response is OK (2xx status code), proceed to parse as JSON
              return response.json();
            }
        }
      })
      .then(data => {
        // This .then is for processing the JSON data from either the first (if OK and not 409)
        // or the second fetch (if first was 409 and second is successful).
        console.log('Fetch result data:', data); // Keep this log

        if (data && data.arguments && data.result === "success") {
          if (data.arguments['torrent-duplicate']) {
            showBadge('dup', [0, 0, 255, 255]); // Blue for duplicate
            showNotification('Duplicate Torrent', data.arguments['torrent-duplicate'].name || 'The torrent is already in the list.');
          } else if (data.arguments['torrent-added']) {
            showBadge('add', [0, 255, 0, 255]); // Green for added
            showNotification('Torrent Added Successfully', data.arguments['torrent-added'].name || 'Torrent has been added.');
          } else {
            // Success result but no specific torrent-added or torrent-duplicate, could be other response
            console.warn("Torrent add response did not indicate duplicate or new. Data:", data);
            showBadge('ok', [0, 128, 0, 255]); // Dark green for general success
            showNotification('Torrent Processed', 'Request processed, but status unclear. Check Transmission.');
          }
        } else if (data && data.result !== "success") {
          // API returned a non-success result.
          console.error('Transmission API Error:', data.result);
          showBadge('api', [255, 0, 0, 255]); // Red for API error
          showNotification('Transmission API Error', data.result || 'Unknown API error.');
          throw new Error(`Transmission API Error: ${data.result}`);
        } else {
          // Data is null, undefined, or not in the expected format
          console.error('Unexpected data format from Transmission:', data);
          showBadge('err', [255, 0, 0, 255]); // Red for error
          showNotification('Response Error', 'Unexpected response format from Transmission.');
          throw new Error('Unexpected data format from Transmission.');
        }
      })
      .catch(error => {
        // This catches errors from the fetch chain (network, thrown Errors, etc.)
        console.error('Error handling torrent link:', error.message);
        showBadge('fail', [255, 0, 0, 255]); // Red for failure
        showNotification('Adding Torrent Failed', error.message || 'Check console for details.');
      });
    });
  });
}

function showBadge(text, color) { // Removed unused duration parameter
  const duration = 3000; // Increased duration for better visibility
  chrome.action.setBadgeBackgroundColor({color: color});
  chrome.action.setBadgeText({text: text});
  setTimeout(() => { chrome.action.setBadgeText({text: ''}); }, duration);
}

function showNotification(title, message) {
  chrome.notifications.create({ // Use chrome.notifications.create
    type: 'basic',
    title: title,
    message: message,
    iconUrl: 'icons/icon128.png' // Ensure path is correct relative to manifest
  });
}
