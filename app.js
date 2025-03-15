// Модуль для работы с иконками и кэшированием
class IconService {
    constructor() {
        this.iconCache = {};
        this.db = null;
        this.initIconsDatabase();
        this.tooltip = null;
        this.createTooltip();
    }

    initIconsDatabase() {
        const request = indexedDB.open('AlbionIconsCache', 1);

        request.onerror = (event) => { };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains('icons')) {
                db.createObjectStore('icons', { keyPath: 'url' });
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
            { opacity: 1, y: 0, duration: 0.3, 
                onComplete: () => {
                    gsap.to(this.tooltip, { 
                        opacity: 0, 
                        y: -10, 
                        delay: 1, 
                        duration: 0.3 
                    });
                }
            }
        );
    }

    getItemIconUrl(itemId) {
        return `https://albion-profit-calculator.com/images/items/${itemId}.png`;
    }

    async getIconFromCache(url) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve(null);
                return;
            }

            try {
                const transaction = this.db.transaction(['icons'], 'readonly');
                const store = transaction.objectStore('icons');
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
            const transaction = this.db.transaction(['icons'], 'readwrite');
            const store = transaction.objectStore('icons');

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
        const blankImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

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
            fetch(url)
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

// Модуль для работы с данными
class DataService {
    constructor() {
        this.itemsData = [];
        this.data = [];
        this.filteredData = [];
    }

    async loadItemsData() {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.overrideMimeType("application/json");
            xhr.open('GET', 'items.json', true);

            xhr.onload = () => {
                if (xhr.status === 200) {
                    try {
                        this.itemsData = JSON.parse(xhr.responseText);
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    reject(new Error(`Статус: ${xhr.status}`));
                }
            };

            xhr.onerror = () => {
                reject(new Error('Ошибка сети'));
            };

            xhr.send();
        });
    }

    getItemName(uniqueName) {
        let item = this.itemsData.find(item => item.UniqueName === uniqueName);

        if (!item) {
            const cleanUniqueName = uniqueName.replace(/@\d+$/, '');
            item = this.itemsData.find(item => item.UniqueName === cleanUniqueName);
        }

        if (item && item.LocalizedNames && item.LocalizedNames["RU-RU"]) {
            return item.LocalizedNames["RU-RU"];
        }

        return uniqueName;
    }

    async fetchMarketData(fromLocation, toLocation, itemsCount, sortType) {
        if (fromLocation === toLocation) {
            throw new Error('Выберите разные локации для отправления и получения');
        }

        const url = `https://albion-profit-calculator.com/api/transportations/sort?from=${encodeURIComponent(fromLocation)}&to=${encodeURIComponent(toLocation)}&count=${itemsCount}&skip=0&sort=BY_LAST_TIME_CHECKED,${sortType}&serverId=aod_europe`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ошибка: ${response.status}`);
        }

        const jsonData = await response.json();

        this.data = this.processApiData(jsonData);
        this.filteredData = [...this.data];

        return this.filteredData;
    }

    processApiData(apiData) {
        return apiData.map(item => {
            const fromItem = item.from;
            const toItem = item.to;

            const buyPrice = fromItem.sellPriceMin;
            const sellPrice = toItem.sellPriceMin;
            const profit = sellPrice - buyPrice;
            const profitPercent = buyPrice > 0 ? (profit / buyPrice) * 100 : 0;
            const soldPerDay = toItem.averageItems || 0;

            return {
                itemId: fromItem.itemId,
                itemName: this.getItemName(fromItem.itemId),
                quality: fromItem.quality,
                buyPrice: buyPrice,
                sellPrice: sellPrice,
                buyDate: this.formatDate(fromItem.sellPriceMinDate),
                sellDate: this.formatDate(toItem.sellPriceMinDate),
                fromLocation: fromItem.location,
                toLocation: toItem.location,
                profit: profit,
                profitPercent: profitPercent,
                soldPerDay: soldPerDay,
                rawFromItem: fromItem,
                rawToItem: toItem
            };
        });
    }

    applyFilters(minProfit, minProfitPercent, minSoldPerDay) {
        this.filteredData = [...this.data];

        this.filteredData = this.filteredData.filter(item => {
            return item.profit >= minProfit &&
                item.profitPercent >= minProfitPercent &&
                item.soldPerDay >= minSoldPerDay;
        });

        return this.filteredData;
    }

    resetFilters() {
        this.filteredData = [...this.data];
        return this.filteredData;
    }

    sortData(field, sortAscending) {
        this.filteredData.sort((a, b) => {
            const valueA = a[field];
            const valueB = b[field];

            if (typeof valueA === 'string' && typeof valueB === 'string') {
                return sortAscending ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
            }

            return sortAscending ? valueA - valueB : valueB - valueA;
        });

        return this.filteredData;
    }

    formatDate(dateString) {
        const date = new Date(dateString);

        if (date.getFullYear() <= 1970) {
            return 'Нет данных';
        }

        const now = new Date();
        const diff = now - date;

        if (diff < 86400000) { // 24 часа
            const hours = Math.floor(diff / 3600000);
            if (hours < 1) {
                const minutes = Math.floor(diff / 60000);
                return `${minutes} мин. назад`;
            }
            return `${hours} ч. назад`;
        }

        if (diff < 604800000) { // 7 дней
            const days = Math.floor(diff / 86400000);
            return `${days} дн. назад`;
        }

        return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
    }

    getQualityName(quality) {
        const qualityNames = {
            1: 'Обычное',
            2: 'Хорошее',
            3: 'Превосходное',
            4: 'Мастерское',
            5: 'Безупречное'
        };

        return qualityNames[quality] || 'Неизвестно';
    }

    calculateItemRating() {
        if (this.filteredData.length === 0) {
            return [];
        }

        const dataPoints = this.filteredData.map((item, index) => ({
            x: item.profitPercent,
            y: item.soldPerDay,
            profit: item.profit,
            itemName: item.itemName,
            buyPrice: item.buyPrice,
            sellPrice: item.sellPrice,
            quality: item.quality,
            fromLocation: item.fromLocation,
            toLocation: item.toLocation,
            dataIndex: index
        }));

        const avgProfit = this.filteredData.reduce((sum, item) => sum + item.profitPercent, 0) / this.filteredData.length;
        const avgSold = this.filteredData.reduce((sum, item) => sum + item.soldPerDay, 0) / this.filteredData.length;

        const itemsWithScore = dataPoints.map(item => {
            const profitScore = item.x / avgProfit;
            const soldScore = item.y / avgSold;

            return {
                ...item,
                score: profitScore * soldScore
            };
        });

        return [...itemsWithScore].sort((a, b) => b.score - a.score);
    }
}

// Модуль для работы с UI
class UIService {
    constructor(iconService, dataService) {
        this.iconService = iconService;
        this.dataService = dataService;

        // Основные элементы UI
        this.fromLocationSelect = document.getElementById('from-location');
        this.toLocationSelect = document.getElementById('to-location');
        this.itemsCountInput = document.getElementById('items-count');
        this.sortTypeSelect = document.getElementById('sort-type');
        this.minProfitInput = document.getElementById('min-profit');
        this.minProfitPercentInput = document.getElementById('min-profit-percent');
        this.minSoldPerDayInput = document.getElementById('min-sold-per-day');
        this.table = document.getElementById('analyzer-table');
        this.loadingElement = document.getElementById('loading');
        this.tableHeaders = this.table.querySelectorAll('th');
        this.itemsRatingModal = document.getElementById('items-rating-modal');

        // Состояние сортировки
        this.currentSortField = 'profit';
        this.sortAscending = false;
    }

    initEventListeners() {
        // Кнопки для работы с данными
        const buttons = document.querySelectorAll('.analyzer-button');
        
        buttons.forEach(button => {
            // Изначально устанавливаем transform-origin в центр
            gsap.set(button, { transformOrigin: "center center", willChange: "transform" });
            
            button.addEventListener('mouseenter', () => {
                gsap.to(button, { 
                    scale: 1.05, 
                    duration: 0.1,
                    ease: "power1.out",
                    transformPerspective: 1000,
                    backfaceVisibility: "hidden"
                });
            });
            
            button.addEventListener('mouseleave', () => {
                gsap.to(button, { 
                    scale: 1, 
                    duration: 0.1,
                    ease: "power1.out"
                });
            });
            
            button.addEventListener('mousedown', () => {
                gsap.to(button, { 
                    scale: 0.95, 
                    duration: 0.08,
                    ease: "power1.in"
                });
            });
            
            button.addEventListener('mouseup', () => {
                gsap.to(button, { 
                    scale: 1.05, 
                    duration: 0.08,
                    ease: "power1.out"
                });
            });
        });

        document.getElementById('fetch-data').addEventListener('click', () => this.fetchData());
        document.getElementById('apply-filters').addEventListener('click', () => this.applyFilters());
        document.getElementById('reset-filters').addEventListener('click', () => this.resetFilters());
        document.getElementById('show-items-rating').addEventListener('click', () => this.showItemsRating());

        // Сортировка таблицы
        this.tableHeaders.forEach(header => {
            header.addEventListener('click', () => this.sortTable(header.dataset.field));
        });

        // Модальное окно рейтинга товаров
        document.querySelector('.close-modal').addEventListener('click', () => this.closeItemsRatingModal());

        window.addEventListener('click', (e) => {
            if (e.target === this.itemsRatingModal) {
                this.closeItemsRatingModal();
            }
        });

        // Поиск по рейтингу товаров
        document.getElementById('items-search').addEventListener('input', (e) => {
            this.filterItemRating(e.target.value);
        });
    }

    async fetchData() {
        const fromLocation = this.fromLocationSelect.value;
        const toLocation = this.toLocationSelect.value;
        const itemsCount = parseInt(this.itemsCountInput.value) || 100;
        const sortType = this.sortTypeSelect.value;

        this.showLoading(true);

        try {
            await this.dataService.fetchMarketData(fromLocation, toLocation, itemsCount, sortType);
            this.sortTable(this.currentSortField, true);
        } catch (error) {
            alert(`Ошибка при загрузке данных: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    applyFilters() {
        const minProfit = parseFloat(this.minProfitInput.value) || 0;
        const minProfitPercent = parseFloat(this.minProfitPercentInput.value) || 0;
        const minSoldPerDay = parseFloat(this.minSoldPerDayInput.value) || 0;

        this.dataService.applyFilters(minProfit, minProfitPercent, minSoldPerDay);
        this.sortTable(this.currentSortField, true);
    }

    resetFilters() {
        this.minProfitInput.value = '';
        this.minProfitPercentInput.value = '';
        this.minSoldPerDayInput.value = '';

        this.dataService.resetFilters();
        this.sortTable(this.currentSortField, true);
    }

    sortTable(field, skipToggle = false) {
        if (field === this.currentSortField && !skipToggle) {
            this.sortAscending = !this.sortAscending;
        } else {
            this.currentSortField = field;
            if (!skipToggle) {
                this.sortAscending = true;
            }
        }

        this.dataService.sortData(field, this.sortAscending);
        this.updateTable();
        this.updateSortIndicators();
    }

    updateTable() {
        const tbody = this.table.querySelector('tbody');
        tbody.innerHTML = '';

        const filteredData = this.dataService.filteredData;

        if (filteredData.length === 0) {
            this.renderEmptyTableMessage(tbody);
            return;
        }

        gsap.set(tbody, { opacity: 0 });

        filteredData.forEach((item, index) => {
            const row = this.createTableRow(item);
            tbody.appendChild(row);
            gsap.set(row, { opacity: 0, y: 10 });
            
            gsap.to(row, {
                opacity: 1,
                y: 0,
                duration: 0.2,
                delay: index * 0.03,
                ease: "power1.out"
            });
        });
        
        gsap.to(tbody, { opacity: 1, duration: 0.3 });
    }

    renderEmptyTableMessage(tbody) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 11;
        cell.textContent = 'Нет данных для отображения. Загрузите данные или измените фильтры.';
        cell.style.textAlign = 'center';
        cell.style.padding = '20px';
        row.appendChild(cell);
        tbody.appendChild(row);
    }

    createTableRow(item) {
        const row = document.createElement('tr');

        // Ячейка с иконкой и названием предмета
        row.appendChild(this.createItemCell(item));

        // Качество
        const qualityCell = document.createElement('td');
        qualityCell.textContent = this.dataService.getQualityName(item.quality);
        row.appendChild(qualityCell);

        // Цены и даты
        row.appendChild(this.createTextCell(item.buyPrice.toLocaleString()));
        row.appendChild(this.createTextCell(item.sellPrice.toLocaleString()));
        row.appendChild(this.createTextCell(item.buyDate));
        row.appendChild(this.createTextCell(item.sellDate));

        // Локации
        row.appendChild(this.createTextCell(item.fromLocation));
        row.appendChild(this.createTextCell(item.toLocation));

        // Профит
        const profitCell = document.createElement('td');
        profitCell.textContent = item.profit.toLocaleString();
        profitCell.className = item.profit > 0 ? 'profit-positive' : 'profit-negative';
        row.appendChild(profitCell);

        // Процент профита
        const profitPercentCell = document.createElement('td');
        profitPercentCell.textContent = item.profitPercent.toFixed(2) + '%';
        profitPercentCell.className = item.profitPercent > 0 ? 'profit-positive' : 'profit-negative';
        row.appendChild(profitPercentCell);

        // Продаж в день
        row.appendChild(this.createTextCell(item.soldPerDay.toFixed(2)));

        return row;
    }

    createTextCell(text) {
        const cell = document.createElement('td');
        cell.textContent = text;
        return cell;
    }

    createItemCell(item) {
        const cell = document.createElement('td');

        const itemContainer = document.createElement('div');
        itemContainer.style.display = 'flex';
        itemContainer.style.alignItems = 'center';

        const itemIcon = document.createElement('img');
        itemIcon.style.width = '64px';
        itemIcon.style.height = '64px';
        itemIcon.style.marginRight = '8px';
        itemIcon.style.flexShrink = '0';
        itemIcon.style.cursor = 'pointer';
        itemIcon.alt = item.itemName;
        
        // Устанавливаем начальные свойства для анимации
        gsap.set(itemIcon, { 
            transformOrigin: "center center", 
            willChange: "transform",
            transformPerspective: 1000,
            backfaceVisibility: "hidden" 
        });
        
        // Анимация при наведении
        itemIcon.addEventListener('mouseenter', () => {
            gsap.to(itemIcon, { 
                scale: 1.1, 
                duration: 0.2, 
                ease: "power1.out" 
            });
        });
        
        // Возврат к исходному размеру
        itemIcon.addEventListener('mouseleave', () => {
            gsap.to(itemIcon, { 
                scale: 1, 
                duration: 0.2, 
                ease: "power1.out" 
            });
        });

        itemIcon.addEventListener('click', () => {
            navigator.clipboard.writeText(item.itemName)
                .then(() => {
                    this.iconService.showCopyTooltip(itemIcon, "Скопировано!");
                    
                    gsap.to(itemIcon, {
                        scale: 1.1,
                        duration: 0.2,
                        ease: "power1.out",
                        onComplete: () => {
                            gsap.to(itemIcon, {
                                scale: 1,
                                duration: 0.2,
                                ease: "power1.in"
                            });
                        }
                    });
                })
                .catch(err => { });
        });

        const iconUrl = this.iconService.getItemIconUrl(item.itemId);
        this.iconService.loadItemIcon(iconUrl, itemIcon);

        const itemNameSpan = document.createElement('span');
        itemNameSpan.textContent = item.itemName;
        itemNameSpan.style.whiteSpace = 'nowrap';
        itemNameSpan.style.overflow = 'hidden';
        itemNameSpan.style.textOverflow = 'ellipsis';

        itemContainer.appendChild(itemIcon);
        itemContainer.appendChild(itemNameSpan);
        cell.appendChild(itemContainer);
        cell.style.minWidth = '250px';

        return cell;
    }

    updateSortIndicators() {
        this.tableHeaders.forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc', 'sort-indicator');

            if (header.dataset.field === this.currentSortField) {
                header.classList.add('sort-indicator');
                header.classList.add(this.sortAscending ? 'sort-asc' : 'sort-desc');
            }
        });
    }

    showLoading(show) {
        if (show) {
            gsap.to(this.loadingElement, { display: 'block', opacity: 1, duration: 0.3 });
            gsap.to(document.getElementById('analyzer-table-container'), { display: 'none', opacity: 0, duration: 0.3 });
        } else {
            gsap.to(this.loadingElement, { opacity: 0, duration: 0.3, onComplete: () => {
                this.loadingElement.style.display = 'none';
            }});
            gsap.to(document.getElementById('analyzer-table-container'), { display: 'block', opacity: 1, duration: 0.3 });
        }
    }

    showItemsRating() {
        if (this.dataService.filteredData.length === 0) {
            alert('Сначала загрузите данные для отображения рейтинга товаров');
            return;
        }

        this.openItemsRatingModal();
        this.renderItemsRating();

        document.getElementById('items-search').value = '';
    }

    openItemsRatingModal() {
        this.itemsRatingModal.style.display = 'block';
        
        const modalContent = this.itemsRatingModal.querySelector('.modal-content');
        gsap.fromTo(modalContent, 
            { opacity: 0, y: -20 }, 
            { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
        );
    }

    closeItemsRatingModal() {
        const modalContent = this.itemsRatingModal.querySelector('.modal-content');
        
        gsap.to(modalContent, { 
            opacity: 0, 
            y: 20, 
            duration: 0.3, 
            ease: "power2.in",
            onComplete: () => {
                this.itemsRatingModal.style.display = 'none';
                const highlightedRows = document.querySelectorAll('tr.highlighted-item');
                highlightedRows.forEach(row => row.classList.remove('highlighted-item'));
            }
        });
    }

    renderItemsRating() {
        const sortedItems = this.dataService.calculateItemRating();
        const bestItemsList = document.getElementById('best-items-list');
        bestItemsList.innerHTML = '';

        // Вычисляем квартили для более корректного распределения цветов
        const scores = sortedItems.map(item => item.score);
        scores.sort((a, b) => a - b);
        
        const quartiles = {
            q3: scores[Math.floor(scores.length * 0.75)],
            q2: scores[Math.floor(scores.length * 0.5)], // медиана
            q1: scores[Math.floor(scores.length * 0.25)]
        };

        sortedItems.forEach((item, index) => {
            const listItem = this.createRatingListItem(item, index, quartiles);
            bestItemsList.appendChild(listItem);
            
            gsap.fromTo(listItem, 
                { opacity: 0, x: -10 }, 
                { opacity: 1, x: 0, duration: 0.3, delay: index * 0.02 }
            );
        });
    }

    createRatingListItem(item, index, quartiles) {
        const listItem = document.createElement('li');
        listItem.dataset.index = item.dataIndex;

        const rankSpan = document.createElement('span');
        rankSpan.className = 'item-rank';
        rankSpan.textContent = `${index + 1}.`;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'item-name';
        nameSpan.textContent = `${item.itemName} (${this.dataService.getQualityName(item.quality)})`;

        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'item-score';
        scoreSpan.textContent = `${item.x.toFixed(1)}% / ${item.y.toFixed(1)} в день`;

        listItem.appendChild(rankSpan);
        listItem.appendChild(nameSpan);
        listItem.appendChild(scoreSpan);

        this.styleRatingItem(listItem, item.score, quartiles);
        this.addRatingItemClickHandler(listItem);

        return listItem;
    }

    styleRatingItem(listItem, score, quartiles) {
        // Получаем значение продаж в день из текста элемента
        const scoreText = listItem.querySelector('.item-score').textContent;
        const soldPerDayText = scoreText.split('/')[1].trim();
        const soldPerDay = parseFloat(soldPerDayText);
        
        // Раскраска элементов по количеству продаж в день
        if (soldPerDay === 0) {
            // Товары без продаж - красный
            listItem.style.borderLeft = '4px solid #FF0000';
        } else if (soldPerDay >= 1000) {
            // Очень популярные товары - зеленый
            listItem.style.borderLeft = '4px solid #4CAF50';
        } else if (soldPerDay >= 100) {
            // Популярные товары - тёмно-зеленый
            listItem.style.borderLeft = '4px solid #006400';
        } else {
            // Малопопулярные товары - оранжевый
            listItem.style.borderLeft = '4px solid #FF9800';
        }
    }

    addRatingItemClickHandler(listItem) {
        listItem.addEventListener('click', () => {
            const dataIndex = parseInt(listItem.dataset.index);

            const highlightedRows = document.querySelectorAll('tr.highlighted-item');
            highlightedRows.forEach(row => row.classList.remove('highlighted-item'));

            const tbody = this.table.querySelector('tbody');
            const rows = tbody.querySelectorAll('tr');

            if (rows.length > dataIndex) {
                const targetRow = rows[dataIndex];
                targetRow.classList.add('highlighted-item');
                
                gsap.fromTo(targetRow, 
                    { backgroundColor: 'rgba(255, 255, 0, 0.8)' }, 
                    { backgroundColor: 'rgba(255, 240, 0, 0.3)', duration: 1, ease: "power2.out" }
                );

                // Закрываем модальное окно плавно
                this.closeItemsRatingModal();
                
                // Плавная прокрутка с задержкой для закрытия модального окна
                setTimeout(() => {
                    targetRow.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }, 300);
            }
        });
    }

    filterItemRating(searchText) {
        searchText = searchText.toLowerCase();
        const items = document.querySelectorAll('#best-items-list li');

        items.forEach(item => {
            const itemName = item.querySelector('.item-name').textContent.toLowerCase();
            const matches = itemName.includes(searchText);
            
            if (matches) {
                gsap.to(item, { display: 'flex', opacity: 1, height: 'auto', duration: 0.3 });
            } else {
                gsap.to(item, { opacity: 0, height: 0, duration: 0.3, onComplete: () => {
                    item.style.display = 'none';
                }});
            }
        });
    }
}

