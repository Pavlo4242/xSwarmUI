(function() {
    'use strict';

    // ============================================================================
    // UTILITIES & LOGGING -- hopefully fixed from Gemini Update 
    // ============================================================================
    const log = (msg, type = 'info') => {
        const d = document.getElementById('p_debug');
        if(d) { 
            const color = type === 'error' ? '#f00' : type === 'warn' ? '#ff0' : '#0f0';
            d.innerHTML += `<div style="color:${color}">${new Date().toLocaleTimeString()} ${msg}</div>`; 
            d.scrollTop = d.scrollHeight; 
        }
        console.log(`[Preview] ${msg}`);
    };

    function applySafetyShims() {
        if (typeof window.canReparse === 'undefined' && !document.getElementById('canReparse')) {
            window.canReparse = { 
                checked: false, 
                style: { display: 'none' },
                addEventListener: () => {} 
            };
            log("Shimmed missing 'canReparse' to prevent crash.", 'warn');
        }
    }

    // ============================================================================
    // DATA MODELS
    // ============================================================================
    class GenerationHistoryEntry {
        constructor(finalImage, metadata, inputParams, steps) {
            this.finalImage = finalImage;
            this.metadata = metadata;
            this.inputParams = inputParams;
            this.steps = steps || [];
            this.timestamp = Date.now();
            this.batchId = `gen_${this.timestamp}`;
        }
    }

    // ============================================================================
    // LORA MANAGER
    // ============================================================================
    class LoraManager {
        constructor(previewTab) {
            this.previewTab = previewTab;
            this.allLoras = {};
            this.selectedLoras = {};
            this.searchTerm = '';
        }

        async loadAllLoras() {
            try {
                if (typeof genericRequest !== 'undefined') {
                    genericRequest('ListModels', { path: "", depth: 10, subtype: "LoRA" }, 
                        (data) => {
                            this.allLoras = {};
                            (data.files || []).forEach(f => {
                                this.allLoras[f.name] = f; 
                            });
                            log(`Loaded ${Object.keys(this.allLoras).length} LoRAs from API`);
                            this.renderBrowser();
                        },
                        (err) => log(`API LoRA load failed: ${err}`, 'error')
                    );
                } else {
                    log('LoRA API not available', 'warn');
                }
            } catch (e) {
                log(`Error loading LoRAs: ${e}`, 'error');
            }
        }

        renderBrowser() {
            const browserDiv = document.getElementById('p_lora_browser');
            if (!browserDiv) return;
            browserDiv.innerHTML = '';
            const loras = Object.keys(this.allLoras).filter(name => name.toLowerCase().includes(this.searchTerm.toLowerCase())).sort();
            if (loras.length === 0) {
                browserDiv.innerHTML = '<div class="secondary-text">No LoRAs found</div>';
                return;
            }
            loras.forEach(loraName => {
                const isSelected = loraName in this.selectedLoras;
                const div = document.createElement('div');
                div.className = isSelected ? 'lora-item selected' : 'lora-item';
                div.textContent = loraName.replace('.safetensors', '');
                div.onclick = () => this.toggleLora(loraName);
                browserDiv.appendChild(div);
            });
        }

        toggleLora(loraName) {
            if (loraName in this.selectedLoras) {
                delete this.selectedLoras[loraName];
            } else {
                this.selectedLoras[loraName] = { weight: 1.0, enabled: true };
            }
            this.renderBrowser();
            this.renderActive();
            if (!this.previewTab.modifyMode) this.previewTab.trigger();
        }

        renderActive() {
            const lorasDiv = document.getElementById('p_loras');
            const countSpan = document.getElementById('p_lora_count');
            const clearBtn = document.getElementById('p_clear_loras');
            if (!lorasDiv) return;

            const count = Object.keys(this.selectedLoras).length;
            countSpan.textContent = `(${count})`;
            clearBtn.style.display = count > 0 ? 'block' : 'none';
            lorasDiv.innerHTML = '';
            if (count === 0) {
                lorasDiv.innerHTML = '<div class="secondary-text">No LoRAs selected</div>';
                return;
            }

            Object.keys(this.selectedLoras).forEach(loraName => {
                const lora = this.selectedLoras[loraName];
                const div = document.createElement('div');
                div.className = 'lora-item active-lora-item';

                let content = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <span style="word-break: break-word;">${loraName.replace('.safetensors', '')}</span>
                        <label class="auto-input-box-label" style="font-size: 11px;">
                            <input type="checkbox" ${lora.enabled ? 'checked' : ''}>
                            <span>Enabled</span>
                        </label>
                    </div>
                    <div class="p-lora-controls">
                        <button class="refresh-button small">-</button>
                        <span class="p-lora-weight">${lora.weight.toFixed(1)}</span>
                        <button class="refresh-button small">+</button>
                        <button class="interrupt-button small" style="margin-left: auto;">×</button>
                    </div>`;
                div.innerHTML = content;

                const [minusBtn, plusBtn, removeBtn] = div.querySelectorAll('button');
                const checkbox = div.querySelector('input[type="checkbox"]');

                checkbox.onchange = () => {
                    lora.enabled = checkbox.checked;
                    if (!this.previewTab.modifyMode) this.previewTab.trigger();
                };
                minusBtn.onclick = () => {
                    lora.weight = Math.max(-2, Math.round((lora.weight - 0.1) * 10) / 10);
                    this.renderActive();
                    if (!this.previewTab.modifyMode) this.previewTab.trigger();
                };
                plusBtn.onclick = () => {
                    lora.weight = Math.min(2, Math.round((lora.weight + 0.1) * 10) / 10);
                    this.renderActive();
                    if (!this.previewTab.modifyMode) this.previewTab.trigger();
                };
                removeBtn.onclick = () => {
                    delete this.selectedLoras[loraName];
                    this.renderActive();
                    this.renderBrowser();
                    if (!this.previewTab.modifyMode) this.previewTab.trigger();
                };
                lorasDiv.appendChild(div);
            });
        }

        getLorasForGeneration() {
            return Object.keys(this.selectedLoras)
                .filter(name => this.selectedLoras[name].enabled)
                .map(name => ({
                    name: name,
                    weight: this.selectedLoras[name].weight
                }));
        }

        clearAll() {
            if (confirm('Clear all selected LoRAs?')) {
                this.selectedLoras = {};
                this.renderActive();
                this.renderBrowser();
            }
        }
    }

    // ============================================================================
    // MAIN PREVIEW TAB CLASS
    // ============================================================================
    class PreviewTab {
        constructor() {
            applySafetyShims();
            log("Initializing PreviewTab...");
            
            this.initState();
            this.mapDOM();
            
            if (!this.dom.prompt) {
                log("DOM not ready, retrying...", 'warn');
                setTimeout(() => new PreviewTab(), 500);
                return;
            }
            
            this.setupEvents();
            this.initializeUI();
            this.loraManager = new LoraManager(this);
            this.loraManager.loadAllLoras();
            
            this.history = this.loadHistory();
            this.refreshHistoryUI();
            
            if (this.watchMainTab) {
                this.monitorMainTab();
            }
            
            setTimeout(() => this.syncFromMain(), 1200);
            log("Initialization complete");
        }

        initState() {
            this.isGenerating = false;
            this.modifyMode = false;
            this.watchMainTab = true;
            this.currentSocket = null;
            this.currentBatchId = null;
            this.connectionStatus = 'disconnected';
            this.saveInterims = localStorage.getItem('preview_save_interims') === 'true';
            this.currentBatches = {};
            this.expectedImages = 1;
            this.receivedImages = 0;
            this.maxSteps = 20;
            this.stepCaptureInterval = 4;
            this.debounceTimer = null;
            this.socketTimeoutTimer = null;
        }

        mapDOM() {
            this.dom = {
                prompt: document.getElementById('p_prompt'),
                neg: document.getElementById('p_neg'),
                model: document.getElementById('p_model'),
                steps: document.getElementById('p_steps'),
                stepsVal: document.getElementById('p_steps_val'),
                cfg: document.getElementById('p_cfg'),
                cfgVal: document.getElementById('p_cfg_val'),
                width: document.getElementById('p_width'),
                height: document.getElementById('p_height'),
                batch: document.getElementById('p_batch'),
                seed: document.getElementById('p_seed'),
                previewInterval: document.getElementById('p_preview_interval'),
                auto: document.getElementById('p_auto'),
                watchMain: document.getElementById('p_watch_main'),
                modifyMode: document.getElementById('p_modify_mode'),
                modifyWarning: document.getElementById('p_modify_warning'),
                imageLarge: document.getElementById('p_image_large'),
                history: document.getElementById('p_history'),
                stepsDiv: document.getElementById('p_step_strip'),
                info: document.getElementById('p_info'),
                prog: document.getElementById('p_progress'),
                fill: document.getElementById('p_fill'),
                err: document.getElementById('p_error'),
                genBtn: document.getElementById('p_gen'),
                interruptBtn: document.getElementById('p_interrupt'),
                connectionStatus: document.getElementById('p_connection_status'),
                saveInterims: document.getElementById('p_save_interims')
            };
        }

        initializeUI() {
            this.updateConnectionStatus('disconnected');
            if (this.dom.saveInterims) {
                this.dom.saveInterims.checked = this.saveInterims;
            }
        }

        setupEvents() {
            const sliders = { steps: 'stepsVal', cfg: 'cfgVal' };
            for (const id in sliders) {
                this.dom[id].oninput = () => {
                    this.dom[sliders[id]].textContent = parseFloat(this.dom[id].value).toFixed(id === 'cfg' ? 1 : 0);
                    if (!this.modifyMode) this.trigger();
                };
            }
            
            ['prompt', 'neg', 'width', 'height', 'seed', 'batch', 'model', 'previewInterval'].forEach(k => {
                if (this.dom[k]) this.dom[k].addEventListener('input', () => { if (!this.modifyMode) this.trigger(); });
            });

            this.dom.modifyMode.onchange = () => {
                this.modifyMode = this.dom.modifyMode.checked;
                this.dom.modifyWarning.style.display = this.modifyMode ? 'inline' : 'none';
                this.dom.auto.disabled = this.modifyMode;
                if (!this.modifyMode) this.dom.auto.checked = true;
            };

            this.dom.auto.onchange = () => { if (!this.modifyMode) this.trigger(); };
            this.dom.watchMain.onchange = () => { this.watchMainTab = this.dom.watchMain.checked; };
            
            this.dom.genBtn.onclick = () => this.generate();
            this.dom.interruptBtn.onclick = () => this.interrupt();
            document.getElementById('p_pull').onclick = () => this.syncFromMain();
            document.getElementById('p_push').onclick = () => this.syncToMain();
            document.getElementById('p_refresh_loras').onclick = () => this.loraManager.loadAllLoras();
            document.getElementById('p_clear_history').onclick = () => this.clearHistory();
            document.getElementById('p_clear_steps').onclick = () => this.clearStepPreviews();
            document.getElementById('p_clear_loras').onclick = () => this.loraManager.clearAll();
            document.getElementById('p_refresh_loras_browser').onclick = () => this.loraManager.loadAllLoras();
            
            document.getElementById('p_lora_search').oninput = (e) => {
                this.loraManager.searchTerm = e.target.value.toLowerCase();
                this.loraManager.renderBrowser();
            };
            
            if (this.dom.saveInterims) {
                this.dom.saveInterims.onchange = () => {
                    this.saveInterims = this.dom.saveInterims.checked;
                    localStorage.setItem('preview_save_interims', this.saveInterims);
                };
            }
        }

        updateConnectionStatus(status) {
            this.connectionStatus = status;
            const el = this.dom.connectionStatus;
            el.className = `connection-status ${status}`;
            el.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        }

        showLargeImage(url, batchIndex, isFinal = false) {
            let img = this.dom.imageLarge.querySelector(`img[data-batch="${batchIndex}"]`);
            if (!img) {
                img = document.createElement('img');
                img.dataset.batch = batchIndex;
                img.onclick = () => {
                    const lightbox = document.getElementById('p_lightbox');
                    const lightboxImg = lightbox.querySelector('img');
                    lightboxImg.src = img.src;
                    lightbox.style.display = 'flex';
                    const closeLightbox = () => lightbox.style.display = 'none';
                    lightbox.addEventListener('click', closeLightbox, { once: true });
                };
                this.dom.imageLarge.appendChild(img);
            }
            img.src = url;
            img.className = isFinal ? 'final' : '';
        }

        clearPreviews() {
            this.dom.imageLarge.innerHTML = '';
            this.clearStepPreviews();
        }

        clearStepPreviews() {
            if (this.dom.stepsDiv) {
                this.dom.stepsDiv.innerHTML = '<div class="secondary-text">Step previews will appear here</div>';
            }
        }

        trigger() {
            if (!this.dom.auto.checked || this.isGenerating) return;
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => this.generate(), 300);
        }

        generate() {
            if (this.isGenerating || typeof makeWSRequestT2I === 'undefined') {
                log("Generation blocked: already running or API not ready.", 'warn');
                return;
            }
            if (!this.dom.model.value) {
                this.handleError("No model selected. Sync with the main tab or select a model.");
                return;
            }
            log("Starting generation...");
            this.isGenerating = true;
            this.receivedImages = 0;
            this.currentBatches = {};
            this.currentBatchId = `preview_${Date.now()}`;
            this.expectedImages = parseInt(this.dom.batch.value) || 1;
            this.maxSteps = parseInt(this.dom.steps.value) || 20;
            this.stepCaptureInterval = parseInt(this.dom.previewInterval.value) || 4;
            
            this.clearPreviews();
            this.dom.stepsDiv.innerHTML = '<div class="secondary-text">Generating...</div>';
            this.dom.prog.style.display = 'block';
            this.dom.info.style.display = 'block';
            this.dom.info.textContent = 'Initializing...';
            this.dom.err.style.display = 'none';
            this.dom.genBtn.disabled = true;
            this.dom.interruptBtn.style.display = 'inline-block';
            
            let prompt = this.dom.prompt.value;
            this.loraManager.getLorasForGeneration().forEach(lora => {
                prompt += ` <lora:${lora.name}:${lora.weight}>`;
            });

            const input = {
                'prompt': prompt, 'negativeprompt': this.dom.neg.value,
                'images': this.expectedImages, 'steps': this.maxSteps,
                'cfgscale': parseFloat(this.dom.cfg.value),
                'width': parseInt(this.dom.width.value), 'height': parseInt(this.dom.height.value),
                'seed': parseInt(this.dom.seed.value), 'model': this.dom.model.value,
                'session_id': localStorage.getItem('session_id'), 'donotsave': true,
                'outputintermediateimages': this.saveInterims
            };
            this.currentInputParams = JSON.parse(JSON.stringify(input));
            
            try {
                this.updateConnectionStatus('connecting');
                this.socketTimeoutTimer = setTimeout(() => this.handleError("Connection timeout"), 60000);
                this.currentSocket = makeWSRequestT2I('GenerateText2ImageWS', input, 
                    (d) => this.handleWebSocketMessage(d), (e) => this.handleWebSocketError(e));
                if (this.currentSocket) this.updateConnectionStatus('connected');
                else this.handleError("Failed to create WebSocket");
            } catch (e) {
                this.handleError(e.toString());
            }
        }

        handleWebSocketMessage(data) {
            clearTimeout(this.socketTimeoutTimer);
            this.socketTimeoutTimer = setTimeout(() => this.handleError("Connection timeout"), 60000);
            
            if (data.gen_progress) this.handleProgress(data.gen_progress);
            if (data.image) this.handleFinalImage(data);
            if (data.error) this.handleError(data.error);
        }

        handleProgress(progress) {
            const batchIndex = parseInt(progress.batch_index) || 0;
            if (!this.currentBatches[batchIndex]) {
                this.currentBatches[batchIndex] = { steps: [], final: null, metadata: null };
            }
            if (progress.overall_percent !== undefined) {
                const percent = parseFloat(progress.overall_percent) * 100;
                this.dom.fill.style.width = `${percent}%`;
                const currentStep = Math.floor(percent / 100 * this.maxSteps);
                this.dom.info.textContent = `Batch ${batchIndex + 1}/${this.expectedImages} - Step ${currentStep}/${this.maxSteps}`;
            }
            let previewUrl = progress.preview || progress.image || progress.preview_image;
            if (previewUrl) {
                const stepNum = Math.floor(parseFloat(progress.current_percent || 0) * this.maxSteps);
                if (stepNum > 0 && stepNum % this.stepCaptureInterval === 0) {
                    this.currentBatches[batchIndex].steps.push(previewUrl);
                    this.showLargeImage(previewUrl, batchIndex, false);
                    this.addStepFrame(previewUrl, stepNum, batchIndex, false);
                }
            }
        }

        handleFinalImage(data) {
            const batchIndex = parseInt(data.batch_index) || 0;
            const url = data.image.image || data.image;
            if (!this.currentBatches[batchIndex]) this.currentBatches[batchIndex] = { steps: [] };
            
            this.currentBatches[batchIndex].final = url;
            this.currentBatches[batchIndex].metadata = data.metadata || data.image.metadata || '{}';
            this.receivedImages++;
            
            this.showLargeImage(url, batchIndex, true);
            this.addStepFrame(url, this.maxSteps, batchIndex, true);
            
            if (this.receivedImages >= this.expectedImages) {
                this.finishGeneration();
            }
        }

        finishGeneration() {
            log("Finishing generation");
            clearTimeout(this.socketTimeoutTimer);
            this.isGenerating = false;
            this.dom.prog.style.display = 'none';
            this.dom.info.style.display = 'none';
            this.dom.genBtn.disabled = false;
            this.dom.interruptBtn.style.display = 'none';
            this.updateConnectionStatus('disconnected');
            
            Object.values(this.currentBatches).forEach(batch => {
                if (batch.final) {
                    this.history.unshift(new GenerationHistoryEntry(batch.final, batch.metadata, this.currentInputParams, batch.steps));
                }
            });
            if (this.history.length > 50) this.history.length = 50;
            
            this.saveHistory();
            this.refreshHistoryUI();
        }

        handleWebSocketError(error) {
            this.handleError(error.message || JSON.stringify(error));
        }

        handleError(errorMsg) {
            log(`Error: ${errorMsg}`, 'error');
            this.dom.err.textContent = errorMsg;
            this.dom.err.style.display = 'block';
            this.finishGeneration();
            setTimeout(() => { this.dom.err.style.display = 'none'; }, 5000);
        }

        interrupt() {
            log("Interrupting...");
            if (this.currentSocket) this.currentSocket.close();
            if (typeof genericRequest !== 'undefined') {
                genericRequest('InterruptAll', {}, () => log("Server interrupt sent"));
            }
            this.finishGeneration();
        }

        addStepFrame(url, stepNum, batchIndex, isFinal) {
            if (!this.dom.stepsDiv) return;
            if (this.dom.stepsDiv.querySelector('.secondary-text')) this.dom.stepsDiv.innerHTML = '';
            
            const div = document.createElement('div');
            div.className = 'image-block';
            if (isFinal) div.classList.add('final');
            div.innerHTML = `<img src="${url}"><div class="image-preview-text image-preview-text-small">${isFinal ? 'Final' : `S${stepNum}`}</div>`;
            div.onclick = () => {
                this.dom.stepsDiv.querySelectorAll('.image-block').forEach(item => item.classList.remove('image-block-current'));
                div.classList.add('image-block-current');
                this.showLargeImage(url, batchIndex, isFinal);
            };
            this.dom.stepsDiv.appendChild(div);
            this.dom.stepsDiv.scrollLeft = this.dom.stepsDiv.scrollWidth;
        }

        loadHistory() {
            try {
                const stored = localStorage.getItem('preview_tab_history');
                return stored ? JSON.parse(stored).map(item => new GenerationHistoryEntry(item.finalImage, item.metadata, item.inputParams, item.steps)) : [];
            } catch (e) { log(`Error loading history: ${e}`, 'warn'); }
            return [];
        }

        saveHistory() {
            try {
                localStorage.setItem('preview_tab_history', JSON.stringify(this.history));
            } catch (e) { log(`Error saving history: ${e}`, 'warn'); }
        }

        refreshHistoryUI() {
            if (!this.dom.history) return;
            this.dom.history.innerHTML = '';
            if (this.history.length === 0) {
                this.dom.history.innerHTML = '<div class="secondary-text">Generation history will appear here</div>';
                return;
            }
            this.history.forEach((entry, index) => {
                const div = document.createElement('div');
                div.className = 'image-block';
                div.innerHTML = `<img src="${entry.finalImage}">`;
                const overlay = document.createElement('div');
                overlay.className = 'model-block-menu-button';
                overlay.style = 'opacity: 0; display: flex; gap: 5px; top: 2px; right: 2px;';
                overlay.innerHTML = `
                    <i class="fas fa-expand p-icon-btn" title="View"></i>
                    <i class="fas fa-copy p-icon-btn" title="Duplicate & Modify"></i>
                    <i class="fas fa-trash p-icon-btn" title="Delete"></i>`;
                div.appendChild(overlay);
                div.onmouseenter = () => overlay.style.opacity = 1;
                div.onmouseleave = () => overlay.style.opacity = 0;
                
                const [viewBtn, dupeBtn, delBtn] = overlay.querySelectorAll('i');
                viewBtn.onclick = (e) => { e.stopPropagation(); this.viewHistoryEntry(entry); };
                dupeBtn.onclick = (e) => { e.stopPropagation(); this.restoreParams(entry); };
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.history.splice(index, 1);
                    this.saveHistory();
                    this.refreshHistoryUI();
                };
                div.onclick = () => this.viewHistoryEntry(entry);
                this.dom.history.appendChild(div);
            });
        }

        viewHistoryEntry(entry) {
            this.clearPreviews();
            this.showLargeImage(entry.finalImage, 0, true);
            if (entry.steps) {
                entry.steps.forEach((stepUrl, idx) => this.addStepFrame(stepUrl, (idx + 1) * this.stepCaptureInterval, 0, false));
                this.addStepFrame(entry.finalImage, this.maxSteps, 0, true);
            }
        }

        restoreParams(entry) {
            if (!entry.inputParams) return;
            const p = entry.inputParams;
            this.dom.prompt.value = p.prompt;
            this.dom.neg.value = p.negativeprompt;
            this.dom.steps.value = p.steps;
            this.dom.cfg.value = p.cfgscale;
            this.dom.width.value = p.width;
            this.dom.height.value = p.height;
            this.dom.seed.value = p.seed;
            this.dom.model.value = p.model;
            this.dom.steps.dispatchEvent(new Event('input'));
            this.dom.cfg.dispatchEvent(new Event('input'));
            log("Restored params from history");
        }

        clearHistory() {
            if (confirm('Clear all generation history?')) {
                this.history = [];
                this.saveHistory();
                this.refreshHistoryUI();
            }
        }

        // ========== MAIN TAB MONITORING (Restored) ==========
        monitorMainTab() {
            if (!this.watchMainTab) return;
            log("Starting Main Tab Monitor...");
            this.hookMainTabWebSocket();
            this.setupDOMMonitoring();
        }

        hookMainTabWebSocket() {
            const originalMakeWSRequestT2I = window.makeWSRequestT2I;
            if (originalMakeWSRequestT2I) {
                window.makeWSRequestT2I = (url, in_data, callback, errorHandle = null) => {
                    const wrappedCallback = (data) => {
                        if (data.gen_progress && data.gen_progress.preview && !this.modifyMode && this.watchMainTab && !this.isGenerating) {
                            this.captureFromMain(data.gen_progress.preview, data.gen_progress.metadata || '{}', false);
                        }
                        if (data.image && !this.modifyMode && this.watchMainTab && !this.isGenerating) {
                            const url = data.image.image || data.image;
                            this.captureFromMain(url, data.metadata || data.image.metadata || '{}', true);
                        }
                        if (callback) callback(data);
                    };
                    return originalMakeWSRequestT2I(url, in_data, wrappedCallback, errorHandle);
                };
                log("Main tab WebSocket hooked");
            }
        }

        setupDOMMonitoring() {
            const targetNode = document.getElementById('current_image_batch');
            if (!targetNode) {
                setTimeout(() => this.setupDOMMonitoring(), 2000);
                return;
            }
            this.mainTabObserver = new MutationObserver((mutations) => {
                if (!this.watchMainTab || this.modifyMode || this.isGenerating) return;
                mutations.forEach((mutation) => {
                    if (mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach(node => {
                            if (node.classList && node.classList.contains('image-block')) {
                                const img = node.querySelector('img');
                                if (img && img.src && img.src.startsWith('data:')) {
                                    const metadata = node.dataset.metadata || '{}';
                                    this.captureFromMain(img.src, metadata, false);
                                }
                            }
                        });
                    }
                });
            });
            this.mainTabObserver.observe(targetNode, { childList: true, subtree: true });
            log("Main tab DOM monitoring active");
        }

        captureFromMain(src, metadata, isFinal) {
            if (!this.watchMainTab || this.modifyMode || this.isGenerating) return;
            this.showLargeImage(src, 0, isFinal);
            if (!isFinal) {
                this.addStepFrame(src, null, 0, false);
                this.dom.info.style.display = 'block';
                this.dom.info.textContent = 'Captured from Main Tab';
            } else {
                this.dom.info.style.display = 'none';
                const entry = new GenerationHistoryEntry(src, metadata, {}, []);
                this.history.unshift(entry);
                if (this.history.length > 50) this.history.length = 50;
                this.saveHistory();
                this.refreshHistoryUI();
            }
            log(`Captured ${isFinal ? 'final' : 'preview'} from main tab`);
        }

        // ========== SYNC WITH MAIN TAB (Fixed) ==========
        syncFromMain() {
            log("Syncing from Main Tab...");
            const getVal = (id) => {
                const el = document.getElementById(id) || document.getElementById(`input_${id}`);
                return el ? el.value : null;
            };
            try {
                this.dom.prompt.value = getVal('prompt');
                this.dom.neg.value = getVal('negativeprompt');
                this.dom.steps.value = getVal('steps');
                this.dom.cfg.value = getVal('cfgscale');
                this.dom.width.value = getVal('width');
                this.dom.height.value = getVal('height');
                this.dom.seed.value = getVal('seed');
                this.dom.batch.value = getVal('batchsize');

                const mainModelValue = getVal('current_model');
                
                if (typeof genericRequest !== 'undefined') {
                    genericRequest('ListModels', { path: "", depth: 10, subtype: "Stable-Diffusion" }, 
                        (data) => {
                            this.dom.model.innerHTML = '<option value="">(None)</option>';
                            (data.files || []).forEach(f => {
                                const opt = document.createElement('option');
                                opt.value = f.name;
                                opt.textContent = f.name.replace(/\.safetensors$|\.ckpt$/, '');
                                this.dom.model.appendChild(opt);
                            });
                            if (mainModelValue && Array.from(this.dom.model.options).some(o => o.value === mainModelValue)) {
                                this.dom.model.value = mainModelValue;
                            }
                        }
                    );
                }

                this.dom.steps.dispatchEvent(new Event('input'));
                this.dom.cfg.dispatchEvent(new Event('input'));
                log("Sync complete");
            } catch (e) { log("Sync failed: Main tab elements not found.", "warn"); }
        }
 
        syncToMain() {
            log("Pushing to Main Tab...");
            const setVal = (id, val) => {
                const el = document.getElementById(id) || document.getElementById(`input_${id}`);
                if (el) {
                    el.value = val;
                    el.dispatchEvent(new Event('input', {bubbles: true}));
                }
            };
            setVal('prompt', this.dom.prompt.value);
            setVal('negativeprompt', this.dom.neg.value);
            setVal('steps', this.dom.steps.value);
            setVal('cfgscale', this.dom.cfg.value);
            setVal('width', this.dom.width.value);
            setVal('height', this.dom.height.value);
            setVal('seed', this.dom.seed.value);
            setVal('batchsize', this.dom.batch.value);
            log("Push complete");
        }

        destroy() {
            if (this.mainTabObserver) this.mainTabObserver.disconnect();
            if (this.currentSocket) this.currentSocket.close();
        }
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.previewTab = new PreviewTab());
    } else {
        window.previewTab = new PreviewTab();
    }
})();