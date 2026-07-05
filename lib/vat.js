import axios from 'axios';

const VAT_RATE = parseFloat(process.env.VAT_RATE || 12.5);
const FX_API_URL = process.env.FX_API_URL || 'https://api.exchangerate-api.com/v4/latest/USD';

let cachedRate = null;
let lastFetch = null;

export async function getExchangeRate() {
  if (cachedRate && lastFetch && (Date.now() - lastFetch < 3600000)) {
    return cachedRate;
  }
  try {
    const response = await axios.get(FX_API_URL);
    cachedRate = response.data.rates.FJD;
    lastFetch = Date.now();
    return cachedRate;
  } catch (error) {
    console.error('Failed to fetch exchange rate:', error.message);
    return cachedRate || 2.25;
  }
}

export async function calculateVAT(priceUsd) {
  const exchangeRate = await getExchangeRate();
  const priceFjd = priceUsd * exchangeRate;
  const vatFjd = priceFjd * (VAT_RATE / 100);
  const vatUsd = vatFjd / exchangeRate;
  return {
    priceUsd: parseFloat(priceUsd.toFixed(2)),
    exchangeRate: parseFloat(exchangeRate.toFixed(4)),
    priceFjd: parseFloat(priceFjd.toFixed(2)),
    vatRate: VAT_RATE,
    vatFjd: parseFloat(vatFjd.toFixed(2)),
    vatUsd: parseFloat(vatUsd.toFixed(2)),
    totalUsd: parseFloat((priceUsd + vatUsd).toFixed(2))
  };
}