// Основной класс приложения
class App {
    constructor() {
        this.iconService = new IconService();
        this.dataService = new DataService();
        this.uiService = new UIService(this.iconService, this.dataService);
    }

    async init() {
        try {
            await this.dataService.loadItemsData();
            this.uiService.initEventListeners();
            this.uiService.updateTable();
            
            // Добавляю анимации при загрузке страницы
            this.initPageAnimations();
        } catch (error) {
            console.error('Ошибка инициализации приложения:', error);
            alert('Не удалось инициализировать приложение. Пожалуйста, перезагрузите страницу.');
        }
    }
    
    initPageAnimations() {
        // Анимация заголовка
        gsap.from('h1', { opacity: 0, y: -20, duration: 0.8, ease: "power2.out" });
        
        // Анимация панелей фильтров
        gsap.from('#locations-filter', { 
            opacity: 0, 
            y: -10, 
            duration: 0.5, 
            delay: 0.2, 
            ease: "power1.out" 
        });
        
        gsap.from('#analyzer-filters', { 
            opacity: 0, 
            y: -10, 
            duration: 0.5, 
            delay: 0.3, 
            ease: "power1.out" 
        });
        
        // Анимация контейнера таблицы
        gsap.from('#analyzer-table-container', { 
            opacity: 0, 
            scale: 0.95, 
            duration: 0.6, 
            delay: 0.4, 
            ease: "power2.out" 
        });
        
        // Добавляем класс для плавных переходов всем важным элементам
        document.querySelectorAll('button, select, input').forEach(element => {
            element.classList.add('animated-transition');
        });
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
}); 