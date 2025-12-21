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
    window.imageEditor = new ImageEditor(getRequiredElementById('image_editor_input'), true, true, () => genTabLayout.reapplyPositions(), () => needsNewPreview());
    let editorSizebar = getRequiredElementById('image_editor_sizebar');
    window.imageEditor.onActivate = () => {
        editorSizebar.style.display = '';
    };
    window.imageEditor.onDeactivate = () => {
        editorSizebar.style.display = 'none';
    };
    window.imageEditor.tools['options'].optionButtons = [
        ... window.imageEditor.tools['options'].optionButtons,
        { key: 'Store Current Image To History', action: () => {
            let img = window.imageEditor.getFinalImageData();
            storeImageToHistoryWithCurrentParams(img);
        }},
        { key: 'Store Full Canvas To History', action: () => {
            let img = window.imageEditor.getMaximumImageData();
            storeImageToHistoryWithCurrentParams(img);
        }},
        { key: 'Auto Segment Image (SAM2)', action: () => {
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
        }}
    ];
    genTabLayout.init();
    reviseStatusBar();
    loadHashHelper();
    getSession(() => {
        imageHistoryBrowser.navigate('');
        initialModelListLoad();
        genericRequest('ListT2IParams', {}, data => {
            modelsHelpers.loadClassesFromServer(data.models, data.model_compat_classes, data.model_classes);
            updateAllModels(data.models);
            wildcardHelpers.newWildcardList(data.wildcards);
            [rawGenParamTypesFromServer, rawGroupMapFromServer] = buildParameterList(data.list, data.groups);
            gen_param_types = rawGenParamTypesFromServer;
            paramConfig.preInit();
            paramConfig.applyParamEdits(data.param_edits);
            paramConfig.loadUserParamConfigTab();
            autoRepersistParams();
            setInterval(autoRepersistParams, 60 * 60 * 1000); // Re-persist again hourly if UI left over
            genInputs();
            genToolsList();
            reviseStatusBar();
            getRequiredElementById('advanced_options_checkbox').checked = localStorage.getItem('display_advanced') == 'true';
            toggle_advanced();
            setCurrentModel();
            loadUserData(() => {
                if (permissions.hasPermission('view_backends_list')) {
                    loadBackendTypesMenu();
                }
                selectInitialPresetList();
            });
            for (let callback of sessionReadyCallbacks) {
                callback();
            }
            automaticWelcomeMessage();
            autoTitle();
            swarmHasLoaded = true;
        });
        reviseStatusInterval = setInterval(reviseStatusBar, 2000);
        window.resLoopInterval = setInterval(serverResourceLoop, 1000);
    });
}

/**
 * ------------------------------------------------------------------
 * BETTER LORA MANAGER (TABBED + FAVORITES)
 * ------------------------------------------------------------------
 * Replaces the default LoRA input group with a Tabbed UI.
 * Features: Active List, Full Library, Usage Tracking, and Favorites.
 */

class BetterLoraManager {
    constructor() {
        this.favorites = JSON.parse(localStorage.getItem('lora_favorites') || '[]');
        this.recent = JSON.parse(localStorage.getItem('lora_recent_history') || '[]');
        this.showFavoritesOnly = false;
        
        // Wait for Swarm to be ready
        if (typeof sessionReadyCallbacks !== 'undefined') {
            sessionReadyCallbacks.push(() => this.init());
        } else {
            // Fallback if injected too late
            setTimeout(() => this.init(), 2000);
        }

        // Hook into model refresh to update library
        let originalUpdate = window.updateAllModels;
        window.updateAllModels = (models) => {
            if(originalUpdate) originalUpdate(models);
            this.renderLibrary();
        };
    }

