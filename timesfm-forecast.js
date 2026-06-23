// timesfm-forecast.js - Google TimesFM Forecasting Integration
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    // TimesFM API endpoints (using Google's open-source model)
    apiEndpoint: 'https://api.google.com/timesfm/v1/forecast',
    
    // Forecasting settings
    forecastHorizon: 30, // Days to forecast
    confidenceLevel: 0.95,
    
    // Data sources
    dataSources: {
        sales: './data/sales-history.json',
        leads: './data/leads-history.json',
        revenue: './data/revenue-history.json'
    },
    
    // Forecast triggers
    triggers: {
        sales: true,
        leads: true,
        revenue: true,
        customerGrowth: true
    }
};

// ============================================
// TIMESFM FORECAST ENGINE
// ============================================
class TimesFMEngine {
    constructor() {
        this.forecasts = {
            sales: null,
            leads: null,
            revenue: null,
            customerGrowth: null
        };
        this.history = {
            sales: [],
            leads: [],
            revenue: [],
            customerGrowth: []
        };
        this.stateFile = './timesfm-forecasts.json';
        this.loadHistory();
        this.loadForecasts();
        console.log('📊 TimesFM Forecasting Engine initialized');
    }

    loadHistory() {
        try {
            if (fs.existsSync('./data/sales-history.json')) {
                this.history.sales = JSON.parse(fs.readFileSync('./data/sales-history.json', 'utf8'));
            }
            if (fs.existsSync('./data/leads-history.json')) {
                this.history.leads = JSON.parse(fs.readFileSync('./data/leads-history.json', 'utf8'));
            }
            if (fs.existsSync('./data/revenue-history.json')) {
                this.history.revenue = JSON.parse(fs.readFileSync('./data/revenue-history.json', 'utf8'));
            }
        } catch (e) {
            console.log('📂 No history data found, generating sample data');
            this.generateSampleHistory();
        }
    }

    generateSampleHistory() {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    // Generate 90 days of sample data
    for (let i = 90; i >= 0; i--) {
        const date = new Date(now - i * dayMs).toISOString().split('T')[0];
        
        // Sales with seasonality + trend + noise
        const baseSales = 500 + (90 - i) * 2;
        const seasonalSales = 100 * Math.sin(i / 7 * Math.PI);
        const noiseSales = (Math.random() - 0.5) * 50;
        const salesValue = Math.max(0, Math.round(baseSales + seasonalSales + noiseSales));
        this.history.sales.push({ date, value: salesValue });
        
        // Leads with growth + noise
        const baseLeads = 20 + (90 - i) * 0.5;
        const noiseLeads = (Math.random() - 0.5) * 8;
        const leadsValue = Math.max(0, Math.round(baseLeads + noiseLeads));
        this.history.leads.push({ date, value: leadsValue });
        
        // Revenue (sales * avg deal size)
        const avgDealSize = 5000 + (90 - i) * 20;
        const revenueValue = Math.max(0, Math.round((salesValue * avgDealSize) / 100));
        this.history.revenue.push({ date, value: revenueValue });
    }
    
    this.saveHistory();
    console.log('✅ Sample history generated');
}

    saveHistory() {
        const dir = './data';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync('./data/sales-history.json', JSON.stringify(this.history.sales, null, 2));
        fs.writeFileSync('./data/leads-history.json', JSON.stringify(this.history.leads, null, 2));
        fs.writeFileSync('./data/revenue-history.json', JSON.stringify(this.history.revenue, null, 2));
    }

    loadForecasts() {
        try {
            if (fs.existsSync(this.stateFile)) {
                this.forecasts = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
                console.log('📂 Loaded existing forecasts');
            }
        } catch (e) {
            console.log('📂 No existing forecasts');
        }
    }

    saveForecasts() {
        fs.writeFileSync(this.stateFile, JSON.stringify(this.forecasts, null, 2));
    }

   // ============================================
// TIMESFM SIMULATION (Real implementation would call Google's API)
// ============================================
async runTimesFM(data, horizon) {
    // This simulates TimesFM forecasting
    // In production, replace with actual TimesFM API call
    
    const values = data.map(d => d.value);
    // Get last value safely - use 100 as default if no data
    const lastValue = values.length > 0 ? values[values.length - 1] : 100;
    // Calculate average change safely
    const avgChange = values.length > 1 ? (values[values.length - 1] - values[0]) / values.length : 0;
    
    const prediction = [];
    let currentValue = lastValue;
    
    for (let i = 0; i < horizon; i++) {
        // Add trend + seasonality + noise
        const trend = avgChange * (i + 1);
        const seasonality = 20 * Math.sin(i / 7 * Math.PI);
        const noise = (Math.random() - 0.5) * 10;
        
        // Ensure we never go below 10
        currentValue = Math.max(10, currentValue + trend * 0.5 + seasonality * 0.3 + noise * 0.2);
        
        // Add confidence bands - ensure they're valid
        const lowerBound = Math.max(5, currentValue * 0.85);
        const upperBound = Math.max(10, currentValue * 1.15);
        
        prediction.push({
            date: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            value: Math.round(currentValue),
            lowerBound: Math.round(lowerBound),
            upperBound: Math.round(upperBound)
        });
    }
    
    return prediction;
}

