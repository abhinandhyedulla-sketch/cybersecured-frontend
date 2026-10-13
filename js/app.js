/**
 * AEGISGUARD - Cyber Defense Operations Command Center Client Engine
 */

// Automatically adapt API Base URL:
// - If running on localhost port 8080 or Vite dev proxy 3000 -> use '/api'
// - Otherwise (GitHub Pages, external devices, etc.) -> use live backend tunnel
const API_BASE = (window.location.port === '8080' || window.location.port === '3000')
    ? '/api'
    : (window.__API_BASE__ || 'https://carl-substantially-providence-josh.trycloudflare.com/api');
let timelineChart = null;
let severityChart = null;
let currentApps = [];
let pollInterval = null;

// On Page Load
document.addEventListener('DOMContentLoaded', () => {
    initAuthStatus();
    initNavigation();
    initCharts();
    initEventListeners();
    loadDashboardData();

    // Start auto-refresh polling every 4 seconds
    pollInterval = setInterval(loadDashboardData, 4000);
});

// ==========================================================================
// Authentication State Management
// ==========================================================================

function getAuthToken() {
    return localStorage.getItem('aegis_jwt_token');
}

function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = getAuthToken();
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    return headers;
}

async function initAuthStatus() {
    const token = getAuthToken();
    const userNameDisplay = document.getElementById('userNameDisplay');
    const logoutBtn = document.getElementById('btnLogoutBtn');

    if (!token) {
        userNameDisplay.textContent = 'Login';
        if (logoutBtn) logoutBtn.style.display = 'none';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/auth/verify`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();

        if (data.valid) {
            userNameDisplay.textContent = data.username;
            if (logoutBtn) logoutBtn.style.display = 'inline-flex';
        } else {
            userNameDisplay.textContent = 'Login';
            if (logoutBtn) logoutBtn.style.display = 'none';
            localStorage.removeItem('aegis_jwt_token');
            localStorage.removeItem('aegis_user_info');
        }
    } catch (err) {
        userNameDisplay.textContent = 'Login';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
}

function handleUserPillClick() {
    const token = getAuthToken();
    if (!token) {
        window.location.href = 'login.html';
    }
}

function logoutUser() {
    localStorage.removeItem('aegis_jwt_token');
    localStorage.removeItem('aegis_user_info');
    showToast('Logged out successfully', 'info');
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 500);
}

// ==========================================================================
// Navigation & Tabs
// ==========================================================================

function initNavigation() {
    const navButtons = document.querySelectorAll('.sidebar-nav .nav-item');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });

    // Integration Code Tabs
    const codeTabs = document.querySelectorAll('.code-tab-btn');
    codeTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            codeTabs.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.code-content-pane').forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const lang = btn.getAttribute('data-lang');
            const targetPane = document.getElementById(`code-${lang}`);
            if (targetPane) targetPane.classList.add('active');
        });
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `tab-${tabId}`);
    });

    if (tabId === 'overview') {
        setTimeout(() => {
            if (timelineChart) timelineChart.resize();
            if (severityChart) severityChart.resize();
        }, 100);
    }
}

// ==========================================================================
// Chart.js Visualizations
// ==========================================================================

function initCharts() {
    // Ingestion Timeline Chart
    const timelineCtx = document.getElementById('timelineChart').getContext('2d');
    timelineChart = new Chart(timelineCtx, {
        type: 'line',
        data: {
            labels: ['-5h', '-4h', '-3h', '-2h', '-1h', 'Now'],
            datasets: [
                {
                    label: 'Total Events',
                    data: [12, 19, 15, 25, 22, 30],
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2
                },
                {
                    label: 'Threat Alerts',
                    data: [1, 3, 0, 4, 2, 5],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#9ca3af', font: { family: 'Inter', size: 11 } }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#6b7280', font: { family: 'JetBrains Mono', size: 10 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#6b7280', font: { family: 'JetBrains Mono', size: 10 } }
                }
            }
        }
    });

    // Severity Breakdown Chart
    const severityCtx = document.getElementById('severityChart').getContext('2d');
    severityChart = new Chart(severityCtx, {
        type: 'doughnut',
        data: {
            labels: ['Low', 'Medium', 'High', 'Critical'],
            datasets: [{
                data: [10, 5, 3, 2],
                backgroundColor: ['#10b981', '#f59e0b', '#8b5cf6', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#9ca3af', font: { family: 'Inter', size: 11 }, padding: 12 }
                }
            },
            cutout: '70%'
        }
    });
}

// ==========================================================================
// Dashboard Data Fetching & Rendering
// ==========================================================================

async function loadDashboardData() {
    try {
        const headers = getAuthHeaders();
        const [statsRes, timelineRes, appsRes, alertsRes, eventsRes] = await Promise.all([
            fetch(`${API_BASE}/dashboard/stats`, { headers }).then(r => r.json()),
            fetch(`${API_BASE}/dashboard/timeline`, { headers }).then(r => r.json()),
            fetch(`${API_BASE}/applications`, { headers }).then(r => r.json()),
            fetch(`${API_BASE}/alerts`, { headers }).then(r => r.json()),
            fetch(`${API_BASE}/security/events?limit=50`, { headers }).then(r => r.json())
        ]);

        renderHUD(statsRes);
        renderTimeline(timelineRes);
        renderSeverityChart(statsRes.eventsBySeverity);
        renderApplications(appsRes);
        renderAlerts(alertsRes);
        renderEvents(eventsRes);

    } catch (err) {
        console.error('Error fetching dashboard telemetry:', err);
    }
}

function renderHUD(stats) {
    document.getElementById('statTotalEvents').textContent = stats.totalEvents || 0;
    document.getElementById('statActiveAlerts').textContent = stats.activeAlerts || 0;
    document.getElementById('statCriticalAlerts').textContent = stats.criticalAlerts || 0;
    document.getElementById('statRegisteredApps').textContent = stats.registeredApps || 0;
    document.getElementById('statEvents24h').textContent = stats.eventsLast24h || 0;

    // Badges
    document.getElementById('badgeEventsCount').textContent = stats.totalEvents || 0;
    document.getElementById('badgeAlertsCount').textContent = stats.activeAlerts || 0;
    document.getElementById('badgeAppsCount').textContent = stats.registeredApps || 0;

    // Posture Score & Threat Level
    const postureVal = stats.securityPostureScore || 95;
    document.getElementById('postureScoreVal').textContent = `${postureVal}%`;

    const threatLevelElem = document.getElementById('hudThreatLevel');
    const threatValElem = document.getElementById('threatLevelVal');
    const level = stats.threatLevel || 'NORMAL';
    threatValElem.textContent = level;

    if (level === 'CRITICAL' || level === 'HIGH') {
        threatLevelElem.className = 'threat-level-badge critical';
    } else {
        threatLevelElem.className = 'threat-level-badge';
    }
}

function renderTimeline(points) {
    if (!timelineChart || !points || points.length === 0) return;
    timelineChart.data.labels = points.map(p => p.timeLabel);
    timelineChart.data.datasets[0].data = points.map(p => p.totalCount);
    timelineChart.data.datasets[1].data = points.map(p => p.threatCount);
    timelineChart.update('none');
}

function renderSeverityChart(bySeverity) {
    if (!severityChart || !bySeverity) return;
    const low = bySeverity.LOW || 0;
    const med = bySeverity.MEDIUM || 0;
    const high = bySeverity.HIGH || 0;
    const crit = bySeverity.CRITICAL || 0;

    severityChart.data.datasets[0].data = [low, med, high, crit];
    severityChart.update('none');
}

function renderApplications(apps) {
    currentApps = apps || [];
    const grid = document.getElementById('appsGridContainer');
    const hudTable = document.getElementById('hudAppsBody');
    const simSelect = document.getElementById('simAppSelect');

    if (!grid || !hudTable) return;

    // Update Simulation select box
    if (simSelect) {
        simSelect.innerHTML = currentApps.map(app => 
            `<option value="${app.id}">${escapeHtml(app.name)}</option>`
        ).join('');
    }

    // Render HUD mini table
    hudTable.innerHTML = currentApps.map(app => `
        <tr>
            <td>
                <strong>${escapeHtml(app.name)}</strong>
                <div class="text-muted" style="font-size:11px;">${escapeHtml(app.ownerEmail || 'No owner')}</div>
            </td>
            <td><span class="badge ${app.status === 'ACTIVE' ? 'badge-green' : 'badge-red'}">${app.status}</span></td>
            <td><span class="font-mono">${app.totalEvents || 0}</span></td>
            <td>
                <button class="btn btn-xs btn-outline" onclick="copyApiKey('${app.apiKey}')" title="Copy API Key">
                    <i class="fa-solid fa-copy"></i> Copy Key
                </button>
            </td>
        </tr>
    `).join('');

    // Render Full Applications Grid
    grid.innerHTML = currentApps.map(app => `
        <div class="app-card">
            <div>
                <div class="app-card-header">
                    <div class="app-card-title">${escapeHtml(app.name)}</div>
                    <span class="badge ${app.status === 'ACTIVE' ? 'badge-green' : 'badge-red'}">${app.status}</span>
                </div>
                <div class="app-card-desc">${escapeHtml(app.description || 'Microservice integration endpoint for threat analysis.')}</div>
                
                <div class="api-key-box">
                    <span class="api-key-text">${app.apiKey}</span>
                    <button class="btn btn-xs btn-secondary" onclick="copyApiKey('${app.apiKey}')">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                </div>
            </div>

            <div>
                <div class="flex-between text-muted" style="font-size:11px; margin-bottom:12px;">
                    <span><i class="fa-solid fa-envelope"></i> ${escapeHtml(app.ownerEmail || 'admin@college.edu')}</span>
                    <span><i class="fa-solid fa-bolt"></i> ${app.totalEvents || 0} events</span>
                </div>
                <div class="flex-between">
                    <button class="btn btn-xs btn-outline" onclick="regenerateKey(${app.id})">
                        <i class="fa-solid fa-rotate"></i> Reset Key
                    </button>
                    <button class="btn btn-xs btn-outline" onclick="toggleAppStatus(${app.id}, '${app.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'}')">
                        ${app.status === 'ACTIVE' ? '<i class="fa-solid fa-pause"></i> Suspend' : '<i class="fa-solid fa-play"></i> Activate'}
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderAlerts(alerts) {
    const hudAlertsBody = document.getElementById('hudAlertsBody');
    const tableAlertsBody = document.getElementById('alertsTableBody');

    if (!alerts || alerts.length === 0) {
        if (hudAlertsBody) hudAlertsBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No active critical alerts detected.</td></tr>`;
        if (tableAlertsBody) tableAlertsBody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">No security alerts logged.</td></tr>`;
        return;
    }

    const statusFilter = document.getElementById('alertStatusFilter')?.value || 'ALL';
    const severityFilter = document.getElementById('alertSeverityFilter')?.value || 'ALL';

    const filtered = alerts.filter(a => {
        if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
        if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
        return true;
    });

    // Render HUD Critical Alerts (Top 5)
    if (hudAlertsBody) {
        const openAlerts = alerts.filter(a => a.status === 'OPEN').slice(0, 5);
        if (openAlerts.length === 0) {
            hudAlertsBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No open threat alerts. All clear.</td></tr>`;
        } else {
            hudAlertsBody.innerHTML = openAlerts.map(a => `
                <tr>
                    <td>
                        <strong class="${a.severity === 'CRITICAL' ? 'text-red' : 'text-amber'}">${escapeHtml(a.title)}</strong>
                        <div class="text-muted" style="font-size:11px;">${formatDate(a.createdAt)}</div>
                    </td>
                    <td>${escapeHtml(a.applicationName)}</td>
                    <td><span class="font-mono text-cyan">${escapeHtml(a.attackerIp || 'N/A')}</span></td>
                    <td><span class="badge ${getSeverityBadge(a.severity)}">${a.severity}</span></td>
                    <td>
                        <button class="btn btn-xs btn-red" onclick="openResolveModal(${a.id}, '${escapeHtml(a.title)}', '${escapeHtml(a.applicationName)}')">
                            Mitigate
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    }

    // Render Full Alerts Table
    if (tableAlertsBody) {
        tableAlertsBody.innerHTML = filtered.map(a => `
            <tr>
                <td><span class="font-mono">#${a.id}</span></td>
                <td>${formatDate(a.createdAt)}</td>
                <td><strong>${escapeHtml(a.applicationName)}</strong></td>
                <td>
                    <div class="${a.severity === 'CRITICAL' ? 'text-red' : 'text-amber'}" style="font-weight:600;">${escapeHtml(a.title)}</div>
                    <div class="text-muted" style="font-size:11px;">${escapeHtml(a.description)}</div>
                </td>
                <td><span class="badge ${getSeverityBadge(a.severity)}">${a.severity}</span></td>
                <td><span class="font-mono text-cyan">${escapeHtml(a.attackerIp || 'N/A')}</span></td>
                <td>${escapeHtml(a.targetUsername || 'anonymous')}</td>
                <td><span class="badge ${getStatusBadge(a.status)}">${a.status}</span></td>
                <td>
                    ${a.status === 'OPEN' ? `
                        <button class="btn btn-xs btn-green" onclick="openResolveModal(${a.id}, '${escapeHtml(a.title)}', '${escapeHtml(a.applicationName)}')">
                            <i class="fa-solid fa-check"></i> Resolve
                        </button>
                    ` : `
                        <span class="text-muted" style="font-size:11px;">Resolved</span>
                    `}
                </td>
            </tr>
        `).join('');
    }
}

function renderEvents(events) {
    const tbody = document.getElementById('eventsTableBody');
    if (!tbody || !events) return;

    const searchTerm = (document.getElementById('eventSearchInput')?.value || '').toLowerCase();
    const severityFilter = document.getElementById('eventSeverityFilter')?.value || 'ALL';
    const typeFilter = document.getElementById('eventTypeFilter')?.value || 'ALL';

    const filtered = events.filter(e => {
        if (severityFilter !== 'ALL' && e.severity !== severityFilter) return false;
        if (typeFilter !== 'ALL' && e.eventType !== typeFilter) return false;
        if (searchTerm) {
            const matchStr = `${e.ipAddress} ${e.username} ${e.endpoint} ${e.description} ${e.applicationName}`.toLowerCase();
            if (!matchStr.includes(searchTerm)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No security events match current filters.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(e => `
        <tr class="${e.flaggedAsThreat ? 'threat-row' : ''}">
            <td style="font-size:11px; white-space:nowrap;">${formatDate(e.timestamp)}</td>
            <td><strong>${escapeHtml(e.applicationName)}</strong></td>
            <td>
                <span class="font-mono" style="font-size:11px;">${e.eventType}</span>
                ${e.flaggedAsThreat ? '<span class="badge badge-red ml-1" style="font-size:9px;">THREAT</span>' : ''}
            </td>
            <td><span class="badge ${getSeverityBadge(e.severity)}">${e.severity}</span></td>
            <td>${escapeHtml(e.username || '—')}</td>
            <td><span class="font-mono text-cyan">${escapeHtml(e.ipAddress)}</span></td>
            <td><span class="font-mono" style="font-size:11px; color:#d1d5db;">${escapeHtml(e.endpoint || '/')}</span></td>
            <td><span class="text-muted" style="font-size:11px;">${escapeHtml(e.description || 'Normal activity')}</span></td>
        </tr>
    `).join('');
}

// ==========================================================================
// Event Listeners & Modals
// ==========================================================================

function initEventListeners() {
    // Refresh Button
    document.getElementById('btnRefresh')?.addEventListener('click', () => {
        const icon = document.getElementById('refreshIcon');
        if (icon) icon.classList.add('fa-spin');
        loadDashboardData().then(() => {
            setTimeout(() => { if (icon) icon.classList.remove('fa-spin'); }, 600);
            showToast('Telemetry refreshed', 'success');
        });
    });

    // Quick Simulation Modal trigger from Navbar
    document.getElementById('btnSimulateModal')?.addEventListener('click', () => {
        switchTab('simulator');
    });

    // Event Filters
    document.getElementById('eventSearchInput')?.addEventListener('input', () => loadDashboardData());
    document.getElementById('eventSeverityFilter')?.addEventListener('change', () => loadDashboardData());
    document.getElementById('eventTypeFilter')?.addEventListener('change', () => loadDashboardData());
    document.getElementById('alertStatusFilter')?.addEventListener('change', () => loadDashboardData());
    document.getElementById('alertSeverityFilter')?.addEventListener('change', () => loadDashboardData());

    document.getElementById('btnFilterSuspicious')?.addEventListener('click', async () => {
        try {
            const res = await fetch(`${API_BASE}/security/events/suspicious`, { headers: getAuthHeaders() }).then(r => r.json());
            renderEvents(res);
            showToast('Showing suspicious threat events only', 'info');
        } catch (err) {
            console.error(err);
        }
    });

    // Register App Modal
    document.getElementById('btnOpenNewAppModal')?.addEventListener('click', () => {
        openModal('modalNewApp');
    });

    document.getElementById('formRegisterApp')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('newAppName').value.trim();
        const description = document.getElementById('newAppDesc').value.trim();
        const ownerEmail = document.getElementById('newAppEmail').value.trim();

        try {
            const res = await fetch(`${API_BASE}/applications`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name, description, ownerEmail })
            });

            if (!res.ok) throw new Error('Failed to register application');
            const data = await res.json();
            closeModal('modalNewApp');
            document.getElementById('formRegisterApp').reset();
            showToast(`Registered '${data.name}' with key ${data.apiKey}`, 'success');
            loadDashboardData();
        } catch (err) {
            showToast(err.message, 'danger');
        }
    });

    // Resolve Alert Form
    document.getElementById('formResolveAlert')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('resolveAlertId').value;
        const status = document.getElementById('resolveStatusSelect').value;
        const resolutionNotes = document.getElementById('resolveNotes').value;

        try {
            const res = await fetch(`${API_BASE}/alerts/${id}/resolve`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ status, resolutionNotes })
            });
            if (!res.ok) throw new Error('Failed to resolve alert');
            closeModal('modalResolveAlert');
            showToast('Incident resolved and mitigated successfully', 'success');
            loadDashboardData();
        } catch (err) {
            showToast(err.message, 'danger');
        }
    });

    // Attack Simulator Trigger
    document.getElementById('btnLaunchSimulation')?.addEventListener('click', async () => {
        const scenario = document.getElementById('simScenarioSelect').value;
        const appId = document.getElementById('simAppSelect').value;
        const targetUser = document.getElementById('simTargetUser').value;

        appendTerminal(`[OUTBOUND] Initializing attack simulation packet for scenario: ${scenario}...`);

        try {
            const res = await fetch(`${API_BASE}/simulator/trigger`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ scenario, applicationId: appId, targetUser })
            });

            const data = await res.json();
            appendTerminal(`[SUCCESS] ${data.message}`);
            appendTerminal(`[PAYLOAD] ${data.samplePayload}`);
            appendTerminal(`[ALERT] Ingestion Engine generated ${data.alertsTriggered} alert(s).`);

            showToast(`Simulated ${scenario}: ${data.alertsTriggered} Alert(s) Generated!`, 'danger');
            loadDashboardData();
        } catch (err) {
            appendTerminal(`[ERROR] Attack launch failed: ${err.message}`);
            showToast('Simulation error: ' + err.message, 'danger');
        }
    });

    document.getElementById('btnClearTerminal')?.addEventListener('click', () => {
        const term = document.getElementById('terminalOutput');
        if (term) term.innerHTML = '<div class="terminal-line text-muted">[SYSTEM] Terminal buffer cleared.</div>';
    });

    // Custom Event Dispatcher Sandbox Form
    document.getElementById('formCustomEvent')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const apiKey = document.getElementById('customApiKey').value.trim();
        const eventType = document.getElementById('customEventType').value;
        const username = document.getElementById('customUsername').value.trim();
        const ipAddress = document.getElementById('customIp').value.trim();
        const endpoint = document.getElementById('customEndpoint').value.trim();
        const description = document.getElementById('customDescription').value.trim();

        try {
            const res = await fetch(`${API_BASE}/security/events`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey
                },
                body: JSON.stringify({ eventType, username, ipAddress, endpoint, description })
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.message || 'Event rejected by API');
            }

            const data = await res.json();
            showToast(`Event ingested (Threat=${data.flaggedAsThreat})`, data.flaggedAsThreat ? 'danger' : 'success');
            loadDashboardData();
        } catch (err) {
            showToast(err.message, 'danger');
        }
    });
}

