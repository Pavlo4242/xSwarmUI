// Add this to currentimagehandler.js or as a separate plugin

/** Toggle metadata visibility in the current image view */
function toggleCurrentImageMetadata() {
    let curImg = getRequiredElementById('current_image');
    let container = currentImageHelper.getCurrentImageContainer();
    
    // Don't do anything if there's no actual image loaded
    let actualImg = currentImageHelper.getCurrentImage();
    if (!actualImg || !actualImg.src || actualImg.src === '') {
        console.log('No image loaded, cannot toggle metadata view');
        return;
    }
    
    // All the elements that need to be hidden
    let extrasWrapper = curImg.querySelector('.current-image-extras-wrapper');
    let altPromptRegion = document.getElementById('alt_prompt_region');
    let welcomeMessage = document.getElementById('welcome_message');
    
    if (!container) {
        return;
    }
    
    // Check current state
    let isHidden = curImg.classList.contains('current_image_fullscreen');
    
    if (isHidden) {
        // Show everything - restore
        if (extrasWrapper) {
            extrasWrapper.style.display = '';
        }
        if (altPromptRegion) {
            altPromptRegion.style.display = '';
        }
        container.style.maxWidth = '';
        container.style.maxHeight = '';
        container.style.width = '';
        container.style.height = '';
        curImg.classList.remove('current_image_fullscreen');
        curImg.style.position = '';
        curImg.style.top = '';
        curImg.style.left = '';
        curImg.style.right = '';
        curImg.style.bottom = '';
        curImg.style.width = '';
        curImg.style.height = '';
        curImg.style.zIndex = '';
        curImg.style.background = '';
        curImg.style.margin = '';
        curImg.style.padding = '';
        
        // Restore normal layout
        if (typeof alignImageDataFormat === 'function') {
            alignImageDataFormat();
        }
    } else {
        // Hide everything - just show the image
        if (extrasWrapper) {
            extrasWrapper.style.display = 'none';
        }
        if (altPromptRegion) {
            altPromptRegion.style.display = 'none';
        }
        if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
        }
        
        // Make current_image go fullscreen
        curImg.style.position = 'fixed';
        curImg.style.top = '0';
        curImg.style.left = '0';
        curImg.style.right = '0';
        curImg.style.bottom = '0';
        curImg.style.width = '100vw';
        curImg.style.height = '100vh';
        curImg.style.zIndex = '9999';
        curImg.style.background = '#000';
        curImg.style.margin = '0';
        curImg.style.padding = '0';
        curImg.classList.add('current_image_fullscreen');
        
        // Make the image/video fill properly
        container.style.maxWidth = '95vw';
        container.style.maxHeight = '95vh';
        container.style.width = 'auto';
        container.style.height = 'auto';
        container.style.margin = 'auto';
    }
}

/** Add toggle button to the current image area */
function addMetadataToggleButton() {
    let curImg = getRequiredElementById('current_image');
    if (!curImg) {
        return;
    }
    
    // Check if there's actually an image loaded
    let actualImg = currentImageHelper.getCurrentImage();
    let hasImage = actualImg && actualImg.src && actualImg.src !== '';
    
    // Remove old button if it exists
    let oldBtn = document.getElementById('toggle_metadata_btn');
    if (oldBtn) {
        oldBtn.remove();
    }
    
    // Don't add button if no image
    if (!hasImage) {
        return;
    }
    
    let toggleBtn = document.createElement('button');
    toggleBtn.id = 'toggle_metadata_btn';
    toggleBtn.className = 'btn btn-sm';
    toggleBtn.innerHTML = '👁️ Hide Info';
    toggleBtn.title = 'Toggle metadata and button visibility (or press H)';
    toggleBtn.style.position = 'absolute';
    toggleBtn.style.top = '10px';
    toggleBtn.style.right = '10px';
    toggleBtn.style.zIndex = '10000';
    toggleBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    toggleBtn.style.color = 'white';
    toggleBtn.style.border = '1px solid rgba(255, 255, 255, 0.3)';
    toggleBtn.style.borderRadius = '4px';
    toggleBtn.style.padding = '5px 10px';
    toggleBtn.style.cursor = 'pointer';
    
    toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleCurrentImageMetadata();
        let isHidden = curImg.classList.contains('current_image_fullscreen');
        toggleBtn.innerHTML = isHidden ? '👁️ Show Info' : '👁️ Hide Info';
    });
    
    curImg.style.position = 'relative';
    curImg.appendChild(toggleBtn);
    
    // Update button text based on current state
    let isHidden = curImg.classList.contains('current_image_fullscreen');
    toggleBtn.innerHTML = isHidden ? '👁️ Show Info' : '👁️ Hide Info';
}

// Hook into setCurrentImage to add button whenever image changes
if (typeof window !== 'undefined') {
    let originalSetCurrentImage = window.setCurrentImage;
    if (originalSetCurrentImage) {
        window.setCurrentImage = function(...args) {
            let result = originalSetCurrentImage.apply(this, args);
            // Add button after image is set (only if there's an actual image)
            setTimeout(addMetadataToggleButton, 100);
            return result;
        };
    }
}

// Initialize when page loads
if (typeof document !== 'undefined') {
    setTimeout(addMetadataToggleButton, 1000);
}

// Add CSS for fullscreen mode
if (typeof document !== 'undefined') {
    let style = document.createElement('style');
    style.textContent = `
        /* Fullscreen container styles */
        .current_image_fullscreen {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        
        /* Hide all the metadata and controls when in fullscreen */
        .current_image_fullscreen .current-image-extras-wrapper {
            display: none !important;
        }
        
        /* Make the image/video fill and center properly */
        .current_image_fullscreen .current-image-img,
        .current_image_fullscreen .video-container,
        .current_image_fullscreen video,
        .current_image_fullscreen audio,
        .current_image_fullscreen img {
            max-width: 95vw !important;
            max-height: 95vh !important;
            width: auto !important;
            height: auto !important;
            object-fit: contain !important;
            margin: auto !important;
        }
        
        /* Keep the toggle button visible and on top */
        .current_image_fullscreen #toggle_metadata_btn {
            position: fixed !important;
            top: 10px !important;
            right: 10px !important;
            z-index: 10001 !important;
        }
    `;
    document.head.appendChild(style);
}

// Add keyboard shortcut: Press 'H' to toggle
if (typeof document !== 'undefined') {
    document.addEventListener('keydown', (e) => {
        // Only if focused on the image area and not typing in an input
        if (e.key === 'h' || e.key === 'H') {
            if (document.activeElement.tagName !== 'INPUT' && 
                document.activeElement.tagName !== 'TEXTAREA') {
                let actualImg = currentImageHelper.getCurrentImage();
                if (actualImg && actualImg.src && actualImg.src !== '') {
                    let curImg = document.getElementById('current_image');
                    if (curImg) {
                        toggleCurrentImageMetadata();
                        let toggleBtn = document.getElementById('toggle_metadata_btn');
                        if (toggleBtn) {
                            let isHidden = curImg.classList.contains('current_image_fullscreen');
                            toggleBtn.innerHTML = isHidden ? '👁️ Show Info' : '👁️ Hide Info';
                        }
                    }
                }
            }
        }
        
        // ESC to exit fullscreen
        if (e.key === 'Escape') {
            let curImg = document.getElementById('current_image');
            if (curImg && curImg.classList.contains('current_image_fullscreen')) {
                toggleCurrentImageMetadata();
                let toggleBtn = document.getElementById('toggle_metadata_btn');
                if (toggleBtn) {
                    toggleBtn.innerHTML = '👁️ Hide Info';
                }
            }
        }
    });
}