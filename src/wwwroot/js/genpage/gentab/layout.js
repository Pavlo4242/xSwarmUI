
// ===== UTILITY FUNCTIONS (Mocked or External) =====
// Ensure these exist or are mocked to prevent ReferenceErrors
//function fixTabHeights() {}
//function tweakNegativePromptBox() {}
//function dynamicSizeTextBox(elem) {}
//function alignImageDataFormat() {}
//function internalSiteJsGetUserSetting() { return true; }
//function getParamMemoryDays() { return 30; }
//function escapeHtml(text) {
//    if (!text) return text;
 //   return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
//}
//const browserUtil = { makeVisible: function() {} };


// Replace lines 1-36 (Helper Functions) with:
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

/** * Safely gets an element by ID. Returns null if missing, preventing crashes.
 */
function getRequiredElementById(id) {
    const elem = document.getElementById(id);
    if (!elem) {
        console.warn(`Layout Element not found: ${id} - This feature may be disabled.`);
        return null;
    }
    return elem;
}

function findParentOfClass(element, className) {
    while (element && element !== document) {
        if (element.classList && element.classList.contains(className)) {
            return element;
        }
        element = element.parentNode;
    }
    return null;
}

function triggerChangeFor(element) {
    if (element) {
        element.dispatchEvent(new Event('change'));
    }
}

// ===== UTILITY FUNCTIONS (Mocked or External) =====
// Ensure these exist or are mocked to prevent ReferenceErrors
// ========================================
// FILE 1: layout.js - Replace injectLayoutCSS function ONLY
// ========================================

function injectLayoutCSS() {
    if (document.getElementById('gen-tab-layout-css')) return;
    
    const style = document.createElement('style');
    style.id = 'gen-tab-layout-css';
    style.textContent = `
        /* GLOBAL: Force wrapping and sizing in Sidebars - EXCLUDING MODALS */
        #input_sidebar :not(.modal):not(.modal *), 
        #current_image_batch_wrapper :not(.modal):not(.modal *),
        #alt_prompt_region :not(.modal):not(.modal *),
        #movable_metadata_region :not(.modal):not(.modal *) {
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

        /* CENTER IMAGE SIZING & METADATA FIXES */
        #main_image_area .current_image_wrapbox {
            width: 100% !important;
            height: 100% !important;
            overflow: auto !important; /* Allow scrolling for buttons/metadata */
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        
        #main_image_area .current_image {
            width: 100% !important;
            min-height: auto !important;
            flex-grow: 1;
            display: flex !important;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            border: none !important;
        }

        .current-image-img {
            max-width: 100% !important;
            max-height: 80vh !important; /* Limit image height so buttons are visible */
            object-fit: contain !important;
            width: auto !important;
            height: auto !important;
            flex-shrink: 1;
        }
        
        /* Force metadata/buttons wrapper to be visible */
        #movable_metadata_region {
            display: block !important;
            width: 100% !important;
            margin-top: 10px;
            flex-shrink: 0;
            padding: 10px;
            background: var(--background-soft);
            border-top: 1px solid var(--border-color);
        }
        
        /* Style when in main area */
        #main_image_area #movable_metadata_region {
             max-width: 900px;
             border: none;
             background: transparent;
        }
    `;
    document.head.appendChild(style);
}




