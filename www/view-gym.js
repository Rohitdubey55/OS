/* view-gym.js - Gym Workout Tracker */

let gymData = [];
let gymExercises = [];
let currentGymFilter = 'all';

// Render Gym Page
async function renderGym() {
    const main = document.getElementById('main');
    
    // Show loading skeleton
    main.innerHTML = `
        <div class="view-header">
            <div class="view-title-section">
                <h1 class="view-title">
                    <i data-icon="dumbbell" style="width:28px;height:28px;margin-right:8px;color:var(--primary)"></i>
                    Gym Tracker
                </h1>
                <p class="view-subtitle">Track your workouts and exercises</p>
            </div>
            <button class="btn-primary" onclick="openGymModal()">
                <i data-icon="add" style="width:18px;height:18px;margin-right:6px"></i>
                Log Workout
            </button>
        </div>
        
        <div class="gym-stats-grid" id="gymStats">
            <!-- Stats will be loaded here -->
        </div>
        
        <div class="view-filters">
            <button class="filter-btn active" data-filter="all" onclick="filterGym('all')">All</button>
            <button class="filter-btn" data-filter="strength" onclick="filterGym('strength')">Strength</button>
            <button class="filter-btn" data-filter="cardio" onclick="filterGym('cardio')">Cardio</button>
            <button class="filter-btn" data-filter="flexibility" onclick="filterGym('flexibility')">Flexibility</button>
        </div>
        
        <div class="gym-workouts-list" id="gymWorkoutsList">
            <div class="empty-state">
                <i data-icon="dumbbell" style="width:48px;height:48px;color:var(--text-muted)"></i>
                <h3>No workouts yet</h3>
                <p>Start logging your gym sessions!</p>
            </div>
        </div>
    `;
    
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
    
    // Load data
    await loadGymData();
}

// Load Gym Data
async function loadGymData() {
    try {
        // Try to initialize sheets first (in case they don't exist)
        if (typeof initToolsSheets === 'function') {
            await initToolsSheets();
        }
        
        // Load workouts
        const workoutsResponse = await apiGet('gym_workouts');
        gymData = workoutsResponse || [];
        
        // Load exercises library
        const exercisesResponse = await apiGet('gym_exercises');
        gymExercises = exercisesResponse || [];
        
        renderGymStats();
        renderGymWorkouts();
    } catch (error) {
        console.error('Error loading gym data:', error);
    }
}

