import fs from 'fs';

let API_URL = 'https://script.google.com/macros/s/AKfycbytnxq-ShRWabByhO6fhxLtZeGTiMxduup42ADdIdLSsp0uPNszGut9HIaG5h-guNUD/exec';

async function fetchLifts() {
  const result = await fetch(API_URL, {
    method: 'POST',
    mode: 'cors',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({ action: 'getLiftingData', params: {} }),
  });
  const text = await result.text();
  fs.writeFileSync('lift_data.json', text);
  console.log('Saved data to lift_data.json');
}

fetchLifts();
