// email-notify.js - Email Notifications
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'your-email@gmail.com',
        pass: 'your-app-password'
    }
});

async function sendEmail(message) {
    await transporter.sendMail({
        from: 'your-email@gmail.com',
        to: '6799278605@vodafone.com.fj',
        subject: 'Sovereign Empire AI Alert',
        text: message
    });
    console.log('✅ Email sent!');
}

sendEmail('Test from Sovereign Empire AI!');