// email.js - Working Gmail Email
import nodemailer from 'nodemailer';

// 🔑 REPLACE WITH YOUR REAL GMAIL DETAILS
const YOUR_EMAIL = "sretonia@gmail.com";        // Your Gmail address
const YOUR_PASSWORD = "trxtiqujjktpvtie"; // Your ACTUAL Gmail password
const YOUR_PHONE = "6799278605";

// Carrier SMS gateways
const CARRIERS = [
    `${YOUR_PHONE}@vodafone.com.fj`,
    `${YOUR_PHONE}@digicel.com.fj`,
    `${YOUR_PHONE}@tfl.com.fj`
];

async function sendEmail(to, subject, message) {
    try {
        console.log(`📧 Sending to: ${to}`);
        
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: YOUR_EMAIL,
                pass: YOUR_PASSWORD
            }
        });

        const info = await transporter.sendMail({
            from: YOUR_EMAIL,
            to: to,
            subject: subject,
            text: message
        });

        console.log(`✅ Sent to ${to}`);
        return { success: true };
    } catch (error) {
        console.error(`❌ Error:`, error.message);
        return { success: false, error: error.message };
    }
}

async function test() {
    console.log('\n📧 Sending test...');
    console.log('='.repeat(40));
    
    const message = 
        '🔔 Sovereign Empire AI Test\n\n' +
        '✅ Your email notifications are working!\n' +
        `📅 ${new Date().toLocaleString()}\n` +
        '🤖 System: ONLINE\n' +
        '🚀 18 Agents Active';
    
    for (const carrier of CARRIERS) {
        const result = await sendEmail(carrier, 'Sovereign Empire AI Alert', message);
        if (result.success) {
            console.log(`\n✅ SMS sent to your phone via ${carrier}`);
            return;
        }
    }
    
    console.log('\n❌ All carriers failed. Try a different carrier.');
}

test();