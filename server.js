const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Session Storage (nur für diese Session)
const sessions = new Map();

// Route für die Hauptseite
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// OAuth2 Callback Route
app.get('/oauth/callback', (req, res) => {
    const { code, state, error, error_description } = req.query;
    
    console.log('OAuth Callback received:', { 
        code: code ? '***' + code.slice(-4) : null, 
        state, 
        error, 
        error_description 
    });
    
    // Redirect zur Hauptseite mit Parametern
    const params = new URLSearchParams();
    if (code) params.append('code', code);
    if (state) params.append('state', state);
    if (error) params.append('error', error);
    if (error_description) params.append('error_description', error_description);
    
    const redirectUrl = `/?${params.toString()}`;
    res.redirect(redirectUrl);
});

// OAuth2 Authorization URL generieren
app.post('/api/generate-auth-url', (req, res) => {
    const { clientId, authUrl, redirectUri, scope } = req.body;
    
    if (!clientId || !authUrl || !redirectUri) {
        return res.status(400).json({ 
            error: 'Client ID, Authorization URL und Redirect URI sind erforderlich' 
        });
    }

    // Generiere State und Code Verifier für PKCE
    const state = crypto.randomBytes(32).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    
    const sessionId = uuidv4();
    
    // Session-Daten speichern
    sessions.set(sessionId, {
        clientId,
        authUrl,
        redirectUri,
        scope: scope || 'read',
        state,
        codeVerifier,
        codeChallenge,
        createdAt: new Date()
    });

    // Authorization URL zusammenbauen
    const authorizationUrl = new URL(authUrl);
    authorizationUrl.searchParams.append('response_type', 'code');
    authorizationUrl.searchParams.append('client_id', clientId);
    authorizationUrl.searchParams.append('redirect_uri', redirectUri);
    authorizationUrl.searchParams.append('scope', scope || 'read');
    authorizationUrl.searchParams.append('state', state);
    authorizationUrl.searchParams.append('code_challenge', codeChallenge);
    authorizationUrl.searchParams.append('code_challenge_method', 'S256');

    res.json({
        sessionId,
        authorizationUrl: authorizationUrl.toString(),
        state,
        codeChallenge,
        step: 'authorization_request_generated'
    });
});

// OAuth2 Callback verarbeiten
app.post('/api/handle-callback', async (req, res) => {
    const { sessionId, code, state, error } = req.body;
    
    if (!sessions.has(sessionId)) {
        return res.status(400).json({ error: 'Ungültige Session ID' });
    }

    const sessionData = sessions.get(sessionId);

    if (error) {
        return res.status(400).json({ 
            error: 'Authorization fehlgeschlagen',
            details: error
        });
    }

    if (state !== sessionData.state) {
        return res.status(400).json({ error: 'State Parameter stimmt nicht überein' });
    }

    if (!code) {
        return res.status(400).json({ error: 'Authorization Code fehlt' });
    }

    // Authorization Code in Session speichern
    sessionData.authorizationCode = code;
    sessionData.step = 'authorization_code_received';
    
    res.json({
        success: true,
        authorizationCode: code,
        step: 'authorization_code_received'
    });
});

