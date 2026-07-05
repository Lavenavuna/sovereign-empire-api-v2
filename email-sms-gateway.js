// email-sms-gateway.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com',
        pass: 'your-app-password'
    }
});

transporter.sendMail({
    from: 'your-email@gmail.com',
    to: '6799278605@vodafone.com.fj',
    subject: 'Sovereign Empire AI Alert',
    text: '🔔 Test from Sovereign Empire AI!'
}).then(() => console.log('✅ SMS sent!')).catch(console.error);