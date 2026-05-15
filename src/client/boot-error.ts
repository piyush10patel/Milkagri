(function () {
  const root = document.getElementById('root');
  function showBootError(message) {
    if (!root) return;

    const errorDiv = document.createElement('div');
    errorDiv.className = 'boot-error-container';
    errorDiv.style.padding = '16px';
    errorDiv.style.fontFamily = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    errorDiv.style.color = '#991b1b';
    errorDiv.style.background = '#fef2f2';
    errorDiv.style.border = '1px solid #fecaca';
    errorDiv.style.borderRadius = '8px';
    errorDiv.style.margin = '16px';

    const h2 = document.createElement('h2');
    h2.textContent = 'App failed to load';
    h2.style.margin = '0 0 8px 0';
    h2.style.fontSize = '16px';

    const p = document.createElement('p');
    p.textContent = message;
    p.style.margin = '0';
    p.style.fontSize = '14px';
    p.style.lineHeight = '1.4';

    errorDiv.appendChild(h2);
    errorDiv.appendChild(p);
    root.innerHTML = '';
    root.appendChild(errorDiv);
  }

  window.addEventListener('error', function (event) {
    const msg = event && event.message ? event.message : 'Unknown JavaScript error';
    showBootError(msg);
  });

  window.addEventListener('unhandledrejection', function (event) {
    const reason = event && event.reason ? String(event.reason) : 'Unhandled promise rejection';
    showBootError(reason);
  });
})();
