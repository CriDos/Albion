import { ICON_CONFIG } from '../constants.js';

export class IconService {
    constructor() {
        this.iconCache = {};
        this.db = null;
        this.initIconsDatabase();
        this.tooltip = null;
        this.createTooltip();
    }

    initIconsDatabase() {
        const request = indexedDB.open(ICON_CONFIG.DB_NAME, ICON_CONFIG.DB_VERSION);

        request.onerror = (event) => { };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(ICON_CONFIG.STORE_NAME)) {
                db.createObjectStore(ICON_CONFIG.STORE_NAME, { keyPath: 'url' });
            }
        };

        request.onsuccess = (event) => {
            this.db = event.target.result;
        };
    }

    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'copy-tooltip';
        this.tooltip.textContent = 'Скопировано!';
        document.body.appendChild(this.tooltip);
    }

    showCopyTooltip(element, text) {
        const rect = element.getBoundingClientRect();
        this.tooltip.textContent = text || 'Скопировано!';
        this.tooltip.style.left = `${rect.left + (rect.width / 2)}px`;
        this.tooltip.style.top = `${rect.top - 30}px`;
        this.tooltip.style.transform = 'translate(-50%, 0)';

        gsap.fromTo(this.tooltip,
            { opacity: 0, y: 10 },
            {
                opacity: 1, y: 0, duration: ICON_CONFIG.ANIMATION.TOOLTIP_DURATION,
                onComplete: () => {
                    gsap.to(this.tooltip, {
                        opacity: 0,
                        y: -10,
                        delay: ICON_CONFIG.ANIMATION.TOOLTIP_DELAY,
                        duration: ICON_CONFIG.ANIMATION.TOOLTIP_DURATION
                    });
                }
            }
        );
    }

    getItemIconUrl(itemId) {
        return `${ICON_CONFIG.ICON_BASE_URL}/${itemId}.png`;
    }

    async getIconFromCache(url) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve(null);
                return;
            }

            try {
                const transaction = this.db.transaction([ICON_CONFIG.STORE_NAME], 'readonly');
                const store = transaction.objectStore(ICON_CONFIG.STORE_NAME);
                const request = store.get(url);

                request.onsuccess = function (event) {
                    resolve(event.target.result);
                };

                request.onerror = function (event) {
                    resolve(null);
                };
            } catch (error) {
                resolve(null);
            }
        });
    }

    saveIconToCache(url, blob) {
        if (!this.db) return;

        try {
            const transaction = this.db.transaction([ICON_CONFIG.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(ICON_CONFIG.STORE_NAME);

            const iconData = {
                url: url,
                blob: blob,
                timestamp: new Date().getTime()
            };

            store.put(iconData);
        } catch (error) { }
    }

    async loadItemIcon(url, imgElement) {
        if (this.iconCache[url]) {
            imgElement.src = this.iconCache[url];
            return;
        }

        try {
            const cachedIcon = await this.getIconFromCache(url);
            if (cachedIcon) {
                this.iconCache[url] = URL.createObjectURL(cachedIcon.blob);
                imgElement.src = this.iconCache[url];
            } else {
                this.setupImageEvents(url, imgElement);
                imgElement.src = url;
            }
        } catch (error) {
            imgElement.src = url;
        }
    }

    setupImageEvents(url, imgElement) {
        const blankImage = ICON_CONFIG.BLANK_IMAGE;

        imgElement.onerror = () => {
            imgElement.src = blankImage;
            imgElement.style.opacity = '0.3';
            this.iconCache[url] = blankImage;

            fetch(blankImage)
                .then(response => response.blob())
                .then(blob => this.saveIconToCache(url, blob))
                .catch(() => { });
        };

        imgElement.onload = () => {
            const proxyUrl = ICON_CONFIG.PROXY_URL + encodeURIComponent(url);

            fetch(proxyUrl)
                .then(response => {
                    if (!response.ok) throw new Error('Ошибка сети при загрузке иконки');
                    return response.blob();
                })
                .then(blob => {
                    this.saveIconToCache(url, blob);
                    this.iconCache[url] = URL.createObjectURL(blob);
                })
                .catch(() => { });
        };
    }
} 