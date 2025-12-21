// LoRA Playground - Parameter editor slave to main Generate tab
// Save as: src/Extensions/LoRAPlayground/Assets/lora_playground.js

class LoRAPlayground {
    constructor() {
        this.allLoras = [];
        this.loraUsageCount = {};
        this.isInitialized = false;
    }

    init() {
        console.log("LoRA Playground: Starting init...");
        
        // Wait for core systems to be ready
        if (!window.coreModelMap || !window.loraHelper || !window.mainGenHandler) {
            console.log("LoRA Playground: Waiting for SwarmUI systems...");
            setTimeout(() => this.init(), 200);
            return;
        }

        if (!coreModelMap['LoRA']) {
            console.log("LoRA Playground: No LoRAs available yet...");
            setTimeout(() => this.init(), 200);
            return;
        }

        console.log("LoRA Playground: Systems ready, initializing...");
        this.isInitialized = true;
        this.loadUsageStats();
        this.setupUI();
        this.loadAllLoras();
        this.syncFromMainTab();
        
        // Listen for LoRA changes from main tab
        const lorasInput = loraHelper.getLorasInput();
        if (lorasInput) {
            lorasInput.addEventListener('change', () => {
                console.log("LoRA Playground: Main tab LoRAs changed, syncing...");
                this.syncFromMainTab();
            });
        }
        
        console.log("LoRA Playground: Initialized successfully");
        
        // Set up image sync from main tab
        this.setupImageSync();
    }

    setupImageSync() {
        // Watch for new images in main tab
        const observer = new MutationObserver(() => {
            this.syncCurrentImage();
            this.syncHistory();
        });
        
        const mainImageBatch = document.getElementById('current_image_batch');
        if (mainImageBatch) {
            observer.observe(mainImageBatch, { childList: true, subtree: true });
        }
        
        // Initial sync
        this.syncCurrentImage();
        this.syncHistory();
        
        // Periodic sync (in case we miss updates)
        setInterval(() => {
            this.syncCurrentImage();
            this.syncHistory();
        }, 2000);
    }

    syncCurrentImage() {
        const mainImg = document.getElementById('current_image_img');
        const playgroundImg = document.getElementById('lora_playground_current_image');
        const placeholder = document.getElementById('lora_playground_placeholder');
        
        if (mainImg && playgroundImg && mainImg.src && !mainImg.src.includes('model_placeholder')) {
            playgroundImg.src = mainImg.src;
            playgroundImg.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
        } else if (placeholder) {
            if (playgroundImg) playgroundImg.style.display = 'none';
            placeholder.style.display = 'block';
        }
    }

    syncHistory() {
        const mainBatch = document.getElementById('current_image_batch');
        const historyContainer = document.getElementById('lora_history_container');
        
        if (!mainBatch || !historyContainer) return;
        
        const batchImages = mainBatch.querySelectorAll('.image-block img');
        if (batchImages.length === 0) {
            historyContainer.innerHTML = '<div class="lora-history-empty">No images yet</div>';
            return;
        }
        
        historyContainer.innerHTML = Array.from(batchImages)
            .slice(0, 20) // Limit to 20 most recent
            .map(img => `
                <div class="lora-history-item" onclick="loraPlayground.clickHistoryImage('${img.src}')">
                    <img src="${img.src}" loading="lazy">
                </div>
            `).join('');
    }

    clickHistoryImage(src) {
        // Find and click the corresponding image in main tab
        const mainBatch = document.getElementById('current_image_batch');
        if (!mainBatch) return;
        
        const imgs = mainBatch.querySelectorAll('.image-block img');
        for (let img of imgs) {
            if (img.src === src) {
                const block = img.closest('.image-block');
                if (block) {
                    block.click();
                    break;
                }
            }
        }
    }

    loadUsageStats() {
        try {
            const stored = localStorage.getItem('lora_playground_usage');
            this.loraUsageCount = stored ? JSON.parse(stored) : {};
        } catch (e) {
            this.loraUsageCount = {};
        }
    }

    saveUsageStats() {
        localStorage.setItem('lora_playground_usage', JSON.stringify(this.loraUsageCount));
    }

    setupUI() {
        // 2-way sync prompt and steps with main tab
        const mainPrompt = document.getElementById('input_prompt');
        const mainSteps = document.getElementById('input_steps');
        const altPrompt = document.getElementById('alt_prompt_textbox');
        
        const playgroundPrompt = document.getElementById('lora_playground_prompt');
        const playgroundSteps = document.getElementById('lora_playground_steps');
        
        // Initial sync from main
        if (mainPrompt && playgroundPrompt) {
            playgroundPrompt.value = altPrompt ? altPrompt.value : mainPrompt.value;
            
            // Playground -> Main
            playgroundPrompt.addEventListener('input', () => {
                if (altPrompt) {
                    altPrompt.value = playgroundPrompt.value;
                    triggerChangeFor(altPrompt);
                }
                mainPrompt.value = playgroundPrompt.value;
                triggerChangeFor(mainPrompt);
            });
            
            // Main -> Playground
            if (altPrompt) {
                altPrompt.addEventListener('input', () => {
                    if (playgroundPrompt.value !== altPrompt.value) {
                        playgroundPrompt.value = altPrompt.value;
                    }
                });
            }
        }
        
        if (mainSteps && playgroundSteps) {
            playgroundSteps.value = mainSteps.value;
            
            // Playground -> Main
            playgroundSteps.addEventListener('change', () => {
                mainSteps.value = playgroundSteps.value;
                triggerChangeFor(mainSteps);
            });
            
            // Main -> Playground
            mainSteps.addEventListener('change', () => {
                if (playgroundSteps.value !== mainSteps.value) {
                    playgroundSteps.value = mainSteps.value;
                }
            });
        }

        // Generate button - use main tab handler
        document.getElementById('lora_playground_generate').addEventListener('click', () => {
            mainGenHandler.doGenerate();
        });

        // Interrupt button
        document.getElementById('lora_playground_interrupt').addEventListener('click', () => {
            mainGenHandler.doInterrupt(false);
        });

        // Generate forever toggle
        document.getElementById('lora_playground_gen_forever').addEventListener('change', (e) => {
            if (e.target.checked) {
                if (!window.isGeneratingForever) {
                    toggleGenerateForever();
                }
            } else {
                if (window.isGeneratingForever) {
                    toggleGenerateForever();
                }
            }
        });

        // Generate previews toggle
        document.getElementById('lora_playground_gen_previews').addEventListener('change', (e) => {
            if (e.target.checked) {
                if (!window.isGeneratingPreviews) {
                    toggleGeneratePreviews();
                }
            } else {
                if (window.isGeneratingPreviews) {
                    toggleGeneratePreviews();
                }
            }
        });
    }

