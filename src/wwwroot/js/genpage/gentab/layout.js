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

// ===== CSS INJECTION =====

function injectLayoutCSS() {
    if (document.getElementById('gen-tab-layout-css')) return;
    
    const style = document.createElement('style');
    style.id = 'gen-tab-layout-css';
    style.textContent = `
        /* Global wrapping for sidebars */
        #input_sidebar, #input_sidebar *, 
        #current_image_batch_wrapper, #current_image_batch_wrapper *,
        #alt_prompt_region, #alt_prompt_region * {
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            box-sizing: border-box !important;
        }

        /* Prevent horizontal scroll in sidebars */
        #input_sidebar .tab-content,
        #current_image_batch_wrapper .tab-content {
            overflow-x: hidden !important;
            overflow-y: auto !important;
            white-space: normal !important;
            width: 100% !important;
        }

        /* FIX: METADATA CONTAINER - Expand first, then scroll */
        #image_metadata_container, .current-image-data {
            width: 100% !important;
            max-width: 100% !important;
            white-space: normal !important;
            word-break: break-word !important;
            font-size: 11px !important;
            line-height: 1.2 !important;
            display: flex !important;
            flex-direction: column !important;
            overflow-y: auto !important; /* Scroll only if content exceeds available space */
            overflow-x: hidden !important;
        }
        
        /* Ensure metadata children don't crush themselves */
        #image_metadata_container > *,
        .current-image-data > * {
            flex-shrink: 0 !important;
            max-width: 100% !important;
        }

        /* Compact parameter display */
        .param_view_block {
            display: block !important;
            width: 100% !important;
            margin-bottom: 2px !important;
            border: 1px solid var(--light-border) !important;
            background: var(--background-soft) !important;
            overflow-wrap: break-word !important;
        }

        /* Center image area protection */
        .main-image-area { overflow-x: hidden !important; }

        /* Better scrollbars */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: var(--background); }
        ::-webkit-scrollbar-thumb { background: var(--light-border); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--emphasis); }
    `;
    document.head.appendChild(style);
}

// ===== MAIN LAYOUT CLASS - STREAMLINED =====

class GenTabLayout {
    constructor() {
        // SAFETY CONSTANTS - PREVENT "CRUSHING"
        this.HARD_MIN_SIDEBAR_W = 150;    // Minimum sidebar width
        this.HARD_MIN_BOTTOM_H = 100;     // Minimum bottom bar height when open
        this.CENTER_MIN_W = 300;          // Minimum center area width
        this.BOTTOM_NAV_HEIGHT = 38;      // Height when bottom bar is "shut" (just tabs visible)
        
        // Get DOM elements
        const get = (id) => document.getElementById(id);
        this.t2iRootDiv = get('Text2Image');
        this.leftSplitBar = get('t2i-top-split-bar');
        this.rightSplitBar = get('t2i-top-2nd-split-bar');
        this.bottomSplitBar = get('t2i-mid-split-bar');
        this.bottomSplitBarButton = get('t2i-mid-split-quickbutton');
        this.bottomBar = get('t2i_bottom_bar');
        this.inputSidebar = get('input_sidebar');
        this.mainImageArea = get('main_image_area');
        this.currentImageBatch = get('current_image_batch_wrapper');
        
        // State from storage
        this.leftShut = localStorage.getItem('barspot_leftShut') == 'true';
        this.rightShut = localStorage.getItem('barspot_rightShut') == 'true';
        this.bottomShut = localStorage.getItem('barspot_midForceToBottom') == 'true';
        
        // Persistent dimensions with defaults
        this.leftSectionBarPos = parseInt(getCookie('barspot_pageBarTop') || 448);
        this.rightSectionBarPos = parseInt(getCookie('barspot_pageBarTop2') || 336);
        this.bottomSectionBarPos = parseInt(getCookie('barspot_pageBarMidPx') || 400);
        
        // Dragging state
        this.dragging = null;
        
        this.init();
    }

