document.addEventListener('DOMContentLoaded', () => {
    const sessionsContainer = document.getElementById('sessions');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const apiKeyInput = document.getElementById('api-key');
    const saveSettingsBtn = document.getElementById('save-settings');
    const qrModal = document.getElementById('qr-modal');
    const qrContainer = document.getElementById('qr-container');
    const closeModals = document.querySelectorAll('.close-modal');

    // Load API Key
    const apiKey = localStorage.getItem('waha_api_key') || '';
    apiKeyInput.value = apiKey;

    // API Helper
    async function apiCall(endpoint, method = 'GET', body = null, isBlob = false) {
        const headers = {
            'Content-Type': 'application/json'
        };
        const key = localStorage.getItem('waha_api_key');
        if (key) {
            headers['X-Api-Key'] = key;
        }

        const options = {
            method,
            headers
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(endpoint, options);

            if (response.status === 401 || response.status === 403) {
                console.error("Authentication failed. Check API Key.");
            }

            if (!response.ok) {
                 const errorText = await response.text();
                 throw new Error(errorText || response.statusText);
            }

            if (isBlob) {
                return await response.blob();
            }
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Fetch Sessions
    async function loadSessions() {
        try {
            const sessions = await apiCall('/api/sessions?all=true');
            renderSessions(sessions);
        } catch (error) {
            sessionsContainer.innerHTML = `<div class="error">Failed to load sessions: ${error.message}</div>`;
        }
    }

    // Render Sessions
    function renderSessions(sessions) {
        sessionsContainer.innerHTML = '';
        if (sessions.length === 0) {
            sessionsContainer.innerHTML = '<div class="empty">No sessions found.</div>';
            return;
        }

        sessions.forEach(session => {
            const card = document.createElement('div');
            card.className = 'session-card';

            let statusBadgeClass = 'badge-secondary';
            if (session.status === 'WORKING') statusBadgeClass = 'badge-working';
            else if (session.status === 'SCAN_QR_CODE') statusBadgeClass = 'badge-scan_qr';
            else if (session.status === 'STOPPED') statusBadgeClass = 'badge-stopped';
            else if (session.status === 'STARTING') statusBadgeClass = 'badge-starting';
            else if (session.status === 'FAILED') statusBadgeClass = 'badge-failed';

            const meInfo = session.me ? `<div>${session.me.pushName || ''} (${session.me.id.split('@')[0]})</div>` : '';

            card.innerHTML = `
                <div class="card-header">
                    <div class="card-title">${session.name}</div>
                    <span class="badge ${statusBadgeClass}">${session.status}</span>
                </div>
                <div class="card-body">
                    ${meInfo}
                    <div class="engine">Engine: ${session.config?.engine || 'Unknown'}</div>
                </div>
                <div class="card-actions">
                    ${getActionButtons(session)}
                </div>
            `;
            sessionsContainer.appendChild(card);
        });

        // Add event listeners to buttons
        document.querySelectorAll('.btn-action').forEach(btn => {
            btn.addEventListener('click', handleAction);
        });
    }

    function getActionButtons(session) {
        let buttons = '';
        const name = session.name;

        if (session.status === 'STOPPED' || session.status === 'FAILED') {
            buttons += `<button class="btn btn-primary btn-action" data-action="start" data-session="${name}"><i class="fas fa-play"></i> Start</button>`;
        } else {
             buttons += `<button class="btn btn-danger btn-action" data-action="stop" data-session="${name}"><i class="fas fa-stop"></i> Stop</button>`;
        }

        if (session.status === 'SCAN_QR_CODE') {
             buttons += `<button class="btn btn-warning btn-action" data-action="qr" data-session="${name}"><i class="fas fa-qrcode"></i> Scan QR</button>`;
        } else if (session.status === 'WORKING') {
             buttons += `<button class="btn btn-secondary btn-action" data-action="qr" data-session="${name}"><i class="fas fa-camera"></i> Screen</button>`;
        }

        buttons += `<button class="btn btn-secondary btn-action" data-action="logout" data-session="${name}" title="Logout"><i class="fas fa-sign-out-alt"></i></button>`;

        return buttons;
    }

    async function handleAction(e) {
        const btn = e.currentTarget;
        const action = btn.dataset.action;
        const session = btn.dataset.session;

        btn.disabled = true;
        const originalIcon = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            if (action === 'start') {
                await apiCall(`/api/sessions/${session}/start`, 'POST');
            } else if (action === 'stop') {
                await apiCall(`/api/sessions/${session}/stop`, 'POST');
            } else if (action === 'logout') {
                if (confirm(`Are you sure you want to logout session ${session}?`)) {
                    await apiCall(`/api/sessions/${session}/logout`, 'POST');
                }
            } else if (action === 'qr') {
                await showQR(session);
            }

            if (action !== 'qr') {
                await loadSessions(); // Refresh
            }
        } catch (error) {
            alert(`Action failed: ${error.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalIcon;
            }
        }
    }

    async function showQR(session) {
        qrContainer.innerHTML = '<div class="loading">Loading image...</div>';
        qrModal.classList.remove('hidden');

        try {
            const blob = await apiCall(`/api/${session}/screenshot`, 'GET', null, true);
            const url = URL.createObjectURL(blob);
            qrContainer.innerHTML = `<img src="${url}" alt="Screenshot">`;
        } catch (error) {
            qrContainer.innerHTML = `<div class="error">Failed to load image: ${error.message}</div>`;
        }
    }

    // Settings Modal
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });

    saveSettingsBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        localStorage.setItem('waha_api_key', key);
        settingsModal.classList.add('hidden');
        loadSessions();
    });

    // Close Modals
    closeModals.forEach(span => {
        span.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
             e.target.classList.add('hidden');
        }
    });

    // Initial Load
    loadSessions();

    // Auto refresh every 5 seconds
    setInterval(loadSessions, 5000);
});
