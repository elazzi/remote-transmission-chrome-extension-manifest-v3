// Global variable to store the session ID for popup.js scope
let transmissionSessionId = null;
// Global reference to the loading message element, initialized in DOMContentLoaded
let loadingMessageElement = null; 

// Helper function to format bytes (for speeds like KB/s, MB/s)
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes/s';
    if (isNaN(parseFloat(bytes)) || !isFinite(bytes)) return 'N/A';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s'];
    let i = Math.floor(Math.log(bytes) / Math.log(k));
    if (i < 0) i = 0; // Handle byte values less than 1KB (e.g. 500 bytes), show as Bytes/s
    if (i >= sizes.length) i = sizes.length - 1; // Cap at TB/s for safety

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper function to format ETA
function formatEta(seconds, percentDone) { // Added percentDone for more context
    if (seconds === -1) return "Unknown"; // ETA is not known by Transmission
    if (seconds === -2) return "Done";    // ETA is N/A because torrent is finished or paused and complete

    if (seconds < 0) return "Unknown"; // General catch-all for other negative values
    if (seconds === 0 && percentDone && percentDone < 1.0) return "Moments"; // If percentDone < 1.0 but eta is 0
    if (seconds === 0) return "Done";


    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    let etaString = '';
    if (h > 0) etaString += `${h}h `;
    if (m > 0) etaString += `${m}m `;
    // Only show seconds if it's the only unit or if other units are present and non-zero
    if (s > 0 && (etaString === '' || (h === 0 && m === 0))) {
        etaString += `${s}s`;
    } else if (s > 0 && etaString !== '' && (h > 0 || m > 0)) { // Add seconds if hours or minutes are already there
         etaString += `${s}s`;
    }

    if (etaString.trim() === '') return "Moments"; // If calculated string is empty (e.g. very small ETA)
    return etaString.trim();
}

// Helper function to get torrent status string from Transmission's numeric status
function getTorrentStatusString(statusCode, isFinished, percentDone) {
    // isFinished is true if the torrent has finished downloading.
    // percentDone is a float (0.0 to 1.0).
    
    if (isFinished || percentDone >= 1.0) { // Considered finished if fully downloaded
        if (statusCode === 6) return "Seeding"; // Actively seeding
        if (statusCode === 0) return "Finished (Paused)"; // Paused but 100% complete
        if (statusCode === 4 && percentDone >= 1.0 && !isFinished) return "Completing"; // Downloaded, might be moving files, etc. but not yet marked 'isFinished'
        return "Finished"; // Generic finished state if none of the above match
    }

    // Not finished, so map other statuses
    switch (statusCode) {
        case 0: return "Paused"; // Paused and not yet complete
        case 1: return "Queued for verification";
        case 2: return "Verifying";
        case 3: return "Queued for download";
        case 4: return "Downloading";
        case 5: return "Queued for seed"; // Queued for seed but not yet `isFinished` (unlikely but possible)
        case 6: return "Seeding"; // Should ideally be caught by `isFinished` logic above if actually seeding post-download
        default: return `Unknown (${statusCode})`;
    }
}

