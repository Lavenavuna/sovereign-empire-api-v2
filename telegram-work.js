// telegram-work.js
const TOKEN = "8946677849:AAEVQ1S7HdvgvTXL8eaouE1dcSX0Cn0E9bc";
const CHAT_ID = "6043840841";

async function sendTelegram(message) {
    const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
    console.log('📤 Sending...');
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            })
        });
        const result = await response.json();
        console.log('📱 Result:', result);
        return result;
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

sendTelegram('🔔 *Sovereign Empire AI Test!*\n\n✅ Your Telegram notifications are working!');