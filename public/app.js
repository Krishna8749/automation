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
    if (!label) return;

    generateKeyBtn.disabled = true;
    generateKeyBtn.querySelector('span').textContent = 'Generating...';

    try {
      const res = await fetch('/api/keys-mgmt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ label })
      });

      if (!res.ok) throw new Error('Failed to generate key');
      const newKeyObj = await res.json();
      
      keyLabelInput.value = '';
      showToast(`Key "${label}" generated!`);
      
      // Auto-copy new key to clipboard for maximum user convenience
      if (newKeyObj.key) {
        navigator.clipboard.writeText(newKeyObj.key);
        showToast(`Key "${label}" generated & copied to clipboard!`);
      }

      fetchKeys();
    } catch (err) {
      showToast('Failed to generate API Key', 'error');
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

  // Intervals
  setInterval(checkHealth, 5000);
});
