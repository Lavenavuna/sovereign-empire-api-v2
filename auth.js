// auth.js - User authentication and tier management
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-me';

// User storage (in production, use a database)
const users = {};

export function createUser(email, password, plan = 'FREE') {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = {
        id: Date.now().toString(),
        email,
        password: hashedPassword,
        plan: plan.toUpperCase(),
        createdAt: new Date().toISOString(),
        usage: {
            requests: 0,
            lastReset: new Date().toISOString()
        }
    };
    users[email] = user;
    return user;
}

export function authenticateUser(email, password) {
    const user = users[email];
    if (!user) return null;
    if (!bcrypt.compareSync(password, user.password)) return null;
    return user;
}

export function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, plan: user.plan },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

export function getUserPlan(email) {
    const user = users[email];
    return user ? user.plan : 'FREE';
}

export function upgradeUserPlan(email, newPlan) {
    const user = users[email];
    if (user) {
        user.plan = newPlan.toUpperCase();
        return user;
    }
    return null;
}

// Middleware to check authentication
export function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
}

// Middleware to check plan access
export function planMiddleware(requiredPlan) {
    const planLevels = { FREE: 0, PRO: 1, BUSINESS: 2, ENTERPRISE: 3 };
    
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const userLevel = planLevels[user.plan] || 0;
        const requiredLevel = planLevels[requiredPlan] || 0;
        
        if (userLevel < requiredLevel) {
            return res.status(403).json({ 
                error: 'Upgrade required',
                currentPlan: user.plan,
                requiredPlan: requiredPlan
            });
        }
        next();
    };
}