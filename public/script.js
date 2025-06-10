// Globale Variablen
let currentSessionId = null;
let currentStep = 1;

// DOM Elements
const elements = {
    configForm: null,
    callbackForm: null,
    authSection: null,
    callbackSection: null,
    tokenSection: null,
    completeSection: null,
    authUrlDisplay: null,
    stateDisplay: null,
    codeChallengeDisplay: null,
    openAuthUrlBtn: null,
    exchangeTokenBtn: null,
    refreshTokenBtn: null,
    exportTokensBtn: null,
    resetFlowBtn: null,
    statusDisplay: null,
    loadingOverlay: null,
    tokenInfo: null,
    accessTokenDisplay: null,
    refreshTokenDisplay: null,
    tokenTypeDisplay: null,
    expiresInDisplay: null,
    emailModal: null,
    emailContent: null
};

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    initializeApp();
    attachEventListeners();
});

function initializeElements() {
    // Alle DOM-Elemente initialisieren
    elements.configForm = document.getElementById('oauth-config-form');
    elements.callbackForm = document.getElementById('callback-form');
    elements.authSection = document.getElementById('auth-section');
    elements.callbackSection = document.getElementById('callback-section');
    elements.tokenSection = document.getElementById('token-section');
    elements.completeSection = document.getElementById('complete-section');
    elements.authUrlDisplay = document.getElementById('auth-url-display');
    elements.stateDisplay = document.getElementById('state-display');
    elements.codeChallengeDisplay = document.getElementById('code-challenge-display');
    elements.openAuthUrlBtn = document.getElementById('open-auth-url');
    elements.exchangeTokenBtn = document.getElementById('exchange-token-btn');
    elements.refreshTokenBtn = document.getElementById('refresh-token-btn');
    elements.exportTokensBtn = document.getElementById('export-tokens-btn');
    elements.resetFlowBtn = document.getElementById('reset-flow-btn');
    elements.statusDisplay = document.getElementById('status-display');
    elements.loadingOverlay = document.getElementById('loading-overlay');
    elements.tokenInfo = document.getElementById('token-info');
    elements.accessTokenDisplay = document.getElementById('access-token-display');
    elements.refreshTokenDisplay = document.getElementById('refresh-token-display');
    elements.tokenTypeDisplay = document.getElementById('token-type-display');
    elements.expiresInDisplay = document.getElementById('expires-in-display');
    elements.emailModal = document.getElementById('email-modal');
    elements.emailContent = document.getElementById('email-content');
}

function initializeApp() {
    updateStepDisplay(1);
    updateStatus('Bereit für OAuth2 Flow - Passolution API');
    
    // Erstes Card sichtbar machen
    const configSection = document.getElementById('config-section');
    if (configSection) {
        configSection.classList.add('show');
    }
    
    // Passolution-Standardwerte setzen
    setPassolutionDefaults();
    
    console.log('OAuth2 App initialisiert mit Passolution-Defaults');
}

function setPassolutionDefaults() {
    // Passolution-Standardwerte setzen
    const defaults = {
        'auth-url': 'https://web.passolution.eu/en/oauth/authorize',
        'token-url': 'https://web.passolution.eu/en/oauth/token',
        'redirect-uri': 'https://api-client-oauth2-example.passolution.de/oauth/callback',
        'scope': ''
    };
    
    Object.entries(defaults).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element && !element.value) {
            element.value = value;
        }
    });
    
    console.log('Passolution-Standardwerte gesetzt');
}

function attachEventListeners() {
    // OAuth Config Form
    if (elements.configForm) {
        elements.configForm.addEventListener('submit', handleConfigSubmit);
    }
    
    // Callback Form
    if (elements.callbackForm) {
        elements.callbackForm.addEventListener('submit', handleCallbackSubmit);
    }
    
    // Buttons
    if (elements.openAuthUrlBtn) {
        elements.openAuthUrlBtn.addEventListener('click', openAuthUrl);
    }
    if (elements.exchangeTokenBtn) {
        elements.exchangeTokenBtn.addEventListener('click', exchangeToken);
    }
    if (elements.refreshTokenBtn) {
        elements.refreshTokenBtn.addEventListener('click', refreshToken);
    }
    if (elements.exportTokensBtn) {
        elements.exportTokensBtn.addEventListener('click', exportTokens);
    }
    if (elements.resetFlowBtn) {
        elements.resetFlowBtn.addEventListener('click', resetFlow);
    }
    
    // URL-Parameter beim Laden der Seite prüfen
    checkUrlParameters();
}