// Function to display torrents in the popup's torrentsContainer
function displayTorrents(torrents, container) {
    container.innerHTML = ''; // Clear loading message or previous content

    if (!torrents || torrents.length === 0) {
        const noTorrentsMsg = document.createElement('p');
        noTorrentsMsg.textContent = "No active torrents found.";
        noTorrentsMsg.className = 'info-message'; // Use class from popup.html for styling
        container.appendChild(noTorrentsMsg);
        return;
    }

    torrents.forEach(torrent => {
        const entry = document.createElement('div');
        entry.className = 'torrent-entry';

        const name = document.createElement('div');
        name.className = 'torrent-name';
        name.textContent = torrent.name;
        entry.appendChild(name);

        const statusString = getTorrentStatusString(torrent.status, torrent.isFinished, torrent.percentDone);
        const statusDiv = document.createElement('div');
        statusDiv.className = 'torrent-status';
        statusDiv.textContent = `Status: ${statusString}`;
        entry.appendChild(statusDiv);
        
        const progressContainer = document.createElement('div');
        progressContainer.className = 'torrent-progress';
        const progressBar = document.createElement('progress');
        progressBar.value = torrent.percentDone; // Value from 0.0 to 1.0
        progressBar.max = 1;
        const progressText = document.createElement('span');
        // Display percentage rounded to one decimal place if not 0 or 100, otherwise integer
        let percentDisplay = Math.round(torrent.percentDone * 1000) / 10;
        if (percentDisplay === 0 || percentDisplay === 100 || percentDisplay % 1 === 0) { // if whole number
            percentDisplay = Math.round(percentDisplay);
        }
        progressText.textContent = ` ${percentDisplay}%`;

        progressContainer.appendChild(progressBar);
        progressContainer.appendChild(progressText);
        entry.appendChild(progressContainer);

        // Display download speed if downloading or recently active and not stalled
        if ((statusString === "Downloading" || (torrent.rateDownload > 0 && statusString !== "Seeding")) && !torrent.isStalled) {
            const downloadSpeed = document.createElement('div');
            downloadSpeed.className = 'torrent-speed';
            downloadSpeed.textContent = `Down: ${formatBytes(torrent.rateDownload)}`;
            entry.appendChild(downloadSpeed);
        }

        // Display upload speed if seeding or recently active and not stalled
        if ((statusString === "Seeding" || torrent.rateUpload > 0) && !torrent.isStalled) {
             const uploadSpeed = document.createElement('div');
            uploadSpeed.className = 'torrent-speed';
            uploadSpeed.textContent = `Up: ${formatBytes(torrent.rateUpload)}`;
            entry.appendChild(uploadSpeed);
        }
        
        // Display ETA if downloading and ETA is available and not stalled
        if (torrent.eta > 0 && statusString === "Downloading" && !torrent.isStalled) {
            const etaDiv = document.createElement('div');
            etaDiv.className = 'torrent-eta';
            etaDiv.textContent = `ETA: ${formatEta(torrent.eta, torrent.percentDone)}`;
            entry.appendChild(etaDiv);
        } else if (torrent.eta === -2 && (statusString.includes("Finished") || statusString === "Seeding")) {
            // Show "Done" for finished/seeding torrents if ETA is -2
            const etaDiv = document.createElement('div');
            etaDiv.className = 'torrent-eta';
            etaDiv.textContent = `ETA: ${formatEta(torrent.eta)}`; // formatEta handles -2 as "Done"
            entry.appendChild(etaDiv);
        }

        if (torrent.isStalled && !statusString.includes("Finished") && statusString !== "Paused") {
            const stalledDiv = document.createElement('div');
            stalledDiv.className = 'torrent-status'; // Similar styling to status
            stalledDiv.style.color = 'orange';
            stalledDiv.textContent = 'Status: Stalled';
            // Replace or append to existing status
            if (statusDiv.parentNode) statusDiv.textContent += " (Stalled)";
            else entry.appendChild(stalledDiv);
        }


        // Display error string if present
        if (torrent.errorString && torrent.errorString.trim() !== "") {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'torrent-error'; // Add styling for this class in popup.html's <style>
            errorDiv.style.color = 'red'; // Basic error styling
            errorDiv.style.fontSize = '0.8em';
            errorDiv.textContent = `Error: ${torrent.errorString}`;
            entry.appendChild(errorDiv);
        }

        container.appendChild(entry);
    });
}

// Function to fetch torrents from the Transmission server
async function fetchTorrents(serverUrl, username, password, container) {
    if (loadingMessageElement) {
        loadingMessageElement.style.display = 'block'; // Ensure loading message is visible
        loadingMessageElement.textContent = "Fetching torrents..."; // Set text for fetching
    }
    // Do not clear container here, let displayTorrents or error handler do it
    // This preserves the "Fetching torrents..." message if container is the loading message's parent

    const rpcUrl = serverUrl.replace(/\/$/, '') + '/transmission/rpc';
    
    const headers = new Headers({ 'Content-Type': 'application/json' });
    // Add Authorization header only if username is provided and not empty
    if (username && username.trim() !== "") {
        headers.set('Authorization', 'Basic ' + btoa(username + ':' + password));
    }

    if (transmissionSessionId) {
        headers.set('X-Transmission-Session-Id', transmissionSessionId);
    }

    const body = JSON.stringify({
        method: 'torrent-get',
        arguments: {
            fields: [
                "id", "name", "status", "percentDone", "rateDownload", "rateUpload",
                "eta", "errorString", "isFinished", "isStalled", "totalSize" 
                // Removed "leftUntilDone" as it wasn't used and "totalSize" is more standard.
            ]
        }
    });

    try {
        let response = await fetch(rpcUrl, { method: 'POST', headers: headers, body: body });

        if (response.status === 409) { // Session ID conflict
            transmissionSessionId = response.headers.get('X-Transmission-Session-Id');
            if (!transmissionSessionId) {
                throw new Error("Server responded with 409 (Session ID conflict) but did not provide a new X-Transmission-Session-Id header. Check server configuration or logs.");
            }
            headers.set('X-Transmission-Session-Id', transmissionSessionId);
            // Retry the request with the new session ID
            response = await fetch(rpcUrl, { method: 'POST', headers: headers, body: body });
        }

        if (!response.ok) { // Handle other HTTP errors (e.g., 401, 403, 500)
            const errorText = await response.text();
            let detailedError = `Server Error: ${response.status} ${response.statusText}.`;
            try {
                const errorJson = JSON.parse(errorText); // Transmission might send JSON error details
                if (errorJson && errorJson.result) {
                    detailedError += ` (Details: ${errorJson.result})`;
                } else if (errorText.length < 200 && errorText.trim() !== "") { // Keep it brief if not JSON but has text
                    detailedError += ` Response: ${errorText.trim()}`;
                }
            } catch (e) { // If not JSON, and errorText is long, don't append it all
                 if (errorText.length < 200 && errorText.trim() !== "") detailedError += ` Response: ${errorText.trim()}`;
            }
            throw new Error(detailedError);
        }

        const data = await response.json();

        if (data.result !== "success") {
            throw new Error(`API Error: ${data.result || "Unknown error returned by Transmission server."}`);
        }
        
        if (loadingMessageElement) loadingMessageElement.style.display = 'none'; // Hide loading message on success
        displayTorrents(data.arguments.torrents, container);

    } catch (error) {
        console.error('Fetch/Display Torrents Error:', error);
        if (loadingMessageElement) loadingMessageElement.style.display = 'none'; // Hide loading message on error
        container.innerHTML = ''; // Clear container before showing error message
        const errorMsgElement = document.createElement('p');
        errorMsgElement.textContent = `Error: ${error.message}`;
        // Use classes from popup.html for styling error messages
        errorMsgElement.className = 'error-message'; 
        container.appendChild(errorMsgElement);
    }
}

