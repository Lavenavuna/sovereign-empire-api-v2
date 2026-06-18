// email-server.js - Email and Scheduling Backend
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import cron from 'node-cron';
import { AgentExecutor } from './platform/config/AgentDNA.js';

const app = express();
const PORT = process.env.EMAIL_PORT || 8081;

app.use(cors());
app.use(express.json());

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

// Store scheduled jobs
const scheduledJobs = {};

// ============================================
// SCHEDULE ENDPOINTS
// ============================================

// Get all schedules
app.get('/api/schedules', (req, res) => {
    res.json({
        schedules: [
            { id: 'daily-report', name: 'Daily Report', time: '9:00 AM', enabled: true },
            { id: 'revenue-report', name: 'Revenue Report', time: '6:00 PM', enabled: false },
            { id: 'competitor-analysis', name: 'Competitor Analysis', time: '8:00 AM', enabled: true },
            { id: 'customer-feedback', name: 'Customer Feedback', time: '2:00 PM', enabled: true }
        ]
    });
});

// Create schedule
app.post('/api/schedules', (req, res) => {
    const { name, time, agent, query } = req.body;
    // In production, save to database
    res.json({ success: true, message: 'Schedule created' });
});

// ============================================
// EMAIL ENDPOINTS
// ============================================

// Send email
app.post('/api/email/send', async (req, res) => {
    const { to, subject, body } = req.body;
    
    if (!to || !subject || !body) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER || 'your-email@gmail.com',
            to: to,
            subject: subject,
            text: body
        });
        res.json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send report to multiple recipients
app.post('/api/email/report', async (req, res) => {
    const { recipients, report } = req.body;
    
    if (!recipients || !report) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER || 'your-email@gmail.com',
            to: recipients.join(', '),
            subject: '📊 Daily AI Report - ' + new Date().toLocaleDateString(),
            text: report
        });
        res.json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// SCHEDULED JOBS
// ============================================

// Daily report at 9:00 AM
cron.schedule('0 9 * * *', async () => {
    console.log('📊 Running daily report...');
    // Generate and send report logic here
});

// Revenue report at 6:00 PM
cron.schedule('0 18 * * *', async () => {
    console.log('💰 Running revenue report...');
});

// Competitor analysis at 8:00 AM
cron.schedule('0 8 * * *', async () => {
    console.log('📈 Running competitor analysis...');
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`📧 Email & Schedule server running on port ${PORT}`);
});