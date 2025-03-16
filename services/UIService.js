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
        this.table = document.getElementById('analyzer-table');
        this.loadingElement = document.getElementById('loading');
        this.tableHeaders = this.table.querySelectorAll('th');
        this.itemsRatingModal = document.getElementById('items-rating-modal');
        this.priceHistoryModal = document.getElementById('price-history-modal');
        this.priceHistoryChart = null;
        this.historyLocationSelect = document.getElementById('price-history-location');
        this.showLastDayOnlyCheckbox = document.getElementById('show-last-day-only');
        this.currentHistoryItem = null;

        this.currentSortField = 'soldPerDay';
        this.sortAscending = false;

        this.selectedItemIds = [];

        this.loadFiltersFromStorage();
        this.loadHistoryLocationFromStorage();
        this.loadShowLastDayOnlyFromStorage();
    }

    initEventListeners() {
        const buttons = document.querySelectorAll('.analyzer-button');

        buttons.forEach(button => {
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
        
        // Добавляем обработчик для выбора локации в истории цен
        this.historyLocationSelect.addEventListener('change', () => {
            this.saveHistoryLocationToStorage();
            // Если есть текущий предмет, обновляем график
            if (this.currentHistoryItem) {
                this.showPriceHistory(this.currentHistoryItem);
            }
        });
        
        // Добавляем обработчик для переключателя "Только за последние 24 часа"
        this.showLastDayOnlyCheckbox.addEventListener('change', () => {
            this.saveShowLastDayOnlyToStorage();
            // Если есть текущий предмет, обновляем график
            if (this.currentHistoryItem) {
                this.showPriceHistory(this.currentHistoryItem);
            }
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
        qualityCell.textContent = this.dataService.getQualityName(item.quality);
        row.appendChild(qualityCell);

        row.appendChild(this.createTextCell(item.buyPrice.toLocaleString()));
        row.appendChild(this.createTextCell(item.sellPrice.toLocaleString()));

        row.appendChild(this.createTextCell(item.buyDate));
        row.appendChild(this.createTextCell(item.sellDate));

        row.appendChild(this.createTextCell(item.fromLocation));
        row.appendChild(this.createTextCell(item.toLocation));

        const itemProfitCell = document.createElement('td');
        itemProfitCell.textContent = item.itemProfit.toLocaleString();
        itemProfitCell.className = item.itemProfit > 0 ? 'profit-positive' : 'profit-negative';
        row.appendChild(itemProfitCell);

        const itemProfitPercentCell = document.createElement('td');
        itemProfitPercentCell.textContent = item.itemProfitPercent.toFixed(2) + '%';
        itemProfitPercentCell.className = item.itemProfitPercent > 0 ? 'profit-positive' : 'profit-negative';
        row.appendChild(itemProfitPercentCell);

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

        // Создаем кнопку графика
        const chartButton = document.createElement('span');
        chartButton.innerHTML = '📊';
        chartButton.title = 'Показать график';
        chartButton.style.cursor = 'pointer';
        chartButton.style.marginRight = '10px';
        chartButton.style.fontSize = '18px';
        
        chartButton.addEventListener('mouseenter', () => {
            gsap.to(chartButton, {
                scale: 1.2,
                duration: 0.2,
                ease: "power1.out"
            });
        });

        chartButton.addEventListener('mouseleave', () => {
            gsap.to(chartButton, {
                scale: 1,
                duration: 0.2,
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
                scale: 1.1,
                duration: 0.2,
                ease: "power1.out"
            });
        });

        itemIcon.addEventListener('mouseleave', () => {
            gsap.to(itemIcon, {
                scale: 1,
                duration: 0.2,
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
            gsap.to(this.loadingElement, { display: 'block', opacity: 1, duration: 0.3 });
            gsap.to(document.getElementById('analyzer-table-container'), { display: 'none', opacity: 0, duration: 0.3 });
        } else {
            gsap.to(this.loadingElement, {
                opacity: 0, duration: 0.3, onComplete: () => {
                    this.loadingElement.style.display = 'none';
                }
            });
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
                        duration: 10,
                        ease: "power1.out"
                    }
                );

                this.closeItemsRatingModal();

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
                gsap.to(item, {
                    opacity: 0, height: 0, duration: 0.3, onComplete: () => {
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

        localStorage.setItem('albionFilters', JSON.stringify(filters));
    }

    loadFiltersFromStorage() {
        const savedFilters = localStorage.getItem('albionFilters');

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
    
    // Функция для сохранения выбранной локации в localStorage
    saveHistoryLocationToStorage() {
        localStorage.setItem('albionHistoryLocation', this.historyLocationSelect.value);
    }
    
    // Функция для загрузки выбранной локации из localStorage
    loadHistoryLocationFromStorage() {
        const savedLocation = localStorage.getItem('albionHistoryLocation');
        if (savedLocation) {
            this.historyLocationSelect.value = savedLocation;
        }
    }
    
    saveShowLastDayOnlyToStorage() {
        localStorage.setItem('albionShowLastDayOnly', this.showLastDayOnlyCheckbox.checked);
    }
    
    loadShowLastDayOnlyFromStorage() {
        const savedValue = localStorage.getItem('albionShowLastDayOnly');
        if (savedValue !== null) {
            this.showLastDayOnlyCheckbox.checked = savedValue === 'true';
        }
    }

    clearFiltersStorage() {
        localStorage.removeItem('albionFilters');
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
        document.getElementById('price-history-item-name').textContent = `${item.itemName}`;
        
        // Загружаем иконку предмета
        const itemIconElement = document.getElementById('price-history-item-icon');
        const iconUrl = this.iconService.getItemIconUrl(item.itemId);
        this.iconService.loadItemIcon(iconUrl, itemIconElement);
        
        // Сохраняем ссылку на текущий предмет
        this.currentHistoryItem = item;
        
        this.openPriceHistoryModal();
        
        try {
            // Очищаем таблицу с данными
            const priceTable = document.getElementById('current-prices-table');
            priceTable.innerHTML = `
                <tr>
                    <th>Качество</th>
                    <th>Средняя цена</th>
                    <th>Мин. цена</th>
                    <th>Макс. цена</th>
                    <th>Обновлено</th>
                    <th>Всего продаж</th>
                    <th>Продажи за 24ч</th>
                </tr>
                <tr>
                    <td colspan="7" style="text-align: center;">Загрузка данных...</td>
                </tr>
            `;
            
            // Используем выбранную локацию
            const selectedLocation = this.historyLocationSelect.value;
            
            // Получаем данные истории цен для всех квант
            const historyData = await this.dataService.getPriceHistory(item.itemId, selectedLocation);
            
            // Сохраняем данные истории для использования в таблице
            this.historyData = historyData;
            
            // Получаем текущие цены
            const currentPrices = await this.dataService.getCurrentPrices(item.itemId, selectedLocation);
            
            // Подсчитываем общее количество продаж (но не отображаем в заголовке)
            const salesStats = this.dataService.calculateTotalSales(historyData);
            
            // Отображаем объединенную таблицу с ценами
            this.renderOptimizedPriceTable(historyData, currentPrices, this.showLastDayOnlyCheckbox.checked);
            
        } catch (error) {
            console.error('Ошибка при загрузке данных:', error);
            
            // Отображаем ошибку в таблице
            const priceTable = document.getElementById('current-prices-table');
            priceTable.innerHTML = `
                <tr>
                    <th>Качество</th>
                    <th>Средняя цена</th>
                    <th>Мин. цена</th>
                    <th>Макс. цена</th>
                    <th>Обновлено</th>
                    <th>Всего продаж</th>
                    <th>Продажи за 24ч</th>
                </tr>
                <tr>
                    <td colspan="7" style="text-align: center; color: red;">Ошибка при загрузке данных</td>
                </tr>
            `;
            
            // Очищаем данные истории при ошибке
            this.historyData = null;
        }
    }

    // Новый метод для отображения объединенной таблицы с ценами
    renderOptimizedPriceTable(historyData, currentPrices, showLastDayOnly) {
        const table = document.getElementById('current-prices-table');
        
        if (!historyData || historyData.length === 0 || !currentPrices || currentPrices.length === 0) {
            table.innerHTML = `
                <tr>
                    <th>Качество</th>
                    <th>Средняя цена</th>
                    <th>Мин. цена</th>
                    <th>Макс. цена</th>
                    <th>Обновлено</th>
                    <th>Всего продаж</th>
                    <th>Продажи за 24ч</th>
                </tr>
                <tr>
                    <td colspan="7" style="text-align: center;">Нет данных о ценах</td>
                </tr>
            `;
            return;
        }
        
        // Очищаем таблицу и добавляем заголовки
        table.innerHTML = `
            <tr>
                <th>Качество</th>
                <th>Средняя цена</th>
                <th>Мин. цена</th>
                <th>Макс. цена</th>
                <th>Обновлено</th>
                <th>Всего продаж</th>
                <th>Продажи за 24ч</th>
            </tr>
        `;
        
        // Подготавливаем данные истории продаж
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        // Создаем сводную информацию по каждому качеству
        const qualityData = new Map();
        
        // Сортируем данные по качеству
        currentPrices.sort((a, b) => a.quality - b.quality);
        
        // Собираем данные о продажах для каждого качества
        historyData.forEach(qualityHistoryData => {
            const quality = qualityHistoryData.quality;
            
            // Фильтруем данные по времени
            const filteredData = qualityHistoryData.data.filter(point => {
                const pointDate = new Date(point.timestamp);
                return !showLastDayOnly || pointDate >= oneDayAgo;
            });
            
            if (filteredData.length === 0) return;
            
            // Рассчитываем средние цены
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
                    
                    // Считаем продажи за последние 24 часа
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
        
        // Заполняем таблицу данными
        currentPrices.forEach(item => {
            const row = document.createElement('tr');
            
            // Получаем расчетные данные для текущего качества
            const calculatedData = qualityData.get(item.quality) || {
                avgPrice: 0,
                minPrice: 0,
                maxPrice: 0,
                totalSales: 0,
                last24hSales: 0
            };
            
            // Качество
            const qualityCell = document.createElement('td');
            qualityCell.textContent = this.dataService.getQualityName(item.quality);
            row.appendChild(qualityCell);
            
            // Средняя цена
            const avgPriceCell = document.createElement('td');
            avgPriceCell.textContent = calculatedData.avgPrice > 0 ? calculatedData.avgPrice.toLocaleString() : '—';
            row.appendChild(avgPriceCell);
            
            // Минимальная цена продажи
            const sellPriceMinCell = document.createElement('td');
            sellPriceMinCell.textContent = item.sell_price_min > 0 ? item.sell_price_min.toLocaleString() : '—';
            row.appendChild(sellPriceMinCell);
            
            // Максимальная цена продажи
            const sellPriceMaxCell = document.createElement('td');
            sellPriceMaxCell.textContent = item.sell_price_max > 0 ? item.sell_price_max.toLocaleString() : '—';
            row.appendChild(sellPriceMaxCell);
            
            // Дата обновления
            const updateDateCell = document.createElement('td');
            updateDateCell.textContent = this.formatPriceDate(item.sell_price_min_date);
            row.appendChild(updateDateCell);
            
            // Всего продаж
            const totalSalesCell = document.createElement('td');
            totalSalesCell.textContent = calculatedData.totalSales.toLocaleString();
            row.appendChild(totalSalesCell);
            
            // Продажи за последние 24 часа
            const recentSalesCell = document.createElement('td');
            recentSalesCell.textContent = calculatedData.last24hSales.toLocaleString();
            row.appendChild(recentSalesCell);
            
            table.appendChild(row);
        });
    }
    
    formatPriceDate(dateString) {
        const date = new Date(dateString);
        
        if (date.getFullYear() <= 1970) {
            return 'Нет данных';
        }
        
        // Форматируем дату
        return this.dataService.formatDate(dateString);
    }

    openPriceHistoryModal() {
        this.priceHistoryModal.style.display = 'block';

        const modalContent = this.priceHistoryModal.querySelector('.modal-content');
        gsap.fromTo(modalContent,
            { opacity: 0, y: -20 },
            { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
        );
    }

    closePriceHistoryModal() {
        const modalContent = this.priceHistoryModal.querySelector('.modal-content');

        gsap.to(modalContent, {
            opacity: 0,
            y: 20,
            duration: 0.3,
            ease: "power2.in",
            onComplete: () => {
                this.priceHistoryModal.style.display = 'none';
                
                // Очищаем ссылку на текущий предмет
                this.currentHistoryItem = null;
            }
        });
    }
} 