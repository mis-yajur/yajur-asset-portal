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
      case 'getArchivePI': result = getData('archive_pi'); break;
      case 'getArchiveLifting': result = getData('archive_lifting'); break;
      
      case 'addLifting': result = addRow('lifting_data', params); break;
      case 'updateLifting': result = updateRow('lifting_data', 'LIFTING_ID', params); break;
      case 'deleteLifting': result = deleteRow('lifting_data', 'LIFTING_ID', params.LIFTING_ID); break;
      
      case 'addPI': result = addRow('pi_data', params); break;
      case 'updatePI': result = updateRow('pi_data', 'PI_NO', params); break;
      case 'deletePI': result = deleteRow('pi_data', 'PI_NO', params.PI_NO); break;
      
      case 'archivePI': result = archivePI(params.PI_NO); break;
      
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
    'ledger': ["ID", "DATE", "PI_NO", "ACCOUNT", "TYPE", "QTY", "RATE", "DELIVERED_AMT", "PRICE_BALANCE", "QTY_BALANCE", "REMARKS"],
    'archive_pi': ["PI_NO", "INVOICE_DATE", "SELLER_NAME", "SELLER_GSTIN", "SELLER_CIN", "CERT_NO", "CUSTOMER_NAME", "CUSTOMER_GST", "DELIVERY_ADDR", "DELIVERY_STATE", "DELIVERY_PIN", "PRODUCT_QUALITY", "UNIT_COUNT", "QUANTITY_KG", "RATE_PER_UNIT", "ITEM_TOTAL", "NET_AMOUNT", "AUTHORIZED_SIGNATORY", "STATUS", "CREATED_AT", "ARCHIVED_AT"],
    'archive_lifting': ["LIFTING_ID", "ACCOUNT", "CONTACT", "PI_NO", "TARGET_KG", "DELIVERED_KG", "REMAINING_KG", "COMPLETION", "FREQUENCY", "STATUS", "LAST_DELIVERY_DATE", "LAST_QTY", "HISTORY", "NOTES", "ARCHIVED_AT"]
  };

  for (let sheetName in sheetsConfig) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(sheetsConfig[sheetName]);
    }
    
    if (sheet.getLastRow() === 1) {
      // Add initial Admin user if sheet is empty
      if (sheetName === 'users') {
        sheet.appendRow(["admin", "admin123", "admin", "System Administrator"]);
      }
    }
  }
}

function login(username, password) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('users');
  if (!sheet) {
    initializeSheets();
    sheet = ss.getSheetByName('users');
  }
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    initializeSheets();
    sheet = ss.getSheetByName(sheetName);
  }
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return []; // Only headers

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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    initializeSheets();
    sheet = ss.getSheetByName(sheetName);
  }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  if (sheetName === 'pi_data' && !params.CREATED_AT) {
    params.CREATED_AT = new Date().toISOString();
  }

  const newRow = headers.map(h => {
    const val = params[h];
    return (val !== undefined && val !== null) ? val : "";
  });
  sheet.appendRow(newRow);
  return { success: true };
}

function bulkUpload(sheetName, rows) {
  if (!rows || !rows.length) return { success: true, count: 0 };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    initializeSheets();
    sheet = ss.getSheetByName(sheetName);
  }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const dataToAppend = rows.map(params => {
    return headers.map(h => {
      const val = params[h];
      return (val !== undefined && val !== null) ? val : "";
    });
  });
  
  sheet.getRange(sheet.getLastRow() + 1, 1, dataToAppend.length, headers.length).setValues(dataToAppend);
  return { success: true, count: dataToAppend.length };
}

function updateRow(sheetName, idKey, params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    initializeSheets();
    sheet = ss.getSheetByName(sheetName);
  }
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf(idKey);
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIndex]) === String(params[idKey])) {
      const rowRange = sheet.getRange(i + 1, 1, 1, headers.length);
      const updatedRow = headers.map((h, idx) => {
        return params[h] !== undefined ? params[h] : data[i][idx];
      });
      rowRange.setValues([updatedRow]);
      return { success: true };
    }
  }
  throw new Error('Record not found with ' + idKey + ': ' + params[idKey]);
}

