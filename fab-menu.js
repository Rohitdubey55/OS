/* fab-menu.js - Multi-Action FAB Menu (2-Stage) */

let fabMenuOpen = false;

function toggleFABMenu() {
  const menu = document.getElementById('fabMenu');
  const overlay = document.getElementById('fabOverlay');
  const fab = document.querySelector('.fab');

  fabMenuOpen = !fabMenuOpen;

  if (fabMenuOpen) {
    menu.classList.add('open');
    overlay.classList.add('visible');
    fab.classList.add('open');
    // Reset to Stage 1 every time we open
    showFabStage1();
  } else {
    menu.classList.remove('open');
    overlay.classList.remove('visible');
    fab.classList.remove('open');
  }
}

function closeFABMenu() {
  const menu = document.getElementById('fabMenu');
  const overlay = document.getElementById('fabOverlay');
  const fab = document.querySelector('.fab');

  fabMenuOpen = false;
  menu.classList.remove('open');
  overlay.classList.remove('visible');
  fab.classList.remove('open');
}

function showFabStage1() {
  document.getElementById('fabStage1').classList.remove('hidden');
  document.getElementById('fabStage2').classList.add('hidden');
}

function showFabStage2() {
  document.getElementById('fabStage1').classList.add('hidden');
  document.getElementById('fabStage2').classList.remove('hidden');
  // Re-initialize icons for the newly visible stage
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

function fabAction(type) {
  closeFABMenu();

  // Delegate to existing modal openers
  switch (type) {
    case 'plan':
      if (typeof window.openEventModal === 'function') window.openEventModal();
      else console.error("openEventModal not found");
      break;
    case 'task':
      if (typeof window.openTaskModal === 'function') window.openTaskModal();
      break;
    case 'money':
      if (typeof window.openFinanceAction === 'function') window.openFinanceAction();
      break;
    case 'habit':
      if (typeof window.openHabitModal === 'function') window.openHabitModal();
      break;
    case 'diary':
      if (typeof window.openDiaryModal === 'function') window.openDiaryModal();
      break;
    case 'vision':
      if (typeof window.openVisionModal === 'function') window.openVisionModal();
      break;
  }
}
