const SPREADSHEET_ID = "1m1r9fZ9cO8izkb-YIs-iz5hZljTpm3p0PzD-LiS0hZM";
const CACHE_KEY = "app_data_cache";
const CACHE_TTL = 21600; // 6 hours
const CACHE_MAX_SIZE = 95000; // CacheService limit is ~100KB, using 95KB for safety

/* -------- AUTOMATIC SCHEMA INITIALIZATION -------- */
// Defines the exact required columns for every single module in PersonalOS
const SCHEMA = {
  "planner_events": ["id", "title", "start_datetime", "end_datetime", "category"],
  "tasks": ["id", "title", "due_date", "due_time", "priority", "status", "notes", "description", "category", "tags", "vision_id", "recurrence", "recurrence_days", "recurrence_end", "completed_dates", "duration", "subtasks", "pomodoro_estimate", "pomodoro_length"],
  "expenses": ["id", "date", "amount", "category", "description", "type"],
  "habits": ["id", "habit_name", "frequency", "streak", "reminder_time", "emoji", "pomodoro_sessions", "pomodoro_length", "alarm_enabled", "routine"],
  "habit_logs": ["id", "habit_id", "date", "status", "pomodoro_completed"],
  "diary": ["id", "date", "content", "mood", "tags"],
  "vision_board": ["id", "category", "title", "description", "image_url", "target_date", "progress", "status", "notes", "linked_habits", "created_at", "updated_at", "video_url", "month_focus"],
  "settings": ["id", "name", "dob", "morning_message", "afternoon_message", "evening_message", "weekly_budget", "monthly_budget", "category_budgets", "theme_color", "theme_mode", "orientation_lock", "ai_api_key", "ai_model", "nav_layout", "dashboard_config", "kpi_config", "notification_enabled", "notification_sound", "notification_method", "quiet_hours_start", "quiet_hours_end", "diary_default_mood", "diary_show_tasks", "diary_show_habits", "diary_show_expenses", "task_default_view", "task_categories", "habit_routines", "elevenlabs_api_key", "elevenlabs_voice_id", "tts_provider", "tts_voice_id"],
  "funds": ["id", "name", "balance", "type", "currency"],
  "assets": ["id", "name", "value", "purchase_date", "notes"],
  "people": ["id", "name", "relationship", "birthday", "phone", "email", "instagram", "last_contact", "next_interaction", "is_favorite", "is_priority", "notes"],
  "people_debts": ["id", "person_id", "amount", "type", "date", "notes"],
  "reminders": ["id", "title", "reminder_datetime", "is_active", "linked_item_id"],
  "diary_templates": ["id", "title", "content", "category", "is_default", "sort_order"],
  "diary_tags": ["id", "name", "color", "usage_count", "created_at"],
  "diary_achievements": ["id", "type", "name", "description", "target_value", "unlocked_at"],
  "gym_workouts": ["id", "date", "exercise_name", "workout_type", "duration_minutes", "sets", "reps", "weight", "notes"],
  "gym_exercises": ["id", "name", "muscle_group", "equipment", "description"],
  "notes": ["id", "title", "content", "category", "created_at", "updated_at", "is_pinned", "tags"],
  "vision_images": ["id", "vision_id", "file_id", "url", "name", "uploaded_at"],
  "pomodoro_settings": ["id", "work_duration", "short_break", "long_break", "long_break_interval", "sound_work", "sound_break", "auto_start_break", "background_mode"],
  "pomodoro_sessions": ["id", "date", "type", "duration", "habit_id", "task_id", "completed"],
  "pomodoro_badges": ["id", "user_id", "badge_type", "unlocked_at", "total_sessions"],
  "vision_tdp": ["id", "start_date", "end_date", "status", "categories_json", "created_at"],
  "book_library": ["id", "title", "author", "cover_url", "category", "status", "date_added", "date_completed", "rating", "notes", "linked_goals", "tags"],
  "book_summaries": ["id", "book_id", "book_title", "author", "summary_json", "total_pages", "created_at", "linked_vision_ids", "key_takeaways", "action_items", "memorable_quotes"],
  "reader_settings": ["id", "background_color", "font_color", "font_family", "font_size", "line_spacing", "fullscreen_mode", "page_animation", "auto_save_position"],
  "mural_projects": ["id", "title", "category", "created_at", "updated_at", "bg_pattern", "bg_color"],
  "mural_categories": ["id", "name", "color"],
  "mural_elements": ["id", "project_id", "type", "x", "y", "w", "h", "content", "color", "z_index", "shape", "from_id", "to_id", "connector_style", "from_side", "to_side", "line_style", "arrow_mode"],
  "vision_affirmations": ["id", "vision_id", "text", "order", "bg_style", "is_pinned", "created_at", "is_favorite", "favorite_at", "duration", "media_key", "audio_url"],
  "ritual_logs": ["id", "date", "duration_seconds", "affirmation_count", "mood_after", "completed"],
  "english_sessions": ["id", "date", "duration_seconds", "topic", "level", "score", "weak_areas", "strong_areas", "summary", "message_count"],
  "english_messages": ["id", "session_id", "role", "content", "correction", "feedback", "timestamp"]
};

