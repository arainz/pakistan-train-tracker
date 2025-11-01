// Translation Utility Class
class Translator {
    constructor() {
        this.currentLanguage = 'en'; // Default to English
        this.translations = {};
        this.init();
    }

    async init() {
        try {
            const response = await fetch('/translations.json');
            this.translations = await response.json();
            // Load saved language preference
            const savedLang = localStorage.getItem('appLanguage') || 'en';
            this.setLanguage(savedLang);
        } catch (error) {
            console.error('Failed to load translations:', error);
            // Fallback: Use English if translations fail to load
            this.currentLanguage = 'en';
        }
    }

    setLanguage(lang) {
        if (this.translations[lang]) {
            this.currentLanguage = lang;
            localStorage.setItem('appLanguage', lang);
            this.applyLanguage();
            // Dispatch event for other components
            document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
            return true;
        }
        return false;
    }

    getLanguage() {
        return this.currentLanguage;
    }

    t(key, defaultValue = '') {
        // Support nested keys like "train.speed" or "common.active"
        const keys = key.split('.');
        let value = this.translations[this.currentLanguage];
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                // Fallback to English if key not found
                value = this.translations['en'];
                for (const ek of keys) {
                    if (value && typeof value === 'object' && ek in value) {
                        value = value[ek];
                    } else {
                        return defaultValue || key;
                    }
                }
                break;
            }
        }
        
        return typeof value === 'string' ? value : (defaultValue || key);
    }

    // Format number with language-specific formatting (but keep numbers in English)
    formatNumber(num) {
        // Numbers stay in English format regardless of language
        if (num === null || num === undefined || num === '') return '--';
        return String(num);
    }

    // Format time with language-specific labels
    formatTime(minutes) {
        const num = this.formatNumber(minutes);
        if (minutes === 0 || minutes === null || minutes === undefined) {
            return this.t('common.justNow');
        }
        if (minutes < 60) {
            return `${num} ${this.t('time.minutes')} ${this.t('time.ago')}`;
        }
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours < 24) {
            return mins > 0 
                ? `${this.formatNumber(hours)} ${this.t('time.hours')} ${this.formatNumber(mins)} ${this.t('time.minutes')} ${this.t('time.ago')}`
                : `${this.formatNumber(hours)} ${this.t('time.hours')} ${this.t('time.ago')}`;
        }
        const days = Math.floor(hours / 24);
        return `${this.formatNumber(days)} ${this.t('time.days')} ${this.t('time.ago')}`;
    }

    // Apply language to document (LTR for all languages including Urdu)
    applyLanguage() {
        const isUrdu = this.currentLanguage === 'ur';
        document.documentElement.lang = this.currentLanguage;
        document.documentElement.dir = 'ltr'; // Always LTR, even for Urdu
        document.body.classList.toggle('lang-urdu', isUrdu);
        document.body.classList.toggle('lang-english', !isUrdu);
        
        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                el.textContent = this.t(key);
            }
        });
        
        // Update placeholder attributes
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) {
                el.placeholder = this.t(key);
            }
        });
    }

    // Translate a specific element
    translateElement(element, key, attribute = 'textContent') {
        if (element) {
            element[attribute] = this.t(key);
        }
    }

    // Get train name based on current language
    getTrainName(train) {
        if (!train) return '';
        const isUrdu = this.currentLanguage === 'ur';
        if (isUrdu && train.TrainNameUR) {
            return train.TrainNameUR.trim();
        }
        return train.TrainName || train.trainName || '';
    }

    // Get station name based on current language
    getStationName(station) {
        if (!station) return '';
        const isUrdu = this.currentLanguage === 'ur';
        
        // If station has StationNameUR, use it
        if (isUrdu && station.StationNameUR) {
            return station.StationNameUR.trim();
        }
        
        // If Urdu is selected but StationNameUR not in station object, try to look it up from stations data
        if (isUrdu && !station.StationNameUR) {
            const stationName = station.StationName || station.stationName || '';
            if (stationName && window.stationsData && Array.isArray(window.stationsData)) {
                const stationData = window.stationsData.find(s => 
                    s.StationName && (
                        s.StationName.toLowerCase() === stationName.toLowerCase() ||
                        s.StationName.toLowerCase().includes(stationName.toLowerCase()) ||
                        stationName.toLowerCase().includes(s.StationName.toLowerCase())
                    )
                );
                if (stationData && stationData.StationNameUR) {
                    return stationData.StationNameUR.trim();
                }
            }
        }
        
        return station.StationName || station.stationName || '';
    }

    // Get station name from a station name string (searches stations data if available)
    // This is used when we only have a station name string (e.g., from train.NextStation)
    // Synchronous version for use in template literals
    getStationNameFromString(stationNameString) {
        if (!stationNameString) return '';
        
        try {
            // Try to find station in cached stations data
            if (window.stationsData && Array.isArray(window.stationsData)) {
                const station = window.stationsData.find(s => 
                    s.StationName && (
                        s.StationName.toLowerCase() === stationNameString.toLowerCase() ||
                        s.StationName.toLowerCase().includes(stationNameString.toLowerCase()) ||
                        stationNameString.toLowerCase().includes(s.StationName.toLowerCase())
                    )
                );
                if (station) {
                    return this.getStationName(station);
                }
            }
        } catch (error) {
            console.warn('Error finding station for name:', stationNameString, error);
        }
        
        // Fallback: return original string
        return stationNameString;
    }

    // Async version (kept for backward compatibility, but should use synchronous version)
    async getStationNameFromStringAsync(stationNameString) {
        return this.getStationNameFromString(stationNameString);
    }
}

// Create global instance
const translator = new Translator();

