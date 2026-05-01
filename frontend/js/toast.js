function toast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;

  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  el.innerHTML = `<span style="font-size:1rem;opacity:0.9;">${icons[type] || 'ℹ'}</span><span>${message}</span>`;

  container.appendChild(el);

  setTimeout(() => {
    el.style.animation = 'toastSlideOut 0.25s ease forwards';
    setTimeout(() => el.remove(), 250);
  }, duration);
}
