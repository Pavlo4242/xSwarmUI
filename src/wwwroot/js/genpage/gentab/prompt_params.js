/**
    Add core generation parameters directly to the Prompt Tab
    
    This creates TRUE CLONES - the original inputs remain in the sidebar
    
    Place this in: src/wwwroot/js/genpage/gentab/prompt_params.js
*/

// Wait for the page to fully load
sessionReadyCallbacks.push(() => {
    // Add a small delay to ensure all DOM elements are ready
    setTimeout(() => {
        addCoreParamsToPromptTab();
    }, 100);
});

function addCoreParamsToPromptTab() {
    console.log('Attempting to add core parameters to prompt tab...');

    // Prevent duplicate insertion if this runs multiple times
    if (document.getElementById('prompt_tab_params_container')) {
        console.log('Parameters container already exists, skipping.');
        return;
    }

    // Get the main prompt line area - this is where we'll insert
    const altPromptMainLine = document.querySelector('.alt_prompt_main_line');
    if (!altPromptMainLine) {
        console.error('Main prompt line not found (.alt_prompt_main_line)');
        return;
    }

    // Find the buttons wrapper to insert before it
    const buttonsWrapper = altPromptMainLine.querySelector('.alt-prompt-buttons-wrapper');
    if (!buttonsWrapper) {
        console.error('Buttons wrapper not found (.alt-prompt-buttons-wrapper)');
        return;
    }

    console.log('Found insertion point, creating parameters container...');

    // Inject custom layout styles to organize the bar (Prompt Middle, Settings Right)
    addParamsLayoutStyles();

    // Create the container for our parameters
    const paramsContainer = document.createElement('div');
    paramsContainer.id = 'prompt_tab_params_container';
    paramsContainer.className = 'prompt-tab-params-container';

    // Build the HTML structure
    paramsContainer.innerHTML = `
        <div class="prompt-params-header">
            <h5 class="prompt-params-title">Core Settings</h5>
            <button class="prompt-params-toggle" id="prompt_params_toggle" type="button" title="Toggle settings visibility">
                <span class="toggle-icon">▼</span>
            </button>
        </div>
        <div class="prompt-params-content" id="prompt_params_content">
            <div class="prompt-params-grid" id="prompt_params_grid"></div>
        </div>
    `;

    // Insert AFTER the buttons wrapper to place it on the far right
    buttonsWrapper.after(paramsContainer);

    console.log('Container inserted, now populating parameters...');

    // Add the parameters
    populatePromptParams();

    // Setup toggle functionality
    setupParamsToggle();

    console.log('Core parameters successfully added to prompt tab');
}

function addParamsLayoutStyles() {
    // Prevent duplicate style injection
    if (document.getElementById('prompt_params_layout_css')) return;

    const style = document.createElement('style');
    style.id = 'prompt_params_layout_css';
    style.innerHTML = `
        /* Enforce Flexbox on the main line to control layout */
        .alt_prompt_main_line {
            display: flex !important;
            flex-wrap: nowrap !important;
            align-items: stretch !important;
            gap: 10px !important;
            width: 100% !important;
            padding-right: 5px !important;
        }

        /* Make Prompt Bigger: Force it to fill all available space */
        .alt_prompt_textboxes {
            flex-grow: 10 !important;
            flex-shrink: 1 !important;
            width: auto !important;
            min-width: 300px !important; /* Prevent it from getting crushed */
        }

        /* Prevent other elements from shifting unexpectedly */
        .alt-text-add-button-wrapper, 
        .alt-text-tokencount-wrapper,
        .alt-prompt-buttons-wrapper {
            flex-shrink: 0 !important;
            height: auto !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
        }

        /* Settings Container Styling (Right Side) */
        .prompt-tab-params-container {
            flex-shrink: 0 !important;
            width: 280px !important; /* Fixed width for stability */
            min-width: 280px !important;
            border-left: 1px solid rgba(128, 128, 128, 0.5);
            padding-left: 10px;
            margin-left: 5px;
            display: flex;
            flex-direction: column;
            max-height: 100px; /* Limit height to match prompt area roughly */
            overflow: visible;
        }

        /* Header Compactness */
        .prompt-params-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 2px;
            margin-bottom: 2px;
            border-bottom: 1px solid rgba(128, 128, 128, 0.2);
        }
        
        .prompt-params-title {
            margin: 0 !important;
            font-size: 0.85rem !important;
            font-weight: bold;
            opacity: 0.8;
        }

        /* Grid Layout for Inputs */
        .prompt-params-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px;
            overflow-y: auto;
            padding-right: 2px;
        }
        
        .prompt-params-content {
            flex-grow: 1;
            overflow-y: auto;
        }

        /* Compact Parameter Inputs */
        .prompt-param {
            display: flex;
            flex-direction: column;
            gap: 1px;
        }

        .prompt-param-label {
            font-size: 0.7rem !important;
            opacity: 0.7;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 0 !important;
        }

        .prompt-param-input-field,
        .prompt-param-select {
            font-size: 0.8rem !important;
            padding: 1px 4px !important;
            height: 24px !important;
            width: 100% !important;
        }
    `;
    document.head.appendChild(style);
}

