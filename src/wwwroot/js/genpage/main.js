let gen_param_types = null, rawGenParamTypesFromServer = null, rawGroupMapFromServer = null;

let swarmHasLoaded = false;

let lastImageDir = '';

let lastModelDir = '';

let num_waiting_gens = 0, num_models_loading = 0, num_live_gens = 0, num_backends_waiting = 0;

let shouldApplyDefault = false;

let sessionReadyCallbacks = [];

let allModels = [];

let coreModelMap = {};

let otherInfoSpanContent = [];

let isGeneratingForever = false, isGeneratingPreviews = false;

let lastHistoryImage = null, lastHistoryImageDiv = null;

let currentMetadataVal = null, currentImgSrc = null;

let autoCompletionsList = null;
let autoCompletionsOptimize = false;

let mainGenHandler = new GenerateHandler();

let pageTitleSuffix = document.title.split(' - ').slice(1).join(' - ');
let curAutoTitle = "Page is loading...";

let featureSetChangedCallbacks = [];

function setPageTitle(newTitle) {
    document.title = `${newTitle} - ${pageTitleSuffix}`;
}

function autoTitle() {
    let tabList = getRequiredElementById('toptablist');
    let activeTopTab = tabList.querySelector('.active');
    curAutoTitle = activeTopTab.textContent;
    setPageTitle(curAutoTitle);
}

function updateOtherInfoSpan() {
    let span = getRequiredElementById('other_info_span');
    span.innerHTML = otherInfoSpanContent.join(' ');
}

const time_started = Date.now();

let statusBarElem = getRequiredElementById('top_status_bar');

let generatingPreviewsText = translatable('Generating live previews...');
let waitingOnModelLoadText = translatable('waiting on model load');
let generatingText = translatable('generating');

function currentGenString(num_waiting_gens, num_models_loading, num_live_gens, num_backends_waiting) {
    function autoBlock(num, text) {
        if (num == 0) {
            return '';
        }
        return `<span class="interrupt-line-part">${num} ${text.replaceAll('%', autoS(num))},</span> `;
    }
    return `${autoBlock(num_waiting_gens, 'current generation%')}${autoBlock(num_live_gens, 'running')}${autoBlock(num_backends_waiting, 'queued')}${autoBlock(num_models_loading, waitingOnModelLoadText.get())}`;
}

function updateCurrentStatusDirect(data) {
    if (data) {
        num_waiting_gens = data.waiting_gens;
        num_models_loading = data.loading_models;
        num_live_gens = data.live_gens;
        num_backends_waiting = data.waiting_backends;
    }
    let total = num_waiting_gens + num_models_loading + num_live_gens + num_backends_waiting;
    if (isGeneratingPreviews && num_waiting_gens <= getRequiredElementById('usersettings_maxsimulpreviews').value) {
        total = 0;
    }
    getRequiredElementById('alt_interrupt_button').classList.toggle('interrupt-button-none', total == 0);
    let oldInterruptButton = document.getElementById('interrupt_button');
    if (oldInterruptButton) {
        oldInterruptButton.classList.toggle('interrupt-button-none', total == 0);
    }
    let elem = getRequiredElementById('num_jobs_span');
    let timeEstimate = '';
    if (total > 0 && mainGenHandler.totalGensThisRun > 0) {
        let avgGenTime = mainGenHandler.totalGenRunTime / mainGenHandler.totalGensThisRun;
        let estTime = avgGenTime * total;
        timeEstimate = ` (est. ${durationStringify(estTime)})`;
    }
    elem.innerHTML = total == 0 ? (isGeneratingPreviews ? generatingPreviewsText.get() : '') : `${currentGenString(num_waiting_gens, num_models_loading, num_live_gens, num_backends_waiting)} ${timeEstimate}...`;
    let max = Math.max(num_waiting_gens, num_models_loading, num_live_gens, num_backends_waiting);
    setPageTitle(total == 0 ? curAutoTitle : `(${max} ${generatingText.get()}) ${curAutoTitle}`);
}

let doesHaveGenCountUpdateQueued = false;

function updateGenCount() {
    updateCurrentStatusDirect(null);
    if (doesHaveGenCountUpdateQueued) {
        return;
    }
    doesHaveGenCountUpdateQueued = true;
    setTimeout(() => {
        reviseStatusBar();
    }, 500);
}

let hasAppliedFirstRun = false;
let backendsWereLoadingEver = false;
let reviseStatusInterval = null;
let currentBackendFeatureSet = [];
let rawBackendFeatureSet = [];
let lastStatusRequestPending = 0;
function reviseStatusBar() {
    if (lastStatusRequestPending + 20 * 1000 > Date.now()) {
        return;
    }
    if (session_id == null) {
        statusBarElem.innerText = 'Loading...';
        statusBarElem.className = `top-status-bar status-bar-warn`;
        return;
    }
    lastStatusRequestPending = Date.now();
    genericRequest('GetCurrentStatus', {}, data => {
        lastStatusRequestPending = 0;
        if (JSON.stringify(data.supported_features) != JSON.stringify(currentBackendFeatureSet)) {
            rawBackendFeatureSet = data.supported_features;
            currentBackendFeatureSet = data.supported_features;
            reviseBackendFeatureSet();
            hideUnsupportableParams();
        }
        doesHaveGenCountUpdateQueued = false;
        updateCurrentStatusDirect(data.status);
        let status;
        if (versionIsWrong) {
            status = { 'class': 'error', 'message': 'The server has updated since you opened the page, please refresh.' };
        }
        else {
            status = data.backend_status;
            if (data.backend_status.any_loading) {
                backendsWereLoadingEver = true;
            }
            else {
                if (!hasAppliedFirstRun) {
                    hasAppliedFirstRun = true;
                    refreshParameterValues(backendsWereLoadingEver || window.alwaysRefreshOnLoad);
                }
            }
            if (reviseStatusInterval != null) {
                if (status.class != '') {
                    clearInterval(reviseStatusInterval);
                    reviseStatusInterval = setInterval(reviseStatusBar, 2 * 1000);
                }
                else {
                    clearInterval(reviseStatusInterval);
                    reviseStatusInterval = setInterval(reviseStatusBar, 60 * 1000);
                }
            }
        }
        statusBarElem.innerText = translate(status.message);
        statusBarElem.className = `top-status-bar status-bar-${status.class}`;
    });
}

/** Array of functions called on key events (eg model selection change) to update displayed features.
 * Return format [array addMe, array removeMe]. For example `[[], ['sd3']]` indicates that the 'sd3' feature flag is not currently supported (eg by current model).
 * Can use 'curModelCompatClass', 'curModelArch' to check the current model architecture. Note these values may be null.
 * */
