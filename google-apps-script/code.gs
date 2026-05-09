/**
 * Google Apps Script Backend for Goods Lifting Portal
 * Deploy this as a Web App with access set to "Anyone"
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function doPost(e) {
  const request = JSON.parse(e.postData.contents);
  const action = request.action;
  const params = request.params || {};
  
  // Ensure sheets exist on first run
  initializeSheets();

  try {
    let result;
    switch (action) {
      case 'login': 
        result = login(params.username, params.password); 
        break;
      case 'getLiftingData': result = getData('lifting_data'); break;
      case 'getPIData': result = getData('pi_data'); break;
      case 'getCustomers': result = getData('customer_master'); break;
      case 'getProducts': result = getData('product_master'); break;
      case 'getLedger': result = getData('ledger'); break;
      
      case 'addLifting': result = addRow('lifting_data', params); break;
      case 'updateLifting': result = updateRow('lifting_data', 'LIFTING_ID', params); break;
      case 'deleteLifting': result = deleteRow('lifting_data', 'LIFTING_ID', params.LIFTING_ID); break;
      
      case 'addPI': result = addRow('pi_data', params); break;
      case 'updatePI': result = updateRow('pi_data', 'PI_NO', params); break;
      case 'deletePI': result = deleteRow('pi_data', 'PI_NO', params.PI_NO); break;
      
      case 'addCustomer': result = addRow('customer_master', params); break;
      case 'bulkUploadCustomers': result = bulkUpload('customer_master', params.customers); break;
      case 'updateCustomer': result = updateRow('customer_master', 'PARTY_CODE', params); break;
      case 'deleteCustomer': result = deleteRow('customer_master', 'PARTY_CODE', params.PARTY_CODE); break;
      
      case 'addProduct': result = addRow('product_master', params); break;
      case 'bulkUploadProducts': result = bulkUpload('product_master', params.products); break;
      case 'updateProduct': result = updateRow('product_master', 'QLTY_CODE', params); break;
      case 'deleteProduct': result = deleteRow('product_master', 'QLTY_CODE', params.QLTY_CODE); break;

      case 'syncLedger': result = syncLedger(params.rows); break;
      
      default:
        throw new Error('Action not recognized: ' + action);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Initialize sheets, headers, and dummy data
 */
