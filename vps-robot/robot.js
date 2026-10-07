import puppeteer from 'puppeteer';

const EMAIL = process.env.ROBOT_EMAIL || 'contact@whimlets.com';
const PASSWORD = process.env.ROBOT_PASSWORD || '';
const BOT_MODE = process.env.ROBOT_MODE || 'auto'; // 'auto' (activ dupa ora 18:00) sau 'on' (activ mereu)
const TARGET_URL = process.env.ROBOT_URL || 'https://comenzi.whimlets.com';

async function run() {
    console.log('====================================================');
    console.log('🤖 [Whimlets VPS] Pornire Robot Apeluri 24/7');
    console.log(`🌐 URL:  ${TARGET_URL}`);
    console.log(`📧 User: ${EMAIL}`);
    console.log(`⚙️ Mod:  ${BOT_MODE === 'auto' ? 'Automat (după 18:00 și weekend)' : 'Forțat ON'}`);
    console.log('====================================================');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--autoplay-policy=no-user-gesture-required',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        const context = browser.defaultBrowserContext();
        await context.overridePermissions(TARGET_URL, ['microphone']);
    } catch (e) {}

    // Stream browser logs to VPS console with timestamps
    page.on('console', msg => {
        const text = msg.text();
        if (
            text.includes('[SIP]') ||
            text.includes('[DIDLogic]') ||
            text.includes('[ROBOT]') ||
            text.includes('APEL') ||
            text.includes('Preluare') ||
            text.includes('Răspund') ||
            text.includes('încheiat')
        ) {
            const time = new Date().toLocaleTimeString('ro-RO', { hour12: false });
            console.log(`[${time}] ${text}`);
        }
    });

    page.on('error', err => console.error('❌ [Page Error]:', err));
    page.on('pageerror', err => console.error('❌ [Script Error]:', err));

    console.log('⏳ Conectare la platformă...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // Check if login form is present
    await page.waitForTimeout ? page.waitForTimeout(2000) : new Promise(r => setTimeout(r, 2000));
    const emailInput = await page.$('input[type="email"]');
    
    if (emailInput && PASSWORD) {
        console.log('🔐 Formular de login detectat. Autentificare în curs...');
        await page.type('input[type="email"]', EMAIL);
        await page.type('input[type="password"]', PASSWORD);
        await page.click('button[type="submit"]');
        await (page.waitForTimeout ? page.waitForTimeout(3000) : new Promise(r => setTimeout(r, 3000)));
        console.log('✅ Autentificare realizată!');
    }

    // Configure robot mode in page's localStorage
    await page.evaluate((mode) => {
        localStorage.setItem('after_hours_bot_mode', mode);
        localStorage.setItem('__whimlets_vps_robot', 'true');  // marks this browser as the VPS robot
        window.dispatchEvent(new CustomEvent('after_hours_bot_mode_changed', { detail: mode }));
    }, BOT_MODE);

    console.log('🟢 Robotul este CONECTAT și monitorizează apelurile 24/7!');
    console.log('ℹ️ Dacă un client sună în afara orelor de program, apelul va fi preluat automat.');

    // Keep process alive and verify connectivity every 5 minutes
    setInterval(async () => {
        try {
            await page.evaluate(() => {
                // Keep WebRTC socket warm
                if (window.dispatchEvent) {
                    window.dispatchEvent(new Event('focus'));
                }
            });
        } catch (e) {}
    }, 300000);
}

run().catch(err => {
    console.error('Eroare fatală la rulare robot:', err);
    process.exit(1);
});