let featureSetChangers = [];

function reviseBackendFeatureSet() {
    currentBackendFeatureSet = Array.from(currentBackendFeatureSet);
    let addMe = [], removeMe = [];
    function doCompatFeature(compatClass, featureFlag) {
        if (curModelCompatClass && curModelCompatClass.startsWith(compatClass)) {
            addMe.push(featureFlag);
        }
        else {
            removeMe.push(featureFlag);
        }
    }
    function doAnyCompatFeature(compatClasses, featureFlag) {
        for (let compatClass of compatClasses) {
            if (curModelCompatClass && curModelCompatClass.startsWith(compatClass)) {
                addMe.push(featureFlag);
                return;
            }
        }
        removeMe.push(featureFlag);
    }
    function doAnyArchFeature(archIds, featureFlag) {
        for (let archId of archIds) {
            if (curModelArch && curModelArch.startsWith(archId)) {
                addMe.push(featureFlag);
                return;
            }
        }
        removeMe.push(featureFlag);
    }
    doCompatFeature('stable-diffusion-v3', 'sd3');
    doCompatFeature('stable-cascade-v1', 'cascade');
    doAnyArchFeature(['Flux.1-dev', 'Flux.2-dev', 'hunyuan-video'], 'flux-dev');
    doCompatFeature('stable-diffusion-xl-v1', 'sdxl');
    doAnyCompatFeature(['genmo-mochi-1', 'lightricks-ltx-video', 'hunyuan-video', 'nvidia-cosmos-1', `wan-21`, `wan-22`, 'kandinsky5-vidlite', 'kandinsky5-vidpro'], 'text2video');
    for (let changer of featureSetChangers) {
        let [add, remove] = changer();
        addMe.push(...add);
        removeMe.push(...remove);
    }
    let anyChanged = false;
    for (let add of addMe) {
        if (!currentBackendFeatureSet.includes(add)) {
            currentBackendFeatureSet.push(add);
            anyChanged = true;
        }
    }
    for (let remove of removeMe) {
        let index = currentBackendFeatureSet.indexOf(remove);
        if (index != -1) {
            currentBackendFeatureSet.splice(index, 1);
            anyChanged = true;
        }
    }
    if (anyChanged) {
        hideUnsupportableParams();
        for (let callback of featureSetChangedCallbacks) {
            callback();
        }
    }
}

let toolSelector = getRequiredElementById('tool_selector');
let toolContainer = getRequiredElementById('tool_container');

function genToolsList() {
    let altGenerateButton = getRequiredElementById('alt_generate_button');
    let oldGenerateButton = document.getElementById('generate_button');
    let altGenerateButtonRawText = altGenerateButton.innerText;
    let altGenerateButtonRawOnClick = altGenerateButton.onclick;
    toolSelector.value = '';
    // TODO: Dynamic-from-server option list generation
    toolSelector.addEventListener('change', () => {
        for (let opened of toolContainer.getElementsByClassName('tool-open')) {
            opened.classList.remove('tool-open');
        }
        altGenerateButton.innerText = altGenerateButtonRawText;
        altGenerateButton.onclick = altGenerateButtonRawOnClick;
        if (oldGenerateButton) {
            oldGenerateButton.innerText = altGenerateButtonRawText;
        }
        let tool = toolSelector.value;
        if (tool == '') {
            getRequiredElementById('clear_selected_tool_button').style.display = 'none';
            return;
        }
        let div = getRequiredElementById(`tool_${tool}`);
        div.classList.add('tool-open');
        let override = toolOverrides[tool];
        if (override) {
            altGenerateButton.innerText = override.text;
            altGenerateButton.onclick = override.run;
            if (oldGenerateButton) {
                oldGenerateButton.innerText = override.text;
            }
        }
        div.dispatchEvent(new Event('tool-opened'));
        getRequiredElementById('clear_selected_tool_button').style.display = '';
    });
}

let toolOverrides = {};

function registerNewTool(id, name, genOverride = null, runOverride = null) {
    let option = document.createElement('option');
    option.value = id;
    option.innerText = name;
    toolSelector.appendChild(option);
    let div = createDiv(`tool_${id}`, 'tool');
    toolContainer.appendChild(div);
    if (genOverride) {
        toolOverrides[id] = { 'text': genOverride, 'run': runOverride };
    }
    return div;
}
function disableSelectedTool() {
    toolSelector.value = '';
    triggerChangeFor(toolSelector);
}

let notePadTool = registerNewTool('note_pad', 'Text Notepad');
notePadTool.appendChild(createDiv(`note_pad_tool_wrapper`, `note_pad_tool_wrapper`, `<span class="translate hoverable-minor-hint-text">This is an open text box where you can type any notes you need to keep track of. They will be temporarily persisted in browser session.</span><br><br><textarea id="note_pad_tool" class="auto-text" style="width:100%;height:100%;" placeholder="Type any notes here..."></textarea>`));
let notePadToolElem = getRequiredElementById('note_pad_tool');
notePadToolElem.value = localStorage.getItem('note_pad_tool') || '';
let notePadToolSaveEvent = null;
notePadToolElem.addEventListener('input', () => {
    if (notePadToolSaveEvent) {
        clearTimeout(notePadToolSaveEvent);
    }
    notePadToolSaveEvent = setTimeout(() => {
        localStorage.setItem('note_pad_tool', notePadToolElem.value);
    }, 1000);
    textBoxSizeAdjust(notePadToolElem);
});
notePadTool.addEventListener('tool-opened', () => {
    textBoxSizeAdjust(notePadToolElem);
});

function tweakNegativePromptBox() {
    let altNegText = getRequiredElementById('alt_negativeprompt_textbox');
    let cfgScale = document.getElementById('input_cfgscale');
    let cfgScaleVal = cfgScale ? parseFloat(cfgScale.value) : 7;
    if (cfgScaleVal == 1) {
        altNegText.classList.add('alt-negativeprompt-textbox-invalid');
        altNegText.placeholder = translate(`Negative Prompt is not available when CFG Scale is 1`);
    }
    else {
        altNegText.classList.remove('alt-negativeprompt-textbox-invalid');
        altNegText.placeholder = translate(`Optionally, type a negative prompt here...`);
    }
    altNegText.title = altNegText.placeholder;
}