    reapplyPositions() {
        if (!this.t2iRootDiv) return;
        
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const rootTop = this.t2iRootDiv.getBoundingClientRect().top + window.scrollY;

        // ===== FIX 1: BOTTOM BAR TRULY OPTIONAL =====
        // When bottomShut is true, bottom bar collapses to just tab navigation height
        // Center area expands to fill all available vertical space
        let bottomH = this.bottomShut ? this.BOTTOM_NAV_HEIGHT : 
                       Math.max(this.HARD_MIN_BOTTOM_H, Math.min(this.bottomSectionBarPos, winH - 200));

        // ===== FIX 2: PREVENT "CRUSHING" - SAFETY CHECKS =====
        // Ensure sidebars have minimum width
        let leftW = this.leftShut ? 0 : Math.max(this.HARD_MIN_SIDEBAR_W, this.leftSectionBarPos);
        let rightW = this.rightShut ? 0 : Math.max(this.HARD_MIN_SIDEBAR_W, this.rightSectionBarPos);

        // Prevent sidebars from crushing center area
        const availableW = winW - this.CENTER_MIN_W;
        if (leftW + rightW > availableW) {
            const overage = (leftW + rightW) - availableW;
            // Distribute reduction proportionally
            const leftRatio = leftW / (leftW + rightW);
            const rightRatio = rightW / (leftW + rightW);
            leftW -= overage * leftRatio;
            rightW -= overage * rightRatio;
            // Re-apply minimums after adjustment
            if (!this.leftShut) leftW = Math.max(this.HARD_MIN_SIDEBAR_W, leftW);
            if (!this.rightShut) rightW = Math.max(this.HARD_MIN_SIDEBAR_W, rightW);
        }

        const containerHeightPx = winH - rootTop - bottomH;
        const containerTop = `${rootTop}px`;

        // ===== CENTER IMAGE AREA (Expands when bottom bar is shut) =====
        if (this.mainImageArea) {
            Object.assign(this.mainImageArea.style, {
                position: 'absolute',
                top: containerTop,
                left: `${leftW}px`,
                width: `${winW - leftW - rightW}px`,
                height: `${containerHeightPx}px`,
                zIndex: '10',
                overflow: 'hidden',
                background: 'var(--body-bg)'
            });
        }

        // ===== SIDEBARS =====
        const sidebars = [
            { el: this.inputSidebar, w: leftW, shut: this.leftShut },
            { el: this.currentImageBatch, w: rightW, shut: this.rightShut }
        ];

        sidebars.forEach((sb, idx) => {
            if (!sb.el) return;
            Object.assign(sb.el.style, {
                position: 'absolute',
                top: containerTop,
                [idx === 0 ? 'left' : 'right']: '0',
                width: `${sb.w}px`,
                height: `${containerHeightPx}px`,
                display: sb.shut ? 'none' : 'flex',
                flexDirection: 'column',
                zIndex: '20',
                overflow: 'hidden',
                background: 'var(--bs-secondary-bg)'
            });
        });

        // ===== FIX 3: BOTTOM BAR WITH TRULY OPTIONAL HEIGHT =====
        if (this.bottomBar) {
            const hasVisibleContent = this.bottomBar.querySelectorAll('.tab-content.active, .nav-link.active').length > 0;
            
            Object.assign(this.bottomBar.style, {
                position: 'fixed',
                bottom: '0',
                left: '0',
                width: '100vw',
                height: `${bottomH}px`,
                zIndex: '500',
                background: 'var(--background-panel)',
                borderTop: '1px solid var(--light-border)',
                overflow: this.bottomShut ? 'hidden' : 'auto',
                // Hide completely if no content (not just collapsed)
                display: hasVisibleContent ? 'block' : 'none'
            });
        }

        // ===== FIX 4: BOTTOM SPLIT BAR POSITIONING =====
        if (this.bottomSplitBar) {
            // When bottom is shut, split bar sits just above the collapsed bar
            // When bottom has no content, hide it completely
            const bottomHasContent = this.bottomBar && this.bottomBar.style.display !== 'none';
            const splitBarBottom = bottomHasContent ? (bottomH - 4) : 0;
            
            Object.assign(this.bottomSplitBar.style, {
                position: 'fixed',
                bottom: `${splitBarBottom}px`,
                left: '0',
                width: '100vw',
                height: '8px',
                zIndex: '1005',
                cursor: 'row-resize',
                display: bottomHasContent ? 'block' : 'none',
                backgroundColor: 'var(--light-border)',
                opacity: '0.6',
                transition: 'opacity 0.2s'
            });

            // Hover effect for better visibility
            this.bottomSplitBar.onmouseenter = () => {
                this.bottomSplitBar.style.opacity = '1';
                this.bottomSplitBar.style.backgroundColor = 'var(--emphasis)';
            };
            this.bottomSplitBar.onmouseleave = () => {
                if (this.dragging !== 'bottom') {
                    this.bottomSplitBar.style.opacity = '0.6';
                    this.bottomSplitBar.style.backgroundColor = 'var(--light-border)';
                }
            };
        }

        // ===== SIDE SPLIT BARS =====
        const splitBars = [
            { el: this.leftSplitBar, pos: leftW, shut: this.leftShut },
            { el: this.rightSplitBar, pos: rightW, shut: this.rightShut }
        ];

        splitBars.forEach((bar, idx) => {
            if (!bar.el) return;
            Object.assign(bar.el.style, {
                position: 'absolute',
                top: containerTop,
                [idx === 0 ? 'left' : 'right']: `${bar.pos - 4}px`,
                width: '8px',
                height: `${containerHeightPx}px`,
                cursor: 'col-resize',
                display: bar.shut ? 'none' : 'block',
                zIndex: '1000',
                backgroundColor: 'var(--light-border)',
                opacity: '0.6',
                transition: 'opacity 0.2s'
            });

            // Hover effect
            bar.el.onmouseenter = () => {
                bar.el.style.opacity = '1';
                bar.el.style.backgroundColor = 'var(--emphasis)';
            };
            bar.el.onmouseleave = () => {
                if (this.dragging !== (idx === 0 ? 'left' : 'right')) {
                    bar.el.style.opacity = '0.6';
                    bar.el.style.backgroundColor = 'var(--light-border)';
                }
            };
        });

        // ===== UPDATE TOGGLE BUTTON =====
        if (this.bottomSplitBarButton) {
            this.bottomSplitBarButton.innerHTML = this.bottomShut ? '▲' : '▼';
            this.bottomSplitBarButton.title = this.bottomShut ? 'Expand Bottom Bar' : 'Collapse Bottom Bar';
        }

        // ===== PERSIST STATE =====
        localStorage.setItem('barspot_leftShut', this.leftShut);
        localStorage.setItem('barspot_rightShut', this.rightShut);
        localStorage.setItem('barspot_midForceToBottom', this.bottomShut);
        setCookie('barspot_pageBarTop', leftW, 365);
        setCookie('barspot_pageBarTop2', rightW, 365);
        setCookie('barspot_pageBarMidPx', this.bottomSectionBarPos, 365);
    }

