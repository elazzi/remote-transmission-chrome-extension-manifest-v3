// content-script.js

document.addEventListener('click', function(event) {
  let targetElement = event.target;
  // Traverse up the DOM to find the anchor tag
  while (targetElement && targetElement.tagName !== 'A') {
    targetElement = targetElement.parentNode;
  }

  if (targetElement && targetElement.tagName === 'A') {
    const href = targetElement.href;

    if (href && href.startsWith('magnet:')) {
      console.log("Magnet link detected:", href);

      // IMPORTANT: Prevent default action immediately and stop propagation.
      // This is the most crucial part to stop the browser's default handling.
      event.preventDefault();
      event.stopImmediatePropagation(); // Use stopImmediatePropagation for more aggressive stopping

      console.log("Default magnet link action prevented.");

      // If the link has an inline onclick, we might need to suppress it too.
      // However, stopImmediatePropagation should generally handle this.
      // If issues persist, consider removing or temporarily disabling the onclick
      // attribute here, but that can be complex and risky.

      // Send the magnet link to the service worker
      chrome.runtime.sendMessage({ action: "handleMagnetLink", magnetLink: href })
        .then(response => {
          if (response && response.status === "success") {
            console.log("Magnet link sent to service worker successfully. Response:", response);
          } else {
            console.error("Failed to send magnet link to service worker or received error response:", response);
          }
        })
        .catch(error => {
          console.error("Error sending message to service worker:", error);
        });
    }
  }
}, true); // Use capture phase to ensure we get the event before other handlers

console.log("Magnet Link Handler Content Script loaded.");
