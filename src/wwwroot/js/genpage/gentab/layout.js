
// ===== HELPER FUNCTIONS - MUST BE DEFINED FIRST =====

function getCookie(name) {
    let value = `; ${document.cookie}`;
    let parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + d.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

function deleteCookie(name) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

function getRequiredElementById(id) {
    const elem = document.getElementById(id);
    if (!elem) console.warn(`Element not found: ${id}`);
    return elem;
}

function findParentOfClass(elem, className) {
    while (elem && elem.parentElement) {
        elem = elem.parentElement;
        if (elem.classList && elem.classList.contains(className)) {
            return elem;
        }
    }
    return null;
}
// ========================================
// FILE 1: layout.js - Replace injectLayoutCSS function ONLY
// ========================================

function injectLayoutCSS() {
    if (document.getElementById('gen-tab-layout-css')) return;
    
    const style = document.createElement('style');
    style.id = 'gen-tab-layout-css';
    style.textContent = `
        :root {
            --sidebar-left-width: 28rem;
            --sidebar-right-width: 21rem;
            --sidebar-min-width: 10rem;
        }

        /* MASTER LAYOUT CONTAINER */
        .t2i-top-bar {
            display: flex !important;
            flex-direction: row !important;
            width: 100vw !important;
            height: 50vh !important;
            overflow: hidden !important;
            white-space: nowrap;
        }

        /* LEFT SIDEBAR */
        .input-sidebar {
            flex: 0 0 auto !important;
            width: var(--sidebar-left-width) !important;
            display: flex !important;
            flex-direction: column !important;
            border-right: 1px solid var(--border-color, #444);
            transition: width 0.05s linear; /* Smooth resize */
        }

        /* SPLITTERS */
        .t2i-top-split-bar, .t2i-top-2nd-split-bar {
            flex: 0 0 5px !important;
            width: 5px !important;
            cursor: col-resize !important;
            background-color: var(--background-soft, #222);
            border-left: 1px solid var(--border-color, #444);
            border-right: 1px solid var(--border-color, #444);
            z-index: 10;
        }
        .t2i-top-split-bar:hover, .t2i-top-2nd-split-bar:hover {
            background-color: var(--emphasis, #007bff);
        }

        /* CENTER MAIN IMAGE AREA */
        .main-image-area {
            flex: 1 1 0 !important; /* Grow to fill space */
            min-width: 0 !important; /* Allow shrinking below content size */
            display: flex !important;
            flex-direction: column !important;
            position: relative !important;
            height: 100% !important;
            background-color: var(--background, #111);
        }

        /* RIGHT SIDEBAR (BATCH) */
        .current_image_batch {
            flex: 0 0 auto !important;
            width: var(--sidebar-right-width) !important;
            display: flex !important;
            flex-direction: column !important;
            border-left: 1px solid var(--border-color, #444);
            transition: width 0.05s linear;
        }

        /* IMAGE CENTERING FIX */
        .current_image_wrapbox {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            height: 100% !important;
            overflow: hidden !important;
        }

        .current_image {
            flex-grow: 1 !important;
            display: flex !important;
            justify-content: center !important; /* Center Horizontally */
            align-items: center !important;     /* Center Vertically */
            overflow: hidden !important;
            position: relative !important;
            width: 100% !important;
            height: 100% !important;
            padding: 4px !important;
        }

        .current-image-img {
            max-width: 100% !important;
            max-height: 100% !important;
            width: auto !important;
            height: auto !important;
            object-fit: contain !important;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
        }

        /* FIX: Metadata/Buttons area should not overlap image */
        #current_image_buttons, #image_metadata_container {
            flex-shrink: 0 !important;
            width: 100% !important;
            background: var(--background-soft, #222);
            padding: 5px;
            max-height: 30%;
            overflow-y: auto;
        }

        /* INTERNAL SIDEBAR SPLITS (Vertical) */
        .sidebar-top-section {
            flex-grow: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        .sidebar-bottom-section {
            height: 30%; /* Default, controlled by JS */
            min-height: 2rem;
            display: flex;
            flex-direction: column;
            border-top: 1px solid var(--border-color, #444);
        }
    `;
    document.head.appendChild(style);
}

// Improved GenTabLayout Class
class GenTabLayout {
    constructor() {
        this.inputSidebar = getRequiredElementById('input_sidebar');
        this.mainImageArea = getRequiredElementById('main_image_area');
        this.batchSidebar = getRequiredElementById('current_image_batch_wrapper');
        
        // Splitters
        this.leftSplitter = getRequiredElementById('t2i-top-split-bar');
        this.rightSplitter = getRequiredElementById('t2i-top-2nd-split-bar');

        // Init State from Cookies or Defaults
        this.leftWidth = parseInt(getCookie('layout_left_width') || 448); // approx 28rem
        this.rightWidth = parseInt(getCookie('layout_right_width') || 336); // approx 21rem

        this.init();
    }

    init() {
        // Apply initial widths
        this.applyWidths();

        // Drag Handler Logic
        this.setupDrag(this.leftSplitter, 'left');
        this.setupDrag(this.rightSplitter, 'right');
    }

    applyWidths() {
        document.documentElement.style.setProperty('--sidebar-left-width', `${this.leftWidth}px`);
        document.documentElement.style.setProperty('--sidebar-right-width', `${this.rightWidth}px`);
    }

    setupDrag(splitter, side) {
        let isDragging = false;

        splitter.addEventListener('mousedown', (e) => {
            isDragging = true;
            e.preventDefault();
            document.body.style.cursor = 'col-resize';
            document.body.classList.add('user-select-none'); // Prevent text selection
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            if (side === 'left') {
                // Calculate new left width
                let newWidth = e.clientX;
                // Constraints (Min 100px, Max 50% of screen)
                newWidth = Math.max(100, Math.min(newWidth, window.innerWidth * 0.6));
                this.leftWidth = newWidth;
                document.documentElement.style.setProperty('--sidebar-left-width', `${this.leftWidth}px`);
            } 
            else if (side === 'right') {
                // Calculate new right width (Window Width - Mouse X)
                let newWidth = window.innerWidth - e.clientX;
                // Constraints
                newWidth = Math.max(100, Math.min(newWidth, window.innerWidth * 0.6));
                this.rightWidth = newWidth;
                document.documentElement.style.setProperty('--sidebar-right-width', `${this.rightWidth}px`);
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.cursor = '';
                document.body.classList.remove('user-select-none');
                // Save State
                setCookie('layout_left_width', this.leftWidth, 365);
                setCookie('layout_right_width', this.rightWidth, 365);
            }
        });

}
    // NEW: Function to rescue modals from sidebar stacking contexts
  fixModals(){
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            // Move modals to body if they are currently nested elsewhere
            if (modal.parentElement !== document.body) {
                document.body.appendChild(modal);
                console.log('Moved modal to body:', modal.id);
            }
        });
    }
    createSidebarSplitBars() {
        // Left sidebar split bar
        if (!document.getElementById('left-sidebar-split-bar')) {
            this.leftSidebarSplitBar = document.createElement('div');
            this.leftSidebarSplitBar.id = 'left-sidebar-split-bar';
            this.leftSidebarSplitBar.style.cssText = `
                position: absolute;
                left: 0;
                width: 100%;
                height: 12px;
                cursor: row-resize;
                background: rgba(100, 120, 180, 0.25);
                z-index: 1001;
                display: none;
                border-top: 2px solid rgba(100, 120, 180, 0.4);
                border-bottom: 2px solid rgba(100, 120, 180, 0.4);
                box-shadow: 0 0 8px rgba(0, 0, 0, 0.1);
                transition: background 0.2s ease;
            `;
            document.body.appendChild(this.leftSidebarSplitBar);
        } else {
            this.leftSidebarSplitBar = document.getElementById('left-sidebar-split-bar');
        }

        // Right sidebar split bar
        if (!document.getElementById('right-sidebar-split-bar')) {
            this.rightSidebarSplitBar = document.createElement('div');
            this.rightSidebarSplitBar.id = 'right-sidebar-split-bar';
            this.rightSidebarSplitBar.style.cssText = `
                position: absolute;
                right: 0;
                width: 100%;
                height: 12px;
                cursor: row-resize;
                background: rgba(100, 120, 180, 0.25);
                z-index: 1001;
                display: none;
                border-top: 2px solid rgba(100, 120, 180, 0.4);
                border-bottom: 2px solid rgba(100, 120, 180, 0.4);
                box-shadow: 0 0 8px rgba(0, 0, 0, 0.1);
                transition: background 0.2s ease;
            `;
            document.body.appendChild(this.rightSidebarSplitBar);
        } else {
            this.rightSidebarSplitBar = document.getElementById('right-sidebar-split-bar');
        }

        // Enhanced hover effects with smooth transitions
        this.leftSidebarSplitBar.addEventListener('mouseenter', () => {
            this.leftSidebarSplitBar.style.background = 'rgba(100, 150, 255, 0.5)';
            this.leftSidebarSplitBar.style.borderTopColor = 'rgba(100, 150, 255, 0.8)';
            this.leftSidebarSplitBar.style.borderBottomColor = 'rgba(100, 150, 255, 0.8)';
        });
        this.leftSidebarSplitBar.addEventListener('mouseleave', () => {
            if (!this.leftSplitDrag) {
                this.leftSidebarSplitBar.style.background = 'rgba(100, 120, 180, 0.25)';
                this.leftSidebarSplitBar.style.borderTopColor = 'rgba(100, 120, 180, 0.4)';
                this.leftSidebarSplitBar.style.borderBottomColor = 'rgba(100, 120, 180, 0.4)';
            }
        });
        
        this.rightSidebarSplitBar.addEventListener('mouseenter', () => {
            this.rightSidebarSplitBar.style.background = 'rgba(100, 150, 255, 0.5)';
            this.rightSidebarSplitBar.style.borderTopColor = 'rgba(100, 150, 255, 0.8)';
            this.rightSidebarSplitBar.style.borderBottomColor = 'rgba(100, 150, 255, 0.8)';
        });
        this.rightSidebarSplitBar.addEventListener('mouseleave', () => {
            if (!this.rightSplitDrag) {
                this.rightSidebarSplitBar.style.background = 'rgba(100, 120, 180, 0.25)';
                this.rightSidebarSplitBar.style.borderTopColor = 'rgba(100, 120, 180, 0.4)';
                this.rightSidebarSplitBar.style.borderBottomColor = 'rgba(100, 120, 180, 0.4)';
            }
        });
   
}

    altPromptSizeHandle() {
        if (!this.antiDup) {
            this.antiDup = true;
            this.reapplyPositions();
            setTimeout(() => { this.antiDup = false; }, 1);
        }
    }

    populateTabContainers() {
        this.managedTabContainers = [];
        for (let tab of this.managedTabs) {
            if (tab.contentElem && tab.contentElem.parentElement) {
                let container = tab.contentElem.parentElement;
                if (!this.managedTabContainers.includes(container)) {
                    this.managedTabContainers.push(container);
                }
            }
        }
        return this.managedTabContainers;
    }

    reapplyPositions() {
        if (!this.t2iRootDiv) return;
        
        this.isSmallWindow = this.mobileDesktopLayout == 'auto' ? window.innerWidth < 768 : this.mobileDesktopLayout == 'mobile';
        document.body.classList.toggle('small-window', this.isSmallWindow);
        document.body.classList.toggle('large-window', !this.isSmallWindow);

        const rootTop = this.t2iRootDiv.getBoundingClientRect().top + window.scrollY;

        // Calculate dimensions with bounds
        let leftW = this.leftShut ? 0 : Math.max(100, Math.min(this.leftSectionBarPos, window.innerWidth - 400));
        let rightW = this.rightShut ? 0 : Math.max(100, Math.min(this.rightSectionBarPos, window.innerWidth - 400));
        let bottomH = this.bottomShut ? (this.isSmallWindow ? 40 : 60) : 
                       Math.max(100, Math.min(this.bottomSectionBarPos, window.innerHeight - 200));

        // Prevent overlap
        const maxTotalSidebarWidth = window.innerWidth - 300;
        if (leftW + rightW > maxTotalSidebarWidth) {
            const ratio = maxTotalSidebarWidth / (leftW + rightW);
            leftW = Math.floor(leftW * ratio);
            rightW = Math.floor(rightW * ratio);
        }

        const containerHeight = `calc(100vh - ${rootTop}px - ${bottomH}px)`;
        const containerHeightPx = window.innerHeight - rootTop - bottomH;
        const containerTop = `${rootTop}px`;

        // CENTER WORK AREA - PROPERLY EXCLUDE BOTH SIDEBARS
        if (this.mainImageArea) {
            Object.assign(this.mainImageArea.style, {
                position: 'absolute',
                top: containerTop,
                left: `${leftW}px`,
                width: `calc(100vw - ${leftW + rightW}px)`,
                height: containerHeight,
                overflowY: 'auto',
                overflowX: 'hidden',
                zIndex: '10',
                background: 'var(--body-bg)'
            });
        }

        // LEFT SIDEBAR
        if (this.inputSidebar) {
            const leftSidebarContainers = this.inputSidebar.querySelectorAll('.tab-content');
            const showLeftSplit = leftSidebarContainers.length >= 2 && !this.leftShut && !this.isSmallWindow;
            
            Object.assign(this.inputSidebar.style, {
                position: 'absolute',
                top: containerTop,
                left: '0',
                width: `${leftW}px`,
                height: containerHeight,
                display: this.leftShut ? 'none' : 'block',
                overflowX: 'hidden',
                overflowY: 'hidden',
                zIndex: '20',
                background: 'var(--bs-secondary-bg)',
                wordWrap: 'break-word',
                overflowWrap: 'break-word'
            });

            // Force wrapping on all child elements
            const allChildren = this.inputSidebar.querySelectorAll('*');
            allChildren.forEach(child => {
                if (child.style) {
                    child.style.wordWrap = 'break-word';
                    child.style.overflowWrap = 'break-word';
                    child.style.maxWidth = '100%';
                    child.style.boxSizing = 'border-box';
                }
            });

            if (showLeftSplit && leftSidebarContainers.length >= 2) {
                const topHeight = Math.floor(containerHeightPx * this.leftSidebarSplit);
                const bottomHeight = containerHeightPx - topHeight - 8;

                leftSidebarContainers[0].style.height = `${topHeight}px`;
                leftSidebarContainers[0].style.overflowY = 'auto';
                leftSidebarContainers[0].style.overflowX = 'hidden';
                leftSidebarContainers[0].style.wordWrap = 'break-word';
                leftSidebarContainers[0].style.overflowWrap = 'break-word';
                
                leftSidebarContainers[1].style.height = `${bottomHeight}px`;
                leftSidebarContainers[1].style.overflowY = 'auto';
                leftSidebarContainers[1].style.overflowX = 'hidden';
                leftSidebarContainers[1].style.marginTop = '8px';
                leftSidebarContainers[1].style.wordWrap = 'break-word';
                leftSidebarContainers[1].style.overflowWrap = 'break-word';

                Object.assign(this.leftSidebarSplitBar.style, {
                    top: `${rootTop + topHeight - 6}px`,
                    left: '0',
                    width: `${leftW}px`,
                    display: 'block'
                });
            } else {
                this.leftSidebarSplitBar.style.display = 'none';
                leftSidebarContainers.forEach(container => {
                    container.style.height = '100%';
                    container.style.overflowY = 'auto';
                    container.style.marginTop = '0';
                    container.style.wordWrap = 'break-word';
                    container.style.overflowWrap = 'break-word';
                });
            }
        }

        // RIGHT SIDEBAR
        if (this.currentImageBatch) {
            const rightSidebarContainers = this.currentImageBatch.querySelectorAll('.tab-content');
            const showRightSplit = rightSidebarContainers.length >= 2 && !this.rightShut && !this.isSmallWindow;
            
            Object.assign(this.currentImageBatch.style, {
                position: 'absolute',
                top: containerTop,
                right: '0',
                width: `${rightW}px`,
                height: containerHeight,
                display: this.rightShut ? 'none' : 'block',
                overflowX: 'hidden',
                overflowY: 'hidden',
                zIndex: '20',
                background: 'var(--bs-secondary-bg)',
                wordWrap: 'break-word',
                overflowWrap: 'break-word'
            });

            // Force wrapping on all child elements
            const allChildren = this.currentImageBatch.querySelectorAll('*');
            allChildren.forEach(child => {
                if (child.style) {
                    child.style.wordWrap = 'break-word';
                    child.style.overflowWrap = 'break-word';
                    child.style.maxWidth = '100%';
                    child.style.boxSizing = 'border-box';
                }
            });

            if (showRightSplit && rightSidebarContainers.length >= 2) {
                const topHeight = Math.floor(containerHeightPx * this.rightSidebarSplit);
                const bottomHeight = containerHeightPx - topHeight - 8;

                rightSidebarContainers[0].style.height = `${topHeight}px`;
                rightSidebarContainers[0].style.overflowY = 'auto';
                rightSidebarContainers[0].style.overflowX = 'hidden';
                rightSidebarContainers[0].style.wordWrap = 'break-word';
                rightSidebarContainers[0].style.overflowWrap = 'break-word';
                
                rightSidebarContainers[1].style.height = `${bottomHeight}px`;
                rightSidebarContainers[1].style.overflowY = 'auto';
                rightSidebarContainers[1].style.overflowX = 'hidden';
                rightSidebarContainers[1].style.marginTop = '8px';
                rightSidebarContainers[1].style.wordWrap = 'break-word';
                rightSidebarContainers[1].style.overflowWrap = 'break-word';

                Object.assign(this.rightSidebarSplitBar.style, {
                    top: `${rootTop + topHeight - 6}px`,
                    right: '0',
                    width: `${rightW}px`,
                    display: 'block'
                });
            } else {
                this.rightSidebarSplitBar.style.display = 'none';
                rightSidebarContainers.forEach(container => {
                    container.style.height = '100%';
                    container.style.overflowY = 'auto';
                    container.style.marginTop = '0';
                    container.style.wordWrap = 'break-word';
                    container.style.overflowWrap = 'break-word';
                });
            }
        }

        // DRAG HANDLES - ENHANCED VISIBILITY
        const barStyle = { 
            position: 'absolute', 
            zIndex: '1000', 
            background: 'rgba(100, 120, 180, 0.25)',
            transition: 'background 0.2s ease'
        };
        
        if (this.leftSplitBar) {
            const showLeftHandle = !this.isSmallWindow;
            Object.assign(this.leftSplitBar.style, barStyle, { 
                top: containerTop, 
                left: `${leftW - 6}px`, 
                width: '12px', 
                height: containerHeight, 
                cursor: 'col-resize', 
                display: showLeftHandle ? 'block' : 'none',
                borderLeft: '2px solid rgba(100, 120, 180, 0.4)',
                borderRight: '2px solid rgba(100, 120, 180, 0.4)',
                boxShadow: '0 0 8px rgba(0, 0, 0, 0.1)'
            });
            
            // Add hover effect
            this.leftSplitBar.onmouseenter = () => {
                this.leftSplitBar.style.background = 'rgba(100, 150, 255, 0.5)';
                this.leftSplitBar.style.borderLeftColor = 'rgba(100, 150, 255, 0.8)';
                this.leftSplitBar.style.borderRightColor = 'rgba(100, 150, 255, 0.8)';
            };
            this.leftSplitBar.onmouseleave = () => {
                if (!this.leftBarDrag) {
                    this.leftSplitBar.style.background = 'rgba(100, 120, 180, 0.25)';
                    this.leftSplitBar.style.borderLeftColor = 'rgba(100, 120, 180, 0.4)';
                    this.leftSplitBar.style.borderRightColor = 'rgba(100, 120, 180, 0.4)';
                }
            };
        }
        
        if (this.rightSplitBar) {
            const showRightHandle = !this.isSmallWindow;
            Object.assign(this.rightSplitBar.style, barStyle, { 
                top: containerTop, 
                right: `${rightW - 6}px`, 
                width: '12px', 
                height: containerHeight, 
                cursor: 'col-resize', 
                display: showRightHandle ? 'block' : 'none',
                borderLeft: '2px solid rgba(100, 120, 180, 0.4)',
                borderRight: '2px solid rgba(100, 120, 180, 0.4)',
                boxShadow: '0 0 8px rgba(0, 0, 0, 0.1)'
            });
            
            // Add hover effect
            this.rightSplitBar.onmouseenter = () => {
                this.rightSplitBar.style.background = 'rgba(100, 150, 255, 0.5)';
                this.rightSplitBar.style.borderLeftColor = 'rgba(100, 150, 255, 0.8)';
                this.rightSplitBar.style.borderRightColor = 'rgba(100, 150, 255, 0.8)';
            };
            this.rightSplitBar.onmouseleave = () => {
                if (!this.rightBarDrag) {
                    this.rightSplitBar.style.background = 'rgba(100, 120, 180, 0.25)';
                    this.rightSplitBar.style.borderLeftColor = 'rgba(100, 120, 180, 0.4)';
                    this.rightSplitBar.style.borderRightColor = 'rgba(100, 120, 180, 0.4)';
                }
            };
        }
        
        if (this.bottomSplitBar) {
            Object.assign(this.bottomSplitBar.style, barStyle, { 
                position: 'fixed', 
                bottom: `${bottomH - 6}px`, 
                left: '0', 
                width: '100vw', 
                height: '12px', 
                cursor: 'row-resize', 
                display: this.isSmallWindow ? 'none' : 'block',
                borderTop: '2px solid rgba(100, 120, 180, 0.4)',
                borderBottom: '2px solid rgba(100, 120, 180, 0.4)',
                boxShadow: '0 0 8px rgba(0, 0, 0, 0.1)'
            });
            
            // Add hover effect
            this.bottomSplitBar.onmouseenter = () => {
                this.bottomSplitBar.style.background = 'rgba(100, 150, 255, 0.5)';
                this.bottomSplitBar.style.borderTopColor = 'rgba(100, 150, 255, 0.8)';
                this.bottomSplitBar.style.borderBottomColor = 'rgba(100, 150, 255, 0.8)';
            };
            this.bottomSplitBar.onmouseleave = () => {
                if (!this.bottomBarDrag) {
                    this.bottomSplitBar.style.background = 'rgba(100, 120, 180, 0.25)';
                    this.bottomSplitBar.style.borderTopColor = 'rgba(100, 120, 180, 0.4)';
                    this.bottomSplitBar.style.borderBottomColor = 'rgba(100, 120, 180, 0.4)';
                }
            };
        }

        // BOTTOM BAR
        if (this.bottomBar) {
            Object.assign(this.bottomBar.style, {
                position: 'fixed', 
                bottom: '0', 
                left: '0', 
                width: '100vw', 
                height: `${bottomH}px`,
                zIndex: '500', 
                background: 'var(--body-bg)', 
                borderTop: '1px solid var(--border-color)',
                overflowY: 'auto'
            });
        }

        // TOGGLE BUTTONS
        if (this.leftSplitBarButton) {
            this.leftSplitBarButton.style.display = this.isSmallWindow ? 'none' : 'block';
            this.leftSplitBarButton.innerHTML = this.leftShut ? '→' : '←';
            this.leftSplitBarButton.title = this.leftShut ? 'Show Left Sidebar' : 'Hide Left Sidebar';
        }

        if (this.bottomSplitBarButton) {
            this.bottomSplitBarButton.innerHTML = this.bottomShut ? '↑' : '↓';
            this.bottomSplitBarButton.title = this.bottomShut ? 'Expand Bottom Bar' : 'Collapse Bottom Bar';
        }

        // Fix header visibility
        for (let col of this.tabCollections) {
            col.style.display = col.querySelectorAll('.nav-link').length > 0 ? '' : 'none';
        }

        // Save state
        localStorage.setItem('barspot_leftShut', this.leftShut);
        localStorage.setItem('barspot_rightShut', this.rightShut);
        localStorage.setItem('barspot_midForceToBottom', this.bottomShut);
        setCookie('barspot_pageBarTop', this.leftSectionBarPos, 365);
        setCookie('barspot_pageBarTop2', this.rightSectionBarPos, 365);
        setCookie('barspot_pageBarMidPx', this.bottomSectionBarPos, 365);
        setCookie('barspot_leftSplit', this.leftSidebarSplit, 365);
        setCookie('barspot_rightSplit', this.rightSidebarSplit, 365);
    }

    init() {
        console.log('GenTabLayout init() called');
        
        // Inject CSS first
        injectLayoutCSS();

        // 1. Fix Modals (Move them out of sidebars/containers)
        this.fixModals();

        this.populateTabContainers();
        
        for (let tab of this.managedTabs) {
            if (this.hideTabs.includes(tab.id)) tab.visible = false;
            tab.update();
        }

        // SETUP DRAGGING
        const startDrag = (e, type) => { 
            this[type] = true; 
            e.preventDefault();
            const cursor = (type === 'bottomBarDrag' ? 'row-resize' : 
                           (type === 'leftSplitDrag' || type === 'rightSplitDrag' ? 'row-resize' : 'col-resize'));
            document.body.style.cursor = cursor;
        };
        
        this.leftSplitBar?.addEventListener('mousedown', (e) => startDrag(e, 'leftBarDrag'));
        this.rightSplitBar?.addEventListener('mousedown', (e) => startDrag(e, 'rightBarDrag'));
        this.bottomSplitBar?.addEventListener('mousedown', (e) => {
            if (e.target != this.bottomSplitBarButton) startDrag(e, 'bottomBarDrag');
        });

        this.leftSidebarSplitBar?.addEventListener('mousedown', (e) => startDrag(e, 'leftSplitDrag'));
        this.rightSidebarSplitBar?.addEventListener('mousedown', (e) => startDrag(e, 'rightSplitDrag'));

        document.addEventListener('mousemove', (e) => {
            if (this.leftBarDrag) {
                this.leftSectionBarPos = Math.max(100, Math.min(e.pageX, window.innerWidth - 400));
                this.leftShut = false;
                this.reapplyPositions();
            }
            if (this.rightBarDrag) {
                const newWidth = window.innerWidth - e.pageX;
                this.rightSectionBarPos = Math.max(100, Math.min(newWidth, window.innerWidth - 400));
                this.rightShut = false;
                this.reapplyPositions();
            }
            if (this.bottomBarDrag) {
                this.bottomSectionBarPos = Math.max(100, Math.min(window.innerHeight - e.pageY, window.innerHeight - 100));
                this.bottomShut = false;
                this.reapplyPositions();
            }
            if (this.leftSplitDrag) {
                const rootTop = this.t2iRootDiv.getBoundingClientRect().top + window.scrollY;
                const bottomH = this.bottomShut ? (this.isSmallWindow ? 40 : 60) : this.bottomSectionBarPos;
                const containerHeightPx = window.innerHeight - rootTop - bottomH;
                const relativeY = e.pageY - rootTop;
                this.leftSidebarSplit = Math.max(0.2, Math.min(0.8, relativeY / containerHeightPx));
                this.reapplyPositions();
            }
            if (this.rightSplitDrag) {
                const rootTop = this.t2iRootDiv.getBoundingClientRect().top + window.scrollY;
                const bottomH = this.bottomShut ? (this.isSmallWindow ? 40 : 60) : this.bottomSectionBarPos;
                const containerHeightPx = window.innerHeight - rootTop - bottomH;
                const relativeY = e.pageY - rootTop;
                this.rightSidebarSplit = Math.max(0.2, Math.min(0.8, relativeY / containerHeightPx));
                this.reapplyPositions();
            }
        });

        document.addEventListener('mouseup', () => { 
            this.leftBarDrag = this.rightBarDrag = this.bottomBarDrag = false;
            this.leftSplitDrag = this.rightSplitDrag = false;
            document.body.style.cursor = 'default';
            if (this.leftSidebarSplitBar) this.leftSidebarSplitBar.style.background = 'transparent';
            if (this.rightSidebarSplitBar) this.rightSidebarSplitBar.style.background = 'transparent';
        });

        this.leftSplitBarButton?.addEventListener('click', () => { 
            this.leftShut = !this.leftShut;
            if (!this.leftShut && this.leftSectionBarPos <= 0) {
                this.leftSectionBarPos = 448;
            }
            this.reapplyPositions(); 
        });
        
        this.bottomSplitBarButton?.addEventListener('click', () => { 
            this.bottomShut = !this.bottomShut; 
            this.reapplyPositions(); 
        });

        // Add right sidebar toggle if missing
        if (this.currentImageBatch && !document.getElementById('t2i-right-split-quickbutton')) {
            const rightToggle = document.createElement('button');
            rightToggle.id = 't2i-right-split-quickbutton';
            rightToggle.innerHTML = this.rightShut ? '←' : '→';
            rightToggle.className = 'btn btn-sm btn-secondary';
            rightToggle.style.cssText = `
                position: fixed;
                top: 50%;
                right: 10px;
                z-index: 1002;
                transform: translateY(-50%);
                padding: 8px 12px;
                font-size: 18px;
            `;
            rightToggle.title = this.rightShut ? 'Show Right Sidebar' : 'Hide Right Sidebar';
            rightToggle.addEventListener('click', () => {
                this.rightShut = !this.rightShut;
                if (!this.rightShut && this.rightSectionBarPos <= 0) {
                    this.rightSectionBarPos = 336;
                }
                rightToggle.innerHTML = this.rightShut ? '←' : '→';
                rightToggle.title = this.rightShut ? 'Show Right Sidebar' : 'Hide Right Sidebar';
                this.reapplyPositions();
            });
            document.body.appendChild(rightToggle);
        }

        window.addEventListener('resize', () => {
            this.reapplyPositions();
        });

        this.promptMovable.update();
        if (this.metadataMovable) this.metadataMovable.update();
        this.reapplyPositions();
        this.buildConfigArea();

        console.log('GenTabLayout initialized:', {
            leftW: this.leftSectionBarPos,
            rightW: this.rightSectionBarPos,
            bottomH: this.bottomSectionBarPos
        });
    }

    buildConfigArea() {
        if (!this.layoutConfigArea) return;
        
        let selectOptions = [...this.tabCollections].map(e => 
            `<option value="${e.id}">${e.dataset.title || e.id}</option>`
        ).join('');
        
        let html = `
            <div class="p-3">
                <h5>Layout Engine</h5>
                <div class="mb-3">
                    <button class="btn btn-sm btn-info me-2" onclick="genTabLayout.resetSplits()">Reset Splits</button>
                    <button class="btn btn-sm btn-warning me-2" onclick="genTabLayout.resetSidebars()">Reset Sidebars</button>
                    <button class="btn btn-sm btn-danger" onclick="genTabLayout.resetLayout()">Hard Reset UI</button>
                </div>
                <table class="table table-sm table-bordered">
                    <thead>
                        <tr>
                            <th>Element</th>
                            <th>Location</th>
                            <th>Visible</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="table-info">
                            <td><b>Prompt Bar</b></td>
                            <td>
                                <select id="cfg_prompt_loc" class="form-select form-select-sm">
                                    <option value="Input-Sidebar-Main-Tab">Left Sidebar (Default)</option>
                                    <option value="Prompt-Tab">Bottom Bar</option>
                                    <option value="rightsidebarcontent">Right Sidebar</option>
                                </select>
                            </td>
                            <td>Always</td>
                        </tr>
                        <tr class="table-info">
                            <td><b>Image Metadata</b></td>
                            <td>
                                <select id="cfg_metadata_loc" class="form-select form-select-sm">
                                    <option value="Main-Image-Area">Main Image Area (Default)</option>
                                    <option value="Input-Sidebar-Main-Tab">Left Sidebar</option>
                                    <option value="Prompt-Tab">Bottom Bar</option>
                                    <option value="rightsidebarcontent">Right Sidebar</option>
                                </select>
                            </td>
                            <td>Always</td>
                        </tr>
                        `;
        
        for (let tab of this.managedTabs) {
            html += `
                <tr>
                    <td>${tab.title}</td>
                    <td>
                        <select id="cfg_tab_loc_${tab.id}" class="form-select form-select-sm">
                            ${selectOptions}
                        </select>
                    </td>
                    <td class="text-center">
                        <input type="checkbox" id="cfg_tab_vis_${tab.id}" ${tab.visible ? 'checked' : ''}>
                    </td>
                </tr>`;
        }
        
        html += `
                    </tbody>
                </table>
                <div class="mt-3">
                    <h6>Current Settings</h6>
                    <small>
                        Left: ${this.leftSectionBarPos}px | 
                        Right: ${this.rightSectionBarPos}px | 
                        Bottom: ${this.bottomSectionBarPos}px<br>
                        Left Split: ${(this.leftSidebarSplit * 100).toFixed(0)}% | 
                        Right Split: ${(this.rightSidebarSplit * 100).toFixed(0)}%
                    </small>
                </div>
            </div>`;
        
        this.layoutConfigArea.innerHTML = html;

        const promptLoc = document.getElementById('cfg_prompt_loc');
        if (promptLoc) {
            promptLoc.value = this.promptMovable.targetGroupId;
            promptLoc.onchange = (e) => { 
                this.promptMovable.targetGroupId = e.target.value; 
                this.promptMovable.update(); 
                this.reapplyPositions(); 
            };
        }

        const metaLoc = document.getElementById('cfg_metadata_loc');
        if (metaLoc && this.metadataMovable) {
            metaLoc.value = this.metadataMovable.targetGroupId;
            metaLoc.onchange = (e) => { 
                this.metadataMovable.targetGroupId = e.target.value; 
                this.metadataMovable.update(); 
                this.reapplyPositions(); 
            };
        }

        for (let tab of this.managedTabs) {
            const loc = document.getElementById(`cfg_tab_loc_${tab.id}`);
            if (loc) {
                loc.value = tab.targetGroupId;
                loc.onchange = (e) => { 
                    tab.targetGroupId = e.target.value; 
                    tab.update(); 
                    this.buildConfigArea(); 
                };
            }
            
            const vis = document.getElementById(`cfg_tab_vis_${tab.id}`);
            if (vis) {
                vis.onchange = (e) => { 
                    tab.visible = e.target.checked; 
                    tab.update(); 
                    this.rebuildVisibleCookie(); 
                    this.reapplyPositions(); 
                };
            }
        }
    }

    resetSplits() {
        if (confirm("Reset sidebar splits to 50/50?")) {
            this.leftSidebarSplit = 0.5;
            this.rightSidebarSplit = 0.5;
            this.reapplyPositions();
            this.buildConfigArea();
        }
    }

    resetSidebars() {
        if (confirm("Reset sidebar widths to defaults?")) {
            this.leftSectionBarPos = 448;
            this.rightSectionBarPos = 336;
            this.bottomSectionBarPos = 400;
            this.leftShut = false;
            this.rightShut = false;
            this.bottomShut = false;
            this.reapplyPositions();
            this.buildConfigArea();
        }
    }

    resetLayout() { 
        if (confirm("Reset entire layout? This will reload the page.")) { 
            localStorage.clear(); 
            const cookies = ['barspot_pageBarTop', 'barspot_pageBarTop2', 'barspot_pageBarMidPx', 
                           'barspot_leftSplit', 'barspot_rightSplit', 'layout_hidetabs', 
                           'tabloc_movable_metadata_region'];
            cookies.forEach(c => deleteCookie(c));
            location.reload(); 
        } 
    }

    rebuildVisibleCookie() { 
        setCookie('layout_hidetabs', this.managedTabs.filter(t => !t.visible).map(t => t.id).join(','), 365); 
    }
}

// ===== INITIALIZE =====
var genTabLayout = new GenTabLayout();

if (genTabLayout && !window.managedTabContainers) {
    window.managedTabContainers = genTabLayout.managedTabContainers || [];
}

setTimeout(() => {
    if (genTabLayout && typeof genTabLayout.init === 'function') {
        genTabLayout.init();
    }
}, 100)
