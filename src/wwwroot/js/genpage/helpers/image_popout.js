/** 
 * Image Pop-Out Window Plugin
 * Creates floating, draggable windows for images/videos that stay visible
 * while you continue working in the main interface.
 */

class ImagePopoutWindow {
    constructor() {
        this.windows = [];
        this.windowCounter = 0;
        this.addStyles();
    }

    addStyles() {
        if (document.getElementById('popout-window-styles')) return;
        
        let style = document.createElement('style');
        style.id = 'popout-window-styles';
        style.textContent = `
            .popout-window {
                position: fixed;
                background: #1a1a1a;
                border: 2px solid #333;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                z-index: 10000;
                min-width: 300px;
                min-height: 200px;
                display: flex;
                flex-direction: column;
                resize: both;
                overflow: auto;
            }
            
            .popout-header {
                background: #2a2a2a;
                padding: 8px 12px;
                cursor: move;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #333;
                user-select: none;
            }
            
            .popout-title {
                color: #fff;
                font-size: 14px;
                font-weight: 500;
            }
            
            .popout-controls {
                display: flex;
                gap: 8px;
            }
            
            .popout-btn {
                background: transparent;
                border: none;
                color: #aaa;
                cursor: pointer;
                font-size: 18px;
                padding: 0 6px;
                transition: color 0.2s;
            }
            
            .popout-btn:hover {
                color: #fff;
            }
            
            .popout-content {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 10px;
                overflow: auto;
                background: #000;
            }
            
            .popout-content img,
            .popout-content video {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                cursor: grab;
            }
            
            .popout-content img:active,
            .popout-content video:active {
                cursor: grabbing;
            }
            
            .popout-window.minimized {
                height: auto !important;
                resize: none;
            }
            
            .popout-window.minimized .popout-content {
                display: none;
            }
        `;
        document.head.appendChild(style);
    }

    createWindow(src, metadata = '', title = 'Image') {
        let windowId = `popout-${this.windowCounter++}`;
        
        // Create window structure
        let win = document.createElement('div');
        win.id = windowId;
        win.className = 'popout-window';
        win.style.left = `${100 + (this.windows.length * 30)}px`;
        win.style.top = `${100 + (this.windows.length * 30)}px`;
        win.style.width = '600px';
        win.style.height = '500px';
        
        let isVideo = isVideoExt(src);
        let isAudio = isAudioExt(src);
        
        // Header with controls
        let header = document.createElement('div');
        header.className = 'popout-header';
        header.innerHTML = `
            <div class="popout-title">${title}</div>
            <div class="popout-controls">
                <button class="popout-btn" title="Minimize" data-action="minimize">−</button>
                <button class="popout-btn" title="Copy to Center" data-action="copy">⊕</button>
                <button class="popout-btn" title="Close" data-action="close">×</button>
            </div>
        `;
        
        // Content area
        let content = document.createElement('div');
        content.className = 'popout-content';
        
        let mediaElement;
        if (isVideo) {
            mediaElement = document.createElement('video');
            mediaElement.loop = true;
            mediaElement.autoplay = true;
            mediaElement.controls = true;
            let source = document.createElement('source');
            source.src = src;
            source.type = isVideo;
            mediaElement.appendChild(source);
        } else if (isAudio) {
            mediaElement = document.createElement('audio');
            mediaElement.controls = true;
            mediaElement.src = src;
        } else {
            mediaElement = document.createElement('img');
            mediaElement.src = src;
        }
        
        content.appendChild(mediaElement);
        win.appendChild(header);
        win.appendChild(content);
        document.body.appendChild(win);
        
        // Store window data
        let windowData = {
            id: windowId,
            element: win,
            src: src,
            metadata: metadata,
            isDragging: false,
            dragOffsetX: 0,
            dragOffsetY: 0,
            isMinimized: false
        };
        this.windows.push(windowData);
        
        // Setup event handlers
        this.setupDragging(windowData, header);
        this.setupControls(windowData, header);
        this.setupMediaDragging(windowData, mediaElement, content);
        
        // Bring to front on click
        win.addEventListener('mousedown', () => this.bringToFront(windowData));
        this.bringToFront(windowData);
        
        return windowData;
    }

    setupDragging(windowData, header) {
        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('popout-btn')) return;
            
