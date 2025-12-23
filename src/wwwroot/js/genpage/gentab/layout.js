// ===== HELPER FUNCTIONS =====

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

// ========================================
// LAYOUT ENGINE
// ========================================

function injectLayoutCSS() {
    if (document.getElementById('gen-tab-layout-css')) return;

    const style = document.createElement('style');
    style.id = 'gen-tab-layout-css';
    style.textContent = `
        :root {
            --sidebar-left-width: 28rem;
            --sidebar-right-width: 21rem;
            --footer-height: 0px;
        }

        /* Flexbox Container */
        .t2i-top-bar {
            display: flex !important;
            flex-direction: row !important;
            width: 100vw !important;
            height: calc(100vh - var(--footer-height)) !important;
            overflow: hidden !important;
            position: relative !important;
        }

        /* Sidebars */
        .input-sidebar {
            flex: 0 0 var(--sidebar-left-width) !important;
            width: var(--sidebar-left-width) !important;
            max-width: 80vw;
            display: flex !important;
            flex-direction: column !important;
            border-right: 1px solid var(--border-color, #444);
            transition: flex-basis 0.05s linear;
            background: var(--background-panel);
            z-index: 20;
        }
        
        .input-sidebar.collapsed {
            display: none !important;
        }

        .current_image_batch {
            flex: 0 0 var(--sidebar-right-width) !important;
            width: var(--sidebar-right-width) !important;
            max-width: 80vw;
            display: flex !important;
            flex-direction: column !important;
            border-left: 1px solid var(--border-color, #444);
            transition: flex-basis 0.05s linear;
            background: var(--background-panel);
            z-index: 20;
        }

        .current_image_batch.collapsed {
            display: none !important;
        }

        /* Splitters */
        .t2i-top-split-bar, .t2i-top-2nd-split-bar {
            flex: 0 0 5px !important;
            width: 5px !important;
            cursor: col-resize !important;
            background-color: var(--background-soft, #222);
            border: 1px solid var(--border-color, #444);
            z-index: 25;
            user-select: none;
        }
        .t2i-top-split-bar:hover, .t2i-top-2nd-split-bar:hover {
            background-color: var(--emphasis, #007bff);
        }

        /* Main Area */
        .main-image-area {
            flex: 1 1 0 !important;
            min-width: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            position: relative !important;
            height: 100% !important;
            background-color: var(--background, #111);
            z-index: 10;
        }
    `;
    document.head.appendChild(style);
}

class GenTabLayout {
    constructor() {
        // Core Elements
        this.t2iRootDiv = document.getElementById('t2i_top_bar');
        this.inputSidebar = document.getElementById('input_sidebar');
        this.mainImageArea = document.getElementById('main_image_area');
        this.batchSidebar = document.getElementById('current_image_batch_wrapper');
        
        // Splitters
        this.leftSplitter = document.getElementById('t2i-top-split-bar');
        this.rightSplitter = document.getElementById('t2i-top-2nd-split-bar');

        // State defaults
        this.leftWidth = parseInt(getCookie('layout_left_width') || 448);
        this.rightWidth = parseInt(getCookie('layout_right_width') || 336);
        this.leftSidebarSplit = parseFloat(getCookie('barspot_leftSplit') || 0.5);
        this.rightSidebarSplit = parseFloat(getCookie('barspot_rightSplit') || 0.5);
        
        // Visibility Flags
        this.leftShut = localStorage.getItem('barspot_leftShut') === 'true';
        this.rightShut = localStorage.getItem('barspot_rightShut') === 'true';
        this.bottomShut = false; // Simplified for now
    }

    init() {
        console.log('GenTabLayout init() starting...');
        
        // 1. Inject CSS
        injectLayoutCSS();

        // 2. Fix Modal placements
        this.fixModals();

        // 3. Setup Internal Vertical Splitters
        this.createSidebarSplitBars();

        // 4. Setup Drag Handlers
        this.setupMainDrag();
        this.setupVerticalDrag();

        // 5. Apply Initial State
        this.reapplyPositions();

        // 6. Listen for Resize
        window.addEventListener('resize', () => this.reapplyPositions());
        
        console.log('GenTabLayout init() complete.');
    }

    setupMainDrag() {
        // Generic handler for horizontal splitters
        const handleDrag = (splitter, isLeft) => {
            if (!splitter) return;
            
            let isDragging = false;
            
            splitter.addEventListener('mousedown', (e) => {
                isDragging = true;
                e.preventDefault();
                document.body.style.cursor = 'col-resize';
                document.body.classList.add('user-select-none');
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                
                if (isLeft) {
                    let newW = e.clientX;
                    newW = Math.max(50, Math.min(newW, window.innerWidth * 0.7));
                    this.leftWidth = newW;
                    document.documentElement.style.setProperty('--sidebar-left-width', `${newW}px`);
                } else {
                    let newW = window.innerWidth - e.clientX;
                    newW = Math.max(50, Math.min(newW, window.innerWidth * 0.7));
                    this.rightWidth = newW;
                    document.documentElement.style.setProperty('--sidebar-right-width', `${newW}px`);
                }
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    document.body.style.cursor = '';
                    document.body.classList.remove('user-select-none');
                    setCookie('layout_left_width', this.leftWidth, 365);
                    setCookie('layout_right_width', this.rightWidth, 365);
                }
            });
        };

        handleDrag(this.leftSplitter, true);
        handleDrag(this.rightSplitter, false);
        
