// LoRA Manager Tab - Integrates with existing loraHelper system
// Save as: src/Extensions/LoRAManager/Assets/lora_manager.js

class LoRAManagerTab {
    constructor() {
        this.loraCards = [];
        this.container = null;
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;
        
        // Wait for loraHelper to be available
        if (!window.loraHelper) {
            setTimeout(() => this.init(), 100);
            return;
        }

        this.isInitialized = true;
        this.container = document.getElementById('lora_manager_tab_content');
        if (!this.container) return;

        // Listen to LoRA parameter changes to sync
        const lorasInput = loraHelper.getLorasInput();
        if (lorasInput) {
            lorasInput.addEventListener('change', () => this.syncFromParams());
        }

        // Initial load
        this.syncFromParams();
        this.render();
    }

    syncFromParams() {
        // Load current LoRA selection from the existing loraHelper
        this.loraCards = loraHelper.selected.map(lora => ({
            name: lora.name,
            weight: lora.weight,
            confinement: lora.confinement,
            enabled: true, // All selected LoRAs are considered "enabled"
            model: lora.model
        }));
        
        // Add any disabled LoRAs from storage
        const disabled = this.loadDisabledLoras();
        disabled.forEach(loraData => {
            if (!this.loraCards.find(c => c.name === loraData.name)) {
                this.loraCards.push({ ...loraData, enabled: false });
            }
        });
    }

    loadDisabledLoras() {
        try {
            const stored = localStorage.getItem('lora_manager_disabled');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    }

    saveDisabledLoras() {
        const disabled = this.loraCards.filter(c => !c.enabled);
        localStorage.setItem('lora_manager_disabled', JSON.stringify(disabled));
    }

    applyToGeneration() {
        // Sync back to loraHelper - only enabled LoRAs
        const enabledLoras = this.loraCards.filter(c => c.enabled);
        
        // Clear current selection
        loraHelper.selected = [];
        
        // Add each enabled LoRA
        enabledLoras.forEach(lora => {
            loraHelper.selected.push(new SelectedLora(lora.name, lora.weight, lora.confinement, lora.model));
        });
        
        // Rebuild parameters and UI
        loraHelper.rebuildParams();
        loraHelper.rebuildUI();
        
        // Save disabled LoRAs for persistence
        this.saveDisabledLoras();
        
        showToast('LoRAs applied to generation');
    }

    toggleEnabled(index) {
        this.loraCards[index].enabled = !this.loraCards[index].enabled;
        this.render();
    }

    updateWeight(index, newWeight) {
        this.loraCards[index].weight = parseFloat(newWeight);
        this.render();
    }

    moveCard(index, direction) {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= this.loraCards.length) return;
        
        [this.loraCards[index], this.loraCards[targetIndex]] = 
        [this.loraCards[targetIndex], this.loraCards[index]];
        
        this.render();
    }

    generatePreview(index) {
        const lora = this.loraCards[index];
        if (!lora.enabled) return;

        // Generate with only this LoRA
        const input_overrides = {
            'loras': lora.name,
            'loraweights': `${lora.weight}`,
            'images': 1,
            '_preview': true
        };
        
        mainGenHandler.doGenerate(input_overrides);
        showToast(`Generating preview for ${lora.name}`);
    }

    render() {
        if (!this.container) return;

        const enabledCount = this.loraCards.filter(c => c.enabled).length;
        
        this.container.innerHTML = `
            <div class="lora-manager-container">
                <div class="lora-manager-header">
                    <h2>LoRA Manager</h2>
                    <div class="lora-manager-stats">
                        ${enabledCount} / ${this.loraCards.length} enabled
                    </div>
                    <button class="basic-button btn-primary" onclick="loraManagerTab.applyToGeneration()">
                        Apply to Generation
                    </button>
                </div>

                <div class="lora-manager-help">
                    Manage your LoRAs visually. Toggle them on/off, adjust weights, and reorder. 
                    Disabled LoRAs stay in this list for easy reuse across different images.
                </div>

                ${this.loraCards.length === 0 ? `
                    <div class="lora-manager-empty">
                        <p>No LoRAs in manager. Add LoRAs from the main parameter list, they'll appear here automatically.</p>
                    </div>
                ` : `
                    <div class="lora-manager-grid">
                        ${this.loraCards.map((lora, index) => this.renderCard(lora, index)).join('')}
                    </div>
                    
                    <div class="lora-manager-actions">
                        <button class="basic-button" onclick="loraManagerTab.enableAll()">Enable All</button>
                        <button class="basic-button" onclick="loraManagerTab.disableAll()">Disable All</button>
                        <button class="basic-button" onclick="loraManagerTab.resetWeights()">Reset Weights</button>
                        <button class="basic-button" onclick="loraManagerTab.removeDisabled()">Remove Disabled</button>
                    </div>
                `}
            </div>
        `;
    }

