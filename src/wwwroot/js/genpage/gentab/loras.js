class SelectedLora {
    constructor(name, weight, confinement, model) {
        this.name = name;
        this.weight = weight === 0 ? 0 : (weight || (model && model.lora_default_weight ? parseFloat(model.lora_default_weight) : null) || loraHelper.loraWeightPref[name] || 1);
        this.confinement = confinement === 0 ? 0 : (confinement || (model && model.lora_default_confinement ? parseInt(model.lora_default_confinement) : null) || loraHelper.loraConfinementPref[name] || 0);
        this.model = model;
    }

    setWeight(weight) {
        this.weight = weight;
        loraHelper.loraWeightPref[this.name] = weight;
    }

    setConfinement(confinement) {
        this.confinement = confinement;
        loraHelper.loraConfinementPref[this.name] = confinement;
    }
}

/** Helper class for managing LoRA selections in the UI. */
class LoraHelper {

    /** List of currently selected LoRAs. */
    selected = [];

    /** Map of rendered LoRA names to their UI elements. */
    rendered = {};

    /** Map of LoRA names to their last-used weights. */
    loraWeightPref = {};

    /** Map of LoRA names to their last-used confinements. */
    loraConfinementPref = {};

    /** If true, the helper is currently modifying parameters, and should not reload from parameter change events. */
    dedup = false;

    /** Map of LoRA confinement values to their display names. */
    confinementNames = {
        0: 'Global',
        5: 'Base',
        1: 'Refiner',
        2: 'Video',
        3: 'VideoSwap'
    }

    /** Get the "LoRAs" parameter input element. */
    getLorasInput() {
        return document.getElementById('input_loras');
    }

    /** Get the currently selected LoRAs from the "LoRAs" parameter input element. */
    getLoraParamSelections() {
        let loraInput = this.getLorasInput();
        if (!loraInput) {
            return [];
        }
        return [...loraInput.selectedOptions].map(option => option.value);
    }

    /** Get the "LoRA Weights" parameter type info. */
    getWeightsParam() {
        return gen_param_types.find(p => p.id == 'loraweights');
    }

    /** Get the "LoRA Weights" parameter input element. */
    getLoraWeightsInput() {
        return document.getElementById('input_loraweights');
    }

    /** Get the "LoRA Section Confinement" parameter input element. */
    getLoraConfinementInput() {
        return document.getElementById('input_lorasectionconfinement');
    }

    /** Get the container element for the bottom-bar LoRA listing UI. */
    getUIListContainer() {
        return getRequiredElementById('current_lora_list_view');
    }

    /** Load the current LoRA selections from parameter data. */
    loadFromParams() {
        if (this.dedup) {
            return;
        }
        this.selected = [];
        let loraInput = this.getLorasInput();
        let loraWeightsInput = this.getLoraWeightsInput();
        let loraConfinementInput = this.getLoraConfinementInput();
        if (!loraInput || !loraWeightsInput) {
            this.rebuildUI();
            return;
        }
        let loraVals = this.getLoraParamSelections();
        let weightVals = loraWeightsInput.value.split(',');
        let confinementVals = loraConfinementInput ? loraConfinementInput.value.split(',') : [];
        for (let i = 0; i < loraVals.length; i++) {
            this.selected.push(new SelectedLora(loraVals[i], weightVals.length > i ? parseFloat(weightVals[i]) : null, confinementVals.length > i ? parseInt(confinementVals[i]) : null, null));
        }
        this.rebuildUI();
    }

