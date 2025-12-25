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
// FILE 1: layout.js - CSS Injection Function
// ========================================

function injectLayoutCSS() {
    if (document.getElementById('gen-tab-layout-css')) return;
    
    const style = document.createElement('style');
    style.id = 'gen-tab-layout-css';
    style.textContent = `
        /* GLOBAL: Force wrapping and sizing in Sidebars */
        #input_sidebar, #input_sidebar *, 
        #current_image_batch_wrapper, #current_image_batch_wrapper *,
        #alt_prompt_region, #alt_prompt_region * {
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            box-sizing: border-box !important;
        }

        #input_sidebar input, #input_sidebar textarea, #input_sidebar select,
        #current_image_batch_wrapper input, #current_image_batch_wrapper textarea, #current_image_batch_wrapper select,
        #alt_prompt_region input, #alt_prompt_region textarea, #alt_prompt_region select {
            max-width: 100% !important;
        }

        /* FIX: PROMPT BOX COLOR (Use Theme Variables) */
        #alt_prompt_region textarea {
            background-color: var(--input-bg, var(--background-soft, #1a1a1a)) !important;
            color: var(--text-color, var(--text, #ffffff)) !important;
            border: 1px solid var(--border-color, var(--light-border, #666)) !important;
            white-space: pre-wrap !important;
        }
        #alt_prompt_region {
            background-color: transparent !important;
        }

        /* COMPACT PADDING */
        #input_sidebar .card-body, #current_image_batch_wrapper .card-body {
            padding: 4px !important;
        }
        #input_sidebar .form-group, #current_image_batch_wrapper .form-group {
            margin-bottom: 4px !important;
        }
        .nav-tabs .nav-link {
            padding: 4px 8px !important;
            font-size: 0.85rem !important;
        }

        /* PREVENT HORIZONTAL SCROLL */
        #input_sidebar .tab-content,
        #current_image_batch_wrapper .tab-content {
            overflow-x: hidden !important;
            overflow-y: auto !important;
            white-space: normal !important;
            width: 100% !important;
            padding: 2px !important;
        }

        /* FIX: COMPACT TREE VIEW (Match History Size) */
        #current_image_batch_wrapper .jstree-node, 
        #current_image_batch_wrapper .jstree-anchor,
        #current_image_batch_wrapper .browser-folder-tree-part {
            font-size: 11px !important;
            line-height: 1.1 !important;
            min-height: 16px !important;
            white-space: nowrap !important;
        }
        
        #current_image_batch_wrapper .jstree-anchor {
            padding: 1px 2px !important;
            height: auto !important;
        }
        
        #current_image_batch_wrapper .jstree-icon {
            background-size: 16px !important;
            width: 16px !important;
            height: 16px !important;
        }

        /* FIX: Better Scrollbars */
        #current_image_batch_wrapper .browser-folder-tree-container::-webkit-scrollbar {
            width: 8px;
        }
        #current_image_batch_wrapper .browser-folder-tree-container::-webkit-scrollbar-track {
            background: var(--background, #1a1a1a);
        }
        #current_image_batch_wrapper .browser-folder-tree-container::-webkit-scrollbar-thumb {
            background: var(--border-color, #666);
            border-radius: 4px;
        }
        #current_image_batch_wrapper .browser-folder-tree-container::-webkit-scrollbar-thumb:hover {
            background: var(--emphasis, #4a9eff);
        }
        #current_image_batch_wrapper .browser-folder-tree-container {
            scrollbar-width: thin;
            scrollbar-color: var(--border-color, #666) var(--background, #1a1a1a);
        }

        /* LORA WRAPPING */
        .lora-tab-content {
            height: auto !important;
            min-height: 0 !important;
            flex-grow: 1 !important;
            display: flex !important;
            flex-direction: column !important;
        }
        .lora-chip-container {
            display: flex !important;
            flex-wrap: wrap !important;
            width: 100% !important;
            gap: 2px !important;
        }
        .lora-chip {
            white-space: normal !important;
            word-break: break-word !important;
            height: auto !important;
            max-width: 100% !important;
            font-size: 0.8rem !important;
            margin: 0 !important;
            padding: 2px 4px !important;
        }

        /* SELECTOR VISIBILITY */
        #current_image_batch_wrapper select, 
        #current_image_batch_wrapper .form-select,
        .image-batch-view-select {
            background-color: var(--input-bg, #1a1a1a) !important;
            color: var(--text-color, #ffffff) !important;
            border: 1px solid var(--border-color, #666) !important;
            opacity: 1 !important;
            font-weight: 600 !important;
            padding: 2px 4px !important;
            height: auto !important;
            min-height: 28px !important;
        }
        #current_image_batch_wrapper select option {
            background-color: var(--input-bg, #1a1a1a) !important;
            color: var(--text-color, #ffffff) !important;
        }

        /* BROWSER CONTENT GRID */
        .browser-content-container {
            display: flex !important;
            flex-wrap: wrap !important;
            width: 100% !important;
            align-content: flex-start !important;
        }
        .model-block, .image-block, .browser-list-entry {
            max-width: 100% !important;
        }

        /* CENTER IMAGE SIZING */
        #main_image_area .current_image_wrapbox {
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            max-height: 100% !important;
            overflow: auto !important;
        }
        #main_image_area .current_image {
            width: 100% !important;
            height: 100% !important;
            display: flex !important;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            border: none !important;
        }
        .current-image-img {
            max-width: 100% !important;
            max-height: 100% !important;
            object-fit: contain !important;
            width: auto !important;
            height: auto !important;
        }
    `;
    document.head.appendChild(style);
}

