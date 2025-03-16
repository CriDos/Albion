import { IconService } from './services/IconService.js';
import { DataService } from './services/DataService.js';
import { UIService } from './services/UIService.js';

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
            }, 1000);
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

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});