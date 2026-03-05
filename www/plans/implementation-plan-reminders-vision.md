# Implementation Plan: Reminders/Alarms & Vision Image Upload

## Executive Summary

This document outlines the implementation plan for adding two major features to PersonalOS:
1. **Reminders/Alarms and Notifications** - A comprehensive reminder system with scheduled alarms and push notifications
2. **Vision Image Upload** - Enhanced image handling for Vision Board with local storage and URL support

---

## PART 1: REMINDERS/ALARMS & NOTIFICATIONS

### 1.1 Architecture Overview

The notification system will use a hybrid approach:
- **Browser Notifications API** - For web push notifications (requires HTTPS)
- **Service Worker** - For background notification handling
- **LocalStorage + IndexedDB** - For offline storage of reminders
- **Google Sheets Backend** - For persistent reminder data

### 1.2 Data Model

#### New Sheet: `reminders`
| Column | Type | Description |
|--------|------|-------------|
| id | String | Unique identifier (UUID) |
| title | String | Reminder title |
| description | String | Optional description |
| reminder_datetime | DateTime | When to trigger |
| repeat_type | String | none/daily/weekly/monthly/yearly |
| repeat_interval | Number | Interval for custom repeats |
| category | String | task/event/habit/general |
| related_item_id | String | ID of linked task/event |
| related_item_type | String | task/calendar/vision/habit |
| is_active | Boolean | Enable/disable |
| notification_sound | String | Sound file reference |
| notification_method | String | browser/in-app/both |
| created_at | DateTime | Creation timestamp |

### 1.3 Implementation Components

#### 1.3.1 Backend (Code.gs)
```
Functions to add:
- doGet_reminders() - Serve reminder data
- remindersPOST_(action, payload, id) - Handle CRUD operations
- getRemindersByDateRange(start, end) - Query reminders
- getDueReminders() - Get currently due reminders
```

#### 1.3.2 Frontend - New File: `view-reminders.js`
```
Core Functions:
- renderRemindersView() - Main view rendering
- renderReminderCard(reminder) - Individual reminder display
- renderRemindersList(filter) - Filtered list view
- openReminderModal(id?) - Create/edit modal
- saveReminder(data) - Save to backend
- deleteReminder(id) - Delete reminder
- toggleReminderActive(id) - Enable/disable
- getReminderById(id) - Fetch single reminder
- checkRemindersDue() - Check for due reminders (polling)

UI Components:
- Reminder creation form with:
  - Title input
  - Description textarea
  - Date/time picker
  - Repeat options (none/daily/weekly/monthly/custom)
  - Category selector
  - Link to existing items (tasks, calendar, vision, habits)
  - Sound selection
  - Notification method toggle
```

#### 1.3.3 Notification Service - New File: `notification-service.js`
```
Core Functions:
- requestNotificationPermission() - Browser permission request
- showBrowserNotification(title, options) - Push notification
- scheduleNotification(reminder) - Schedule local notification
- cancelScheduledNotification(id) - Cancel scheduled
- checkAndTriggerReminders() - Main checker (runs every minute)
- playNotificationSound(soundId) - Audio feedback
- showInAppNotification(message, type) - Fallback toast notification

State Management:
- notificationPermission: 'default'|'granted'|'denied'
- scheduledNotifications: Map<id, timeout>
- lastCheck: timestamp
```

#### 1.3.4 Service Worker Updates - `sw.js`
```
Add:
- Notification click handler
- Background sync for offline reminders
- Push subscription management
```

### 1.4 User Interface Flow

#### Settings Panel (view-settings.js)
```
New Section: "Notifications"
├── Enable Notifications Toggle
├── Notification Sound Selector
├── Default Reminder Lead Time (5/10/15/30 min)
├── Quiet Hours Start/End
└── Notification Methods (Browser/In-App)
```

#### Quick Add Reminder FAB
```
- Floating action button on dashboard
- Quick add: title + time + confirm
- Opens full modal on tap
```

