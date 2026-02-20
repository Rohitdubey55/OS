const SPREADSHEET_ID = "1m1r9fZ9cO8izkb-YIs-iz5hZljTpm3p0PzD-LiS0hZM";

function doGet(e) {
  try {
    if (!e.parameter.action || !e.parameter.sheet) {
      return jsonResponse({ success: false, message: "Missing action or sheet parameter" });
    }

    if (e.parameter.action === "get") {
      return getData(e.parameter.sheet);
    }

    return jsonResponse({ success: false, message: "Invalid GET action" });

  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (!body.action || !body.sheet) {
      return jsonResponse({ success: false, message: "Missing action or sheet" });
    }

    if (body.action === "create") {
      return createData(body.sheet, body.payload);
    }

    if (body.action === "update") {
      return updateData(body.sheet, body.id, body.payload);
    }

    if (body.action === "delete") {
      return deleteData(body.sheet, body.id);
    }

    return jsonResponse({ success: false, message: "Invalid POST action" });

  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet not found: " + sheetName);
  return sheet;
}

function getData(sheetName) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return jsonResponse({ success: true, data: [] });
  }

  const headers = values[0];
  const rows = values.slice(1);

  const formatted = rows.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      obj[header] = normalizeOutput(row[i]);
    });
    return obj;
  });

  return jsonResponse({ success: true, data: formatted });
}

function createData(sheetName, payload) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const id = generateId(sheet);
  payload.id = id;

  const row = headers.map(header => normalizeInput(payload[header]));

  sheet.appendRow(row);

  return jsonResponse({ success: true, id: id });
}

function updateData(sheetName, id, payload) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      headers.forEach((header, index) => {
        if (payload.hasOwnProperty(header)) {
          sheet.getRange(i + 1, index + 1)
               .setValue(normalizeInput(payload[header]));
        }
      });
      return jsonResponse({ success: true });
    }
  }

  return jsonResponse({ success: false, message: "ID not found" });
}

function deleteData(sheetName, id) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: true });
    }
  }

  return jsonResponse({ success: false, message: "ID not found" });
}

function generateId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;

  const ids = sheet.getRange(2, 1, lastRow - 1).getValues().flat();
  const numericIds = ids.map(id => parseInt(id)).filter(n => !isNaN(n));

  return numericIds.length ? Math.max(...numericIds) + 1 : 1;
}

/* -------- NORMALIZATION -------- */

function normalizeInput(value) {
  if (value === undefined || value === null) return "";

  // Boolean
  if (value === true || value === false) return value;

  // Date object
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  }

  // ISO datetime string (e.g., "2024-01-15T14:30:00")
  if (typeof value === 'string' && value.includes('T')) {
    // Keep the datetime format
    return value;
  }

  // Date-only string
  if (typeof value === 'string' && /\d{4}-\d{2}-\d{2}/.test(value)) {
    return value;
  }

  return value;
}

function normalizeOutput(value) {
  if (value instanceof Date) {
    // Check if this value has a meaningful time component
    const h = value.getHours();
    const m = value.getMinutes();
    const s = value.getSeconds();
    if (h !== 0 || m !== 0 || s !== 0) {
      // Has time — return full ISO-like datetime string
      const pad = n => String(n).padStart(2, '0');
      const tz = Session.getScriptTimeZone();
      return Utilities.formatDate(value, tz, "yyyy-MM-dd'T'HH:mm:ss");
    }
    // Date-only value
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return value;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/* -------- VISION IMAGE HANDLING -------- */

function getOrCreateVisionImageFolder() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const ssName = ss.getName();
  
  // Check if folder exists
  const folders = DriveApp.getFoldersByName('PersonalOS_Vision_Images');
  if (folders.hasNext()) {
    return folders.next();
  }
  
  // Create new folder
  return DriveApp.createFolder('PersonalOS_Vision_Images');
}

function saveVisionImageToDrive_(base64Data, filename, visionId) {
  try {
    const folder = getOrCreateVisionImageFolder();
    
    // Extract MIME type from base64 if possible
    let mimeType = 'image/jpeg';
    if (base64Data.includes('data:image/png')) mimeType = 'image/png';
    else if (base64Data.includes('data:image/gif')) mimeType = 'image/gif';
    else if (base64Data.includes('data:image/webp')) mimeType = 'image/webp';
    
    // Remove data URL prefix
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    const decoded = Utilities.base64Decode(cleanBase64);
    
    // Create file with unique name
    const uniqueName = visionId + '_' + Date.now() + '_' + filename;
    const file = folder.createFile(uniqueName, decoded, mimeType);
    
    // Make file publicly accessible
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return {
      success: true,
      fileId: file.getId(),
      url: file.getDownloadUrl().replace('=download', ''),
      name: file.getName()
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function deleteVisionImageFromDrive_(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/* -------- REMINDER HELPERS -------- */

function getDueReminders() {
  const sheet = getSheet('reminders');
  const values = sheet.getDataRange().getValues();
  
  if (values.length < 2) return [];
  
  const headers = values[0];
  const now = new Date();
  const due = [];
  
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = normalizeOutput(row[idx]);
    });
    
    // Check if reminder is due
    if (obj.is_active && obj.reminder_datetime) {
      const reminderTime = new Date(obj.reminder_datetime);
      if (reminderTime <= now) {
        due.push(obj);
      }
    }
  }
  
  return due;
}
