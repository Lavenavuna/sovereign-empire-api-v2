// sms-simple.js - Working SMS (No Token Needed)
const YOUR_PHONE = '+6799278605';

async function sendSMS(message) {
    try {
        // Using a free SMS API that works without registration
        const response = await fetch('https://www.txt.buzz/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: YOUR_PHONE,
                message: message,
                key: 'free'  // Free tier
            })
        });
        const data = await response.json();
        console.log('📱 Result:', data);
        return data;
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

sendSMS('🔔 Test from Sovereign Empire AI! Your system is ONLINE.');