            windowData.isDragging = true;
            let rect = windowData.element.getBoundingClientRect();
            windowData.dragOffsetX = e.clientX - rect.left;
            windowData.dragOffsetY = e.clientY - rect.top;
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!windowData.isDragging) return;
            
            let x = e.clientX - windowData.dragOffsetX;
            let y = e.clientY - windowData.dragOffsetY;
            
            // Keep within viewport
            x = Math.max(0, Math.min(x, window.innerWidth - 100));
            y = Math.max(0, Math.min(y, window.innerHeight - 40));
            
            windowData.element.style.left = `${x}px`;
            windowData.element.style.top = `${y}px`;
        });
        
        document.addEventListener('mouseup', () => {
            windowData.isDragging = false;
        });
    }

    setupMediaDragging(windowData, media, container) {
        let mediaOffsetX = 0;
        let mediaOffsetY = 0;
        let isDraggingMedia = false;
        
        media.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            isDraggingMedia = true;
            mediaOffsetX = e.clientX;
            mediaOffsetY = e.clientY;
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDraggingMedia) return;
            
            let dx = e.clientX - mediaOffsetX;
            let dy = e.clientY - mediaOffsetY;
            
            container.scrollLeft -= dx;
            container.scrollTop -= dy;
            
            mediaOffsetX = e.clientX;
            mediaOffsetY = e.clientY;
        });
        
        document.addEventListener('mouseup', () => {
            isDraggingMedia = false;
        });
    }

    setupControls(windowData, header) {
        let controls = header.querySelectorAll('.popout-btn');
        
        controls.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                let action = btn.dataset.action;
                
                if (action === 'close') {
                    this.closeWindow(windowData);
                } else if (action === 'minimize') {
                    this.toggleMinimize(windowData);
                    btn.textContent = windowData.isMinimized ? '+' : '−';
                } else if (action === 'copy') {
                    this.copyToCenter(windowData);
                }
            });
        });
    }

    toggleMinimize(windowData) {
        windowData.isMinimized = !windowData.isMinimized;
        windowData.element.classList.toggle('minimized', windowData.isMinimized);
    }

    copyToCenter(windowData) {
        if (typeof setCurrentImage === 'function') {
            setCurrentImage(windowData.src, windowData.metadata, '', false, true);
        }
    }

    closeWindow(windowData) {
        windowData.element.remove();
        this.windows = this.windows.filter(w => w.id !== windowData.id);
    }

    bringToFront(windowData) {
        let maxZ = Math.max(10000, ...this.windows.map(w => 
            parseInt(w.element.style.zIndex) || 10000
        ));
        windowData.element.style.zIndex = maxZ + 1;
    }

    popoutCurrentImage() {
        let img = currentImageHelper?.getCurrentImage();
        if (!img) {
            alert('No image is currently selected');
            return;
        }
        
        let src = img.dataset.src || img.src;
        let metadata = img.dataset.metadata || '';
        let title = src.includes('/') ? src.substring(src.lastIndexOf('/') + 1) : src;
        
        this.createWindow(src, metadata, title);
    }
}

// Create global instance
let imagePopout = new ImagePopoutWindow();

// Add button to current image area
function addPopoutButton() {
    let curImg = document.getElementById('current_image');
    if (!curImg || document.getElementById('popout_btn')) return;
    
    let popoutBtn = document.createElement('button');
    popoutBtn.id = 'popout_btn';
    popoutBtn.className = 'btn btn-sm';
    popoutBtn.innerHTML = '↗️ Pop Out';
    popoutBtn.title = 'Open image in floating window';
    popoutBtn.style.position = 'absolute';
    popoutBtn.style.top = '10px';
    popoutBtn.style.right = '110px';
    popoutBtn.style.zIndex = '1000';
    popoutBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    popoutBtn.style.color = 'white';
    popoutBtn.style.border = '1px solid rgba(255, 255, 255, 0.3)';
    popoutBtn.style.borderRadius = '4px';
    popoutBtn.style.padding = '5px 10px';
    popoutBtn.style.cursor = 'pointer';
    
    popoutBtn.addEventListener('click', () => imagePopout.popoutCurrentImage());
    
    curImg.style.position = 'relative';
    curImg.appendChild(popoutBtn);
}

// Add to full-view modal too
function addPopoutToFullView() {
    // Modify the showImage function to include popout button
    if (typeof imageFullView !== 'undefined') {
        let originalShowImage = imageFullView.showImage.bind(imageFullView);
        imageFullView.showImage = function(src, metadata, batchId) {
            originalShowImage(src, metadata, batchId);
            
            let buttonArea = this.content.querySelector('.image_fullview_extra_buttons');
            if (buttonArea && !buttonArea.querySelector('.popout-fullview-btn')) {
                quickAppendButton(buttonArea, 'Pop Out ↗️', () => {
                    imagePopout.createWindow(src, metadata, 'Full View Image');
                }, 'popout-fullview-btn', 'Open in floating window');
            }
        };
    }
}

// Initialize
if (typeof document !== 'undefined') {
    setTimeout(() => {
        addPopoutButton();
        addPopoutToFullView();
    }, 1000);
}

// Keyboard shortcut: Ctrl+Shift+P to pop out current image
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        imagePopout.popoutCurrentImage();
    }
});