import { IconService } from './services/IconService.js';
import { DataService } from './services/DataService.js';
import { UIService } from './services/UIService.js';
import { APP_CONFIG, LOCATIONS, TAX_RATES, QUALITY_NAMES, ICON_CONFIG, UI_CONFIG, STORAGE_KEYS } from './constants.js';

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

            this.uiService.updateSortIndicators();

            this.uiService.showLoading(true);

            this.initPageAnimations();

            setTimeout(() => {
                this.uiService.fetchData();
            }, APP_CONFIG.INITIAL_DATA_FETCH_DELAY);
        } catch (error) {
            console.error('Ошибка инициализации приложения:', error);
            alert('Не удалось инициализировать приложение. Пожалуйста, перезагрузите страницу.');
        }
    }

    initPageAnimations() {
        gsap.from('h1', { opacity: 0, y: -20, duration: 0.8, ease: "power2.out" });

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

        gsap.from('#analyzer-table-container', {
            opacity: 0,
            scale: 0.95,
            duration: 0.6,
            delay: 0.4,
            ease: "power2.out"
        });

        document.querySelectorAll('button, select, input').forEach(element => {
            element.classList.add('animated-transition');
        });
    }
}

// Инициализация выпадающих списков локаций
function initLocationSelects() {
    const fromLocationSelect = document.getElementById('from-location');
    const toLocationSelect = document.getElementById('to-location');
    
    // Очищаем существующие опции
    fromLocationSelect.innerHTML = '';
    toLocationSelect.innerHTML = '';
    
    // Заполняем селект "Откуда" только городами
    LOCATIONS.getCities().forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        fromLocationSelect.appendChild(option);
    });
    
    // Заполняем селект "Куда" всеми локациями
    LOCATIONS.getAllLocations().forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        toLocationSelect.appendChild(option);
    });
    
    // Установка Black Market как значения по умолчанию для "Куда"
    toLocationSelect.value = LOCATIONS.BLACK_MARKET;
}

document.addEventListener('DOMContentLoaded', () => {
    initLocationSelects();
    
    const app = new App();
    app.init();
});