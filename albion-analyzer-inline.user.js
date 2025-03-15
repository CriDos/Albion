// ==UserScript==
// @name         Albion Profit Calculator - Встроенный анализатор
// @namespace    https://albion-profit-calculator.com/
// @version      0.1
// @description  Добавляет кнопку для открытия встроенного анализатора данных
// @author       You
// @match        https://albion-profit-calculator.com/ru/transportations
// @match        https://albion-profit-calculator.com/ru/transportations*
// @match        https://albion-profit-calculator.com/en/transportations
// @match        https://albion-profit-calculator.com/en/transportations*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        if (url.includes('/api/transportations/sort')) {
            url = url.replace(/count=\d+/, 'count=100');
            
            if (!url.includes('count=')) {
                url += (url.includes('?') ? '&' : '?') + 'count=100';
            }
            
            console.log('Модифицированный URL запроса:', url);
        }
        
        return originalXHROpen.call(this, method, url, async, user, password);
    };

    const originalFetch = window.fetch;
    window.fetch = function(resource, options) {
        if (typeof resource === 'string' && resource.includes('/api/transportations/sort')) {
            resource = resource.replace(/count=\d+/, 'count=100');
            
            if (!resource.includes('count=')) {
                resource += (resource.includes('?') ? '&' : '?') + 'count=100';
            }
            
            console.log('Модифицированный URL fetch-запроса:', resource);
        }
        
        return originalFetch.call(this, resource, options);
    };

    const styles = `
        #analyzer-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 10000;
            overflow: auto;
            font-family: Arial, sans-serif;
        }
        
        #analyzer-content {
            background-color: #fff;
            margin: 2% auto;
            width: 95%;
            height: 90%;
            padding: 20px;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
        }
        
        #analyzer-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        
        #analyzer-close {
            cursor: pointer;
            font-size: 24px;
            font-weight: bold;
        }
        
        #analyzer-filters {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            padding: 15px;
            background-color: #f5f5f5;
            border-radius: 5px;
            margin-bottom: 15px;
            align-items: center;
        }
        
        @media (max-width: 1200px) {
            #analyzer-filters {
                grid-template-columns: repeat(3, 1fr);
            }
        }
        
        @media (max-width: 768px) {
            #analyzer-filters {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        
        @media (max-width: 576px) {
            #analyzer-filters {
                grid-template-columns: 1fr;
            }
        }
        
        .filter-group {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-width: 180px;
        }
        
        .filter-label {
            font-weight: bold;
            margin-bottom: 5px;
            white-space: nowrap;
        }
        
        .filter-input {
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            width: 100%;
            box-sizing: border-box;
        }
        
        .filter-buttons {
            display: flex;
            gap: 10px;
            align-items: flex-end;
        }
        
        .analyzer-button {
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 8px 15px;
            text-align: center;
            text-decoration: none;
            cursor: pointer;
            border-radius: 4px;
        }
        
        .analyzer-button:hover {
            background-color: #45a049;
        }
        
        #analyzer-table-container {
            flex: 1;
            overflow: auto;
        }
        
        #analyzer-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        #analyzer-table th {
            background-color: #f2f2f2;
            position: sticky;
            top: 0;
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
            cursor: pointer;
        }
        
        #analyzer-table th:hover {
            background-color: #e8e8e8;
        }
        
        #analyzer-table td {
            border: 1px solid #ddd;
            padding: 8px;
        }
        
        #analyzer-table tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        
        #analyzer-table tr:hover {
            background-color: #f1f1f1;
        }
        
        .profit-positive {
            color: green;
        }
        
        .profit-negative {
            color: red;
        }
        
        #analyzer-status {
            margin-top: 10px;
            padding: 5px;
            background-color: #f0f0f0;
            border-radius: 3px;
        }
        
        .sort-indicator::after {
            content: "";
            margin-left: 5px;
        }
        
        .sort-asc::after {
            content: "▲";
        }
        
        .sort-desc::after {
            content: "▼";
        }
    `;

    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);

    function parseItemsFromPage() {
        const itemWrappers = document.querySelectorAll('.items .wrapper');
        const items = [];

        itemWrappers.forEach(wrapper => {
            const imageElement = wrapper.querySelector('.image-without-number');
            const titleElement = wrapper.querySelector('.title');

            const priceElements = wrapper.querySelectorAll('.price-with-date');
            const buyPriceElement = priceElements[0]?.querySelector('span:first-child');
            const buyDateElement = priceElements[0]?.querySelector('.date');
            const sellPriceElement = priceElements[1]?.querySelector('span:first-child');
            const sellDateElement = priceElements[1]?.querySelector('.date');

            const locationElements = wrapper.querySelectorAll('.inputs-grid > span');
            const buyLocation = locationElements[0]?.textContent.trim();
            const sellLocation = locationElements[1]?.textContent.trim();

            const profitElement = wrapper.querySelector('.profit-real');
            const profitPercentElement = wrapper.querySelector('.profit-percents');
            const soldPerDayElement = wrapper.querySelector('.sold-per-day');

            const cleanNumberString = (str) => {
                if (!str) return 0;
                return parseFloat(str.replace(/[^\d.,]/g, '').replace(/,/g, '.'));
            };

            const item = {
                title: titleElement?.textContent.trim() || 'Неизвестно',
                image: imageElement?.src || '',
                buyPrice: cleanNumberString(buyPriceElement?.textContent),
                buyTimeAgo: buyDateElement?.textContent.trim() || '',
                sellPrice: cleanNumberString(sellPriceElement?.textContent),
                sellTimeAgo: sellDateElement?.textContent.trim() || '',
                fromLocation: buyLocation || 'Неизвестно',
                toLocation: sellLocation || 'Неизвестно',
                profit: cleanNumberString(profitElement?.textContent),
                profitPercent: cleanNumberString(profitPercentElement?.textContent),
                soldPerDay: cleanNumberString(soldPerDayElement?.textContent)
            };

            items.push(item);
        });

        return items;
    }

    function createAnalyzerHTML() {
        return `
            <div id="analyzer-modal">
                <div id="analyzer-content">
                    <div id="analyzer-header">
                        <h2>Анализатор рынка Albion</h2>
                        <span id="analyzer-close">&times;</span>
                    </div>
                    <div id="analyzer-filters">
                        <div class="filter-group">
                            <label class="filter-label">Мин. прибыль</label>
                            <input type="number" id="min-profit" class="filter-input" placeholder="Значение">
                        </div>
                        <div class="filter-group">
                            <label class="filter-label">Мин. % прибыли</label>
                            <input type="number" id="min-profit-percent" class="filter-input" placeholder="Значение">
                        </div>
                        <div class="filter-group">
                            <label class="filter-label">Мин. продаж/день</label>
                            <input type="number" id="min-sold-per-day" class="filter-input" placeholder="Значение">
                        </div>
                        <div class="filter-buttons">
                            <button id="apply-filters" class="analyzer-button">Применить</button>
                            <button id="reset-filters" class="analyzer-button">Сбросить</button>
                        </div>
                    </div>
                    <div id="analyzer-table-container">
                        <table id="analyzer-table">
                            <thead>
                                <tr>
                                    <th data-field="title">Название</th>
                                    <th data-field="image">Изображение</th>
                                    <th data-field="buyPrice">Цена покупки</th>
                                    <th data-field="sellPrice">Цена продажи</th>
                                    <th data-field="buyTimeAgo">Время покупки</th>
                                    <th data-field="sellTimeAgo">Время продажи</th>
                                    <th data-field="fromLocation">Откуда</th>
                                    <th data-field="toLocation">Куда</th>
                                    <th data-field="profit" class="sort-desc">Прибыль</th>
                                    <th data-field="profitPercent">% прибыли</th>
                                    <th data-field="soldPerDay">Продаж/день</th>
                                </tr>
                            </thead>
                            <tbody>
                            </tbody>
                        </table>
                    </div>
                    <div id="analyzer-status">Готов к работе</div>
                </div>
            </div>
        `;
    }

    function initializeAnalyzer() {
        let data = parseItemsFromPage();
        let filteredData = [...data];
        let currentSortField = 'profit';
        let sortAscending = false;

        let modal = document.getElementById('analyzer-modal');
        if (!modal) {
            document.body.insertAdjacentHTML('beforeend', createAnalyzerHTML());
            modal = document.getElementById('analyzer-modal');
        }

        modal.style.display = 'block';

        const closeButton = document.getElementById('analyzer-close');
        const applyFiltersButton = document.getElementById('apply-filters');
        const resetFiltersButton = document.getElementById('reset-filters');
        const table = document.getElementById('analyzer-table');
        const statusElement = document.getElementById('analyzer-status');
        const tableHeaders = table.querySelectorAll('th');

        closeButton.onclick = () => { modal.style.display = 'none'; };

        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };

        applyFiltersButton.onclick = applyFilters;

        resetFiltersButton.onclick = resetFilters;

        tableHeaders.forEach(header => {
            header.onclick = () => sortTable(header.dataset.field);
        });

        updateTable();

        updateSortIndicators();

        function updateTable() {
            const tbody = table.querySelector('tbody');
            tbody.innerHTML = '';

            filteredData.forEach(item => {
                const row = document.createElement('tr');

                const titleCell = document.createElement('td');
                titleCell.textContent = item.title;
                row.appendChild(titleCell);

                const imageCell = document.createElement('td');
                const img = document.createElement('img');
                img.src = item.image;
                img.style.width = '30px';
                img.style.height = '30px';
                imageCell.appendChild(img);
                row.appendChild(imageCell);

                const buyPriceCell = document.createElement('td');
                buyPriceCell.textContent = item.buyPrice.toLocaleString();
                row.appendChild(buyPriceCell);

                const sellPriceCell = document.createElement('td');
                sellPriceCell.textContent = item.sellPrice.toLocaleString();
                row.appendChild(sellPriceCell);

                const buyTimeCell = document.createElement('td');
                buyTimeCell.textContent = item.buyTimeAgo;
                row.appendChild(buyTimeCell);

                const sellTimeCell = document.createElement('td');
                sellTimeCell.textContent = item.sellTimeAgo;
                row.appendChild(sellTimeCell);

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
                profitPercentCell.textContent = item.profitPercent.toLocaleString() + '%';
                profitPercentCell.className = item.profitPercent > 0 ? 'profit-positive' : 'profit-negative';
                row.appendChild(profitPercentCell);

                const soldPerDayCell = document.createElement('td');
                soldPerDayCell.textContent = item.soldPerDay.toLocaleString();
                row.appendChild(soldPerDayCell);

                tbody.appendChild(row);
            });

            statusElement.textContent = `Отображено ${filteredData.length} из ${data.length} записей`;
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

        function updateSortIndicators() {
            tableHeaders.forEach(header => {
                header.classList.remove('sort-asc', 'sort-desc', 'sort-indicator');

                if (header.dataset.field === currentSortField) {
                    header.classList.add('sort-indicator');
                    header.classList.add(sortAscending ? 'sort-asc' : 'sort-desc');
                }
            });
        }
    }

    function addAnalyzerButton() {
        const analyzerButton = document.createElement('a');
        analyzerButton.textContent = 'Анализатор';
        analyzerButton.href = '#';
        analyzerButton.className = 'header__link header__link--purple';
        analyzerButton.style.cssText = `
            margin-right: 10px;
            cursor: pointer;
        `;

        analyzerButton.addEventListener('click', (e) => {
            e.preventDefault();
            initializeAnalyzer();
        });

        const headerWrapper = document.querySelector('.header__wrapper');
        if (headerWrapper) {
            const headerLinks = headerWrapper.querySelectorAll('.header__link');
            if (headerLinks.length > 0) {
                headerWrapper.insertBefore(analyzerButton, headerLinks[0]);
            } else {
                headerWrapper.appendChild(analyzerButton);
            }
            console.log('Кнопка анализатора добавлена в шапку');
        } else {
            console.log('Не удалось найти .header__wrapper, добавляем кнопку в стандартное место');
            const container = document.querySelector('.container') || document.body;
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = 'margin: 10px; text-align: center;';
            
            const fallbackButton = document.createElement('button');
            fallbackButton.textContent = 'Открыть анализатор';
            fallbackButton.style.cssText = `
                background-color: #4CAF50;
                border: none;
                color: white;
                padding: 10px 15px;
                text-align: center;
                text-decoration: none;
                display: inline-block;
                font-size: 14px;
                margin: 10px;
                cursor: pointer;
                border-radius: 4px;
            `;
            
            fallbackButton.addEventListener('click', initializeAnalyzer);
            buttonContainer.appendChild(fallbackButton);
            container.insertBefore(buttonContainer, container.firstChild);
        }
    }

    function modifyNuxtSettings() {
        if (window.__NUXT__ && window.__NUXT__.state && window.__NUXT__.state.transportations) {
            const transportationsState = window.__NUXT__.state.transportations;
            
            if (!transportationsState.settings.count) {
                transportationsState.settings.count = 100;
                console.log('Добавлен параметр count=100 в настройки Nuxt.js');
            } else if (transportationsState.settings.count !== 100) {
                transportationsState.settings.count = 100;
                console.log('Изменен параметр count на 100 в настройках Nuxt.js');
            }
        }
    }

    window.addEventListener('load', () => {
        modifyNuxtSettings();
        setTimeout(addAnalyzerButton, 1000);
    });
})();