// Replace the entire MovableGenTab class (lines 243-317) with:
/** Data about a tab within the Generate UI that can be moved to different containers. */
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
        // Filter out this tab and set others to not selected
        for (let tab of this.handler.managedTabs.filter(t => t.currentGroup && t.currentGroup.id == this.currentGroup.id && t.id != this.id)) {
            tab.setNotSelected();
        }
        setTimeout(() => {
            this.handler.reapplyPositions();
        }, 1);
    }

    setNotSelected() {
        this.navElem.classList.remove('active');
        if (this.contentElem) {
            this.contentElem.classList.remove('active');
            this.contentElem.classList.remove('show');
        }
    }

    setSelected() {
        this.navElem.classList.add('active');
        if (this.contentElem) {
            this.contentElem.classList.add('active');
            this.contentElem.classList.add('show');
        }
    }

    clickOther() {
        if (!this.navElem.parentElement) return;
        let nextTab = this.navElem.parentElement.nextElementSibling || this.navElem.parentElement.previousElementSibling;
        if (nextTab) {
            let link = nextTab.querySelector('.nav-link');
            if (link) link.click();
        }
    }

    update() {
        // Validation: If the target group doesn't exist (e.g., ID changed in HTML), reset to default
        let potentialGroup = getRequiredElementById(this.targetGroupId);
        if (!potentialGroup) {
            console.log(`Resetting tab ${this.id} to default location because ${this.targetGroupId} is missing.`);
            this.targetGroupId = this.defaultGroup.id;
            potentialGroup = this.defaultGroup;
        }

        if (this.targetGroupId != this.currentGroup.id) {
            if (this.visible && this.navElem.classList.contains('active')) {
                this.clickOther();
                this.setNotSelected();
            }
            this.currentGroup = potentialGroup;
            if (this.currentGroup) {
                this.currentGroup.appendChild(this.navElem.parentElement);
                
                // Move content container
                if (this.contentElem) {
                    let newContentContainer = getRequiredElementById(this.currentGroup.dataset.content);
                    if (newContentContainer) {
                        newContentContainer.appendChild(this.contentElem);
                    }
                }

                if (this.visible && [...this.currentGroup.querySelectorAll('.nav-link')].length == 1) {
                    this.navElem.click();
                }
            }
        }

        // Update Cookie
        if (this.targetGroupId != this.defaultGroup.id) {
            setCookie(`tabloc_${this.id}`, this.targetGroupId, 365);
        } else {
            deleteCookie(`tabloc_${this.id}`);
        }

        // Update Visibility
        if (!this.visible && this.navElem.classList.contains('active')) {
            this.clickOther();
            this.setNotSelected();
        }
        
        this.navElem.style.display = this.visible ? '' : 'none';
        if (this.contentElem) {
            this.contentElem.style.display = this.visible ? '' : 'none';
        }
    }
}


** Central handler for generate main tab layout logic. */
class GenTabLayout {
    constructor() {
        // Safe getters for all elements
        this.leftSplitBar = getRequiredElementById('t2i-top-split-bar');
        this.rightSplitBar = getRequiredElementById('t2i-top-2nd-split-bar');
        this.leftSplitBarButton = getRequiredElementById('t2i-top-split-quickbutton');
        this.bottomSplitBar = getRequiredElementById('t2i-mid-split-bar');
        this.bottomSplitBarButton = getRequiredElementById('t2i-mid-split-quickbutton');
        this.topSection = getRequiredElementById('t2i_top_bar');
        this.bottomInfoBar = getRequiredElementById('bottom_info_bar');
        this.bottomBar = getRequiredElementById('t2i_bottom_bar');
        this.inputSidebar = getRequiredElementById('input_sidebar');
        this.mainImageArea = getRequiredElementById('main_image_area');
        this.currentImage = getRequiredElementById('current_image');
        this.mainInputsArea = getRequiredElementById('main_inputs_area_wrapper');
        this.currentImageWrapbox = getRequiredElementById('current_image_wrapbox');
        this.currentImageBatch = getRequiredElementById('current_image_batch_wrapper');
        this.currentImageBatchCore = getRequiredElementById('current_image_batch');
        this.altRegion = getRequiredElementById('alt_prompt_region');
        this.altText = getRequiredElementById('alt_prompt_textbox');
        this.altNegText = getRequiredElementById('alt_negativeprompt_textbox');
        this.altImageRegion = getRequiredElementById('alt_prompt_extra_area');
        this.editorSizebar = getRequiredElementById('image_editor_sizebar');
        this.layoutConfigArea = getRequiredElementById('layoutconfigarea');
        this.toolContainer = getRequiredElementById('tool_container');
        this.t2iRootDiv = getRequiredElementById('Text2Image');
        this.quickToolsButton = getRequiredElementById('quicktools-button');

        // Initialize state
        this.layoutResets = [];
        this.leftShut = localStorage.getItem('barspot_leftShut') == 'true';
        this.bottomShut = localStorage.getItem('barspot_midForceToBottom') == 'true';
        this.imageEditorBarPos = parseInt(getCookie('barspot_imageEditorSizeBar') || '-1');
        this.leftSectionBarPos = parseInt(getCookie('barspot_pageBarTop') || '-1');
        this.rightSectionBarPos = parseInt(getCookie('barspot_pageBarTop2') || '-1');
        this.bottomSectionBarPos = parseInt(getCookie('barspot_pageBarMidPx') || '-1');
        this.hideTabs = (getCookie('layout_hidetabs') || '').split(',');
        this.mobileDesktopLayout = localStorage.getItem('layout_mobileDesktop') || 'auto';

        // Initialize Tabs
        this.tabCollections = document.querySelectorAll('.swarm-gen-tab-subnav');
        this.managedTabs = [...this.tabCollections].flatMap(e => [...e.querySelectorAll('.nav-link')]).map(e => new MovableGenTab(e, this));
        this.managedTabContainers = [];

        // State flags
        this.leftBarDrag = false;
        this.rightBarDrag = false;
        this.bottomBarDrag = false;
        this.imageEditorSizeBarDrag = false;
        this.isSmallWindow = this.mobileDesktopLayout == 'auto' ? window.innerWidth < 768 : this.mobileDesktopLayout == 'mobile';
        this.antiDup = false;

        // Apply initial mobile/desktop logic
        if (this.isSmallWindow) {
            this.bottomShut = true;
            this.leftShut = true;
            this.rightSectionBarPos = 0;
        }
    }