function loadUserData(callback) {
    genericRequest('GetMyUserData', {}, data => {
        permissions.updateFrom(data.permissions);
        starredModels = data.starred_models;
        autoCompletionsList = {};
        if (data.autocompletions) {
            let allSet = [];
            autoCompletionsList['all'] = allSet;
            for (let val of data.autocompletions) {
                let split = val.split('\n');
                let datalist = autoCompletionsList[val[0]];
                let entry = { name: split[0], low: split[1].replaceAll(' ', '_').toLowerCase(), clean: split[1], raw: val, count: 0, tag: 0 };
                if (split.length > 2) {
                    entry.tag = split[2];
                }
                if (split.length > 3) {
                    count = parseInt(split[3]) || 0;
                    if (count) {
                        entry.count = count;
                        entry.count_display = largeCountStringify(count);
                    }
                }
                if (split.length > 4) {
                    entry.alts = split[4].split(',').map(x => x.trim().toLowerCase());
                    for (let alt of entry.alts) {
                        if (!autoCompletionsList[alt]) {
                            autoCompletionsList[alt] = [];
                        }
                        autoCompletionsList[alt].push(entry);
                    }
                }
                else {
                    entry.alts = [];
                }
                if (!datalist) {
                    datalist = [];
                    autoCompletionsList[val[0]] = datalist;
                }
                datalist.push(entry);
                allSet.push(entry);
            }
        }
        else {
            autoCompletionsList = null;
        }
        if (!language) {
            language = data.language;
        }
        allPresetsUnsorted = data.presets;
        modelPresetLinkManager.loadFromServer(data.model_preset_links);
        sortPresets();
        presetBrowser.lightRefresh();
        if (shouldApplyDefault) {
            shouldApplyDefault = false;
            let defaultPreset = getPresetByTitle('default');
            if (defaultPreset) {
                applyOnePreset(defaultPreset);
            }
        }
        if (callback) {
            callback();
        }
        loadAndApplyTranslations();
    });
}

function updateAllModels(models) {
    simplifiedMap = {};
    for (let key of Object.keys(models)) {
        simplifiedMap[key] = models[key].map(model => {
            return model[0];
        });
    }
    coreModelMap = simplifiedMap;
    allModels = simplifiedMap['Stable-Diffusion'];
    pickle2safetensor_load();
    modelDownloader.reloadFolders();
}

/** Set some element titles via JavaScript (to allow '\n'). */
function setTitles() {
    getRequiredElementById('alt_prompt_textbox').title = "Tell the AI what you want to see, then press Enter to submit.\nConsider 'a photo of a cat', or 'cartoonish drawing of an astronaut'";
    getRequiredElementById('alt_interrupt_button').title = "Interrupt current generation(s)\nRight-click for advanced options.";
    getRequiredElementById('alt_generate_button').title = "Start generating images\nRight-click for advanced options.";
    let oldGenerateButton = document.getElementById('generate_button');
    if (oldGenerateButton) {
        oldGenerateButton.title = getRequiredElementById('alt_generate_button').title;
        getRequiredElementById('interrupt_button').title = getRequiredElementById('alt_interrupt_button').title;
    }
}
setTitles();

function doFeatureInstaller(name, button_div_id, alt_confirm, callback = null, deleteButton = true) {
    if (!confirm(alt_confirm)) {
        return;
    }
    let buttonDiv = button_div_id ? document.getElementById(button_div_id) : null;
    if (buttonDiv) {
        buttonDiv.querySelector('button').disabled = true;
        buttonDiv.appendChild(createDiv('', null, 'Installing...'));
    }
    genericRequest('ComfyInstallFeatures', {'features': name}, data => {
        if (buttonDiv) {
            buttonDiv.appendChild(createDiv('', null, "Installed! Please wait while backends restart. If it doesn't work, you may need to restart Swarm."));
        }
        reviseStatusBar();
        setTimeout(() => {
            if (deleteButton && buttonDiv) {
                buttonDiv.remove();
            }
            hasAppliedFirstRun = false;
            reviseStatusBar();
            if (callback) {
                callback();
            }
        }, 8000);
    }, 0, (e) => {
        showError(e);
        if (buttonDiv) {
            buttonDiv.appendChild(createDiv('', null, 'Failed to install!'));
            buttonDiv.querySelector('button').disabled = false;
        }
    });
}

function installFeatureById(ids, buttonId = null, modalId = null) {
    let notice = '';
    for (let id of ids.split(',')) {
        let feature = comfy_features[id];
        if (!feature) {
            console.error(`Feature ID ${id} not found in comfy_features, can't install`);
            return;
        }
        notice += feature.notice + '\n';
    }
    doFeatureInstaller(ids, buttonId, notice.trim(), () => {
        if (modalId) {
            $(`#${modalId}`).modal('hide');
        }
    });
}

function installTensorRT() {
    doFeatureInstaller('comfyui_tensorrt', 'install_trt_button', `This will install TensorRT support developed by Comfy and NVIDIA.\nDo you wish to install?`, () => {
        getRequiredElementById('tensorrt_mustinstall').style.display = 'none';
        getRequiredElementById('tensorrt_modal_ready').style.display = '';
    });
}

function clearPromptImages() {
    let promptImageArea = getRequiredElementById('alt_prompt_image_area');
    promptImageArea.innerHTML = '';
    let clearButton = getRequiredElementById('alt_prompt_image_clear_button');
    clearButton.style.display = 'none';
    autoRevealRevision();
}

function hideRevisionInputs() {
    let revisionGroup = document.getElementById('input_group_imageprompting');
    let revisionToggler = document.getElementById('input_group_content_imageprompting_toggle');
    if (revisionGroup) {
        revisionToggler.checked = false;
        triggerChangeFor(revisionToggler);
        toggleGroupOpen(revisionGroup, false);
        revisionGroup.style.display = 'none';
    }
    genTabLayout.altPromptSizeHandle();
}

function showRevisionInputs(toggleOn = false) {
    let revisionGroup = document.getElementById('input_group_imageprompting');
    let revisionToggler = document.getElementById('input_group_content_imageprompting_toggle');
    if (revisionGroup) {
        toggleGroupOpen(revisionGroup, true);
        if (toggleOn) {
            revisionToggler.checked = true;
            triggerChangeFor(revisionToggler);
        }
        revisionGroup.style.display = '';
    }
}

revisionRevealerSources = [];

function autoRevealRevision() {
    let promptImageArea = getRequiredElementById('alt_prompt_image_area');
    if (promptImageArea.children.length > 0 || revisionRevealerSources.some(x => x())) {
        showRevisionInputs();
    }
    else {
        hideRevisionInputs();
    }
}

