(function() {
    'use strict';

    // ========================================================================
    // MAIN PREVIEW TAB LOGIC
    // ========================================================================
    class PreviewTab {
        constructor() {
            // Access DB from Global Namespace
            this.db = new window.Purview.HistoryDB();
            
            this.lastActualSeed = -1;
            this.selLoras = {};
            this.seedHistory = [];
            this.selEmbeds = {};
            this.busy = false;
            this.isReusing = false; // Add this line
            this.initialized = false;
            this.allLoras = [];
            this.allEmbeds = [];

            // Load Bucket from LocalStorage
            try {
                this.loraBucket = new Set(JSON.parse(localStorage.getItem('swm_p_lora_bucket') || '[]'));
            } catch (e) {
                this.loraBucket = new Set();
            }

            this.startSafetyCheck();
        }

        startSafetyCheck() {
            const check = () => {
                // Ensure core SwarmUI libraries AND our DB are loaded
                if (document.getElementById('p_prompt') &&
                    document.getElementById('preview-tab-container') &&
                    typeof $ !== 'undefined' &&
                    typeof loraHelper !== 'undefined' &&
                    typeof imageEditor !== 'undefined' &&
                    window.Purview && window.Purview.HistoryDB) {
                    this.init();
                } else {
                    setTimeout(check, 250);
                }
            };
            check();
        }

        async init() {
            if (this.initialized) return;
            this.initialized = true;

            try {
                this.mapDOM();

                await this.db.open();
                await this.db.migrate();
                this.renderHist();

                this.bindEvents();
                this.initResizers();

                if (typeof $.fn.select2 !== 'undefined') {
                    $(this.dom.model).select2({ width: '100%', dropdownAutoWidth: true });
                    $(this.dom.sampler).select2({ width: '100%', minimumResultsForSearch: Infinity });
                    $(this.dom.scheduler).select2({ width: '100%', minimumResultsForSearch: Infinity });
                }

                this.sync(true);
                setTimeout(() => this.sync(true), 1500);

                if (this.dom.watchMain && this.dom.watchMain.checked) this.obsMain();
                this.registerWithLayout();

                this.loadLoras();
                this.loadEmbeddings();

                if ($('#p_show_prompt_overlay').is(':checked')) this.updatePromptOverlay();

            } catch (e) {
                console.error("Purview Tab Init Error:", e);
            }
        }

        mapDOM() {
            const get = (id) => document.getElementById(id);
            this.dom = {
                prompt: get('p_prompt'), neg: get('p_neg'), model: get('p_model'),
                steps: get('p_steps'), cfg: get('p_cfg'), width: get('p_width'), height: get('p_height'), batch: get('p_batch'),
                seed: get('p_seed'), seedLock: get('p_seed_lock'),
                sampler: get('p_sampler'), scheduler: get('p_scheduler'),
                auto: get('p_auto'), watchMain: get('p_auto'),
                stepsDiv: get('p_step_strip'), img: get('p_image_large'), hist: get('p_history'),
                loraSearch: get('p_lora_search'), embedSearch: get('p_embed_search'),
                varSeed: get('p_var_seed'), varStrength: get('p_var_strength'),
                stopAt: get('p_stop_at'), iterate: get('p_iterate_seed'),
                scannerLoop: get('p_scanner_loop'), compareMode: get('p_compare_mode')
            };
        }

        bindEvents() {
            $(this.dom.prompt).add(this.dom.neg).on('input', () => this.trig(1200));
            $(this.dom.width).add(this.dom.height).add(this.dom.batch).on('input', () => this.trig(500));
            
            $('#p_steps').on('input', function() { $('#p_steps_val').val(this.value); });
            $('#p_steps_val').on('input', function() { $('#p_steps').val(this.value); this.trig(); }.bind(this));
            $('#p_cfg').on('input', function() { $('#p_cfg_val').val(this.value); });
            $('#p_cfg_val').on('input', function() { $('#p_cfg').val(this.value); this.trig(); }.bind(this));

            $(this.dom.model).add(this.dom.sampler).add(this.dom.scheduler).on('change', () => this.trig());
            $(this.dom.auto).on('change', () => this.trig());
            
            $(this.dom.seedLock).on('change', () => {
                if (this.dom.seedLock.checked && this.lastActualSeed !== -1) this.dom.seed.value = this.lastActualSeed;
                else this.dom.seed.value = -1;
                this.trig();
            });
            $(this.dom.seed).on('input', () => {
                if (this.dom.seedLock) this.dom.seedLock.checked = (parseInt(this.dom.seed.value) !== -1);
                this.trig();
            });
            $(this.dom.varSeed).add(this.dom.varStrength).on('input', () => this.trig());

            $('#p_generate').on('click', () => this.gen());
            $('#p_interrupt').on('click', () => {
                if (this.ws) this.ws.close();
                genericRequest('InterruptAll', {}, () => {});
                this.fin();
            });
            $('#p_pull').on('click', () => this.sync(true));
            $('#p_push').on('click', () => this.sync(false));
            
            $('#p_clear_history').on('click', async () => {
                if (confirm('Clear all UNLOCKED history?')) {
                    await this.db.clearUnlocked();
                    this.renderHist();
                }
            });
            
            $('#p_clear_steps').on('click', () => $(this.dom.stepsDiv).empty());
            
            $('#p_toggle_left').on('click', () => { $('#p_sidebar, #p_resizer').toggle(); $('#p_sidebar').toggleClass('active'); });
            $('#p_toggle_right').on('click', () => $('#p_right_sidebar, #p_right_resizer').toggle());
            
            $('#p_lora_search').on('input', () => this.renderLoras($('#p_lora_search').val()));
            $('#p_embed_search').on('input', () => this.renderEmbeddings($('#p_embed_search').val()));
            $('#p_clear_loras').on('click', () => { this.selLoras = {}; this.renderLoras(); this.trig(); });
            $('#p_clear_bucket').on('click', () => { this.loraBucket.clear(); localStorage.setItem('swm_p_lora_bucket', '[]'); this.renderLoras(); });

            $('#p_refresh_models').on('click', () => {
                this.loadLoras();
                this.loadEmbeddings();
                this.sync(true);
            });

            $('.p-collapsible-header').on('click', function() {
                $(this).next('.p-collapse-content').slideToggle();
                $(this).find('.arrow').text((i, t) => t === '▼' ? '▶' : '▼');
            });

            $('.p-tab-link').on('click', function() {
                $('.p-tab-link').removeClass('active');
                $(this).addClass('active');
                $('.p-tab-content').removeClass('active');
                $('#tab-' + $(this).data('tab')).addClass('active');
            });

            $('.p-modal-close, #p_lightbox').on('click', (e) => {
                if (e.target === e.currentTarget || $(e.target).hasClass('p-modal-close')) $('#p_lightbox').fadeOut();
            });

            $('#p_show_prompt_overlay').on('change', () => {
                const show = $('#p_show_prompt_overlay').is(':checked');
                $('#p_prompt_overlay').toggle(show);
                if (show) this.updatePromptOverlay();
            });

            $('#p_compare_mode').on('change', () => {
                if ($('#p_compare_mode').is(':checked')) {
                    const currentImg = this.dom.img.querySelector('img');
                    this.compareBaseUrl = currentImg ? currentImg.src : null;
                    this.compareBaseMeta = this.lastRenderedMeta;
                } else {
                    this.compareBaseUrl = null;
                    this.compareBaseMeta = null;
                }
            });
        }

        // --- Core Logic ---
        sync(pull) {
            const map = { prompt: 'prompt', neg: 'negativeprompt', steps: 'steps', cfg: 'cfgscale', width: 'width', height: 'height', batch: 'batchsize', seed: 'seed' };
            
            const flash = (el) => {
                $(el).addClass('p-flash');
                setTimeout(() => $(el).removeClass('p-flash'), 1000);
            };

            Object.entries(map).forEach(([pk, mk]) => {
                const elP = this.dom[pk], elM = document.getElementById(`input_${mk}`);
                if (elP && elM) {
                    if (pull) {
                        if (elP.value != getInputVal(elM)) { elP.value = getInputVal(elM); flash(elP); }
                        $(`#${elP.id}_val`).val(elP.value);
                    } else {
                        if (getInputVal(elM) != elP.value) { setInputVal(elM, elP.value); triggerChangeFor(elM); flash(elP); }
                    }
                }
            });
            
            const syncSel = (pId, mId) => {
                const p = this.dom[pId], m = document.getElementById(mId);
                if (!p || !m) return;
                if (pull) {
                    if (m.options.length > 0 && (p.options.length === 0 || p.options.length !== m.options.length)) p.innerHTML = m.innerHTML;
                    if (p.value !== m.value) {
                        $(p).val(m.value);
                        if ($(p).data('select2')) $(p).trigger('change.select2');
                        flash(p.parentElement);
                    }
                } else {
                    if (typeof forceSetDropdownValue !== 'undefined') forceSetDropdownValue(mId, p.value);
                }
            };
            syncSel('model', 'current_model');
            syncSel('sampler', 'input_sampler');
            syncSel('scheduler', 'input_scheduler');
            
            if (pull) {
                try {
                    loraHelper.loadFromParams();
                    this.selLoras = {};
                    for (const lora of loraHelper.selected) {
                        this.selLoras[lora.name] = { name: lora.name, weight: lora.weight };
                    }
                    this.renderLoras();
                } catch (e) {}
            } else {
                try {
                    const loraInput = loraHelper.getLorasInput();
                    if (loraInput) {
                        const loraNames = Object.keys(this.selLoras);
                        const currentLoras = Array.from(loraInput.options).map(o => o.value);
                        for (const name of loraNames) {
                            if (!currentLoras.includes(name)) loraInput.add(new Option(name, name));
                        }
                    }
                    setDirectParamValue(getParamById('loras'), Object.keys(this.selLoras));
                    setDirectParamValue(getParamById('loraweights'), Object.values(this.selLoras).map(l => l.weight).join(','));
                } catch (e) {}
            }
        }

    trig(delay = 500) {
            if (!this.dom.auto.checked || this.isReusing) return; // FIX: Check for the isReusing flag
            clearTimeout(this.tmr);
            this.tmr = setTimeout(() => {
                if (this.busy) {
                    const seedToReuse = this.lastActualSeed; // FIX: Capture the seed before interrupting
                    if (this.ws) this.ws.close();
                    genericRequest('InterruptAll', {}, () => {});
                    this.fin();
                    // FIX: Pass the captured seed to the new generation
                    setTimeout(() => this.gen(seedToReuse > 0 ? seedToReuse : null), 250);
                } else {
                    this.gen();
                }
            }, delay);
        }

          gen(overrideSeed = null) { // FIX: Accept an overrideSeed parameter
            if (this.busy || !this.dom.model.value) return;
            this.busy = true;
            this.genTimestamp = Date.now();
            this.previewCount = 0;
            if (this.dom.stepsDiv) $(this.dom.stepsDiv).empty();

            $('#p_progress').show();
            $('#p_fill').css('width', '0%');
            $('#p_progress_text').text('Initializing...');
            $('#p_generate').prop('disabled', true);
            $('#p_interrupt').show();

            let p = this.dom.prompt.value;
            Object.values(this.selLoras || {}).forEach(l => p += ` <lora:${l.name}:${l.weight}>`);

            const params = {
                prompt: p,
                negativeprompt: this.dom.neg.value,
                images: this.dom.batch.value,
                steps: this.dom.steps.value,
                cfgscale: this.dom.cfg.value,
                width: this.dom.width.value,
                height: this.dom.height.value,
                // FIX: Prioritize overrideSeed, then the input value
                seed: overrideSeed !== null ? overrideSeed : this.dom.seed.value,
                model: this.dom.model.value,
                sampler: this.dom.sampler.value,
                scheduler: this.dom.scheduler.value,
                session_id: session_id,
                donotsave: true,
                outputintermediateimages: false
            };

            if (this.dom.varStrength && parseFloat(this.dom.varStrength.value) > 0) {
                params.variation_seed = this.dom.varSeed.value;
                params.variation_seed_strength = parseFloat(this.dom.varStrength.value);
            }

            this.lastParams = JSON.parse(JSON.stringify(params));
            this.ws = makeWSRequest('GenerateText2ImageWS', params, d => this.onMsg(d), e => this.fin());
        }

onMsg(d) {
    const batchIdx = d.batch_index || 0;
    const uniqueId = `${this.genTimestamp}_${batchIdx}`;

    if (d.metadata && d.metadata.sui_image_params) {
        const s = d.metadata.sui_image_params.seed;
        this.lastActualSeed = s;
        this.updateSeedHistory(s);
        
        // Force update lastParams seed so saving has the real seed, not -1
        if(this.lastParams) this.lastParams.seed = s;
        
        this.db.addSeed(s, this.lastParams);
        if (!this.dom.scannerLoop.checked || this.dom.seedLock.checked) {
            this.dom.seed.value = s;
        }
        
        // ========================================================================
        // FIX: Ensure metadata contains the actual seed for immediate display
        // ========================================================================
        if (!d.metadata.sui_image_params) {
            d.metadata.sui_image_params = {};
        }
        d.metadata.sui_image_params.seed = s;
    }

    if (d.gen_progress) {
        const p = d.gen_progress;
        let currentStep = p.step || 0;
        let total = p.total_steps || this.dom.steps.value;

        if (p.overall_percent) {
            $('#p_fill').css('width', `${p.overall_percent*100}%`);
            $('#p_progress_text').text(`Step ${currentStep}/${total} (${Math.round(p.overall_percent*100)}%)`);
        }

        if (p.preview || p.image) {
            this.previewCount++;
            let lbl = `Preview ${this.previewCount}`;
            // Pass the actual seed to show() as a separate parameter
            this.show(p.preview || p.image, false, batchIdx, d.metadata, false, lbl, this.lastActualSeed);

            const stopAt = parseInt(this.dom.stopAt.value);
            if (stopAt > 0 && this.dom.stepsDiv.children.length >= stopAt) {
                this.doScannerInterrupt();
            }
        }
    }
    if (d.image) {
        const url = d.image.image || d.image;
        // Pass the actual seed to show() for final image
        this.show(url, true, batchIdx, d.metadata, false, "Final", this.lastActualSeed);

        // ========================================================================
        // FIX: Ensure the correct seed is in the parameters before saving.
        // this.lastActualSeed holds the real seed received from an earlier
        // message, but this.lastParams might still have the original random (-1) seed.
        // This line corrects it just before writing to the database.
        // ========================================================================
        if (this.lastParams && this.lastActualSeed !== -1) {
            this.lastParams.seed = this.lastActualSeed;
        }

        this.db.add({
            id: uniqueId,
            timestamp: Date.now(),
            url: url,
            meta: d.metadata || {},
            params: this.lastParams, // This object now correctly contains the actual seed.
            isLocked: false
        }).then(() => this.renderHist());
        this.fin();
    }
}


        doScannerInterrupt() {
            if (this.ws) this.ws.close();
            genericRequest('InterruptAll', {}, () => {});
            if (this.dom.iterate && this.dom.iterate.checked) {
                let cur = parseInt(this.dom.seed.value);
                if (cur !== -1) this.dom.seed.value = cur + 1;
            }
            this.fin();
            if (this.dom.auto.checked && this.dom.scannerLoop && this.dom.scannerLoop.checked) {
                setTimeout(() => this.gen(), 200);
            }
        }

        fin() {
            this.busy = false;
            $('#p_progress').hide();
            $('#p_generate').prop('disabled', false);
            $('#p_interrupt').hide();
            if (this.ws) this.ws.close();
        }

show(url, final, batch = 0, metadata = null, skipStepAdd = false, labelText = "Step", seedVal = null) {
    this.dom.img.innerHTML = '';

    let currentParams = this.lastParams || {};
    if (metadata) {
        if (typeof metadata === 'string') try { metadata = JSON.parse(metadata); } catch (e) {}
        if (metadata && metadata.sui_image_params) currentParams = { ...currentParams, ...metadata.sui_image_params };
    }
    
    // ========================================================================
    // FIX: Priority order for seed value:
    // 1. Explicit seedVal parameter (passed from onMsg)
    // 2. Metadata seed (already updated in onMsg)
    // 3. Current params (fallback)
    // ========================================================================
    if (seedVal !== null && seedVal !== undefined) {
        currentParams.seed = seedVal;
    } else if (metadata && metadata.sui_image_params && metadata.sui_image_params.seed !== -1) {
        currentParams.seed = metadata.sui_image_params.seed;
    }

    this.lastRenderedMeta = currentParams;
    this.updatePromptOverlay();

            const infoBox = document.getElementById('p_info');
            if (infoBox) {
                let html = this.renderInfoBoxHtml(currentParams, url, "Current");
                if (this.compareBaseUrl) {
                    const refHtml = this.renderInfoBoxHtml(this.compareBaseMeta || {}, this.compareBaseUrl, "Reference");
                    html = `${refHtml}<hr style="margin:5px 0; border:0; border-top:1px dashed #666;">${html}`;
                }
                infoBox.innerHTML = html;

                $(infoBox).find('.p-info-btn[data-reuse]').on('click', (e) => {
                    e.stopPropagation();
                    this.reusePartial({ [e.currentTarget.dataset.reuse]: e.currentTarget.dataset.val });
                });
                $(infoBox).find('.p-info-btn[data-save]').on('click', (e) => {
                    e.stopPropagation();
                    this.downloadImage(e.currentTarget.dataset.save);
                });
                $(infoBox).find('.p-info-btn[data-reuse-all]').on('click', (e) => {
                    e.stopPropagation();
                    this.reuse(currentParams);
                });
                if (final || !this.busy) $(infoBox).show();
            }

            if (this.compareBaseUrl) {
                const container = document.createElement('div');
                container.style.display = 'grid';
                container.style.gridTemplateColumns = '1fr 1fr';
                container.style.gap = '2px';
                container.style.height = '100%';
                const pane1 = document.createElement('div');
                pane1.innerHTML = `<img src="${this.compareBaseUrl}" style="width:100%; height:100%; object-fit:contain;">`;
                container.appendChild(pane1);
                const pane2 = document.createElement('div');
                pane2.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:contain;">`;
                container.appendChild(pane2);
                this.dom.img.appendChild(container);
            } else {
                const img = document.createElement('img');
                img.src = url;
                img.className = 'w-100 h-100 object-fit-contain';
                img.onclick = () => {
                    $('#p_lightbox .p-lightbox-image').attr('src', url);
                    $('#p_lightbox').fadeIn();
                };
                this.dom.img.appendChild(img);
            }

            if (!skipStepAdd && this.dom.stepsDiv) {
                const blk = document.createElement('div');
                blk.className = `image-block ${final?'final':''}`;
                blk.innerHTML = `<img src="${url}"><div class="image-preview-text small">${labelText}<br>${seedVal||''}</div>`;
                blk.onclick = (e) => { e.stopPropagation(); this.show(url, true, 0, metadata, true, labelText, seedVal); };
                this.dom.stepsDiv.appendChild(blk);
                this.dom.stepsDiv.scrollLeft = this.dom.stepsDiv.scrollWidth;
            }
        }

renderInfoBoxHtml(p, imageUrl, titleLabel) {
    let modelShort = (p.model || "").split('/').pop().replace('.safetensors', '').replace('.ckpt', '');
    if (modelShort.length > 25) modelShort = modelShort.substring(0, 22) + '...';
    
    // ========================================================================
    // FIX: Ensure seed display doesn't show -1 for generated images
    // ========================================================================
    const displaySeed = (p.seed === -1 && this.lastActualSeed !== -1) ? this.lastActualSeed : p.seed;

    const mkRow = (lbl, val, key) => `<div class="p-info-label">${lbl}</div><div class="p-info-val" title="${val}">${val}</div>${key ? `<div class="p-info-btn" data-reuse="${key}" data-val="${val}" title="Reuse ${lbl}">♻️</div>` : '<div></div>'}`;

    return `<div style="margin-bottom:2px; font-weight:bold; color:#ccc; border-bottom:1px solid rgba(255,255,255,0.1); font-size:10px;">${titleLabel}</div>
        <div class="p-info-grid">${mkRow('Steps', p.steps, 'steps')}${mkRow('CFG', p.cfgscale, 'cfg')}${mkRow('Seed', displaySeed, 'seed')}${mkRow('Sampler', p.sampler, 'sampler')}${mkRow('Scheduler', p.scheduler, 'scheduler')}
            <div class="p-info-label">Model</div><div class="p-info-val" title="${p.model}">${modelShort}</div><div class="p-info-btn" data-reuse="model" data-val="${p.model}" title="Reuse Model">♻️</div></div>
        <div style="margin-top:4px; padding-top:2px; display:flex; gap:10px;"><span class="p-info-btn" data-reuse-all="true" style="font-size:10px;">Reuse All ♻️</span><span class="p-info-btn" data-save="${imageUrl}" style="font-size:10px;">Save 💾</span></div>`;
}

        async downloadImage(url) {
            if (!url) return;
            try {
                const response = await fetch(url);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = `preview_${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
                if(typeof doNoticePopover !== 'undefined') doNoticePopover("Saved!", 'notice-pop-green');
            } catch (e) {
                console.error("Download failed:", e);
                if(typeof doNoticePopover !== 'undefined') doNoticePopover("Save Failed", 'notice-pop-red');
            }
        }

        updatePromptOverlay() {
            const overlay = document.getElementById('p_prompt_overlay');
            if (overlay) {
                overlay.textContent = (this.lastRenderedMeta && this.lastRenderedMeta.prompt) ? this.lastRenderedMeta.prompt : "";
            }
        }

        updateSeedHistory(newSeed) {
            if (this.seedHistory.length > 0 && this.seedHistory[0] === newSeed) return;
            this.seedHistory = this.seedHistory.filter(s => s !== newSeed);
            this.seedHistory.unshift(newSeed);
            if (this.seedHistory.length > 4) this.seedHistory.pop();

            const container = $('#p_seed_history');
            if (!container.length) return;
            container.empty();

            this.seedHistory.forEach((seed, index) => {
                const pill = $('<div>')
                    .text(seed)
                    .attr('title', index === 0 ? "Current" : "Reuse")
                    .addClass('seed-pill')
                    .on('click', (e) => {
                        e.stopPropagation();
                        this.dom.seed.value = seed;
                        $(this.dom.seedLock).prop('checked', true).trigger('change');
                        this.trig();
                    });
                if (index === 0) pill.addClass('active');
                container.append(pill);
            });
        }

        async renderHist() {
            const items = await this.db.getAll();
            const hist = $(this.dom.hist);
            hist.empty();

            if (items.length === 0) {
                hist.html('<div style="text-align:center; padding:20px; opacity:0.5;">No History</div>');
                return;
            }

            items.forEach((h) => {
                const d = $('<div>').addClass('image-block');
                if (h.isLocked) {
                    d.addClass('locked');
                }
                d.html(`<img src="${h.url}">`);

                const over = $('<div>').addClass('p-hist-overlay');
                const mkBtn = (icon, fn) => $('<span>').addClass('p-hist-btn').text(icon).on('click', fn);

                over.append(mkBtn(h.isLocked ? '🔓' : '🔒', async (e) => {
                    e.stopPropagation();
                    await this.db.toggleLock(h.id);
                    this.renderHist();
                }));

                over.append(mkBtn('♻️', (e) => {
                    e.stopPropagation();
                    this.reuse(h.params);
                }));

                over.append(mkBtn('🗑️', async (e) => {
                    e.stopPropagation();
                    if (confirm('Delete this image?')) {
                        await this.db.delete(h.id);
                        this.renderHist();
                    }
                }));

                d.append(over);

                d.on('click', () => {
                    hist.find('.image-block').removeClass('image-block-current');
                    d.addClass('image-block-current');
                    
                    let meta = h.meta || {};
                    if (typeof meta === 'string') {
                        try { meta = JSON.parse(meta); } catch (e) {}
                    }
                    
                    let finalParams = h.params || {};
                    if (meta.sui_image_params) {
                        if (finalParams.seed === -1 && meta.sui_image_params.seed !== -1) {
                            finalParams.seed = meta.sui_image_params.seed;
                        }
                    }
                    
                    meta.sui_image_params = finalParams;

                    this.show(h.url, true, 0, meta, true, 'History', finalParams.seed);
                    this.updateSeedHistory(finalParams.seed); // FIX: Update seed history on click
                });

                hist.append(d);
            });
        }

        reuse(p) {
            const paramsToReuse = { ...p };
            delete paramsToReuse.model;
            if (this.dom.seedLock.checked) {
                delete paramsToReuse.seed;
            }
            this.reusePartial(paramsToReuse);
        }

        reusePartial(p) {
            if (!p) return;
            this.isReusing = true; // FIX: Set the flag
            try {
                const set = (k, v) => {
                    if (this.dom[k] && v !== undefined) {
                        $(this.dom[k]).val(v).trigger('input').trigger('change');
                    }
                };

                if (p.prompt) set('prompt', p.prompt);
                if (p.negativeprompt) set('neg', p.negativeprompt);
                if (p.steps) set('steps', p.steps);
                if (p.cfgscale) set('cfg', p.cfgscale);
                if (p.width) set('width', p.width);
                if (p.height) set('height', p.height);
                if (p.seed) set('seed', p.seed);

                if (p.model) {
                    const m = this.dom.model;
                    if (!$(`option[value="${p.model}"]`, m).length) {
                        $(m).append(new Option(p.model.split('/').pop(), p.model));
                    }
                    set('model', p.model);
                }
            } finally {
                this.isReusing = false; // FIX: Unset the flag, even if an error occurs
            }
        }

        initResizers() {
            const makeResizer = (resizerId, sidebarId, direction) => {
                const resizer = document.getElementById(resizerId);
                const sidebar = document.getElementById(sidebarId);
                if (!resizer || !sidebar) return;

                resizer.onmousedown = (e) => {
                    e.preventDefault();
                    document.body.style.cursor = direction === 'width' ? 'col-resize' : 'row-resize';

                    const onMove = (em) => {
                        const rect = document.getElementById('preview-tab-container').getBoundingClientRect();
                        if (direction === 'width') {
                            if (sidebarId === 'p_sidebar') {
                                sidebar.style.width = `${em.clientX - rect.left}px`;
                            } else {
                                sidebar.style.width = `${rect.right - em.clientX}px`;
                            }
                        } else {
                            sidebar.style.height = `${rect.bottom - em.clientY}px`;
                        }
                    };

                    const onUp = () => {
                        document.body.style.cursor = '';
                        window.removeEventListener('mousemove', onMove);
                        window.removeEventListener('mouseup', onUp);
                    };

                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                };
            };

            makeResizer('p_resizer', 'p_sidebar', 'width');
            makeResizer('p_right_resizer', 'p_right_sidebar', 'width');
            makeResizer('p_vertical_resizer', document.querySelector('.p-bottom-panel').id, 'height');
        }

        loadLoras() {
            this.selLoras = this.selLoras || {};
            const list = $('#p_lora_list').html('<div style="padding:5px; color:#888;">Loading...</div>');

            genericRequest('ListModels', { path: "", depth: 10, subtype: "LoRA" }, data => {
                this.allLoras = (data.files || []).map(f => f.name).sort((a, b) => a.localeCompare(b));
                this.renderLoras();
            });
        }

        toggleBucket(name) {
            if (this.loraBucket.has(name)) {
                this.loraBucket.delete(name);
            } else {
                this.loraBucket.add(name);
            }
            localStorage.setItem('swm_p_lora_bucket', JSON.stringify([...this.loraBucket]));
            this.renderLoras($('#p_lora_search').val());
        }

        renderLoras(filter = '') {
            // 1. Render Active List (Top)
            const activeList = $('#p_lora_active_list').empty();
            const activeKeys = Object.keys(this.selLoras);
            $('#p_lora_active_wrapper').toggle(activeKeys.length > 0);

            activeKeys.forEach(loraName => {
                const data = this.selLoras[loraName];
                const item = $('<div>').addClass('lora-item active-lora-item');

                const header = $('<div>').addClass('lora-item-header');
                const title = $('<span>').text(loraName.replace(/\.(safetensors|pt)$/, '').replace(/_/g, ' ')).css('font-weight', 'bold');

                const removeBtn = $('<span class="p-btn p-btn-danger" style="padding:0 4px; font-size:10px;">X</span>');
                removeBtn.on('click', (e) => {
                    e.stopPropagation();
                    delete this.selLoras[loraName];
                    this.renderLoras(filter);
                    this.trig();
                });

                header.append(title, removeBtn);
                item.append(header);

                // Weight Sliders
                const controls = $('<div>').addClass('p-lora-controls');
                const slider = $('<input type="range" min="-2" max="2" step="0.01">').val(data.weight).css('flex', '1');
                const num = $('<input type="number" step="0.01">').val(data.weight).css('width', '50px');

                slider.on('input', () => num.val(slider.val()));
                num.on('input', () => slider.val(num.val()));
                slider.add(num).on('change', () => {
                    this.selLoras[loraName].weight = parseFloat(slider.val());
                    this.trig();
                });

                controls.append(slider, num);
                item.append(controls);
                activeList.append(item);
            });

            // 2. Render Bucket List (Middle)
            const bucketList = $('#p_lora_bucket_list').empty();
            const bucketArray = Array.from(this.loraBucket);
            $('#p_lora_bucket_wrapper').toggle(bucketArray.length > 0);

            bucketArray.forEach(loraName => {
                // Skip if already active
                if (this.selLoras[loraName]) return;

                const item = $('<div>').addClass('bucket-item');
                const title = $('<span>').text(loraName.replace(/\.(safetensors|pt)$/, '').replace(/_/g, ' '))
                    .css({ cursor: 'pointer', flex: 1 })
                    .on('click', () => {
                        this.selLoras[loraName] = { name: loraName, weight: 1.0 };
                        this.renderLoras(filter);
                        this.trig();
                    });

                const actions = $('<div>').addClass('bucket-actions');
                const unbucketBtn = $('<span class="p-btn p-btn-sm p-btn-outline" title="Remove from Bucket">-</span>');
                unbucketBtn.on('click', (e) => {
                    e.stopPropagation();
                    this.toggleBucket(loraName);
                });

                actions.append(unbucketBtn);
                item.append(title, actions);
                bucketList.append(item);
            });

            // 3. Render Library List (Bottom)
            const libraryList = $('#p_lora_list').empty();
            if (!this.allLoras || !this.allLoras.length) {
                libraryList.html('<div style="padding:5px;">No LoRAs</div>');
                return;
            }

            // Filter: Search AND Not Active AND Not Bucket
            const filtered = this.allLoras.filter(n =>
                !this.selLoras[n] &&
                !this.loraBucket.has(n) &&
                n.toLowerCase().includes(filter.toLowerCase())
            );

            filtered.forEach(loraName => {
                const item = $('<div>').addClass('lora-item');
                const header = $('<div>').css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' });

                const title = $('<span>').text(loraName.replace(/\.(safetensors|pt)$/, '').replace(/_/g, ' '))
                    .css({ cursor: 'pointer', flex: 1 })
                    .on('click', () => {
                        this.selLoras[loraName] = { name: loraName, weight: 1.0 };
                        this.renderLoras(filter);
                        this.trig();
                    });

                const starBtn = $('<span>').addClass('p-star-btn').html('★').attr('title', 'Add to Bucket');
                starBtn.on('click', (e) => {
                    e.stopPropagation();
                    this.toggleBucket(loraName);
                });

                header.append(title, starBtn);
                item.append(header);
                libraryList.append(item);
            });
        }

        loadEmbeddings() {
            this.selEmbeds = this.selEmbeds || {};
            genericRequest('ListModels', { path: "", depth: 10, subtype: "Embedding" }, data => {
                this.allEmbeds = (data.files || []).map(f => f.name).sort((a, b) => a.localeCompare(b));
                this.renderEmbeddings();
            });
        }

        injectEmbedding(name) {
            const target = $('#p_embed_target').val();
            const weight = $('#p_embed_weight').val();
            const textarea = target === 'pos' ? $(this.dom.prompt) : $(this.dom.neg);
            let text = textarea.val();

            // Format token
            const token = parseFloat(weight) === 1.0 ? `<embedding:${name}>` : `(embedding:${name}:${weight})`;

            // Simple dedupe check
            if (text.includes(name)) return;

            // Append with space logic
            text = text + (text.length > 0 && !text.endsWith(' ') ? ' ' : '') + token;
            textarea.val(text).trigger('input');
        }

        renderEmbeddings(filter = '') {
            const list = $('#p_embed_list').empty();
            const filtered = (this.allEmbeds || []).filter(n => n.toLowerCase().includes(filter.toLowerCase()));

            filtered.forEach(embedName => {
                const item = $('<div>').addClass('lora-item');
                item.text(embedName.replace(/\.(safetensors|pt)$/, ''))
                    .css('cursor', 'pointer')
                    .on('click', () => this.injectEmbedding(embedName));
                list.append(item);
            });
        }

        obsMain() {
            new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
                const img = n.querySelector?.('img');
                if (img && img.src && !this.busy) {
                    this.show(img.src, false);
                }
            }))).observe(document.getElementById('current_image_batch'), { childList: true, subtree: true });
        }

        registerWithLayout() {
            if (typeof genTabLayout !== 'undefined') {
                const links = document.querySelectorAll('.nav-link');
                const myLink = Array.from(links).find(a => a.innerText === "Purview");
                if (myLink) {
                    genTabLayout.registerTab(myLink);
                }
            }
        }
    }

    // Start class
    new PreviewTab();

})();