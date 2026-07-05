// sms-test.js - Simple SMS Test
import fetch from 'node-fetch';

const YOUR_PHONE = '+6799278605';

async function sendSMS() {
    console.log('📱 Sending test SMS...');
    
    try {
        const response = await fetch('https://textbelt.com/text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: YOUR_PHONE,
                message: '🔔 Test from Sovereign Empire AI: Your notifications are working! 🚀',
                key: 'textbelt'
            })
        });
        
        const data = await response.json();
        console.log('📱 Response:', data);
        
        if (data.success) {
            console.log('✅ SMS sent to your iPhone!');
            console.log('📱 Remaining: ' + data.quotaRemaining + ' messages');
        } else {
            console.log('❌ Failed:', data.error);
            console.log('💡 Free limit: 1 SMS per day');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('💡 Make sure you have internet connection');
    }
}

sendSMS();