function imagePromptAddImage(file) {
    let clearButton = getRequiredElementById('alt_prompt_image_clear_button');
    let promptImageArea = getRequiredElementById('alt_prompt_image_area');
    let reader = new FileReader();
    reader.onload = (e) => {
        let data = e.target.result;
        let imageContainer = createDiv(null, 'alt-prompt-image-container');
        let imageRemoveButton = createSpan(null, 'alt-prompt-image-container-remove-button', '&times;');
        imageRemoveButton.addEventListener('click', (e) => {
            imageContainer.remove();
            autoRevealRevision();
            genTabLayout.altPromptSizeHandle();
        });
        imageRemoveButton.title = 'Remove this image';
        imageContainer.appendChild(imageRemoveButton);
        let imageObject = new Image();
        imageObject.src = data;
        imageObject.height = 128;
        imageObject.className = 'alt-prompt-image';
        imageObject.dataset.filedata = data;
        imageContainer.appendChild(imageObject);
        clearButton.style.display = '';
        showRevisionInputs(true);
        promptImageArea.appendChild(imageContainer);
        genTabLayout.altPromptSizeHandle();
    };
    reader.readAsDataURL(file);
}

function imagePromptInputHandler() {
    let dragArea = getRequiredElementById('alt_prompt_region');
    dragArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    let clearButton = getRequiredElementById('alt_prompt_image_clear_button');
    clearButton.addEventListener('click', () => {
        clearPromptImages();
    });
    dragArea.addEventListener('drop', (e) => {
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            for (let file of e.dataTransfer.files) {
                if (file.type.startsWith('image/')) {
                    imagePromptAddImage(file);
                }
            }
        }
    });
}
imagePromptInputHandler();

function imagePromptImagePaste(e) {
    let items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let item of items) {
        if (item.kind === 'file') {
            let file = item.getAsFile();
            if (file.type.startsWith('image/')) {
                imagePromptAddImage(file);
            }
        }
    }
}

function openEmptyEditor() {
    let canvas = document.createElement('canvas');
    canvas.width = document.getElementById('input_width').value;
    canvas.height = document.getElementById('input_height').value;
    let ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let image = new Image();
    image.onload = () => {
        imageEditor.clearVars();
        imageEditor.setBaseImage(image);
        imageEditor.activate();
    };
    image.src = canvas.toDataURL();
}

function debugGenAPIDocs() {
    genericRequest('DebugGenDocs', { }, data => { });
}

let hashSubTabMapping = {
    'utilities_tab': 'utilitiestablist',
    'user_tab': 'usertablist',
    'server_tab': 'servertablist',
};

function updateHash() {
    let tabList = getRequiredElementById('toptablist');
    let bottomTabList = getRequiredElementById('bottombartabcollection');
    let activeTopTab = tabList.querySelector('.active');
    let activeBottomTab = bottomTabList.querySelector('.active');
    let activeBottomTabHref = activeBottomTab ? activeBottomTab.href.split('#')[1] : '';
    let activeTopTabHref = activeTopTab ? activeTopTab.href.split('#')[1] : '';
    let hash = `#${activeBottomTabHref},${activeTopTabHref}`;
    let subMapping = hashSubTabMapping[activeTopTabHref];
    if (subMapping) {
        let subTabList = getRequiredElementById(subMapping);
        let activeSubTab = subTabList.querySelector('.active');
        hash += `,${activeSubTab.href.split('#')[1]}`;
    }
    else if (activeTopTabHref == 'Simple') {
        let target = simpleTab.browser.selected || simpleTab.browser.folder;
        if (target) {
            hash += `,${encodeURIComponent(target)}`;
        }
    }
    history.pushState(null, null, hash);
    autoTitle();
}

function loadHashHelper() {
    let tabList = getRequiredElementById('toptablist');
    let bottomTabList = getRequiredElementById('bottombartabcollection');
    let tabs = [... tabList.getElementsByTagName('a')];
    tabs = tabs.concat([... bottomTabList.getElementsByTagName('a')]);
    for (let subMapping of Object.values(hashSubTabMapping)) {
        tabs = tabs.concat([... getRequiredElementById(subMapping).getElementsByTagName('a')]);
    }
    if (location.hash) {
        let split = location.hash.substring(1).split(',');
        let bottomTarget = bottomTabList.querySelector(`a[href='#${split[0]}']`);
        if (bottomTarget && bottomTarget.style.display != 'none') {
            bottomTarget.click();
        }
        let target = tabList.querySelector(`a[href='#${split[1]}']`);
        if (target) {
            target.click();
        }
        let subMapping = hashSubTabMapping[split[1]];
        if (subMapping && split.length > 2) {
            let subTabList = getRequiredElementById(subMapping);
            let subTarget = subTabList.querySelector(`a[href='#${split[2]}']`);
            if (subTarget) {
                subTarget.click();
            }
        }
        else if (split[1] == 'Simple' && split.length > 2) {
            let target = decodeURIComponent(split[2]);
            simpleTab.mustSelectTarget = target;
        }
        autoTitle();
    }
    for (let tab of tabs) {
        tab.addEventListener('click', (e) => {
            updateHash();
        });
    }
}

function clearParamFilterInput() {
    let filter = getRequiredElementById('main_inputs_filter');
    let filterClearer = getRequiredElementById('clear_input_icon');
    if (filter.value.length > 0) {
        filter.value = '';
        filter.focus();
        hideUnsupportableParams();
    }
    filterClearer.style.display = 'none';
}

