// ==UserScript==
// @name         Albion Profit Calculator - Экспорт в JSON
// @namespace    https://albion-profit-calculator.com/
// @version      0.1
// @description  Добавляет кнопку для экспорта данных в JSON формат
// @author       You
// @match        https://albion-profit-calculator.com/ru/transportations
// @match        https://albion-profit-calculator.com/ru/transportations*
// @match        https://albion-profit-calculator.com/en/transportations
// @match        https://albion-profit-calculator.com/en/transportations*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Функция для парсинга данных из элементов items
    function parseItems() {
        const itemWrappers = document.querySelectorAll('.items .wrapper');
        const items = [];

        itemWrappers.forEach(wrapper => {
            // Получаем данные из элемента
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
            
            // Очистка данных от пробелов и лишних символов
            const cleanNumberString = (str) => {
                if (!str) return null;
                return str.replace(/[^\d.,]/g, '').replace(/,/g, '.');
            };

            // Собираем объект с данными
            const item = {
                title: titleElement?.textContent.trim() || 'Неизвестно',
                image: imageElement?.src || '',
                buyPrice: cleanNumberString(buyPriceElement?.textContent) || '0',
                buyTimeAgo: buyDateElement?.textContent.trim() || '',
                sellPrice: cleanNumberString(sellPriceElement?.textContent) || '0',
                sellTimeAgo: sellDateElement?.textContent.trim() || '',
                fromLocation: buyLocation || 'Неизвестно',
                toLocation: sellLocation || 'Неизвестно',
                profit: cleanNumberString(profitElement?.textContent) || '0',
                profitPercent: profitPercentElement ? cleanNumberString(profitPercentElement.textContent) : '0',
                soldPerDay: soldPerDayElement ? cleanNumberString(soldPerDayElement.textContent) : '0'
            };
            
            items.push(item);
        });

        return items;
    }

    // Функция для создания и добавления кнопки экспорта
    function addExportButton() {
        const navBar = document.querySelector('.navbar-nav') || document.body;
        
        const exportButton = document.createElement('button');
        exportButton.textContent = 'Экспорт в JSON';
        exportButton.style.cssText = `
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
        
        exportButton.addEventListener('click', exportToJson);
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'margin: 10px; text-align: center;';
        buttonContainer.appendChild(exportButton);
        
        // Вставляем кнопку в начало страницы
        const container = document.querySelector('.container') || document.body;
        container.insertBefore(buttonContainer, container.firstChild);
    }

    // Функция для экспорта данных в JSON файл
    function exportToJson() {
        const items = parseItems();
        const jsonData = JSON.stringify(items, null, 2);
        
        // Создаем объект Blob для JSON данных
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Создаем ссылку для скачивания и имитируем клик по ней
        const a = document.createElement('a');
        a.href = url;
        a.download = `albion-market-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Очищаем ресурсы
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    // Добавляем кнопку после загрузки страницы
    window.addEventListener('load', () => {
        // Небольшая задержка для уверенности, что страница полностью загружена
        setTimeout(addExportButton, 1000);
    });
})(); 