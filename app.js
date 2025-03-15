document.addEventListener('DOMContentLoaded', () => {
    let data = [];
    let filteredData = [];
    let currentSortField = 'profit';
    let sortAscending = false;
    let itemsData = []; 
    let iconCache = {}; // Кэш для иконок предметов в памяти
    let db; // Объект для IndexedDB
    let currentChart = null; // Для хранения текущего экземпляра графика

    const fromLocationSelect = document.getElementById('from-location');
    const toLocationSelect = document.getElementById('to-location');
    const itemsCountInput = document.getElementById('items-count');
    const sortTypeSelect = document.getElementById('sort-type');
    const fetchDataButton = document.getElementById('fetch-data');
    const applyFiltersButton = document.getElementById('apply-filters');
    const resetFiltersButton = document.getElementById('reset-filters');
    const table = document.getElementById('analyzer-table');
    const loadingElement = document.getElementById('loading');
    const statusElement = document.getElementById('analyzer-status');
    const tableHeaders = table.querySelectorAll('th');
    
    // Элементы модального окна с графиками
    const showChartsBtn = document.getElementById('show-charts');
    const chartsModal = document.getElementById('charts-modal');
    const closeModal = document.querySelector('.close-modal');
    const chartCanvas = document.getElementById('chart-canvas');
    
    // Инициализируем базу данных для кэширования иконок
    initIconsDatabase();
    loadItemsData();

    fetchDataButton.addEventListener('click', fetchData);

    applyFiltersButton.addEventListener('click', applyFilters);
    resetFiltersButton.addEventListener('click', resetFilters);
    tableHeaders.forEach(header => {
        header.addEventListener('click', () => sortTable(header.dataset.field));
    });
    
    // Обработчики для модального окна с графиками
    showChartsBtn.addEventListener('click', () => {
        if (filteredData.length === 0) {
            alert('Сначала загрузите данные для отображения графиков');
            return;
        }
        
        openChartsModal();
        renderScatterChart(); // Показываем единственный график Прибыль/объем
    });
    
    closeModal.addEventListener('click', () => {
        chartsModal.style.display = 'none';
        // Убираем подсветку при закрытии графика
        const highlightedRows = document.querySelectorAll('tr.highlighted-item');
        highlightedRows.forEach(row => row.classList.remove('highlighted-item'));
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === chartsModal) {
            chartsModal.style.display = 'none';
            // Убираем подсветку при закрытии графика
            const highlightedRows = document.querySelectorAll('tr.highlighted-item');
            highlightedRows.forEach(row => row.classList.remove('highlighted-item'));
        }
    });

    // Инициализация базы данных для кэширования иконок
    function initIconsDatabase() {
        const request = indexedDB.open('AlbionIconsCache', 1);
        
        request.onerror = function(event) {
            console.error('Ошибка при открытии базы данных для кэширования иконок:', event.target.error);
        };
        
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            
            // Создаем хранилище объектов для иконок, если его еще нет
            if (!db.objectStoreNames.contains('icons')) {
                const iconStore = db.createObjectStore('icons', { keyPath: 'url' });
            }
        };
        
        request.onsuccess = function(event) {
            db = event.target.result;
            console.log('База данных для кэширования иконок успешно инициализирована');
        };
    }

    async function loadItemsData() {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.overrideMimeType("application/json");
            xhr.open('GET', 'items.json', true);
            
            xhr.onload = function() {
                if (xhr.status === 200) {
                    try {
                        itemsData = JSON.parse(xhr.responseText);
                        console.log(`Загружено ${itemsData.length} названий предметов`);
                        resolve();
                    } catch (e) {
                        console.warn('Ошибка при разборе данных локализации:', e);
                        reject(e);
                    }
                } else {
                    console.warn('Не удалось загрузить данные локализации:', xhr.status);
                    reject(new Error(`Статус: ${xhr.status}`));
                }
            };
            
            xhr.onerror = function() {
                console.warn('Ошибка при загрузке данных локализации');
                reject(new Error('Ошибка сети'));
            };
            
            xhr.send();
        });
    }

    function getItemName(uniqueName) {
        let item = itemsData.find(item => item.UniqueName === uniqueName);
        
        if (!item) {
            const cleanUniqueName = uniqueName.replace(/@\d+$/, '');
            item = itemsData.find(item => item.UniqueName === cleanUniqueName);
        }
        
        if (item && item.LocalizedNames && item.LocalizedNames["RU-RU"]) {
            return item.LocalizedNames["RU-RU"];
        }
        
        return uniqueName;
    }

    async function fetchData() {
        const fromLocation = encodeURIComponent(fromLocationSelect.value);
        const toLocation = encodeURIComponent(toLocationSelect.value);
        const itemsCount = parseInt(itemsCountInput.value) || 100;
        const sortType = sortTypeSelect.value;
        
        if (fromLocation === toLocation) {
            alert('Выберите разные локации для отправления и получения');
            return;
        }
        
        const url = `https://albion-profit-calculator.com/api/transportations/sort?from=${fromLocation}&to=${toLocation}&count=${itemsCount}&skip=0&sort=BY_LAST_TIME_CHECKED,${sortType}&serverId=aod_europe`;
        
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
            
            // Добавляем контейнер для иконки и названия
            const itemContainer = document.createElement('div');
            itemContainer.style.display = 'flex';
            itemContainer.style.alignItems = 'center';
            
            // Добавляем иконку предмета
            const itemIcon = document.createElement('img');
            itemIcon.style.width = '64px';
            itemIcon.style.height = '64px';
            itemIcon.style.marginRight = '8px';
            itemIcon.style.flexShrink = '0';
            itemIcon.style.cursor = 'pointer';
            itemIcon.alt = item.itemName;
            
            // Обработчик клика для копирования названия предмета
            itemIcon.addEventListener('click', function() {
                navigator.clipboard.writeText(item.itemName)
                    .then(() => {
                        // Добавляем визуальную обратную связь
                        const originalBorder = this.style.border;
                        this.style.border = '2px solid #4CAF50';
                        
                        // Показываем статус
                        statusElement.textContent = `Название "${item.itemName}" скопировано в буфер обмена`;
                        
                        // Возвращаем исходный стиль через 1 секунду
                        setTimeout(() => {
                            this.style.border = originalBorder;
                        }, 1000);
                    })
                    .catch(err => {
                        console.error('Ошибка при копировании в буфер обмена:', err);
                        statusElement.textContent = 'Не удалось скопировать название в буфер обмена';
                    });
            });
            
            // Получаем URL иконки и загружаем её с использованием кэша
            const iconUrl = getItemIconUrl(item.itemId);
            loadItemIcon(iconUrl, itemIcon);
            
            // Добавляем текст названия предмета
            const itemNameSpan = document.createElement('span');
            itemNameSpan.textContent = item.itemName;
            itemNameSpan.style.whiteSpace = 'nowrap';
            itemNameSpan.style.overflow = 'hidden';
            itemNameSpan.style.textOverflow = 'ellipsis';
            
            // Собираем всё вместе
            itemContainer.appendChild(itemIcon);
            itemContainer.appendChild(itemNameSpan);
            itemIdCell.appendChild(itemContainer);
            itemIdCell.style.minWidth = '250px';
            
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
    
    // Функция для получения URL иконки предмета
    function getItemIconUrl(itemId) {
        return `https://albion-profit-calculator.com/images/items/${itemId}.png`;
    }
    
    // Функция для загрузки и кэширования иконок предметов
    function loadItemIcon(url, imgElement) {
        // Проверяем кэш в памяти сначала
        if (iconCache[url]) {
            imgElement.src = iconCache[url];
            return;
        }
        
        // Если нет в памяти, проверяем кэш в IndexedDB
        getIconFromCache(url).then(cachedIcon => {
            if (cachedIcon) {
                // Если иконка найдена в кэше, используем ее
                iconCache[url] = URL.createObjectURL(cachedIcon.blob);
                imgElement.src = iconCache[url];
            } else {
                // Если иконки нет в кэше, загружаем её с сервера
                imgElement.onerror = function() {
                    // Если не удалось загрузить, устанавливаем заглушку
                    const blankImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
                    this.src = blankImage;
                    this.style.opacity = '0.3';
                    iconCache[url] = blankImage;
                    
                    // Сохраняем заглушку в кэш
                    fetch(blankImage)
                        .then(response => response.blob())
                        .then(blob => {
                            saveIconToCache(url, blob);
                        })
                        .catch(err => console.error('Ошибка при сохранении заглушки в кэш:', err));
                };
                
                imgElement.onload = function() {
                    // Кэшируем успешно загруженную иконку
                    fetch(url)
                        .then(response => {
                            if (!response.ok) throw new Error('Ошибка сети при загрузке иконки');
                            return response.blob();
                        })
                        .then(blob => {
                            // Сохраняем изображение в кэш
                            saveIconToCache(url, blob);
                            // Кэшируем в памяти
                            iconCache[url] = URL.createObjectURL(blob);
                        })
                        .catch(err => console.error('Ошибка при кэшировании иконки:', err));
                };
                
                imgElement.src = url;
            }
        }).catch(error => {
            console.error('Ошибка при получении иконки из кэша:', error);
            // В случае ошибки загружаем напрямую
            imgElement.src = url;
        });
    }
    
    // Получение иконки из IndexedDB
    function getIconFromCache(url) {
        return new Promise((resolve, reject) => {
            if (!db) {
                resolve(null);
                return;
            }
            
            try {
                const transaction = db.transaction(['icons'], 'readonly');
                const store = transaction.objectStore('icons');
                const request = store.get(url);
                
                request.onsuccess = function(event) {
                    resolve(event.target.result);
                };
                
                request.onerror = function(event) {
                    console.error('Ошибка при получении иконки из кэша:', event.target.error);
                    resolve(null);
                };
            } catch (error) {
                console.error('Исключение при получении иконки из кэша:', error);
                resolve(null);
            }
        });
    }
    
    // Сохранение иконки в IndexedDB
    function saveIconToCache(url, blob) {
        if (!db) return;
        
        try {
            const transaction = db.transaction(['icons'], 'readwrite');
            const store = transaction.objectStore('icons');
            
            // Сохраняем с дополнительной информацией
            const iconData = {
                url: url,
                blob: blob,
                timestamp: new Date().getTime()
            };
            
            const request = store.put(iconData);
            
            request.onerror = function(event) {
                console.error('Ошибка при сохранении иконки в кэш:', event.target.error);
            };
        } catch (error) {
            console.error('Исключение при сохранении иконки в кэш:', error);
        }
    }

    // Функция для открытия модального окна с графиками
    function openChartsModal() {
        chartsModal.style.display = 'block';
    }
    
    // График соотношения прибыли и объема продаж
    function renderScatterChart() {
        // Уничтожаем предыдущий график перед созданием нового
        if (currentChart) {
            currentChart.destroy();
        }
        
        // Создаем массив с индексами для связи между точками на графике и строками таблицы
        const dataPoints = filteredData.map((item, index) => ({
            x: item.profitPercent,
            y: item.soldPerDay,
            profit: item.profit,
            itemName: item.itemName,
            buyPrice: item.buyPrice,
            sellPrice: item.sellPrice,
            quality: item.quality,
            fromLocation: item.fromLocation,
            toLocation: item.toLocation,
            dataIndex: index // Добавляем индекс для связи с таблицей
        }));
        
        // Создаем квадранты для пометки зон на графике
        const quadrantLines = {
            id: 'quadrantLines',
            beforeDraw(chart) {
                const {ctx, chartArea: {left, top, right, bottom}, scales: {x, y}} = chart;
                
                // Среднее значение для X (процент прибыли)
                const avgProfit = filteredData.reduce((sum, item) => sum + item.profitPercent, 0) / filteredData.length;
                // Среднее значение для Y (продаж в день)
                const avgSold = filteredData.reduce((sum, item) => sum + item.soldPerDay, 0) / filteredData.length;
                
                const xValue = x.getPixelForValue(avgProfit);
                const yValue = y.getPixelForValue(avgSold);
                
                // Рисуем вертикальную линию
                ctx.save();
                ctx.strokeStyle = 'rgba(150, 150, 150, 0.5)';
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(xValue, top);
                ctx.lineTo(xValue, bottom);
                ctx.stroke();
                
                // Рисуем горизонтальную линию
                ctx.beginPath();
                ctx.moveTo(left, yValue);
                ctx.lineTo(right, yValue);
                ctx.stroke();
                
                // Метки для квадрантов
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.font = '12px Arial';
                
                // Верхний правый - лучшие товары
                ctx.fillText('Лучшие товары', xValue + 5, yValue - 5);
                // Нижний правый - высокая прибыль, низкие продажи
                ctx.fillText('Высокая прибыль, низкие продажи', xValue + 5, bottom - 5);
                // Верхний левый - низкая прибыль, высокие продажи
                ctx.fillText('Низкая прибыль, высокие продажи', left + 5, yValue - 5);
                // Нижний левый - худшие товары
                ctx.fillText('Низкая ликвидность', left + 5, bottom - 5);
                
                ctx.restore();
            }
        };
        
        currentChart = new Chart(chartCanvas, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Товары',
                    data: dataPoints,
                    backgroundColor: function(context) {
                        const value = context.raw.profit;
                        return value > 0 ? 'rgba(75, 192, 75, 0.6)' : 'rgba(255, 99, 132, 0.6)';
                    },
                    borderColor: function(context) {
                        const value = context.raw.profit;
                        return value > 0 ? 'rgba(75, 192, 75, 1)' : 'rgba(255, 99, 132, 1)';
                    },
                    pointRadius: function(context) {
                        // Размер точки зависит от абсолютного значения прибыли
                        const value = Math.abs(context.raw.profit);
                        return Math.min(Math.max(5, Math.log(value) * 1.5), 15);
                    },
                    pointHoverRadius: 15,
                    pointHoverBorderWidth: 2,
                    pointHoverBackgroundColor: function(context) {
                        const value = context.raw.profit;
                        return value > 0 ? 'rgba(75, 192, 75, 0.8)' : 'rgba(255, 99, 132, 0.8)';
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Соотношение прибыли и объема продаж',
                        font: {
                            size: 18
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const point = context.raw;
                                return [
                                    `Товар: ${point.itemName}`,
                                    `Качество: ${getQualityName(point.quality)}`,
                                    `Процент прибыли: ${point.x.toFixed(2)}%`,
                                    `Продаж в день: ${point.y.toFixed(2)}`,
                                    `Абсолютная прибыль: ${point.profit.toLocaleString()} серебра`,
                                    `Цена покупки: ${point.buyPrice.toLocaleString()} серебра`,
                                    `Цена продажи: ${point.sellPrice.toLocaleString()} серебра`,
                                    `Маршрут: ${point.fromLocation} → ${point.toLocation}`
                                ];
                            }
                        }
                    },
                    legend: {
                        display: false
                    },
                    quadrantLines: quadrantLines
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Продаж в день',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Процент прибыли (%)',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                onClick: function(e, elements) {
                    // Убираем существующую подсветку
                    const highlightedRows = document.querySelectorAll('tr.highlighted-item');
                    highlightedRows.forEach(row => row.classList.remove('highlighted-item'));
                    
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const dataIndex = dataPoints[index].dataIndex;
                        
                        // Находим соответствующую строку в таблице и подсвечиваем ее
                        const tbody = table.querySelector('tbody');
                        const rows = tbody.querySelectorAll('tr');
                        
                        if (rows.length > dataIndex) {
                            rows[dataIndex].classList.add('highlighted-item');
                            
                            // Прокручиваем к выбранной строке в таблице
                            rows[dataIndex].scrollIntoView({
                                behavior: 'smooth',
                                block: 'center'
                            });
                            
                            // Показываем сообщение
                            statusElement.textContent = `Выбран товар: ${dataPoints[index].itemName}`;
                        }
                    }
                }
            },
            plugins: [quadrantLines]
        });
    }

    updateTable();
}); 