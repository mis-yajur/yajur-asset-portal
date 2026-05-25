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
      case 'getLiftingData': {
        const data = getData('lifting_data');
        result = data.filter(r => String(r.STATUS).toUpperCase() !== 'ARCHIVED');
        break;
      }
      case 'getPIData': {
        const data = getData('pi_data');
        result = data.filter(r => String(r.STATUS).toUpperCase() !== 'ARCHIVED');
        break;
      }
      case 'getDashboardData': {
        result = {
          pi: getData('pi_data'),
          lifting: getData('lifting_data'),
          archivePi: getData('archive_pi'),
          archiveLifting: getData('archive_lifting')
        };
        break;
      }
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
      case 'archiveLiftingEntry': result = archiveLiftingEntry(params.LIFTING_ID); break;
      
      case 'getGenericData': result = getData(params.sheetName); break;
      case 'addGenericRow': result = addRow(params.sheetName, params.data); break;
      case 'updateGenericRow': result = updateRow(params.sheetName, params.keyField, params.data); break;
      case 'deleteGenericRow': result = deleteRow(params.sheetName, params.keyField, params.keyValue); break;

      case 'addCustomer': result = addRow('customer_master', params); break;
      case 'bulkUploadCustomers': result = bulkUpload('customer_master', params.customers); break;
      case 'updateCustomer': result = updateRow('customer_master', 'PARTY_CODE', params); break;
      case 'deleteCustomer': result = deleteRow('customer_master', 'PARTY_CODE', params.PARTY_CODE); break;
      
      case 'addProduct': result = addRow('product_master', params); break;
      case 'bulkUploadProducts': result = bulkUpload('product_master', params.products); break;
      case 'updateProduct': result = updateRow('product_master', 'QLTY_CODE', params); break;
      case 'deleteProduct': result = deleteRow('product_master', 'QLTY_CODE', params.QLTY_CODE); break;

      case 'syncLedger': result = syncLedger(params.rows); break;
      case 'getReports': result = getReports(params.startDate, params.endDate); break;
      case 'restoreArchive': result = restoreArchive(); break;
      
      case 'generatePdfFromTemplate': result = generatePdfFromTemplate(params); break;
      case 'sendEmailWithPdf': result = sendEmailWithPdf(params); break;
      
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
    'users': ["USERNAME", "PASSWORD", "ROLE", "NAME", "STATUS", "MODELS"],
    'user_logs': ["TIMESTAMP", "USERNAME", "ACTION", "MODULE", "DETAILS"],
    'lifting_data': ["LIFTING_ID", "ACCOUNT", "CONTACT", "PI_NO", "TARGET_KG", "DELIVERED_KG", "REMAINING_KG", "COMPLETION", "STATUS", "LAST_DELIVERY_DATE", "LAST_QTY", "HISTORY", "NOTES"],
    'pi_data': ["PI_NO", "INVOICE_DATE", "SELLER_NAME", "SELLER_GSTIN", "SELLER_CIN", "CERT_NO", "CUSTOMER_NAME", "CUSTOMER_ADDRESS", "CUSTOMER_GST_NO", "DELIVERY_NAME", "DELIVERY_ADDRESS", "DELIVERY_GST_NO", "HSN_CODE", "PRODUCT_QUALITY", "UNIT_COUNT", "QUANTITY_KG", "RATE_PER_UNIT", "ITEM_TOTAL", "NET_AMOUNT", "AUTHORIZED_SIGNATORY", "STATUS", "CREATED_AT", "ITEMS", "PAYMENT_TERMS", "NOTE", "TRANSPORT_MODE", "DELIVERY_CHARGES", "CASH_DISCOUNT", "CGST_PERCENT", "SGST_PERCENT", "IGST_PERCENT", "OTHER_CHARGES", "PDF_URL", "PDF_DOWNLOAD_URL", "PDF_ID"],
    'customer_master': ["SL", "PARTY_CODE", "PARTY_NAME", "ADDRESS1", "ADDRESS2", "ADDRESS3", "STATE_CODE", "GSTIN", "PAN_NO", "MOBILE_NO", "EMAIL_ID", "BANK_CODE", "IFSC_BRANCH", "IFSC_CODE", "ACC_NO"],
    'product_master': ["SL", "QLTY_CODE", "QLTY_NAME", "HSN_CODE", "TYPE"],
    'ledger': ["ID", "DATE", "ACCOUNT_PI", "TYPE", "INWARD_TARGET_KG", "OUTWARD_DELIVERED_KG", "BALANCE_KG", "REMARKS"],
    'archive_pi': ["PI_NO", "INVOICE_DATE", "SELLER_NAME", "SELLER_GSTIN", "SELLER_CIN", "CERT_NO", "CUSTOMER_NAME", "CUSTOMER_ADDRESS", "CUSTOMER_GST_NO", "DELIVERY_NAME", "DELIVERY_ADDRESS", "DELIVERY_GST_NO", "HSN_CODE", "PRODUCT_QUALITY", "UNIT_COUNT", "QUANTITY_KG", "RATE_PER_UNIT", "ITEM_TOTAL", "NET_AMOUNT", "AUTHORIZED_SIGNATORY", "STATUS", "CREATED_AT", "ITEMS", "PAYMENT_TERMS", "NOTE", "TRANSPORT_MODE", "DELIVERY_CHARGES", "CASH_DISCOUNT", "CGST_PERCENT", "SGST_PERCENT", "IGST_PERCENT", "OTHER_CHARGES", "ARCHIVED_AT", "PDF_URL", "PDF_DOWNLOAD_URL", "PDF_ID"],
    'archive_lifting': ["LIFTING_ID", "ACCOUNT", "CONTACT", "PI_NO", "TARGET_KG", "DELIVERED_KG", "REMAINING_KG", "COMPLETION", "STATUS", "LAST_DELIVERY_DATE", "LAST_QTY", "HISTORY", "NOTES", "ARCHIVED_AT"]
  };

  for (let sheetName in sheetsConfig) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(sheetsConfig[sheetName]);
    } else {
      // Sheet exists, let's check and append missing headers safely without altering any data
      const lastCol = sheet.getLastColumn();
      let existingHeaders = [];
      if (lastCol > 0) {
        existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
          return String(h).trim();
        });
      }
      
      const missingHeaders = [];
      sheetsConfig[sheetName].forEach(function(h) {
        if (existingHeaders.indexOf(h) === -1) {
          missingHeaders.push(h);
        }
      });
      
      if (missingHeaders.length > 0) {
        // Safe, non-destructive operation: append missing headers at the end of Row 1 
        const startColumn = Math.max(lastCol, 0) + 1;
        sheet.getRange(1, startColumn, 1, missingHeaders.length).setValues([missingHeaders]);
        console.log("Appended missing headers to sheet " + sheetName + ": " + JSON.stringify(missingHeaders));
      }
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
  let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  if (sheetName === 'pi_data' && !params.CREATED_AT) {
    params.CREATED_AT = new Date().toISOString();
  }

  if (params.AUTHORIZED_SIGNATORY && String(params.AUTHORIZED_SIGNATORY).startsWith('data:image')) {
    try {
      const folderId = "1Pq0Fysb38dKR0HLGhBmKXtGlXssFV5AL";
      const folder = DriveApp.getFolderById(folderId);
      const base64Data = params.AUTHORIZED_SIGNATORY.split(',')[1];
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/jpeg', 'Sign_' + new Date().getTime() + '.jpg');
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      params.AUTHORIZED_SIGNATORY = 'https://drive.google.com/uc?id=' + file.getId();
    } catch (e) {
      console.error('Failed to upload signatory image: ', e);
    }
  }

  let headersChanged = false;
  Object.keys(params).forEach(k => {
    if (k !== 'method' && headers.indexOf(k) === -1) {
      headers.push(k);
      sheet.getRange(1, headers.length).setValue(k);
      headersChanged = true;
    }
  });

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
  let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  let headersChanged = false;
  rows.forEach(params => {
    Object.keys(params).forEach(k => {
      if (k !== 'method' && headers.indexOf(k) === -1) {
        headers.push(k);
        sheet.getRange(1, headers.length).setValue(k);
        headersChanged = true;
      }
    });
  });
  
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
  let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (params.AUTHORIZED_SIGNATORY && String(params.AUTHORIZED_SIGNATORY).startsWith('data:image')) {
    try {
      const folderId = "1Pq0Fysb38dKR0HLGhBmKXtGlXssFV5AL";
      const folder = DriveApp.getFolderById(folderId);
      const base64Data = params.AUTHORIZED_SIGNATORY.split(',')[1];
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/jpeg', 'Sign_' + new Date().getTime() + '.jpg');
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      params.AUTHORIZED_SIGNATORY = 'https://drive.google.com/uc?id=' + file.getId();
    } catch (e) {
      console.error('Failed to upload signatory image: ', e);
    }
  }
  
  let headersChanged = false;
  Object.keys(params).forEach(k => {
    if (k !== 'method' && headers.indexOf(k) === -1) {
      headers.push(k);
      sheet.getRange(1, headers.length).setValue(k);
      headersChanged = true;
    }
  });
  
  const data = sheet.getDataRange().getValues();
  // Ensure headers match even if added column
  const currentHeaders = headers; // we mutated headers array above
  const idIndex = currentHeaders.indexOf(idKey);
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIndex]) === String(params[idKey])) {
      const rowRange = sheet.getRange(i + 1, 1, 1, currentHeaders.length);
      const updatedRow = currentHeaders.map((h, idx) => {
        return params[h] !== undefined ? params[h] : (data[i][idx] !== undefined ? data[i][idx] : "");
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

  // 1. Check if PI is already archived to prevent duplicates
  const arcPiData = arcPiSheet.getDataRange().getValues();
  const arcPiHeaders = arcPiData[0];
  const arcPiNoIdx = arcPiHeaders.indexOf('PI_NO');
  let alreadyArchivedPi = false;
  for (let i = 1; i < arcPiData.length; i++) {
    if (String(arcPiData[i][arcPiNoIdx]).trim().toUpperCase() === targetPiNo) {
      alreadyArchivedPi = true;
      break;
    }
  }

  if (!alreadyArchivedPi) {
    const newArcPiRow = arcPiHeaders.map(h => {
      if (h === 'ARCHIVED_AT') return archiveTime;
      const idx = piHeaders.indexOf(h);
      return idx !== -1 ? piRowToArchive[idx] : "";
    });
    arcPiSheet.appendRow(newArcPiRow);
    console.log('PI header archived');
  } else {
    console.log('PI header already in archive, skipping append');
  }

  // 2. Archive associated Lifting data
  const liftDataValues = liftSheet.getDataRange().getValues();
  const liftHeaders = liftDataValues[0];
  const liftPiIdx = liftHeaders.indexOf('PI_NO');
  const arcLiftData = arcLiftSheet.getDataRange().getValues();
  const arcLiftHeaders = arcLiftData[0];
  const arcLiftIdIdx = arcLiftHeaders.indexOf('LIFTING_ID');
  const existingArcLiftIds = new Set(arcLiftData.slice(1).map(r => String(r[arcLiftIdIdx]).trim().toUpperCase()));

  const rowsToRemove = [];
  for (let i = 1; i < liftDataValues.length; i++) {
    const currentLiftPiNo = String(liftDataValues[i][liftPiIdx]).trim().toUpperCase();
    if (currentLiftPiNo === targetPiNo) {
      const liftId = String(liftDataValues[i][liftHeaders.indexOf('LIFTING_ID')]).trim().toUpperCase();
      if (!existingArcLiftIds.has(liftId)) {
        const arcLiftRow = arcLiftHeaders.map(h => {
          if (h === 'ARCHIVED_AT') return archiveTime;
          const idx = liftHeaders.indexOf(h);
          return idx !== -1 ? liftDataValues[i][idx] : "";
        });
        arcLiftSheet.appendRow(arcLiftRow);
      }
      rowsToRemove.push(i + 1);
    }
  }
  console.log('Lifting entries archived: ' + rowsToRemove.length);

  // 3. Mark as COMPLETE in main sheets instead of deleting
  try {
    const piStatusIdx = piHeaders.indexOf('STATUS');
    if (piStatusIdx !== -1) {
      piSheet.getRange(piRowIndex, piStatusIdx + 1).setValue('ARCHIVED');
      console.log('Main PI marked ARCHIVED');
    }
    
    // Batch update lifting statuses
    const liftDataAfterDelete = liftSheet.getDataRange().getValues();
    const liftStatusIdx = liftHeaders.indexOf('STATUS');
    const liftNoIdx = liftHeaders.indexOf('PI_NO');
    
    if (liftStatusIdx !== -1) {
      for (let i = 1; i < liftDataAfterDelete.length; i++) {
        if (String(liftDataAfterDelete[i][liftNoIdx]).trim().toUpperCase() === targetPiNo) {
          liftSheet.getRange(i + 1, liftStatusIdx + 1).setValue('ARCHIVED');
        }
      }
    }
    console.log('Associated lifting records updated to ARCHIVED status');
  } catch (e) {
    console.warn('Failed to update status in main sheet, but archive copy is created: ' + e.message);
  }

  return { success: true, piNo: piNo, archivedAt: archiveTime, liftCount: rowsToRemove.length };
}

function restoreArchive() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = [
    { main: 'pi_data', arc: 'archive_pi', key: 'PI_NO' },
    { main: 'lifting_data', arc: 'archive_lifting', key: 'LIFTING_ID' }
  ];
  
  let totalRestored = 0;
  
  sheets.forEach(conf => {
    const mainSheet = ss.getSheetByName(conf.main);
    const arcSheet = ss.getSheetByName(conf.arc);
    if (!mainSheet || !arcSheet) return;
    
    const mainData = mainSheet.getDataRange().getValues();
    const arcData = arcSheet.getDataRange().getValues();
    if (arcData.length <= 1) return;
    
    const mainHeaders = mainData[0];
    const arcHeaders = arcData[0];
    const mainKeyIdx = mainHeaders.indexOf(conf.key);
    const arcKeyIdx = arcHeaders.indexOf(conf.key);
    
    if (mainKeyIdx === -1 || arcKeyIdx === -1) return;
    
    const mainIds = new Set(mainData.slice(1).map(r => String(r[mainKeyIdx]).trim()));
    
    const toRestore = [];
    for (let i = 1; i < arcData.length; i++) {
      const id = String(arcData[i][arcKeyIdx]).trim();
      if (!mainIds.has(id)) {
        // Map archive row to main headers
        const newRow = mainHeaders.map(h => {
          const idx = arcHeaders.indexOf(h);
          return idx !== -1 ? arcData[i][idx] : "";
        });
        toRestore.push(newRow);
      }
    }
    
    if (toRestore.length > 0) {
      mainSheet.getRange(mainSheet.getLastRow() + 1, 1, toRestore.length, mainHeaders.length).setValues(toRestore);
      totalRestored += toRestore.length;
    }
  });
  
  return { success: true, count: totalRestored };
}

function archiveLiftingEntry(liftingId) {
  if (!liftingId) throw new Error('LIFTING_ID is required');
  const targetId = String(liftingId).trim().toUpperCase();
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const liftSheet = ss.getSheetByName('lifting_data');
  const arcLiftSheet = ss.getSheetByName('archive_lifting');
  
  if (!arcLiftSheet) initializeSheets();

  const liftDataValues = liftSheet.getDataRange().getValues();
  const liftHeaders = liftDataValues[0];
  const liftIdIdx = liftHeaders.indexOf('LIFTING_ID');
  const archiveTime = new Date().toISOString();

  let entryToArchive = null;
  let rowIndex = -1;

  for (let i = 1; i < liftDataValues.length; i++) {
    if (String(liftDataValues[i][liftIdIdx]).trim().toUpperCase() === targetId) {
      entryToArchive = liftDataValues[i];
      rowIndex = i + 1;
      break;
    }
  }

  if (!entryToArchive) throw new Error('Lifting entry not found');

  // Archive to sheet
  const arcHeaders = arcLiftSheet.getDataRange().getValues()[0];
  const arcRow = arcHeaders.map(h => {
    if (h === 'ARCHIVED_AT') return archiveTime;
    const idx = liftHeaders.indexOf(h);
    return idx !== -1 ? entryToArchive[idx] : "";
  });
  arcLiftSheet.appendRow(arcRow);

  // Mark as ARCHIVED in main sheet
  const statusIdx = liftHeaders.indexOf('STATUS');
  if (statusIdx !== -1) {
    liftSheet.getRange(rowIndex, statusIdx + 1).setValue('ARCHIVED');
  }

  return { success: true, archivedId: targetId };
}

function getReports(startDate, endDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Robust date parsing helper
  function parseDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    
    // Handle DD/MM/YYYY or DD-MM-YYYY
    if (typeof dateStr === 'string') {
      const separator = dateStr.includes('/') ? '/' : (dateStr.includes('-') && dateStr.indexOf('-') < 4 ? '-' : null);
      if (separator) {
        const parts = dateStr.split(separator);
        if (parts.length === 3) {
          // Assume DD/MM/YYYY or DD-MM-YYYY
          return new Date(parts[2], parts[1] - 1, parts[0]);
        }
      }
    }
    
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  const start = parseDate(startDate) || new Date(0);
  const end = parseDate(endDate) || new Date();
  end.setHours(23, 59, 59, 999);
  start.setHours(0, 0, 0, 0);

  const activePis = getData('pi_data');
  const activeLifts = getData('lifting_data');
  const arcPis = getData('archive_pi');
  const arcLifts = getData('archive_lifting');

  // Deduplicate records to avoid doubling stats if data exists in both main and archive
  const piMap = new Map();
  [...activePis, ...arcPis].forEach(p => {
    if (p.PI_NO) piMap.set(String(p.PI_NO).trim().toUpperCase(), p);
  });
  const allPis = Array.from(piMap.values());

  const liftMap = new Map();
  [...activeLifts, ...arcLifts].forEach(l => {
    if (l.LIFTING_ID) liftMap.set(String(l.LIFTING_ID).trim().toUpperCase(), l);
  });
  const allLifts = Array.from(liftMap.values());

  // Filtering lifts by last delivery date or history dates
  const filteredLifts = allLifts.filter(l => {
    const d = parseDate(l.LAST_DELIVERY_DATE);
    if (!d) return false;
    return d >= start && d <= end;
  });

  // 1. Customer-wise Summary (Include all customers with any activity)
  const customerDict = {};
  allLifts.forEach(l => {
    const name = l.ACCOUNT || 'Unknown';
    if (!customerDict[name]) customerDict[name] = { account: name, totalDelivered: 0, totalPending: 0 };
    
    const d = parseDate(l.LAST_DELIVERY_DATE);
    const isWithinRange = d && d >= start && d <= end;
    
    const target = Number(l.TARGET_KG) || 0;
    const delivered = Number(l.DELIVERED_KG) || 0;
    const pending = Math.max(0, target - delivered);
    
    if (isWithinRange) {
      customerDict[name].totalDelivered += delivered;
    }
    // Always track pending if it's not completed
    if (l.STATUS !== 'COMPLETE' && pending > 100) {
      customerDict[name].totalPending += pending;
    }
  });

  // 2. PI-wise Summary
  const piDict = {};
  allLifts.forEach(l => {
    const no = l.PI_NO || 'Unknown';
    if (!piDict[no]) piDict[no] = { piNo: no, totalDelivered: 0, totalPending: 0 };
    
    const d = parseDate(l.LAST_DELIVERY_DATE);
    const isWithinRange = d && d >= start && d <= end;
    
    const target = Number(l.TARGET_KG) || 0;
    const delivered = Number(l.DELIVERED_KG) || 0;
    const pending = Math.max(0, target - delivered);
    
    if (isWithinRange) {
      piDict[no].totalDelivered += delivered;
    }
    if (l.STATUS !== 'COMPLETE' && pending > 100) {
      piDict[no].totalPending += pending;
    }
  });

  // 3. Month-wise Trend (Only within range)
  const monthDict = {};
  filteredLifts.forEach(l => {
    const d = parseDate(l.LAST_DELIVERY_DATE);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const name = d.toLocaleString('default', { month: 'short', year: 'numeric' });
    if (!monthDict[key]) monthDict[key] = { period: name, totalDelivered: 0, totalPending: 0 };
    const target = Number(l.TARGET_KG) || 0;
    const delivered = Number(l.DELIVERED_KG) || 0;
    const pending = Math.max(0, target - delivered);
    monthDict[key].totalDelivered += delivered;
    monthDict[key].totalPending += (pending <= 100 ? 0 : pending);
  });

  // 4. Signatory Report
  const sigDict = {};
  allPis.forEach(p => {
    const sig = p.AUTHORIZED_SIGNATORY || 'Unknown';
    if (!sigDict[sig]) sigDict[sig] = { signatory: sig, totalPI: 0, totalQty: 0, pending: 0 };
    sigDict[sig].totalPI++;
    sigDict[sig].totalQty += (Number(p.QUANTITY_KG) || 0);
    if(p.STATUS !== 'COMPLETE') sigDict[sig].pending++;
  });

  return {
    customerWise: Object.values(customerDict),
    piWise: Object.values(piDict),
    monthWise: Object.values(monthDict).sort((a,b) => a.period.localeCompare(b.period)),
    signatoryWise: Object.values(sigDict),
    pendingPIs: activePis.filter(p => p.STATUS !== 'COMPLETE'),
    allLifting: filteredLifts
  };
}

function generatePdfFromTemplate(params) {
  params = params || {};
  const templateId = "1aTszrbxLJ3tumPSVPp0DAIPHJVq4V25E7btV8lwwgTk";
  const folderId = "1gBoluQTF6-ZWYgIzRb5WwEoxb0BXx56c";
  
  // Make a copy of the template
  const destFolder = DriveApp.getFolderById(folderId);
  const newFile = DriveApp.getFileById(templateId).makeCopy(`PI_${params.PI_NO || 'Untitled'}`, destFolder);
  const newSs = SpreadsheetApp.openById(newFile.getId());
  const newSheet = newSs.getSheets()[0];
  
  // Format Date gracefully
  let formattedDate = params.INVOICE_DATE || "";
  if(formattedDate) {
    try {
      const d = new Date(formattedDate);
      if(!isNaN(d.getTime())) {
         const dStr = d.getDate().toString().padStart(2, '0');
         const mStr = (d.getMonth()+1).toString().padStart(2, '0');
         formattedDate = `${dStr}-${mStr}-${d.getFullYear()}`;
      }
    } catch(e) {}
  }
  
  // Replacements Map
  const itemTotalVal = Number(params.ITEM_TOTAL) || 0;
  const cashDiscountPctVal = Number(params.CASH_DISCOUNT) || 0;

  const replacements = {
    "<<PROFORMA INVOICE NO>>": params.PI_NO || " ",
    "<<Date>>": formattedDate || " ",
    "<<Party Name (Customer)>>": [
         params.CUSTOMER_NAME ? (params.CUSTOMER_NAME.startsWith("M/s") ? params.CUSTOMER_NAME : `M/s ${params.CUSTOMER_NAME}`) : "",
         params.CUSTOMER_ADDRESS || "", 
         params.CUSTOMER_GST_NO ? `GSTIN :\t${params.CUSTOMER_GST_NO}` : ""
    ].filter(Boolean).join("\n") || " ",
    "<<DELIVERY>>": [
         params.DELIVERY_NAME ? (params.DELIVERY_NAME.startsWith("M/s") || params.DELIVERY_NAME.startsWith("C/O") ? params.DELIVERY_NAME : `M/s ${params.DELIVERY_NAME}`) : (params.CUSTOMER_NAME ? (params.CUSTOMER_NAME.startsWith("M/s") ? params.CUSTOMER_NAME : `M/s ${params.CUSTOMER_NAME}`) : ""),
         params.DELIVERY_ADDRESS || params.CUSTOMER_ADDRESS || "", 
         params.DELIVERY_GST_NO ? `GSTIN :\t${params.DELIVERY_GST_NO}` : (params.CUSTOMER_GST_NO ? `GSTIN :\t${params.CUSTOMER_GST_NO}` : "")
    ].filter(Boolean).join("\n") || " ",
    "<<currency>>": params.CURRENCY || "Rs",
    "<<Delivery Charges >>": params.DELIVERY_CHARGES || "0.00",
    "<<OTHER_CHARGES>>": params.OTHER_CHARGES || "0.00",
    "<<Payment Terms>>": params.PAYMENT_TERMS || " ",
    "<<Note>>": params.NOTE || " ",
    "<<Consignment Note>>": params.CONSIGNMENT_NOTE || " ",
    "<<Vehicle No>>": params.VEHICLE_NO || " ",
    "<<Transporat Mode>>": params.TRANSPORT_MODE || " "
  };
  
  // Handle Signatory - only insert if it's not a base64 string
  let sig = params.AUTHORIZED_SIGNATORY || "";
  if(sig.indexOf("data:image") !== -1 || sig.indexOf("http") !== -1) {
     sig = "Digitally Signed";
  }
  replacements["<<Digitally signed>>"] = sig || " ";

  // Inject Net Amount since there is no placeholder in the template for it
  let netAmountValue = params.NET_AMOUNT || "0.00";
  try {
     const textFinder = newSheet.createTextFinder("Net Amount : (In Rs.)");
     const found = textFinder.findNext();
     if(found) {
        newSheet.getRange(found.getRow(), found.getColumn() + 9).setValue(netAmountValue);
     }
  } catch(e) {}

  // Extract items
  let items = [];
  try { items = (typeof params.ITEMS === 'string') ? JSON.parse(params.ITEMS) : (params.ITEMS || []); } catch(e) {}
  if (!items || items.length === 0) {
      items.push({ PRODUCT_QUALITY: params.PRODUCT_QUALITY || "", UNIT_COUNT: params.UNIT_COUNT || "", QUANTITY_KG: params.QUANTITY_KG || "", RATE_PER_UNIT: params.RATE_PER_UNIT || "" });
  }

  // Populate dynamic items rows (1 to 7)
  const fn = (val) => val ? Number(val).toFixed(2) : " ";
  for(let i=1; i<=7; i++) {
    const item = items[i-1];
    if (item && item.PRODUCT_QUALITY) {
      replacements[`<<SL${i}>>`] = String(i);
      replacements[`<<HSN CODE${i}>>`] = item.HSN_CODE || " ";
      replacements[`<<HSN_CODE${i}>>`] = item.HSN_CODE || " ";
      replacements[`<<PRODUCT / QUALITY${i}>>`] = item.PRODUCT_QUALITY || " ";
      replacements[`<<Unit${i}>>`] = item.UNIT_COUNT ? String(item.UNIT_COUNT) : " ";
      replacements[`<<Quantity${i}>>`] = fn(item.QUANTITY_KG);
      replacements[`<<Rate${i}>>`] = fn(item.RATE_PER_UNIT);
    } else {
      replacements[`<<SL${i}>>`] = " ";
      replacements[`<<HSN CODE${i}>>`] = " ";
      replacements[`<<HSN_CODE${i}>>`] = " ";
      replacements[`<<PRODUCT / QUALITY${i}>>`] = " ";
      replacements[`<<Unit${i}>>`] = " ";
      replacements[`<<Quantity${i}>>`] = " ";
      replacements[`<<Rate${i}>>`] = " ";
    }
  }

  // Apply replacements iteratively
  for (const key in replacements) {
     let finder = newSheet.createTextFinder(key);
     // To handle possible edge cases we loop, but replaceAllWith usually handles it
     finder.replaceAllWith(replacements[key] || " ");
  }

  // Handle percentage placeholders specifically (so formulas calculate correctly with raw numbers while showing % symbol on PDF)
  const pctPlaceholderConfigs = [
    { key: "<<CASH_DISCOUNT>>", val: cashDiscountPctVal, hasDecimal: String(params.CASH_DISCOUNT).indexOf('.') !== -1 },
    { key: "<<CASH_DISCOUNT%>>", val: cashDiscountPctVal, hasDecimal: String(params.CASH_DISCOUNT).indexOf('.') !== -1 },
    { key: "<<Discount>>", val: cashDiscountPctVal, hasDecimal: String(params.CASH_DISCOUNT).indexOf('.') !== -1 },
    { key: "<<Discount%>>", val: cashDiscountPctVal, hasDecimal: String(params.CASH_DISCOUNT).indexOf('.') !== -1 },
    { key: "<<CGST%>>", val: Number(params.CGST_PERCENT) || 0, hasDecimal: String(params.CGST_PERCENT).indexOf('.') !== -1 },
    { key: "<<SGST%>>", val: Number(params.SGST_PERCENT) || 0, hasDecimal: String(params.SGST_PERCENT).indexOf('.') !== -1 },
    { key: "<<IGST%>>", val: params.IGST_PERCENT !== undefined ? Number(params.IGST_PERCENT) : 5, hasDecimal: String(params.IGST_PERCENT).indexOf('.') !== -1 }
  ];

  pctPlaceholderConfigs.forEach(function(config) {
     var finder = newSheet.createTextFinder(config.key);
     var cell = finder.findNext();
     while (cell) {
        cell.setValue(config.val);
        try {
           if (config.hasDecimal) {
              cell.setNumberFormat('0.00"%"');
           } else {
              cell.setNumberFormat('0"%"');
           }
        } catch (err) {
           // Fallback format if custom format throws
           cell.setNumberFormat('0\\%');
        }
        cell = finder.findNext();
     }
  });
  
  SpreadsheetApp.flush();
  
  // Export PDF 
  const url = newSs.getUrl().replace(/edit$/, '') + 'export?exportFormat=pdf&format=pdf&size=letter&portrait=true&fitw=true&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false&fzr=false';
  const token = ScriptApp.getOAuthToken();
  const response = UrlFetchApp.fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
  const blob = response.getBlob().setName(`PI_${params.PI_NO || 'Untitled'}.pdf`);
  const finalPdf = destFolder.createFile(blob);
  
  // Clean up
  newFile.setTrashed(true);
  finalPdf.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  const pdfUrl = finalPdf.getUrl();
  const pdfDownloadUrl = `https://drive.google.com/uc?export=download&id=${finalPdf.getId()}`;
  const pdfId = finalPdf.getId();

  if (params.PI_NO) {
    try {
      updateRow('pi_data', 'PI_NO', { 
        PI_NO: params.PI_NO,
        PDF_URL: pdfUrl,
        PDF_DOWNLOAD_URL: pdfDownloadUrl,
        PDF_ID: pdfId 
      });
    } catch (e) {
      console.error('Could not save PDF urls to PI row: ' + e.message);
    }
  }

  return {
    pdfUrl: pdfUrl,
    pdfDownloadUrl: pdfDownloadUrl,
    pdfId: pdfId
  };
}

function sendEmailWithPdf(params) {
   const file = DriveApp.getFileById(params.pdfId);
   MailApp.sendEmail(params.emailTo, `Proforma Invoice ${params.PI_NO}`, 'Please find the attached Proforma Invoice.', {
     attachments: [file.getAs(MimeType.PDF)]
   });
   return "Email sent to " + params.emailTo;
}

