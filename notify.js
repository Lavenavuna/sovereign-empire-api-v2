// notify.js - Simple Notification System
import fetch from 'node-fetch';

// This is a working webhook URL (no token needed)
const WEBHOOK_URL = 'https://api.telegram.org/bot8998866019:AAFx4vhAZnyc7xKsrLquZ7uWcemMDwqqj8k/sendMessage';

async function sendNotification(message) {
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: 'YOUR_CHAT_ID',  // Replace with your chat ID
                text: message,
                parse_mode: 'Markdown'
            })
        });
        const data = await response.json();
        console.log('📱 Result:', data);
        return data;
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Test
sendNotification('🔔 *Test from Sovereign Empire AI!*');