export class DataService {
    constructor() {
        this.itemsData = [];
        this.data = [];
        this.filteredData = [];
        this.isPremiumTaxEnabled = false;
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
            
            // Базовая разница (без учета налогов)
            const profit = sellPrice - buyPrice;
            const profitPercent = buyPrice > 0 ? (profit / buyPrice) * 100 : 0;
            const soldPerDay = toItem.averageItems || 0;

            // Расчет прибыли с учетом налогов
            
            // Сбор за размещение заказов (всегда 2.5% при покупке и продаже)
            const sellOrderFee = Math.ceil(sellPrice * 0.025);
            const buyOrderFee = Math.ceil(buyPrice * 0.025);
            
            // Налог с продаж (8% для обычных игроков, 4% для премиум-игроков)
            const salesTax = Math.ceil(sellPrice * (this.isPremiumTaxEnabled ? 0.04 : 0.08));
            
            // Итоговая прибыль
            const itemProfit = sellPrice - sellOrderFee - salesTax - buyPrice - buyOrderFee;
            const itemProfitPercent = buyPrice > 0 ? (itemProfit / buyPrice) * 100 : 0;

            return {
                itemId: fromItem.itemId,
                itemName: this.getItemName(fromItem.itemId),
                quality: fromItem.quality,
                buyPrice: buyPrice,
                sellPrice: sellPrice,
                itemProfit: itemProfit,
                itemProfitPercent: itemProfitPercent,
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
            return item.itemProfit >= minProfit &&
                item.itemProfitPercent >= minProfitPercent &&
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

    getQualityName(quality) {
        const qualityNames = {
            1: 'Обычное',
            2: 'Хорошее',
            3: 'Выдающееся',
            4: 'Отличное',
            5: 'Шедевр'
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

    async getPriceHistory(itemId, location) {
        // Запрашиваем историю цен для всех квант без фильтрации
        const url = `https://europe.albion-online-data.com/api/v2/stats/history/${itemId}?locations=${encodeURIComponent(location)}`;
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }
            
            // Теперь возвращаем все данные без фильтрации по качеству
            return await response.json();
        } catch (error) {
            console.error('Ошибка при получении истории цен:', error);
            throw error;
        }
    }
    
    async getCurrentPrices(itemId, location) {
        // Запрашиваем текущие цены для всех квант
        const url = `https://europe.albion-online-data.com/api/v2/stats/prices/${itemId}?locations=${encodeURIComponent(location)}`;
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Фильтруем только по указанной локации
            return data.filter(item => 
                item.city.toLowerCase() === location.toLowerCase() || 
                (location === 'Black Market' && item.city === 'Black Market')
            );
        } catch (error) {
            console.error('Ошибка при получении текущих цен:', error);
            throw error;
        }
    }

    calculatePriceStats(historyData) {
        if (!historyData || !historyData[0] || !historyData[0].data || historyData[0].data.length === 0) {
            return {
                minPrice: 0,
                maxPrice: 0,
                avgPrice: 0,
                totalSales: 0
            };
        }
        
        let totalCount = 0;
        let totalValue = 0;
        let minPrice = Number.MAX_VALUE;
        let maxPrice = 0;
        
        historyData[0].data.forEach(item => {
            if (item.avg_price < minPrice && item.avg_price > 0) {
                minPrice = item.avg_price;
            }
            
            if (item.avg_price > maxPrice) {
                maxPrice = item.avg_price;
            }
            
            totalCount += item.item_count;
            totalValue += item.avg_price * item.item_count;
        });
        
        const avgPrice = totalCount > 0 ? Math.floor(totalValue / totalCount) : 0;
        
        return {
            minPrice: minPrice === Number.MAX_VALUE ? 0 : minPrice,
            maxPrice,
            avgPrice,
            totalSales: totalCount
        };
    }

    calculateTotalSales(historyData) {
        if (!historyData || historyData.length === 0) {
            return { total: 0, last24h: 0 };
        }
        
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        let totalSales = 0;
        let last24hSales = 0;
        
        historyData.forEach(qualityData => {
            if (qualityData.data && qualityData.data.length) {
                qualityData.data.forEach(point => {
                    totalSales += point.item_count;
                    
                    const pointDate = new Date(point.timestamp);
                    if (pointDate >= oneDayAgo) {
                        last24hSales += point.item_count;
                    }
                });
            }
        });
        
        return { total: totalSales, last24h: last24hSales };
    }
} 