#### In-Context Reminders
```
Tasks View:
- Add "Remind me" button on each task
- Opens reminder modal pre-linked to task

Calendar View:
- Add alarm icon on events
- Quick set: 5min/15min/30min/1hr before

Vision View:
- Add reminder on goal target dates
- Progress milestone notifications

Habits View:
- Daily habit reminder notifications
```

### 1.5 Notification Delivery Mechanisms

| Method | Description | Requirements |
|--------|-------------|--------------|
| Browser Push | Native OS notification | HTTPS + permission |
| In-App Toast | Custom toast overlay | App open |
| Audio Alert | Sound playback | User interaction first |
| Email (Optional) | Gmail integration | OAuth scope |

### 1.6 Polling & Background Handling

```
// Check frequency: Every 60 seconds when app is open
// Service Worker: Every 15 minutes in background (if supported)

// Fallback for inactive tabs:
// - Use visibilitychange event
// - Store last check time in localStorage
// - On tab focus, check if any reminders missed
```

---

## PART 2: VISION IMAGE UPLOAD

### 2.1 Architecture Overview

The Vision Board currently uses URL-based images. We'll enhance this with:
- **Local File Upload** - Convert to Base64 or store in Google Drive
- **URL Import** - Direct URL with validation
- **Google Drive Integration** - For larger file storage
- **Image Management Sheet** - Track all uploaded images

### 2.2 Data Model

#### New Sheet: `vision_images`
| Column | Type | Description |
|--------|------|-------------|
| id | String | Unique identifier |
| vision_id | String | Linked vision goal ID |
| image_url | String | Google Drive URL or base64 (small) |
| thumbnail_url | String | Optimized thumbnail |
| source_type | String | upload/url/default |
| original_filename | String | Original file name |
| file_size | Number | Size in bytes |
| width/height | Number | Dimensions |
| uploaded_at | DateTime | Upload timestamp |
| is_primary | Boolean | Primary image for goal |

#### Update Existing: `vision_board` sheet
| Column | Type | Description |
|--------|------|-------------|
| image_url | String | Primary image URL (existing) |
| image_source | String | upload/url/default |
| images_array | JSON | Array of additional images |

### 2.3 Implementation Components

#### 2.3.1 Backend (Code.gs)
```
New Functions:
- doGet_visionImages() - Get images for vision
- visionImagesPOST_(action, payload, id) - CRUD for images
- uploadVisionImage_(fileData, visionId) - Handle base64 upload
- getVisionImageUrl_(id) - Get public URL
- deleteVisionImage_(id) - Remove image

Drive Integration:
- createVisionImageFolder_() - Create dedicated folder
- saveToDrive_(base64, filename, mimeType) - Save to Drive
- getDriveUrl_(fileId) - Generate shareable link
```

#### 2.3.2 Frontend - Update: `view-vision.js`

**New Modal: Image Upload Sheet**
```javascript
window.openVisionImageSheet = function(visionId) {
  const modal = document.getElementById('universalModal');
  const box = modal.querySelector('.modal-box');
  
  box.innerHTML = `
    <h3>Add Image</h3>
    
    <!-- Tab Navigation -->
    <div class="image-source-tabs">
      <button class="tab-btn active" onclick="switchImageSource('upload')">
        📁 Upload from Device
      </button>
      <button class="tab-btn" onclick="switchImageSource('url')">
        🔗 Add from URL
      </button>
    </div>
    
    <!-- Upload Tab -->
    <div id="imageUploadTab" class="source-tab active">
      <div class="upload-zone" id="dropZone">
        <input type="file" id="visionFileInput" accept="image/*" hidden>
        <div class="upload-prompt">
          <i data-lucide="upload-cloud" style="width:48px"></i>
          <p>Tap to select or drag & drop</p>
          <span class="upload-hint">PNG, JPG, GIF - Max 10MB</span>
        </div>
      </div>
      <div id="uploadPreview" class="upload-preview hidden">
        <img id="previewImage" src="" alt="Preview">
        <div class="preview-info">
          <span id="previewName"></span>
          <span id="previewSize"></span>
        </div>
      </div>
    </div>
    
    <!-- URL Tab -->
    <div id="imageUrlTab" class="source-tab">
      <input type="url" id="visionImageUrl" class="input" 
             placeholder="https://example.com/image.jpg">
      <button class="btn secondary" onclick="loadImageFromUrl()">
        Load Preview
      </button>
      <div id="urlPreview" class="url-preview hidden">
        <img id="urlPreviewImage" src="" alt="Preview">
      </div>
    </div>
    
    <!-- Actions -->
    <div class="modal-actions">
      <button class="btn" onclick="closeUniversalModal()">Cancel</button>
      <button class="btn primary" onclick="saveVisionImage('${visionId}')">
        Save Image
      </button>
    </div>
  `;
}
```

