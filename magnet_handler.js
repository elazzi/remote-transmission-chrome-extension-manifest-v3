document.addEventListener('DOMContentLoaded', () => {
    console.log('magnet_handler.js: DOMContentLoaded event fired.'); // <<< NEW LOG

    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const magnetLink = urlParams.get('url');

    console.log('magnet_handler.js: Extracted magnetLink:', magnetLink ? magnetLink : 'Not found or empty'); // <<< NEW LOG

    const statusElement = document.createElement('p');
    document.body.appendChild(statusElement);

    if (magnetLink && magnetLink.startsWith('magnet:')) {
        statusElement.textContent = 'Found magnet link: ' + magnetLink + '. Sending to background...';
        // console.log('Processing magnet link:', magnetLink); // Can be replaced by the more specific log above

        console.log('magnet_handler.js: Attempting to send message to background script with magnetLink:', magnetLink); // <<< NEW LOG
        chrome.runtime.sendMessage({ type: 'linkClicked', url: magnetLink }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('magnet_handler.js: Error response from sendMessage:', chrome.runtime.lastError); // <<< MODIFIED LOG
                statusElement.textContent = 'Error: ' + chrome.runtime.lastError.message;
            } else {
                console.log('magnet_handler.js: Success response from sendMessage:', response); // <<< MODIFIED LOG
                statusElement.textContent = 'Magnet link sent. Closing this page...';
                setTimeout(() => {
                    window.close();
                }, 1500);
            }
        });
    } else {
        console.error('magnet_handler.js: No valid magnet link found. Expected "url" parameter. QueryString was:', queryString); // Added script prefix
        statusElement.textContent = 'Error: No valid magnet link found in URL. Query: ' + queryString;
    }
});