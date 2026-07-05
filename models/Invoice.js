import { DataTypes } from 'sequelize';
import sequelize from './index.js';

const Invoice = sequelize.define('Invoice', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  invoiceNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
  productName: { type: DataTypes.STRING, allowNull: false },
  priceUsd: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  exchangeRate: { type: DataTypes.DECIMAL(10, 4), allowNull: false },
  priceFjd: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  vatRate: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
  vatFjd: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  vatUsd: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  totalUsd: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  customerEmail: { type: DataTypes.STRING },
  paypalTransactionId: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'paid' },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

export default Invoice;