/**
 * Utility to force-sync all schemas. 
 * Can be run manually from the script editor if headers get out of sync.
 */
function resyncAllSchemas() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  Object.keys(SCHEMA).forEach(sheetName => {
    Logger.log(`Checking ${sheetName}...`);
    ensureSheetExists(sheetName);
  });
  
  return "Resync complete. Check execution logs in Apps Script for details.";
}

/**
 * Ensures a sheet exists and has the correct headers based on the SCHEMA.
 * If the sheet exists but is missing columns, it appends the missing headers.
 * If the sheet doesn't exist, it creates it and writes the headers.
 */
function ensureSheetExists(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  
  // 1. Create sheet if missing
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  const requiredHeaders = SCHEMA[sheetName];
  if (!requiredHeaders) return sheet;

  // 2. Identify and add missing headers (Self-Healing)
  if (sheet.getLastColumn() === 0) {
    // Brand new sheet
    sheet.appendRow(requiredHeaders);
  } else {
    // Existing sheet: check for missing columns
    const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const missingHeaders = requiredHeaders.filter(h => !currentHeaders.includes(h));
    
    if (missingHeaders.length > 0) {
      console.log(`Self-Healing: Adding missing columns to ${sheetName}: ${missingHeaders.join(', ')}`);
      const nextCol = sheet.getLastColumn() + 1;
      const headerRange = sheet.getRange(1, nextCol, 1, missingHeaders.length);
      headerRange.setValues([missingHeaders]);
    }
  }

  // 3. Aesthetic formatting for the header row
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#f3f4f6"); // Light gray background
  sheet.setFrozenRows(1);
  
  // Auto-resize columns for better readability if it's a new or healed sheet
  try {
     sheet.autoResizeColumns(1, sheet.getLastColumn());
  } catch(e) {}
  
  return sheet;
}

