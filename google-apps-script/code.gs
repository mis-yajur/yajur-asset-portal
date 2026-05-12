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
