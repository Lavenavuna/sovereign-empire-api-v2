// sms-work.js - Working SMS with TextBelt
import fetch from 'node-fetch';

const YOUR_PHONE = '+6799278605';
const SMS_API = 'https://textbelt.com/text';

async function sendSMS(message) {
    console.log('📱 Sending SMS...');
    try {
        const response = await fetch(SMS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: YOUR_PHONE,
                message: message,
                key: 'textbelt'
            })
        });
        const data = await response.json();
        console.log('📱 Result:', data);
        
        if (data.success) {
            console.log('✅ SMS sent to your iPhone!');
            console.log('📱 Remaining:', data.quotaRemaining);
        } else {
            console.log('❌ Error:', data.error);
            console.log('💡 Free limit: 1 SMS per day. Try again tomorrow.');
        }
        return data;
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Send test message
sendSMS('🔔 Test from Sovereign Empire AI! Your notifications are working!');