function genpageLoad() {
    $('#toptablist').on('shown.bs.tab', function (e) {
        let versionDisp = getRequiredElementById('version_display');
        if (e.target.id == 'maintab_comfyworkflow') {
            versionDisp.style.display = 'none';
        }
        else {
            versionDisp.style.display = '';
        }
    });
    
    // EXPOSE PREVIEW FUNCTION
    window.requestGenPreview = function() {
        if (isGeneratingPreviews) {
            return;
        }
        // Safety check to ensure we don't get stuck indefinitely
        setTimeout(() => { if(isGeneratingPreviews) isGeneratingPreviews = false; }, 2000);
        
        if (typeof generatePreviewImage === 'function') {
             generatePreviewImage();
        }
    };
    
    window.imageEditor = new ImageEditor(
        getRequiredElementById('image_editor_input'), 
        true, 
        true, 
        () => genTabLayout.reapplyPositions(), 
        () => window.requestGenPreview()
    );
	
    let editorSizebar = getRequiredElementById('image_editor_sizebar');
    window.imageEditor.onActivate = () => {
        editorSizebar.style.display = '';
    };
    window.imageEditor.onDeactivate = () => {
        editorSizebar.style.display = 'none';
    };
    
    window.imageEditor.tools['options'].optionButtons = [
        ...window.imageEditor.tools['options'].optionButtons,
        { 
            key: 'Store Current Image To History', 
            action: () => {
                let img = window.imageEditor.getFinalImageData();
                storeImageToHistoryWithCurrentParams(img);
            }
        },
        { 
            key: 'Store Full Canvas To History', 
            action: () => {
                let img = window.imageEditor.getMaximumImageData();
                storeImageToHistoryWithCurrentParams(img);
            }
        },
        { 
            key: 'Auto Segment Image (SAM2)', 
            action: () => {
                if (!currentBackendFeatureSet.includes('sam2')) {
                    $('#sam2_installer').modal('show');
                }
                else {
                    let img = window.imageEditor.getFinalImageData();
                    let genData = getGenInput();
                    genData['controlnetimageinput'] = img;
                    genData['controlnetstrength'] = 1;
                    genData['controlnetpreprocessor'] = 'Segment Anything 2 Global Autosegment base_plus';
                    genData['images'] = 1;
                    genData['prompt'] = '';
                    delete genData['batchsize'];
                    genData['donotsave'] = true;
                    genData['controlnetpreviewonly'] = true;
                    makeWSRequestT2I('GenerateText2ImageWS', genData, data => {
                        if (!data.image) {
                            return;
                        }
                        let newImg = new Image();
                        newImg.onload = () => {
                            imageEditor.addImageLayer(newImg);
                        };
                        newImg.src = data.image;
                    });
                }
            }
        }
    ];
    
    // Initialize Layout Engine first

    
    // Prepare Hash Helper
    loadHashHelper();
    
    getSession(() => {
        imageHistoryBrowser.navigate('');
        initialModelListLoad();
        
        genericRequest('ListT2IParams', {}, data => {
            // Process all the model and parameter data
            modelsHelpers.loadClassesFromServer(data.models, data.model_compat_classes, data.model_classes);
            updateAllModels(data.models);
            wildcardHelpers.newWildcardList(data.wildcards);
            [rawGenParamTypesFromServer, rawGroupMapFromServer] = buildParameterList(data.list, data.groups);
            gen_param_types = rawGenParamTypesFromServer;
            
            // Initialize parameter config
            paramConfig.preInit();
            paramConfig.applyParamEdits(data.param_edits);
            
            // Auto-persist parameters
            autoRepersistParams();
            setInterval(autoRepersistParams, 60 * 60 * 1000);
            
            // Generate inputs and tools FIRST
            genInputs();
            genToolsList();

            // --- LAYOUT & STYLE FIXES ---
            try {
                // 1. Reorder Layout: Move Core Settings below Prompt Box
                const promptRegion = getRequiredElementById('alt_prompt_region');
                const mainInputs = getRequiredElementById('main_inputs_area');
                if (promptRegion && mainInputs) {
                    // This ensures settings travel with prompt box to sidebar if moved
                    promptRegion.after(mainInputs);
                }

                // 2. Inject Styles: Bigger Prompt Box + Correct Colors
                const styleFix = document.createElement('style');
                styleFix.innerHTML = `
                    #alt_prompt_textbox {
                        height: 200px !important;
                        min-height: 150px;
                        background-color: var(--input-bg) !important;
                        color: var(--text-color) !important;
                    }
                    /* Fix layout spacing */
                    #alt_prompt_region {
                        margin-bottom: 1rem;
                    }
                    /* Ensure visibility when in tabs/sidebar */
                    .tab-pane #alt_prompt_region, 
                    .tab-pane #main_inputs_area {
                        display: block !important;
                    }
                    /* Force inputs to respect theme colors in sidebar */
                    #main_inputs_area input, #main_inputs_area select {
                        background-color: var(--input-bg);
                        color: var(--text-color);
                    }
                `;
                document.head.appendChild(styleFix);
            } catch (e) {
                console.warn("Layout fix failed:", e);
            }
            // --- END LAYOUT FIXES ---
            
            // THEN load user param config tab after UI is built
            // This must come after genInputs() because it references the generated UI
            if (typeof paramConfig.loadUserParamConfigTab === 'function') {
                paramConfig.loadUserParamConfigTab();
            }
            
			genTabLayout.init();
            // Initial status bar update
            reviseStatusBar();
            
            // Load advanced options state
            getRequiredElementById('advanced_options_checkbox').checked = localStorage.getItem('display_advanced') == 'true';
            toggle_advanced();
            setCurrentModel();
            
            // Load user data and settings
            loadUserData(() => {
                if (permissions.hasPermission('view_backends_list')) {
                    loadBackendTypesMenu();
                }
                selectInitialPresetList();
            });
            
            // Run all session ready callbacks
            for (let callback of sessionReadyCallbacks) {
                callback();
            }
            
            // Show welcome message and set title
            automaticWelcomeMessage();
            autoTitle();
            swarmHasLoaded = true;

            // Force layout refresh now that content exists
            genTabLayout.reapplyPositions(); 
            
            // Start status polling
            reviseStatusInterval = setInterval(reviseStatusBar, 2000);
        });
        
        // Start resource monitoring
        window.resLoopInterval = setInterval(serverResourceLoop, 1000);
    });
}



class EnhancedLoRAManager {
    constructor() {
        this.frequencyStats = JSON.parse(localStorage.getItem('lora_frequency_stats') || '{}');
        this.disabledLoras = [];
        this.containerId = 'enhanced_lora_container';
        this.hasInit = false;
        this.currentSearch = '';
    }