function doGet(e) {
  try {
    // ── Bulk fetch: ?action=getAll — returns ALL sheets in one response ──
    if (e.parameter.action === "getAll") {
      if (e.parameter.force === "true") {
        console.log("Force refresh requested. Clearing cache...");
        clearCache();
      }
      return getAllData();
    }

    if (!e.parameter.action || !e.parameter.sheet) {
      return jsonResponse({ success: false, message: "Missing action or sheet parameter" });
    }

    if (e.parameter.action === "get") {
      return getData(e.parameter.sheet);
    }

    if (e.parameter.action === "init") {
      return jsonResponse(initToolsSheets());
    }

    return jsonResponse({ success: false, message: "Invalid GET action" });

  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Bulk fetch — reads ALL app sheets in a single request.
 * Returns { success: true, data: { planner_events: [...], tasks: [...], ... } }
 */
function getAllData() {
  const cache = CacheService.getScriptCache();
  const cachedData = getLargeCache_(cache, CACHE_KEY);
  
  if (cachedData) {
    console.log("Memory Cache Hit");
    return jsonResponse(JSON.parse(cachedData));
  }

  // Fallback to Persistent Cache (Infinite)
  const persistentData = getLargeProperty_(CACHE_KEY);
  if (persistentData) {
    console.log("Persistent Cache Hit - Re-warming Memory Cache");
    const parsed = JSON.parse(persistentData);
    // Re-warm memory cache for fast subsequent access
    putLargeCache_(cache, CACHE_KEY, persistentData, CACHE_TTL);
    return jsonResponse(parsed);
  }

  console.log("Cache Miss - Full Rebuild Required");
  const data = rebuildCache();
  return jsonResponse(data);
}

/**
 * Logic to fetch all data from sheets and update all cache layers.
 */
function rebuildCache() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = ss.getSheets();
  const result = {};

  sheets.forEach(sheet => {
    const sheetName = sheet.getName();
    try {
      if (sheet.getLastRow() < 2) {
        result[sheetName] = [];
        return;
      }
      if (['language_projects', 'language_sessions'].includes(sheetName)) return;
      
      const values = sheet.getDataRange().getValues();
      const headers = values[0];
      const rows = values.slice(1);
      result[sheetName] = rows.map(row => {
        const obj = {};
        headers.forEach((header, i) => {
          obj[header] = normalizeOutput(row[i]);
        });
        return obj;
      });
    } catch (e) {
      result[sheetName] = [];
    }
  });

  const response = { success: true, data: result, cached_at: new Date().toISOString() };
  const jsonString = JSON.stringify(response);
  
  // Update both Layers
  putLargeCache_(CacheService.getScriptCache(), CACHE_KEY, jsonString, CACHE_TTL);
  putLargeProperty_(CACHE_KEY, jsonString);
  
  return response;
}

/**
 * Triggers on manual edit in the spreadsheet.
 * Rebuilds the cache INSTANTLY so the app is fast when opened.
 */
function onEdit(e) {
  console.log("Eager Rebuild triggered by sheet edit...");
  rebuildCache();
}

/**
 * Manually clear all cache layers.
 */
function clearCache() {
  const cache = CacheService.getScriptCache();
  removeLargeCache_(cache, CACHE_KEY);
  removeLargeProperty_(CACHE_KEY);
  console.log("All cache layers cleared.");
}

/**
 * Helper to store large strings in cache by chunking.
 */
function putLargeCache_(cache, key, value, ttl) {
  const chunks = {};
  const meta = { numChunks: 0 };
  for (let i = 0; i < value.length; i += CACHE_MAX_SIZE) {
    const chunk = value.substring(i, i + CACHE_MAX_SIZE);
    chunks[key + "_" + meta.numChunks] = chunk;
    meta.numChunks++;
  }
  cache.putAll(chunks, ttl);
  cache.put(key + "_meta", JSON.stringify(meta), ttl);
}

/**
 * Helper to retrieve chunked strings from cache.
 */
function getLargeCache_(cache, key) {
  const metaStr = cache.get(key + "_meta");
  if (!metaStr) return null;
  const meta = JSON.parse(metaStr);
  const keys = [];
  for (let i = 0; i < meta.numChunks; i++) keys.push(key + "_" + i);
  const chunks = cache.getAll(keys);
  let result = "";
  for (let i = 0; i < meta.numChunks; i++) {
    const chunk = chunks[key + "_" + i];
    if (!chunk) return null;
    result += chunk;
  }
  return result;
}

/**
 * Helper to remove chunked strings from cache.
 */
function removeLargeCache_(cache, key) {
  const metaStr = cache.get(key + "_meta");
  if (!metaStr) return;
  const meta = JSON.parse(metaStr);
  const keys = [key + "_meta"];
  for (let i = 0; i < meta.numChunks; i++) keys.push(key + "_" + i);
  cache.removeAll(keys);
}

/**
 * PropertiesService (Persistent Storage) Helpers
 */
function putLargeProperty_(key, value) {
  const props = PropertiesService.getScriptProperties();
  const meta = { numChunks: 0 };
  const CHUNK_SIZE = 8000; // PropertiesService limit is ~9KB
  
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    const chunk = value.substring(i, i + CHUNK_SIZE);
    props.setProperty(key + "_" + meta.numChunks, chunk);
    meta.numChunks++;
  }
  props.setProperty(key + "_meta", JSON.stringify(meta));
}

function getLargeProperty_(key) {
  const props = PropertiesService.getScriptProperties();
  const metaStr = props.getProperty(key + "_meta");
  if (!metaStr) return null;
  
  const meta = JSON.parse(metaStr);
  let result = "";
  for (let i = 0; i < meta.numChunks; i++) {
    const chunk = props.getProperty(key + "_" + i);
    if (!chunk) return null;
    result += chunk;
  }
  return result;
}

