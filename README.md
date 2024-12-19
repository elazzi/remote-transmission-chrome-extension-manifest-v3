# remote-transmission-chrome-extension-manifest-v3   github copilot test

Steps to Test the Extension
Ensure the manifest.json, background.js, content.js, popup.html, and popup.js files are in the extension directory.
Open Chrome and navigate to chrome://extensions/.
Enable "Developer mode" using the toggle on the top right.
Click "Load unpacked" and select your extension's directory.
Open the console in the background page (you can do this by clicking on "background page" under your extension in chrome://extensions/).
Click on any link with a URL starting with "magnet:", and you should see the URL logged in the background page console, and the link should not open.