function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetsConfig = {
    'users': ["USERNAME", "PASSWORD", "ROLE", "NAME"],
    'lifting_data': ["LIFTING_ID", "ACCOUNT", "CONTACT", "PI_NO", "TARGET_KG", "DELIVERED_KG", "REMAINING_KG", "COMPLETION", "FREQUENCY", "STATUS", "LAST_DELIVERY_DATE", "LAST_QTY", "HISTORY", "NOTES"],
    'pi_data': ["PI_NO", "INVOICE_DATE", "SELLER_NAME", "SELLER_GSTIN", "SELLER_CIN", "CERT_NO", "CUSTOMER_NAME", "CUSTOMER_GST", "DELIVERY_ADDR", "DELIVERY_STATE", "DELIVERY_PIN", "PRODUCT_QUALITY", "UNIT_COUNT", "QUANTITY_KG", "RATE_PER_UNIT", "ITEM_TOTAL", "NET_AMOUNT", "AUTHORIZED_SIGNATORY", "STATUS", "CREATED_AT"],
    'customer_master': ["SL", "PARTY_CODE", "PARTY_NAME", "ADDRESS1", "ADDRESS2", "ADDRESS3", "STATE_CODE", "GSTIN", "PAN_NO", "MOBILE_NO", "EMAIL_ID", "BANK_CODE", "IFSC_BRANCH", "IFSC_CODE", "ACC_NO"],
    'product_master': ["SL", "QLTY_CODE", "QLTY_NAME", "HSN_CODE", "TYPE"],
    'ledger': ["ID", "DATE", "PI_NO", "ACCOUNT", "TYPE", "QTY", "RATE", "DELIVERED_AMT", "PRICE_BALANCE", "QTY_BALANCE", "REMARKS"]
  };

  for (let sheetName in sheetsConfig) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(sheetsConfig[sheetName]);
      
      // Add Dummy Data for testing
      if (sheetName === 'users') {
        sheet.appendRow(["admin", "admin123", "admin", "System Administrator"]);
      }
      if (sheetName === 'customer_master') {
        sheet.appendRow(["1", "CUS001", "Ghosh Traders", "Kolkata", "", "", "19", "19AAECS2882B3ZB", "PAN123", "9876543210", "ghosh@test.com", "SBI", "Main", "SBIN00123", "123456789"]);
        sheet.appendRow(["2", "CUS002", "Dutta Enterprise", "Howrah", "", "", "19", "19BBECS2882B3ZB", "PAN456", "9876543211", "dutta@test.com", "HDFC", "Howrah", "HDFC00123", "987654321"]);
      }
      if (sheetName === 'product_master') {
        sheet.appendRow(["1", "YY-30S", "30s Combed Yarn", "5205", "Yarn"]);
        sheet.appendRow(["2", "PF-150D", "150 Denier Polyester", "5402", "Fibre"]);
      }
      if (sheetName === 'pi_data') {
        sheet.appendRow(["PI-001", "2024-05-01", "Yajur Lifting", "19AAECS2882B3ZB", "U17100WB1980PLC032918", "BVFR14492922", "Ghosh Traders", "19AAECS2882B3ZB", "Kolkata", "West Bengal", "700001", "30s Combed Yarn", "100", "5000", "250", "1250000", "1250000", "Authorized Admin", "RUNNING", new Date().toISOString()]);
      }
      if (sheetName === 'lifting_data') {
        sheet.appendRow(["LIFT-1", "Ghosh Traders", "Mr. Ghosh", "PI-001", "5000", "1500", "3500", "30", "30", "RUNNING", "2024-05-05", "400", "[]", ""]);
      }
    }
  }
}

function login(username, password) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  
  const userIdx = headers.indexOf('USERNAME');
  const passIdx = headers.indexOf('PASSWORD');
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][userIdx] == username && values[i][passIdx] == password) {
      const user = {};
      headers.forEach((h, idx) => user[h] = values[i][idx]);
      return user;
    }
  }
  throw new Error('Invalid credentials');
}

function getData(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const data = [];
  
  for (let i = 1; i < values.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[i][j];
    }
    data.push(row);
  }
  return data;
}

function addRow(sheetName, params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newRow = headers.map(h => params[h] || "");
  sheet.appendRow(newRow);
  return { success: true };
}

function bulkUpload(sheetName, rows) {
  if (!rows || !rows.length) return { success: true, count: 0 };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const dataToAppend = rows.map(params => {
    return headers.map(h => params[h] || "");
  });
  
  sheet.getRange(sheet.getLastRow() + 1, 1, dataToAppend.length, headers.length).setValues(dataToAppend);
  return { success: true, count: dataToAppend.length };
}

function updateRow(sheetName, idKey, params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf(idKey);
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] == params[idKey]) {
      const rowRange = sheet.getRange(i + 1, 1, 1, headers.length);
      const updatedRow = headers.map(h => params[h] !== undefined ? params[h] : data[i][headers.indexOf(h)]);
      rowRange.setValues([updatedRow]);
      return { success: true };
    }
  }
  throw new Error('Record not found with ID: ' + params[idKey]);
}

function deleteRow(sheetName, idKey, idValue) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf(idKey);
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] == idValue) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'Record not found' };
}

function syncLedger(rows) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ledger');
  // Clear existing data except headers
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  
  if (rows && rows.length > 0) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const dataToSync = rows.map(r => headers.map(h => r[h] || ""));
    sheet.getRange(2, 1, dataToSync.length, headers.length).setValues(dataToSync);
  }
  return { success: true };
}