   // ============================================
// TIMESFM SIMULATION (Real implementation would call Google's API)
// ============================================
async runTimesFM(data, horizon) {
    // This simulates TimesFM forecasting
    // In production, replace with actual TimesFM API call
    
    const values = data.map(d => d.value);
    const lastValue = values[values.length - 1];
    const avgChange = (values[values.length - 1] - values[0]) / values.length;
    
    const prediction = [];
    let currentValue = lastValue;
    
    for (let i = 0; i < horizon; i++) {
        // Add trend + seasonality + noise
        const trend = avgChange * (i + 1);
        const seasonality = 20 * Math.sin(i / 7 * Math.PI);
        const noise = (Math.random() - 0.5) * 10;
        
        currentValue = Math.max(0, currentValue + trend * 0.5 + seasonality * 0.3 + noise * 0.2);
        
        // Add confidence bands
        const lowerBound = currentValue * 0.85;
        const upperBound = currentValue * 1.15;
        
        prediction.push({
            date: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            value: Math.round(currentValue),
            lowerBound: Math.round(lowerBound),
            upperBound: Math.round(upperBound)
        });
    }
    
    return prediction;
}
        return prediction;
    }

    // ============================================
    // GENERATE COMPLETE FORECAST
    // ============================================
    async generateFullForecast() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TIMESFM FULL FORECAST');
        console.log('='.repeat(60));
        console.log(`📅 ${new Date().toLocaleString()}`);
        console.log(`📈 Horizon: ${CONFIG.forecastHorizon} days`);
        console.log('');
        
        if (CONFIG.triggers.sales) await this.forecastSales();
        if (CONFIG.triggers.leads) await this.forecastLeads();
        if (CONFIG.triggers.revenue) await this.forecastRevenue();
        
        this.saveForecasts();
        this.generateReport();
        return this.forecasts;
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 FORECAST REPORT');
        console.log('='.repeat(60));
        
        if (this.forecasts.sales) {
            const f = this.forecasts.sales;
            const total = f.prediction.reduce((sum, d) => sum + d.value, 0);
            const avg = total / f.prediction.length;
            const last = f.prediction[f.prediction.length - 1];
            console.log(`📈 Sales: ${f.prediction.length} day forecast`);
            console.log(`   Average: ${Math.round(avg)}`);
            console.log(`   Final: ${Math.round(last.value)} (${Math.round(last.lowerBound)} - ${Math.round(last.upperBound)})`);
        }
        
        if (this.forecasts.leads) {
            const f = this.forecasts.leads;
            const total = f.prediction.reduce((sum, d) => sum + d.value, 0);
            const avg = total / f.prediction.length;
            const last = f.prediction[f.prediction.length - 1];
            console.log(`📈 Leads: ${f.prediction.length} day forecast`);
            console.log(`   Average: ${Math.round(avg)}`);
            console.log(`   Final: ${Math.round(last.value)} (${Math.round(last.lowerBound)} - ${Math.round(last.upperBound)})`);
        }
        
        if (this.forecasts.revenue) {
            const f = this.forecasts.revenue;
            const total = f.prediction.reduce((sum, d) => sum + d.value, 0);
            const avg = total / f.prediction.length;
            const last = f.prediction[f.prediction.length - 1];
            console.log(`📈 Revenue: ${f.prediction.length} day forecast`);
            console.log(`   Average: $${Math.round(avg)}`);
            console.log(`   Final: $${Math.round(last.value)} ($${Math.round(last.lowerBound)} - $${Math.round(last.upperBound)})`);
        }
        
        console.log('='.repeat(60));
    }

    // ============================================
    // GET FORECAST FOR AGENTS
    // ============================================
    getForecastSummary() {
        const summary = {
            timestamp: new Date().toISOString(),
            horizon: CONFIG.forecastHorizon,
            sales: null,
            leads: null,
            revenue: null
        };
        
        if (this.forecasts.sales) {
            const f = this.forecasts.sales;
            summary.sales = {
                trend: f.prediction[f.prediction.length - 1].value - f.prediction[0].value > 0 ? 'increasing' : 'decreasing',
                avg: Math.round(f.prediction.reduce((sum, d) => sum + d.value, 0) / f.prediction.length),
                peak: Math.max(...f.prediction.map(d => d.value)),
                peakDate: f.prediction.find(d => d.value === Math.max(...f.prediction.map(d => d.value)))?.date
            };
        }
        
        if (this.forecasts.leads) {
            const f = this.forecasts.leads;
            summary.leads = {
                trend: f.prediction[f.prediction.length - 1].value - f.prediction[0].value > 0 ? 'increasing' : 'decreasing',
                avg: Math.round(f.prediction.reduce((sum, d) => sum + d.value, 0) / f.prediction.length),
                peak: Math.max(...f.prediction.map(d => d.value)),
                peakDate: f.prediction.find(d => d.value === Math.max(...f.prediction.map(d => d.value)))?.date
            };
        }
        
        if (this.forecasts.revenue) {
            const f = this.forecasts.revenue;
            summary.revenue = {
                trend: f.prediction[f.prediction.length - 1].value - f.prediction[0].value > 0 ? 'increasing' : 'decreasing',
                avg: Math.round(f.prediction.reduce((sum, d) => sum + d.value, 0) / f.prediction.length),
                peak: Math.max(...f.prediction.map(d => d.value)),
                peakDate: f.prediction.find(d => d.value === Math.max(...f.prediction.map(d => d.value)))?.date
            };
        }
        
        return summary;
    }
}

// ============================================
// MAIN
// ============================================
const forecastEngine = new TimesFMEngine();

// Run immediately
await forecastEngine.generateFullForecast();

// Run every 6 hours
setInterval(async () => {
    await forecastEngine.generateFullForecast();
}, 6 * 60 * 60 * 1000);

console.log('\n⏰ Forecasting running every 6 hours');
console.log('📊 Forecasts saved to: timesfm-forecasts.json');
console.log('📈 Agents can access forecasts via getForecastSummary()');