function removeLargeProperty_(key) {
  const props = PropertiesService.getScriptProperties();
  const metaStr = props.getProperty(key + "_meta");
  if (!metaStr) return;
  
  const meta = JSON.parse(metaStr);
  props.deleteProperty(key + "_meta");
  for (let i = 0; i < meta.numChunks; i++) {
    props.deleteProperty(key + "_" + i);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (!body.action) {
      return jsonResponse({ success: false, message: "Missing action" });
    }

    // Sheet is required for standard CRUD, but optional for some custom actions
    if (!body.sheet && !['deleteMuralProject', 'syncMuralElements', 'repairMural', 'init', 'uploadAudio', 'downloadAudio', 'uploadMedia', 'downloadMedia'].includes(body.action)) {
      return jsonResponse({ success: false, message: "Missing sheet" });
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

    if (body.action === "deleteMuralProject") {
      return deleteMuralProjectComplete(body.id);
    }

    if (body.action === "syncMuralElements") {
      const payload = body.payload || {};
      return syncMuralElements(payload.project_id, payload.elements);
    }

    if (body.action === "repairMural") {
      return jsonResponse(migrateAndCleanupMuralData());
    }

    // ── Upload audio file to Google Drive (POS/audio/ folder) ──
    if (body.action === "uploadAudio") {
      try {
        var p = body.payload || {};
        if (!p.filename || !p.data) {
          return jsonResponse({ success: false, message: "Missing filename or data" });
        }
        var posFolder = getOrCreateFolder_("POS");
        var audioFolder = getOrCreateSubfolder_(posFolder, "audio");
        var decoded = Utilities.base64Decode(p.data);
        var blob = Utilities.newBlob(decoded, p.mimeType || 'audio/wav', p.filename);
        // Remove old version if exists
        var existing = audioFolder.getFilesByName(p.filename);
        while (existing.hasNext()) existing.next().setTrashed(true);
        var file = audioFolder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        var fileId = file.getId();
        // Store the file ID (not full URL) so we can proxy downloads to avoid CORS
        var audioRef = "drive:" + fileId;
        if (p.aff_id) {
          try { updateData('vision_affirmations', p.aff_id, { audio_url: audioRef }); } catch(e2) {}
        }
        return jsonResponse({ success: true, url: audioRef, file_id: fileId });
      } catch(driveErr) {
        return jsonResponse({ success: false, message: "Drive upload error: " + driveErr.message });
      }
    }

    // ── Download audio from Drive (proxy to avoid CORS) ──
    if (body.action === "downloadAudio") {
      try {
        var dp = body.payload || {};
        var driveFileId = dp.file_id || '';
        // Support both "drive:XXXXX" format and raw file ID
        if (driveFileId.indexOf('drive:') === 0) driveFileId = driveFileId.substring(6);
        if (!driveFileId) {
          return jsonResponse({ success: false, message: "Missing file_id" });
        }
        var driveFile = DriveApp.getFileById(driveFileId);
        var fileBlob = driveFile.getBlob();
        var b64 = Utilities.base64Encode(fileBlob.getBytes());
        return jsonResponse({ success: true, data: b64, mimeType: fileBlob.getContentType() });
      } catch(dlErr) {
        return jsonResponse({ success: false, message: "Download error: " + dlErr.message });
      }
    }

    // ── Upload media (image/video) to Google Drive (POS/media/ folder) ──
    if (body.action === "uploadMedia") {
      try {
        var mp = body.payload || {};
        if (!mp.filename || !mp.data) {
          return jsonResponse({ success: false, message: "Missing filename or data" });
        }
        var posF = getOrCreateFolder_("POS");
        var mediaF = getOrCreateSubfolder_(posF, "media");
        var mDecoded = Utilities.base64Decode(mp.data);
        var mBlob = Utilities.newBlob(mDecoded, mp.mimeType || 'application/octet-stream', mp.filename);
        // Remove old version if exists
        var mExisting = mediaF.getFilesByName(mp.filename);
        while (mExisting.hasNext()) mExisting.next().setTrashed(true);
        var mFile = mediaF.createFile(mBlob);
        mFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        var mFileId = mFile.getId();
        var mRef = "drive:" + mFileId;
        return jsonResponse({ success: true, url: mRef, file_id: mFileId });
      } catch(mediaErr) {
        return jsonResponse({ success: false, message: "Media upload error: " + mediaErr.message });
      }
    }

    // ── Download media from Drive (proxy to avoid CORS) ──
    if (body.action === "downloadMedia") {
      try {
        var mdp = body.payload || {};
        var mDriveId = mdp.file_id || '';
        if (mDriveId.indexOf('drive:') === 0) mDriveId = mDriveId.substring(6);
        if (!mDriveId) {
          return jsonResponse({ success: false, message: "Missing file_id" });
        }
        var mDriveFile = DriveApp.getFileById(mDriveId);
        var mFileBlob = mDriveFile.getBlob();
        var mB64 = Utilities.base64Encode(mFileBlob.getBytes());
        return jsonResponse({ success: true, data: mB64, mimeType: mFileBlob.getContentType() });
      } catch(mdlErr) {
        return jsonResponse({ success: false, message: "Media download error: " + mdlErr.message });
      }
    }

    if (body.action === "init") {
      return jsonResponse(initToolsSheets());
    }

    const res = jsonResponse({ success: false, message: "Invalid POST action" });
    clearCache(); // Ensure cache is cleared on any POST action that might modify data
    return res;

  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// Helper to abstract getting/creating a sheet safely
function getSheet(sheetName) {
  return ensureSheetExists(sheetName);
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
  clearCache();

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
      clearCache();
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
      clearCache();
      return jsonResponse({ success: true });
    }
  }

  return jsonResponse({ success: false, message: "ID not found" });
}

function deleteMuralProjectComplete(projectId) {
  try {
    // 1. Delete project itself
    deleteData('mural_projects', projectId);
    
    // 2. Delete all elements belonging to this project
    const sheet = getSheet('mural_elements');
    const values = sheet.getDataRange().getValues();
    
    // Iterate backwards to safely delete rows
    for (let i = values.length - 1; i >= 1; i--) {
      // project_id is in column 2 (index 1) for mural_elements
      if (String(values[i][1]) === String(projectId)) { 
        sheet.deleteRow(i + 1);
      }
    }
    
    clearCache();
    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
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

/* -------- GOOGLE DRIVE FOLDER HELPERS -------- */

function getOrCreateFolder_(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

function getOrCreateSubfolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
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

/* -------- DIARY ENHANCEMENT SHEETS -------- */

function initDiarySheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Create diary_templates sheet if not exists
  let templatesSheet = ss.getSheetByName('diary_templates');
  if (!templatesSheet) {
    templatesSheet = ss.insertSheet('diary_templates');
    templatesSheet.appendRow(['id', 'title', 'content', 'category', 'is_default', 'sort_order']);
    // Add default templates
    templatesSheet.appendRow([1, 'Gratitude', 'I am grateful for:\n1.\n2.\n3.', 'gratitude', true, 1]);
    templatesSheet.appendRow([2, 'Daily Review', 'Highlights:\nWhat I accomplished:\nWhat I learned:', 'reflection', true, 2]);
    templatesSheet.appendRow([3, 'Goals', 'Today\'s goals:\n1.\n2.\n3.\n\nTomorrow\'s priorities:', 'goals', true, 3]);
    templatesSheet.appendRow([4, 'Mood Check', 'How am I feeling? (1-10)\n\nWhy?', 'reflection', true, 4]);
    templatesSheet.appendRow([5, 'Reflection', 'What went well?\nWhat could be better?\nWhat did I learn?', 'reflection', true, 5]);
  }
  
  // Create diary_tags sheet if not exists
  let tagsSheet = ss.getSheetByName('diary_tags');
  if (!tagsSheet) {
    tagsSheet = ss.insertSheet('diary_tags');
    tagsSheet.appendRow(['id', 'name', 'color', 'usage_count', 'created_at']);
  }
  
  // Create diary_achievements sheet if not exists
  let achievementsSheet = ss.getSheetByName('diary_achievements');
  if (!achievementsSheet) {
    achievementsSheet = ss.insertSheet('diary_achievements');
    achievementsSheet.appendRow(['id', 'type', 'name', 'description', 'target_value', 'unlocked_at']);
    // Add default achievements
    achievementsSheet.appendRow([1, 'streak', 'Week Warrior', 'Write for 7 days in a row', 7, '']);
    achievementsSheet.appendRow([2, 'streak', 'Fortnight Focus', 'Write for 14 days in a row', 14, '']);
    achievementsSheet.appendRow([3, 'streak', 'Monthly Master', 'Write for 30 days in a row', 30, '']);
    achievementsSheet.appendRow([4, 'entries', 'First Step', 'Write your first entry', 1, '']);
    achievementsSheet.appendRow([5, 'entries', 'Getting Started', 'Write 10 entries', 10, '']);
    achievementsSheet.appendRow([6, 'entries', 'Dedicated Writer', 'Write 50 entries', 50, '']);
    achievementsSheet.appendRow([7, 'entries', 'Journal Enthusiast', 'Write 100 entries', 100, '']);
    achievementsSheet.appendRow([8, 'mood', 'Mood Booster', 'Have a 8+ mood 5 times', 5, '']);
    achievementsSheet.appendRow([9, 'mood', 'Consistently Happy', 'Have a 8+ mood 20 times', 20, '']);
  }
  
  return { success: true, message: 'Diary sheets initialized' };
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

/* -------- TOOLS SHEETS INITIALIZATION -------- */

function initToolsSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Create gym_workouts sheet if not exists
  let gymWorkoutsSheet = ss.getSheetByName('gym_workouts');
  if (!gymWorkoutsSheet) {
    gymWorkoutsSheet = ss.insertSheet('gym_workouts');
    gymWorkoutsSheet.appendRow(['id', 'date', 'exercise_name', 'workout_type', 'duration_minutes', 'sets', 'reps', 'weight', 'notes']);
  }
  
  // Create gym_exercises sheet if not exists
  let gymExercisesSheet = ss.getSheetByName('gym_exercises');
  if (!gymExercisesSheet) {
    gymExercisesSheet = ss.insertSheet('gym_exercises');
    gymExercisesSheet.appendRow(['id', 'name', 'muscle_group', 'equipment', 'description']);
    // Add some default exercises
    gymExercisesSheet.appendRow([1, 'Bench Press', 'chest', 'barbell', 'Lie on bench, press barbell up']);
    gymExercisesSheet.appendRow([2, 'Squat', 'legs', 'barbell', 'Stand with bar on shoulders, squat down']);
    gymExercisesSheet.appendRow([3, 'Deadlift', 'back', 'barbell', 'Lift barbell from ground to hip level']);
    gymExercisesSheet.appendRow([4, 'Pull Up', 'back', 'bodyweight', 'Hang from bar, pull body up']);
    gymExercisesSheet.appendRow([5, 'Push Up', 'chest', 'bodyweight', 'Lower body to ground, push back up']);
  }
  
  // Create notes sheet if not exists
  let notesSheet = ss.getSheetByName('notes');
  if (!notesSheet) {
    notesSheet = ss.insertSheet('notes');
    notesSheet.appendRow(['id', 'title', 'content', 'category', 'created_at', 'updated_at', 'is_pinned', 'tags']);
  }
  
  // Create book_library sheet if not exists
  let bookLibrarySheet = ss.getSheetByName('book_library');
  if (!bookLibrarySheet) {
    bookLibrarySheet = ss.insertSheet('book_library');
    bookLibrarySheet.appendRow(SCHEMA['book_library']);
  }
  
  // Create book_summaries sheet if not exists
  let bookSummariesSheet = ss.getSheetByName('book_summaries');
  if (!bookSummariesSheet) {
    bookSummariesSheet = ss.insertSheet('book_summaries');
    bookSummariesSheet.appendRow(SCHEMA['book_summaries']);
  }
  
  // Create reader_settings sheet if not exists
  let readerSettingsSheet = ss.getSheetByName('reader_settings');
  if (!readerSettingsSheet) {
    readerSettingsSheet = ss.insertSheet('reader_settings');
    readerSettingsSheet.appendRow(SCHEMA['reader_settings']);
    // Add default user preferences
    readerSettingsSheet.appendRow(['user_prefs', '#ffffff', '#1a1a1a', 'serif', 18, 1.6, false, 'slide', true]);
  }
  
  return { success: true, message: 'Tools sheets initialized' };
}

/**
 * Bulk sync all elements for a project. 
 * Creates new ones, updates existing ones, and ensures data consistency.
 */
function syncMuralElements(projectId, elements) {
  try {
    const sheet = getSheet('mural_elements');
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const project_id_idx = headers.indexOf('project_id');
    const id_idx = headers.indexOf('id');
    
    if (project_id_idx === -1 || id_idx === -1) {
      return jsonResponse({ success: false, message: "Sheet schema error" });
    }

    // 1. Identify which rows currently belong to this project
    const rowsToDelete = []; // row indices (1-based)
    const existingMap = {};  // id -> row index
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][project_id_idx]) === String(projectId)) {
        const sid = String(values[i][id_idx]);
        existingMap[sid] = i + 1;
        rowsToDelete.push(i + 1);
      }
    }

    // 2. Establish ID mapping for NEW elements
    const idMap = {}; 
    let lastId = generateId(sheet);
    elements.forEach(el => {
      const elId = String(el.id);
      if (elId.startsWith('temp_') && !existingMap[elId]) {
        idMap[elId] = lastId++;
      }
    });

    // 3. Process each element from the payload
    const processedRows = new Set();
    elements.forEach(el => {
      let targetPayload = { ...el };
      const elId = String(el.id);

      // Update connector references if they point to temp IDs
      if (targetPayload.from_id && idMap[String(targetPayload.from_id)]) {
        targetPayload.from_id = idMap[String(targetPayload.from_id)];
      }
      if (targetPayload.to_id && idMap[String(targetPayload.to_id)]) {
        targetPayload.to_id = idMap[String(targetPayload.to_id)];
      }

      if (existingMap[elId]) {
        // UPDATE EXISTING
        const rowIndex = existingMap[elId];
        headers.forEach((header, colIndex) => {
          if (targetPayload.hasOwnProperty(header) && header !== 'id') {
            sheet.getRange(rowIndex, colIndex + 1).setValue(normalizeInput(targetPayload[header]));
          }
        });
        processedRows.add(rowIndex);
      } else {
        // CREATE NEW
        const newId = idMap[elId] || generateId(sheet);
        targetPayload.id = newId;
        const row = headers.map(header => normalizeInput(targetPayload[header]));
        sheet.appendRow(row);
      }
    });

    // 4. Delete rows that were in this project but NOT in the payload (Deletions)
    // Sort descending to avoid index shifts
    const toRemove = rowsToDelete.filter(idx => !processedRows.has(idx)).sort((a, b) => b - a);
    toRemove.forEach(idx => sheet.deleteRow(idx));

    clearCache();
    return jsonResponse({ success: true, message: "Sync complete", idMap: idMap });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * REPAIR Logic: Re-aligns headers and deduplicates data based on the modern SCHEMA.
 */
function migrateAndCleanupMuralData() {
  try {
    const sheet = getSheet('mural_elements');
    const values = sheet.getDataRange().getValues();
    if (values.length < 1) return { success: true, message: "Empty sheet" };

    const oldHeaders = values[0];
    const rows = values.slice(1);
    const newHeaders = SCHEMA.mural_elements;

    // 1. Map data to objects using OLD headers to extract whatever is there
    const objects = rows.map(row => {
      let obj = {};
      oldHeaders.forEach((header, i) => {
        if (header) obj[header.trim()] = row[i];
      });
      return obj;
    });

    // 2. Deduplicate and clean
    const unique = [];
    const seen = new Set();
    
    objects.forEach(obj => {
      // Find project_id even if column was named differently
      const pId = obj.project_id || obj.projectID || obj['Project ID'] || "";
      obj.project_id = pId; 

      // Skip totally empty or trash rows
      if (!pId && !obj.id && !obj.type) return;

      // Create a fingerprint for duplication check (project + type + content + position)
      let finger;
      if (obj.type === 'connector') {
         finger = `${pId}_conn_${obj.from_id}_${obj.to_id}_${obj.from_side}_${obj.to_side}`;
      } else {
         const contentNorm = (obj.content || "").toString().trim().slice(0, 50);
         finger = `${pId}_${obj.type}_${contentNorm}_${Math.round(obj.x || 0)}_${Math.round(obj.y || 0)}`;
      }
      
      if (!seen.has(finger)) {
        seen.add(finger);
        // Ensure ID is a number if it looks like one, to avoid "temp_" staying forever if it accidentally got saved
        if (obj.id && !isNaN(obj.id)) obj.id = parseInt(obj.id);
        unique.push(obj);
      }
    });

    // 3. Clear and rewrite with NEW headers and standardized data
    sheet.clear();
    sheet.appendRow(newHeaders);
    
    unique.forEach(obj => {
      const row = newHeaders.map(h => normalizeInput(obj[h]));
      sheet.appendRow(row);
    });

    return { success: true, message: "Cleanup complete", original: rows.length, final: unique.length };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}
