/**
 * RABTA Website Analyzer
 * Analyzes pakrailways.gov.pk structure to understand how to scrape data
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function analyzeRABTA() {
    console.log('🔍 Analyzing Pakistan Railways RABTA system...\n');
    
    const browser = await puppeteer.launch({
        headless: false, // Show browser for debugging
        args: ['--no-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    try {
        console.log('📥 Loading pakrailways.gov.pk...');
        await page.goto('https://www.pakrailways.gov.pk', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        console.log('✅ Page loaded\n');
        
        // Wait for dynamic content
        await page.waitForTimeout(5000);
        
        // Extract page structure
        const pageInfo = await page.evaluate(() => {
            const info = {
                title: document.title,
                url: window.location.href,
                
                // Find navigation links
                navLinks: Array.from(document.querySelectorAll('nav a, .menu a, .navbar a')).map(a => ({
                    text: a.textContent.trim(),
                    href: a.href
                })),
                
                // Find forms (for train search)
                forms: Array.from(document.querySelectorAll('form')).map((form, idx) => ({
                    index: idx,
                    action: form.action,
                    method: form.method,
                    inputs: Array.from(form.querySelectorAll('input, select')).map(input => ({
                        name: input.name,
                        type: input.type || input.tagName.toLowerCase(),
                        id: input.id,
                        placeholder: input.placeholder
                    }))
                })),
                
                // Find tables (potential schedule data)
                tables: Array.from(document.querySelectorAll('table')).map((table, idx) => ({
                    index: idx,
                    rows: table.querySelectorAll('tr').length,
                    headers: Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim())
                })),
                
                // Find schedule-related elements
                scheduleElements: {
                    trainSelects: Array.from(document.querySelectorAll('select')).map(select => ({
                        name: select.name,
                        id: select.id,
                        optionsCount: select.options.length,
                        firstOptions: Array.from(select.options).slice(0, 5).map(opt => opt.textContent.trim())
                    })),
                    
                    buttons: Array.from(document.querySelectorAll('button, input[type="submit"]')).map(btn => ({
                        text: btn.textContent || btn.value,
                        id: btn.id,
                        class: btn.className
                    }))
                },
                
                // Check for RABTA system
                rabta: {
                    found: !!document.querySelector('[class*="rabta"], [id*="rabta"]'),
                    elements: Array.from(document.querySelectorAll('[class*="rabta"], [id*="rabta"]')).length
                },
                
                // Find API calls (check network requests)
                scripts: Array.from(document.querySelectorAll('script[src]')).map(s => s.src)
            };
            
            return info;
        });
        
        console.log('📊 ANALYSIS RESULTS:\n');
        console.log('═══════════════════════════════════════════════════\n');
        
        console.log(`📄 Page Title: ${pageInfo.title}`);
        console.log(`🔗 URL: ${pageInfo.url}\n`);
        
        console.log(`📍 Navigation Links (${pageInfo.navLinks.length}):`);
        pageInfo.navLinks.forEach(link => {
            console.log(`  - ${link.text}: ${link.href}`);
        });
        console.log('');
        
        console.log(`📝 Forms Found: ${pageInfo.forms.length}`);
        pageInfo.forms.forEach(form => {
            console.log(`  Form ${form.index}: ${form.action || 'No action'} (${form.method})`);
            form.inputs.forEach(input => {
                console.log(`    - ${input.name || input.id}: ${input.type}`);
            });
        });
        console.log('');
        
        console.log(`📊 Tables Found: ${pageInfo.tables.length}`);
        pageInfo.tables.forEach(table => {
            console.log(`  Table ${table.index}: ${table.rows} rows`);
            if (table.headers.length > 0) {
                console.log(`    Headers: ${table.headers.join(', ')}`);
            }
        });
        console.log('');
        
        console.log(`🔍 RABTA System: ${pageInfo.rabta.found ? 'FOUND ✅' : 'NOT FOUND ❌'}`);
        console.log(`   Elements: ${pageInfo.rabta.elements}\n`);
        
        console.log(`🎛️ Dropdown Selects (${pageInfo.scheduleElements.trainSelects.length}):`);
        pageInfo.scheduleElements.trainSelects.forEach(select => {
            console.log(`  - ${select.name || select.id} (${select.optionsCount} options)`);
            console.log(`    First 5: ${select.firstOptions.join(', ')}`);
        });
        console.log('');
        
        // Save analysis to file
        await fs.writeFile(
            'rabta-analysis.json',
            JSON.stringify(pageInfo, null, 2)
        );
        console.log('💾 Full analysis saved to: rabta-analysis.json\n');
        
        // Take screenshot
        await page.screenshot({
            path: 'rabta-screenshot.png',
            fullPage: true
        });
        console.log('📸 Screenshot saved to: rabta-screenshot.png\n');
        
        console.log('═══════════════════════════════════════════════════');
        console.log('\n✅ Analysis complete!');
        console.log('\n💡 Next steps:');
        console.log('   1. Check rabta-screenshot.png to see the page');
        console.log('   2. Review rabta-analysis.json for structure details');
        console.log('   3. Update pakrailways-scraper.js based on findings\n');
        
        // Keep browser open for 30 seconds so you can inspect
        console.log('🔍 Browser will stay open for 30 seconds for manual inspection...');
        await page.waitForTimeout(30000);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await browser.close();
        console.log('🔒 Browser closed');
    }
}

// Run analyzer
analyzeRABTA().catch(console.error);