**File Input Handling**
```javascript
window.handleVisionFileSelect = function(files) {
  const file = files[0];
  if (!file) return;
  
  // Validate
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    showToast('Invalid file type. Use PNG, JPG, GIF, or WebP', 'error');
    return;
  }
  
  if (file.size > 10 * 1024 * 1024) {
    showToast('File too large. Max 10MB', 'error');
    return;
  }
  
  // Read and preview
  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result;
    // Store for saving
    window.pendingVisionImage = {
      data: base64,
      filename: file.name,
      type: file.type,
      size: file.size
    };
    // Show preview
    document.getElementById('previewImage').src = base64;
    document.getElementById('previewName').textContent = file.name;
    document.getElementById('previewSize').textContent = formatFileSize(file.size);
    document.getElementById('uploadPreview').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}
```

**URL Validation & Loading**
```javascript
window.loadImageFromUrl = function() {
  const url = document.getElementById('visionImageUrl').value;
  if (!url) {
    showToast('Enter a valid URL', 'error');
    return;
  }
  
  // Validate URL format
  try {
    new URL(url);
  } catch (e) {
    showToast('Invalid URL format', 'error');
    return;
  }
  
  // Load preview
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    window.pendingVisionImage = {
      url: url,
      width: img.width,
      height: img.height
    };
    document.getElementById('urlPreviewImage').src = url;
    document.getElementById('urlPreview').classList.remove('hidden');
  };
  img.onerror = () => {
    showToast('Could not load image. Check URL or CORS settings.', 'error');
  };
  img.src = url;
}
```

**Save Image**
```javascript
window.saveVisionImage = async function(visionId) {
  const img = window.pendingVisionImage;
  if (!img) {
    showToast('No image selected', 'error');
    return;
  }
  
  showToast('Saving image...');
  
  try {
    let payload;
    
    if (img.data) {
      // Upload from device - send to backend
      payload = {
        vision_id: visionId,
        image_data: img.data,  // Base64
        filename: img.filename,
        mime_type: img.type,
        source_type: 'upload'
      };
      await apiCall('create', 'vision_images', payload);
    } else if (img.url) {
      // URL source - just update vision
      payload = {
        image_url: img.url,
        image_source: 'url'
      };
      await apiCall('update', 'vision_board', payload, visionId);
    }
    
    // Refresh vision data
    await refreshData('vision');
    closeUniversalModal();
    showToast('Image saved successfully!');
    
  } catch (error) {
    console.error(error);
    showToast('Error saving image', 'error');
  }
}
```

### 2.4 UI/UX Enhancements

#### Vision Card Updates
```
- Click to view detail (existing)
- Long-press/right-click context menu:
  - Change Image
  - View All Images
  - Remove Image
```

#### Image Gallery View (New)
```
- Modal showing all images for a vision goal
- Swipeable carousel
- Add/remove images
- Set primary image
```

### 2.5 Storage Strategy