    init() {
        if (this.managedTabs) {
            for (let tab of this.managedTabs) {
                if (tab.contentElem) {
                    tab.contentElem.style.height = '100%';
                    tab.contentElem.style.width = '100%';
                    if (this.managedTabContainers && tab.contentElem.parentElement && !this.managedTabContainers.includes(tab.contentElem.parentElement)) {
                        this.managedTabContainers.push(tab.contentElem.parentElement);
                    }
                    if (this.hideTabs && this.hideTabs.includes(tab.id)) {
                        tab.visible = false;
                    }
                    tab.update();
                    if (tab.navElem) {
                        tab.navElem.addEventListener('click', () => {
                            try { browserUtil.makeVisible(tab.contentElem); } catch(e) {}
                        });
                    }
                }
            }
        }
        
        this.reapplyPositions();
        
        // Add listeners safely
        this.addSafeListener(this.leftSplitBar, 'mousedown', (e) => {
            if (this.isSmallWindow) return;
            this.leftBarDrag = true;
            e.preventDefault();
        });

        this.addSafeListener(this.rightSplitBar, 'mousedown', (e) => {
            if (this.isSmallWindow) return;
            this.rightBarDrag = true;
            e.preventDefault();
        });

        this.addSafeListener(this.editorSizebar, 'mousedown', (e) => {
            this.imageEditorSizeBarDrag = true;
            e.preventDefault();
        });

        this.addSafeListener(this.bottomSplitBar, 'mousedown', (e) => {
            if (this.isSmallWindow) return;
            if (e.target == this.bottomSplitBarButton) return;
            this.bottomBarDrag = true;
            this.setBottomShut(false);
            e.preventDefault();
        });

        this.addSafeListener(this.bottomSplitBarButton, 'click', (e) => {
            e.preventDefault();
            this.bottomBarDrag = false;
            if (this.isSmallWindow) return;
            this.setBottomShut(!this.bottomShut);
            this.bottomSectionBarPos = Math.max(this.bottomSectionBarPos, 400);
            this.reapplyPositions();
        });

        this.addSafeListener(this.leftSplitBarButton, 'click', (e) => {
            e.preventDefault();
            this.leftBarDrag = false;
            if (this.isSmallWindow) return;
            this.setLeftShut(!this.leftShut);
            this.leftSectionBarPos = Math.max(this.leftSectionBarPos, 400);
            this.reapplyPositions();
            if (this.altText) triggerChangeFor(this.altText);
            if (this.altNegText) triggerChangeFor(this.altNegText);
        });

        document.addEventListener('mousemove', (e) => this.handleMove(e, e.pageX, e.pageY));
        document.addEventListener('mouseup', () => {
            this.leftBarDrag = false;
            this.rightBarDrag = false;
            this.bottomBarDrag = false;
            this.imageEditorSizeBarDrag = false;
        });

        if (this.altText) {
            this.altText.addEventListener('input', () => {
                setCookie(`lastparam_input_prompt`, this.altText.value, getParamMemoryDays());
                this.reapplyPositions();
            });
        }

        if (this.altNegText) {
            this.altNegText.addEventListener('input', () => {
                setCookie(`lastparam_input_negativeprompt`, this.altNegText.value, getParamMemoryDays());
                this.reapplyPositions();
            });
        }

        try { this.buildConfigArea(); } catch(e) { console.warn("Config build failed", e); }
    }

