import { API_CONFIG, TAX_RATES, QUALITY_NAMES } from '../constants.js';

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

        if (item && item.LocalizedNames && item.LocalizedNames[API_CONFIG.LOCALIZATION_KEY]) {
            return item.LocalizedNames[API_CONFIG.LOCALIZATION_KEY];
        }

        return uniqueName;
    }

    async fetchMarketData(fromLocation, toLocation, itemsCount, sortType) {
        if (fromLocation === toLocation) {
            throw new Error('Выберите разные локации для отправления и получения');
        }

        const url = `${API_CONFIG.MARKET_API_URL}/transportations/sort?from=${encodeURIComponent(fromLocation)}&to=${encodeURIComponent(toLocation)}&count=${itemsCount}&skip=0&sort=BY_LAST_TIME_CHECKED,${sortType}&serverId=${API_CONFIG.SERVER_ID}`;

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
            
            // Сбор за размещение заказов
            const sellOrderFee = Math.ceil(sellPrice * TAX_RATES.MARKET_FEE);
            const buyOrderFee = Math.ceil(buyPrice * TAX_RATES.MARKET_FEE);
            
            // Налог с продаж
            const salesTax = Math.ceil(sellPrice * (this.isPremiumTaxEnabled ? TAX_RATES.PREMIUM_SALES_TAX : TAX_RATES.NORMAL_SALES_TAX));
            
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

        if (diff < API_CONFIG.TIME_CONSTANTS.DAY_MS) {
            const hours = Math.floor(diff / API_CONFIG.TIME_CONSTANTS.HOUR_MS);
            if (hours < 1) {
                const minutes = Math.floor(diff / API_CONFIG.TIME_CONSTANTS.MINUTE_MS);
                return `${minutes} мин. назад`;
            }
            return `${hours} ч. назад`;
        }

        if (diff < API_CONFIG.TIME_CONSTANTS.WEEK_MS) {
            const days = Math.floor(diff / API_CONFIG.TIME_CONSTANTS.DAY_MS);
            return `${days} дн. назад`;
        }

        return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
    }

    getQualityName(quality) {
        return QUALITY_NAMES[quality] || 'Неизвестно';
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
        const url = `${API_CONFIG.DATA_API_URL}/stats/history/${itemId}?locations=${encodeURIComponent(location)}`;
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка при получении истории цен:', error);
            throw error;
        }
    }
    
    async getCurrentPrices(itemId, location) {
        const url = `${API_CONFIG.DATA_API_URL}/stats/prices/${itemId}?locations=${encodeURIComponent(location)}`;
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }
            
            const data = await response.json();
            
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
        const oneDayAgo = new Date(now.getTime() - API_CONFIG.TIME_CONSTANTS.DAY_MS);
        
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