function populatePromptParams() {
    const grid = document.getElementById('prompt_params_grid');
    if (!grid) {
        console.error('Parameters grid not found');
        return;
    }

    // Define which parameters to show and their layout
    const params = [
        { id: 'sampler', span: 1 },
        { id: 'scheduler', span: 1 },
        { id: 'steps', span: 1 },
        { id: 'cfgscale', span: 1 },
        { id: 'seed', span: 2 },
        { id: 'variationseed', span: 2 }
    ];

    let successCount = 0;

    params.forEach(param => {
        const paramId = param.id;
        const originalInput = document.getElementById(`input_${paramId}`);
        
        if (!originalInput) {
            console.warn(`Parameter input_${paramId} not found - skipping`);
            return;
        }

        // Get the label text
        const originalWrapper = originalInput.closest('.auto-input');
        const originalLabel = originalWrapper ? originalWrapper.querySelector('label') : null;
        const labelText = originalLabel ? originalLabel.textContent.replace(':', '').trim() : paramId;

        // Create parameter wrapper
        const paramDiv = document.createElement('div');
        paramDiv.className = `prompt-param prompt-param-span-${param.span}`;
        // Add grid span style if needed
        if (param.span > 1) {
            paramDiv.style.gridColumn = `span ${param.span}`;
        }
        
        const label = document.createElement('label');
        label.className = 'prompt-param-label';
        label.textContent = labelText;
        label.setAttribute('for', `prompt_${paramId}`);
        
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'prompt-param-input';
        
        // Clone the input - this creates a NEW element, doesn't move the original
        const clonedInput = cloneInput(paramId, originalInput);
        if (clonedInput) {
            inputWrapper.appendChild(clonedInput);
            paramDiv.appendChild(label);
            paramDiv.appendChild(inputWrapper);
            grid.appendChild(paramDiv);
            successCount++;
        }
    });

    console.log(`Successfully added ${successCount} parameters to prompt tab`);
}

function cloneInput(paramId, originalInput) {
    const inputType = originalInput.tagName.toLowerCase();
    let clonedInput;

    try {
        if (inputType === 'select') {
            // Create a brand NEW select element
            clonedInput = document.createElement('select');
            clonedInput.className = 'prompt-param-select';
            clonedInput.id = `prompt_${paramId}`;
            
            // Copy all options to the NEW select
            Array.from(originalInput.options).forEach(option => {
                const newOption = document.createElement('option');
                newOption.value = option.value;
                newOption.text = option.text;
                newOption.selected = option.selected;
                clonedInput.appendChild(newOption);
            });
            
            // Setup bidirectional sync: clone -> original
            clonedInput.addEventListener('change', () => {
                originalInput.value = clonedInput.value;
                $(originalInput).trigger('change');
                triggerChangeFor(originalInput);
            });
            
            // Setup bidirectional sync: original -> clone
            originalInput.addEventListener('change', () => {
                if (clonedInput.value !== originalInput.value) {
                    clonedInput.value = originalInput.value;
                }
            });
            
        } else if (inputType === 'input') {
            // Create a brand NEW input element
            clonedInput = document.createElement('input');
            clonedInput.id = `prompt_${paramId}`;
            clonedInput.type = originalInput.type;
            clonedInput.className = 'prompt-param-input-field';
            clonedInput.value = originalInput.value;
            
            // Copy attributes
            ['min', 'max', 'step', 'placeholder'].forEach(attr => {
                if (originalInput.hasAttribute(attr)) {
                    clonedInput.setAttribute(attr, originalInput.getAttribute(attr));
                }
            });
            
            // Setup bidirectional sync: clone -> original
            clonedInput.addEventListener('input', () => {
                originalInput.value = clonedInput.value;
                triggerChangeFor(originalInput);
            });

            clonedInput.addEventListener('change', () => {
                originalInput.value = clonedInput.value;
                triggerChangeFor(originalInput);
            });
            
            // Setup bidirectional sync: original -> clone
            originalInput.addEventListener('input', () => {
                if (clonedInput.value !== originalInput.value) {
                    clonedInput.value = originalInput.value;
                }
            });
            
            originalInput.addEventListener('change', () => {
                if (clonedInput.value !== originalInput.value) {
                    clonedInput.value = originalInput.value;
                }
            });
        }
        
        return clonedInput;
    } catch (error) {
        console.error(`Error cloning input ${paramId}:`, error);
        return null;
    }
}

