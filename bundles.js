// bundles.js - Industry-specific agent bundles
export const BUNDLES = {
    // E-commerce Bundle
    'ecommerce': {
        name: 'E-Commerce Growth Suite',
        description: 'Complete AI solution for online stores',
        price: 49.99,
        agents: [
            'content-generator',
            'email-writer',
            'headline-generator',
            'social-media',
            'seo-optimizer',
            'customer-feedback'
        ],
        industry: 'Retail & E-Commerce',
        benefits: [
            'Generate product descriptions',
            'Create email campaigns',
            'Optimize product listings for SEO',
            'Analyze customer feedback',
            'Create social media content'
        ]
    },
    
    // Real Estate Bundle
    'realestate': {
        name: 'Real Estate AI Suite',
        description: 'AI-powered tools for real estate professionals',
        price: 59.99,
        agents: [
            'content-generator',
            'email-writer',
            'trend-analyzer',
            'competitor-analyzer',
            'social-media',
            'video-script'
        ],
        industry: 'Real Estate',
        benefits: [
            'Generate property descriptions',
            'Create listing emails',
            'Analyze market trends',
            'Research competitors',
            'Create property video scripts'
        ]
    },
    
    // SaaS Bundle
    'saas': {
        name: 'SaaS Growth Engine',
        description: 'AI agents for software companies',
        price: 79.99,
        agents: [
            'content-generator',
            'email-writer',
            'business-strategist',
            'market-researcher',
            'competitor-analyzer',
            'revenue-tracker',
            'seo-optimizer'
        ],
        industry: 'SaaS & Technology',
        benefits: [
            'Generate blog content',
            'Create sales emails',
            'Develop growth strategies',
            'Research market opportunities',
            'Track competitor movements',
            'Monitor revenue metrics'
        ]
    },
    
    // Digital Marketing Bundle
    'marketing': {
        name: 'Digital Marketing AI Suite',
        description: 'Complete marketing automation toolkit',
        price: 69.99,
        agents: [
            'content-generator',
            'headline-generator',
            'keyword-researcher',
            'social-media',
            'seo-optimizer',
            'email-writer',
            'trend-analyzer'
        ],
        industry: 'Digital Marketing',
        benefits: [
            'Generate marketing content',
            'Create compelling headlines',
            'Research SEO keywords',
            'Manage social media',
            'Optimize for search',
            'Write marketing emails',
            'Track marketing trends'
        ]
    }
};

export function getBundle(bundleId) {
    return BUNDLES[bundleId];
}

export function getAllBundles() {
    return Object.entries(BUNDLES).map(([id, bundle]) => ({
        id,
        ...bundle,
        agentCount: bundle.agents.length
    }));
}