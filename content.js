document.addEventListener('click', (event) => {
  const target = event.target.closest('a');
  console.log(target);
   if (target && target.href.startsWith('magnet')) {
	   event.preventDefault();
    chrome.runtime.sendMessage({ type: 'linkClicked', url: target.href }, (response) => {
      console.log('Message sent to background script');
      console.log(response);
    });
	
	 
  }
});