[33mcommit 8e7bdd123927aa1338c3bd0f3ff706822080beba[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mTabbed[m[33m)[m
Author: Pavlo4242 <pavlostepanchuk15@gmail.com>
Date:   Wed Dec 24 00:22:19 2025 +0700

    Update print statement from 'Hello' to 'Goodbye'

[1mdiff --git a/src/wwwroot/js/genpage/gentab/layout.js b/src/wwwroot/js/genpage/gentab/layout.js[m
[1mindex 559c775f..cd4405bd 100644[m
[1m--- a/src/wwwroot/js/genpage/gentab/layout.js[m
[1m+++ b/src/wwwroot/js/genpage/gentab/layout.js[m
[36m@@ -1,5 +1,21 @@[m
 [m
[31m-// ===== HELPER FUNCTIONS - MUST BE DEFINED FIRST =====[m
[32m+[m[32m// ===== UTILITY FUNCTIONS (Mocked or External) =====[m
[32m+[m[32m// Ensure these exist or are mocked to prevent ReferenceErrors[m
[32m+[m[32m//function fixTabHeights() {}[m
[32m+[m[32m//function tweakNegativePromptBox() {}[m
[32m+[m[32m//function dynamicSizeTextBox(elem) {}[m
[32m+[m[32m//function alignImageDataFormat() {}[m
[32m+[m[32m//function internalSiteJsGetUserSetting() { return true; }[m
[32m+[m[32m//function getParamMemoryDays() { return 30; }[m
[32m+[m[32m//function escapeHtml(text) {[m
[32m+[m[32m//    if (!text) return text;[m
[32m+[m[32m //   return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");[m
[32m+[m[32m//}[m
[32m+[m[32m//const browserUtil = { makeVisible: function() {} };[m
[32m+[m
[32m+[m
[32m+[m[32m// Replace lines 1-36 (Helper Functions) with:[m
[32m+[m[32m// ===== HELPER FUNCTIONS =====[m
 [m
 function getCookie(name) {[m
     let value = `; ${document.cookie}`;[m
[36m@@ -19,21 +35,35 @@[m [mfunction deleteCookie(name) {[m
     document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";[m
 }[m
 [m
[32m+[m[32m/** * Safely gets an element by ID. Returns null if missing, preventing crashes.[m
[32m+[m[32m */[m
 function getRequiredElementById(id) {[m
     const elem = document.getElementById(id);[m
[31m-    if (!elem) console.warn(`Element not found: ${id}`);[m
[32m+[m[32m    if (!elem) {[m
[32m+[m[32m        console.warn(`Layout Element not found: ${id} - This feature may be disabled.`);[m
[32m+[m[32m        return null;[m
[32m+[m[32m    }[m
     return elem;[m
 }[m
 [m
[31m-function findParentOfClass(elem, className) {[m
[31m-    while (elem && elem.parentElement) {[m
[31m-        elem = elem.parentElement;[m
[31m-        if (elem.classList && elem.classList.contains(className)) {[m
[31m-            return elem;[m
[32m+[m[32mfunction findParentOfClass(element, className) {[m
[32m+[m[32m    while (element && element !== document) {[m
[32m+[m[32m        if (element.classList && element.classList.contains(className)) {[m
[32m+[m[32m            return element;[m
         }[m
[32m+[m[32m        element = element.parentNode;[m
     }[m
     return null;[m
 }[m
[32m+[m
[32m+[m[32mfunction triggerChangeFor(element) {[m
[32m+[m[32m    if (element) {[m
[32m+[m[32m        element.dispatchEvent(new Event('change'));[m
[32m+[m[32m    }[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m// ===== UTILITY FUNCTIONS (Mocked or External) =====[m
[32m+[m[32m// Ensure these exist or are mocked to prevent ReferenceErrors[m
 // ========================================[m
 // FILE 1: layout.js - Replace injectLayoutCSS function ONLY[m
 // ========================================[m
[36m@@ -240,8 +270,8 @@[m [mfunction injectLayoutCSS() {[m
 [m
 [m
 [m
[31m-// ===== MOVABLE TAB CLASS =====[m
[31m-[m
[32m+[m[32m// Replace the entire MovableGenTab class (lines 243-317) with:[m
[32m+[m[32m/** Data about a tab within the Generate UI that can be moved to different containers. */[m
 class MovableGenTab {[m
     constructor(navLink, handler) {[m
         this.handler = handler;[m
[36m@@ -260,7 +290,8 @@[m [mclass MovableGenTab {[m
     clickOn(e) {[m
         e.preventDefault();[m
         this.setSelected();[m
[31m-        for (let tab of this.handler.managedTabs.filter(t => t.currentGroup.id == this.currentGroup.id && t.id != this.id)) {[m
[32m+[m[32m        // Filter out this tab and set others to not selected[m
[32m+[m[32m        for (let tab of this.handler.managedTabs.filter(t => t.currentGroup && t.currentGroup.id == this.currentGroup.id && t.id != this.id)) {[m
             tab.setNotSelected();[m
         }[m
         setTimeout(() => {[m
[36m@@ -270,888 +301,518 @@[m [mclass MovableGenTab {[m
 [m
     setNotSelected() {[m
         this.navElem.classList.remove('active');[m
[31m-        this.contentElem.classList.remove('active');[m
[31m-        this.contentElem.classList.remove('show');[m
[32m+[m[32m        if (this.contentElem) {[m
[32m+[m[32m            this.contentElem.classList.remove('active');[m
[32m+[m[32m            this.contentElem.classList.remove('show');[m
[32m+[m[32m        }[m
     }[m
 [m
     setSelected() {[m
         this.navElem.classList.add('active');[m
[31m-        this.contentElem.classList.add('active');[m
[31m-        this.contentElem.classList.add('show');[m
[32m+[m[32m        if (this.contentElem) {[m
[32m+[m[32m            this.contentElem.classList.add('active');[m
[32m+[m[32m            this.contentElem.classList.add('show');[m
[32m+[m[32m        }[m
     }[m
 [m
     clickOther() {[m
[32m+[m[32m        if (!this.navElem.parentElement) return;[m
         let nextTab = this.navElem.parentElement.nextElementSibling || this.navElem.parentElement.previousElementSibling;[m
         if (nextTab) {[m
[31m-            nextTab.querySelector('.nav-link').click();[m
[32m+[m[32m            let link = nextTab.querySelector('.nav-link');[m
[32m+[m[32m            if (link) link.click();[m
         }[m
     }[m
 [m
     update() {[m
[32m+[m[32m        // Validation: If the target group doesn't exist (e.g., ID changed in HTML), reset to default[m
[32m+[m[32m        let potentialGroup = getRequiredElementById(this.targetGroupId);[m
[32m+[m[32m        if (!potentialGroup) {[m
[32m+[m[32m            console.log(`Resetting tab ${this.id} to default location because ${this.targetGroupId} is missing.`);[m
[32m+[m[32m            this.targetGroupId = this.defaultGroup.id;[m
[32m+[m[32m            potentialGroup = this.defaultGroup;[m
[32m+[m[32m        }[m
[32m+[m
         if (this.targetGroupId != this.currentGroup.id) {[m
             if (this.visible && this.navElem.classList.contains('active')) {[m
                 this.clickOther();[m
                 this.setNotSelected();[m
             }[m
[31m-            this.currentGroup = getRequiredElementById(this.targetGroupId);[m
[31m-            this.currentGroup.appendChild(this.navElem.parentElement);[m
[31m-            let newContentContainer = getRequiredElementById(this.currentGroup.dataset.content);[m
[31m-            newContentContainer.appendChild(this.contentElem);[m
[31m-            if (this.visible && [...this.currentGroup.querySelectorAll('.nav-link')].length == 1) {[m
[31m-                this.navElem.click();[m
[32m+[m[32m            this.currentGroup = potentialGroup;[m
[32m+[m[32m            if (this.currentGroup) {[m
[32m+[m[32m                this.currentGroup.appendChild(this.navElem.parentElement);[m
[32m+[m[41m                [m
[32m+[m[32m                // Move content container[m
[32m+[m[32m                if (this.contentElem) {[m
[32m+[m[32m                    let newContentContainer = getRequiredElementById(this.currentGroup.dataset.content);[m
[32m+[m[32m                    if (newContentContainer) {[m
[32m+[m[32m                        newContentContainer.appendChild(this.contentElem);[m
[32m+[m[32m                    }[m
[32m+[m[32m                }[m
[32m+[m
[32m+[m[32m                if (this.visible && [...this.currentGroup.querySelectorAll('.nav-link')].length == 1) {[m
[32m+[m[32m                    this.navElem.click();[m
[32m+[m[32m                }[m
             }[m
         }[m
[32m+[m
[32m+[m[32m        // Update Cookie[m
         if (this.targetGroupId != this.defaultGroup.id) {[m
             setCookie(`tabloc_${this.id}`, this.targetGroupId, 365);[m
[31m-        }[m
[31m-        else {[m
[32m+[m[32m        } else {[m
             deleteCookie(`tabloc_${this.id}`);[m
         }[m
[32m+[m
[32m+[m[32m        // Update Visibility[m
         if (!this.visible && this.navElem.classList.contains('active')) {[m
             this.clickOther();[m
             this.setNotSelected();[m
         }[m
[32m+[m[41m        [m
         this.navElem.style.display = this.visible ? '' : 'none';[m
[31m-        this.contentElem.style.display = this.visible ? '' : 'none';[m
[32m+[m[32m        if (this.contentElem) {[m
[32m+[m[32m            this.contentElem.style.display = this.visible ? '' : 'none';[m
[32m+[m[32m        }[m
     }[m
 }[m
 [m
[31m-// ===== MAIN LAYOUT CLASS =====[m
 [m
[32m+[m[32m** Central handler for generate main tab layout logic. */[m
 class GenTabLayout {[m
     constructor() {[m
[31m-        this.managedTabContainers = [];[m
[31m-        this.managedTabs = [];[m
[32m+[m[32m        // Safe getters for all elements[m
[32m+[m[32m        this.leftSplitBar = getRequiredElementById('t2i-top-split-bar');[m
[32m+[m[32m        this.rightSplitBar = getRequiredElementById('t2i-top-2nd-split-bar');[m
[32m+[m[32m        this.leftSplitBarButton = getRequiredElementById('t2i-top-split-quickbutton');[m
[32m+[m[32m        this.bottomSplitBar = getRequiredElementById('t2i-mid-split-bar');[m
[32m+[m[32m        this.bottomSplitBarButton = getRequiredElementById('t2i-mid-split-quickbutton');[m
[32m+[m[32m        this.topSection = getRequiredElementById('t2i_top_bar');[m
[32m+[m[32m        this.bottomInfoBar = getRequiredElementById('bottom_info_bar');[m
[32m+[m[32m        this.bottomBar = getRequiredElementById('t2i_bottom_bar');[m
[32m+[m[32m        this.inputSidebar = getRequiredElementById('input_sidebar');[m
[32m+[m[32m        this.mainImageArea = getRequiredElementById('main_image_area');[m
[32m+[m[32m        this.currentImage = getRequiredElementById('current_image');[m
[32m+[m[32m        this.mainInputsArea = getRequiredElementById('main_inputs_area_wrapper');[m
[32m+[m[32m        this.currentImageWrapbox = getRequiredElementById('current_image_wrapbox');[m
[32m+[m[32m        this.currentImageBatch = getRequiredElementById('current_image_batch_wrapper');[m
[32m+[m[32m        this.currentImageBatchCore = getRequiredElementById('current_image_batch');[m
[32m+[m[32m        this.altRegion = getRequiredElementById('alt_prompt_region');[m
[32m+[m[32m        this.altText = getRequiredElementById('alt_prompt_textbox');[m
[32m+[m[32m        this.altNegText = getRequiredElementById('alt_negativeprompt_textbox');[m
[32m+[m[32m        this.altImageRegion = getRequiredElementById('alt_prompt_extra_area');[m
[32m+[m[32m        this.editorSizebar = getRequiredElementById('image_editor_sizebar');[m
[32m+[m[32m        this.layoutConfigArea = getRequiredElementById('layoutconfigarea');[m
[32m+[m[32m        this.toolContainer = getRequiredElementById('tool_container');[m
[32m+[m[32m        this.t2iRootDiv = getRequiredElementById('Text2Image');[m
[32m+[m[32m        this.quickToolsButton = getRequiredElementById('quicktools-button');[m
[32m+[m
[32m+[m[32m        // Initialize state[m
         this.layoutResets = [];[m
[31m-[m
[31m-        const get = (id) => document.getElementById(id);[m
[31m-[m
[31m-        this.t2iRootDiv = get('Text2Image');[m
[31m-        this.leftSplitBar = get('t2i-top-split-bar');[m
[31m-        this.rightSplitBar = get('t2i-top-2nd-split-bar');[m
[31m-        this.leftSplitBarButton = get('t2i-top-split-quickbutton');[m
[31m-        this.bottomSplitBar = get('t2i-mid-split-bar');[m
[31m-        this.bottomSplitBarButton = get('t2i-mid-split-quickbutton');[m
[31m-        this.bottomBar = get('t2i_bottom_bar');[m
[31m-        this.inputSidebar = get('input_sidebar');[m
[31m-        this.mainImageArea = get('main_image_area');[m
[31m-        this.currentImageBatch = get('current_image_batch_wrapper');[m
[31m-        this.altRegion = get('alt_prompt_region');[m
[31m-        this.layoutConfigArea = get('layoutconfigarea');[m
[31m-        this.tabCollections = document.querySelectorAll('.swarm-gen-tab-subnav');[m
[31m-[m
[31m-        this.antiDup = false;[m
         this.leftShut = localStorage.getItem('barspot_leftShut') == 'true';[m
[31m-        this.rightShut = localStorage.getItem('barspot_rightShut') == 'true';[m
         this.bottomShut = localStorage.getItem('barspot_midForceToBottom') == 'true';[m
[31m-        [m
[31m-        const leftCookie = getCookie('barspot_pageBarTop');[m
[31m-        const rightCookie = getCookie('barspot_pageBarTop2');[m
[31m-        const bottomCookie = getCookie('barspot_pageBarMidPx');[m
[31m-        const leftSplitCookie = getCookie('barspot_leftSplit');[m
[31m-        const rightSplitCookie = getCookie('barspot_rightSplit');[m
[31m-        [m
[31m-        this.leftSectionBarPos = leftCookie ? parseInt(leftCookie) : 448;[m
[31m-        this.rightSectionBarPos = rightCookie ? parseInt(rightCookie) : 336;[m
[31m-        this.bottomSectionBarPos = bottomCookie ? parseInt(bottomCookie) : 400;[m
[31m-        this.leftSidebarSplit = leftSplitCookie ? parseFloat(leftSplitCookie) : 0.5;[m
[31m-        this.rightSidebarSplit = rightSplitCookie ? parseFloat(rightSplitCookie) : 0.5;[m
[31m-        [m
[32m+[m[32m        this.imageEditorBarPos = parseInt(getCookie('barspot_imageEditorSizeBar') || '-1');[m
[32m+[m[32m        this.leftSectionBarPos = parseInt(getCookie('barspot_pageBarTop') || '-1');[m
[32m+[m[32m        this.rightSectionBarPos = parseInt(getCookie('barspot_pageBarTop2') || '-1');[m
[32m+[m[32m        this.bottomSectionBarPos = parseInt(getCookie('barspot_pageBarMidPx') || '-1');[m
[32m+[m[32m        this.hideTabs = (getCookie('layout_hidetabs') || '').split(',');[m
         this.mobileDesktopLayout = localStorage.getItem('layout_mobileDesktop') || 'auto';[m
[31m-        this.hideTabs = (getCookie('layout_hidetabs') || '').split(',').filter(x => x);[m
 [m
[32m+[m[32m        // Initialize Tabs[m
[32m+[m[32m        this.tabCollections = document.querySelectorAll('.swarm-gen-tab-subnav');[m
[32m+[m[32m        this.managedTabs = [...this.tabCollections].flatMap(e => [...e.querySelectorAll('.nav-link')]).map(e => new MovableGenTab(e, this));[m
[32m+[m[32m        this.managedTabContainers = [];[m
[32m+[m
[32m+[m[32m        // State flags[m
         this.leftBarDrag = false;[m
         this.rightBarDrag = false;[m
         this.bottomBarDrag = false;[m
[31m-        this.leftSplitDrag = false;[m
[31m-        this.rightSplitDrag = false;[m
[31m-[m
[31m-        let currentPromptLoc = getCookie('tabloc_alt_prompt_region') || 'Prompt-Tab';[m
[31m-        if (currentPromptLoc === 'Input-Sidebar-Main-Tab') {[m
[31m-            currentPromptLoc = 'Prompt-Tab';[m
[31m-        }[m
[31m-[m
[31m-        // --- PROMPT MOVABLE ---[m
[31m-        this.promptMovable = {[m
[31m-            id: 'alt_prompt_region',[m
[31m-            title: 'Prompt & Generate',[m
[31m-            targetGroupId: currentPromptLoc,[m
[31m-            update: () => {[m
[31m-                let target = getRequiredElementById(this.promptMovable.targetGroupId);[m
[31m-                if (target && this.altRegion && this.altRegion.parentElement != target) {[m
[31m-                    target.appendChild(this.altRegion);[m
[31m-                    this.altRegion.style.position = 'relative';[m
[31m-                    this.altRegion.style.width = '100%';[m
[31m-                    this.altRegion.style.maxWidth = '100%';[m
[31m-                    setCookie('tabloc_alt_prompt_region', this.promptMovable.targetGroupId, 365);[m
[31m-                }[m
[31m-            }[m
[31m-        };[m
[31m-[m
[31m-        // --- METADATA MOVABLE ---[m
[31m-        this.metadataWrapper = document.querySelector('.current-image-extras-wrapper');[m
[31m-        if (this.metadataWrapper) {[m
[31m-            this.metadataWrapper.id = 'movable_metadata_region'; [m
[31m-            let currentMetaLoc = getCookie('tabloc_movable_metadata_region') || 'Main-Image-Area';[m
[31m-[m
[31m-            this.metadataMovable = {[m
[31m-                id: 'movable_metadata_region',[m
[31m-                title: 'Image Metadata & Buttons',[m
[31m-                targetGroupId: currentMetaLoc,[m
[31m-                update: () => {[m
[31m-                    let target;[m
[31m-                    if (this.metadataMovable.targetGroupId === 'Main-Image-Area') {[m
[31m-                         target = document.querySelector('.current_image_wrapbox');[m
[31m-                    } else {[m
[31m-                        target = getRequiredElementById(this.metadataMovable.targetGroupId);[m
[31m-                    }[m
[32m+[m[32m        this.imageEditorSizeBarDrag = false;[m
[32m+[m[32m        this.isSmallWindow = this.mobileDesktopLayout == 'auto' ? window.innerWidth < 768 : this.mobileDesktopLayout == 'mobile';[m
[32m+[m[32m        this.antiDup = false;[m
[32m+[m
[32m+[m[32m        // Apply initial mobile/desktop logic[m
[32m+[m[32m        if (this.isSmallWindow) {[m
[32m+[m[32m            this.bottomShut = true;[m
[32m+[m[32m            this.leftShut = true;[m
[32m+[m[32m            this.rightSectionBarPos = 0;[m
[32m+[m[32m        }[m
[32m+[m[32m    }[m
 [m
[31m-                    if (target && this.metadataWrapper && this.metadataWrapper.parentElement != target) {[m
[31m-                        target.appendChild(this.metadataWrapper);[m
[31m-                        setCookie('tabloc_movable_metadata_region', this.metadataMovable.targetGroupId, 365);[m
[32m+[m[32m    init() {[m
[32m+[m[32m        if (this.managedTabs) {[m
[32m+[m[32m            for (let tab of this.managedTabs) {[m
[32m+[m[32m                if (tab.contentElem) {[m
[32m+[m[32m                    tab.contentElem.style.height = '100%';[m
[32m+[m[32m                    tab.contentElem.style.width = '100%';[m
[32m+[m[32m                    if (this.managedTabContainers && tab.contentElem.parentElement && !this.managedTabContainers.includes(tab.contentElem.parentElement)) {[m
[32m+[m[32m                        this.managedTabContainers.push(tab.contentElem.parentElement);[m
[32m+[m[32m                    }[m
[32m+[m[32m                    if (this.hideTabs && this.hideTabs.includes(tab.id)) {[m
[32m+[m[32m                        tab.visible = false;[m
[32m+[m[32m                    }[m
[32m+[m[32m                    tab.update();[m
[32m+[m[32m                    if (tab.navElem) {[m
[32m+[m[32m                        tab.navElem.addEventListener('click', () => {[m
[32m+[m[32m                            try { browserUtil.makeVisible(tab.contentElem); } catch(e) {}[m
[32m+[m[32m                        });[m
                     }[m
                 }[m
[31m-            };[m
[32m+[m[32m            }[m
         }[m
[31m-[m
[31m-        this.managedTabs = [...this.tabCollections].flatMap(e => [...e.querySelectorAll('.nav-link')]).map(e => new MovableGenTab(e, this));[m
         [m
[31m-        this.isSmallWindow = this.mobileDesktopLayout == 'auto' ? window.innerWidth < 768 : this.mobileDesktopLayout == 'mobile';[m
[31m-[m
[31m-        this.createSidebarSplitBars();[m
[32m+[m[32m        this.reapplyPositions();[m
         [m
[31m-        console.log('GenTabLayout constructed with:', {[m
[31m-            left: this.leftSectionBarPos,[m
[31m-            right: this.rightSectionBarPos,[m
[31m-            bottom: this.bottomSectionBarPos[m
[32m+[m[32m        // Add listeners safely[m
[32m+[m[32m        this.addSafeListener(this.leftSplitBar, 'mousedown', (e) => {[m
[32m+[m[32m            if (this.isSmallWind