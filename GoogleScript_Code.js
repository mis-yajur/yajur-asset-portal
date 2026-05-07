// ==========================================
// GOOGLE APPS SCRIPT BACKEND (Code.gs)
// Copy and paste this into your Google Apps Script Editor
// ==========================================

const SPREADSHEET_ID = '1MrrxJa6BtMhqAJGpZHFsgm02Tr0uwox8Oq0nhVLoIK4';

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    const data = params.params;

    let result;
    switch (action) {
      // ---- PI MODULE ----
      case 'getPIData':
        result = getSheetData('PI');
        break;
      case 'addPI':
        result = addRow('PI', data);
        break;
      case 'updatePI':
        result = updateRow('PI', 'PI_NO', data.PI_NO, data);
        break;
      case 'deletePI':
        result = deleteRow('PI', 'PI_NO', data.PI_NO);
        break;

      // ---- LIFTING MODULE ----
      case 'getLiftingData':
        result = getSheetData('Lifting');
        break;
      case 'addLifting':
        result = addRow('Lifting', data);
        break;
      case 'updateLifting':
        result = updateRow('Lifting', 'LIFTING_ID', data.LIFTING_ID, data);
        break;

      // ---- CUSTOMERS MODULE ----
      case 'getCustomersData':
        result = getSheetData('Customers');
        break;
      case 'addCustomer':
        result = addRow('Customers', data);
        break;
      case 'updateCustomer':
        result = updateRow('Customers', 'ID', data.ID, data);
        break;

      // ---- PRODUCTS MODULE ----
      case 'getProductsData':
        result = getSheetData('Products');
        break;
      case 'addProduct':
        result = addRow('Products', data);
        break;
      case 'updateProduct':
        result = updateRow('Products', 'ID', data.ID, data);
        break;
        
      // ---- LEDGER MODULE ----
      case 'getLedgerData':
        result = getSheetData('Ledger');
        break;
      case 'syncLedger':
        result = syncLedgerSheet(data.rows);
        break;

      default:
        throw new Error('Unknown action: ' + action);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function selectHeaders(sheetName) {
  const defaults = {
    'PI': ['ID', 'PI_NO', 'DATE', 'PI_DATE', 'ACCOUNT', 'AGENT', 'DELIVERY_ADDRESS', 'CONTACT', 'QUALITY', 'SHADE', 'QUANTITY_KG', 'RATE', 'PAYMENT_TERMS', 'STATUS', 'CREATED_AT'],
    'Lifting': ['ID', 'LIFTING_ID', 'DATE', 'ACCOUNT', 'AGENT', 'DELIVERY_ADDRESS', 'CONTACT', 'PI_NO', 'SHADE', 'QUALITY', 'TOTAL_QUANTITY_KG', 'DELIVERED_KG', 'BALANCE_KG', 'STATUS', 'HISTORY', 'NOTES', 'LAST_DELIVERY_DATE', 'CREATED_AT'],
    'Customers': ['ID', 'NAME', 'CONTACT_PERSON', 'EMAIL', 'PHONE', 'ADDRESS', 'TYPE', 'STATUS', 'CREATED_AT'],
    'Products': ['ID', 'QUALITY', 'SHADE', 'CATEGORY', 'DESCRIPTION', 'UNIT', 'STOCK', 'PRICE', 'CREATED_AT'],
    'Ledger': ['ID', 'DATE', 'PI_NO', 'ACCOUNT', 'TYPE', 'DEBIT_TARGET', 'CREDIT_DELIVERED', 'BALANCE', 'REMARKS', 'CREATED_AT']
  };
  return defaults[sheetName] || [];
}

function ensureSheetExists(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = selectHeaders(sheetName);
    if(headers && headers.length > 0) {
      sheet.appendRow(headers);
    }
  } else {
    // Check if headers exist
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
      const headers = selectHeaders(sheetName);
      if(headers && headers.length > 0) {
        sheet.appendRow(headers);
      }
    }
  }
  return sheet;
}

function getSheetData(sheetName) {
  const sheet = ensureSheetExists(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  return data.slice(1).map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] !== undefined && row[index] !== null ? row[index] : "";
    });
    return obj;
  });
}

function addRow(sheetName, item) {
  const sheet = ensureSheetExists(sheetName);
  const headers = sheet.getDataRange().getValues()[0] || selectHeaders(sheetName);
  
  // Set defaults for IDs and Timestamps
  if (!item.ID) item.ID = Utilities.getUuid();
  if (!item.CREATED_AT) item.CREATED_AT = new Date().toISOString();

  const newRow = headers.map(header => {
    const val = item[header];
    return val !== undefined && val !== null ? val : "";
  });
  
  sheet.appendRow(newRow);
  return getSheetData(sheetName);
}

function updateRow(sheetName, keyField, keyValue, targetData) {
  const sheet = ensureSheetExists(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return getSheetData(sheetName);
  
  const headers = data[0];
  const keyIndex = headers.indexOf(keyField);
  if (keyIndex === -1) throw new Error("Key field missing in headers");
  
  // Find which row needs updating
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][keyIndex]) === String(keyValue)) {
      rowIndex = i + 1; // +1 because array is 0-indexed and rows are 1-indexed
      break;
    }
  }

  if (rowIndex === -1) {
    // If not found, add it
    return addRow(sheetName, targetData);
  } else {
    // Update existing row
    const existingRowData = data[rowIndex - 1]; // data array index
    
    headers.forEach((header, colIndex) => {
      if (targetData.hasOwnProperty(header)) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(targetData[header]);
      }
    });
  }

  return getSheetData(sheetName);
}

function deleteRow(sheetName, keyField, keyValue) {
  const sheet = ensureSheetExists(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return getSheetData(sheetName);
  
  const headers = data[0];
  const keyIndex = headers.indexOf(keyField);
  
  for (let i = data.length - 1; i > 0; i--) {
    if (String(data[i][keyIndex]) === String(keyValue)) {
      sheet.deleteRow(i + 1);
    }
  }
  return getSheetData(sheetName);
}

// Special function to sync all ledger rows
function syncLedgerSheet(rows) {
  const sheet = ensureSheetExists('Ledger');
  
  // Clear existing items in Ledger (except header row 1)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  if (rows && rows.length > 0) {
    const dataMatrix = rows.map(item => {
      return headers.map(header => {
        let val = item[header];
        return val !== undefined && val !== null ? val : "";
      });
    });
    
    // Write in batch mode for better performance
    sheet.getRange(2, 1, dataMatrix.length, headers.length).setValues(dataMatrix);
  }
  
  return getSheetData('Ledger');
}

// For dealing with pre-flight OPTIONS requests in CORS
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
