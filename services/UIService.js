import { UI_CONFIG, STORAGE_KEYS } from '../constants.js';

export class UIService {
    constructor(iconService, dataService) {
        this.iconService = iconService;
        this.dataService = dataService;

        this.fromLocationSelect = document.getElementById('from-location');
        this.toLocationSelect = document.getElementById('to-location');
        this.itemsCountInput = document.getElementById('items-count');
        this.sortTypeSelect = document.getElementById('sort-type');
        this.minProfitInput = document.getElementById('min-profit');
        this.minProfitPercentInput = document.getElementById('min-profit-percent');
        this.minSoldPerDayInput = document.getElementById('min-sold-per-day');
        this.premiumTaxCheckbox = document.getElementById('premium-tax');
        this.showFavoritesCheckbox = document.getElementById('show-favorites');
        this.table = document.getElementById('analyzer-table');
        this.loadingElement = document.getElementById('loading');
        this.tableHeaders = this.table.querySelectorAll('th');
        this.itemsRatingModal = document.getElementById('items-rating-modal');
        this.priceHistoryModal = document.getElementById('price-history-modal');
        this.priceHistoryChart = null;
        this.showLastDayOnlyCheckbox = document.getElementById('show-last-day-only');
        this.currentHistoryItem = null;

        this.currentSortField = 'soldPerDay';
        this.sortAscending = false;
        this.showFavoritesOnly = false;
        this.favoriteItems = new Map();

        this.selectedItemIds = [];

        this.loadFiltersFromStorage();
        this.loadShowLastDayOnlyFromStorage();
        this.loadFavoriteItemsFromStorage();
        this.loadFavoritesCheckboxState();
    }