    init() {
        // Find the specific container for LoRAs in the parameter list
        const loraGroupContent = document.getElementById('input_group_content_loras');
        if (!loraGroupContent) return; // Parameter group not found

        // 1. Hide the original input mechanisms (but keep them in DOM so engine works)
        // We hide the standard dropdown and weight sliders generated by params.js
        const originalInputs = loraGroupContent.children;
        for(let child of originalInputs) {
            child.style.display = 'none';
        }

        // 2. Create our UI Wrapper
        const myWrapper = document.createElement('div');
        myWrapper.id = 'better_lora_manager_ui';
        myWrapper.innerHTML = `
            <style>
                .blm-tabs { display: flex; border-bottom: 1px solid var(--border-color); margin-bottom: 10px; }
                .blm-tab { flex: 1; text-align: center; padding: 8px; cursor: pointer; opacity: 0.7; border-bottom: 2px solid transparent; }
                .blm-tab:hover { background: var(--bg-secondary); opacity: 1; }
                .blm-tab.active { opacity: 1; font-weight: bold; border-bottom-color: var(--color-primary); }
                
                .blm-content { display: none; max-height: 500px; overflow-y: auto; scrollbar-width: thin; }
                .blm-content.active { display: block; }

                /* Library Items */
                .blm-item { display: flex; align-items: center; padding: 4px 8px; border-bottom: 1px solid var(--border-color); font-size: 0.9rem; }
                .blm-item:hover { background: var(--bg-secondary); }
                .blm-star { cursor: pointer; margin-right: 8px; font-size: 1.2rem; line-height: 1; color: var(--text-muted); }
                .blm-star.is-fav { color: gold; }
                .blm-name { flex: 1; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                
                /* Search & Filter Bar */
                .blm-toolbar { display: flex; gap: 5px; margin-bottom: 8px; align-items: center; }
                .blm-search { flex: 1; padding: 5px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-color); }
                
                /* Active Sliders */
                .blm-active-row { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px; margin-bottom: 6px; }
                .blm-active-header { display: flex; justify-content: space-between; margin-bottom: 4px; font-weight: bold; font-size: 0.85rem; }
                .blm-remove { color: #ff6b6b; cursor: pointer; font-weight: bold; }
                .blm-slider-row { display: flex; align-items: center; gap: 5px; font-size: 0.8rem; }
                .blm-slider-row input[type=range] { flex: 1; }
                .blm-num-input { width: 50px; text-align: right; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--border-color); }
            </style>

            <div class="blm-tabs">
                <div class="blm-tab active" onclick="betterLoraManager.switchTab('active')">Selected <span id="blm_count">(0)</span></div>
                <div class="blm-tab" onclick="betterLoraManager.switchTab('library')">Library</div>
            </div>

            <!-- TAB: ACTIVE (Selected LoRAs with Sliders) -->
            <div id="blm_tab_active" class="blm-content active">
                <div id="blm_active_list"></div>
                <div id="blm_empty_msg" style="text-align:center; padding:20px; color:var(--text-muted);">
                    No LoRAs selected.<br>Go to Library to add one.
                </div>
            </div>

            <!-- TAB: LIBRARY (List of all LoRAs) -->
            <div id="blm_tab_library" class="blm-content">
                <div class="blm-toolbar">
                    <input type="text" id="blm_search" class="blm-search" placeholder="Search LoRAs..." oninput="betterLoraManager.renderLibrary()">
                    <label style="display:flex; align-items:center; font-size:0.8rem; cursor:pointer; gap:4px;" title="Show Favorites Only">
                        <input type="checkbox" id="blm_fav_filter" onchange="betterLoraManager.toggleFavFilter()"> Favs
                    </label>
                </div>
                <div id="blm_library_list">Loading...</div>
            </div>
        `;
        
        loraGroupContent.appendChild(myWrapper);

        // Hook loraHelper to refresh our UI when selection changes
        if (window.loraHelper) {
            const originalRebuild = loraHelper.rebuildUI.bind(loraHelper);
            loraHelper.rebuildUI = () => {
                originalRebuild(); // Let core do its thing (populating hidden inputs)
                this.renderActive(); // Update our custom UI
            };
        }

        // Initial Render
        this.renderLibrary();
        this.renderActive();
    }

    switchTab(tabName) {
        document.getElementById('blm_tab_active').classList.toggle('active', tabName === 'active');
        document.getElementById('blm_tab_library').classList.toggle('active', tabName === 'library');
        
        const tabs = document.querySelectorAll('.blm-tab');
        tabs[0].classList.toggle('active', tabName === 'active');
        tabs[1].classList.toggle('active', tabName === 'library');
    }

    toggleFavFilter() {
        this.showFavoritesOnly = document.getElementById('blm_fav_filter').checked;
        this.renderLibrary();
    }

    toggleFavorite(loraName) {
        const index = this.favorites.indexOf(loraName);
        if (index > -1) {
            this.favorites.splice(index, 1);
        } else {
            this.favorites.push(loraName);
        }
        localStorage.setItem('lora_favorites', JSON.stringify(this.favorites));
        this.renderLibrary(); // Re-render to update stars
    }