    // Helper to safely escape HTML
    escapeHtml(text) {
        if (typeof escapeHtml === 'function') {
            return escapeHtml(text);
        }
        let div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Helper to trim directory path from LoRA name
    trimLoraName(name) {
        if (name.includes('/')) {
            name = name.substring(name.lastIndexOf('/') + 1);
        }
        if (name.includes('\\')) {
            name = name.substring(name.lastIndexOf('\\') + 1);
        }
        if (name.endsWith('.safetensors')) {
            name = name.substring(0, name.length - '.safetensors'.length);
        }
        if (name.endsWith('.ckpt')) {
            name = name.substring(0, name.length - '.ckpt'.length);
        }
        return name;
    }

    init() {
        if (this.hasInit) return;
        this.hasInit = true;
        
        this.hookLoraHelper();
        this.initUI();
    }

    hookLoraHelper() {
        if (!window.loraHelper) {
            console.warn('LoRA Helper not ready, will retry...');
            setTimeout(() => this.hookLoraHelper(), 100);
            return;
        }

        const originalSelect = loraHelper.selectLora.bind(loraHelper);
        loraHelper.selectLora = (lora) => {
            let name = (typeof lora === 'string') ? lora : lora.name;
            if (name) {
                let isSelected = loraHelper.selected.find(l => l.name == name);
                if (!isSelected) { 
                    this.incrementUsage(name); 
                }
            }
            originalSelect(lora);
            this.updateActiveTab();
            this.updateFrequentTab(); 
            this.updateLibraryTab(this.currentSearch);
        };

        const originalRebuild = loraHelper.rebuildUI.bind(loraHelper);
        loraHelper.rebuildUI = () => {
            originalRebuild();
            this.updateActiveTab();
            this.updateDisabledTab();
            this.updateLibraryTab(this.currentSearch);
        };
    }

    incrementUsage(loraName) {
        let clean = cleanModelName(loraName);
        this.frequencyStats[clean] = (this.frequencyStats[clean] || 0) + 1;
        localStorage.setItem('lora_frequency_stats', JSON.stringify(this.frequencyStats));
    }

    getSortedFrequentLoras() {
        return Object.entries(this.frequencyStats)
            .sort(([, a], [, b]) => b - a)
            .map(([name]) => name);
    }

    initUI() {
        let container = document.getElementById(this.containerId);
        
        // Auto-fix: If container doesn't exist, create it (likely missing from HTML template)
        if (!container) {
            // Try to find the standard LoRA container or insert after tools
            let targetArea = document.getElementById('tool_container');
            if (targetArea && targetArea.parentNode) {
                let newContainer = document.createElement('div');
                newContainer.id = this.containerId;
                newContainer.className = 'input-group'; // Standard class
                targetArea.parentNode.insertBefore(newContainer, targetArea.nextSibling);
                container = newContainer;
                // Add a header for consistency with other groups
                let header = document.createElement('div');
                header.innerHTML = '<span class="header-label">Enhanced LoRA Manager</span>';
                header.className = 'input-group-header';
                container.parentNode.insertBefore(header, container);
            } else {
                 console.error('Enhanced LoRA: Could not find insertion point.');
                 return;
            }
        }

        const styles = `
            .lora-tab-system { 
                border: 1px solid var(--border-color); 
                border-radius: 8px; 
                overflow: hidden; 
                display: flex; 
                flex-direction: column; 
                background: var(--bg-secondary);
                color: var(--text-color);
            }
            .lora-tabs { 
                display: flex; 
                background: var(--bg-secondary); 
                border-bottom: 1px solid var(--border-color); 
                flex-shrink: 0; 
            }
            .lora-tab-btn { 
                flex: 1; 
                padding: 8px; 
                border: none; 
                background: transparent; 
                color: var(--text-color); 
                cursor: pointer; 
                border-bottom: 3px solid transparent; 
                transition: all 0.2s; 
                font-size: 0.85rem; 
            }
            .lora-tab-btn:hover { background: rgba(255,255,255,0.05); }
            .lora-tab-btn.active { 
                border-bottom-color: var(--color-primary); 
                font-weight: bold; 
                background: var(--bg-color);
            }
            
            .lora-tab-content { 
                height: 400px; 
                width: 100%;
                display: none; /* Hidden by default */
                flex-direction: column;
                box-sizing: border-box;
                background: var(--bg-color) !important;
                color: var(--text-color) !important;
            }
            
            /* Strict visibility control */
            .lora-tab-content.active { display: flex !important; }
            
            /* Scrollable areas inside tabs */
            .lora-scroll-area {
                padding: 10px;
                overflow-y: auto;
                overflow-x: hidden;
                flex-grow: 1;
                width: 100%;
                box-sizing: border-box;
            }

            /* Container for chips */
            .lora-chip-container {
                display: flex;
                flex-wrap: wrap;
                align-content: flex-start;
                gap: 6px;
                width: 100%;
            }
            
            .lora-chip { 
                display: block;
                background: var(--bg-secondary); 
                border: 1px solid var(--border-color); 
                padding: 5px 10px; 
                border-radius: 6px; 
                cursor: pointer; 
                font-size: 0.85rem; 
                transition: all 0.2s;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                max-width: 100%;
                user-select: none;
                color: var(--text-color);
            }
            
            .lora-chip:hover { 
                border-color: var(--color-primary); 
                transform: translateY(-1px); 
            }

            /* Status Colors for Library */
            .lora-chip.is-active {
                border-color: #4caf50;
                background: rgba(76, 175, 80, 0.1);
                color: #4caf50;
            }
            .lora-chip.is-disabled {
                border-color: #f44336;
                background: rgba(244, 67, 54, 0.1);
                opacity: 0.8;
                text-decoration: line-through;
            }
            
            /* Search Bar Pinned to Top */
            .lora-search-wrapper {
                padding: 10px;
                background: var(--bg-secondary);
                border-bottom: 1px solid var(--border-color);
                flex-shrink: 0;
            }
            
            .lora-search-input { 
                width: 100%; 
                padding: 8px; 
                border-radius: 4px; 
                border: 1px solid var(--border-color); 
                background: var(--input-bg) !important; 
                color: var(--text-color) !important;
                box-sizing: border-box;
            }
            
            .lora-ctrl-btn { 
                background: var(--bg-secondary); 
                border: 1px solid var(--border-color); 
                color: var(--text-color); 
                cursor: pointer; 
                padding: 2px 8px; 
                margin: 0 2px; 
                border-radius: 4px; 
                font-weight: bold; 
                font-size: 0.85rem;
            }
            .lora-ctrl-btn:hover { background: var(--color-primary); color: white; }
            
            .lora-disabled-item { 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                background: rgba(0,0,0,0.2); 
                border: 1px dashed var(--border-color); 
                padding: 8px; 
                margin-bottom: 6px; 
                border-radius: 4px;
                width: 100%;
                box-sizing: border-box;
                color: var(--text-color);
            }
            
            .lora-empty-state {
                text-align: center; 
                color: var(--text-muted); 
                font-style: italic; 
                padding: 30px;
                width: 100%;
            }
            
            .enhanced-lora-row {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px;
                margin-bottom: 6px;
                background: var(--bg-secondary);
                border-radius: 4px;
                width: 100%;
                box-sizing: border-box;
                color: var(--text-color);
            }
            
            /* FORCE INPUT COLORS for "Inverted" situations */
            #enhanced_lora_container input, 
            #enhanced_lora_container textarea {
                background-color: var(--input-bg) !important;
                color: var(--text-color) !important;
            }
        `;
        
        if (!document.getElementById('enhanced-lora-styles')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'enhanced-lora-styles';
            styleEl.innerHTML = styles;
            document.head.appendChild(styleEl);
        }

        container.innerHTML = `
            <div class="lora-tab-system">
                <div class="lora-tabs">
                    <button class="lora-tab-btn active" data-target="lora-tab-active">Active</button>
                    <button class="lora-tab-btn" data-target="lora-tab-disabled">Disabled</button>
                    <button class="lora-tab-btn" data-target="lora-tab-frequent">Frequent</button>
                    <button class="lora-tab-btn" data-target="lora-tab-library">Library</button>
                </div>
                
                <div id="lora-tab-active" class="lora-tab-content active">
                    <div class="lora-scroll-area">
                        <div id="lora-active-list"></div>
                        <div id="lora-active-placeholder" class="lora-empty-state">
                            No LoRAs selected. Go to the Library tab to add some!
                        </div>
                    </div>
                </div>
                
                <div id="lora-tab-disabled" class="lora-tab-content">
                    <div class="lora-scroll-area">
                        <div id="lora-disabled-list"></div>
                        <div id="lora-disabled-placeholder" class="lora-empty-state">No disabled LoRAs.</div>
                    </div>
                </div>

                <div id="lora-tab-frequent" class="lora-tab-content">
                    <div class="lora-scroll-area">
                        <div id="lora-frequent-list" class="lora-chip-container"></div>
                        <div id="lora-frequent-placeholder" class="lora-empty-state" style="display:none">No usage history yet.</div>
                    </div>
                </div>
                
                <div id="lora-tab-library" class="lora-tab-content">
                    <div class="lora-search-wrapper">
                        <input type="text" class="lora-search-input" placeholder="Search available LoRAs..." id="lora-tab-search-bar">
                    </div>
                    <div class="lora-scroll-area">
                        <div id="lora-library-list" class="lora-chip-container"></div>
                    </div>
                </div>
            </div>
        `;

        this.setupTabs(container);
        this.setupSearch();
        this.updateActiveTab();
        this.updateDisabledTab();
        this.updateFrequentTab();
        setTimeout(() => this.updateLibraryTab(), 500);
    }

    setupTabs(wrapper) {
        let buttons = wrapper.querySelectorAll('.lora-tab-btn');
        let panes = wrapper.querySelectorAll('.lora-tab-content');

        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                // Deactivate all
                buttons.forEach(b => b.classList.remove('active'));
                panes.forEach(p => p.classList.remove('active'));
                
                // Activate clicked
                btn.classList.add('active');
                let target = document.getElementById(btn.dataset.target);
                if (target) target.classList.add('active');
                
                if(btn.dataset.target === 'lora-tab-library') this.updateLibraryTab(this.currentSearch);
            });
        });
    }

    updateActiveTab() {
        let container = document.getElementById('lora-active-list');
        let placeholder = document.getElementById('lora-active-placeholder');
        
        if (!container || !placeholder) return;
        
        container.innerHTML = '';
        
        if (!loraHelper.selected || loraHelper.selected.length === 0) {
            placeholder.style.display = 'block';
            return;
        }
        
        placeholder.style.display = 'none';
        
        loraHelper.selected.forEach((loraObj, index) => {
            let row = document.createElement('div');
            row.className = 'enhanced-lora-row';
            
            // Name
            let nameSpan = document.createElement('span');
            nameSpan.style.cssText = 'flex: 1 1 auto; min-width: 100px; font-weight: bold; overflow: hidden; text-overflow: ellipsis;';
            nameSpan.title = loraObj.name;
            nameSpan.innerText = this.trimLoraName(cleanModelName(loraObj.name));
            row.appendChild(nameSpan);
            
            // Weight Controls
            let weightWrapper = document.createElement('span');
            weightWrapper.style.cssText = 'display: flex; align-items: center; gap: 4px; flex-shrink: 0;';
            
            let minusBtn = document.createElement('button');
            minusBtn.className = 'lora-ctrl-btn';
            minusBtn.innerText = '-';
            minusBtn.onclick = (e) => {
                e.preventDefault();
                loraObj.setWeight(Math.round((loraObj.weight - 0.1) * 100) / 100);
                loraHelper.rebuildParams();
                loraHelper.rebuildUI();
                this.updateActiveTab();
            };
            
            let weightInput = document.createElement('input');
            weightInput.type = 'number';
            weightInput.className = 'auto-number';
            weightInput.style.cssText = 'width: 60px;';
            weightInput.value = loraObj.weight;
            weightInput.step = 0.1;
            weightInput.onchange = () => {
                loraObj.setWeight(parseFloat(weightInput.value));
                loraHelper.rebuildParams();
                loraHelper.rebuildUI();
            };
            
            let plusBtn = document.createElement('button');
            plusBtn.className = 'lora-ctrl-btn';
            plusBtn.innerText = '+';
            plusBtn.onclick = (e) => {
                e.preventDefault();
                loraObj.setWeight(Math.round((loraObj.weight + 0.1) * 100) / 100);
                loraHelper.rebuildParams();
                loraHelper.rebuildUI();
                this.updateActiveTab();
            };
            
            weightWrapper.appendChild(minusBtn);
            weightWrapper.appendChild(weightInput);
            weightWrapper.appendChild(plusBtn);
            row.appendChild(weightWrapper);
            
            // Disable
            let disableBtn = document.createElement('button');
            disableBtn.className = 'lora-ctrl-btn';
            disableBtn.innerHTML = 'ðŸ‘ï¸';
            disableBtn.title = 'Disable (Move to Disabled tab)';
            disableBtn.onclick = (e) => {
                e.preventDefault();
                this.disabledLoras.push(loraObj);
                loraHelper.selected.splice(index, 1);
                loraHelper.rebuildUI();
            };
            row.appendChild(disableBtn);
            
            // Remove
            let removeBtn = document.createElement('button');
            removeBtn.className = 'lora-ctrl-btn';
            removeBtn.innerHTML = 'Ã—';
            removeBtn.title = 'Remove completely';
            removeBtn.onclick = (e) => {
                e.preventDefault();
                loraHelper.selectLora(loraObj);
            };
            row.appendChild(removeBtn);
            
            container.appendChild(row);
        });
    }

    updateDisabledTab() {
        let container = document.getElementById('lora-disabled-list');
        let placeholder = document.getElementById('lora-disabled-placeholder');
        if (!container || !placeholder) return;

        container.innerHTML = '';

        if (this.disabledLoras.length === 0) {
            placeholder.style.display = 'block';
            return;
        }

        placeholder.style.display = 'none';

        this.disabledLoras.forEach((loraObj, index) => {
            let div = document.createElement('div');
            div.className = 'lora-disabled-item';

            let info = document.createElement('div');
            let trimmedName = this.trimLoraName(cleanModelName(loraObj.name));
            info.innerHTML = `<strong title="${this.escapeHtml(loraObj.name)}">${this.escapeHtml(trimmedName)}</strong> <span style="font-size:0.85em; opacity:0.7">(${loraObj.weight})</span>`;
            
            let btnGroup = document.createElement('div');
            
            let enableBtn = document.createElement('button');
            enableBtn.className = 'lora-ctrl-btn';
            enableBtn.innerHTML = 'ðŸ‘ï¸';
            enableBtn.title = "Re-enable";
            enableBtn.onclick = () => {
                this.disabledLoras.splice(index, 1);
                loraHelper.selected.push(loraObj);
                loraHelper.rebuildUI();
                document.querySelector('[data-target="lora-tab-active"]').click();
            };

            let delBtn = document.createElement('button');
            delBtn.className = 'lora-ctrl-btn';
            delBtn.innerHTML = 'âœ–';
            delBtn.title = "Remove";
            delBtn.onclick = () => {
                this.disabledLoras.splice(index, 1);
                this.updateDisabledTab();
                this.updateLibraryTab(this.currentSearch); // Update colors
            };

            btnGroup.appendChild(enableBtn);
            btnGroup.appendChild(delBtn);
            div.appendChild(info);
            div.appendChild(btnGroup);
            container.appendChild(div);
        });
    }

    updateFrequentTab() {
        let container = document.getElementById('lora-frequent-list');
        let placeholder = document.getElementById('lora-frequent-placeholder');
        if (!container) return;

        let sorted = this.getSortedFrequentLoras();
        if (sorted.length === 0) {
            container.innerHTML = '';
            placeholder.style.display = 'block';
            return;
        }
        
        placeholder.style.display = 'none';
        container.innerHTML = '';
        
        sorted.slice(0, 50).forEach(name => {
            let chip = document.createElement('div');
            chip.className = 'lora-chip';
            let trimmedName = this.trimLoraName(name);
            chip.title = `${this.escapeHtml(name)} - Used ${this.frequencyStats[name]} times`;
            chip.innerHTML = `${this.escapeHtml(trimmedName)} <span style="opacity:0.6;font-size:0.8em">(${this.frequencyStats[name]})</span>`;
            
            chip.onclick = () => {
                loraHelper.selectLora(name);
                document.querySelector('[data-target="lora-tab-active"]').click();
            };
            container.appendChild(chip);
        });
    }

    setupSearch() {
        let searchBar = document.getElementById('lora-tab-search-bar');
        if (searchBar) {
            searchBar.addEventListener('input', (e) => {
                this.currentSearch = e.target.value;
                this.updateLibraryTab(this.currentSearch);
            });
        }
    }

    updateLibraryTab(filter = '') {
        let container = document.getElementById('lora-library-list');
        if (!container) return;
        
        let loraList = [];
        if (typeof coreModelMap !== 'undefined') {
            if (coreModelMap['LoRA']) {
                loraList = coreModelMap['LoRA'];
            } else {
                let key = Object.keys(coreModelMap).find(k => k.toLowerCase().includes('lora'));
                if (key) loraList = coreModelMap[key];
            }
        }

        if (!loraList || loraList.length === 0) {
            container.innerHTML = '<div class="lora-empty-state">Loading LoRAs...</div>';
            return;
        }

        container.innerHTML = '';
        let lcFilter = filter.toLowerCase();
        let count = 0;
        
        for (let lora of loraList) {
            if (count > 100 && filter.length === 0) break;
            
            let name = (typeof lora === 'string') ? lora : lora.name || lora[0];
            let clean = cleanModelName(name);
            let trimmedName = this.trimLoraName(clean);

            if (filter && !clean.toLowerCase().includes(lcFilter) && !trimmedName.toLowerCase().includes(lcFilter)) continue;

            // Check Status
            let isActive = loraHelper.selected.find(l => l.name == name);
            let isDisabled = this.disabledLoras.find(l => l.name == name);

            let chip = document.createElement('div');
            chip.className = 'lora-chip';
            if (isActive) chip.classList.add('is-active');
            if (isDisabled) chip.classList.add('is-disabled');
            
            chip.title = this.escapeHtml(clean);
            chip.innerText = trimmedName;
            
            chip.onclick = () => {
                if (isDisabled) {
                    // If disabled, clicking re-enables it
                    let idx = this.disabledLoras.findIndex(l => l.name == name);
                    if (idx > -1) {
                        let obj = this.disabledLoras[idx];
                        this.disabledLoras.splice(idx, 1);
                        loraHelper.selected.push(obj);
                    }
                } else if (isActive) {
                    // If active, clicking focuses it (optional, currently just selects again which might toggle or do nothing)
                     // Or we could remove it? standard behavior is usually toggle or add. 
                     // loraHelper.selectLora usually toggles or adds.
                    loraHelper.selectLora(name);
                } else {
                    // Add new
                    loraHelper.selectLora(name);
                }
                
                // Refresh UI
                loraHelper.rebuildUI();
                document.querySelector('[data-target="lora-tab-active"]').click();
            };
            container.appendChild(chip);
            count++;
        }
        
        if (count === 0 && filter) {
            container.innerHTML = '<div class="lora-empty-state">No LoRAs found.</div>';
        }
    }
}

// Initialize when the page is ready
sessionReadyCallbacks.push(() => {
    // Apply enhancements to LoRA and Embedding browsers
    if (typeof sdLoraBrowser !== 'undefined') {
        enhanceBrowserWithDropdown(sdLoraBrowser.browser);
    }
    if (typeof sdEmbedBrowser !== 'undefined') {
        enhanceBrowserWithDropdown(sdEmbedBrowser.browser);
    }
    
    // Initialize Enhanced LoRA Manager
    const enhancedLoRAManager = new EnhancedLoRAManager();
    enhancedLoRAManager.init();
    window.enhancedLoRAManager = enhancedLoRAManager;
    
    console.log('Enhanced browser views and LoRA manager applied');
});