    renderCard(lora, index) {
        const cleanName = lora.name.replace(/_/g, ' ').replace('.safetensors', '');
        const isFirst = index === 0;
        const isLast = index === this.loraCards.length - 1;
        
        return `
            <div class="lora-card ${lora.enabled ? 'lora-card-enabled' : 'lora-card-disabled'}">
                <div class="lora-card-header">
                    <div class="lora-card-title">${escapeHtml(cleanName)}</div>
                    <button class="lora-toggle-btn ${lora.enabled ? 'enabled' : 'disabled'}" 
                            onclick="loraManagerTab.toggleEnabled(${index})"
                            title="${lora.enabled ? 'Disable' : 'Enable'} LoRA">
                        ${lora.enabled ? '👁' : '👁‍🗨'}
                    </button>
                </div>

                <div class="lora-card-weight">
                    <label>Weight: ${lora.weight.toFixed(2)}</label>
                    <input type="range" min="-2" max="2" step="0.1" value="${lora.weight}"
                           ${!lora.enabled ? 'disabled' : ''}
                           oninput="loraManagerTab.updateWeight(${index}, this.value)"
                           class="lora-weight-slider">
                    <input type="number" min="-2" max="2" step="0.1" value="${lora.weight}"
                           ${!lora.enabled ? 'disabled' : ''}
                           onchange="loraManagerTab.updateWeight(${index}, this.value)"
                           class="lora-weight-number">
                </div>

                <div class="lora-card-actions">
                    <button class="basic-button small-button" 
                            ${!lora.enabled ? 'disabled' : ''}
                            onclick="loraManagerTab.generatePreview(${index})"
                            title="Generate preview with only this LoRA">
                        🎨 Preview
                    </button>
                    
                    <div class="lora-card-reorder">
                        <button class="basic-button small-button" 
                                ${isFirst ? 'disabled' : ''}
                                onclick="loraManagerTab.moveCard(${index}, -1)"
                                title="Move up">
                            ▲
                        </button>
                        <button class="basic-button small-button" 
                                ${isLast ? 'disabled' : ''}
                                onclick="loraManagerTab.moveCard(${index}, 1)"
                                title="Move down">
                            ▼
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // Quick actions
    enableAll() {
        this.loraCards.forEach(c => c.enabled = true);
        this.render();
    }

    disableAll() {
        this.loraCards.forEach(c => c.enabled = false);
        this.render();
    }

    resetWeights() {
        this.loraCards.forEach(c => c.weight = 1.0);
        this.render();
    }

    removeDisabled() {
        if (!confirm('Remove all disabled LoRAs from the manager?')) return;
        this.loraCards = this.loraCards.filter(c => c.enabled);
        this.saveDisabledLoras();
        this.render();
    }
}

// Initialize when page loads
const loraManagerTab = new LoRAManagerTab();

// Hook into session ready
if (window.sessionReadyCallbacks) {
    sessionReadyCallbacks.push(() => {
        setTimeout(() => loraManagerTab.init(), 500);
    });
}

function showToast(message) {
    // Use existing toast system if available
    if (window.showError) {
        let toast = document.createElement('div');
        toast.className = 'center-toast';
        toast.style.backgroundColor = 'var(--notice-pop)';
        toast.style.color = 'var(--text)';
        toast.style.padding = '1rem';
        toast.innerText = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }
}