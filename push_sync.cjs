import fs from 'fs';

const API_URL = 'https://script.google.com/macros/s/AKfycbytnxq-ShRWabByhO6fhxLtZeGTiMxduup42ADdIdLSsp0uPNszGut9HIaG5h-guNUD/exec';
const allLifts = require('./lift_data.json').data;

async function run() {
  const [piRes, liftRes, arcPiRes, arcLiftRes] = await Promise.all([
    fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'getPIData' }) }).then(r => r.json()),
    Promise.resolve({ data: allLifts }),
    fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'getArchivePI' }) }).then(r => r.json()),
    fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'getArchiveLifting' }) }).then(r => r.json())
  ]);

  const piMap = new Map();
  [...(arcPiRes.data || []), ...(piRes.data || [])].forEach((p) => {
    if (p.PI_NO) piMap.set(String(p.PI_NO).trim().toUpperCase(), p);
  });
  const allPis = Array.from(piMap.values());

  const liftMap = new Map();
  [...(arcLiftRes.data || []), ...(liftRes.data || [])].forEach((l) => {
    if (l.LIFTING_ID) liftMap.set(String(l.LIFTING_ID).trim().toUpperCase(), l);
  });
  const allLiftsLatest = Array.from(liftMap.values());

  const parsedLifts = allLiftsLatest.map((item) => {
    let history = [];
    const fieldsToCheck = [item.NOTES, item.HISTORY, item.history, item.DELIVERY_HISTORY];
    for (const field of fieldsToCheck) {
      if (typeof field === 'string' && field.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(field);
          if (Array.isArray(parsed)) {
            history = parsed;
            break;
          }
        } catch (e) {}
      } else if (Array.isArray(field)) {
        history = field;
        break;
      }
    }
    return { ...item, HISTORY: history };
  });

  const partyEntries = [];
  const stockEntries = [];

  allPis.forEach(pi => {
    const piKey = (pi.PI_NO || '').trim();
    if (!piKey) return;

    const lifts = parsedLifts.filter(l => (l.PI_NO || '').trim().toUpperCase() === piKey.toUpperCase());
    const isGeneral = (name) => String(name || '').trim().toUpperCase() === 'GENERAL ACCOUNT';

    if (lifts.length > 0) {
      lifts.forEach(lift => {
        if (isGeneral(lift.ACCOUNT)) return;
        partyEntries.push({
          date: pi.CREATED_AT || pi.PI_DATE || pi.DATE || new Date().toISOString(),
          type: 'Initial Allocation',
          account: lift.ACCOUNT,
          piNo: piKey,
          qtyIn: Number(lift.TARGET_KG) || 0,
          qtyOut: 0,
          isInitial: true,
          isStock: false,
          remarks: `Target set for ${pi.PRODUCT_QUALITY}`
        });
      });
    } else if (!isGeneral(pi.CUSTOMER_NAME)) {
      partyEntries.push({
        date: pi.CREATED_AT || pi.PI_DATE || pi.DATE || new Date().toISOString(),
        type: 'Initial Allocation',
        account: pi.CUSTOMER_NAME,
        piNo: piKey,
        qtyIn: Number(pi.QUANTITY_KG) || 0,
        qtyOut: 0,
        isInitial: true,
        isStock: false,
        remarks: `Target set for ${pi.PRODUCT_QUALITY}`
      });
    }

    stockEntries.push({
      date: pi.CREATED_AT || pi.PI_DATE || pi.DATE || new Date().toISOString(),
      type: 'Stock Prepared',
      account: pi.CUSTOMER_NAME || 'Factory / Master',
      piNo: piKey,
      qtyIn: Number(pi.QUANTITY_KG) || 0,
      qtyOut: 0,
      isStock: true,
      remarks: `PI Created: ${pi.PRODUCT_QUALITY || ''}`
    });
  });

  parsedLifts.forEach(lift => {
    const piKey = (lift.PI_NO || '').trim();
    const history = Array.isArray(lift.HISTORY) ? lift.HISTORY : [];
    let mappedDeliveriesParties = history.map(h => ({
      date: h.deliveryDate || h.timestamp,
      type: 'Delivery',
      account: lift.ACCOUNT,
      piNo: piKey,
      qtyIn: 0,
      qtyOut: Number(h.quantityKg) || 0,
      isStock: false,
      remarks: `Dispatch`
    }));
    let mappedDeliveriesStock = history.map(h => ({
        date: h.deliveryDate || h.timestamp,
        type: 'Delivery',
        account: lift.ACCOUNT,
        piNo: piKey,
        qtyIn: 0,
        qtyOut: Number(h.quantityKg) || 0,
        isStock: true,
        remarks: `Dispatch`
      }));

    if (mappedDeliveriesParties.length === 0 && Number(lift.DELIVERED_KG) > 0) {
      mappedDeliveriesParties.push({
        date: lift.LAST_DELIVERY_DATE || lift.DATE || new Date().toISOString(),
        type: 'Legacy Delivery',
        account: lift.ACCOUNT,
        piNo: piKey,
        qtyIn: 0,
        qtyOut: Number(lift.DELIVERED_KG) || 0,
        isStock: false,
        remarks: `Legacy`
      });
      mappedDeliveriesStock.push({
        date: lift.LAST_DELIVERY_DATE || lift.DATE || new Date().toISOString(),
        type: 'Legacy Delivery',
        account: lift.ACCOUNT,
        piNo: piKey,
        qtyIn: 0,
        qtyOut: Number(lift.DELIVERED_KG) || 0,
        isStock: true,
        remarks: `Legacy`
      });
    }

    partyEntries.push(...mappedDeliveriesParties);
    stockEntries.push(...mappedDeliveriesStock);
  });

  const entries = [...partyEntries, ...stockEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const rows = entries.map(e => ({
    ID: Math.random().toString(36).substr(2, 9).toUpperCase(),
    DATE: new Date(e.date).toLocaleString(),
    ACCOUNT_PI: `${e.isStock ? 'STOCK_' : 'PARTY_'}${e.isStock ? e.piNo : e.account}`,
    TYPE: e.type || '',
    INWARD_TARGET_KG: e.qtyIn || 0,
    OUTWARD_DELIVERED_KG: e.qtyOut || 0,
    BALANCE_KG: 0,
    REMARKS: `${e.piNo}||${e.isInitial||false}` 
  }));

  console.log("Writing rows to sheet:", rows.slice(0, 5));
  
  const pushRes = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'syncLedger', params: { rows } })
  });
  console.log("Push result:", await pushRes.text());
}

run();