    syncFromMainTab() {
        if (!loraHelper || !loraHelper.selected) return;
        
        // Update usage counts
        loraHelper.selected.forEach(lora => {
            this.loraUsageCount[lora.name] = (this.loraUsageCount[lora.name] || 0) + 1;
        });
        this.saveUsageStats();
        
        // Refresh display
        this.loadAllLoras();
    }

    loadAllLoras() {
        if (!coreModelMap['LoRA']) return;
        
        const currentLoraNames = new Set((loraHelper.selected || []).map(l => l.name));
        
        this.allLoras = coreModelMap['LoRA'].map(name => {
            const currentLora = loraHelper.selected?.find(l => l.name === name);
            return {
                name: name,
                cleanName: name.replace('.safetensors', '').replace(/_/g, ' '),
                path: name,
                inUse: currentLoraNames.has(name),
                weight: currentLora ? currentLora.weight : 1.0,
                usageCount: this.loraUsageCount[name] || 0
            };
        });

        this.renderLoraList();
    }

    sortLoras() {
        return this.allLoras.sort((a, b) => {
            // In-use first
            if (a.inUse !== b.inUse) return b.inUse - a.inUse;
            // Then by usage count
            if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;
            // Then alphabetically
            return a.cleanName.localeCompare(b.cleanName);
        });
    }

    renderLoraList() {
        const container = document.getElementById('lora_list_container');
        if (!container) return;
        
        const sorted = this.sortLoras();
        
        container.innerHTML = sorted.map(lora => {
            const inUse = lora.inUse;
            
            return `
                <div class="lora-item ${inUse ? 'lora-item-active' : ''}" data-lora="${escapeHtml(lora.name)}">
                    <div class="lora-item-header">
                        <input type="checkbox" 
                               class="lora-checkbox" 
                               ${inUse ? 'checked' : ''}
                               onchange="loraPlayground.toggleLora('${lora.name.replace(/'/g, "\\'")}', this.checked)">
                        <span class="lora-name" title="${escapeHtml(lora.path)}">${escapeHtml(lora.cleanName)}</span>
                    </div>
                    ${inUse ? `
                        <div class="lora-weight-control">
                            <input type="range" 
                                   min="-2" max="2" step="0.1" 
                                   value="${lora.weight}"
                                   class="lora-weight-slider"
                                   oninput="loraPlayground.updateLoraWeight('${lora.name.replace(/'/g, "\\'")}', this.value)">
                            <input type="number" 
                                   min="-2" max="2" step="0.1"
                                   value="${lora.weight}"
                                   class="lora-weight-number"
                                   onchange="loraPlayground.updateLoraWeight('${lora.name.replace(/'/g, "\\'")}', this.value)">
                        </div>
                    ` : ''}
                    ${lora.usageCount > 0 ? `<div class="lora-usage-count">${lora.usageCount}×</div>` : ''}
                </div>
            `;
        }).join('');
    }

    toggleLora(loraName, enabled) {
        // Update main tab via loraHelper
        if (enabled) {
            // Find model data if available
            const modelData = window.sdLoraBrowser?.models?.[loraName];
            loraHelper.selectLora(modelData || loraName);
        } else {
            loraHelper.selectLora(loraName); // Toggles off if already selected
        }
        
        // Refresh our display
        setTimeout(() => this.syncFromMainTab(), 50);
    }

    updateLoraWeight(loraName, weight) {
        // Find the LoRA in loraHelper and update its weight
        const lora = loraHelper.selected.find(l => l.name === loraName);
        if (lora) {
            lora.setWeight(parseFloat(weight));
            loraHelper.rebuildParams();
            
            // Update both inputs in our UI
            const item = document.querySelector(`[data-lora="${loraName}"]`);
            if (item) {
                const slider = item.querySelector('.lora-weight-slider');
                const number = item.querySelector('.lora-weight-number');
                if (slider) slider.value = weight;
                if (number) number.value = weight;
            }
        }
    }
}

// Initialize
const loraPlayground = new LoRAPlayground();

// Hook into session ready
if (window.sessionReadyCallbacks) {
    sessionReadyCallbacks.push(() => {
        console.log("LoRA Playground: Session ready callback triggered");
        setTimeout(() => loraPlayground.init(), 1000);
    });
} else {
    console.log("LoRA Playground: No sessionReadyCallbacks, using timeout");
    setTimeout(() => loraPlayground.init(), 2000);
}