(function() {
    'use strict';

    // Ensure Global Namespace
    window.Purview = window.Purview || {};

    // ========================================================================
    // DATABASE MANAGER (IndexedDB)
    // ========================================================================
    window.Purview.HistoryDB = class HistoryDB {
        constructor() {
            this.dbName = 'SwarmPreviewDB';
            this.ver = 3;
            this.storeName = 'history';
            this.stepStoreName = 'steps';
            this.seedStoreName = 'seeds';
            this.db = null;
        }

        async open() {
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(this.dbName, this.ver);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        db.createObjectStore(this.storeName, { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains(this.stepStoreName)) {
                        const stepStore = db.createObjectStore(this.stepStoreName, { keyPath: 'id', autoIncrement: true });
                        stepStore.createIndex("gen_id", "gen_id", { unique: false });
                    }
                    if (!db.objectStoreNames.contains(this.seedStoreName)) {
                        db.createObjectStore(this.seedStoreName, { keyPath: 'timestamp' });
                    }
                };
                req.onsuccess = (e) => { this.db = e.target.result; resolve(); };
                req.onerror = (e) => { reject(e); };
            });
        }

        async add(entry) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction([this.storeName], 'readwrite');
                entry.isLocked = false;
                tx.objectStore(this.storeName).add(entry).onsuccess = () => resolve();
                tx.onerror = (e) => reject(e);
            });
        }

        async toggleLock(id) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction([this.storeName], 'readwrite');
                const store = tx.objectStore(this.storeName);
                const req = store.get(id);
                req.onsuccess = () => {
                    const data = req.result;
                    if (data) {
                        data.isLocked = !data.isLocked;
                        store.put(data).onsuccess = () => resolve(data.isLocked);
                    } else {
                        resolve(false);
                    }
                };
                req.onerror = (e) => reject(e);
            });
        }

        async getAll() {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction([this.storeName], 'readonly');
                const req = tx.objectStore(this.storeName).getAll();
                req.onsuccess = () => {
                    const res = req.result.sort((a, b) => b.timestamp - a.timestamp);
                    if (res.length > 150) {
                        const toDelete = res.slice(150).filter(x => !x.isLocked);
                        this.trim(toDelete);
                    }
                    resolve(res);
                };
                req.onerror = (e) => reject(e);
            });
        }

        async delete(id) {
            const tx = this.db.transaction([this.storeName, this.stepStoreName], 'readwrite');
            tx.objectStore(this.storeName).delete(id);
            const stepStore = tx.objectStore(this.stepStoreName);
            const index = stepStore.index("gen_id");
            const req = index.getAllKeys(id);
            req.onsuccess = () => {
                req.result.forEach(key => stepStore.delete(key));
            };
            return new Promise(resolve => tx.oncomplete = () => resolve());
        }

        async clearUnlocked() {
            const items = await this.getAll();
            const tx = this.db.transaction([this.storeName, this.stepStoreName], 'readwrite');
            const hStore = tx.objectStore(this.storeName);
            const sStore = tx.objectStore(this.stepStoreName);
            const sIndex = sStore.index("gen_id");
            items.forEach(item => {
                if (!item.isLocked) {
                    hStore.delete(item.id);
                    const req = sIndex.getAllKeys(item.id);
                    req.onsuccess = () => {
                        req.result.forEach(k => sStore.delete(k));
                    };
                }
            });
            return new Promise(resolve => tx.oncomplete = () => resolve());
        }

        async trim(items) {
            items.forEach(i => this.delete(i.id));
        }

        async addStep(step) {
            return new Promise((resolve) => {
                const tx = this.db.transaction([this.stepStoreName], 'readwrite');
                tx.objectStore(this.stepStoreName).add(step);
                tx.oncomplete = () => resolve();
            });
        }

        async getSteps(genId) {
            return new Promise((resolve) => {
                const tx = this.db.transaction([this.stepStoreName], 'readonly');
                const index = tx.objectStore(this.stepStoreName).index("gen_id");
                const req = index.getAll(genId);
                req.onsuccess = () => resolve(req.result || []);
            });
        }

        async addSeed(seed, params) {
            return new Promise((resolve) => {
                const tx = this.db.transaction([this.seedStoreName], 'readwrite');
                tx.objectStore(this.seedStoreName).put({
                    timestamp: Date.now(),
                    seed: seed,
                    params: params
                });
                tx.oncomplete = () => resolve();
            });
        }

        async migrate() { /* Logic handled in onupgradeneeded */ }
    };
})();