// Google Meet Subtitles Logger
// This script monitors Google Meet subtitle elements and logs them to the console

console.log('Google Meet Subtitles Logger started');

// Track previously seen subtitles to avoid duplicates
const seenSubtitles = new Set();
let lastSubtitle = '';
let lastLogTime = 0;

// Function to observe subtitles
function observeSubtitles() {
  console.log('Starting subtitle observation');
  
  // The main container where subtitles appear in Google Meet
  const targetNode = document.body;
  
  // Observer configuration
  const config = { 
    childList: true, 
    subtree: true, 
    characterData: true
  };
  
  // Callback to execute when mutations are observed
  const callback = function(mutationsList, observer) {
    // Google Meet uses different classes for subtitles depending on the UI version
    // These are the known subtitle container classes
    const subtitleSelectors = [
      '.CNusmb',               // Primary subtitle class
      '.VbkSUe',               // Alternative subtitle class
      '.a4cQT',                // Subtitle container in some versions
      '[data-message-text]',   // Data attribute for subtitles
      '.iOzk7',                // Another possible subtitle class
      '.TBMuR',                // Another possible subtitle class
      '.zTETae',               // Transcript text
      '.Mz6pEf',               // Possible subtitle wrapper
      '.n2NWs'                 // Transcription element
    ];
    
    // Join all selectors
    const combinedSelector = subtitleSelectors.join(', ');
    const subtitleElements = document.querySelectorAll(combinedSelector);
    
    if (subtitleElements.length > 0) {
      subtitleElements.forEach(element => {
        const text = element.textContent || element.innerText || '';
        if (text && text.trim() !== '' && text !== lastSubtitle) {
          // Avoid logging the same subtitle too frequently (rate limiting)
          const now = Date.now();
          if (now - lastLogTime > 300) { // 300ms threshold
            console.log('📝 Subtitles:', text);
            lastSubtitle = text;
            lastLogTime = now;
            seenSubtitles.add(text);
          }
        }
      });
    }
  };
  
  // Create an observer instance linked to the callback function
  const observer = new MutationObserver(callback);
  
  // Start observing the target node for configured mutations
  observer.observe(targetNode, config);
  
  console.log('Subtitle observer started');
  
  // Backup method: periodically check for subtitles
  // This helps catch subtitles that might be missed by the mutation observer
  setInterval(() => {
    const subtitleSelectors = [
      '.CNusmb', '.VbkSUe', '.a4cQT', '[data-message-text]', 
      '.iOzk7', '.TBMuR', '.zTETae', '.Mz6pEf', '.n2NWs'
    ];
    
    const combinedSelector = subtitleSelectors.join(', ');
    const subtitleElements = document.querySelectorAll(combinedSelector);
    
    subtitleElements.forEach(element => {
      const text = element.textContent || element.innerText || '';
      if (text && text.trim() !== '' && text !== lastSubtitle) {
        // Rate limiting
        const now = Date.now();
        if (now - lastLogTime > 300) {
          console.log('📝 Subtitles (interval check):', text);
          lastSubtitle = text;
          lastLogTime = now;
          seenSubtitles.add(text);
        }
      }
    });
  }, 500);
}

// Fallback function to try multiple methods of finding subtitles
function findSubtitlesWithDeepScan() {
  console.log('Performing deep scan for subtitle elements');
  
  // Method 1: Look for elements with specific text patterns that might be subtitles
  document.querySelectorAll('div, span, p').forEach(el => {
    if (el.childNodes.length <= 3 && el.textContent && 
        el.textContent.trim().length > 0 && 
        el.textContent.trim().length < 200) {
      
      // Check if this element changes frequently
      const elId = el.id || Math.random().toString(36).substring(7);
      el.dataset.subtitleScan = elId;
      
      // Watch this element for changes
      const elementObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          if (mutation.type === 'characterData' || mutation.type === 'childList') {
            const text = el.textContent || el.innerText;
            if (text && text.trim() !== '' && text !== lastSubtitle) {
              console.log('📝 Potential subtitle (deep scan):', text);
              lastSubtitle = text;
            }
          }
        });
      });
      
      elementObserver.observe(el, {
        characterData: true,
        childList: true,
        subtree: true
      });
    }
  });
}

// Function to detect when Google Meet is fully loaded
function detectGoogleMeet() {
  // Method 1: Check for specific Google Meet elements
  const meetElements = [
    '.c8mVDd',  // Meeting bottom bar
    '.crqnQb',  // Meeting container
    '.rG0ybd',  // Main meeting layout
    '.NzPR9b',  // Video grid
    '.GvcWrd'   // Participants panel
  ];
  
  // Check if any Meet elements exist
  const meetLoaded = meetElements.some(selector => document.querySelector(selector));
  
  if (meetLoaded) {
    console.log('Google Meet interface detected');
    observeSubtitles();
    setTimeout(findSubtitlesWithDeepScan, 5000); // Try deep scan after 5 seconds
    return true;
  }
  
  return false;
}

// Initial check on page load
window.addEventListener('load', () => {
  console.log('Page loaded, waiting for Google Meet interface...');
  
  // Try to detect Google Meet interface immediately
  if (!detectGoogleMeet()) {
    // If not detected, set up periodic checks
    const detectInterval = setInterval(() => {
      if (detectGoogleMeet()) {
        clearInterval(detectInterval);
      }
    }, 1000);
    
    // Safety timeout to clear interval after 60 seconds
    setTimeout(() => {
      clearInterval(detectInterval);
      console.log('Timed out waiting for Google Meet interface. Starting observers anyway.');
      observeSubtitles();
      findSubtitlesWithDeepScan();
    }, 60000);
  }
});

// Setup a mutation observer to detect when Google Meet loads
const bodyObserver = new MutationObserver((mutations) => {
  if (detectGoogleMeet()) {
    bodyObserver.disconnect();
  }
});

bodyObserver.observe(document.body, { childList: true, subtree: true }); 