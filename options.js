document.addEventListener('DOMContentLoaded', function() {
    const serverUrlInput = document.getElementById('serverUrl');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const saveButton = document.getElementById('save');
    const statusMessage = document.getElementById('status-message');

    // Load stored settings
    chrome.storage.sync.get(['serverUrl', 'username', 'password'], (items) => {
        if (chrome.runtime.lastError) {
            console.error("Error loading settings:", chrome.runtime.lastError);
            if (statusMessage) {
                statusMessage.textContent = 'Error loading settings: ' + chrome.runtime.lastError.message;
                statusMessage.style.color = 'red'; // Indicate error
                statusMessage.style.backgroundColor = '#f8d7da'; // Light red background
                statusMessage.style.display = 'block';
            }
            return;
        }
        serverUrlInput.value = items.serverUrl || '';
        usernameInput.value = items.username || '';
        passwordInput.value = items.password || '';
    });

    // Save settings when the save button is clicked
    saveButton.addEventListener('click', () => {
        const serverUrl = serverUrlInput.value.trim();
        const username = usernameInput.value.trim(); // It's okay to trim username
        const password = passwordInput.value; // Password should not be trimmed

        // Basic validation for Server URL
        if (!serverUrl) {
            if (statusMessage) {
                statusMessage.textContent = 'Server URL cannot be empty.';
                statusMessage.style.color = 'red';
                statusMessage.style.backgroundColor = '#f8d7da';
                statusMessage.style.display = 'block';
                setTimeout(() => {
                    statusMessage.style.display = 'none';
                }, 3000);
            }
            return;
        }
        try {
            new URL(serverUrl); // Validate if it's a proper URL
        } catch (e) {
            if (statusMessage) {
                statusMessage.textContent = 'Invalid Server URL format.';
                statusMessage.style.color = 'red';
                statusMessage.style.backgroundColor = '#f8d7da';
                statusMessage.style.display = 'block';
                setTimeout(() => {
                    statusMessage.style.display = 'none';
                }, 3000);
            }
            return;
        }


        chrome.storage.sync.set({ serverUrl, username, password }, () => {
            if (chrome.runtime.lastError) {
                console.error("Error saving settings:", chrome.runtime.lastError);
                if (statusMessage) {
                    statusMessage.textContent = 'Error saving settings: ' + chrome.runtime.lastError.message;
                    statusMessage.style.color = 'red';
                    statusMessage.style.backgroundColor = '#f8d7da';
                    statusMessage.style.display = 'block';
                }
            } else {
                if (statusMessage) {
                    statusMessage.textContent = 'Settings saved successfully!';
                    statusMessage.style.color = '#155724'; // Default success color from CSS
                    statusMessage.style.backgroundColor = '#d4edda'; // Default success background
                    statusMessage.style.display = 'block';
                    setTimeout(() => {
                        statusMessage.style.display = 'none';
                    }, 3000);
                }
                console.log('Settings saved');
            }
        });
    });
});
