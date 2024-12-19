document.addEventListener('DOMContentLoaded', function() {
    const serverUrlInput = document.getElementById('serverUrl');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const saveButton = document.getElementById('save');

    if (serverUrlInput && usernameInput && passwordInput && saveButton) {
        // Load stored settings
        chrome.storage.sync.get(['serverUrl', 'username', 'password'], (items) => {
            serverUrlInput.value = items.serverUrl || '';
            usernameInput.value = items.username || '';
            passwordInput.value = items.password || '';
        });

        // Save settings when the save button is clicked
        saveButton.addEventListener('click', () => {
            const serverUrl = serverUrlInput.value;
            const username = usernameInput.value;
            const password = passwordInput.value;

            chrome.storage.sync.set({ serverUrl, username, password }, () => {
                console.log('Settings saved');
            });
        });
    } else {
        console.error('One or more elements are not found in the DOM');
    }
});