// Access Token anfordern
app.post('/api/exchange-token', async (req, res) => {
    const { sessionId, clientSecret, tokenUrl } = req.body;
    
    if (!sessions.has(sessionId)) {
        return res.status(400).json({ error: 'Ungültige Session ID' });
    }

    const sessionData = sessions.get(sessionId);
    
    if (!sessionData.authorizationCode) {
        return res.status(400).json({ error: 'Kein Authorization Code verfügbar' });
    }

    if (!clientSecret || !tokenUrl) {
        return res.status(400).json({ error: 'Client Secret und Token URL sind erforderlich' });
    }

    try {
        // Token Request
        const tokenResponse = await axios.post(tokenUrl, {
            grant_type: 'authorization_code',
            client_id: sessionData.clientId,
            client_secret: clientSecret,
            code: sessionData.authorizationCode,
            redirect_uri: sessionData.redirectUri,
            code_verifier: sessionData.codeVerifier
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        // Token-Daten in Session speichern
        sessionData.accessToken = tokenResponse.data.access_token;
        sessionData.refreshToken = tokenResponse.data.refresh_token;
        sessionData.tokenType = tokenResponse.data.token_type || 'Bearer';
        sessionData.expiresIn = tokenResponse.data.expires_in;
        sessionData.tokenReceivedAt = new Date();
        sessionData.step = 'access_token_received';

        res.json({
            success: true,
            accessToken: sessionData.accessToken,
            refreshToken: sessionData.refreshToken,
            tokenType: sessionData.tokenType,
            expiresIn: sessionData.expiresIn,
            step: 'access_token_received'
        });

    } catch (error) {
        console.error('Token Exchange Error:', error.response?.data || error.message);
        res.status(400).json({ 
            error: 'Token-Austausch fehlgeschlagen',
            details: error.response?.data || error.message
        });
    }
});

// Refresh Token verwenden
app.post('/api/refresh-token', async (req, res) => {
    const { sessionId, clientSecret, tokenUrl } = req.body;
    
    if (!sessions.has(sessionId)) {
        return res.status(400).json({ error: 'Ungültige Session ID' });
    }

    const sessionData = sessions.get(sessionId);
    
    if (!sessionData.refreshToken) {
        return res.status(400).json({ error: 'Kein Refresh Token verfügbar' });
    }

    try {
        const refreshResponse = await axios.post(tokenUrl, {
            grant_type: 'refresh_token',
            client_id: sessionData.clientId,
            client_secret: clientSecret,
            refresh_token: sessionData.refreshToken
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        // Neue Token-Daten speichern
        sessionData.accessToken = refreshResponse.data.access_token;
        if (refreshResponse.data.refresh_token) {
            sessionData.refreshToken = refreshResponse.data.refresh_token;
        }
        sessionData.tokenType = refreshResponse.data.token_type || 'Bearer';
        sessionData.expiresIn = refreshResponse.data.expires_in;
        sessionData.tokenRefreshedAt = new Date();

        res.json({
            success: true,
            accessToken: sessionData.accessToken,
            refreshToken: sessionData.refreshToken,
            tokenType: sessionData.tokenType,
            expiresIn: sessionData.expiresIn
        });

    } catch (error) {
        console.error('Token Refresh Error:', error.response?.data || error.message);
        res.status(400).json({ 
            error: 'Token-Aktualisierung fehlgeschlagen',
            details: error.response?.data || error.message
        });
    }
});

// Session-Daten abrufen
app.get('/api/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    
    if (!sessions.has(sessionId)) {
        return res.status(404).json({ error: 'Session nicht gefunden' });
    }

    const sessionData = sessions.get(sessionId);
    
    // Sensible Daten für die Anzeige vorbereiten
    const responseData = {
        sessionId,
        step: sessionData.step || 'initialized',
        clientId: sessionData.clientId,
        redirectUri: sessionData.redirectUri,
        scope: sessionData.scope,
        authorizationCode: sessionData.authorizationCode ? '***' + sessionData.authorizationCode.slice(-4) : null,
        accessToken: sessionData.accessToken ? '***' + sessionData.accessToken.slice(-8) : null,
        refreshToken: sessionData.refreshToken ? '***' + sessionData.refreshToken.slice(-8) : null,
        tokenType: sessionData.tokenType,
        expiresIn: sessionData.expiresIn,
        createdAt: sessionData.createdAt,
        tokenReceivedAt: sessionData.tokenReceivedAt,
        tokenRefreshedAt: sessionData.tokenRefreshedAt
    };

    res.json(responseData);
});

// Token-Daten für E-Mail-Versand vorbereiten
app.get('/api/session/:sessionId/export', (req, res) => {
    const { sessionId } = req.params;
    
    if (!sessions.has(sessionId)) {
        return res.status(404).json({ error: 'Session nicht gefunden' });
    }

    const sessionData = sessions.get(sessionId);
    
    const exportData = {
        sessionId,
        clientId: sessionData.clientId,
        accessToken: sessionData.accessToken,
        refreshToken: sessionData.refreshToken,
        tokenType: sessionData.tokenType,
        expiresIn: sessionData.expiresIn,
        scope: sessionData.scope,
        generatedAt: new Date().toISOString()
    };

    res.json(exportData);
});

// Session löschen (optional)
app.delete('/api/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    
    if (sessions.has(sessionId)) {
        sessions.delete(sessionId);
        res.json({ success: true, message: 'Session gelöscht' });
    } else {
        res.status(404).json({ error: 'Session nicht gefunden' });
    }
});

// Cleanup alte Sessions (läuft alle 10 Minuten)
setInterval(() => {
    const now = new Date();
    const maxAge = 60 * 60 * 1000; // 1 Stunde
    
    for (const [sessionId, sessionData] of sessions.entries()) {
        if (now - sessionData.createdAt > maxAge) {
            sessions.delete(sessionId);
            console.log(`Session ${sessionId} wegen Alter gelöscht`);
        }
    }
}, 10 * 60 * 1000);

app.listen(PORT, () => {
    console.log(`OAuth2 Demo Server läuft auf http://localhost:${PORT}`);
    console.log(`Öffnen Sie http://localhost:${PORT} in Ihrem Browser`);
});