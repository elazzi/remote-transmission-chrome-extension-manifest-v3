document.addEventListener('DOMContentLoaded', () => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const magnetLink = urlParams.get('url');

    const statusElement = document.createElement('p');
    document.body.appendChild(statusElement);

    if (magnetLink && magnetLink.startsWith('magnet:')) {
        statusElement.textContent = 'Found magnet link: ' + magnetLink + '. Sending to background...';
        console.log('Processing magnet link:', magnetLink);

        chrome.runtime.sendMessage({ type: 'linkClicked', url: magnetLink }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error sending magnet link to background:', chrome.runtime.lastError.message);
                statusElement.textContent = 'Error: ' + chrome.runtime.lastError.message;
            } else {
                console.log('Magnet link sent to background successfully. Response:', response);
                statusElement.textContent = 'Magnet link sent. Closing this page...';
                // Attempt to close the page
                setTimeout(() => { // Timeout to allow message to be seen if debugging
                    window.close();
                }, 1500); // Adjust delay as needed, or remove for immediate close
            }
        });
    } else {
        console.error('No valid magnet link found in URL parameters.');
        statusElement.textContent = 'Error: No valid magnet link found in URL.';
    }
});