    addSafeListener(elem, event, handler) {
        if (elem) {
            elem.addEventListener(event, handler, true);
        }
    }

    handleMove(e, x, y) {
        let offX = Math.min(Math.max(x, 100), window.innerWidth - 10);
        
        if (this.leftBarDrag) {
            this.leftSectionBarPos = Math.min(offX - 3, 51 * 16);
            this.setLeftShut(this.leftSectionBarPos < 290);
            this.reapplyPositions();
        }
        if (this.rightBarDrag && this.rightSplitBar) {
            this.rightSectionBarPos = window.innerWidth - offX;
            if (this.rightSectionBarPos < 100) this.rightSectionBarPos = 22;
            this.reapplyPositions();
        }
        if (this.imageEditorSizeBarDrag) {
            let imageEditor = window.imageEditor;
            if (imageEditor && imageEditor.inputDiv && this.currentImage) {
                let maxAreaWidth = imageEditor.inputDiv.offsetWidth + this.currentImage.offsetWidth + 10;
                let imageAreaLeft = imageEditor.inputDiv.getBoundingClientRect().left;
                let val = Math.min(Math.max(x - imageAreaLeft + 3, 200), maxAreaWidth - 200);
                this.imageEditorBarPos = Math.min(90, Math.max(10, val / maxAreaWidth * 100));
                this.reapplyPositions();
            }
        }
        if (this.bottomBarDrag && this.topSection) {
            const MID_OFF = 85;
            let refY = Math.min(Math.max(y, MID_OFF), window.innerHeight - MID_OFF);
            this.setBottomShut(refY >= window.innerHeight - MID_OFF);
            this.bottomSectionBarPos = window.innerHeight - refY + this.topSection.getBoundingClientRect().top + 3;
            this.reapplyPositions();
        }
    }