function deleteRow(sheetName, idKey, idValue) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    initializeSheets();
    sheet = ss.getSheetByName(sheetName);
  }
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf(idKey);
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIndex]) === String(idValue)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'Record not found' };
}

function syncLedger(rows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('ledger');
  if (!sheet) {
    initializeSheets();
    sheet = ss.getSheetByName('ledger');
  }
  
  // Clear existing data except headers
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  
  if (rows && rows.length > 0) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const dataToSync = rows.map(r => headers.map(h => {
      const val = r[h];
      return (val !== undefined && val !== null) ? val : "";
    }));
    sheet.getRange(2, 1, dataToSync.length, headers.length).setValues(dataToSync);
  }
  return { success: true, count: rows ? rows.length : 0 };
}

function archivePI(piNo) {
  if (!piNo) throw new Error('PI_NO is required for archiving');
  const targetPiNo = String(piNo).trim().toUpperCase();
  console.log('Archiving PI: ' + targetPiNo);
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const piSheet = ss.getSheetByName('pi_data');
  const liftSheet = ss.getSheetByName('lifting_data');
  const arcPiSheet = ss.getSheetByName('archive_pi');
  const arcLiftSheet = ss.getSheetByName('archive_lifting');

  if (!arcPiSheet || !arcLiftSheet) {
    console.log('Archive sheets missing, initializing...');
    initializeSheets();
  }

  const piDataValues = piSheet.getDataRange().getValues();
  const piHeaders = piDataValues[0];
  const piNoIdx = piHeaders.indexOf('PI_NO');
  const archiveTime = new Date().toISOString();

  let piRowToArchive = null;
  let piRowIndex = -1;

  for (let i = 1; i < piDataValues.length; i++) {
    const currentPiNo = String(piDataValues[i][piNoIdx]).trim().toUpperCase();
    if (currentPiNo === targetPiNo) {
      piRowToArchive = piDataValues[i];
      piRowIndex = i + 1;
      break;
    }
  }

  if (!piRowToArchive) {
    console.warn('PI not found in active list: ' + targetPiNo);
    throw new Error('PI not found in active list: ' + targetPiNo);
  }

  // 1. Copy PI to Archive
  const arcPiHeaders = arcPiSheet.getRange(1, 1, 1, arcPiSheet.getLastColumn()).getValues()[0];
  const newArcPiRow = arcPiHeaders.map(h => {
    if (h === 'ARCHIVED_AT') return archiveTime;
    const idx = piHeaders.indexOf(h);
    return idx !== -1 ? piRowToArchive[idx] : "";
  });
  arcPiSheet.appendRow(newArcPiRow);
  console.log('PI header archived');

  // 2. Archive associated Lifting data
  const liftDataValues = liftSheet.getDataRange().getValues();
  const liftHeaders = liftDataValues[0];
  const liftPiIdx = liftHeaders.indexOf('PI_NO');
  const arcLiftHeaders = arcLiftSheet.getRange(1, 1, 1, arcLiftSheet.getLastColumn()).getValues()[0];

  const rowsToRemove = [];
  for (let i = 1; i < liftDataValues.length; i++) {
    const currentLiftPiNo = String(liftDataValues[i][liftPiIdx]).trim().toUpperCase();
    if (currentLiftPiNo === targetPiNo) {
      const arcLiftRow = arcLiftHeaders.map(h => {
        if (h === 'ARCHIVED_AT') return archiveTime;
        const idx = liftHeaders.indexOf(h);
        return idx !== -1 ? liftDataValues[i][idx] : "";
      });
      arcLiftSheet.appendRow(arcLiftRow);
      rowsToRemove.push(i + 1);
    }
  }
  console.log('Lifting entries archived: ' + rowsToRemove.length);

  // 3. Delete from original sheets (Reverse order to maintain indices)
  if (rowsToRemove.length > 0) {
    rowsToRemove.sort((a, b) => b - a).forEach(row => {
      liftSheet.deleteRow(row);
    });
  }
  piSheet.deleteRow(piRowIndex);
  console.log('Original rows deleted');

  return { success: true, piNo: piNo, archivedAt: archiveTime, liftCount: rowsToRemove.length };
}
