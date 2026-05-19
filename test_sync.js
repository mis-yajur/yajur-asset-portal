import fs from 'fs';

const allLifts = require('./lift_data.json').data;

const parsedLifts = allLifts.map((item) => {
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

const mappedDeliveriesParties = [];
parsedLifts.forEach(lift => {
  const piKey = (lift.PI_NO || '').trim();
  const history = Array.isArray(lift.HISTORY) ? lift.HISTORY : [];
      let mappedDeliveriesPartiesArr = history.map(h => ({
        date: h.deliveryDate || h.timestamp,
        type: 'Delivery',
        account: lift.ACCOUNT,
        piNo: piKey,
        qtyIn: 0,
        qtyOut: Number(h.quantityKg) || 0,
        isStock: false,
        remarks: `Dispatch`
      }));
      if (mappedDeliveriesPartiesArr.length === 0 && Number(lift.DELIVERED_KG) > 0) {
        mappedDeliveriesPartiesArr.push({
          date: lift.LAST_DELIVERY_DATE || lift.DATE || new Date().toISOString(),
          type: 'Legacy Delivery',
          account: lift.ACCOUNT,
          piNo: piKey,
          qtyIn: 0,
          qtyOut: Number(lift.DELIVERED_KG) || 0,
          isStock: false,
          remarks: `Legacy`
        });
      }
      mappedDeliveriesParties.push(...mappedDeliveriesPartiesArr);
});

console.log(JSON.stringify(mappedDeliveriesParties, null, 2));