    renderLibrary() {
        const container = document.getElementById('blm_library_list');
        if (!container) return;

        // Get Search Term
        const searchTerm = (document.getElementById('blm_search')?.value || '').toLowerCase();

        // Get Models list safely
        let loras = [];
        if (typeof modelsHelpers !== 'undefined') {
            loras = modelsHelpers.listModelNames('LoRA');
        } else if (typeof coreModelMap !== 'undefined' && coreModelMap['LoRA']) {
            loras = coreModelMap['LoRA'];
        }

        if (!loras || loras.length === 0) {
            container.innerHTML = "No LoRAs found or still loading...";
            return;
        }

        container.innerHTML = '';
        let count = 0;

        // Sort: Favorites first, then alphabetical
        loras.sort((a, b) => {
            let aFav = this.favorites.includes(cleanModelName(a));
            let bFav = this.favorites.includes(cleanModelName(b));
            if (aFav && !bFav) return -1;
            if (!aFav && bFav) return 1;
            return a.localeCompare(b);
        });

        for (let lora of loras) {
            let cleanName = cleanModelName(lora);
            
            // Filters
            if (this.showFavoritesOnly && !this.favorites.includes(cleanName)) continue;
            if (searchTerm && !cleanName.toLowerCase().includes(searchTerm)) continue;

            if (count > 200) break; // Render limit

            const isFav = this.favorites.includes(cleanName);
            const div = document.createElement('div');
            div.className = 'blm-item';
            div.innerHTML = `
                <span class="blm-star ${isFav ? 'is-fav' : ''}" onclick="betterLoraManager.toggleFavorite('${cleanName}')">★</span>
                <span class="blm-name" title="${cleanName}">${cleanName}</span>
                <button class="basic-button" style="font-size:0.7rem; padding: 2px 6px;">Add</button>
            `;
            
            // Click name or button to add
            div.querySelector('.blm-name').onclick = () => this.selectLora(cleanName);
            div.querySelector('button').onclick = () => this.selectLora(cleanName);

            container.appendChild(div);
            count++;
        }

        if (count === 0) container.innerHTML = "<div style='padding:10px; opacity:0.6'>No matching LoRAs found.</div>";
    }

    selectLora(name) {
        if (window.loraHelper) {
            loraHelper.selectLora(name);
            // Switch to Active tab to show the user it was added
            this.switchTab('active');
        }
    }

    renderActive() {
        const container = document.getElementById('blm_active_list');
        const countSpan = document.getElementById('blm_count');
        const emptyMsg = document.getElementById('blm_empty_msg');
        
        if (!container || !window.loraHelper) return;

        const selected = loraHelper.selected;
        countSpan.innerText = `(${selected.length})`;
        
        if (selected.length === 0) {
            container.innerHTML = '';
            emptyMsg.style.display = 'block';
            return;
        }

        emptyMsg.style.display = 'none';
        container.innerHTML = '';

        selected.forEach(lora => {
            const div = document.createElement('div');
            div.className = 'blm-active-row';
            
            // Build Inputs
            const weightVal = lora.weight || 1.0;
            
            div.innerHTML = `
                <div class="blm-active-header">
                    <span style="overflow:hidden; text-overflow:ellipsis" title="${lora.name}">${lora.name}</span>
                    <span class="blm-remove" onclick="betterLoraManager.removeLora('${lora.name}')">✕</span>
                </div>
                <div class="blm-slider-row">
                    <span>W:</span>
                    <input type="range" class="blm-weight-range" min="-2" max="2" step="0.1" value="${weightVal}">
                    <input type="number" class="blm-weight-num blm-num-input" step="0.1" value="${weightVal}">
                </div>
            `;

            // Bind Events manually to avoid string escaping hell
            const range = div.querySelector('.blm-weight-range');
            const num = div.querySelector('.blm-weight-num');

            const updateWeight = (val) => {
                lora.weight = parseFloat(val);
                range.value = val;
                num.value = val;
                loraHelper.rebuildParams(); // Tell Swarm engine parameters changed
            };

            range.oninput = (e) => updateWeight(e.target.value);
            num.onchange = (e) => updateWeight(e.target.value);

            container.appendChild(div);
        });
    }

    removeLora(name) {
        if(window.loraHelper) {
            loraHelper.selectLora(name); // Toggle off
        }
    }
}

// Initialize Global Instance
window.betterLoraManager = new BetterLoraManager();