function setupParamsToggle() {
    const toggleBtn = document.getElementById('prompt_params_toggle');
    const content = document.getElementById('prompt_params_content');
    const icon = toggleBtn ? toggleBtn.querySelector('.toggle-icon') : null;

    if (!toggleBtn || !content) {
        console.warn('Toggle button or content not found');
        return;
    }

    // Load saved state
    const isCollapsed = localStorage.getItem('prompt_params_collapsed') === 'true';
    if (isCollapsed) {
        content.style.display = 'none';
        if (icon) icon.textContent = '▶';
        toggleBtn.classList.add('collapsed');
    }

    // Toggle functionality
    toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const isCurrentlyCollapsed = content.style.display === 'none';
        
        if (isCurrentlyCollapsed) {
            content.style.display = 'block';
            if (icon) icon.textContent = '▼';
            toggleBtn.classList.remove('collapsed');
            localStorage.setItem('prompt_params_collapsed', 'false');
        } else {
            content.style.display = 'none';
            if (icon) icon.textContent = '▶';
            toggleBtn.classList.add('collapsed');
            localStorage.setItem('prompt_params_collapsed', 'true');
        }
        
        // Trigger layout recalculation
        if (typeof genTabLayout !== 'undefined' && genTabLayout.altPromptSizeHandle) {
            setTimeout(() => {
                genTabLayout.altPromptSizeHandle();
            }, 10);
        }
    });

    // Make header clickable too
    const header = toggleBtn.closest('.prompt-params-header');
    if (header) {
        header.style.cursor = 'pointer';
        header.addEventListener('click', (e) => {
            if (e.target !== toggleBtn && !toggleBtn.contains(e.target)) {
                toggleBtn.click();
            }
        });
    }

    console.log('Toggle functionality set up');
}

// Export for debugging
window.promptParamsDebug = {
    reinitialize: addCoreParamsToPromptTab,
    checkElements: () => {
        console.log('=== Original Inputs (should still exist) ===');
        console.log('input_sampler:', document.getElementById('input_sampler'));
        console.log('input_scheduler:', document.getElementById('input_scheduler'));
        console.log('input_steps:', document.getElementById('input_steps'));
        console.log('input_cfgscale:', document.getElementById('input_cfgscale'));
        console.log('input_seed:', document.getElementById('input_seed'));
        console.log('input_variationseed:', document.getElementById('input_variationseed'));
        console.log('=== Cloned Inputs (in prompt tab) ===');
        console.log('prompt_sampler:', document.getElementById('prompt_sampler'));
        console.log('prompt_scheduler:', document.getElementById('prompt_scheduler'));
        console.log('prompt_steps:', document.getElementById('prompt_steps'));
        console.log('prompt_cfgscale:', document.getElementById('prompt_cfgscale'));
        console.log('prompt_seed:', document.getElementById('prompt_seed'));
        console.log('prompt_variationseed:', document.getElementById('prompt_variationseed'));
        console.log('=== Containers ===');
        console.log('Alt prompt main line:', document.querySelector('.alt_prompt_main_line'));
        console.log('Buttons wrapper:', document.querySelector('.alt-prompt-buttons-wrapper'));
        console.log('Params container:', document.getElementById('prompt_tab_params_container'));
    },
    testSync: () => {
        let origSampler = document.getElementById('input_sampler');
        let cloneSampler = document.getElementById('prompt_sampler');
        console.log('Original sampler value:', origSampler?.value);
        console.log('Clone sampler value:', cloneSampler?.value);
        if (cloneSampler) {
            console.log('Changing clone to test sync...');
            cloneSampler.selectedIndex = (cloneSampler.selectedIndex + 1) % cloneSampler.options.length;
            cloneSampler.dispatchEvent(new Event('change'));
            setTimeout(() => {
                console.log('After change - Original:', origSampler?.value, 'Clone:', cloneSampler?.value);
            }, 100);
        }
    }
};