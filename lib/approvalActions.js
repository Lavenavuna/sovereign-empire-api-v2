import { loadWholesaleState, saveWholesaleState } from './wholesaleStore.js';
import { createInvoice } from './revenueOps.js';

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function executeApprovedAction(approval) {
  if (!approval?.actionType) {
    return { success: false, error: 'Missing actionType' };
  }

  if (approval.actionType !== 'close-deal') {
    return { success: false, error: `Unsupported actionType: ${approval.actionType}` };
  }

  const payload = approval.payload || {};
  const dealId = payload.dealId;
  if (!dealId) return { success: false, error: 'Missing payload.dealId' };

  const state = loadWholesaleState();
  const deal = state.deals.find(d => d.id === dealId);
  if (!deal) return { success: false, error: 'Deal not found for approval action' };

  const property = state.properties.find(p => p.id === deal.propertyId);
  const investor = payload.investorId
    ? state.investors.find(i => i.id === payload.investorId)
    : null;

  const assignmentFeeUsd = asNumber(
    payload.assignmentFeeUsd,
    deal.assignmentFeeTarget || deal.assignmentPotential || 0
  );
  if (assignmentFeeUsd <= 0) return { success: false, error: 'assignmentFeeUsd must be greater than 0' };

  const customerName = investor?.name || payload.buyerName || deal.contacts?.buyerName || 'Investor Buyer';
  const customerEmail = investor?.email || payload.buyerEmail || deal.contacts?.buyerEmail || 'N/A';
  const customerPhone = investor?.phone || payload.buyerPhone || deal.contacts?.buyerPhone || 'N/A';

  const invoice = createInvoice({
    productName: `Assignment fee - ${property?.address || deal.propertyId}`,
    priceUsd: assignmentFeeUsd,
    customerName,
    customerEmail,
    customerPhone,
    dealId: deal.id,
    paymentMethod: payload.paymentMethod || 'Wire Transfer',
    dueInDays: asNumber(payload.dueInDays, 7)
  });

  deal.status = 'awaiting_payment';
  deal.stage = 'closed_pending_payment';
  deal.assignmentFeeUsd = assignmentFeeUsd;
  deal.invoiceNumber = invoice.invoiceNumber;
  deal.contacts = deal.contacts || {};
  deal.contacts.buyerName = customerName;
  deal.contacts.buyerEmail = customerEmail;
  deal.contacts.buyerPhone = customerPhone;
  deal.closedAt = new Date().toISOString();
  deal.updatedAt = new Date().toISOString();
  if (property) {
    property.status = 'under_contract';
    property.updatedAt = new Date().toISOString();
  }

  saveWholesaleState(state);
  return {
    success: true,
    message: 'Deal close approved and invoice created',
    actionType: approval.actionType,
    dealId: deal.id,
    invoiceNumber: invoice.invoiceNumber
  };
}