    /** Rebuild the bottom-bar LoRA listing UI to show the currently selected LoRAs. */
    rebuildUI() {
        let toRender = this.getLorasInput() ? this.selected : [];
        let container = this.getUIListContainer();
        
        // Clear removed items
        for (let lora of Object.keys(this.rendered)) {
            if (!this.selected.find(l => l.name == lora)) {
                this.rendered[lora].div.remove();
                delete this.rendered[lora];
            }
        }

        for (let lora of toRender) {
            let renderElem = this.rendered[lora.name];
            if (renderElem) {
                // Update existing
                renderElem.weightInput.value = lora.weight;
                if (renderElem.confinementInput) renderElem.confinementInput.value = lora.confinement;
            }
            else {
                // CREATE NEW UI ELEMENT
                let div = createDiv(null, 'preset-in-list');
                div.dataset.lora_name = lora.name;
                div.style.position = 'relative'; // For positioning tooltip

                let nameSpan = document.createElement('span');
                nameSpan.innerText = cleanModelName(lora.name);
                nameSpan.className = 'lora-name';
                nameSpan.style.cursor = 'help'; // Indicate hoverable
                div.appendChild(nameSpan);

                // --- NEW: HOVER PREVIEW LOGIC ---
                let previewPopup = null;
                nameSpan.addEventListener('mouseenter', () => {
                    // Try to find model in core map to get image
                    let modelData = null;
                    // Helper to find model data in global coreModelMap
                    for (let key in coreModelMap) {
                        let found = coreModelMap[key].find(m => m.title == lora.name || m.name == lora.name);
                        if (found) { modelData = found; break; }
                    }

                    if (modelData && modelData.preview_image) {
                        previewPopup = document.createElement('div');
                        previewPopup.className = 'lora-preview-popup';
                        previewPopup.style.position = 'fixed'; // Use fixed to escape overflows
                        previewPopup.style.zIndex = '99999';
                        previewPopup.style.pointerEvents = 'none';
                        previewPopup.style.background = 'var(--background-soft)';
                        previewPopup.style.border = '1px solid var(--emphasis)';
                        previewPopup.style.borderRadius = '4px';
                        previewPopup.style.padding = '4px';
                        previewPopup.style.boxShadow = '0 4px 8px rgba(0,0,0,0.5)';
                        
                        let img = document.createElement('img');
                        img.src = modelData.preview_image;
                        img.style.maxWidth = '200px';
                        img.style.maxHeight = '200px';
                        img.style.objectFit = 'contain';
                        previewPopup.appendChild(img);

                        document.body.appendChild(previewPopup);

                        // Position logic
                        let rect = nameSpan.getBoundingClientRect();
                        previewPopup.style.left = rect.left + 'px';
                        previewPopup.style.top = (rect.top - previewPopup.offsetHeight - 10) + 'px';
                    }
                });

                nameSpan.addEventListener('mouseleave', () => {
                    if (previewPopup) {
                        previewPopup.remove();
                        previewPopup = null;
                    }
                });
                // --------------------------------

                let weightInput = document.createElement('input');
                weightInput.className = 'lora-weight-input';
                weightInput.type = 'number';
                let weightsParam = this.getWeightsParam();
                weightInput.min = weightsParam ? weightsParam.min : -10;
                weightInput.max = weightsParam ? weightsParam.max : 10;
                weightInput.step = weightsParam ? weightsParam.step : 0.1;
                weightInput.value = lora.weight;
                let getLora = () => this.selected.find(l => l.name == lora.name);
                let updateWeight = (val) => {
                    let rounded = Math.round(parseFloat(val) * 100) / 100;
                    getLora().setWeight(rounded);
                    weightInput.value = rounded;
                    this.rebuildParams();
                    if (window.enhancedLoRAManager) {
                        window.enhancedLoRAManager.updateActiveTab();
                    }
                };
                weightInput.addEventListener('change', () => updateWeight(weightInput.value));
                weightInput.addEventListener('input', () => updateWeight(weightInput.value));

                let minusBtn = document.createElement('button');
                minusBtn.className = 'lora-ctrl-btn';
                minusBtn.innerText = '-';
                minusBtn.onclick = () => updateWeight(parseFloat(weightInput.value) - 0.1);

                let plusBtn = document.createElement('button');
                plusBtn.className = 'lora-ctrl-btn';
                plusBtn.innerText = '+';
                plusBtn.onclick = () => updateWeight(parseFloat(weightInput.value) + 0.1);
                
                let confinementInput = document.createElement('select');
                confinementInput.add(new Option('@ Global', '0', true, true));
                confinementInput.add(new Option('Base', '5'));
                confinementInput.add(new Option('Refiner', '1'));
                confinementInput.add(new Option('Video', '2'));
                confinementInput.add(new Option('VideoSwap', '3'));
                confinementInput.value = lora.confinement in this.confinementNames ? lora.confinement : '0';
                let fixSize = () => {
                    let displayText = confinementInput.selectedOptions.length > 0 ? confinementInput.selectedOptions[0].text : '';
                    if (confinementInput.value == '0') {
                        displayText = '@';
                    }
                    confinementInput.style.width = `${measureText(displayText) + 30}px`;
                }
                fixSize();
                confinementInput.addEventListener('change', () => {
                    getLora().setConfinement(confinementInput.value);
                    this.rebuildParams();
                    fixSize();
                });
                
                let removeButton = createDiv(null, 'preset-remove-button');
                removeButton.innerHTML = '&times;';
                removeButton.title = "Remove this LoRA";
                removeButton.addEventListener('click', () => {
                    this.selectLora(lora);
                    sdLoraBrowser.rebuildSelectedClasses();
                });
                
                let doShowLoraPopup = (isClick) => {
                    let popovers = document.getElementsByClassName('sui-popover-visible');
                    for (let popover of Array.from(popovers)) {
                        if (popover.dataset.isClick == "true" && !isClick) {
                            return;
                        }
                        popover.remove();
                    }
                    let model = sdLoraBrowser.models[lora.name] ?? sdLoraBrowser.models[lora.name + ".safetensors"];
                    if (!model) {
                        return;
                    }
                    let rect = div.getBoundingClientRect();
                    let desc = sdLoraBrowser.describeModel(model);
                    let image = document.createElement('img');
                    let descblock = createDiv(null, 'model-descblock');
                    let popup = createDiv('popover_lora_info', 'sui-popover model-block-hoverable model-block model-block-big');
                    image.src = desc.image;
                    image.className = 'model-preview-image';
                    descblock.style.maxHeight = '15rem';
                    descblock.style.overflowY = isClick ? 'auto' : 'hidden';
                    descblock.style.scrollbarWidth = 'thin';
                    descblock.innerHTML = desc.description;
                    popup.dataset.loraName = lora.name;
                    popup.dataset.isClick = isClick;
                    popup.style.position = 'fixed';
                    popup.style.padding = '0';
                    popup.style.top = 'auto';
                    popup.style.bottom = `${window.innerHeight - rect.top + 10}px`;
                    popup.appendChild(image);
                    popup.appendChild(descblock);
                    document.body.appendChild(popup);
                    let left = Math.min(rect.left, window.innerWidth - popup.offsetWidth - 10);
                    popup.style.left = `${left}px`;
                    popup.classList.add('sui-popover-visible');
                    if (isClick) {
                        uiImprover.sustainPopover = popup;
                    }
                    else {
                        popup.style.pointerEvents = 'none';
                    }
                };
                
                let hoverTimer = null;
                let clearTimer = (hTimer) => {
                    if (hTimer) {
                        clearTimeout(hTimer);
                        hoverTimer = null;
                    }
                };
                
                nameSpan.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    clearTimer(hoverTimer);
                    doShowLoraPopup(true);
                });
                
                nameSpan.addEventListener('mouseenter', (e) => {
                    hoverTimer = setTimeout(() => {
                        doShowLoraPopup(false);
                    }, 300);
                });
                
                nameSpan.addEventListener('mouseleave', (e) => {
                    clearTimer(hoverTimer);
                    let popup = document.querySelector(`.sui-popover-visible[data-lora-name="${lora.name}"]`);
                    if (popup && popup.dataset.isClick != "true") {
                        popup.remove();
                    }
                });
                
                div.appendChild(confinementInput);
                div.appendChild(minusBtn);
                div.appendChild(weightInput);
                div.appendChild(plusBtn);
                div.appendChild(removeButton);
                container.appendChild(div);
                this.rendered[lora.name] = { div: div, weightInput: weightInput, confinementInput: confinementInput };
            }
        }
        
        getRequiredElementById('current_loras_wrapper').style.display = toRender.length > 0 ? 'inline-block' : 'none';
        getRequiredElementById('lora_info_slot').innerText = ` (${toRender.length})`;
        setTimeout(() => {
            genTabLayout.reapplyPositions();
        }, 1);
    }

    /** Rebuild the LoRA parameter values to match the currently selected LoRAs. */
    rebuildParams() {
        let loraInput = this.getLorasInput();
        let loraWeightsInput = this.getLoraWeightsInput();
        let loraConfinementInput = this.getLoraConfinementInput();
        if (!loraInput || !loraWeightsInput) {
            return;
        }
        let loraVals = this.selected.map(l => l.name);
        this.dedup = true;
        let oldLoraVals = this.getLoraParamSelections();
        if (!arraysEqual(oldLoraVals, loraVals)) {
            $(loraInput).val(null);
            if (loraVals.length > 0) {
                $(loraInput).val(loraVals);
            }
            $(loraInput).trigger('change');
            triggerChangeFor(loraInput);
            let toggler = document.getElementById('input_loras_toggle');
            if (loraVals.length == 0 && toggler) {
                toggler.checked = false;
                triggerChangeFor(toggler);
            }
            // Note: hack reorder selected to match what the select2 input_loras elem wants.
            let actualSelected = [];
            let valSet = [...loraInput.options].map(option => option.value);
            for (let val of valSet) {
                if (loraVals.includes(val)) {
                    actualSelected.push(this.selected.find(l => l.name == val));
                }
            }
            this.selected = actualSelected;
        }
        let weightVals = [];
        let confinementVals = [];
        let anyConfined = false;
        for (let lora of this.selected) {
            weightVals.push(lora.weight);
            confinementVals.push(lora.confinement);
            if (lora.confinement != 0) {
                anyConfined = true;
            }
        }
        let weightStr = weightVals.join(',');
        let confinementStr = anyConfined ? confinementVals.join(',') : '';
        if (loraWeightsInput.value != weightStr) {
            loraWeightsInput.value = weightStr;
            triggerChangeFor(loraWeightsInput);
            let toggler = document.getElementById('input_loraweights_toggle');
            if (weightStr.length == 0 && toggler) {
                toggler.checked = false;
                triggerChangeFor(toggler);
            }
        }
        if (loraConfinementInput && loraConfinementInput.value != confinementStr) {
            loraConfinementInput.value = confinementStr;
            triggerChangeFor(loraConfinementInput);
            let toggler = document.getElementById('input_lorasectionconfinement_toggle');
            if (confinementStr.length == 0 && toggler) {
                toggler.checked = false;
                triggerChangeFor(toggler);
            }
        }
        this.dedup = false;
    }

    /** Selects or deselects a single LoRA and broadcasts the change to parameters and UI. */
    selectLora(lora) {
        let loraInput = this.getLorasInput();
        if (!loraInput) {
            showError("Cannot set LoRAs currently. Are you using a custom workflow? LoRAs only work in the default mode.");
            return;
        }
        let name = lora;
        let data = null;
        if (name instanceof SelectedLora) {
            name = lora.name;
        }
        else if (typeof lora == 'object' && lora.name) {
            name = lora.name;
            data = lora;
        }
        name = cleanModelName(name);
        let selected = this.selected.find(l => l.name == name);
        if (selected) {
            this.selected = this.selected.filter(l => l.name != name);
            modelPresetLinkManager.removePresetsFrom('LoRA', name);
        }
        else {
            this.selected.push(new SelectedLora(name, null, null, data));
            modelPresetLinkManager.addPresetsFrom('LoRA', name);
        }
        this.rebuildParams();
        this.rebuildUI();
    }
}

let loraHelper = new LoraHelper();