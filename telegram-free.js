// telegram-free.js - FREE Unlimited Notifications
const TELEGRAM_BOT_TOKEN = "8946677849:AAHF7pkot4ssgIyXVkwpAwokOhICWIkkI50";  // Get from @BotFather
const TELEGRAM_CHAT_ID = "YOUR_CHAT_ID";      // Get from /getUpdates

async function sendTelegram(message) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            })
        });
        const result = await response.json();
        if (result.ok) {
            console.log('✅ Telegram sent!');
        } else {
            console.error('❌ Error:', result.description);
        }
        return result;
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// ============================================
// TEST
// ============================================
async function testTelegram() {
    console.log('📱 Sending test to Telegram...');
    await sendTelegram(
        `🔔 *Sovereign Empire AI Test*\n\n` +
        `✅ Your FREE Telegram notifications are working!\n` +
        `📅 ${new Date().toLocaleString()}\n\n` +
        `🚀 System: ONLINE\n` +
        `🤖 Agents: 18 Active\n\n` +
        `📊 Dashboard: sovereign-empire-api-v2-production.up.railway.app/dashboard`
    );
}

// Run test
if (import.meta.url === `file://${process.argv[1]}`) {
    testTelegram();
}

export { sendTelegram, testTelegram };