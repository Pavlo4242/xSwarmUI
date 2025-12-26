// --- DEBUG HELPER ---
function debugLog(msg) {
    const el = document.getElementById('preview_debug_console');
    if (el) {
        el.innerHTML += `<div>${new Date().toLocaleTimeString()} - ${msg}</div>`;
        el.scrollTop = el.scrollHeight;
    }
    console.log('[Preview] ' + msg);
}

class PreviewViewer {
    constructor() {
        debugLog("Initializing PreviewViewer...");
        
        try {
            this.dom = {
                prompt: document.getElementById('preview_prompt'),
                negativePrompt: document.getElementById('preview_negative_prompt'),
                steps: document.getElementById('preview_steps'),
                cfg: document.getElementById('preview_cfgscale'),
                width: document.getElementById('preview_width'),
                height: document.getElementById('preview_height'),
                seed: document.getElementById('preview_seed'),
                batchSize: document.getElementById('preview_batch_size'),
                modelSelect: document.getElementById('preview_model'),
                autoGen: document.getElementById('preview_auto_generate'),
                genBtn: document.getElementById('preview_generate'),
                syncBtn: document.getElementById('preview_sync_main'),
                copyToMainBtn: document.getElementById('preview_copy_to_main'),
                refreshLorasBtn: document.getElementById('preview_refresh_loras'),
                image: document.getElementById('preview_image'),
                progress: document.getElementById('preview_progress'),
                progressFill: document.getElementById('preview_progress_fill'),
                stepInfo: document.getElementById('preview_step_info'),
                errorDiv: document.getElementById('preview_error'),
                lorasContainer: document.getElementById('preview_loras_container'),
                historyContainer: document.getElementById('preview_history'),
                walkerContainer: document.getElementById('preview_walker_container'),
                walkerSlider: document.getElementById('preview_step_slider'),
                walkerLabel: document.getElementById('preview_walker_label')
            };

            // Vital Check
            if (!this.dom.prompt) {
                debugLog("DOM elements missing! Retrying in 1s...");
                setTimeout(() => new PreviewViewer(), 1000);
                return;
            }

            this.isGenerating = false;
            this.currentPreviews = [];
            this.sessionHistory = [];

            if (this.dom.autoGen) {
                this.dom.autoGen.checked = localStorage.getItem('preview_auto_generate') !== 'false';
            }

            this.setupEvents();
            
            // Initial Sync
            setTimeout(() => {
                debugLog("Triggering initial sync...");
                this.syncFromMain();
            }, 500);

            debugLog("Initialization Complete.");

        } catch (e) {
            debugLog("CRITICAL INIT ERROR: " + e.message);
        }
    }

    setupEvents() {
        try {
            ['prompt', 'negativePrompt', 'steps', 'cfg', 'width', 'height', 'seed', 'batchSize', 'modelSelect'].forEach(key => {
                if (this.dom[key]) {
                    this.dom[key].addEventListener('input', () => this.triggerDebounce());
                    this.dom[key].addEventListener('change', () => this.triggerDebounce());
                }
            });

            if (this.dom.autoGen) {
                this.dom.autoGen.addEventListener('change', () => {
                    localStorage.setItem('preview_auto_generate', this.dom.autoGen.checked);
                    if (this.dom.autoGen.checked) this.triggerDebounce();
                });
            }

            // Click Handlers with Logging
            if (this.dom.genBtn) this.dom.genBtn.onclick = () => { debugLog("Generate Clicked"); this.generate(); };
            if (this.dom.syncBtn) this.dom.syncBtn.onclick = () => { debugLog("Pull Clicked"); this.syncFromMain(); };
            if (this.dom.copyToMainBtn) this.dom.copyToMainBtn.onclick = () => { debugLog("Push Clicked"); this.syncToMain(); };
            if (this.dom.refreshLorasBtn) this.dom.refreshLorasBtn.onclick = () => { debugLog("Refreshed LoRAs"); this.buildLoras(); };

            if (this.dom.walkerSlider) {
                this.dom.walkerSlider.addEventListener('input', (e) => {
                    const index = parseInt(e.target.value);
                    if (this.currentPreviews[index]) {
                        this.dom.image.src = this.currentPreviews[index];
                        this.dom.walkerLabel.textContent = `${index + 1}/${this.currentPreviews.length}`;
                    }
                });
            }
        } catch (e) {
            debugLog("Error setting up events: " + e.message);
        }
    }