    initEventListeners() {
        const buttons = document.querySelectorAll('.analyzer-button');

        buttons.forEach(button => {
            gsap.set(button, { transformOrigin: "center center", willChange: "transform" });

            button.addEventListener('mouseenter', () => {
                gsap.to(button, {
                    scale: UI_CONFIG.BUTTON_HOVER_SCALE,
                    duration: UI_CONFIG.ANIMATION.BUTTON_HOVER_DURATION,
                    ease: "power1.out",
                    transformPerspective: 1000,
                    backfaceVisibility: "hidden"
                });
            });

            button.addEventListener('mouseleave', () => {
                gsap.to(button, {
                    scale: 1,
                    duration: UI_CONFIG.ANIMATION.BUTTON_HOVER_DURATION,
                    ease: "power1.out"
                });
            });

            button.addEventListener('mousedown', () => {
                gsap.to(button, {
                    scale: UI_CONFIG.BUTTON_PRESSED_SCALE,
                    duration: UI_CONFIG.ANIMATION.BUTTON_PRESS_DURATION,
                    ease: "power1.in"
                });
            });

            button.addEventListener('mouseup', () => {
                gsap.to(button, {
                    scale: UI_CONFIG.BUTTON_HOVER_SCALE,
                    duration: UI_CONFIG.ANIMATION.BUTTON_PRESS_DURATION,
                    ease: "power1.out"
                });
            });
        });

        document.getElementById('fetch-data').addEventListener('click', () => this.fetchData());
        document.getElementById('show-items-rating').addEventListener('click', () => this.showItemsRating());

        this.minProfitInput.addEventListener('input', () => this.applyFilters());
        this.minProfitPercentInput.addEventListener('input', () => this.applyFilters());
        this.minSoldPerDayInput.addEventListener('input', () => this.applyFilters());
        this.premiumTaxCheckbox.addEventListener('change', () => {
            this.dataService.isPremiumTaxEnabled = this.premiumTaxCheckbox.checked;
            this.fetchData();
            this.saveFiltersToStorage();
        });

        this.fromLocationSelect.addEventListener('change', () => this.saveFiltersToStorage());
        this.toLocationSelect.addEventListener('change', () => this.saveFiltersToStorage());
        this.itemsCountInput.addEventListener('input', () => this.saveFiltersToStorage());
        this.sortTypeSelect.addEventListener('change', () => this.saveFiltersToStorage());

        this.tableHeaders.forEach(header => {
            header.addEventListener('click', () => this.sortTable(header.dataset.field));
        });

        document.querySelector('.close-modal').addEventListener('click', () => this.closeItemsRatingModal());
        document.querySelector('.close-price-history-modal').addEventListener('click', () => this.closePriceHistoryModal());

        window.addEventListener('click', (e) => {
            if (e.target === this.itemsRatingModal) {
                this.closeItemsRatingModal();
            }
            if (e.target === this.priceHistoryModal) {
                this.closePriceHistoryModal();
            }
        });

        document.getElementById('items-search').addEventListener('input', (e) => {
            this.filterItemRating(e.target.value);
        });
        
        this.showLastDayOnlyCheckbox.addEventListener('change', () => {
            this.saveShowLastDayOnlyToStorage();
            if (this.currentHistoryItem) {
                this.showPriceHistory(this.currentHistoryItem);
            }
        });

        this.showFavoritesCheckbox.addEventListener('change', () => {
            this.toggleFavoritesMode();
            this.saveFavoritesCheckboxState();
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

            const minProfit = parseFloat(this.minProfitInput.value) || 0;
            const minProfitPercent = parseFloat(this.minProfitPercentInput.value) || 0;
            const minSoldPerDay = parseFloat(this.minSoldPerDayInput.value) || 0;

            this.dataService.applyFilters(minProfit, minProfitPercent, minSoldPerDay);
            this.sortTable(this.currentSortField, true);

            this.saveFiltersToStorage();
        } catch (error) {
            this.showLoadingError(error.message);
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

        this.saveFiltersToStorage();
    }

    resetFilters() {
        this.minProfitInput.value = '';
        this.minProfitPercentInput.value = '';
        this.minSoldPerDayInput.value = '';

        this.dataService.resetFilters();
        this.sortTable(this.currentSortField, true);

        this.clearFiltersStorage();
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

        this.saveFiltersToStorage();
    }

    updateTable() {
        const tbody = this.table.querySelector('tbody');
        tbody.innerHTML = '';

        let dataToShow = [];

        if (this.showFavoritesOnly) {
            // Фильтруем только корректные записи избранного
            dataToShow = Array.from(this.favoriteItems.values()).filter(item => this.isValidFavoriteItem(item));
        } else {
            dataToShow = this.dataService.filteredData || [];
        }

        if (dataToShow.length === 0) {
            if (this.showFavoritesOnly) {
                const row = document.createElement('tr');
                const cell = document.createElement('td');
                cell.colSpan = 11;
                cell.textContent = 'Нет избранных товаров. Добавьте товары в избранное, нажав на звездочку рядом с названием товара.';
                cell.style.textAlign = 'center';
                cell.style.padding = '20px';
                row.appendChild(cell);
                tbody.appendChild(row);
            } else {
                this.renderEmptyTableMessage(tbody);
            }
            return;
        }

        // Сортируем данные (и обычные, и избранные) по текущему полю
        this.sortDataArray(dataToShow);

        gsap.set(tbody, { opacity: 0 });

        dataToShow.forEach((item, index) => {
            const row = this.createTableRow(item);
            tbody.appendChild(row);
            gsap.set(row, { opacity: 0, y: 10 });

            gsap.to(row, {
                opacity: 1,
                y: 0,
                duration: UI_CONFIG.ANIMATION.TABLE_ROW_DURATION,
                delay: index * UI_CONFIG.ANIMATION.TABLE_ROW_STAGGER,
                ease: "power1.out"
            });
        });

        gsap.to(tbody, { 
            opacity: 1, 
            duration: UI_CONFIG.ANIMATION.TABLE_DURATION 
        });
    }

    renderEmptyTableMessage(tbody) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 11;
        cell.textContent = 'Загрузка данных... Пожалуйста, подождите.';
        cell.style.textAlign = 'center';
        cell.style.padding = '20px';
        row.appendChild(cell);
        tbody.appendChild(row);
    }

    createTableRow(item) {
        const row = document.createElement('tr');
        row.dataset.itemId = item.itemId;

        if (this.selectedItemIds.includes(item.itemId)) {
            row.classList.add('copied-item');
        }

        row.appendChild(this.createItemCell(item));

        const qualityCell = document.createElement('td');
        qualityCell.textContent = this.dataService.getQualityName(item.quality || 0);
        row.appendChild(qualityCell);

        const buyPrice = item.buyPrice !== undefined ? item.buyPrice : 0;
        row.appendChild(this.createTextCell(buyPrice.toLocaleString()));
        
        const sellPrice = item.sellPrice !== undefined ? item.sellPrice : 0;
        row.appendChild(this.createTextCell(sellPrice.toLocaleString()));

        row.appendChild(this.createTextCell(item.buyDate || '-'));
        row.appendChild(this.createTextCell(item.sellDate || '-'));

        row.appendChild(this.createTextCell(item.fromLocation || '-'));
        row.appendChild(this.createTextCell(item.toLocation || '-'));

        const itemProfit = item.itemProfit !== undefined ? item.itemProfit : 0;
        const itemProfitCell = document.createElement('td');
        itemProfitCell.textContent = itemProfit.toLocaleString();
        itemProfitCell.className = itemProfit > 0 ? 'profit-positive' : 'profit-negative';
        row.appendChild(itemProfitCell);

        const itemProfitPercent = item.itemProfitPercent !== undefined ? item.itemProfitPercent : 0;
        const itemProfitPercentCell = document.createElement('td');
        itemProfitPercentCell.textContent = itemProfitPercent.toFixed(2) + '%';
        itemProfitPercentCell.className = itemProfitPercent > 0 ? 'profit-positive' : 'profit-negative';
        row.appendChild(itemProfitPercentCell);

        const soldPerDay = item.soldPerDay !== undefined ? item.soldPerDay : 0;
        row.appendChild(this.createTextCell(soldPerDay.toFixed(2)));

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

        // Создаем кнопку избранного
        const favoriteButton = document.createElement('span');
        const isFavorite = this.favoriteItems.has(item.itemId);
        favoriteButton.innerHTML = isFavorite ? '★' : '☆';
        favoriteButton.title = isFavorite ? 'Удалить из избранного' : 'Добавить в избранное';
        favoriteButton.style.cursor = 'pointer';
        favoriteButton.style.marginRight = '10px';
        favoriteButton.style.fontSize = '18px';
        favoriteButton.style.color = isFavorite ? '#FFD700' : '#808080';
        
        favoriteButton.addEventListener('mouseenter', () => {
            gsap.to(favoriteButton, {
                scale: UI_CONFIG.CHART_BUTTON_HOVER_SCALE,
                duration: UI_CONFIG.ANIMATION.CHART_BUTTON_DURATION,
                ease: "power1.out"
            });
        });

        favoriteButton.addEventListener('mouseleave', () => {
            gsap.to(favoriteButton, {
                scale: 1,
                duration: UI_CONFIG.ANIMATION.CHART_BUTTON_DURATION,
                ease: "power1.out"
            });
        });
        
        favoriteButton.addEventListener('click', () => {
            this.toggleFavorite(item);
            const isNowFavorite = this.favoriteItems.has(item.itemId);
            favoriteButton.innerHTML = isNowFavorite ? '★' : '☆';
            favoriteButton.style.color = isNowFavorite ? '#FFD700' : '#808080';
            favoriteButton.title = isNowFavorite ? 'Удалить из избранного' : 'Добавить в избранное';
            
            if (this.showFavoritesOnly) {
                this.updateTable();
            }
        });

        // Создаем кнопку графика
        const chartButton = document.createElement('span');
        chartButton.innerHTML = '📊';
        chartButton.title = 'Показать статистику цен';
        chartButton.style.cursor = 'pointer';
        chartButton.style.marginRight = '10px';
        chartButton.style.fontSize = '18px';
        
        chartButton.addEventListener('mouseenter', () => {
            gsap.to(chartButton, {
                scale: UI_CONFIG.CHART_BUTTON_HOVER_SCALE,
                duration: UI_CONFIG.ANIMATION.CHART_BUTTON_DURATION,
                ease: "power1.out"
            });
        });

        chartButton.addEventListener('mouseleave', () => {
            gsap.to(chartButton, {
                scale: 1,
                duration: UI_CONFIG.ANIMATION.CHART_BUTTON_DURATION,
                ease: "power1.out"
            });
        });
        
        chartButton.addEventListener('click', () => {
            this.showPriceHistory(item);
        });

        const itemIcon = document.createElement('img');
        itemIcon.style.width = '64px';
        itemIcon.style.height = '64px';
        itemIcon.style.marginRight = '8px';
        itemIcon.style.flexShrink = '0';
        itemIcon.style.cursor = 'pointer';
        itemIcon.alt = item.itemName;

        gsap.set(itemIcon, {
            transformOrigin: "center center",
            willChange: "transform",
            transformPerspective: 1000,
            backfaceVisibility: "hidden"
        });

        itemIcon.addEventListener('mouseenter', () => {
            gsap.to(itemIcon, {
                scale: UI_CONFIG.ITEM_ICON_HOVER_SCALE,
                duration: UI_CONFIG.ANIMATION.ITEM_ICON_DURATION,
                ease: "power1.out"
            });
        });

        itemIcon.addEventListener('mouseleave', () => {
            gsap.to(itemIcon, {
                scale: 1,
                duration: UI_CONFIG.ANIMATION.ITEM_ICON_DURATION,
                ease: "power1.out"
            });
        });

        itemIcon.addEventListener('click', () => {
            const row = cell.closest('tr');

            const itemIndex = this.selectedItemIds.indexOf(item.itemId);
            if (itemIndex === -1) {
                this.selectedItemIds.push(item.itemId);
                row.classList.add('copied-item');
            } else {
                this.selectedItemIds.splice(itemIndex, 1);
                row.classList.remove('copied-item');
            }

            const formattedItemName = this.formatItemName(item.itemId, item.itemName);
            navigator.clipboard.writeText(formattedItemName)
                .then(() => {
                    this.iconService.showCopyTooltip(itemIcon, "Скопировано!");

                    gsap.to(itemIcon, {
                        scale: UI_CONFIG.ITEM_ICON_HOVER_SCALE,
                        duration: UI_CONFIG.ANIMATION.ITEM_ICON_DURATION,
                        ease: "power1.out",
                        onComplete: () => {
                            gsap.to(itemIcon, {
                                scale: 1,
                                duration: UI_CONFIG.ANIMATION.ITEM_ICON_DURATION,
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
        const formattedItemName = this.formatItemName(item.itemId, item.itemName);
        itemNameSpan.textContent = formattedItemName;
        itemNameSpan.style.whiteSpace = 'nowrap';
        itemNameSpan.style.overflow = 'hidden';
        itemNameSpan.style.textOverflow = 'ellipsis';

        itemContainer.appendChild(favoriteButton);
        itemContainer.appendChild(chartButton);
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
            gsap.to(this.loadingElement, { 
                display: 'block', 
                opacity: 1, 
                duration: UI_CONFIG.ANIMATION.LOADING_DURATION 
            });
            gsap.to(document.getElementById('analyzer-table-container'), { 
                display: 'none', 
                opacity: 0, 
                duration: UI_CONFIG.ANIMATION.LOADING_DURATION 
            });
        } else {
            gsap.to(this.loadingElement, {
                opacity: 0, 
                duration: UI_CONFIG.ANIMATION.LOADING_DURATION, 
                onComplete: () => {
                    this.loadingElement.style.display = 'none';
                }
            });
            gsap.to(document.getElementById('analyzer-table-container'), { 
                display: 'block', 
                opacity: 1, 
                duration: UI_CONFIG.ANIMATION.LOADING_DURATION 
            });
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
            { 
                opacity: 1, 
                y: 0, 
                duration: UI_CONFIG.ANIMATION.MODAL_DURATION, 
                ease: "power2.out" 
            }
        );
    }

    closeItemsRatingModal() {
        const modalContent = this.itemsRatingModal.querySelector('.modal-content');

        gsap.to(modalContent, {
            opacity: 0,
            y: 20,
            duration: UI_CONFIG.ANIMATION.MODAL_DURATION,
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

        const scores = sortedItems.map(item => item.score);
        scores.sort((a, b) => a - b);

        const quartiles = {
            q3: scores[Math.floor(scores.length * 0.75)],
            q2: scores[Math.floor(scores.length * 0.5)],
            q1: scores[Math.floor(scores.length * 0.25)]
        };

        sortedItems.forEach((item, index) => {
            const listItem = this.createRatingListItem(item, index, quartiles);
            bestItemsList.appendChild(listItem);

            gsap.fromTo(listItem,
                { opacity: 0, x: -10 },
                { 
                    opacity: 1, 
                    x: 0, 
                    duration: UI_CONFIG.ANIMATION.RATING_ITEM_DURATION, 
                    delay: index * UI_CONFIG.ANIMATION.RATING_ITEM_STAGGER 
                }
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
        const formattedItemName = this.formatItemName(item.itemId, item.itemName);
        nameSpan.textContent = `${formattedItemName} (${this.dataService.getQualityName(item.quality)})`;

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
        const scoreText = listItem.querySelector('.item-score').textContent;
        const soldPerDayText = scoreText.split('/')[1].trim();
        const soldPerDay = parseFloat(soldPerDayText);

        if (soldPerDay === 0) {
            listItem.style.borderLeft = '4px solid #FF0000';
        } else if (soldPerDay >= 1000) {
            listItem.style.borderLeft = '4px solid #4CAF50';
        } else if (soldPerDay >= 100) {
            listItem.style.borderLeft = '4px solid #006400';
        } else {
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

                gsap.fromTo(targetRow,
                    { backgroundColor: 'rgba(255, 200, 0, 0.9)' },
                    {
                        backgroundColor: 'rgba(255, 200, 0, 0)',
                        duration: UI_CONFIG.ANIMATION.ROW_HIGHLIGHT_DURATION,
                        ease: "power1.out"
                    }
                );

                this.closeItemsRatingModal();

                setTimeout(() => {
                    targetRow.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }, UI_CONFIG.ANIMATION.SCROLL_DELAY);
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
                gsap.to(item, { 
                    display: 'flex', 
                    opacity: 1, 
                    height: 'auto', 
                    duration: UI_CONFIG.ANIMATION.FILTER_DURATION 
                });
            } else {
                gsap.to(item, {
                    opacity: 0, 
                    height: 0, 
                    duration: UI_CONFIG.ANIMATION.FILTER_DURATION, 
                    onComplete: () => {
                        item.style.display = 'none';
                    }
                });
            }
        });
    }

    saveFiltersToStorage() {
        const filters = {
            fromLocation: this.fromLocationSelect.value,
            toLocation: this.toLocationSelect.value,
            itemsCount: this.itemsCountInput.value,
            sortType: this.sortTypeSelect.value,
            minProfit: this.minProfitInput.value,
            minProfitPercent: this.minProfitPercentInput.value,
            minSoldPerDay: this.minSoldPerDayInput.value,
            premiumTaxEnabled: this.premiumTaxCheckbox.checked,
            currentSortField: this.currentSortField,
            sortAscending: this.sortAscending
        };

        localStorage.setItem(STORAGE_KEYS.FILTERS, JSON.stringify(filters));
    }

    loadFiltersFromStorage() {
        const savedFilters = localStorage.getItem(STORAGE_KEYS.FILTERS);

        if (savedFilters) {
            try {
                const filters = JSON.parse(savedFilters);

                if (filters.fromLocation) this.fromLocationSelect.value = filters.fromLocation;
                if (filters.toLocation) this.toLocationSelect.value = filters.toLocation;
                if (filters.itemsCount) this.itemsCountInput.value = filters.itemsCount;
                if (filters.sortType) this.sortTypeSelect.value = filters.sortType;
                if (filters.minProfit) this.minProfitInput.value = filters.minProfit;
                if (filters.minProfitPercent) this.minProfitPercentInput.value = filters.minProfitPercent;
                if (filters.minSoldPerDay) this.minSoldPerDayInput.value = filters.minSoldPerDay;
                
                if (filters.premiumTaxEnabled !== undefined) {
                    this.premiumTaxCheckbox.checked = filters.premiumTaxEnabled;
                    this.dataService.isPremiumTaxEnabled = filters.premiumTaxEnabled;
                }
                
                if (filters.currentSortField) this.currentSortField = filters.currentSortField;
                if (filters.sortAscending !== undefined) this.sortAscending = filters.sortAscending;
            } catch (error) {
                console.error('Ошибка при загрузке сохраненных фильтров:', error);
            }
        }
    }
    
    saveShowLastDayOnlyToStorage() {
        localStorage.setItem(STORAGE_KEYS.SHOW_LAST_DAY_ONLY, this.showLastDayOnlyCheckbox.checked);
    }
    
    loadShowLastDayOnlyFromStorage() {
        const savedValue = localStorage.getItem(STORAGE_KEYS.SHOW_LAST_DAY_ONLY);
        if (savedValue !== null) {
            this.showLastDayOnlyCheckbox.checked = savedValue === 'true';
        }
    }

    clearFiltersStorage() {
        localStorage.removeItem(STORAGE_KEYS.FILTERS);
    }

    showLoadingError(message) {
        this.showLoading(false);
        const tbody = this.table.querySelector('tbody');
        tbody.innerHTML = '';

        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 11;
        cell.textContent = `Ошибка загрузки данных: ${message}. Нажмите "Обновить данные", чтобы попробовать снова.`;
        cell.style.textAlign = 'center';
        cell.style.padding = '20px';
        cell.style.color = 'red';
        row.appendChild(cell);
        tbody.appendChild(row);
    }

    async showPriceHistory(item) {
        document.getElementById('price-history-item-name').textContent = `${this.formatItemName(item.itemId, item.itemName)}`;
        
        const itemIconElement = document.getElementById('price-history-item-icon');
        const iconUrl = this.iconService.getItemIconUrl(item.itemId);
        this.iconService.loadItemIcon(iconUrl, itemIconElement);
        
        this.currentHistoryItem = item;
        
        this.openPriceHistoryModal();
        
        try {
            const fromLocationTable = document.getElementById('from-location-prices-table');
            const toLocationTable = document.getElementById('to-location-prices-table');

            // Устанавливаем названия локаций
            document.getElementById('from-location-name').textContent = this.fromLocationSelect.value;
            document.getElementById('to-location-name').textContent = this.toLocationSelect.value;
            
            // Инициализация таблиц
            const fromTableBody = fromLocationTable.querySelector('tbody');
            fromTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Загрузка данных...</td></tr>';
            
            const toTableBody = toLocationTable.querySelector('tbody');
            toTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Загрузка данных...</td></tr>';
            
            // Получаем данные для двух локаций
            const fromLocation = this.fromLocationSelect.value;
            const toLocation = this.toLocationSelect.value;
            
            // Загрузка данных для первой локации (откуда)
            const fromHistoryData = await this.dataService.getPriceHistory(item.itemId, fromLocation);
            const fromCurrentPrices = await this.dataService.getCurrentPrices(item.itemId, fromLocation);
            
            // Загрузка данных для второй локации (куда)
            const toHistoryData = await this.dataService.getPriceHistory(item.itemId, toLocation);
            const toCurrentPrices = await this.dataService.getCurrentPrices(item.itemId, toLocation);
            
            // Сохраняем данные
            this.historyFromData = fromHistoryData;
            this.historyToData = toHistoryData;
            
            // Отображаем таблицы
            this.renderOptimizedPriceTable(fromHistoryData, fromCurrentPrices, this.showLastDayOnlyCheckbox.checked, fromLocationTable, true);
            this.renderOptimizedPriceTable(toHistoryData, toCurrentPrices, this.showLastDayOnlyCheckbox.checked, toLocationTable, false);
            
        } catch (error) {
            console.error('Ошибка при загрузке данных:', error);
            
            const fromTableBody = document.getElementById('from-location-prices-table').querySelector('tbody');
            fromTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Ошибка при загрузке данных</td></tr>';
            
            const toTableBody = document.getElementById('to-location-prices-table').querySelector('tbody');
            toTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Ошибка при загрузке данных</td></tr>';
            
            this.historyFromData = null;
            this.historyToData = null;
        }
    }

    renderOptimizedPriceTable(historyData, currentPrices, showLastDayOnly, table, isFromLocation) {
        const tbody = table.querySelector('tbody');
        
        if (!historyData || historyData.length === 0 || !currentPrices || currentPrices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Нет данных о ценах</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - UI_CONFIG.TIME_CONSTANTS.DAY_MS);
        
        const qualityData = new Map();
        
        currentPrices.sort((a, b) => a.quality - b.quality);
        
        historyData.forEach(qualityHistoryData => {
            const quality = qualityHistoryData.quality;
            
            const filteredData = qualityHistoryData.data.filter(point => {
                const pointDate = new Date(point.timestamp);
                return !showLastDayOnly || pointDate >= oneDayAgo;
            });
            
            if (filteredData.length === 0) return;
            
            let totalPrice = 0;
            let totalCount = 0;
            let minPrice = Number.MAX_SAFE_INTEGER;
            let maxPrice = 0;
            let last24hCount = 0;
            
            filteredData.forEach(point => {
                if (point.avg_price > 0) {
                    totalPrice += point.avg_price * point.item_count;
                    totalCount += point.item_count;
                    
                    minPrice = Math.min(minPrice, point.avg_price);
                    maxPrice = Math.max(maxPrice, point.avg_price);
                    
                    const pointDate = new Date(point.timestamp);
                    if (pointDate >= oneDayAgo) {
                        last24hCount += point.item_count;
                    }
                }
            });
            
            const avgPrice = totalCount > 0 ? Math.round(totalPrice / totalCount) : 0;
            
            qualityData.set(quality, {
                avgPrice,
                minPrice: minPrice === Number.MAX_SAFE_INTEGER ? 0 : minPrice,
                maxPrice,
                totalSales: totalCount,
                last24hSales: last24hCount
            });
        });
        
        currentPrices.forEach(item => {
            const row = document.createElement('tr');
            
            const calculatedData = qualityData.get(item.quality) || {
                avgPrice: 0,
                minPrice: 0,
                maxPrice: 0,
                totalSales: 0,
                last24hSales: 0
            };
            
            const qualityCell = document.createElement('td');
            qualityCell.textContent = this.dataService.getQualityName(item.quality);
            row.appendChild(qualityCell);
            
            const avgPriceCell = document.createElement('td');
            avgPriceCell.textContent = calculatedData.avgPrice > 0 ? calculatedData.avgPrice.toLocaleString() : '—';
            row.appendChild(avgPriceCell);
            
            // Отображаем разные данные в зависимости от локации
            const priceMinCell = document.createElement('td');
            // Используем sell_price_min для обеих локаций, т.к. API не предоставляет данные о ценах покупки (buy_price_min всегда 0)
            priceMinCell.textContent = item.sell_price_min > 0 ? item.sell_price_min.toLocaleString() : '—';
            row.appendChild(priceMinCell);
            
            const priceMaxCell = document.createElement('td');
            // Используем sell_price_max для обеих локаций
            priceMaxCell.textContent = item.sell_price_max > 0 ? item.sell_price_max.toLocaleString() : '—';
            row.appendChild(priceMaxCell);
            
            const updateDateCell = document.createElement('td');
            // Используем sell_price_min_date для обеих локаций
            updateDateCell.textContent = this.formatPriceDate(item.sell_price_min_date);
            row.appendChild(updateDateCell);
            
            const totalSalesCell = document.createElement('td');
            totalSalesCell.textContent = calculatedData.totalSales.toLocaleString();
            row.appendChild(totalSalesCell);
            
            const recentSalesCell = document.createElement('td');
            recentSalesCell.textContent = calculatedData.last24hSales.toLocaleString();
            row.appendChild(recentSalesCell);
            
            tbody.appendChild(row);
        });
    }
    
    formatPriceDate(dateString) {
        const date = new Date(dateString);
        
        if (date.getFullYear() <= 1970) {
            return 'Нет данных';
        }
        
        return this.dataService.formatDate(dateString);
    }

    openPriceHistoryModal() {
        this.priceHistoryModal.style.display = 'block';

        const modalContent = this.priceHistoryModal.querySelector('.modal-content');
        gsap.fromTo(modalContent,
            { opacity: 0, y: -20 },
            { 
                opacity: 1, 
                y: 0, 
                duration: UI_CONFIG.ANIMATION.MODAL_DURATION, 
                ease: "power2.out" 
            }
        );
    }

    closePriceHistoryModal() {
        const modalContent = this.priceHistoryModal.querySelector('.modal-content');

        gsap.to(modalContent, {
            opacity: 0,
            y: 20,
            duration: UI_CONFIG.ANIMATION.MODAL_DURATION,
            ease: "power2.in",
            onComplete: () => {
                this.priceHistoryModal.style.display = 'none';
                this.currentHistoryItem = null;
            }
        });
    }

    toggleFavoritesMode() {
        this.showFavoritesOnly = this.showFavoritesCheckbox.checked;
        this.updateTable();
    }

    loadFavoriteItemsFromStorage() {
        const savedFavorites = localStorage.getItem(STORAGE_KEYS.FAVORITE_ITEMS);
        this.favoriteItems = new Map();
        
        if (savedFavorites) {
            try {
                const favorites = JSON.parse(savedFavorites);
                
                // Проверяем каждый элемент перед добавлением
                for (const [key, item] of Object.entries(favorites)) {
                    if (this.isValidFavoriteItem(item)) {
                        this.favoriteItems.set(key, item);
                    }
                }
            } catch (error) {
                console.error('Ошибка при загрузке избранных товаров:', error);
            }
        }
    }

    saveFavoriteItemsToStorage() {
        const favoritesObject = Object.fromEntries(this.favoriteItems);
        localStorage.setItem(STORAGE_KEYS.FAVORITE_ITEMS, JSON.stringify(favoritesObject));
    }

    toggleFavorite(item) {
        if (this.favoriteItems.has(item.itemId)) {
            this.favoriteItems.delete(item.itemId);
        } else {
            this.favoriteItems.set(item.itemId, {
                itemId: item.itemId,
                itemName: item.itemName,
                quality: item.quality || 0,
                buyPrice: item.buyPrice || 0,
                sellPrice: item.sellPrice || 0,
                itemProfit: item.itemProfit || 0,
                itemProfitPercent: item.itemProfitPercent || 0,
                buyDate: item.buyDate || '-',
                sellDate: item.sellDate || '-',
                fromLocation: item.fromLocation || '-',
                toLocation: item.toLocation || '-',
                soldPerDay: item.soldPerDay || 0
            });
        }
        this.saveFavoriteItemsToStorage();
    }

    saveFavoritesCheckboxState() {
        localStorage.setItem(STORAGE_KEYS.SHOW_FAVORITES, this.showFavoritesCheckbox.checked);
    }

    loadFavoritesCheckboxState() {
        const savedState = localStorage.getItem(STORAGE_KEYS.SHOW_FAVORITES);
        if (savedState !== null) {
            this.showFavoritesCheckbox.checked = savedState === 'true';
            this.showFavoritesOnly = this.showFavoritesCheckbox.checked;
        }
    }

    isValidFavoriteItem(item) {
        return item && item.itemId && item.itemName;
    }

    sortDataArray(dataArray) {
        dataArray.sort((a, b) => {
            const valueA = a[this.currentSortField];
            const valueB = b[this.currentSortField];
            
            if (typeof valueA === 'string' && typeof valueB === 'string') {
                return this.sortAscending ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
            }
            
            return this.sortAscending ? valueA - valueB : valueB - valueA;
        });
    }

    // Функция для форматирования имени предмета с учетом уровня и зачарования
    formatItemName(itemId, itemName) {
        // Парсим уровень (T число)
        const tierMatch = itemId.match(/T(\d+)_/);
        const tier = tierMatch ? tierMatch[1] : '?';
        
        // Парсим зачарование (@ число)
        const enchantMatch = itemId.match(/@(\d+)$/);
        const enchant = enchantMatch ? enchantMatch[1] : '0';
        
        // Возвращаем отформатированное имя
        return `${itemName} [${tier}.${enchant}]`;
    }
} 