// Render Gym Stats
function renderGymStats() {
    const statsContainer = document.getElementById('gymStats');
    if (!statsContainer) return;
    
    const totalWorkouts = gymData.length;
    const thisWeek = gymData.filter(w => {
        const workoutDate = new Date(w.date);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return workoutDate >= weekAgo;
    }).length;
    
    const totalMinutes = gymData.reduce((sum, w) => sum + (parseInt(w.duration_minutes) || 0), 0);
    
    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon" style="background:var(--primary-soft)">
                <i data-icon="dumbbell" style="color:var(--primary)"></i>
            </div>
            <div class="stat-content">
                <span class="stat-value">${totalWorkouts}</span>
                <span class="stat-label">Total Workouts</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon" style="background:var(--success-soft)">
                <i data-icon="calendar" style="color:var(--success)"></i>
            </div>
            <div class="stat-content">
                <span class="stat-value">${thisWeek}</span>
                <span class="stat-label">This Week</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon" style="background:var(--warning-soft)">
                <i data-icon="clock" style="color:var(--warning)"></i>
            </div>
            <div class="stat-content">
                <span class="stat-value">${totalMinutes}</span>
                <span class="stat-label">Total Minutes</span>
            </div>
        </div>
    `;
    
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons({ root: statsContainer });
    }
}

// Render Gym Workouts List
function renderGymWorkouts() {
    const listContainer = document.getElementById('gymWorkoutsList');
    if (!listContainer) return;
    
    const filtered = currentGymFilter === 'all' 
        ? gymData 
        : gymData.filter(w => w.workout_type === currentGymFilter);
    
    // Sort by date descending
    const sorted = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (sorted.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <i data-icon="dumbbell" style="width:48px;height:48px;color:var(--text-muted)"></i>
                <h3>No workouts found</h3>
                <p>${currentGymFilter === 'all' ? 'Start logging your gym sessions!' : 'No ' + currentGymFilter + ' workouts yet'}</p>
            </div>
        `;
    } else {
        listContainer.innerHTML = sorted.map(workout => `
            <div class="workout-card">
                <div class="workout-header">
                    <div class="workout-date">
                        <i data-icon="calendar" style="width:16px;height:16px;margin-right:6px"></i>
                        ${formatDate(workout.date)}
                    </div>
                    <span class="workout-type-badge ${workout.workout_type}">${workout.workout_type || 'workout'}</span>
                </div>
                <div class="workout-details">
                    <div class="workout-exercise">${workout.exercise_name || 'Workout'}</div>
                    <div class="workout-stats">
                        ${workout.sets ? `<span><i data-icon="repeat" style="width:14px;height:14px"></i> ${workout.sets} sets</span>` : ''}
                        ${workout.reps ? `<span><i data-icon="copy" style="width:14px;height:14px"></i> ${workout.reps} reps</span>` : ''}
                        ${workout.weight ? `<span><i data-icon="weight" style="width:14px;height:14px"></i> ${workout.weight} kg</span>` : ''}
                        ${workout.duration_minutes ? `<span><i data-icon="clock" style="width:14px;height:14px"></i> ${workout.duration_minutes} min</span>` : ''}
                    </div>
                    ${workout.notes ? `<div class="workout-notes">${workout.notes}</div>` : ''}
                </div>
                <div class="workout-actions">
                    <button class="icon-btn" onclick="editGymWorkout(${workout.id})">
                        <i data-icon="edit" style="width:16px;height:16px"></i>
                    </button>
                    <button class="icon-btn danger" onclick="deleteGymWorkout(${workout.id})">
                        <i data-icon="delete" style="width:16px;height:16px"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons({ root: listContainer });
    }
}

// Filter Gym
function filterGym(filter) {
    currentGymFilter = filter;
    
    // Update filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    
    renderGymWorkouts();
}

// Open Gym Modal
function openGymModal(workout = null) {
    const isEdit = !!workout;
    const modal = document.getElementById('universalModal');
    const modalBox = modal.querySelector('.modal-box');
    
    modalBox.innerHTML = `
        <div class="modal-header">
            <h2>${isEdit ? 'Edit Workout' : 'Log Workout'}</h2>
            <button class="modal-close" onclick="closeModal()">
                <i data-icon="x" style="width:20px;height:20px"></i>
            </button>
        </div>
        <form class="modal-form" onsubmit="saveGymWorkout(event, ${isEdit ? workout.id : 'null'})">
            <div class="form-group">
                <label>Date</label>
                <input type="date" name="date" value="${workout?.date ? workout.date.split('T')[0] : new Date().toISOString().split('T')[0]}" required>
            </div>
            <div class="form-group">
                <label>Exercise Name</label>
                <input type="text" name="exercise_name" value="${workout?.exercise_name || ''}" placeholder="e.g., Bench Press" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Workout Type</label>
                    <select name="workout_type" required>
                        <option value="strength" ${workout?.workout_type === 'strength' ? 'selected' : ''}>Strength</option>
                        <option value="cardio" ${workout?.workout_type === 'cardio' ? 'selected' : ''}>Cardio</option>
                        <option value="flexibility" ${workout?.workout_type === 'flexibility' ? 'selected' : ''}>Flexibility</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Duration (min)</label>
                    <input type="number" name="duration_minutes" value="${workout?.duration_minutes || ''}" placeholder="30">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Sets</label>
                    <input type="number" name="sets" value="${workout?.sets || ''}" placeholder="3">
                </div>
                <div class="form-group">
                    <label>Reps</label>
                    <input type="number" name="reps" value="${workout?.reps || ''}" placeholder="10">
                </div>
                <div class="form-group">
                    <label>Weight (kg)</label>
                    <input type="number" name="weight" value="${workout?.weight || ''}" placeholder="0">
                </div>
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea name="notes" placeholder="How did it feel?">${workout?.notes || ''}</textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn-primary">${isEdit ? 'Update' : 'Save'} Workout</button>
            </div>
        </form>
    `;
    
    modal.classList.remove('hidden');
    
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons({ root: modalBox });
    }
}

// Save Gym Workout
async function saveGymWorkout(event, id) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const payload = {
        date: formData.get('date'),
        exercise_name: formData.get('exercise_name'),
        workout_type: formData.get('workout_type'),
        duration_minutes: parseInt(formData.get('duration_minutes')) || 0,
        sets: parseInt(formData.get('sets')) || 0,
        reps: parseInt(formData.get('reps')) || 0,
        weight: parseFloat(formData.get('weight')) || 0,
        notes: formData.get('notes')
    };
    
    try {
        let response;
        if (id) {
            response = await apiPost({ action: 'update', sheet: 'gym_workouts', id, payload });
        } else {
            response = await apiPost({ action: 'create', sheet: 'gym_workouts', payload });
        }
        
        if (response.success) {
            closeModal();
            await loadGymData();
            showNotification(id ? 'Workout updated!' : 'Workout logged!', 'success');
        }
    } catch (error) {
        console.error('Error saving workout:', error);
        showNotification('Error saving workout', 'error');
    }
}

// Edit Gym Workout
function editGymWorkout(id) {
    const workout = gymData.find(w => w.id === id);
    if (workout) {
        openGymModal(workout);
    }
}

// Delete Gym Workout
async function deleteGymWorkout(id) {
    if (!confirm('Delete this workout?')) return;
    
    try {
        const response = await apiPost({ action: 'delete', sheet: 'gym_workouts', id });
        if (response.success) {
            await loadGymData();
            showNotification('Workout deleted!', 'success');
        }
    } catch (error) {
        console.error('Error deleting workout:', error);
        showNotification('Error deleting workout', 'error');
    }
}

// Format date helper
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
    });
}

// Close Modal
function closeModal() {
    const modal = document.getElementById('universalModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Show Notification
function showNotification(message, type = 'info') {
    if (typeof toast === 'function') {
        toast(message);
    } else {
        alert(message);
    }
}