    reapplyPositions() {
        this.isSmallWindow = this.mobileDesktopLayout == 'auto' ? window.innerWidth < 768 : this.mobileDesktopLayout == 'mobile';
        if (this.isSmallWindow) {
            document.body.classList.add('small-window');
            document.body.classList.remove('large-window');
        } else {
            document.body.classList.remove('small-window');
            document.body.classList.add('large-window');
        }

        try { fixTabHeights(); } catch(e) {}
        try { tweakNegativePromptBox(); } catch(e) {}

        if (this.altRegion && this.altRegion.style.display != 'none' && this.altText && this.altNegText) {
            try { dynamicSizeTextBox(this.altText); } catch(e) {}
            try { dynamicSizeTextBox(this.altNegText); } catch(e) {}
            let offset = this.altText.offsetHeight + this.altNegText.offsetHeight;
            if (this.altImageRegion) offset += this.altImageRegion.offsetHeight;
            this.altRegion.style.top = `calc(-${offset}px - 1rem - 7px)`;
        }

        if (!this.t2iRootDiv) return;

        let rootTop = this.t2iRootDiv.getBoundingClientRect().top;
        if (this.quickToolsButton) {
            this.quickToolsButton.style.top = `${rootTop - 18}px`;
            this.quickToolsButton.style.right = this.isSmallWindow ? '0.5rem' : '';
        }

        setCookie('barspot_pageBarTop', this.leftSectionBarPos, 365);
        setCookie('barspot_pageBarTop2', this.rightSectionBarPos, 365);
        setCookie('barspot_pageBarMidPx', this.bottomSectionBarPos, 365);
        setCookie('barspot_imageEditorSizeBar', this.imageEditorBarPos, 365);

        if (this.toolContainer && this.toolContainer.parentElement) {
            this.toolContainer.style.minHeight = `calc(100% - ${this.toolContainer.getBoundingClientRect().top - this.toolContainer.parentElement.getBoundingClientRect().top}px - 1.5rem)`;
        }

        let barTopLeft = this.leftShut ? `0px` : this.leftSectionBarPos == -1 ? (this.isSmallWindow ? `14rem` : `28rem`) : `${this.leftSectionBarPos}px`;
        let barTopRight = this.rightSectionBarPos == -1 ? (this.isSmallWindow ? `4rem` : `21rem`) : `${this.rightSectionBarPos}px`;
        let curImgWidth = `100vw - ${barTopLeft} - ${barTopRight} - 10px`;

        if (this.isSmallWindow && this.altRegion && (this.rightSectionBarPos > 0 || !this.bottomShut)) {
            this.altRegion.style.visibility = 'hidden';
        } else if (this.altRegion) {
            this.altRegion.style.visibility = '';
        }

        if (this.inputSidebar) {
            this.inputSidebar.style.width = `${barTopLeft}`;
            this.inputSidebar.style.display = this.leftShut ? 'none' : '';
        }

        if (this.altRegion) {
            this.altRegion.style.width = `calc(100vw - ${barTopLeft} - ${barTopRight} - 10px)`;
        }

        if (this.mainImageArea) {
            this.mainImageArea.style.width = `calc(100vw - ${barTopLeft})`;
            this.mainImageArea.scrollTop = 0;
        }

        // Image Editor Logic
        let imageEditor = window.imageEditor;
        if (this.currentImage && this.currentImageWrapbox) {
            if (imageEditor && imageEditor.active && imageEditor.inputDiv) {
                let imageEditorSizePercent = this.imageEditorBarPos < 0 ? 0.5 : (this.imageEditorBarPos / 100.0);
                imageEditor.inputDiv.style.width = `calc((${curImgWidth}) * ${imageEditorSizePercent})`;
                this.currentImage.style.width = `calc((${curImgWidth}) * ${(1.0 - imageEditorSizePercent)} - 6px)`;
            } else {
                this.currentImage.style.width = `calc(${curImgWidth})`;
            }
            this.currentImageWrapbox.style.width = `calc(${curImgWidth})`;
        }

        if (this.currentImageBatch) {
            this.currentImageBatch.style.width = `calc(${barTopRight} - 6px)`;
        }

        if (this.leftSplitBarButton) this.leftSplitBarButton.innerHTML = this.leftShut ? '&#x21DB;' : '&#x21DA;';
        if (this.bottomSplitBarButton) this.bottomSplitBarButton.innerHTML = this.bottomShut ? '&#x290A;' : '&#x290B;';

        // Height Logic
        let altHeight = (this.altRegion && this.altRegion.style.display == 'none') ? '0px' : (this.altRegion ? `${this.altRegion.offsetHeight}px` : '0px');

        if (this.bottomSectionBarPos != -1 || this.bottomShut) {
            let bottomBarHeight = this.bottomInfoBar ? this.bottomInfoBar.offsetHeight : 0;
            let addedHeight = this.isSmallWindow ? '0.4rem' : '2.8rem';
            let fixed = this.bottomShut ? `(${rootTop}px + ${addedHeight} + ${bottomBarHeight}px)` : `${this.bottomSectionBarPos}px`;

            const setHeight = (el, val) => { if (el) el.style.height = val; };
            setHeight(this.leftSplitBar, `calc(100vh - ${fixed})`);
            setHeight(this.rightSplitBar, `calc(100vh - ${fixed} - 5px)`);
            setHeight(this.inputSidebar, `calc(100vh - ${fixed})`);
            setHeight(this.mainImageArea, `calc(100vh - ${fixed})`);
            setHeight(this.currentImageWrapbox, `calc(100vh - ${fixed} - ${altHeight})`);
            setHeight(this.editorSizebar, `calc(100vh - ${fixed} - ${altHeight})`);
            setHeight(this.currentImageBatch, `calc(100vh - ${fixed})`);
            setHeight(this.topSection, `calc(100vh - ${fixed})`);
            setHeight(this.bottomBar, `calc(${fixed} - 45px)`);
        } else {
            // Default 50/50 split if no prefs
            const setHeight = (el, val) => { if (el) el.style.height = val; };
            setHeight(this.leftSplitBar, 'calc(49vh)');
            setHeight(this.rightSplitBar, 'calc(49vh)');
            if (this.currentImageWrapbox) this.currentImageWrapbox.style.height = `calc(49vh - ${altHeight} + 1rem)`;
            if (this.editorSizebar) this.editorSizebar.style.height = `calc(49vh - ${altHeight})`;
            if (this.bottomBar) this.bottomBar.style.height = `calc(49vh - 30px)`;
        }

        if (imageEditor && imageEditor.resize) {
            try { imageEditor.resize(); } catch(e) {}
        }
        try { alignImageDataFormat(); } catch(e) {}

        if (this.tabCollections) {
            for (let collection of this.tabCollections) {
                collection.style.display = [...collection.querySelectorAll('.nav-link')].length > 1 ? '' : 'none';
            }
        }

        if (this.managedTabContainers) {
            for (let container of this.managedTabContainers) {
                if (container.parentElement) {
                    let offset = container.getBoundingClientRect().top - container.parentElement.getBoundingClientRect().top;
                    container.style.height = `calc(100% - ${offset}px)`;
                }
            }
        }

        try { browserUtil.makeVisible(document); } catch(e) {}
    }

