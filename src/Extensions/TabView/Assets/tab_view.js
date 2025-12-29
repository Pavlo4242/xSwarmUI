(function() {
    'use strict';

    // ========== DEBUG LOGGER ==========
    const log = (msg, type = 'info') => {
        const d = document.getElementById('p_debug');
        if(d) { 
            const color = type === 'error' ? '#f00' : type === 'warn' ? '#ff0' : '#0f0';
            d.innerHTML += `<div style="color:${color}">${new Date().toLocaleTimeString()} ${msg}</div>`; 
            d.scrollTop = d.scrollHeight; 
        }
        console.log(`[Preview] ${msg}`);
    };

    // ========== GENERATION HISTORY ENTRY ==========
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
    
    // ========== LORA MANAGER ==========
    class LoraManager {
        constructor(previewTab) {
            this.previewTab = previewTab;
            this.allLoras = {};
            this.selectedLoras = {};
            this.searchTerm = '';
        }

       async loadAllLoras() {
            log("Fetching LoRAs from server...");
            try {
                // If the main browser is already loaded, use it
                if (typeof sdLoraBrowser !== 'undefined' && sdLoraBrowser.models && Object.keys(sdLoraBrowser.models).length > 0) {
                    this.allLoras = sdLoraBrowser.models;
                    log(`Loaded ${Object.keys(this.allLoras).length} LoRAs from browser cache`);
                    this.renderBrowser();
                } else {
                    // Otherwise, ask the server directly
                    makeWSRequest('ListLoras', {}, (data) => {
                        if (data && data.loras) {
                            this.allLoras = {};
                            data.loras.forEach(lora => {
                                // Extract name from path or use name property
                                const name = lora.name || lora.path;
                                this.allLoras[name] = lora;
                            });
                            log(`Fetched ${Object.keys(this.allLoras).length} LoRAs from server`);
                            this.renderBrowser();
                        }
                    });
                }
            } catch (e) {
                log(`Error loading LoRAs: ${e}`, 'error');
            }
        }


        renderBrowser() {
            const browserDiv = document.getElementById('p_lora_browser');
            if (!browserDiv) return;

            browserDiv.innerHTML = '';
            
            const loras = Object.keys(this.allLoras).filter(name => {
                if (!this.searchTerm) return true;
                return name.toLowerCase().includes(this.searchTerm.toLowerCase());
            }).sort();

            if (loras.length === 0) {
                browserDiv.innerHTML = '<div style="color:#666; font-size:11px; text-align:center;">No LoRAs found</div>';
                return;
            }

            loras.forEach(loraName => {
                const isSelected = loraName in this.selectedLoras;
                const div = document.createElement('div');
                div.className = 'p-lora-item';
                div.style.cursor = 'pointer';
                div.style.background = isSelected ? '#1a4d2e' : '#2a2a2a';
                div.style.borderColor = isSelected ? '#28a745' : '#444';
                
                const nameSpan = document.createElement('span');
                nameSpan.textContent = loraName.replace('.safetensors', '');
                nameSpan.style.fontSize = '12px';
                nameSpan.style.wordBreak = 'break-word';
                
                div.appendChild(nameSpan);
                div.onclick = () => this.toggleLora(loraName);
                
                browserDiv.appendChild(div);
            });
        }

        toggleLora(loraName) {
            if (loraName in this.selectedLoras) {
                delete this.selectedLoras[loraName];
                log(`Removed LoRA: ${loraName}`);
            } else {
                this.selectedLoras[loraName] = { weight: 1.0 };
                log(`Added LoRA: ${loraName}`);
            }
            this.renderBrowser();
            this.renderActive();
        }

        renderActive() {
            const lorasDiv = document.getElementById('p_loras');
            const countSpan = document.getElementById('p_lora_count');
            const clearBtn = document.getElementById('p_clear_loras');
            
            if (!lorasDiv) return;

            const count = Object.keys(this.selectedLoras).length;
            if (countSpan) countSpan.textContent = `(${count})`;
            if (clearBtn) clearBtn.style.display = count > 0 ? 'block' : 'none';

            lorasDiv.innerHTML = '';

            if (count === 0) {
                lorasDiv.innerHTML = '<div style="color:#666; font-size:11px; text-align:center;">No LoRAs selected</div>';
                return;
            }

            Object.keys(this.selectedLoras).forEach(loraName => {
                const lora = this.selectedLoras[loraName];
                const div = document.createElement('div');
                div.className = 'p-lora-item';

                const nameSpan = document.createElement('span');
                nameSpan.textContent = loraName.replace('.safetensors', '');
                nameSpan.style.fontSize = '12px';
                nameSpan.style.display = 'block';
                nameSpan.style.marginBottom = '5px';
                nameSpan.style.wordBreak = 'break-word';
                
                const controls = document.createElement('div');
                controls.className = 'p-lora-controls';

                const minusBtn = document.createElement('button');
                minusBtn.className = 'p-btn p-btn-small';
                minusBtn.textContent = '−';
                minusBtn.onclick = () => {
                    lora.weight = Math.max(-2, Math.round((lora.weight - 0.1) * 10) / 10);
                    this.renderActive();
                };

                const weightSpan = document.createElement('span');
                weightSpan.className = 'p-lora-weight';
                weightSpan.textContent = lora.weight.toFixed(1);

                const plusBtn = document.createElement('button');
                plusBtn.className = 'p-btn p-btn-small';
                plusBtn.textContent = '+';
                plusBtn.onclick = () => {
                    lora.weight = Math.min(2, Math.round((lora.weight + 0.1) * 10) / 10);
                    this.renderActive();
                };

                const removeBtn = document.createElement('button');
                removeBtn.className = 'p-btn p-btn-small';
                removeBtn.textContent = '×';
                removeBtn.title = 'Remove';
                removeBtn.style.marginLeft = 'auto';
                removeBtn.onclick = () => {
                    delete this.selectedLoras[loraName];
                    this.renderActive();
                    this.renderBrowser();
                    log(`Removed LoRA: ${loraName}`);
                };

                controls.appendChild(minusBtn);
                controls.appendChild(weightSpan);
                controls.appendChild(plusBtn);
                controls.appendChild(removeBtn);

                div.appendChild(nameSpan);
                div.appendChild(controls);
                lorasDiv.appendChild(div);
            });
        }

        getLorasForGeneration() {
            return Object.keys(this.selectedLoras).map(name => ({
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

    // ========== MAIN PREVIEW TAB CLASS ==========
    class PreviewTab {
        constructor() {
            log("Initializing PreviewTab...");
            
            // State
            this.isGenerating = false;
            this.modifyMode = false;
            this.watchMainTab = true;
            this.currentSocket = null;
            this.currentBatchId = null;
            this.connectionStatus = 'disconnected';
            
            // Current generation tracking
            this.currentSteps = [];
            this.currentBatchImages = {};
            this.expectedImages = 1;
            this.receivedImages = 0;
            this.maxSteps = 20;
            
            // History
            this.history = this.loadHistory();
            
            // Managers
            this.loraManager = new LoraManager(this);
            
            // Timers
            this.debounceTimer = null;
            this.socketTimeoutTimer = null;
            this.lastFinalUrl = null; // Track the current generation's result

            // DOM elements
            this.mapDOM();
            
            if (!this.dom.prompt) {
                log("DOM not ready, retrying in 500ms...", 'warn');
                setTimeout(() => new PreviewTab(), 500);
                return;
            }
            
            this.setupEvents();
            this.clearModifyMode();
            this.updateConnectionStatus('disconnected');
            
            // Initialize components
            this.loraManager.loadAllLoras();
            
            // Monitor main tab
            if (this.watchMainTab) {
                this.monitorMainTab();
            }
            
            // Initial sync
            setTimeout(() => this.syncFromMain(), 500);
            setTimeout(() => this.syncFromMain(), 2000);
            
            // Restore history UI
            if (this.history.length > 0) {
                this.refreshHistoryUI();
            }
            
            log("Initialization complete");
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
                imageInterims: document.getElementById('p_image_interims'),
                loras: document.getElementById('p_loras'),
                history: document.getElementById('p_history'),
                stepStrip: document.getElementById('p_step_strip'),
                info: document.getElementById('p_info'),
                prog: document.getElementById('p_progress'),
                fill: document.getElementById('p_fill'),
                err: document.getElementById('p_error'),
                genBtn: document.getElementById('p_gen'),
                interruptBtn: document.getElementById('p_interrupt'),
                connectionStatus: document.getElementById('p_connection_status'),
                saveInterims: document.getElementById('p_save_interims'),
                loraBrowser: document.getElementById('p_lora_browser'),
                loraSearch: document.getElementById('pb_lora_search')
            };
        }

        setupEvents() {
            // Slider value displays AND triggers - use BOTH 'input' and 'change' for range sliders
            if (this.dom.steps) {
                const handleSteps = () => {
                    if (this.dom.stepsVal) this.dom.stepsVal.textContent = this.dom.steps.value;
                    if (!this.modifyMode) this.trigger();
                };
                this.dom.steps.addEventListener('input', handleSteps);
                this.dom.steps.addEventListener('change', handleSteps); // Fallback for range inputs
            }
            
            if (this.dom.cfg) {
                const handleCfg = () => {
                    if (this.dom.cfgVal) this.dom.cfgVal.textContent = parseFloat(this.dom.cfg.value).toFixed(1);
                    if (!this.modifyMode) this.trigger();
                };
                this.dom.cfg.addEventListener('input', handleCfg);
                this.dom.cfg.addEventListener('change', handleCfg); // Fallback for range inputs
            }
            
            // Input change handlers - ALL these should trigger
            ['prompt', 'neg', 'width', 'height', 'seed', 'batch', 'model', 'previewInterval'].forEach(k => {
                if (this.dom[k]) {
                    const handler = () => {
                        if (!this.modifyMode) this.trigger();
                    };
                    this.dom[k].addEventListener('input', handler);
                    this.dom[k].addEventListener('change', handler); // Fallback
                }
            });
            
            // LoRA search
            if (this.dom.loraSearch) {
                this.dom.loraSearch.addEventListener('input', () => {
                    this.loraManager.searchTerm = this.dom.loraSearch.value.toLowerCase();
                    this.loraManager.renderBrowser();
                });
            }
            
            // Modify mode
            if (this.dom.modifyMode) {
                this.dom.modifyMode.addEventListener('change', () => {
                    this.modifyMode = this.dom.modifyMode.checked;
                    if (this.dom.modifyWarning) {
                        this.dom.modifyWarning.style.display = this.modifyMode ? 'inline' : 'none';
                    }
                    
                    if (this.modifyMode) {
                        log("Modify Mode ENABLED - Auto-capture paused");
                        this.dom.auto.checked = false;
                        this.dom.auto.disabled = true;
                    } else {
                        log("Modify Mode DISABLED - Auto-capture resumed");
                        this.dom.auto.disabled = false;
                        this.dom.auto.checked = true;
                    }
                });
            }
            
            // Auto-gen toggle
            if (this.dom.auto) {
                this.dom.auto.addEventListener('change', () => {
                    if (!this.modifyMode) this.trigger();
                });
            }
            
            // Watch main toggle
            if (this.dom.watchMain) {
                this.dom.watchMain.addEventListener('change', () => {
                    this.watchMainTab = this.dom.watchMain.checked;
                    if (this.watchMainTab && !this.mainTabObserver) {
                        this.monitorMainTab();
                    }
                });
            }
            
            // Button handlers
            if (this.dom.genBtn) this.dom.genBtn.onclick = () => this.generate();
            if (this.dom.interruptBtn) this.dom.interruptBtn.onclick = () => this.interrupt();
            
            const pullBtn = document.getElementById('p_pull');
            if (pullBtn) pullBtn.onclick = () => this.syncFromMain();
            
            const pushBtn = document.getElementById('p_push');
            if (pushBtn) pushBtn.onclick = () => this.syncToMain();
            
            const refreshLorasBtn = document.getElementById('p_refresh_loras');
            if (refreshLorasBtn) refreshLorasBtn.onclick = () => this.loraManager.loadAllLoras();
            
            const refreshBrowserBtn = document.getElementById('p_refresh_loras_browser');
            if (refreshBrowserBtn) refreshBrowserBtn.onclick = () => this.loraManager.loadAllLoras();
            
            const clearStepsBtn = document.getElementById('p_clear_steps');
            if (clearStepsBtn) clearStepsBtn.onclick = () => this.clearStepPreviews();
            
            const clearInterimsBtn = document.getElementById('p_clear_interims');
            if (clearInterimsBtn) clearInterimsBtn.onclick = () => this.clearInterimPreviews();
            
            const clearHistoryBtn = document.getElementById('p_clear_history');
            if (clearHistoryBtn) clearHistoryBtn.onclick = () => this.clearHistory();
            
            const clearLorasBtn = document.getElementById('p_clear_loras');
            if (clearLorasBtn) clearLorasBtn.onclick = () => this.loraManager.clearAll();
            
            // Save interims toggle
            this.saveInterims = localStorage.getItem('preview_save_interims') === 'true';
            if (this.dom.saveInterims) {
                this.dom.saveInterims.checked = this.saveInterims;
                this.dom.saveInterims.onchange = () => {
                    this.saveInterims = this.dom.saveInterims.checked;
                    localStorage.setItem('preview_save_interims', this.saveInterims);
                    log(`Save interims toggled to ${this.saveInterims}`);
                };
            }
        }

        clearModifyMode() {
            if (this.dom.modifyMode) this.dom.modifyMode.checked = false;
            this.modifyMode = false;
            if (this.dom.modifyWarning) this.dom.modifyWarning.style.display = 'none';
            if (this.dom.auto) {
                this.dom.auto.disabled = false;
                this.dom.auto.checked = true;
            }
        }

        updateConnectionStatus(status) {
            this.connectionStatus = status;
            if (this.dom.connectionStatus) {
                this.dom.connectionStatus.className = `p-connection-status ${status}`;
                
                const statusText = {
                    'connected': 'Connected',
                    'connecting': 'Connecting...',
                    'disconnected': 'Disconnected',
                    'error': 'Error'
                };
                
                this.dom.connectionStatus.textContent = statusText[status] || status;
            }
        }

        trigger() {
            if (!this.dom.auto || !this.dom.auto.checked || this.isGenerating) return;
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => this.generate(), 500);
        }

        generate() {
            if (this.isGenerating) {
                log("Already generating, ignoring request", 'warn');
                return;
            }
            
            // Check if makeWSRequestT2I is available
            if (typeof makeWSRequestT2I === 'undefined') {
                log("makeWSRequestT2I not found! Retrying in 1s...", 'error');
                this.handleError("WebSocket API not ready. Please wait and try again.");
                setTimeout(() => {
                    if (typeof makeWSRequestT2I !== 'undefined') {
                        log("makeWSRequestT2I now available, retrying...");
                        this.generate();
                    }
                }, 1000);
                return;
            }
            
            log("Starting generation...");
            this.isGenerating = true;
            this.receivedImages = 0;
            this.currentSteps = [];
            this.currentBatchImages = {};
            this.currentBatchId = `preview_${Date.now()}`;
            this.expectedImages = parseInt(this.dom.batch.value) || 1;
            this.maxSteps = parseInt(this.dom.steps.value) || 20;
            
            // UI updates
            this.clearStepPreviews();
            this.clearInterimPreviews();
            
            if (this.dom.prog) this.dom.prog.style.display = 'block';
            if (this.dom.info) {
                this.dom.info.style.display = 'block';
                this.dom.info.textContent = 'Initializing...';
            }
            if (this.dom.err) this.dom.err.style.display = 'none';
            if (this.dom.genBtn) this.dom.genBtn.disabled = true;
            if (this.dom.interruptBtn) this.dom.interruptBtn.style.display = 'inline-block';
            
            // Build prompt with LoRAs
            let prompt = this.dom.prompt.value;
            const loras = this.loraManager.getLorasForGeneration();
            loras.forEach(lora => {
                if (lora.weight !== 0) {
                    prompt += ` <lora:${lora.name}:${lora.weight}>`;
                }
            });
            
            const input = {
                'session_id': localStorage.getItem('session_id'),
                'images': this.expectedImages,
                'prompt': prompt,
                'negativeprompt': this.dom.neg.value,
                'steps': this.maxSteps,
                'cfgscale': parseFloat(this.dom.cfg.value),
                'width': parseInt(this.dom.width.value),
                'height': parseInt(this.dom.height.value),
                'seed': parseInt(this.dom.seed.value),
                'model': this.dom.model.value,
                'donotsave': true
            };
            
            // Store input params for history
            this.currentInputParams = JSON.parse(JSON.stringify(input));
            
            log(`Sending request: ${JSON.stringify({...input, prompt: input.prompt.substring(0, 50) + '...'})}`);
            
            try {
                this.updateConnectionStatus('connecting');
                
                // Set socket timeout
                this.socketTimeoutTimer = setTimeout(() => {
                    if (this.isGenerating) {
                        log("Socket timeout! No response in 60s", 'error');
                        this.handleError("Connection timeout - no response from server");
                    }
                }, 60000);
                
                log("Calling makeWSRequestT2I...");
                this.currentSocket = makeWSRequestT2I('GenerateText2ImageWS', input, 
                    (data) => {
                        this.handleWebSocketMessage(data);
                    },
                    (error) => {
                        log(`Error callback triggered: ${JSON.stringify(error)}`, 'error');
                        this.handleWebSocketError(error);
                    }
                );
                
                if (this.currentSocket) {
                    this.updateConnectionStatus('connected');
                    log("WebSocket connection established");
                } else {
                    log("makeWSRequestT2I returned null/undefined!", 'error');
                    this.handleError("Failed to create WebSocket connection");
                }
                
            } catch (e) {
                log(`Exception starting generation: ${e.stack || e}`, 'error');
                this.handleError(e.toString());
            }
        }

        handleWebSocketMessage(data) {
            // Clear timeout on any message
            if (this.socketTimeoutTimer) {
                clearTimeout(this.socketTimeoutTimer);
                this.socketTimeoutTimer = setTimeout(() => {
                    if (this.isGenerating) {
                        log("Socket timeout! No message in 60s", 'error');
                        this.handleError("Connection timeout");
                    }
                }, 60000);
            }
            
            // Handle status updates
            if (data.status) {
                const s = data.status;
                if (s.live_gens > 0 || s.waiting_gens > 0 || s.loading_models > 0) {
                    this.updateConnectionStatus('connected');
                }
            }
            
            // Handle backend status
            if (data.backend_status) {
                if (data.backend_status.class === 'error') {
                    log(`Backend error: ${data.backend_status.message}`, 'error');
                    this.handleError(data.backend_status.message);
                    return;
                }
            }
            
            // Handle progress with preview
            if (data.gen_progress) {
                this.handleProgress(data.gen_progress);
            }
            
            // Handle final image
            if (data.image) {
                const batchIdx = data.batch_index || data.image.batch_index || 0;
                log(`Final image received - batch: ${batchIdx}`);
                this.handleFinalImage(data);
            }
            
            // Handle discard indices
            if (data.discard_indices) {
                data.discard_indices.forEach(idx => {
                    if (this.currentBatchImages[idx]) {
                        delete this.currentBatchImages[idx];
                    }
                });
            }
            
            // Handle socket close intention
            if (data.socket_intention === 'close') {
                log("Server requested socket close");
                this.finishGeneration();
            }
            
            // Handle errors
            if (data.error) {
                log(`API Error: ${data.error}`, 'error');
                this.handleError(data.error);
            }
            
            if (data.error_id) {
                log(`API Error ID: ${data.error_id}`, 'error');
                if (data.error_id === 'invalid_session_id') {
                    this.handleError("Invalid session ID. Please refresh the page.");
                }
            }
        }

        handleProgress(progress) {
            const batchIndex = parseInt(progress.batch_index) || 0;
            
            // Initialize batch tracking if needed
            if (!this.currentBatchImages[batchIndex]) {
                this.currentBatchImages[batchIndex] = {
                    steps: [],
                    final: null,
                    metadata: null
                };
            }
            
            // Update progress bar
            if (progress.overall_percent !== undefined) {
                const percent = parseFloat(progress.overall_percent) * 100;
                if (this.dom.fill) this.dom.fill.style.width = `${percent}%`;
                const currentStep = Math.floor(parseFloat(progress.overall_percent) * this.maxSteps);
                if (this.dom.info) {
                    this.dom.info.textContent = `Step: ${currentStep}/${this.maxSteps} (${percent.toFixed(1)}%)`;
                }
            }
            
            // Handle preview image
            let previewUrl = progress.preview || progress.image || progress.preview_image;
            
            if (previewUrl) {
                log(`Preview image found (length: ${previewUrl.length})`);
                
                // Store preview
                this.currentBatchImages[batchIndex].steps.push(previewUrl);
                this.currentSteps.push(previewUrl);
                
                // Add to interim filmstrip
                this.addInterimFrame(previewUrl, this.currentSteps.length, batchIndex);
                
                // Add to main display
                this.displayImage(previewUrl, false);
                
                // Add to step filmstrip
                const stepNum = progress.current_percent !== undefined 
                    ? Math.floor(parseFloat(progress.current_percent) * this.maxSteps)
                    : Math.floor(parseFloat(progress.overall_percent || 0) * this.maxSteps);
                
                this.addStepFrame(previewUrl, stepNum, batchIndex);
            }
            
            // Store metadata if available
            if (progress.metadata) {
                this.currentBatchImages[batchIndex].metadata = progress.metadata;
            }
        }

        handleFinalImage(data) {
            const batchIndex = parseInt(data.batch_index) || 0;
            const url = data.image.image || data.image;
            const metadata = data.metadata || data.image.metadata || '{}';
            
            log(`Final image received for batch ${batchIndex}`);
            
            // Store final image
            if (!this.currentBatchImages[batchIndex]) {
                this.currentBatchImages[batchIndex] = {
                    steps: [],
                    final: null,
                    metadata: null
                };
            }
            
            this.currentBatchImages[batchIndex].final = url;
            this.currentBatchImages[batchIndex].metadata = metadata;
            this.receivedImages++;
            
            // Display final image
            this.displayImage(url, true);
            
            // Add final image to step strip
            this.addStepFrame(url, this.maxSteps, batchIndex, true);
            
            // Check if all images received
            if (this.receivedImages >= this.expectedImages) {
                log("All images received, finishing generation");
                setTimeout(() => {
                    if (this.isGenerating) {
                        this.finishGeneration();
                    }
                }, 1000);
            }
        }

displayImage(url, isFinal) {
            if (!this.dom.imageLarge || !url) return;
            
            // If this is a final image, update our "default" tracker
            if (isFinal) {
                this.lastFinalUrl = url;
            }

            // Clear current view
            this.dom.imageLarge.innerHTML = '';
            
            const img = document.createElement('img');
            img.src = url;
            img.className = isFinal ? 'final' : 'generating';
            
            // CLICK LOGIC: Clicking the big image reverts to the last "Final" result
            img.onclick = () => {
                if (this.lastFinalUrl && url !== this.lastFinalUrl) {
                    log("Reverting to final image view");
                    this.displayImage(this.lastFinalUrl, true);
                }
            };
            
            this.dom.imageLarge.appendChild(img);
        }

  addInterimFrame(url, stepNum, batchIndex = 0) {
            if (!this.dom.imageInterims) return;
            
            const emptyState = this.dom.imageInterims.querySelector('div[style*="margin:auto"]');
            if (emptyState) emptyState.remove();
            
            const div = document.createElement('div');
            div.className = 'p-interim-item';
            
            const img = document.createElement('img');
            img.src = url;
            
            // When thumbnail is clicked, show it large
            div.onclick = () => {
                log(`Viewing interim step #${stepNum}`);
                this.displayImage(url, false);
                Array.from(this.dom.imageInterims.children).forEach(c => c.classList.remove('active'));
                div.classList.add('active');
            };
            
            div.appendChild(img);
            const label = document.createElement('div');
            label.className = 'p-interim-label';
            label.textContent = `#${stepNum}`;
            div.appendChild(label);
            
            this.dom.imageInterims.appendChild(div);
            this.dom.imageInterims.scrollLeft = this.dom.imageInterims.scrollWidth;
        }

        addStepFrame(url, stepNum, batchIndex = 0, isFinal = false) {
            if (!this.dom.stepStrip) return;
            
            const emptyState = this.dom.stepStrip.querySelector('.p-step-strip-empty');
            if (emptyState) emptyState.remove();
            
            const div = document.createElement('div');
            div.className = 'p-step-item';
            if (isFinal) div.classList.add('final');
            
            const img = document.createElement('img');
            img.src = url;
            
            // Fix: Added onclick to the container for better hit-detection
            div.onclick = () => {
                log(`Viewing ${isFinal ? 'final' : 'step ' + stepNum}`);
                this.displayImage(url, isFinal);
                Array.from(this.dom.stepStrip.children).forEach(c => c.classList.remove('active'));
                div.classList.add('active');
            };
            
            div.appendChild(img);
            const numSpan = document.createElement('div');
            numSpan.className = 'p-step-number';
            numSpan.textContent = isFinal ? 'Final' : `Step ${stepNum}`;
            div.appendChild(numSpan);
            
            this.dom.stepStrip.appendChild(div);
            this.dom.stepStrip.scrollLeft = this.dom.stepStrip.scrollWidth;
        }

        clearStepPreviews() {
            if (this.dom.stepStrip) {
                this.dom.stepStrip.innerHTML = '<div class="p-step-strip-empty">Step previews will appear here</div>';
            }
            log("Step previews cleared");
        }

        clearInterimPreviews() {
            if (this.dom.imageInterims) {
                this.dom.imageInterims.innerHTML = '<div style="margin:auto; color:#666; font-size:11px;">Interim previews appear here</div>';
            }
            log("Interim previews cleared");
        }

        finishGeneration() {
            log("Finishing generation");
            
            // Clear timeouts
            if (this.socketTimeoutTimer) {
                clearTimeout(this.socketTimeoutTimer);
                this.socketTimeoutTimer = null;
            }
            
            // Update UI
            this.isGenerating = false;
            if (this.dom.prog) this.dom.prog.style.display = 'none';
            if (this.dom.info) this.dom.info.style.display = 'none';
            if (this.dom.genBtn) this.dom.genBtn.disabled = false;
            if (this.dom.interruptBtn) this.dom.interruptBtn.style.display = 'none';
            this.currentSocket = null;
            this.updateConnectionStatus('disconnected');
            
            // Add to history
            Object.keys(this.currentBatchImages).forEach(batchIndex => {
                const batch = this.currentBatchImages[batchIndex];
                if (batch.final) {
                    const entry = new GenerationHistoryEntry(
                        batch.final,
                        batch.metadata,
                        this.currentInputParams,
                        batch.steps
                    );
                    this.history.unshift(entry);
                    
                    // Limit history size
                    if (this.history.length > 50) {
                        this.history = this.history.slice(0, 50);
                    }
                }
            });
            
            this.saveHistory();
            this.refreshHistoryUI();
            
            log("Generation complete");
        }

        handleWebSocketError(error) {
            log(`WebSocket error: ${JSON.stringify(error)}`, 'error');
            
            if (this.socketTimeoutTimer) {
                clearTimeout(this.socketTimeoutTimer);
            }
            
            this.updateConnectionStatus('error');
            
            let errorMsg = 'WebSocket connection error';
            if (typeof error === 'string') {
                errorMsg = error;
            } else if (error && error.message) {
                errorMsg = error.message;
            } else if (error && error.error) {
                errorMsg = error.error;
            }
            
            this.handleError(errorMsg);
        }

        handleError(errorMsg) {
            log(`Error: ${errorMsg}`, 'error');
            
            if (this.dom.err) {
                this.dom.err.textContent = errorMsg;
                this.dom.err.style.display = 'block';
            }
            
            this.isGenerating = false;
            if (this.dom.prog) this.dom.prog.style.display = 'none';
            if (this.dom.info) this.dom.info.style.display = 'none';
            if (this.dom.genBtn) this.dom.genBtn.disabled = false;
            if (this.dom.interruptBtn) this.dom.interruptBtn.style.display = 'none';
            
            if (this.socketTimeoutTimer) {
                clearTimeout(this.socketTimeoutTimer);
            }
            
            this.currentSocket = null;
            this.updateConnectionStatus('error');
            
            // Auto-hide error after 10 seconds
            setTimeout(() => {
                if (this.dom.err) this.dom.err.style.display = 'none';
            }, 10000);
        }

        interrupt() {
            log("Interrupting generation...");
            
            if (this.currentSocket) {
                try {
                    this.currentSocket.close();
                } catch (e) {
                    log(`Error closing socket: ${e}`, 'warn');
                }
            }
            
            this.finishGeneration();
        }

        loadHistory() {
            try {
                const stored = localStorage.getItem('preview_tab_history');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    return parsed.map(item => {
                        const entry = new GenerationHistoryEntry(
                            item.finalImage,
                            item.metadata,
                            item.inputParams,
                            item.steps
                        );
                        entry.timestamp = item.timestamp;
                        entry.batchId = item.batchId;
                        return entry;
                    });
                }
            } catch (e) {
                log(`Error loading history: ${e}`, 'warn');
            }
            return [];
        }

        saveHistory() {
            try {
                const toSave = this.history.slice(0, 50).map(entry => ({
                    finalImage: entry.finalImage,
                    metadata: entry.metadata,
                    inputParams: entry.inputParams,
                    steps: entry.steps.slice(0, 20),
                    timestamp: entry.timestamp,
                    batchId: entry.batchId
                }));
                localStorage.setItem('preview_tab_history', JSON.stringify(toSave));
            } catch (e) {
                log(`Error saving history: ${e}`, 'warn');
            }
        }

        refreshHistoryUI() {
            if (!this.dom.history) return;
            
            if (this.history.length === 0) {
                this.dom.history.innerHTML = '<div style="margin:auto; color:#666; font-style:italic;">History (latest at top)</div>';
                return;
            }
            
            const emptyMsg = this.dom.history.querySelector('div[style*="margin:auto"]');
            if (emptyMsg) emptyMsg.remove();
            
            this.dom.history.innerHTML = '';
            
            // Show newest first
            this.history.forEach((entry, index) => {
                const div = document.createElement('div');
                div.className = 'p-history-item';
                
                const img = document.createElement('img');
                img.src = entry.finalImage;
                
                      img.onclick = (e) => {
            e.stopPropagation();
            log("Viewing history entry");
            this.displayImage(entry.finalImage, true); // Set this as the new "default"
            
            Array.from(this.dom.history.children).forEach(c => c.classList.remove('active'));
            div.classList.add('active');
            
            // Also restore the step thumbnails for this historical entry
            if (entry.steps && entry.steps.length > 0 && this.dom.stepStrip) {
                this.dom.stepStrip.innerHTML = '';
                entry.steps.forEach((stepUrl, idx) => {
                    this.addStepFrame(stepUrl, idx, 0, idx === entry.steps.length - 1);
                });
            }
        };
                
                div.appendChild(img);
                this.dom.history.appendChild(div);
            });
        }

        clearHistory() {
            if (!confirm('Clear all generation history? This cannot be undone.')) return;
            
            this.history = [];
            this.saveHistory();
            this.refreshHistoryUI();
            log("History cleared");
        }

        monitorMainTab() {
            if (!this.watchMainTab) return;
            
            log("Starting Main Tab Monitor...");
            this.hookMainTabWebSocket();
        }

        hookMainTabWebSocket() {
            const originalMakeWSRequestT2I = window.makeWSRequestT2I;
            
            if (originalMakeWSRequestT2I) {
                window.makeWSRequestT2I = (url, in_data, callback, errorHandle = null) => {
                    const wrappedCallback = (data) => {
                        if (data.gen_progress && data.gen_progress.preview && 
                            !this.modifyMode && this.watchMainTab && !this.isGenerating) {
                            this.captureFromMain(data.gen_progress.preview, 
                                data.gen_progress.metadata || '{}', false);
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

        captureFromMain(src, metadata, isFinal) {
            if (!this.watchMainTab || this.modifyMode || this.isGenerating) return;
            
            this.displayImage(src, isFinal);
            
            if (!isFinal) {
                this.addStepFrame(src, null, 0, false);
                if (this.dom.info) {
                    this.dom.info.style.display = 'block';
                    this.dom.info.textContent = 'Captured from Main Tab';
                }
            } else {
                if (this.dom.info) this.dom.info.style.display = 'none';
                
                // Add to history
                const entry = new GenerationHistoryEntry(src, metadata, {}, this.currentSteps);
                this.history.unshift(entry);
                if (this.history.length > 50) this.history = this.history.slice(0, 50);
                this.saveHistory();
                this.refreshHistoryUI();
                
                this.currentSteps = [];
            }
            
            log(`Captured ${isFinal ? 'final' : 'preview'} from main tab`);
        }

// ========== SYNC LOGIC (Version A Style + API Fix) ==========
        async syncFromMain() {
            log("Syncing from Main Tab...");
            
            const getVal = (id) => {
                const el = document.getElementById(id) || document.getElementById('input_' + id);
                return el ? el.value : null;
            };

            // 1. Pull Prompt/Params
            if (this.dom.prompt) this.dom.prompt.value = getVal('prompt') || '';
            if (this.dom.neg) this.dom.neg.value = getVal('negativeprompt') || '';
            if (this.dom.steps) {
                this.dom.steps.value = getVal('steps') || 20;
                if (this.dom.stepsVal) this.dom.stepsVal.textContent = this.dom.steps.value;
            }
            if (this.dom.cfg) {
                this.dom.cfg.value = getVal('cfgscale') || 7;
                if (this.dom.cfgVal) this.dom.cfgVal.textContent = parseFloat(this.dom.cfg.value).toFixed(1);
            }
            if (this.dom.width) this.dom.width.value = getVal('width') || 512;
            if (this.dom.height) this.dom.height.value = getVal('height') || 512;
            if (this.dom.seed) this.dom.seed.value = getVal('seed') || -1;
            if (this.dom.batch) this.dom.batch.value = getVal('batchsize') || 1;

            // 2. Refresh Model List from Server (Fixes empty dropdown)
            this.refreshModelList();

            // 3. Sync Active LoRAs
            this.syncLorasFromMain();
            
            log("Sync complete");
        }

        refreshModelList() {
            const mMain = document.getElementById('current_model');
            
            // If main UI has models, clone them
            if (mMain && mMain.options.length > 0) {
                const currentVal = mMain.value;
                this.dom.model.innerHTML = mMain.innerHTML;
                this.dom.model.value = currentVal;
                log("Models cloned from main UI");
            } else {
                // Otherwise, fetch list from server API
                log("Main UI models not ready, fetching from API...");
                makeWSRequest('ListT2IModels', {}, (data) => {
                    if (data && data.models) {
                        this.dom.model.innerHTML = '';
                        data.models.forEach(m => {
                            const opt = document.createElement('option');
                            opt.value = m.name;
                            opt.text = m.name;
                            this.dom.model.appendChild(opt);
                        });
                        // Try to set value to whatever is currently active in Swarm
                        if (window.currentModel) this.dom.model.value = window.currentModel;
                    }
                });
            }
        }

        syncLorasFromMain() {
            if (typeof loraHelper !== 'undefined' && loraHelper.selected) {
                this.loraManager.selectedLoras = {};
                loraHelper.selected.forEach(l => {
                    this.loraManager.selectedLoras[l.name] = { weight: parseFloat(l.weight) };
                });
                this.loraManager.renderActive();
                this.loraManager.renderBrowser();
            }
        }


    
        syncToMain() {
            log("Pushing to Main Tab...");
            
            const setVal = (id, val) => {
                const el = document.getElementById(id) || document.getElementById('input_' + id);
                if (el) {
                    el.value = val;
                    el.dispatchEvent(new Event('change', {bubbles: true}));
                    el.dispatchEvent(new Event('input', {bubbles: true}));
                }
            };
            
            if (this.dom.prompt) setVal('prompt', this.dom.prompt.value);
            if (this.dom.neg) setVal('negativeprompt', this.dom.neg.value);
            if (this.dom.steps) setVal('steps', this.dom.steps.value);
            if (this.dom.cfg) setVal('cfgscale', this.dom.cfg.value);
            if (this.dom.width) setVal('width', this.dom.width.value);
            if (this.dom.height) setVal('height', this.dom.height.value);
            if (this.dom.seed) setVal('seed', this.dom.seed.value);
            if (this.dom.batch) setVal('batchsize', this.dom.batch.value);
            
            log("Push complete");
        }
 
        destroy() {
            if (this.mainTabObserver) {
                this.mainTabObserver.disconnect();
            }
            if (this.socketTimeoutTimer) {
                clearTimeout(this.socketTimeoutTimer);
            }
            if (this.currentSocket) {
                try {
                    this.currentSocket.close();
                } catch (e) {}
            }
        }
    }
 
    // ========== INITIALIZATION ==========
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                if (typeof makeWSRequestT2I === 'undefined') {
                    log("Waiting for SwarmUI to load...", 'warn');
                    setTimeout(() => window.previewTab = new PreviewTab(), 2000);
                } else {
                    window.previewTab = new PreviewTab();
                }
            }, 100);
        });
    } else {
        setTimeout(() => {
            if (typeof makeWSRequestT2I === 'undefined') {
                log("Waiting for SwarmUI to load...", 'warn');
                setTimeout(() => window.previewTab = new PreviewTab(), 2000);
            } else {
                window.previewTab = new PreviewTab();
            }
        }, 100);
    }
    
    window.initPreviewTab = function() {
        log("initPreviewTab called externally");
        if (window.previewTab) {
            window.previewTab.syncFromMain();
        } else {
            window.previewTab = new PreviewTab();
        }
    };
    
    window.addEventListener('beforeunload', () => {
        if (window.previewTab) {
            window.previewTab.destroy();
        }
    });
})();