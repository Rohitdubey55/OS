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
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
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