    triggerDebounce() {
        if (!this.dom.autoGen.checked || this.isGenerating) return;
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.generate(), 500);
    }

    findSwarmInput(baseId) {
        // Try Swarm's various ID formats
        const candidates = [`input_${baseId}`, baseId, `${baseId}_input`];
        for (const id of candidates) {
            const el = document.getElementById(id);
            if (el) return el;
        }
        return null;
    }

    syncFromMain() {
        try {
            debugLog("Syncing from Main Tab...");
            const map = { 
                prompt: 'prompt', negativePrompt: 'negativeprompt', 
                steps: 'steps', cfg: 'cfgscale', 
                width: 'width', height: 'height', 
                seed: 'seed', batchSize: 'batchsize'
            };

            let found = 0;
            for (const [domKey, swarmBaseId] of Object.entries(map)) {
                const destElem = this.dom[domKey];
                const srcElem = this.findSwarmInput(swarmBaseId);
                if (destElem && srcElem) {
                    destElem.value = srcElem.value;
                    found++;
                }
            }
            debugLog(`Synced ${found} parameters.`);
            
            // Sync Model
            const mainModel = document.getElementById('current_model');
            if (mainModel && this.dom.modelSelect) {
                this.dom.modelSelect.innerHTML = mainModel.innerHTML;
                this.dom.modelSelect.value = mainModel.value;
            } else {
                debugLog("Could not find main model selector!");
            }

            this.buildLoras();

        } catch (e) {
            debugLog("Sync Error: " + e.message);
        }
    }

    syncToMain() {
        try {
            debugLog("Pushing to Main Tab...");
            const map = { 
                prompt: 'prompt', negativePrompt: 'negativeprompt', 
                steps: 'steps', cfg: 'cfgscale', 
                width: 'width', height: 'height', 
                seed: 'seed', batchSize: 'batchsize'
            };

            for (const [domKey, swarmBaseId] of Object.entries(map)) {
                const srcElem = this.dom[domKey];
                const destElem = this.findSwarmInput(swarmBaseId);
                if (srcElem && destElem) {
                    destElem.value = srcElem.value;
                    destElem.dispatchEvent(new Event('change', { bubbles: true }));
                    destElem.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
            debugLog("Push complete.");
        } catch (e) {
            debugLog("Push Error: " + e.message);
        }
    }

    buildLoras() {
        if (!this.dom.lorasContainer) return;
        this.dom.lorasContainer.innerHTML = '';
        
        try {
            if (typeof loraHelper !== 'undefined' && loraHelper.selected) {
                if (loraHelper.selected.length === 0) {
                    this.dom.lorasContainer.innerHTML = '<div style="color:#666; font-size:12px; text-align:center; padding:10px;">No LoRAs active</div>';
                    return;
                }

                loraHelper.selected.forEach(lora => {
                    const item = document.createElement('div');
                    item.className = 'lora-card';
                    item.style.background = '#333';
                    item.style.padding = '5px';
                    item.style.borderRadius = '4px';
                    
                    item.innerHTML = `
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span style="font-size:11px; font-weight:bold; overflow:hidden; text-overflow:ellipsis;" title="${lora.name}">${lora.name}</span>
                            <span id="preview_lora_val_${lora.name}" style="font-size:11px;">${lora.weight.toFixed(2)}</span>
                        </div>
                        <input type="range" min="-2" max="2" step="0.05" 
                               value="${lora.weight}" data-lora-name="${lora.name}"
                               style="width:100%; cursor:pointer;"
                               oninput="document.getElementById('preview_lora_val_${lora.name}').textContent = parseFloat(this.value).toFixed(2); window.previewViewerInstance.triggerDebounce()">
                    `;
                    this.dom.lorasContainer.appendChild(item);
                });
            } else {
                debugLog("loraHelper not found (Global Swarm object missing)");
            }
        } catch (e) {
            debugLog("LoRA Build Error: " + e.message);
        }
    }

    // UPDATED: Now uses global getGenInput() to grab ALL parameters (Refiners, VAE, etc.)
    getPreviewInput() {
        let finalPrompt = this.dom.prompt.value;
        
        // Handle local LoRA sliders by baking them into the prompt
        // (Swarm supports <lora:name:weight> syntax)
        if (this.dom.lorasContainer) {
            this.dom.lorasContainer.querySelectorAll('input[type="range"]').forEach(range => {
                const weight = parseFloat(range.value);
                if (weight !== 0) finalPrompt += ` <lora:${range.dataset.loraName}:${weight}>`;
            });
        }
        
        const wantIntermediates = document.getElementById('input_outputintermediateimages')?.checked || false;
        
        // Define our specific overrides from the Preview Tab UI
        const overrides = {
            'images': parseInt(this.dom.batchSize.value) || 1, 
            'prompt': finalPrompt, 
            'negativeprompt': this.dom.negativePrompt.value,
            'model': this.dom.modelSelect.value, 
            'steps': parseInt(this.dom.steps.value) || 20,
            'cfgscale': parseFloat(this.dom.cfg.value) || 7, 
            'width': parseInt(this.dom.width.value) || 512,
            'height': parseInt(this.dom.height.value) || 512, 
            'seed': parseInt(this.dom.seed.value) || -1,
            'donotsave': true, // Always do not save for previews
            'intermediate_images': wantIntermediates,
            // Null out explicit LoRA arrays so we don't double-apply them 
            // (since we baked them into the prompt string above)
            'loras': null,
            'loraweights': null
        };

        // Use Swarm's global function to build the full parameter set
        // This ensures we include VAEs, Refiners, and other Advanced Tab settings
        let finalInput = {};
        if (typeof getGenInput === 'function') {
            finalInput = getGenInput(overrides);
        } else {
            // Fallback if Swarm's core isn't loaded for some reason
            debugLog("Warning: getGenInput not found, using limited parameters.");
            finalInput = overrides;
            // Ensure session ID is present if we are falling back
            let sessId = localStorage.getItem('session_id');
            if (typeof getSessionID === 'function') sessId = getSessionID();
            finalInput['session_id'] = sessId;
        }

        return finalInput;
    }

    generate() {
        if (this.isGenerating) { debugLog("Already generating..."); return; }

        this.isGenerating = true;
        this.currentPreviews = [];
        this.lastGeneratedImage = null;
        
        this.dom.genBtn.disabled = true;
        this.dom.errorDiv.style.display = 'none';
        this.dom.progress.style.display = 'block';
        if (this.dom.stepInfo) {
            this.dom.stepInfo.style.display = 'block';
            this.dom.stepInfo.textContent = 'Init...';
        }
        
        this.dom.walkerContainer.style.display = 'none';
        this.dom.image.classList.add('generating');
        
        debugLog("Sending Generation Request...");

        const maxSteps = parseInt(this.dom.steps.value) || 20;
        const input = this.getPreviewInput();

        this.ws = makeWSRequestT2I('GenerateText2ImageWS', input, data => {
            if (data.gen_progress) {
                const prog = data.gen_progress;
                if (prog.overall_percent) {
                    this.dom.progressFill.style.width = `${prog.overall_percent * 100}%`;
                    const currentStep = Math.floor(prog.overall_percent * maxSteps);
                    this.dom.stepInfo.textContent = `Step: ${currentStep}/${maxSteps}`;
                }
                if (prog.preview) {
                    this.dom.image.src = prog.preview;
                    this.currentPreviews.push(prog.preview);
                }
            }
            
            if (data.image) {
                const imgUrl = data.image.image || data.image;
                this.dom.image.src = imgUrl;
                this.currentPreviews.push(imgUrl);
                this.lastGeneratedImage = imgUrl;
                debugLog("Image Received");
            }

            if (data.done || (data.status && data.status.live_gens === 0 && data.status.waiting_gens === 0)) {
                this.finishGeneration(input);
                debugLog("Generation Done.");
            }
            
            if (data.error) {
                this.handleError(data.error);
                debugLog("API Error: " + JSON.stringify(data.error));
            }
        }, err => {
            this.handleError(err);
            debugLog("Network Error: " + JSON.stringify(err));
        });
    }

    finishGeneration(inputParams) {
        this.isGenerating = false;
        this.dom.progress.style.display = 'none';
        this.dom.stepInfo.style.display = 'none';
        this.dom.genBtn.disabled = false;
        this.dom.image.classList.remove('generating');
        this.setupWalker();
        this.ws = null;

        if (this.lastGeneratedImage) {
            this.addToHistory(this.lastGeneratedImage, inputParams);
        }
    }

    handleError(err) {
        console.error(err);
        this.dom.errorDiv.textContent = typeof err === 'string' ? err : 'Error';
        this.dom.errorDiv.style.display = 'block';
        this.isGenerating = false;
        this.dom.genBtn.disabled = false;
    }

    setupWalker() {
        if (this.currentPreviews.length > 0 && this.dom.walkerContainer) {
            this.dom.walkerContainer.style.display = 'flex';
            this.dom.walkerSlider.max = this.currentPreviews.length - 1;
            this.dom.walkerSlider.value = this.currentPreviews.length - 1;
            this.dom.walkerLabel.textContent = `${this.currentPreviews.length}/${this.currentPreviews.length}`;
        }
    }

    addToHistory(imgSrc, params) {
        if (!this.dom.historyContainer) return;
        if (this.dom.historyContainer.innerText.includes('History')) this.dom.historyContainer.innerHTML = '';

        const id = Date.now();
        const item = document.createElement('div');
        item.className = 'p-history-item active';
        item.innerHTML = `<img src="${imgSrc}">`;

        item.onclick = () => {
            this.dom.image.src = imgSrc;
            this.dom.historyContainer.querySelectorAll('.p-history-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
        };

        this.dom.historyContainer.prepend(item);
    }
}

// FORCE LOAD
window.previewViewerInstance = null;
window.initPreviewTab = function() {
    debugLog("initPreviewTab called by Swarm...");
    if (window.previewViewerInstance) window.previewViewerInstance.syncFromMain();
    else window.previewViewerInstance = new PreviewViewer();
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.initPreviewTab, 1000);
    const tabBtn = document.querySelector('[data-bs-target="#previewtab"]');
    if (tabBtn) tabBtn.addEventListener('shown.bs.tab', window.initPreviewTab);
});

debugLog("JS LOADED (v4) - Waiting for Swarm...");