    setBottomShut(val) {
        this.bottomShut = val;
        localStorage.setItem('barspot_midForceToBottom', `${this.bottomShut}`);
    }

    setLeftShut(val) {
        this.leftShut = val;
        localStorage.setItem('barspot_leftShut', `${this.leftShut}`);
    }

    rebuildVisibleCookie() {
        if (this.managedTabs) {
            setCookie('layout_hidetabs', this.managedTabs.filter(t => !t.visible).map(t => t.id).join(','), 365);
        }
    }

    updateConfigFor(id) {
        if (!this.managedTabs) return;
        let tab = this.managedTabs.find(t => t.id == id);
        if (tab) {
            let visibleElem = getRequiredElementById(`tabconfig_${id}_visible`);
            let groupElem = getRequiredElementById(`tabconfig_${id}_group`);
            if (visibleElem) tab.visible = visibleElem.checked;
            if (groupElem) tab.targetGroupId = groupElem.value;
            tab.update();
            this.buildConfigArea();
        }
    }

    buildConfigArea() {
        if (!this.layoutConfigArea || !this.managedTabs) return;

        let groups = this.managedTabs.map(t => t.defaultGroup).filter(g => g != null);
        // Deduplicate groups by ID
        let uniqueGroups = [];
        let seenIds = new Set();
        for (let g of groups) {
            if (!seenIds.has(g.id)) {
                uniqueGroups.push(g);
                seenIds.add(g.id);
            }
        }

        let selectOptions = uniqueGroups.map(e => `<option value="${e.id}">${e.dataset ? escapeHtml(e.dataset.title) : e.id}</option>`).join('\n');

        let html = '<table class="simple-table">\n<tr><th>Tab</th><th>Group</th><th>Visible</th></tr>\n';
        for (let tab of this.managedTabs) {
            html += `<tr>
                <td><b>${escapeHtml(tab.title)}</b></td>
                <td><select id="tabconfig_${tab.id}_group">${selectOptions}</select></td>
                <td><input type="checkbox" id="tabconfig_${tab.id}_visible" ${tab.visible ? 'checked' : ''}></td>
            </tr>`;
        }
        html += '</table>';
        this.layoutConfigArea.innerHTML = html;

        for (let tab of this.managedTabs) {
            let groupElem = getRequiredElementById(`tabconfig_${tab.id}_group`);
            let visibleElem = getRequiredElementById(`tabconfig_${tab.id}_visible`);

            if (groupElem) {
                groupElem.value = tab.targetGroupId;
                groupElem.onchange = (e) => {
                    let el = (e && e.target) ? e.target : e;
                    if (!el) return;
                    tab.targetGroupId = el.value;
                    tab.update();
                    this.buildConfigArea();
                };
            }
            if (visibleElem) {
                visibleElem.onchange = (e) => {
                    let el = (e && e.target) ? e.target : e;
                    if (!el) return;
                    tab.visible = el.checked;
                    tab.update();
                    this.rebuildVisibleCookie();
                    this.reapplyPositions();
                };
            }
        }
        this.rebuildVisibleCookie();
    }

    resetSubTabs() {
        if (confirm('Are you sure you want to reset the layout of the subtabs?\nThis will make all sub-tabs visible, and put them in their default locations.')) {
            if (this.managedTabs) {
                for (let tab of this.managedTabs) {
                    if (tab.defaultGroup) {
                        tab.targetGroupId = tab.defaultGroup.id;
                        tab.visible = true;
                        tab.update();
                    }
                }
                this.reapplyPositions();
                this.buildConfigArea();
            }
        }
    }

    onMobileDesktopLayoutChange() {
        let selector = getRequiredElementById('mobile_desktop_layout_selector');
        if (selector) {
            this.mobileDesktopLayout = selector.value;
            localStorage.setItem('layout_mobileDesktop', this.mobileDesktopLayout);
            this.reapplyPositions();
        }
    }
}
// Replace lines 1146-1157 (Initialize section) with:
let genTabLayout = new GenTabLayout();
document.addEventListener('DOMContentLoaded', () => genTabLayout.init());