// ===== MOVABLE TAB CLASS =====

class MovableGenTab {
    constructor(navLink, handler) {
        this.handler = handler;
        this.navElem = navLink;
        this.id = this.navElem.getAttribute('href').substring(1);
        this.contentElem = getRequiredElementById(this.id);
        this.title = this.navElem.innerText;
        this.defaultGroup = findParentOfClass(this.navElem, 'swarm-gen-tab-subnav');
        this.currentGroup = this.defaultGroup;
        this.targetGroupId = getCookie(`tabloc_${this.id}`) || this.defaultGroup.id;
        this.visible = true;
        this.navElem.removeAttribute('data-bs-toggle');
        this.navElem.addEventListener('click', this.clickOn.bind(this));
    }

    clickOn(e) {
        e.preventDefault();
        this.setSelected();
        for (let tab of this.handler.managedTabs.filter(t => t.currentGroup.id == this.currentGroup.id && t.id != this.id)) {
            tab.setNotSelected();
        }
        setTimeout(() => {
            this.handler.reapplyPositions();
        }, 1);
    }

    setNotSelected() {
        this.navElem.classList.remove('active');
        this.contentElem.classList.remove('active');
        this.contentElem.classList.remove('show');
    }

    setSelected() {
        this.navElem.classList.add('active');
        this.contentElem.classList.add('active');
        this.contentElem.classList.add('show');
    }

    clickOther() {
        let nextTab = this.navElem.parentElement.nextElementSibling || this.navElem.parentElement.previousElementSibling;
        if (nextTab) {
            nextTab.querySelector('.nav-link').click();
        }
    }

    update() {
        if (this.targetGroupId != this.currentGroup.id) {
            if (this.visible && this.navElem.classList.contains('active')) {
                this.clickOther();
                this.setNotSelected();
            }
            this.currentGroup = getRequiredElementById(this.targetGroupId);
            this.currentGroup.appendChild(this.navElem.parentElement);
            let newContentContainer = getRequiredElementById(this.currentGroup.dataset.content);
            newContentContainer.appendChild(this.contentElem);
            if (this.visible && [...this.currentGroup.querySelectorAll('.nav-link')].length == 1) {
                this.navElem.click();
            }
        }
        if (this.targetGroupId != this.defaultGroup.id) {
            setCookie(`tabloc_${this.id}`, this.targetGroupId, 365);
        }
        else {
            deleteCookie(`tabloc_${this.id}`);
        }
        if (!this.visible && this.navElem.classList.contains('active')) {
            this.clickOther();
            this.setNotSelected();
        }
        this.navElem.style.display = this.visible ? '' : 'none';
        this.contentElem.style.display = this.visible ? '' : 'none';
    }
}

// ===== MAIN LAYOUT CLASS =====