// Main logic executed when the popup DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    const settingsButton = document.getElementById('settings-button');
    const torrentsContainer = document.getElementById('torrents-container');
    // Assign to the global variable once DOM is ready
    loadingMessageElement = document.getElementById('loading-message'); 


    if (!settingsButton || !torrentsContainer || !loadingMessageElement) {
        console.error('Essential DOM elements (#settings-button, #torrents-container, or #loading-message) not found. Popup cannot function correctly.');
        if (torrentsContainer) { 
            torrentsContainer.innerHTML = '<p class="error-message">Popup UI Error: Critical elements missing. Try reinstalling.</p>';
        } else if (document.body) { // Fallback if even container is missing
            // Try to show error message in body if loadingMessageElement itself is missing
            const errP = document.createElement('p');
            errP.className = 'error-message';
            errP.style.textAlign = 'center';
            errP.style.padding = '20px';
            errP.textContent = 'Popup loading error: UI components missing.';
            document.body.innerHTML = ''; // Clear body
            document.body.appendChild(errP);
        }
        return;
    }

    settingsButton.addEventListener('click', () => {
        if (chrome.runtime && chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            console.warn("chrome.runtime.openOptionsPage API is not available. Opening options.html via window.open.");
            // Fallback for environments where this might not be available
            window.open(chrome.runtime.getURL('options.html'));
        }
    });

    // Set initial state for loading message before trying to get settings
    loadingMessageElement.textContent = "Loading settings...";
    loadingMessageElement.style.display = 'block'; // Make sure it's visible


    chrome.storage.sync.get(['serverUrl', 'username', 'password'], (items) => {
        if (chrome.runtime.lastError) {
            console.error("Fatal: Error retrieving settings from chrome.storage.sync:", chrome.runtime.lastError);
            if (loadingMessageElement) loadingMessageElement.style.display = 'none'; // Hide "Loading settings..."
            torrentsContainer.innerHTML = `<p class="error-message">Failed to load settings: ${chrome.runtime.lastError.message}. Please check browser permissions or try re-installing.</p>`;
            return;
        }

        if (items.serverUrl && items.serverUrl.trim() !== "") {
            // loadingMessageElement text will be updated by fetchTorrents to "Fetching torrents..."
            // No need to hide it here, fetchTorrents will hide it on success/failure.
            fetchTorrents(items.serverUrl, items.username || '', items.password || '', torrentsContainer);
        } else {
            if (loadingMessageElement) loadingMessageElement.style.display = 'none'; // Hide "Loading settings..."
            torrentsContainer.innerHTML = ''; // Clear any previous messages
            const configureMsg = document.createElement('p');
            configureMsg.textContent = "Welcome! Please configure your Transmission server details via the 'Settings' button.";
            configureMsg.className = 'info-message'; // Use class from popup.html for styling
            torrentsContainer.appendChild(configureMsg);
            
            // Optionally make settings button more prominent if not configured
            settingsButton.style.fontWeight = 'bold';
            settingsButton.style.border = '2px solid #ffc107'; // Example: yellow border to draw attention
        }
    });
});