        // Quick Toggles
        const leftToggle = document.getElementById('t2i-top-split-quickbutton');
        if (leftToggle) {
            leftToggle.onclick = () => {
                this.leftShut = !this.leftShut;
                this.reapplyPositions();
            };
        }
    }

    createSidebarSplitBars() {
        // Create the draggable bars that sit inside the sidebars
        const createBar = (id) => {
            if (document.getElementById(id)) return document.getElementById(id);
            const bar = document.createElement('div');
            bar.id = id;
            bar.style.cssText = `
                position: absolute; left: 0; width: 100%; height: 10px;
                cursor: row-resize; z-index: 100; background: transparent;
                display: none;
            `;
            // Hover effect for visibility
            bar.addEventListener('mouseenter', () => bar.style.background = 'rgba(100, 150, 255, 0.2)');
            bar.addEventListener('mouseleave', () => bar.style.background = 'transparent');
            document.body.appendChild(bar);
            return bar;
        };

        this.leftSidebarSplitBar = createBar('left-sidebar-split-bar');
        this.rightSidebarSplitBar = createBar('right-sidebar-split-bar');
    }

    setupVerticalDrag() {
        // Logic for resizing the Top vs Bottom tabs inside a sidebar
        let activeSplit = null; // 'left' or 'right'

        const startDrag = (e, side) => {
            activeSplit = side;
            e.preventDefault();
            document.body.style.cursor = 'row-resize';
        };

        if (this.leftSidebarSplitBar) {
            this.leftSidebarSplitBar.addEventListener('mousedown', (e) => startDrag(e, 'left'));
        }
        if (this.rightSidebarSplitBar) {
            this.rightSidebarSplitBar.addEventListener('mousedown', (e) => startDrag(e, 'right'));
        }

        document.addEventListener('mousemove', (e) => {
            if (!activeSplit) return;

            const rootRect = t2iRootDiv.getBoundingClientRect();
            // Relative Y inside the main container
            const relY = e.clientY - rootRect.top;
            const totalH = rootRect.height;
            
            // Calculate percentage
            let pct = relY / totalH;
            pct = Math.max(0.1, Math.min(0.9, pct));

            if (activeSplit === 'left') {
                this.leftSidebarSplit = pct;
            } else {
                this.rightSidebarSplit = pct;
            }
            
            this.reapplyPositions();
        });

        document.addEventListener('mouseup', () => {
            if (activeSplit) {
                setCookie('barspot_leftSplit', this.leftSidebarSplit, 365);
                setCookie('barspot_rightSplit', this.rightSidebarSplit, 365);
                activeSplit = null;
                document.body.style.cursor = '';
            }
        });
    }

    reapplyPositions() {
        // 1. Apply Widths to CSS Variables
        if (this.leftShut) {
            document.documentElement.style.setProperty('--sidebar-left-width', '0px');
            if (this.inputSidebar) this.inputSidebar.classList.add('collapsed');
        } else {
            document.documentElement.style.setProperty('--sidebar-left-width', `${this.leftWidth}px`);
            if (this.inputSidebar) this.inputSidebar.classList.remove('collapsed');
        }

        if (this.rightShut) {
            document.documentElement.style.setProperty('--sidebar-right-width', '0px');
            if (this.batchSidebar) this.batchSidebar.classList.add('collapsed');
        } else {
            document.documentElement.style.setProperty('--sidebar-right-width', `${this.rightWidth}px`);
            if (this.batchSidebar) this.batchSidebar.classList.remove('collapsed');
        }

        // Save State
        localStorage.setItem('barspot_leftShut', this.leftShut);
        localStorage.setItem('barspot_rightShut', this.rightShut);

        // 2. Handle Vertical Splits (Inputs vs History/etc)
        this.updateVerticalSplit(
            this.inputSidebar, 
            this.leftSidebarSplit, 
            this.leftSidebarSplitBar,
            !this.leftShut
        );
        
        this.updateVerticalSplit(
            this.batchSidebar, 
            this.rightSidebarSplit, 
            this.rightSidebarSplitBar,
            !this.rightShut
        );
    }

    updateVerticalSplit(sidebar, splitPct, dragBar, isVisible) {
        if (!sidebar || !isVisible) {
            if (dragBar) dragBar.style.display = 'none';
            return;
        }

        // Find the top and bottom sections
        const topSection = sidebar.querySelector('.sidebar-top-section');
        const bottomSection = sidebar.querySelector('.sidebar-bottom-section');
        
        // Only split if both sections exist and the bottom one has content (tabs)
        const hasBottomContent = bottomSection && bottomSection.querySelector('.nav-link');
        
        if (topSection && bottomSection && hasBottomContent) {
            const totalH = this.t2iRootDiv.clientHeight;
            const topH = Math.floor(totalH * splitPct);
            const botH = totalH - topH - 5; // 5px for splitter

            topSection.style.flex = 'none';
            topSection.style.height = `${topH}px`;
            
            bottomSection.style.flex = 'none';
            bottomSection.style.height = `${botH}px`;
            bottomSection.style.display = 'flex';

            // Position the drag bar
            if (dragBar) {
                const sidebarRect = sidebar.getBoundingClientRect();
                dragBar.style.display = 'block';
                dragBar.style.width = `${sidebarRect.width}px`;
                dragBar.style.left = `${sidebarRect.left}px`;
                dragBar.style.top = `${sidebarRect.top + topH}px`;
            }
        } else {
            // No split needed
            if (topSection) {
                topSection.style.flex = '1 1 100%';
                topSection.style.height = '100%';
            }
            if (bottomSection) bottomSection.style.display = 'none';
            if (dragBar) dragBar.style.display = 'none';
        }
    }

    fixModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (modal.parentElement !== document.body) {
                document.body.appendChild(modal);
            }
        });
    }

    altPromptSizeHandle() {
        // Compatibility stub
        this.reapplyPositions();
    }
}

// ===== INITIALIZE =====
var genTabLayout = new GenTabLayout();

// Fallback if main.js calls it early
if (!window.managedTabContainers) {
    window.managedTabContainers = [];
}