class GenTabLayout {
    constructor() {
        this.managedTabContainers = [];
        this.managedTabs = [];
        this.layoutResets = [];

        const get = (id) => document.getElementById(id);

        this.t2iRootDiv = get('Text2Image');
        this.leftSplitBar = get('t2i-top-split-bar');
        this.rightSplitBar = get('t2i-top-2nd-split-bar');
        this.leftSplitBarButton = get('t2i-top-split-quickbutton');
        this.bottomSplitBar = get('t2i-mid-split-bar');
        this.bottomSplitBarButton = get('t2i-mid-split-quickbutton');
        this.bottomBar = get('t2i_bottom_bar');
        this.inputSidebar = get('input_sidebar');
        this.mainImageArea = get('main_image_area');
        this.currentImageBatch = get('current_image_batch_wrapper');
        this.altRegion = get('alt_prompt_region');
        this.layoutConfigArea = get('layoutconfigarea');
        this.tabCollections = document.querySelectorAll('.swarm-gen-tab-subnav');

        this.antiDup = false;
        this.leftShut = localStorage.getItem('barspot_leftShut') == 'true';
        this.rightShut = localStorage.getItem('barspot_rightShut') == 'true';
        this.bottomShut = localStorage.getItem('barspot_midForceToBottom') == 'true';
        
        const leftCookie = getCookie('barspot_pageBarTop');
        const rightCookie = getCookie('barspot_pageBarTop2');
        const bottomCookie = getCookie('barspot_pageBarMidPx');
        const leftSplitCookie = getCookie('barspot_leftSplit');
        const rightSplitCookie = getCookie('barspot_rightSplit');
        
        this.leftSectionBarPos = leftCookie ? parseInt(leftCookie) : 448;
        this.rightSectionBarPos = rightCookie ? parseInt(rightCookie) : 336;
        this.bottomSectionBarPos = bottomCookie ? parseInt(bottomCookie) : 400;
        this.leftSidebarSplit = leftSplitCookie ? parseFloat(leftSplitCookie) : 0.5;
        this.rightSidebarSplit = rightSplitCookie ? parseFloat(rightSplitCookie) : 0.5;
        
        this.mobileDesktopLayout = localStorage.getItem('layout_mobileDesktop') || 'auto';
        this.hideTabs = (getCookie('layout_hidetabs') || '').split(',').filter(x => x);

        this.leftBarDrag = false;
        this.rightBarDrag = false;
        this.bottomBarDrag = false;
        this.leftSplitDrag = false;
        this.rightSplitDrag = false;

        let currentPromptLoc = getCookie('tabloc_alt_prompt_region') || 'Prompt-Tab';
        if (currentPromptLoc === 'Input-Sidebar-Main-Tab') {
            currentPromptLoc = 'Prompt-Tab';
        }

        this.promptMovable = {
            id: 'alt_prompt_region',
            title: 'Prompt & Generate',
            targetGroupId: currentPromptLoc,
            update: () => {
                let target = getRequiredElementById(this.promptMovable.targetGroupId);
                if (target && this.altRegion && this.altRegion.parentElement != target) {
                    target.appendChild(this.altRegion);
                    this.altRegion.style.position = 'relative';
                    this.altRegion.style.width = '100%';
                    this.altRegion.style.maxWidth = '100%';
                    this.altRegion.style.boxSizing = 'border-box';
                    this.altRegion.style.wordWrap = 'break-word';
                    this.altRegion.style.overflowWrap = 'break-word';
                    
                    const promptChildren = this.altRegion.querySelectorAll('*');
                    promptChildren.forEach(child => {
                        if (child.style) {
                            child.style.wordWrap = 'break-word';
                            child.style.overflowWrap = 'break-word';
                            child.style.maxWidth = '100%';
                            child.style.boxSizing = 'border-box';
                        }
                    });
                    
                    setCookie('tabloc_alt_prompt_region', this.promptMovable.targetGroupId, 365);
                }
            }
        };

        this.managedTabs = [...this.tabCollections].flatMap(e => [...e.querySelectorAll('.nav-link')]).map(e => new MovableGenTab(e, this));
        
        this.isSmallWindow = this.mobileDesktopLayout == 'auto' ? window.innerWidth < 768 : this.mobileDesktopLayout == 'mobile';

        this.createSidebarSplitBars();
        
        console.log('GenTabLayout constructed with:', {
            left: this.leftSectionBarPos,
            right: this.rightSectionBarPos,
            bottom: this.bottomSectionBarPos
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
                        </tr>`;
        
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
                           'barspot_leftSplit', 'barspot_rightSplit', 'layout_hidetabs'];
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
}, 100);