    init() {
        injectLayoutCSS();

        // ===== DRAG SETUP WITH SAFETY CHECKS =====
        const setupDrag = (bar, type) => {
            if (!bar) return;
            bar.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('t2i-split-quickbutton')) return;
                this.dragging = type;
                document.body.style.cursor = type === 'bottom' ? 'row-resize' : 'col-resize';
                e.preventDefault();
            });
        };

        setupDrag(this.leftSplitBar, 'left');
        setupDrag(this.rightSplitBar, 'right');
        setupDrag(this.bottomSplitBar, 'bottom');

        document.addEventListener('mousemove', (e) => {
            if (!this.dragging) return;

            const winW = window.innerWidth;
            const winH = window.innerHeight;

            switch (this.dragging) {
                case 'left':
                    // SAFETY: Prevent dragging too far left/right
                    const minLeft = this.HARD_MIN_SIDEBAR_W;
                    const maxLeft = winW - this.HARD_MIN_SIDEBAR_W - this.CENTER_MIN_W;
                    this.leftSectionBarPos = Math.max(minLeft, Math.min(e.pageX, maxLeft));
                    this.leftShut = false;
                    break;
                    
                case 'right':
                    // SAFETY: Prevent dragging too far left/right
                    const minRight = this.HARD_MIN_SIDEBAR_W;
                    const maxRight = winW - this.HARD_MIN_SIDEBAR_W - this.CENTER_MIN_W;
                    const newRightWidth = winW - e.pageX;
                    this.rightSectionBarPos = Math.max(minRight, Math.min(newRightWidth, maxRight));
                    this.rightShut = false;
                    break;
                    
                case 'bottom':
                    // SAFETY: Prevent dragging too high/low
                    const minBottom = this.HARD_MIN_BOTTOM_H;
                    const maxBottom = winH - 100; // Leave room for top bar
                    const newBottomHeight = winH - e.pageY;
                    this.bottomSectionBarPos = Math.max(minBottom, Math.min(newBottomHeight, maxBottom));
                    this.bottomShut = false;
                    break;
            }
            
            this.reapplyPositions();
        });

        document.addEventListener('mouseup', () => {
            this.dragging = null;
            document.body.style.cursor = 'default';
            
            // Reset split bar styles
            [this.leftSplitBar, this.rightSplitBar, this.bottomSplitBar].forEach(bar => {
                if (bar) {
                    bar.style.opacity = '0.6';
                    bar.style.backgroundColor = 'var(--light-border)';
                }
            });
        });

        // ===== BOTTOM BAR TOGGLE =====
        this.bottomSplitBarButton?.addEventListener('click', (e) => {
            this.bottomShut = !this.bottomShut;
            this.reapplyPositions();
            e.stopPropagation();
        });

        // ===== WINDOW RESIZE HANDLING =====
        window.addEventListener('resize', () => this.reapplyPositions());
        
        // Initial layout application
        this.reapplyPositions();
    }

    resetLayout() {
        if (confirm("Clear layout settings and reload?")) {
            localStorage.clear();
            deleteCookie('barspot_pageBarTop');
            deleteCookie('barspot_pageBarTop2');
            deleteCookie('barspot_pageBarMidPx');
            location.reload();
        }
    }
}

// ===== GLOBAL INITIALIZATION =====
var genTabLayout = new GenTabLayout();
