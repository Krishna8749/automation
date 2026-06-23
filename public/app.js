/* ─────────────────────────────────────────────────────────────
   Premium JS Controller for API Gateway Dashboard
   ───────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const keysCount = document.getElementById('keysCount');
  const keysTableBody = document.getElementById('keysTableBody');
  const emptyState = document.getElementById('emptyState');
  const keyGeneratorForm = document.getElementById('keyGeneratorForm');
  const keyLabelInput = document.getElementById('keyLabelInput');
  const generateKeyBtn = document.getElementById('generateKeyBtn');
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');

  // Load and refresh keys
  async function fetchKeys() {
    try {
      const res = await fetch('/api/keys-mgmt');
      if (!res.ok) throw new Error('Failed to fetch keys');
      const data = await res.json();
      renderKeys(data.keys || []);
    } catch (err) {
      console.error(err);
      showToast('Error loading API keys', 'error');
    }
  }

  // Check server health
  async function checkHealth() {
    try {
      const res = await fetch('/health');
      if (!res.ok) throw new Error('Unhealthy');
      const data = await res.json();
      
      statusIndicator.className = 'status-indicator';
      
      if (data.isInitializing) {
        statusIndicator.classList.add('initializing');
        statusText.textContent = 'Server: Initializing Bot...';
      } else if (data.status === 'healthy') {
        statusIndicator.classList.add('healthy');
        statusText.textContent = 'Server: Online & Ready';
      } else {
        statusIndicator.classList.add('unhealthy');
        statusText.textContent = 'Server: Browser Offline';
      }
    } catch (err) {
      statusIndicator.className = 'status-indicator unhealthy';
      statusText.textContent = 'Server: Disconnected';
    }
  }

  // Render keys array to DOM
  function renderKeys(keys) {
    keysCount.textContent = `${keys.length} Key${keys.length === 1 ? '' : 's'}`;
    
    // Clear all except empty state
    const rows = Array.from(keysTableBody.querySelectorAll('tr'));
    rows.forEach(r => {
      if (r.id !== 'emptyState') r.remove();
    });

    if (keys.length === 0) {
      emptyState.style.display = 'table-row';
      return;
    } else {
      emptyState.style.display = 'none';
    }

    keys.forEach(keyObj => {
      const tr = document.createElement('tr');
      
      // Label
      const tdLabel = document.createElement('td');
      tdLabel.textContent = keyObj.label || 'Unnamed Key';
      tdLabel.style.fontWeight = '500';
      tr.appendChild(tdLabel);

      // Key cell
      const tdKey = document.createElement('td');
      tdKey.className = 'key-cell';
      
      const keySpan = document.createElement('span');
      keySpan.className = 'key-value';
      keySpan.textContent = maskKey(keyObj.key);
      keySpan.dataset.fullKey = keyObj.key;
      keySpan.dataset.masked = 'true';
      tdKey.appendChild(keySpan);

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'btn-icon';
      toggleBtn.title = 'Reveal Key';
      toggleBtn.innerHTML = '<i data-lucide="eye"></i>';
      toggleBtn.onclick = () => toggleKeyVisibility(keySpan, toggleBtn);
      tdKey.appendChild(toggleBtn);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn-icon';
      copyBtn.title = 'Copy Key';
      copyBtn.innerHTML = '<i data-lucide="copy"></i>';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(keyObj.key);
        showToast('API Key copied to clipboard!');
      };
      tdKey.appendChild(copyBtn);

      tr.appendChild(tdKey);

      // Session Thread URL
      const tdSession = document.createElement('td');
      tdSession.className = 'url-cell';
      if (keyObj.url) {
        const link = document.createElement('a');
        link.href = keyObj.url;
        link.target = '_blank';
        link.className = 'chat-link';
        link.innerHTML = `<i data-lucide="external-link" style="width: 14px; height: 14px;"></i> Active Session`;
        tdSession.appendChild(link);
      } else {
        const span = document.createElement('span');
        span.className = 'no-session';
        span.textContent = 'Pending (on 1st prompt)';
        tdSession.appendChild(span);
      }
      tr.appendChild(tdSession);

      // Created Date
      const tdDate = document.createElement('td');
      tdDate.className = 'date-cell';
      tdDate.textContent = formatDate(keyObj.createdAt);
      tr.appendChild(tdDate);

      // Actions
      const tdActions = document.createElement('td');
      tdActions.style.textAlign = 'center';
      
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'action-buttons';

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-icon btn-delete';
      deleteBtn.title = 'Revoke/Delete Key';
      deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
      deleteBtn.onclick = () => deleteKey(keyObj.key, keyObj.label);
      actionsDiv.appendChild(deleteBtn);
      
      tdActions.appendChild(actionsDiv);
      tr.appendChild(tdActions);

      keysTableBody.appendChild(tr);
    });

    // Initialize/refresh Lucide icons
    lucide.createIcons();
  }

  // Key masking
  function maskKey(key) {
    if (key.length <= 12) return '••••••••••••';
    return `${key.slice(0, 7)}••••••••${key.slice(-4)}`;
  }

  // Toggle visible key
  function toggleKeyVisibility(span, btn) {
    const isMasked = span.dataset.masked === 'true';
    if (isMasked) {
      span.textContent = span.dataset.fullKey;
      span.dataset.masked = 'false';
      btn.innerHTML = '<i data-lucide="eye-off"></i>';
      btn.title = 'Hide Key';
    } else {
      span.textContent = maskKey(span.dataset.fullKey);
      span.dataset.masked = 'true';
      btn.innerHTML = '<i data-lucide="eye"></i>';
      btn.title = 'Reveal Key';
    }
    lucide.createIcons();
  }

  // Format Date ISO
  function formatDate(isoStr) {
    if (!isoStr) return 'N/A';
    const date = new Date(isoStr);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  // Delete key
  async function deleteKey(key, label) {
    if (!confirm(`Are you sure you want to revoke key "${label}"?\nThis cannot be undone, and the associated ChatGPT session link will be deleted.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/keys-mgmt/${encodeURIComponent(key)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete key');
      showToast(`Revoked key: ${label}`);
      fetchKeys();
    } catch (err) {
      showToast('Failed to revoke API key', 'error');
    }
  }

  // Handle Form Submission
  keyGeneratorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const label = keyLabelInput.value.trim();
    const customKey = document.getElementById('keyValueInput')?.value.trim() || '';
    if (!label) return;

    generateKeyBtn.disabled = true;
    generateKeyBtn.querySelector('span').textContent = 'Generating...';

    try {
      const res = await fetch('/api/keys-mgmt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ label, key: customKey || undefined })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate key');
      }
      const newKeyObj = await res.json();
      
      keyLabelInput.value = '';
      if (document.getElementById('keyValueInput')) {
        document.getElementById('keyValueInput').value = '';
      }
      showToast(`Key "${label}" generated!`);
      
      // Auto-copy new key to clipboard for maximum user convenience
      if (newKeyObj.key) {
        navigator.clipboard.writeText(newKeyObj.key);
        showToast(`Key "${label}" generated & copied to clipboard!`);
      }

      fetchKeys();
    } catch (err) {
      showToast(err.message || 'Failed to generate API Key', 'error');
    } finally {
      generateKeyBtn.disabled = false;
      generateKeyBtn.querySelector('span').textContent = 'Generate Key';
      lucide.createIcons();
    }
  });

  // Show Toast
  function showToast(message, type = 'success') {
    toastMessage.textContent = message;
    const iconEl = toast.querySelector('.toast-icon');
    
    if (type === 'error') {
      toast.style.border = '1px solid var(--accent-warning)';
      toast.style.boxShadow = '0 10px 30px rgba(244, 63, 94, 0.25)';
      iconEl.setAttribute('data-lucide', 'alert-circle');
      iconEl.style.color = 'var(--accent-warning)';
    } else {
      toast.style.border = '1px solid var(--accent-primary)';
      toast.style.boxShadow = '0 10px 30px rgba(99, 102, 241, 0.25)';
      iconEl.setAttribute('data-lucide', 'check-circle');
      iconEl.style.color = 'var(--accent-success)';
    }
    
    lucide.createIcons();
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }

  // Global helper for simple HTML copy buttons
  window.copyText = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!');
  };

  // Dynamically resolve and bind the gateway URL card
  const gatewayUrl = `${window.location.origin}/v1`;
  const gatewayUrlCode = document.getElementById('gatewayUrlCode');
  if (gatewayUrlCode) {
    gatewayUrlCode.textContent = gatewayUrl;
  }
  const copyUrlBtn = document.getElementById('copyUrlBtn');
  if (copyUrlBtn) {
    copyUrlBtn.onclick = () => copyText(gatewayUrl);
  }

  // Initial loads
  checkHealth();
  fetchKeys();
  checkWhatsAppStatus();

  // Intervals
  setInterval(checkHealth, 5000);
  setInterval(checkWhatsAppStatus, 3000);

  // ── WhatsApp Web Command Relay Functions ──────────────────────
  const whatsappStatusBody = document.getElementById('whatsappStatusBody');

  async function checkWhatsAppStatus() {
    try {
      const res = await fetch('/api/whatsapp/status');
      if (!res.ok) throw new Error('Failed to fetch WhatsApp status');
      const data = await res.json();
      renderWhatsAppStatus(data);
    } catch (err) {
      console.error(err);
      if (whatsappStatusBody) {
        whatsappStatusBody.innerHTML = `
          <div class="wa-error">
            <i data-lucide="alert-triangle" class="wa-error-icon"></i>
            <span>Failed to query WhatsApp status.</span>
          </div>
        `;
        lucide.createIcons();
      }
    }
  }

  function renderWhatsAppStatus(data) {
    if (!whatsappStatusBody) return;

    if (data.status === 'connecting') {
      whatsappStatusBody.innerHTML = `
        <div class="wa-loading">
          <div class="loading-spinner"></div>
          <span>Connecting/Initializing WhatsApp...</span>
        </div>
      `;
    } else if (data.status === 'qr') {
      if (data.qr) {
        whatsappStatusBody.innerHTML = `
          <div class="wa-qr-container">
            <img class="wa-qr-image" src="${data.qr}" alt="WhatsApp QR Code">
            <p>Scan this QR code with WhatsApp on your phone (9872364476) to link the bot.</p>
          </div>
        `;
      } else {
        whatsappStatusBody.innerHTML = `
          <div class="wa-loading">
            <div class="loading-spinner"></div>
            <span>Generating QR code...</span>
          </div>
        `;
      }
    } else if (data.status === 'connected') {
      whatsappStatusBody.innerHTML = `
        <div class="wa-connected">
          <div class="wa-connected-badge">
            <span class="badge-pulse"></span>
            Connected
          </div>
          <div class="wa-phone-number">Logged in: ${data.number || '9872364476'}</div>
          <button class="btn-wa-logout" id="waLogoutBtn">
            <i data-lucide="log-out" style="width: 14px; height: 14px;"></i>
            Disconnect / Log Out
          </button>
        </div>
      `;
      const btn = document.getElementById('waLogoutBtn');
      if (btn) btn.onclick = logoutWhatsApp;
    } else { // disconnected
      whatsappStatusBody.innerHTML = `
        <div class="wa-connected">
          <div class="wa-connected-badge" style="background: rgba(244,63,94,0.12); border-color: rgba(244,63,94,0.3); color: #fda4af;">
            Disconnected
          </div>
          ${data.error ? `<div class="wa-error-message" style="color: #fda4af; font-size: 0.8rem; text-align: center; margin-bottom: 0.5rem; max-width: 250px; word-break: break-all;">${data.error}</div>` : ''}
          <button class="btn btn-primary" id="waRetryBtn" style="padding: 0.4rem 1rem; font-size: 0.8rem;">
            <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i> Retry Connection
          </button>
        </div>
      `;
      const btn = document.getElementById('waRetryBtn');
      if (btn) btn.onclick = retryWhatsApp;
    }
    lucide.createIcons();
  }

  async function logoutWhatsApp() {
    if (!confirm('Are you sure you want to disconnect WhatsApp? You will need to scan the QR code again to link it.')) return;
    try {
      whatsappStatusBody.innerHTML = `
        <div class="wa-loading">
          <div class="loading-spinner"></div>
          <span>Disconnecting...</span>
        </div>
      `;
      const res = await fetch('/api/whatsapp/logout', { method: 'POST' });
      if (!res.ok) throw new Error('Logout request failed');
      showToast('WhatsApp session cleared successfully.');
      checkWhatsAppStatus();
    } catch (err) {
      showToast(err.message || 'Failed to logout WhatsApp', 'error');
    }
  }

  async function retryWhatsApp() {
    try {
      whatsappStatusBody.innerHTML = `
        <div class="wa-loading">
          <div class="loading-spinner"></div>
          <span>Retrying connection...</span>
        </div>
      `;
      const res = await fetch('/api/whatsapp/logout', { method: 'POST' }); // Logging out/destroys client and recreates
      if (!res.ok) throw new Error('Retry connection failed');
      showToast('WhatsApp connection reset initiated.');
      checkWhatsAppStatus();
    } catch (err) {
      showToast(err.message || 'Failed to retry connection', 'error');
    }
  }
});
