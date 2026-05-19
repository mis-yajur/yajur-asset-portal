import { apiCall } from '../services/api';

export async function syncLedgerToSheet() {
  try {
    const [piRes, liftRes, arcPiRes, arcLiftRes] = await Promise.all([
      apiCall('getPIData'),
      apiCall('getLiftingData'),
      apiCall('getArchivePI'),
      apiCall('getArchiveLifting')
    ]);

    const piMap = new Map<string, any>();
    [...(arcPiRes.data || []), ...(piRes.data || [])].forEach((p: any) => {
      if (p.PI_NO) piMap.set(String(p.PI_NO).trim().toUpperCase(), p);
    });
    const allPis = Array.from(piMap.values());

    const liftMap = new Map<string, any>();
    [...(arcLiftRes.data || []), ...(liftRes.data || [])].forEach((l: any) => {
      if (l.LIFTING_ID) liftMap.set(String(l.LIFTING_ID).trim().toUpperCase(), l);
    });
    const allLifts = Array.from(liftMap.values());

    const parsedLifts = allLifts.map((item: any) => {
      let historyStr = item.HISTORY || item.history || item.DELIVERY_HISTORY || item.NOTES;
      let history = historyStr;
      if (typeof history === 'string') {
        try { history = JSON.parse(historyStr); } catch (e) { history = []; }
      }
      return { ...item, HISTORY: Array.isArray(history) ? history : [] };
    });

    const partyEntries: any[] = [];
    const stockEntries: any[] = [];

    allPis.forEach(pi => {
      const piKey = (pi.PI_NO || '').trim();
      if (!piKey) return;

      const lifts = parsedLifts.filter(l => (l.PI_NO || '').trim().toUpperCase() === piKey.toUpperCase());
      const isGeneral = (name: string) => String(name || '').trim().toUpperCase() === 'GENERAL ACCOUNT';

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
      BALANCE_KG: 0, // balance is computed on render or we can compute here
      REMARKS: `${e.piNo}||${e.isInitial||false}` 
    }));

    await apiCall('syncLedger', { rows });

  } catch (err) {
    console.error('Auto Ledger Sync Failed:', err);
  }
}