function setScenario(scenarioName) {
    const sel = document.getElementById('simScenarioSelect');
    if (sel) sel.value = scenarioName;

    document.querySelectorAll('.scenario-card').forEach(card => {
        card.classList.toggle('active', card.getAttribute('onclick').includes(scenarioName));
    });
}

function openResolveModal(id, title, appName) {
    document.getElementById('resolveAlertId').value = id;
    document.getElementById('resolveAlertSummary').innerHTML = `
        <strong>Alert #${id}: ${escapeHtml(title)}</strong>
        <div>Target Application: ${escapeHtml(appName)}</div>
    `;
    openModal('modalResolveAlert');
}

function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
}

async function copyApiKey(key) {
    try {
        await navigator.clipboard.writeText(key);
        showToast(`Copied API Key: ${key}`, 'info');
        const customInput = document.getElementById('customApiKey');
        if (customInput) customInput.value = key;
    } catch (err) {
        showToast(`API Key: ${key}`, 'info');
    }
}

async function regenerateKey(id) {
    if (!confirm('Are you sure you want to regenerate this API key? Old key will be immediately revoked.')) return;
    try {
        const res = await fetch(`${API_BASE}/applications/${id}/regenerate-key`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        const data = await res.json();
        showToast(`New API Key generated: ${data.apiKey}`, 'success');
        loadDashboardData();
    } catch (err) {
        showToast('Key reset failed', 'danger');
    }
}

async function toggleAppStatus(id, newStatus) {
    try {
        await fetch(`${API_BASE}/applications/${id}/status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: newStatus })
        });
        showToast(`Application status changed to ${newStatus}`, 'info');
        loadDashboardData();
    } catch (err) {
        showToast('Status update failed', 'danger');
    }
}

function appendTerminal(text) {
    const term = document.getElementById('terminalOutput');
    if (!term) return;
    const line = document.createElement('div');
    line.className = 'terminal-line';
    line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    term.appendChild(line);
    term.scrollTop = term.scrollHeight;
}

function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fa-solid fa-circle-info"></i> <span>${escapeHtml(msg)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function getSeverityBadge(severity) {
    switch (severity) {
        case 'CRITICAL': return 'badge-red';
        case 'HIGH': return 'badge-purple';
        case 'MEDIUM': return 'badge-amber';
        case 'LOW':
        default: return 'badge-green';
    }
}

function getStatusBadge(status) {
    switch (status) {
        case 'OPEN': return 'badge-red';
        case 'ACKNOWLEDGED': return 'badge-amber';
        case 'RESOLVED': return 'badge-green';
        default: return 'badge-outline';
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
        return dateStr;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