| Image Size | Storage Method |
|------------|----------------|
| < 500KB | Base64 in sheet cell |
| 500KB - 2MB | Google Drive (recommended) |
| > 2MB | Google Drive with compression |

### 2.6 Error Handling

```
1. Network failure during upload:
   - Queue locally in IndexedDB
   - Retry on reconnect
   - Show pending indicator

2. Invalid URL/CORS:
   - Show clear error message
   - Suggest using upload instead

3. File too large:
   - Show size limit
   - Offer compression option

4. Upload timeout:
   - Chunk upload for large files
   - Show progress indicator
```

---

## PART 3: INTEGRATION POINTS

### 3.1 Navigation Updates (main.js)
```javascript
// Add reminders to SHEETS constant
const SHEETS = {
  // ... existing
  reminders: 'reminders',
  vision_images: 'vision_images'
};

// Add to data initialization
state.data.reminders = [];
state.data.vision_images = [];

// Add route handler
case 'reminders': renderRemindersView(); break;
```

### 3.2 Settings Panel Integration
```
Add to view-settings.js:
- Notification preferences section
- Reminder defaults
- Image upload settings
```

### 3.3 Dashboard Widget
```
Add to view-dashboard.js:
- Upcoming reminders widget
- Quick add reminder button
```

### 3.4 Calendar Integration
```
Add to view-calendar.js:
- Show reminders as all-day events
- Click to edit reminder
- Add alarm buttons on events
```

---

## PART 4: IMPLEMENTATION PHASES

### Phase 1: Foundation (Week 1)
- [ ] Create reminders sheet and backend API
- [ ] Implement notification service core
- [ ] Add browser notification permissions flow
- [ ] Basic reminder CRUD operations

### Phase 2: UI Implementation (Week 2)
- [ ] Create view-reminders.js with full UI
- [ ] Add reminder settings in view-settings.js
- [ ] Integrate with tasks and calendar views
- [ ] Dashboard widget for upcoming reminders

### Phase 3: Vision Image Upload (Week 3)
- [ ] Create vision_images sheet
- [ ] Implement upload modal with tabs
- [ ] URL validation and preview
- [ ] Backend file handling (Drive integration)

### Phase 4: Polish & Testing (Week 4)
- [ ] Error handling and edge cases
- [ ] Offline support
- [ ] Performance optimization
- [ ] User testing and feedback

---

## PART 5: TESTING CHECKLIST

### Reminders Feature
- [ ] Create reminder with all options
- [ ] Edit existing reminder
- [ ] Delete reminder
- [ ] Repeat functionality works
- [ ] Notification appears at correct time
- [ ] Sound plays correctly
- [ ] Browser notification permission flow
- [ ] Quiet hours respected
- [ ] Link to tasks/calendar works
- [ ] Offline reminder storage works

### Vision Image Upload
- [ ] Upload image from device
- [ ] Preview before save
- [ ] Add image from URL
- [ ] URL validation and error handling
- [ ] Image displays in vision card
- [ ] Multiple images per goal
- [ ] Delete/replace image
- [ ] Large file handling
- [ ] Works on mobile (touch events)

---

## APPENDIX: FILE CHANGES SUMMARY

### New Files to Create
1. `view-reminders.js` - Reminder management UI
2. `notification-service.js` - Notification handling
3. `styles/reminders.css` - Reminder-specific styles

### Files to Modify
1. `Code.gs` - Backend API for reminders & images
2. `main.js` - Add to SHEETS, routing, data loading
3. `view-settings.js` - Notification preferences
4. `view-vision.js` - Add image upload modal
5. `view-tasks.js` - Link reminders to tasks
6. `view-calendar.js` - Add alarms to events
7. `view-dashboard.js` - Add reminders widget
8. `index.html` - Add script includes
9. `sw.js` - Service worker updates

### Google Sheets to Create
1. `reminders` - Store reminder data
2. `vision_images` - Store uploaded images metadata

---

*Plan Version: 1.0*
*Created: Based on PersonalOS codebase analysis*
