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
            this.steps = steps || []; // Array of preview image URLs
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
                if (typeof loraHelper !== 'undefined' && typeof sdLoraBrowser !== 'undefined') {
                    this.allLoras = sdLoraBrowser.models || {};
                    log(`Loaded ${Object.keys(this.allLoras).length} LoRAs from browser`);
                } else {
                    log('LoRA browser not available', 'warn');
                }
                this.renderBrowser();
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
                minusBtn.textContent = '-';
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
            log("Initializing PreviewTab v7...");
            
            // State
            this.isGenerating = false;
            this.modifyMode = false;
            this.watchMainTab = true;
            this.currentSocket = null;
            this.currentBatchId = null;
            this.connectionStatus = 'disconnected';
            
            // Current generation tracking
            this.currentSteps = []; // Array of preview URLs for current generation
            this.currentBatchImages = {}; // Map of batch_index -> {steps: [], final: null, metadata: null}
            this.expectedImages = 1; // From batch size
            this.receivedImages = 0;
            this.maxSteps = 20;
            
            // History
            this.history = this.loadHistory();
            
            // Timers
            this.debounceTimer = null;
            this.socketTimeoutTimer = null;
            this.reconnectAttempts = 0;
            this.maxReconnectAttempts = 3;
            
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
            
            // Save interims toggle
            this.saveInterims = localStorage.getItem('preview_save_interims') === 'true';
            this.dom.saveInterims = document.getElementById('p_save_interims');
            if (this.dom.saveInterims) {
                this.dom.saveInterims.checked = this.saveInterims;
                this.dom.saveInterims.onchange = () => {
                    this.saveInterims = this.dom.saveInterims.checked;
                    localStorage.setItem('preview_save_interims', this.saveInterims);
                    log(`Save interims toggled to ${this.saveInterims}`);
                };
            }
        }

        mapDOM() {
            this.dom = {
                prompt: document.getElementById('p_prompt'),
                neg: document.getElementById('p_neg'),
                model: document.getElementById('p_model'),
                steps: document.getElementById('p_steps'),
                cfg: document.getElementById('p_cfg'),
                width: document.getElementById('p_width'),
                height: document.getElementById('p_height'),
                batch: document.getElementById('p_batch'),
                seed: document.getElementById('p_seed'),
                auto: document.getElementById('p_auto'),
                watchMain: document.getElementById('p_watch_main'),
                modifyMode: document.getElementById('p_modify_mode'),
                modifyWarning: document.getElementById('p_modify_warning'),
                img: document.getElementById('p_img'),
                loras: document.getElementById('p_loras'),
                history: document.getElementById('p_history'),
                stepsDiv: document.getElementById('p_steps'),
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

        setupEvents() {
            // Input change handlers
            ['prompt', 'neg', 'steps', 'cfg', 'width', 'height', 'seed', 'batch', 'model'].forEach(k => {
                if (this.dom[k]) {
                    this.dom[k].addEventListener('input', () => {
                        if (!this.modifyMode) this.trigger();
                    });
                }
            });
            
            // Modify mode
            this.dom.modifyMode.addEventListener('change', () => {
                this.modifyMode = this.dom.modifyMode.checked;
                this.dom.modifyWarning.style.display = this.modifyMode ? 'inline' : 'none';
                
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
            
            // Auto-gen toggle
            this.dom.auto.addEventListener('change', () => {
                if (!this.modifyMode) this.trigger();
            });
            
            // Watch main toggle
            this.dom.watchMain.addEventListener('change', () => {
                this.watchMainTab = this.dom.watchMain.checked;
                if (this.watchMainTab && !this.mainTabObserver) {
                    this.monitorMainTab();
                }
            });
            
            // Button handlers
            this.dom.genBtn.onclick = () => this.generate();
            this.dom.interruptBtn.onclick = () => this.interrupt();
            document.getElementById('p_pull').onclick = () => this.syncFromMain();
            document.getElementById('p_push').onclick = () => this.syncToMain();
            document.getElementById('p_refresh_loras').onclick = () => this.buildLoras();
            document.getElementById('p_clear_steps').onclick = () => this.clearStepPreviews();
            document.getElementById('p_clear_history').onclick = () => this.clearHistory();
            
            // Diagnostics button
            const diagBtn = document.getElementById('p_diagnostics');
            if (diagBtn) {
                diagBtn.onclick = () => {
                    log("=== MANUAL DIAGNOSTICS ===");
                    log(`Session ID: ${localStorage.getItem('session_id')}`);
                    log(`makeWSRequestT2I: ${typeof makeWSRequestT2I}`);
                    log(`isGenerating: ${this.isGenerating}`);
                    log(`currentSocket: ${!!this.currentSocket}`);
                    log(`connectionStatus: ${this.connectionStatus}`);
                    log(`history length: ${this.history.length}`);
                    log(`current steps: ${this.currentSteps.length}`);
                    log(`saveInterims: ${this.saveInterims}`);
                    log("=== END DIAGNOSTICS ===");
                    
                    if (typeof makeWSRequestT2I === 'undefined') {
                        alert('ERROR: makeWSRequestT2I not found!\n\nThe Preview Tab cannot connect to Swarm.\nPlease refresh the page or check the console.');
                    } else {
                        alert('Diagnostics logged to console.\n\nConnection Status: ' + this.connectionStatus + '\nHistory: ' + this.history.length + ' entries');
                    }
                };
            }
        }

        clearModifyMode() {
            this.dom.modifyMode.checked = false;
            this.modifyMode = false;
            this.dom.modifyWarning.style.display = 'none';
            this.dom.auto.disabled = false;
            this.dom.auto.checked = true;
        }

        updateConnectionStatus(status) {
            this.connectionStatus = status;
            this.dom.connectionStatus.className = `p-connection-status ${status}`;
            
            const statusText = {
                'connected': 'Connected',
                'connecting': 'Connecting...',
                'disconnected': 'Disconnected',
                'error': 'Error'
            };
            
            this.dom.connectionStatus.textContent = statusText[status] || status;
        }

        // ========== WEBSOCKET GENERATION ==========
        trigger() {
            if (!this.dom.auto.checked || this.isGenerating) return;
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
            this.dom.stepsDiv.innerHTML = '<div class="p-step-strip-empty">Generating...</div>';
            this.dom.prog.style.display = 'block';
            this.dom.info.style.display = 'block';
            this.dom.info.textContent = 'Initializing...';
            this.dom.img.classList.add('generating');
            this.dom.err.style.display = 'none';
            this.dom.genBtn.disabled = true;
            this.dom.interruptBtn.style.display = 'inline-block';
            
            // Build prompt with LoRAs
            let prompt = this.dom.prompt.value;
            if (this.dom.loras) {
                Array.from(this.dom.loras.querySelectorAll('input[type=range]')).forEach(r => {
                    const nameSpan = r.parentElement.querySelector('span[id^="plv_"]');
                    if (nameSpan && parseFloat(r.value) !== 0) {
                        const name = nameSpan.id.substring(4); // Remove "plv_" prefix
                        prompt += ` <lora:${name}:${r.value}>`;
                    }
                });
            }
            
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
            
            // Add interim saving parameters
            input['outputintermediateimages'] = this.saveInterims;
            if (this.saveInterims) {
                input['intermediateimagespath'] = 'previews/%date%/%promptshort%'; // Optional custom path param if needed
                log('Enabled server-side interim saving');
            }
            
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
                        log(`Received data: ${JSON.stringify(Object.keys(data))}`);
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
            
            // Log all received message types for debugging
            const messageTypes = Object.keys(data);
            if (messageTypes.length > 0 && !messageTypes.includes('keep_alive')) {
                log(`Message types: ${messageTypes.join(', ')}`);
            }
            
            // Handle status updates
            if (data.status) {
                const s = data.status;
                log(`Status: waiting=${s.waiting_gens}, live=${s.live_gens}, loading=${s.loading_models}, backends=${s.waiting_backends}`);
                
                // Update connection status based on activity
                if (s.live_gens > 0 || s.waiting_gens > 0 || s.loading_models > 0) {
                    this.updateConnectionStatus('connected');
                }
            }
            
            // Handle backend status
            if (data.backend_status) {
                log(`Backend status: ${data.backend_status.status}, class: ${data.backend_status.class}, msg: ${data.backend_status.message}`);
                if (data.backend_status.class === 'error') {
                    log(`Backend error: ${data.backend_status.message}`, 'error');
                    this.handleError(data.backend_status.message);
                    return;
                }
            }
            
            // Handle progress with preview - THIS IS KEY!
            if (data.gen_progress) {
                log(`Progress update - batch: ${data.gen_progress.batch_index}, overall: ${data.gen_progress.overall_percent}, current: ${data.gen_progress.current_percent}, has_preview: ${!!data.gen_progress.preview}`);
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
                log(`Discarding indices: ${data.discard_indices.join(', ')}`);
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
            
            // Handle keep-alive (don't log these, they're noisy)
            if (data.keep_alive) {
                // Silent keep-alive
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
                this.dom.fill.style.width = `${percent}%`;
                const currentStep = Math.floor(parseFloat(progress.overall_percent) * this.maxSteps);
                this.dom.info.textContent = `Step: ${currentStep}/${this.maxSteps} (${percent.toFixed(1)}%)`;
                log(`Progress: ${percent.toFixed(1)}% (step ${currentStep}/${this.maxSteps})`);
            }
            
            // Handle preview image - CHECK MULTIPLE POSSIBLE LOCATIONS
            let previewUrl = null;
            
            if (progress.preview) {
                previewUrl = progress.preview;
            } else if (progress.image) {
                previewUrl = progress.image;
            } else if (progress.preview_image) {
                previewUrl = progress.preview_image;
                // Cache interim step
                this.currentSteps.push(previewUrl);
                this.addStepFrame(previewUrl, this.currentSteps.length);
                log(`Cached interim step ${this.currentSteps.length}`);
            }
            
            if (previewUrl) {
                log(`Preview image found in gen_progress (length: ${previewUrl.length})`);
                
                // Store preview
                this.currentBatchImages[batchIndex].steps.push(previewUrl);
                this.currentSteps.push(previewUrl);
                
                // Update main display if this is the first/only image
                if (batchIndex === 0 || this.expectedImages === 1) {
                    this.dom.img.src = previewUrl;
                    this.dom.img.classList.add('generating');
                }
                
                // Add to step filmstrip
                const stepNum = progress.current_percent !== undefined 
                    ? Math.floor(parseFloat(progress.current_percent) * this.maxSteps)
                    : Math.floor(parseFloat(progress.overall_percent || 0) * this.maxSteps);
                
                this.addStepFrame(previewUrl, stepNum, batchIndex);
                log(`Added step frame #${this.currentSteps.length} (step ${stepNum})`);
            } else {
                // No preview in this progress update - that's okay for some steps
                if (progress.overall_percent && parseFloat(progress.overall_percent) > 0) {
                    log(`Progress update without preview (${(parseFloat(progress.overall_percent) * 100).toFixed(1)}%)`);
                }
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
            
            // Update main display
            this.dom.img.src = url;
            this.dom.img.classList.remove('generating');
            
            // Add final image to step strip
            this.addStepFrame(url, this.maxSteps, batchIndex, true);
            
            // Check if all images received
            if (this.receivedImages >= this.expectedImages) {
                log("All images received, finishing generation");
                // Don't finish immediately, wait for socket close
                setTimeout(() => {
                    if (this.isGenerating) {
                        this.finishGeneration();
                    }
                }, 1000);
            }
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
            this.dom.prog.style.display = 'none';
            this.dom.info.style.display = 'none';
            this.dom.genBtn.disabled = false;
            this.dom.interruptBtn.style.display = 'none';
            this.dom.img.classList.remove('generating');
            this.currentSocket = null;
            this.updateConnectionStatus('disconnected');
            
            // Add to history
            Object.keys(this.currentBatchImages).forEach(batchIndex => {
                const batch = this.currentBatchImages[batchIndex];
                if (batch.final) {
                    let steps = this.currentSteps.slice(); // Default to cached base64 interims
                    
                    // Try to use server-saved interim paths if available
                    if (batch.metadata) {
                        try {
                            const meta = typeof batch.metadata === 'string' ? JSON.parse(batch.metadata) : batch.metadata;
                            if (meta.sui_extra_data && meta.sui_extra_data.intermediate_paths) {
                                steps = meta.sui_extra_data.intermediate_paths; // Use server-saved full paths if available
                                log(`Using ${steps.length} server-saved interim paths from metadata`);
                            }
                        } catch (e) {
                            log(`Metadata parse error: ${e}`, 'warn');
                        }
                    }
                    
                    const entry = new GenerationHistoryEntry(
                        batch.final,
                        batch.metadata,
                        this.currentInputParams,
                        steps  // Use server paths or base64 interims
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
            
            // Try to extract meaningful error message
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
            
            this.dom.err.textContent = errorMsg;
            this.dom.err.style.display = 'block';
            
            this.isGenerating = false;
            this.dom.prog.style.display = 'none';
            this.dom.info.style.display = 'none';
            this.dom.genBtn.disabled = false;
            this.dom.interruptBtn.style.display = 'none';
            this.dom.img.classList.remove('generating');
            
            if (this.socketTimeoutTimer) {
                clearTimeout(this.socketTimeoutTimer);
            }
            
            this.currentSocket = null;
            this.updateConnectionStatus('error');
            
            // Auto-hide error after 10 seconds
            setTimeout(() => {
                this.dom.err.style.display = 'none';
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

        // ========== STEP FILMSTRIP ==========
        addStepFrame(url, stepNum, batchIndex = 0, isFinal = false) {
            // Remove empty state
            const emptyState = this.dom.stepsDiv.querySelector('.p-step-strip-empty');
            if (emptyState) emptyState.remove();
            
            // Skip duplicates (compare last few characters to avoid base64 comparison overhead)
            if (this.currentSteps.length > 0 && !isFinal) {
                const lastUrl = this.currentSteps[this.currentSteps.length - 1];
                if (url.length > 100 && lastUrl.length > 100 &&
                    url.substring(url.length - 100) === lastUrl.substring(lastUrl.length - 100)) {
                    return;
                }
            }
            
            const div = document.createElement('div');
            div.className = 'p-step-item';
            if (isFinal) div.classList.add('final');
            
            const img = document.createElement('img');
            // Create thumbnail URL - base64 direct or add preview param for paths
            const thumbUrl = url.startsWith('data:') ? url : `${url}?preview=true`;
            img.src = thumbUrl;
            
            img.onclick = () => {
                const fullUrl = url.startsWith('data:') ? url : url.replace(/\?preview=.*$/, ''); // Full res path if server, base64 direct
                this.dom.img.src = fullUrl;
                this.dom.info.textContent = `Interim Step ${stepNum} (full view)`;
                log(`Displaying full interim step ${stepNum}`);
            };
            
            div.appendChild(img);
            
            if (stepNum !== null && stepNum !== undefined) {
                const numSpan = document.createElement('div');
                numSpan.className = 'p-step-number';
                numSpan.textContent = isFinal ? 'Final' : stepNum;
                div.appendChild(numSpan);
            }
            
            div.onclick = () => {
                this.dom.img.src = url;
                Array.from(this.dom.stepsDiv.children).forEach(c => c.classList.remove('active'));
                div.classList.add('active');
            };
            
            this.dom.stepsDiv.appendChild(div);
            this.dom.stepsDiv.scrollLeft = this.dom.stepsDiv.scrollWidth;
            
            // Mark as active if latest
            if (isFinal || this.currentSteps.length === 0) {
                Array.from(this.dom.stepsDiv.children).forEach(c => c.classList.remove('active'));
                div.classList.add('active');
            }
        }

        clearStepPreviews() {
            this.currentSteps = [];
            this.dom.stepsDiv.innerHTML = '<div class="p-step-strip-empty">Preview steps cleared</div>';
            log("Step previews cleared");
        }

        // ========== HISTORY MANAGEMENT ==========
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
                    steps: entry.steps.slice(0, 20), // Limit steps to prevent huge storage
                    timestamp: entry.timestamp,
                    batchId: entry.batchId
                }));
                localStorage.setItem('preview_tab_history', JSON.stringify(toSave));
            } catch (e) {
                log(`Error saving history: ${e}`, 'warn');
            }
        }

        refreshHistoryUI() {
            if (this.history.length === 0) {
                this.dom.history.innerHTML = '<div style="margin:auto; color:#666; font-style:italic;">Generation history will appear here</div>';
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
                div.appendChild(img);
                
                const overlay = document.createElement('div');
                overlay.className = 'p-hist-overlay';
                
                // View button
                const viewBtn = document.createElement('i');
                viewBtn.className = 'fas fa-expand p-icon-btn';
                viewBtn.title = 'View';
                viewBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.viewHistoryEntry(entry);
                };
                overlay.appendChild(viewBtn);
                
                // Restore params button
                const regenBtn = document.createElement('i');
                regenBtn.className = 'fas fa-redo p-icon-btn';
                regenBtn.title = 'Restore Params';
                regenBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.restoreParams(entry);
                };
                overlay.appendChild(regenBtn);
                
                // Delete button
                const delBtn = document.createElement('i');
                delBtn.className = 'fas fa-trash p-icon-btn';
                delBtn.title = 'Delete';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.history.splice(index, 1);
                    this.saveHistory();
                    this.refreshHistoryUI();
                };
                overlay.appendChild(delBtn);
                
                div.onclick = () => {
                    this.viewHistoryEntry(entry);
                };
                
                div.appendChild(overlay);
                this.dom.history.appendChild(div);
            });
        }

        viewHistoryEntry(entry) {
            log(`Viewing history entry: ${entry.batchId}`);
            
            // Show final image
            this.dom.img.src = entry.finalImage;
            
            // Mark as active
            Array.from(this.dom.history.children).forEach(c => c.classList.remove('active'));
            const items = Array.from(this.dom.history.children);
            const entryIndex = this.history.indexOf(entry);
            if (items[entryIndex]) {
                items[entryIndex].classList.add('active');
            }
            
            // Restore step previews
            if (entry.steps && entry.steps.length > 0) {
                this.dom.stepsDiv.innerHTML = '';
                entry.steps.forEach((stepUrl, idx) => {
                    const isFinal = idx === entry.steps.length - 1;
                    this.addStepFrame(stepUrl, idx, 0, isFinal);
                });
            }
        }

        restoreParams(entry) {
            log("Restoring params from history");
            
            if (!entry.inputParams) return;
            
            const params = entry.inputParams;
            if (params.prompt) this.dom.prompt.value = params.prompt;
            if (params.negativeprompt) this.dom.neg.value = params.negativeprompt;
            if (params.steps) this.dom.steps.value = params.steps;
            if (params.cfgscale) this.dom.cfg.value = params.cfgscale;
            if (params.width) this.dom.width.value = params.width;
            if (params.height) this.dom.height.value = params.height;
            if (params.seed) this.dom.seed.value = params.seed;
            if (params.model) this.dom.model.value = params.model;
            
            // Try to restore from metadata if available
            if (entry.metadata) {
                try {
                    const meta = typeof entry.metadata === 'string' ? JSON.parse(entry.metadata) : entry.metadata;
                    if (meta.sui_image_params) {
                        const imgParams = meta.sui_image_params;
                        if (imgParams.prompt) this.dom.prompt.value = imgParams.prompt;
                        if (imgParams.negativeprompt) this.dom.neg.value = imgParams.negativeprompt;
                        if (imgParams.steps) this.dom.steps.value = imgParams.steps;
                        if (imgParams.cfgscale) this.dom.cfg.value = imgParams.cfgscale;
                        if (imgParams.width) this.dom.width.value = imgParams.width;
                        if (imgParams.height) this.dom.height.value = imgParams.height;
                        if (imgParams.seed) this.dom.seed.value = imgParams.seed;
                        if (imgParams.model) this.dom.model.value = imgParams.model;
                    }
                } catch (e) {
                    log(`Error parsing metadata: ${e}`, 'warn');
                }
            }
        }

        clearHistory() {
            if (!confirm('Clear all generation history? This cannot be undone.')) return;
            
            this.history = [];
            this.saveHistory();
            this.refreshHistoryUI();
            log("History cleared");
        }

        // ========== MAIN TAB MONITORING ==========
        monitorMainTab() {
            if (!this.watchMainTab) return;
            
            log("Starting Main Tab Monitor...");
            
            // Hook into WebSocket
            this.hookMainTabWebSocket();
            
            // Also watch DOM as backup
            this.setupDOMMonitoring();
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
            
            this.dom.img.src = src;
            if (!isFinal) {
                this.dom.img.classList.add('generating');
                this.addStepFrame(src, null, 0, false);
                this.dom.info.style.display = 'block';
                this.dom.info.textContent = 'Captured from Main Tab';
            } else {
                this.dom.img.classList.remove('generating');
                this.dom.info.style.display = 'none';
                
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

        // ========== SYNC WITH MAIN TAB ==========
        syncFromMain() {
            log("Syncing from Main Tab...");
            
            const getVal = (id) => {
                const el = document.getElementById(id) || document.getElementById('input_' + id);
                return el ? el.value : null;
            };
            
            const p = getVal('prompt');
            if (p === null) {
                log("Main tab inputs not found", 'warn');
                return;
            }
            
            this.dom.prompt.value = p;
            this.dom.neg.value = getVal('negativeprompt') || '';
            this.dom.steps.value = getVal('steps') || 20;
            this.dom.cfg.value = getVal('cfgscale') || 7;
            this.dom.width.value = getVal('width') || 512;
            this.dom.height.value = getVal('height') || 512;
            this.dom.seed.value = getVal('seed') || -1;
            this.dom.batch.value = getVal('batchsize') || 1;
            
            const mMain = document.getElementById('current_model');
            if (mMain) {
                this.dom.model.innerHTML = mMain.innerHTML;
                this.dom.model.value = mMain.value;
            }
            
            this.buildLoras();
            log("Sync complete");
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
 
        buildLoras() {
            this.dom.loras.innerHTML = '';
            
            if (typeof loraHelper !== 'undefined' && loraHelper.selected && loraHelper.selected.length > 0) {
                loraHelper.selected.forEach(l => {
                    const div = document.createElement('div');
                    div.style.cssText = 'background:#333;padding:5px;border-radius:4px;';
                    div.innerHTML = `
                        <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:bold;">
                            <span style="overflow:hidden;text-overflow:ellipsis;max-width:180px;" title="${l.name}">${l.name}</span>
                            <span id="plv_${l.name}">${l.weight}</span>
                        </div>
                        <input type="range" min="-2" max="2" step="0.1" value="${l.weight}" style="width:100%"
                            oninput="document.getElementById('plv_${l.name}').innerText=this.value; window.previewTab.trigger()">
                    `;
                    this.dom.loras.appendChild(div);
                });
            } else {
                this.dom.loras.innerHTML = '<div style="color:#666;font-size:11px;text-align:center;">No LoRAs Active</div>';
            }
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
    
    // Run startup diagnostics
    function runStartupDiagnostics() {
        log("=== STARTUP DIAGNOSTICS ===");
        log(`Session ID: ${localStorage.getItem('session_id') || 'NOT SET'}`);
        log(`makeWSRequestT2I available: ${typeof makeWSRequestT2I !== 'undefined'}`);
        log(`makeWSRequest available: ${typeof makeWSRequest !== 'undefined'}`);
        log(`getSessionID available: ${typeof getSessionID !== 'undefined'}`);
        log(`loraHelper available: ${typeof loraHelper !== 'undefined'}`);
        
        if (typeof makeWSRequestT2I === 'undefined') {
            log("WARNING: makeWSRequestT2I not found! Preview Tab may not work.", 'error');
            log("Waiting for Swarm to fully load...", 'warn');
            
            // Retry after 2 seconds
            setTimeout(() => {
                if (typeof makeWSRequestT2I !== 'undefined') {
                    log("makeWSRequestT2I now available!", 'info');
                } else {
                    log("CRITICAL: makeWSRequestT2I still not available after 2s", 'error');
                }
            }, 2000);
        }
        
        log("=== DIAGNOSTICS COMPLETE ===");
    }
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                runStartupDiagnostics();
                window.previewTab = new PreviewTab();
            }, 100);
        });
    } else {
        setTimeout(() => {
            runStartupDiagnostics();
            window.previewTab = new PreviewTab();
        }, 100);
    }
    
    window.initPreviewTab = function() {
        log("initPreviewTab called externally");
        runStartupDiagnostics();
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
    
    // ========== DEBUGGING HELPERS ==========
    // Call from console: window.debugPreviewTab()
    window.debugPreviewTab = function() {
        console.log("=== PREVIEW TAB DEBUG INFO ===");
        console.log("Instance exists:", !!window.previewTab);
        console.log("makeWSRequestT2I:", typeof makeWSRequestT2I);
        console.log("Session ID:", localStorage.getItem('session_id'));
        
        if (window.previewTab) {
            console.log("Connection status:", window.previewTab.connectionStatus);
            console.log("Is generating:", window.previewTab.isGenerating);
            console.log("Current socket:", !!window.previewTab.currentSocket);
            console.log("History count:", window.previewTab.history.length);
            console.log("Current steps:", window.previewTab.currentSteps.length);
            console.log("Expected images:", window.previewTab.expectedImages);
            console.log("Received images:", window.previewTab.receivedImages);
            console.log("Save interims:", window.previewTab.saveInterims);
        }
        
        console.log("=== END DEBUG INFO ===");
        return {
            status: window.previewTab?.connectionStatus || 'no instance',
            generating: window.previewTab?.isGenerating || false,
            history: window.previewTab?.history.length || 0,
            steps: window.previewTab?.currentSteps.length || 0,
            saveInterims: window.previewTab?.saveInterims || false
        };
    };
    
    // Call from console: window.testPreviewConnection()
    window.testPreviewConnection = function() {
        console.log("Testing Preview Tab connection...");
        
        if (typeof makeWSRequestT2I === 'undefined') {
            console.error("FAIL: makeWSRequestT2I not available");
            return false;
        }
        
        if (!localStorage.getItem('session_id')) {
            console.error("FAIL: No session_id in localStorage");
            return false;
        }
        
        if (!window.previewTab) {
            console.error("FAIL: PreviewTab instance not created");
            return false;
        }
        
        console.log("PASS: All checks passed");
        console.log("Try clicking GENERATE button in Preview Tab");
        return true;
    };
})();