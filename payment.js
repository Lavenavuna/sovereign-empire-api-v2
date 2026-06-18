// payment.js - PayPal Payment Processing
import { core, orders } from '@hyperse/paypal-node-sdk';

// PayPal Configuration
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'YOUR_SANDBOX_CLIENT_ID';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || 'YOUR_SANDBOX_CLIENT_SECRET';

// Use Sandbox for testing, Live for production
const environment = new core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);
const client = new core.PayPalHttpClient(environment);

// Payment Plans
export const PLANS = {
    FREE: {
        id: 'free',
        name: 'Free',
        price: 0,
        features: ['1 agent', '10 requests/day', 'Basic support']
    },
    PRO: {
        id: 'pro',
        name: 'Pro',
        price: 29.99,
        features: ['All 17 agents', '500 requests/day', 'Email support', 'Daily reports']
    },
    BUSINESS: {
        id: 'business',
        name: 'Business',
        price: 99.99,
        features: ['All 17 agents', 'Unlimited requests', 'Priority support', 'Custom agents', 'Team sharing']
    },
    ENTERPRISE: {
        id: 'enterprise',
        name: 'Enterprise',
        price: 499.99,
        features: ['Everything in Business', 'Dedicated support', 'Custom training', 'SLA guarantee', 'White-label']
    }
};

// Create an order
export async function createOrder(planId, userId, userEmail) {
    const plan = PLANS[planId.toUpperCase()];
    if (!plan) {
        throw new Error(`Plan ${planId} not found`);
    }

    const request = new orders.OrdersCreateRequest();
    request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
            amount: {
                currency_code: 'USD',
                value: plan.price.toString()
            },
            description: `${plan.name} Plan - Sovereign Empire AI Platform`,
            custom_id: userId,
            payee: {
                email_address: 'your-holding-email@example.com' // Your holding email
            }
        }],
        application_context: {
            return_url: 'https://your-app.up.railway.app/payment/success',
            cancel_url: 'https://your-app.up.railway.app/payment/cancel'
        }
    });

    const response = await client.execute(request);
    const approvalLink = response.result.links.find(link => link.rel === 'approve');
    
    return {
        orderId: response.result.id,
        approvalUrl: approvalLink.href,
        status: response.result.status
    };
}

// Capture payment after approval
export async function captureOrder(orderId) {
    const request = new orders.OrdersCaptureRequest(orderId);
    request.requestBody({});
    const response = await client.execute(request);
    
    // Store payment record (in production, save to database)
    const paymentRecord = {
        orderId: response.result.id,
        status: response.result.status,
        payer: response.result.payer,
        purchaseUnits: response.result.purchase_units,
        timestamp: new Date().toISOString()
    };
    
    // Log payment
    console.log('💰 Payment captured:', paymentRecord);
    
    return paymentRecord;
}

// Webhook to handle payment confirmations
export function handleWebhook(req, res) {
    const event = req.body;
    console.log('Webhook received:', event);
    
    // Update user subscription status
    // In production, store in database
    
    res.status(200).json({ received: true });
}