// Константы приложения

// Основные настройки приложения
export const APP_CONFIG = {
    INITIAL_DATA_FETCH_DELAY: 1000 // Задержка перед начальной загрузкой данных
};

// Константы для работы с API
export const API_CONFIG = {
    MARKET_API_URL: 'https://albion-profit-calculator.com/api', // URL для API рынка
    DATA_API_URL: 'https://europe.albion-online-data.com/api/v2', // URL для API данных
    SERVER_ID: 'aod_europe', // ID сервера
    LOCALIZATION_KEY: 'RU-RU', // Ключ локализации
    TIME_CONSTANTS: {
        MINUTE_MS: 60000, // Миллисекунды в минуте
        HOUR_MS: 3600000, // Миллисекунды в часе
        DAY_MS: 86400000, // Миллисекунды в дне
        WEEK_MS: 604800000 // Миллисекунды в неделе
    }
};

// Налоговые ставки
export const TAX_RATES = {
    MARKET_FEE: 0.025, // Сбор за размещение заказов (2.5%)
    NORMAL_SALES_TAX: 0.08, // Налог с продаж для обычных игроков (8%)
    PREMIUM_SALES_TAX: 0.04 // Налог с продаж для премиум-игроков (4%)
};

// Качество предметов
export const QUALITY_NAMES = {
    1: 'Обычное',
    2: 'Хорошее',
    3: 'Выдающееся',
    4: 'Отличное',
    5: 'Шедевр'
};

// Настройки для работы с иконками
export const ICON_CONFIG = {
    ICON_BASE_URL: 'https://albion-profit-calculator.com/images/items', // Базовый URL для иконок
    DB_NAME: 'AlbionIconsCache', // Имя базы данных IndexedDB
    DB_VERSION: 1, // Версия базы данных
    STORE_NAME: 'icons', // Имя хранилища в базе данных
    BLANK_IMAGE: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', // Пустое изображение для ошибок
    ANIMATION: {
        TOOLTIP_DURATION: 0.3, // Длительность анимации всплывающих подсказок
        TOOLTIP_DELAY: 1 // Задержка перед скрытием всплывающей подсказки
    }
};

// Настройки интерфейса
export const UI_CONFIG = {
    BUTTON_HOVER_SCALE: 1.05, // Масштаб кнопки при наведении
    BUTTON_PRESSED_SCALE: 0.95, // Масштаб кнопки при нажатии
    CHART_BUTTON_HOVER_SCALE: 1.2, // Масштаб кнопки графика при наведении
    ITEM_ICON_HOVER_SCALE: 1.1, // Масштаб иконки предмета при наведении
    ANIMATION: {
        BUTTON_HOVER_DURATION: 0.1, // Длительность анимации наведения на кнопку
        BUTTON_PRESS_DURATION: 0.08, // Длительность анимации нажатия на кнопку
        TABLE_ROW_DURATION: 0.2, // Длительность анимации строки таблицы
        TABLE_ROW_STAGGER: 0.03, // Задержка между анимациями строк таблицы
        TABLE_DURATION: 0.3, // Длительность анимации таблицы
        LOADING_DURATION: 0.3, // Длительность анимации загрузки
        MODAL_DURATION: 0.4, // Длительность анимации модального окна
        RATING_ITEM_DURATION: 0.3, // Длительность анимации элемента рейтинга
        RATING_ITEM_STAGGER: 0.02, // Задержка между анимациями элементов рейтинга
        CHART_BUTTON_DURATION: 0.2, // Длительность анимации кнопки графика
        ITEM_ICON_DURATION: 0.2, // Длительность анимации иконки предмета
        ROW_HIGHLIGHT_DURATION: 10, // Длительность подсветки строки
        SCROLL_DELAY: 300, // Задержка перед прокруткой к элементу
        FILTER_DURATION: 0.3 // Длительность анимации фильтрации
    },
    TIME_CONSTANTS: {
        DAY_MS: 86400000 // Миллисекунды в дне
    }
};

// Ключи для localStorage
export const STORAGE_KEYS = {
    FILTERS: 'albionFilters', // Ключ для хранения фильтров
    HISTORY_LOCATION: 'albionHistoryLocation', // Ключ для хранения выбранной локации в истории цен
    SHOW_LAST_DAY_ONLY: 'albionShowLastDayOnly' // Ключ для хранения настройки "Показывать только за последние 24 часа"
}; 