/**
 * Pakistan Railways RABTA System Web Scraper
 * Extracts train schedules from pakrailways.gov.pk and saves to JSON
 * 
 * Usage:
 *   node pakrailways-scraper.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class PakRailwaysScraper {
    constructor() {
        this.baseUrl = 'https://www.pakrailways.gov.pk';
        this.outputDir = path.join(__dirname, '../public/data');
        this.browser = null;
        this.page = null;
    }

    /**
     * Initialize browser
     */
    async init() {
        console.log('🚂 Initializing Pakistan Railways Scraper...');
        this.browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();
        
        // Set user agent to avoid blocking
        await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
        
        console.log('✅ Browser initialized');
    }

    /**
     * Scrape all train schedules from RABTA system
     */
    async scrapeTrainSchedules() {
        console.log('📥 Navigating to RABTA system...');
        
        try {
            await this.page.goto(this.baseUrl, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // Wait for page to load
            await this.page.waitForTimeout(3000);

            // Take screenshot for debugging
            await this.page.screenshot({ path: 'rabta-homepage.png' });
            console.log('📸 Screenshot saved: rabta-homepage.png');

            // Try to find train schedule links or data
            const trainData = await this.page.evaluate(() => {
                // This will need to be customized based on RABTA's actual structure
                const trains = [];
                
                // Example: Look for train schedule tables
                const tables = document.querySelectorAll('table');
                tables.forEach(table => {
                    const rows = table.querySelectorAll('tr');
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length > 0) {
                            // Extract train info - customize based on actual HTML
                            const trainInfo = {
                                number: cells[0]?.textContent?.trim(),
                                name: cells[1]?.textContent?.trim(),
                                // Add more fields as needed
                            };
                            if (trainInfo.number) {
                                trains.push(trainInfo);
                            }
                        }
                    });
                });

                return trains;
            });

            console.log(`✅ Found ${trainData.length} trains`);
            return trainData;

        } catch (error) {
            console.error('❌ Error scraping train schedules:', error.message);
            throw error;
        }
    }

    /**
     * Scrape station list
     */
    async scrapeStations() {
        console.log('📥 Scraping station list...');
        
        try {
            const stations = await this.page.evaluate(() => {
                const stationElements = document.querySelectorAll('select[name*="station"] option, .station-name');
                const stationList = [];
                
                stationElements.forEach(element => {
                    const stationName = element.textContent?.trim();
                    if (stationName && stationName.length > 0) {
                        stationList.push({
                            name: stationName,
                            // Add more fields like code, coordinates if available
                        });
                    }
                });

                return [...new Set(stationList.map(s => JSON.stringify(s)))].map(s => JSON.parse(s));
            });

            console.log(`✅ Found ${stations.length} stations`);
            return stations;

        } catch (error) {
            console.error('❌ Error scraping stations:', error.message);
            return [];
        }
    }

    /**
     * Save data to JSON file
     */
    async saveToJSON(data, filename) {
        const filePath = path.join(this.outputDir, filename);
        
        try {
            // Ensure directory exists
            await fs.mkdir(this.outputDir, { recursive: true });
            
            // Add metadata
            const output = {
                lastUpdated: new Date().toISOString(),
                source: 'pakrailways.gov.pk',
                dataCount: data.length,
                data: data
            };
            
            await fs.writeFile(filePath, JSON.stringify(output, null, 2), 'utf8');
            console.log(`✅ Saved ${data.length} items to ${filename}`);
            
        } catch (error) {
            console.error(`❌ Error saving ${filename}:`, error.message);
        }
    }

    /**
     * Analyze page structure (for development)
     */
    async analyzePage() {
        console.log('🔍 Analyzing page structure...');
        
        const analysis = await this.page.evaluate(() => {
            return {
                title: document.title,
                forms: document.querySelectorAll('form').length,
                tables: document.querySelectorAll('table').length,
                selects: document.querySelectorAll('select').length,
                links: document.querySelectorAll('a').length,
                
                // Find potential schedule elements
                scheduleElements: {
                    trainNumbers: document.querySelectorAll('[class*="train"], [id*="train"]').length,
                    timeElements: document.querySelectorAll('[class*="time"], [id*="time"]').length,
                    stationElements: document.querySelectorAll('[class*="station"], [id*="station"]').length,
                }
            };
        });

        console.log('📊 Page Analysis:', JSON.stringify(analysis, null, 2));
        return analysis;
    }

    /**
     * Main scraping workflow
     */
    async run() {
        try {
            await this.init();
            
            // First, analyze the page structure
            await this.analyzePage();
            
            // Scrape stations
            const stations = await this.scrapeStations();
            if (stations.length > 0) {
                await this.saveToJSON(stations, 'scraped-stations.json');
            }
            
            // Scrape train schedules
            const trains = await this.scrapeTrainSchedules();
            if (trains.length > 0) {
                await this.saveToJSON(trains, 'scraped-trains.json');
            }
            
            console.log('✅ Scraping completed successfully!');
            
        } catch (error) {
            console.error('❌ Scraping failed:', error);
        } finally {
            if (this.browser) {
                await this.browser.close();
                console.log('🔒 Browser closed');
            }
        }
    }
}

// Run scraper
if (require.main === module) {
    const scraper = new PakRailwaysScraper();
    scraper.run().catch(console.error);
}

module.exports = PakRailwaysScraper;

