// When the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('Transmission Remote Control extension installed.');

  // Create context menu for downloading torrents
  chrome.contextMenus.create({
    id: 'downloadWithTransmission',
    title: 'Download with Transmission',
    contexts: ['link']
  });
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'linkClicked') {
    // console.log(message); // Removed
    // console.log('Link clicked:', message.url); // Removed
    handleTorrentLink(message.url);
    sendResponse({ success: true, message: "Link processed by background script." });
  }
  // Return true if you intend to use sendResponse asynchronously.
  // In this case, handleTorrentLink is called, and then sendResponse is called.
  // If handleTorrentLink itself were to use sendResponse asynchronously, returning true here would be necessary.
  // For this specific structure, it's implicitly synchronous before sendResponse.
});
});

// Handle clicks on context menu items
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'downloadWithTransmission') {
    const url = info.linkUrl;
    if (url.startsWith("magnet:") || url.endsWith(".torrent")) {
      handleTorrentLink(url);
    }
  }
});

// Function to handle adding torrent link to Transmission
function handleTorrentLink(url) {
  chrome.storage.sync.get(['serverUrl', 'username', 'password'], (items) => {
    const serverUrl = items.serverUrl;
    const username = items.username;
    const password = items.password;

    if (serverUrl && username && password) {
      chrome.storage.local.get(['sessionId'], (sessionItems) => {
        const headers = new Headers({
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(username + ':' + password),
          'X-Transmission-Session-Id': sessionItems.sessionId || ''
        });

        fetch(serverUrl + '/transmission/rpc', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            method: 'torrent-add',
            arguments: { filename: url }
          })
        })
        .then(response => {
          console.log('Fetch response:', response);
          if (response.status === 409) {
            const sessionId = response.headers.get('X-Transmission-Session-Id');
            chrome.storage.local.set({ sessionId: sessionId });
            fetch(serverUrl + '/transmission/rpc', {
              method: 'POST',
              headers: new Headers({
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + btoa(username + ':' + password),
                'X-Transmission-Session-Id': sessionId
              }),
              body: JSON.stringify({
                method: 'torrent-add',
                arguments: { filename: url }
              })
            });
          } else {
			  
	return response.json();
          }
        })
        .then(data => {console.log('Fetch result data:', data)
		
			  
			  				 if (data.arguments['torrent-duplicate']) {
							  showBadge('dup', [
								0,
								0,
								255,
								255,
							  ]);
							  showNotification('Duplicate torrent', '');
							  } else if (data.arguments['torrent-added']) {
							  showBadge('add', [
								0,
								255,
								0,
								255,
							  ]);
							  showNotification('Torrent added successfully', data.arguments['torrent-added'].name);
    } else {
						  showBadge('fail', [
							255,
							0,
							0,
							255,
						  ]);
						  showNotification('Adding torrent failed', '');
    }
		}
	
		
		
		)
        .catch(error => console.error('Error:'));
      });
    } else {
      console.error('Transmission server URL, username, or password not set.');
    }
  });
}

function showBadge(text, color, duration) {

  duration = 1500;

  chrome.action.setBadgeBackgroundColor({color: color});
  chrome.action.setBadgeText({text: text});

  setTimeout(function () { chrome.action.setBadgeText({text: ''}); }, duration);
}

function showNotification(title, message) {

  var options = {
    type    : 'basic',
    title   : title,
    message : message,
    iconUrl : 'images/icon128.png',
  };
}