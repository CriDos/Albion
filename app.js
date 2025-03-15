document.addEventListener('DOMContentLoaded', () => {
    let data = [];
    let filteredData = [];
    let currentSortField = 'profit';
    let sortAscending = false;
    let itemsData = []; 

    const fromLocationSelect = document.getElementById('from-location');
    const toLocationSelect = document.getElementById('to-location');
    const itemsCountInput = document.getElementById('items-count');
    const fetchDataButton = document.getElementById('fetch-data');
    const applyFiltersButton = document.getElementById('apply-filters');
    const resetFiltersButton = document.getElementById('reset-filters');
    const table = document.getElementById('analyzer-table');
    const loadingElement = document.getElementById('loading');
    const statusElement = document.getElementById('analyzer-status');
    const tableHeaders = table.querySelectorAll('th');

    loadItemsData();

    fetchDataButton.addEventListener('click', fetchData);

    applyFiltersButton.addEventListener('click', applyFilters);
    resetFiltersButton.addEventListener('click', resetFilters);
    tableHeaders.forEach(header => {
        header.addEventListener('click', () => sortTable(header.dataset.field));
    });

    async function loadItemsData() {
        try {
            const response = await fetch('items.json');
            if (!response.ok) {
                console.warn('Не удалось загрузить данные локализации:', response.status);
                return;
            }
            
            itemsData = await response.json();
            console.log(`Загружено ${itemsData.length} названий предметов`);
        } catch (error) {
            console.warn('Ошибка при загрузке данных локализации:', error);
        }
    }

    function getItemName(uniqueName) {
        const cleanUniqueName = uniqueName.replace(/@\d+$/, '');
        
        const item = itemsData.find(item => item.UniqueName === cleanUniqueName);
        
        if (item && item.LocalizedNames && item.LocalizedNames["RU-RU"]) {
            return item.LocalizedNames["RU-RU"];
        }
        
        return formatItemId(uniqueName);
    }

    async function fetchData() {
        const fromLocation = encodeURIComponent(fromLocationSelect.value);
        const toLocation = encodeURIComponent(toLocationSelect.value);
        const itemsCount = parseInt(itemsCountInput.value) || 100;
        
        if (fromLocation === toLocation) {
            alert('Выберите разные локации для отправления и получения');
            return;
        }
        
        const url = `https://albion-profit-calculator.com/api/transportations/sort?from=${fromLocation}&to=${toLocation}&count=${itemsCount}&skip=0&sort=BY_LAST_TIME_CHECKED,BY_PERCENTAGE_PROFIT&serverId=aod_europe`;
        
        showLoading(true);
        statusElement.textContent = 'Загрузка данных...';
        
        try {
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
            
            data = processApiData(jsonData);
            filteredData = [...data];
            
            sortTable(currentSortField, true);
            
            statusElement.textContent = `Загружено ${data.length} записей`;
        } catch (error) {
            console.error('Ошибка при загрузке данных:', error);
            statusElement.textContent = `Ошибка при загрузке данных: ${error.message}`;
        } finally {
            showLoading(false);
        }
    }

    function processApiData(apiData) {
        return apiData.map(item => {
            const fromItem = item.from;
            const toItem = item.to;
            
            const buyPrice = fromItem.sellPriceMin;
            
            const sellPrice = toItem.sellPriceMin;
            
            const profit = sellPrice - buyPrice;
            
            const profitPercent = buyPrice > 0 ? (profit / buyPrice) * 100 : 0;
            
            const soldPerDay = toItem.averageItems || 0;
            
            const buyDate = formatDate(fromItem.sellPriceMinDate);
            const sellDate = formatDate(toItem.sellPriceMinDate);
            
            return {
                itemId: fromItem.itemId,
                itemName: getItemName(fromItem.itemId), 
                quality: fromItem.quality,
                buyPrice: buyPrice,
                sellPrice: sellPrice,
                buyDate: buyDate,
                sellDate: sellDate,
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

    function applyFilters() {
        filteredData = [...data];

        const minProfit = parseFloat(document.getElementById('min-profit').value) || 0;
        const minProfitPercent = parseFloat(document.getElementById('min-profit-percent').value) || 0;
        const minSoldPerDay = parseFloat(document.getElementById('min-sold-per-day').value) || 0;

        filteredData = filteredData.filter(item => {
            return item.profit >= minProfit &&
                item.profitPercent >= minProfitPercent &&
                item.soldPerDay >= minSoldPerDay;
        });

        sortTable(currentSortField, true);

        statusElement.textContent = `Отфильтровано: ${filteredData.length} из ${data.length} записей`;
    }

    function resetFilters() {
        document.getElementById('min-profit').value = '';
        document.getElementById('min-profit-percent').value = '';
        document.getElementById('min-sold-per-day').value = '';

        filteredData = [...data];

        sortTable(currentSortField, true);

        statusElement.textContent = `Фильтры сброшены. Отображено ${filteredData.length} записей`;
    }

    function sortTable(field, skipToggle = false) {
        if (field === currentSortField && !skipToggle) {
            sortAscending = !sortAscending;
        } else {
            currentSortField = field;
            if (!skipToggle) {
                sortAscending = true;
            }
        }

        filteredData.sort((a, b) => {
            const valueA = a[field];
            const valueB = b[field];

            if (typeof valueA === 'string' && typeof valueB === 'string') {
                return sortAscending ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
            }

            return sortAscending ? valueA - valueB : valueB - valueA;
        });

        updateTable();
        updateSortIndicators();

        const direction = sortAscending ? "по возрастанию" : "по убыванию";
        statusElement.textContent = `Данные отсортированы по полю '${field}' ${direction}`;
    }

    function updateTable() {
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = '';

        if (filteredData.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 11;
            cell.textContent = 'Нет данных для отображения. Загрузите данные или измените фильтры.';
            cell.style.textAlign = 'center';
            cell.style.padding = '20px';
            row.appendChild(cell);
            tbody.appendChild(row);
            return;
        }

        filteredData.forEach(item => {
            const row = document.createElement('tr');

            const itemIdCell = document.createElement('td');
            itemIdCell.textContent = item.itemName;
            row.appendChild(itemIdCell);

            const qualityCell = document.createElement('td');
            qualityCell.textContent = getQualityName(item.quality);
            row.appendChild(qualityCell);

            const buyPriceCell = document.createElement('td');
            buyPriceCell.textContent = item.buyPrice.toLocaleString();
            row.appendChild(buyPriceCell);

            const sellPriceCell = document.createElement('td');
            sellPriceCell.textContent = item.sellPrice.toLocaleString();
            row.appendChild(sellPriceCell);

            const buyDateCell = document.createElement('td');
            buyDateCell.textContent = item.buyDate;
            row.appendChild(buyDateCell);

            const sellDateCell = document.createElement('td');
            sellDateCell.textContent = item.sellDate;
            row.appendChild(sellDateCell);

            const fromCell = document.createElement('td');
            fromCell.textContent = item.fromLocation;
            row.appendChild(fromCell);

            const toCell = document.createElement('td');
            toCell.textContent = item.toLocation;
            row.appendChild(toCell);

            const profitCell = document.createElement('td');
            profitCell.textContent = item.profit.toLocaleString();
            profitCell.className = item.profit > 0 ? 'profit-positive' : 'profit-negative';
            row.appendChild(profitCell);

            const profitPercentCell = document.createElement('td');
            profitPercentCell.textContent = item.profitPercent.toFixed(2) + '%';
            profitPercentCell.className = item.profitPercent > 0 ? 'profit-positive' : 'profit-negative';
            row.appendChild(profitPercentCell);

            const soldPerDayCell = document.createElement('td');
            soldPerDayCell.textContent = item.soldPerDay.toFixed(2);
            row.appendChild(soldPerDayCell);

            tbody.appendChild(row);
        });
    }

    function updateSortIndicators() {
        tableHeaders.forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc', 'sort-indicator');

            if (header.dataset.field === currentSortField) {
                header.classList.add('sort-indicator');
                header.classList.add(sortAscending ? 'sort-asc' : 'sort-desc');
            }
        });
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        
        if (date.getFullYear() <= 1970) {
            return 'Нет данных';
        }
        
        const now = new Date();
        const diff = now - date;
        
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            if (hours < 1) {
                const minutes = Math.floor(diff / 60000);
                return `${minutes} мин. назад`;
            }
            return `${hours} ч. назад`;
        }
        
        if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return `${days} дн. назад`;
        }
        
        return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
    }

    function formatItemId(itemId) {
        let formattedId = itemId.replace(/^T\d+_/, '').replace(/@\d+$/, '');
        
        formattedId = formattedId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        return formattedId;
    }

    function getQualityName(quality) {
        const qualityNames = {
            1: 'Обычное',
            2: 'Хорошее',
            3: 'Превосходное',
            4: 'Мастерское',
            5: 'Безупречное'
        };
        
        return qualityNames[quality] || 'Неизвестно';
    }

    function showLoading(show) {
        loadingElement.style.display = show ? 'block' : 'none';
        document.getElementById('analyzer-table-container').style.display = show ? 'none' : 'block';
    }
    
    updateTable();
}); 