function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    
    if (code || error) {
        console.log('URL-Parameter gefunden:', { code: !!code, state: !!state, error });
        // Automatisch zum Callback-Schritt springen
        if (currentSessionId) {
            showSection('callback-section');
            updateStepDisplay(3);
            
            if (code && document.getElementById('callback-code')) {
                document.getElementById('callback-code').value = code;
            }
            if (state && document.getElementById('callback-state')) {
                document.getElementById('callback-state').value = state;
            }
            if (error) {
                updateStatus(`Authorization Fehler: ${error}`, 'error');
            }
        }
    }
}

async function handleConfigSubmit(e) {
    e.preventDefault();
    console.log('Config Form submitted');
    showLoading(true);
    
    const formData = {
        clientId: document.getElementById('client-id')?.value || '',
        authUrl: document.getElementById('auth-url')?.value || '',
        tokenUrl: document.getElementById('token-url')?.value || '',
        redirectUri: document.getElementById('redirect-uri')?.value || '',
        scope: document.getElementById('scope')?.value || ''
    };
    
    console.log('Form Data:', formData);
    
    // Client Secret für späteren Gebrauch speichern
    window.clientSecret = document.getElementById('client-secret')?.value || '';
    window.tokenUrl = formData.tokenUrl;
    
    try {
        const response = await fetch('/api/generate-auth-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        console.log('Server Response:', data);
        
        if (response.ok) {
            currentSessionId = data.sessionId;
            
            if (elements.authUrlDisplay) {
                elements.authUrlDisplay.value = data.authorizationUrl;
            }
            if (elements.stateDisplay) {
                elements.stateDisplay.textContent = data.state;
            }
            if (elements.codeChallengeDisplay) {
                elements.codeChallengeDisplay.textContent = data.codeChallenge;
            }
            
            showSection('auth-section');
            updateStepDisplay(2);
            updateStatus('Authorization URL generiert');
        } else {
            throw new Error(data.error || 'Fehler beim Generieren der Authorization URL');
        }
    } catch (error) {
        console.error('Config Error:', error);
        updateStatus(`Fehler: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

function openAuthUrl() {
    const authUrl = elements.authUrlDisplay?.value;
    if (authUrl) {
        console.log('Opening auth URL:', authUrl);
        window.open(authUrl, '_blank');
        showSection('callback-section');
        updateStepDisplay(3);
        updateStatus('Benutzer wird autorisiert... Warten auf Callback');
    } else {
        console.error('No auth URL found');
    }
}

async function handleCallbackSubmit(e) {
    e.preventDefault();
    console.log('Callback Form submitted');
    showLoading(true);
    
    const callbackData = {
        sessionId: currentSessionId,
        code: document.getElementById('callback-code')?.value || '',
        state: document.getElementById('callback-state')?.value || ''
    };
    
    console.log('Callback Data:', callbackData);
    
    try {
        const response = await fetch('/api/handle-callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(callbackData)
        });
        
        const data = await response.json();
        console.log('Callback Response:', data);
        
        if (response.ok) {
            showSection('token-section');
            updateStepDisplay(4);
            updateStatus('Authorization Code erhalten');
        } else {
            throw new Error(data.error || 'Fehler beim Verarbeiten des Callbacks');
        }
    } catch (error) {
        console.error('Callback Error:', error);
        updateStatus(`Fehler: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

async function exchangeToken() {
    console.log('Exchanging token');
    showLoading(true);
    
    const tokenData = {
        sessionId: currentSessionId,
        clientSecret: window.clientSecret,
        tokenUrl: window.tokenUrl
    };
    
    console.log('Token Exchange Data:', { sessionId: tokenData.sessionId, hasSecret: !!tokenData.clientSecret, tokenUrl: tokenData.tokenUrl });
    
    try {
        const response = await fetch('/api/exchange-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tokenData)
        });
        
        const data = await response.json();
        console.log('Token Response:', data);
        
        if (response.ok) {
            displayTokens(data);
            showSection('complete-section');
            updateStepDisplay(5);
            updateStatus('OAuth2 Flow erfolgreich abgeschlossen!');
            
            // Erfolgs-Animation
            if (elements.completeSection) {
                elements.completeSection.classList.add('success-animation');
                setTimeout(() => {
                    elements.completeSection.classList.remove('success-animation');
                }, 600);
            }
        } else {
            throw new Error(data.error || 'Fehler beim Token-Austausch');
        }
    } catch (error) {
        console.error('Token Exchange Error:', error);
        updateStatus(`Fehler: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

async function refreshToken() {
    console.log('Refreshing token');
    showLoading(true);
    
    const refreshData = {
        sessionId: currentSessionId,
        clientSecret: window.clientSecret,
        tokenUrl: window.tokenUrl
    };
    
    try {
        const response = await fetch('/api/refresh-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(refreshData)
        });
        
        const data = await response.json();
        console.log('Refresh Response:', data);
        
        if (response.ok) {
            displayTokens(data);
            updateStatus('Token erfolgreich aktualisiert!');
        } else {
            throw new Error(data.error || 'Fehler beim Aktualisieren des Tokens');
        }
    } catch (error) {
        console.error('Token Refresh Error:', error);
        updateStatus(`Fehler: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

function displayTokens(tokenData) {
    console.log('Displaying tokens:', tokenData);
    
    if (elements.accessTokenDisplay) {
        elements.accessTokenDisplay.value = tokenData.accessToken || '';
    }
    if (elements.refreshTokenDisplay) {
        elements.refreshTokenDisplay.value = tokenData.refreshToken || '';
    }
    if (elements.tokenTypeDisplay) {
        elements.tokenTypeDisplay.textContent = tokenData.tokenType || 'Bearer';
    }
    if (elements.expiresInDisplay) {
        elements.expiresInDisplay.textContent = tokenData.expiresIn || 'N/A';
    }
    
    if (elements.tokenInfo) {
        elements.tokenInfo.classList.remove('hidden');
    }
}

async function exportTokens() {
    console.log('Exporting tokens');
    
    try {
        const response = await fetch(`/api/session/${currentSessionId}/export`);
        const data = await response.json();
        
        if (response.ok) {
            const emailText = createEmailContent(data);
            if (elements.emailContent) {
                elements.emailContent.value = emailText;
            }
            showModal('email-modal');
        } else {
            throw new Error(data.error || 'Fehler beim Exportieren der Token');
        }
    } catch (error) {
        console.error('Export Error:', error);
        updateStatus(`Fehler: ${error.message}`, 'error');
    }
}

function createEmailContent(tokenData) {
    const timestamp = new Date().toLocaleString('de-DE');
    
    return `Betreff: OAuth2 Token-Daten

Hallo,

hier sind die OAuth2 Token-Daten aus der Session vom ${timestamp}:

-----------------------------------
OAuth2 TOKEN INFORMATIONEN
-----------------------------------

Session ID: ${tokenData.sessionId}
Client ID: ${tokenData.clientId}
Scope: ${tokenData.scope}

ACCESS TOKEN:
${tokenData.accessToken}

REFRESH TOKEN:
${tokenData.refreshToken}

Token Type: ${tokenData.tokenType}
Gültigkeitsdauer: ${tokenData.expiresIn} Sekunden

Generiert am: ${tokenData.generatedAt}

-----------------------------------

WICHTIGE HINWEISE:
- Diese Token sind vertraulich und sollten sicher aufbewahrt werden
- Der Access Token läuft nach der angegebenen Zeit ab
- Mit dem Refresh Token können Sie neue Access Token anfordern
- Teilen Sie diese Informationen nur mit autorisierten Personen

Viele Grüße`;
}

function resetFlow() {
    if (confirm('Möchten Sie wirklich einen neuen OAuth2 Flow starten? Alle aktuellen Daten gehen verloren.')) {
        console.log('Resetting flow');
        
        // Session löschen (optional)
        if (currentSessionId) {
            fetch(`/api/session/${currentSessionId}`, { method: 'DELETE' })
                .catch(err => console.error('Session Delete Error:', err));
        }
        
        // UI zurücksetzen
        currentSessionId = null;
        currentStep = 1;
        
        // Formulare zurücksetzen
        if (elements.configForm) {
            elements.configForm.reset();
        }
        if (elements.callbackForm) {
            elements.callbackForm.reset();
        }
        
        // Alle Abschnitte verstecken außer dem ersten
        document.querySelectorAll('.card').forEach((card, index) => {
            if (index === 0) {
                card.classList.remove('hidden');
                card.classList.add('show');
            } else {
                card.classList.add('hidden');
                card.classList.remove('show');
            }
        });
        
        // Token-Anzeige zurücksetzen
        if (elements.tokenInfo) {
            elements.tokenInfo.classList.add('hidden');
        }
        
        // UI-Elemente zurücksetzen
        updateStepDisplay(1);
        updateStatus('Bereit für neuen OAuth2 Flow');
        
        // URL-Parameter entfernen
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Utility Functions
function showSection(sectionId) {
    console.log('Showing section:', sectionId);
    
    // Alle Abschnitte verstecken
    document.querySelectorAll('.card').forEach(card => {
        if (card.id !== 'config-section') {
            card.classList.add('hidden');
            card.classList.remove('show');
        }
    });
    
    // Gewünschten Abschnitt anzeigen
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.remove('hidden');
        section.classList.add('show');
        
        // Smooth scroll zum Abschnitt
        setTimeout(() => {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    } else {
        console.error('Section not found:', sectionId);
    }
}

function updateStepDisplay(step) {
    console.log('Updating step display:', step);
    currentStep = step;
    
    // Alle Schritte zurücksetzen
    document.querySelectorAll('.step').forEach((stepEl, index) => {
        stepEl.classList.remove('active', 'completed');
        
        if (index + 1 < step) {
            stepEl.classList.add('completed');
        } else if (index + 1 === step) {
            stepEl.classList.add('active');
        }
    });
}

function updateStatus(message, type = 'info') {
    console.log('Status update:', message, type);
    
    if (!elements.statusDisplay) {
        console.error('Status display element not found');
        return;
    }
    
    const statusIcon = elements.statusDisplay.querySelector('i');
    const statusText = elements.statusDisplay.childNodes[1];
    
    // Icon aktualisieren
    if (statusIcon) {
        statusIcon.className = 'fas ' + (
            type === 'error' ? 'fa-exclamation-triangle' :
            type === 'success' ? 'fa-check-circle' :
            'fa-info-circle'
        );
    }
    
    // Text aktualisieren
    if (statusText) {
        statusText.textContent = ' ' + message;
    } else {
        // Fallback: ganzen Text setzen
        elements.statusDisplay.innerHTML = `<i class="fas ${
            type === 'error' ? 'fa-exclamation-triangle' :
            type === 'success' ? 'fa-check-circle' :
            'fa-info-circle'
        }"></i> ${message}`;
    }
    
    // Farbe aktualisieren
    elements.statusDisplay.style.color = 
        type === 'error' ? '#dc3545' :
        type === 'success' ? '#28a745' :
        '#333';
}

function showLoading(show) {
    console.log('Loading overlay:', show);
    
    if (elements.loadingOverlay) {
        if (show) {
            elements.loadingOverlay.classList.remove('hidden');
        } else {
            elements.loadingOverlay.classList.add('hidden');
        }
    }
}

function showModal(modalId) {
    console.log('Showing modal:', modalId);
    
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeModal(modalId) {
    console.log('Closing modal:', modalId);
    
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

function copyToClipboard(elementId) {
    console.log('Copying to clipboard:', elementId);
    
    const element = document.getElementById(elementId);
    if (element) {
        element.select();
        element.setSelectionRange(0, 99999); // Für mobile Geräte
        
        try {
            document.execCommand('copy');
            updateStatus('In Zwischenablage kopiert!', 'success');
            
            // Kurzes visuelles Feedback
            const originalBg = element.style.backgroundColor;
            element.style.backgroundColor = '#d4edda';
            setTimeout(() => {
                element.style.backgroundColor = originalBg;
            }, 300);
        } catch (err) {
            console.error('Copy failed:', err);
            updateStatus('Kopieren fehlgeschlagen', 'error');
        }
    } else {
        console.error('Element not found for copying:', elementId);
    }
}

// Modal Event Listeners
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.classList.add('hidden');
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
    }
});

// Session-Start-Zeit setzen
window.sessionStartTime = Date.now();

// Redirect URI Management
function updateRedirectUri() {
    const select = document.getElementById('redirect-uri-select');
    const input = document.getElementById('redirect-uri');
    const info = document.getElementById('redirect-info');
    
    if (select.value === 'custom') {
        input.style.display = 'block';
        input.value = '';
        input.focus();
        info.textContent = 'Geben Sie Ihre eigene Redirect URI ein';
    } else {
        input.style.display = 'block';
        input.value = select.value;
        
        // Spezifische Hinweise je nach ausgewählter URI
        if (select.value.includes('api-client-oauth2-example.passolution.de')) {
            info.textContent = 'Funktioniert nur wenn Ihre App unter dieser Domain läuft';
        } else if (select.value.includes('localhost')) {
            info.textContent = 'Für lokale Entwicklung und Tests';
        } else {
            info.textContent = 'Diese URI muss in Ihrer OAuth2-App-Konfiguration registriert sein';
        }
    }
}

console.log('OAuth2 Script loaded successfully');