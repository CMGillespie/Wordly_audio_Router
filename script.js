// Wordly Audio Routing Script v2.1
document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const loginPage = document.getElementById('login-page');
  const appPage = document.getElementById('app-page');
  const sessionEndOverlay = document.getElementById('session-end-overlay');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const credentialsForm = document.getElementById('credentials-form');
  const linkForm = document.getElementById('link-form');
  const loginStatus = document.getElementById('login-status');
  const sessionIdDisplay = document.getElementById('session-id-display');
  const disconnectBtn = document.getElementById('disconnect-btn');
  const addDeviceBtn = document.getElementById('add-device-btn');
  const playerGrid = document.getElementById('player-grid');
  const browserWarning = document.getElementById('browser-warning');
  const noDeviceSupportMessage = document.getElementById('no-device-support');
  const globalCollapseBtn = document.getElementById('global-collapse-btn');
  const presetNameInput = document.getElementById('preset-name');
  const savePresetBtn = document.getElementById('save-preset-btn');
  const presetSelect = document.getElementById('preset-select');
  const loadPresetBtn = document.getElementById('load-preset-btn');
  const deletePresetBtn = document.getElementById('delete-preset-btn');

  // --- State ---
  const state = {
    sessionId: null, passcode: '', devices: [], players: [], presets: {},
    supportsSinkId: typeof HTMLAudioElement !== 'undefined' && typeof HTMLAudioElement.prototype.setSinkId === 'function',
    allCollapsed: false, languageMap: {}, isUserDisconnecting: false
  };

  const fallbackLanguageMap = {
    'en': 'English (US)', 'es': 'Spanish (ES)', 'fr': 'French (FR)',
    'de': 'German', 'ja': 'Japanese', 'pt-BR': 'Portuguese (BR)', 'zh-CN': 'Chinese (Simplified)'
  };

  init();

  // --- v2.1 Persistence Logging ---
  function logEvent(player, action, details = "") {
    const timestamp = new Date().toLocaleTimeString();
    const logKey = `wordly_log_${player.id}`;
    let logs = JSON.parse(localStorage.getItem(logKey) || "[]");
    logs.push({ timestamp, action, details });
    if (logs.length > 50) logs.shift();
    localStorage.setItem(logKey, JSON.stringify(logs));
    console.log(`[${timestamp}] ${player.id}: ${action} ${details}`);
  }

  // --- Utilities ---
  function playAlertSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const playTone = (freq, start, duration) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + start + duration);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + start); osc.stop(audioCtx.currentTime + start + duration);
      };
      playTone(440, 0, 0.2); playTone(880, 0.2, 0.4);
    } catch (e) { console.error("Alert failed:", e); }
  }

  function handleReconnection(player) {
    player.reconnectAttempts = (player.reconnectAttempts || 0) + 1;
    logEvent(player, "RECONNECT_ATTEMPT", `#${player.reconnectAttempts}`);
    if (player.reconnectAttempts === 3) playAlertSound();

    const delay = Math.min(2000 * Math.pow(1.5, player.reconnectAttempts - 1), 10000);
    updatePlayerStatus(player, 'connecting');
    
    setTimeout(() => {
        if (!state.isUserDisconnecting && state.players.find(p => p.id === player.id)) {
            connectPlayerWebSocket(player);
        }
    }, delay);
  }

  // --- WebSocket Watchdogs ---
  function resetWSWatchdog(player) {
    if (player.wsWatchdog) clearTimeout(player.wsWatchdog);
    // v2.1: assume connection dead if no messages for 90 seconds
    player.wsWatchdog = setTimeout(() => {
      logEvent(player, "WATCHDOG_KILLED_WS", "90s of silence detected.");
      if (player.websocket) player.websocket.close();
    }, 90000);
  }

  // --- Initialization ---
  async function loadLanguageData() {
    const url = 'https://assets.wordly.ai/language-config/languages.json';
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error();
      const data = await response.json();
      state.languageMap = data.languages.filter(l => l.isTranslatable).reduce((map, l) => { map[l.wordlyCode] = l.englishName; return map; }, {});
    } catch (e) { state.languageMap = fallbackLanguageMap; }
  }

  async function init() {
    await loadLanguageData();
    setupTabs(); setupLoginForms(); setupPresetControls(); setupAppControls();
    checkBrowserCompatibility(); loadPresetsFromStorage();
    document.getElementById('return-to-login-btn').addEventListener('click', () => location.reload());
  }

  function checkBrowserCompatibility() {
    if (!(/Chrome/.test(navigator.userAgent) || /Edg/.test(navigator.userAgent))) browserWarning.style.display = 'block';
  }

  function setupTabs() {
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        button.classList.add('active');
        document.getElementById(button.getAttribute('data-tab')).classList.add('active');
      });
    });
  }

  function setupLoginForms() {
    credentialsForm.addEventListener('submit', (e) => {
      e.preventDefault(); state.isUserDisconnecting = false;
      let sid = document.getElementById('session-id').value.trim();
      if (!isValidSessionId(sid)) {
        sid = sid.replace(/[^A-Za-z0-9]/g, '');
        if (sid.length === 8) sid = `${sid.substring(0, 4)}-${sid.substring(4)}`;
      }
      if (isValidSessionId(sid)) processLogin(sid, document.getElementById('passcode').value.trim());
      else showLoginError('Invalid Session ID');
    });
    linkForm.addEventListener('submit', (e) => {
      e.preventDefault(); state.isUserDisconnecting = false;
      try {
        const url = new URL(document.getElementById('weblink').value.trim());
        const p = url.pathname.split('/').filter(i => i);
        const sid = p[p.length-1].length === 8 ? `${p[p.length-1].substring(0,4)}-${p[p.length-1].substring(4)}` : p[p.length-1];
        processLogin(sid, url.searchParams.get('key') || '');
      } catch(e) { showLoginError('Invalid link'); }
    });
  }

  function setupAppControls() {
    disconnectBtn.addEventListener('click', disconnectFromSession);
    addDeviceBtn.addEventListener('click', () => addNewPlayer());
    globalCollapseBtn.addEventListener('click', toggleAllPlayers);
  }

  function setupPresetControls() {
    savePresetBtn.addEventListener('click', savePreset);
    loadPresetBtn.addEventListener('click', loadSelectedPreset);
    deletePresetBtn.addEventListener('click', deleteSelectedPreset);
  }

  function isValidSessionId(id) { return /^[A-Za-z0-9]{4}-\d{4}$/.test(id); }

  async function processLogin(sessionId, passcode) {
    try {
        await initializeAudioDevices(); 
        state.sessionId = sessionId; state.passcode = passcode;
        loginPage.style.display = 'none'; appPage.style.display = 'flex';
        sessionIdDisplay.textContent = `Session: ${sessionId}`;
        if (state.players.length === 0) addNewPlayer();
    } catch (err) { showLoginError(`Device Error: ${err.message}`); }
  }

  async function initializeAudioDevices() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    const devices = await navigator.mediaDevices.enumerateDevices();
    state.devices = devices.filter(d => d.kind === 'audiooutput');
  }

  function disconnectFromSession() {
    state.isUserDisconnecting = true;
    state.players.forEach(p => { stopPlayerAudio(p); if (p.websocket) p.websocket.close(1000, "User Exit"); });
    playerGrid.innerHTML = ''; state.players = []; appPage.style.display = 'none'; loginPage.style.display = 'flex';
  }

  // --- Player Management ---
  function addNewPlayer(config = {}) {
    const id = `player-${Date.now()}`;
    const cfg = { language: 'en', deviceId: '', audioEnabled: false, collapsed: false, ...config };
    const el = document.createElement('div'); el.className = 'player'; el.id = id;
    el.innerHTML = `
      <div class="player-header">
        <div class="player-title"><span class="player-status-light connecting"></span><span class="device-name">${getDeviceName(cfg.deviceId)}</span><span class="player-language-indicator">${getLanguageName(cfg.language)}</span></div>
        <div class="player-controls"><button class="player-btn collapse-btn">Collapse</button><button class="player-btn remove-btn">Remove</button></div>
      </div>
      <div class="player-settings">
        <div class="setting-group"><span class="setting-label">Language:</span><select class="setting-select language-select"></select></div>
        <div class="setting-group"><span class="setting-label">Device:</span><select class="setting-select device-select"></select></div>
        <label class="toggle"><input type="checkbox" class="audio-toggle" ${cfg.audioEnabled ? 'checked' : ''}><span class="slider"></span><span class="setting-label">Audio</span></label>
      </div>
      <div class="player-content ${cfg.collapsed ? 'collapsed' : ''}"><div class="player-transcript"></div><div class="audio-status">Audio ready</div></div>
    `;
    playerGrid.appendChild(el);
    populateLanguageSelect(el.querySelector('.language-select'), cfg.language);
    populateDeviceSelect(el.querySelector('.device-select'), cfg.deviceId);
    const inst = { id, element: el, language: cfg.language, deviceId: cfg.deviceId, audioEnabled: cfg.audioEnabled, collapsed: cfg.collapsed, websocket: null, audioQueue: [], isPlayingAudio: false, currentAudioElement: null };
    state.players.push(inst); addPlayerListeners(el, inst); connectPlayerWebSocket(inst); return inst;
  }

  // --- WebSocket Handling ---
  function connectPlayerWebSocket(player) {
    if (player.heartbeatTimer) clearInterval(player.heartbeatTimer);
    try {
      player.websocket = new WebSocket('wss://endpoint.wordly.ai/attend');
      player.websocket.onopen = () => {
        player.reconnectAttempts = 0; logEvent(player, "WS_OPEN");
        player.websocket.send(JSON.stringify({ type: 'connect', presentationCode: state.sessionId, languageCode: player.language }));
        player.heartbeatTimer = setInterval(() => { if (player.websocket.readyState === 1) player.websocket.send(JSON.stringify({type: 'echo'})); }, 30000);
        resetWSWatchdog(player);
      };
      player.websocket.onmessage = (e) => {
        resetWSWatchdog(player);
        handleWSMessage(player, JSON.parse(e.data));
      };
      player.websocket.onclose = (e) => {
        if (player.heartbeatTimer) clearInterval(player.heartbeatTimer);
        logEvent(player, "WS_CLOSE", `Code: ${e.code}`);
        if (!state.isUserDisconnecting) handleReconnection(player);
      };
      player.websocket.onerror = (e) => { logEvent(player, "WS_ERROR"); player.websocket.close(); };
    } catch (e) { handleReconnection(player); }
  }

  function handleWSMessage(player, msg) {
    switch (msg.type) {
      case 'status':
        if (msg.success) {
            updatePlayerStatus(player, 'connected');
            if (player.audioEnabled) player.websocket.send(JSON.stringify({type: 'voice', enabled: true}));
        } else {
            logEvent(player, "WORDLY_STATUS_FAIL", `Code ${msg.code}: ${msg.message}`);
            updatePlayerStatus(player, 'error');
        }
        break;
      case 'phrase': handlePhrase(player, msg); break;
      case 'speech': handleSpeech(player, msg); break;
      case 'end': handleSessionEnd(msg); break;
    }
  }

  function handleSessionEnd(msg) {
    const codes = { 2: "Presentation is not available.", 3: "Not enough minutes available.", 4: "Session ended because minutes ran out." };
    document.getElementById('end-reason-message').textContent = codes[msg.code] || msg.message || "The presenter has ended the session.";
    appPage.style.display = 'none'; sessionEndOverlay.style.display = 'flex';
  }

  function handlePhrase(player, msg) {
    const container = player.element.querySelector('.player-transcript');
    let el = container.querySelector(`#p-${player.id}-${msg.phraseId}`);
    if (!el) {
      el = document.createElement('div'); el.id = `p-${player.id}-${msg.phraseId}`; el.className = 'phrase';
      el.innerHTML = `<div class="phrase-header"><span>${msg.name || 'Speaker'}</span></div><div class="phrase-text"></div>`;
      container.insertBefore(el, container.firstChild);
      while(container.children.length > 50) container.removeChild(container.lastChild);
    }
    el.querySelector('.phrase-text').textContent = msg.translatedText;
  }

  function handleSpeech(player, msg) {
    if (!player.audioEnabled || !msg.synthesizedSpeech?.data) return;
    player.audioQueue.push({ data: msg.synthesizedSpeech.data, phraseId: msg.phraseId });
    processAudioQueue(player);
  }

  // --- Audio Engine ---
  function processAudioQueue(player) {
    const status = player.element.querySelector('.audio-status');
    if (status && player.audioEnabled) { status.textContent = player.audioQueue.length > 0 ? `Queue: ${player.audioQueue.length} items` : 'Audio ready'; }
    if (player.isPlayingAudio || player.audioQueue.length === 0) return;
    player.isPlayingAudio = true;
    const item = player.audioQueue.shift();
    const phraseEl = player.element.querySelector(`#p-${player.id}-${item.phraseId}`);
    player.audioWatchdog = setTimeout(() => {
      logEvent(player, "AUDIO_STALL_RESET"); playAlertSound(); cleanupAudio(player, player.currentUrl, phraseEl);
    }, 60000);
    try {
      const blob = new Blob([new Uint8Array(item.data)], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      player.currentUrl = url;
      const aud = new Audio(); player.currentAudioElement = aud; aud.src = url;
      aud.oncanplaythrough = async () => {
        if (player.deviceId && state.supportsSinkId) try { await aud.setSinkId(player.deviceId); } catch(e){}
        try { await aud.play(); if (phraseEl) phraseEl.classList.add('phrase-playing'); } catch(e) { cleanupAudio(player, url, phraseEl); }
      };
      aud.onended = () => cleanupAudio(player, url, phraseEl);
      aud.onerror = () => cleanupAudio(player, url, phraseEl);
      aud.load();
    } catch(e) { player.isPlayingAudio = false; setTimeout(() => processAudioQueue(player), 0); }
  }

  function cleanupAudio(player, url, el) {
    if (player.audioWatchdog) { clearTimeout(player.audioWatchdog); player.audioWatchdog = null; }
    if (url) URL.revokeObjectURL(url);
    if (el) el.classList.remove('phrase-playing');
    player.isPlayingAudio = false; player.currentAudioElement = null;
    setTimeout(() => processAudioQueue(player), 0);
  }

  function stopPlayerAudio(player) {
    if (player.audioWatchdog) clearTimeout(player.audioWatchdog);
    if (player.currentAudioElement) { try { player.currentAudioElement.pause(); player.currentAudioElement.src = ''; } catch(e){} }
    player.audioQueue = []; player.isPlayingAudio = false;
  }

  // --- UI Helpers ---
  function populateLanguageSelect(sel, selected) { sel.innerHTML = Object.entries(state.languageMap).sort((a,b) => a[1].localeCompare(b[1])).map(([c,n]) => `<option value="${c}" ${c===selected?'selected':''}>${n}</option>`).join(''); }
  function populateDeviceSelect(sel, selected) { sel.innerHTML = `<option value="">System Default</option>` + state.devices.map(d => `<option value="${d.deviceId}" ${d.deviceId===selected?'selected':''}>${d.label}</option>`).join(''); }
  function getDeviceName(id) { return state.devices.find(d => d.deviceId === id)?.label || 'System Default'; }
  function getLanguageName(c) { return state.languageMap[c] || c; }

  function addPlayerListeners(el, p) {
    el.querySelector('.language-select').addEventListener('change', (e) => { p.language = e.target.value; el.querySelector('.player-language-indicator').textContent = getLanguageName(p.language); if (p.websocket?.readyState === 1) p.websocket.send(JSON.stringify({type:'change', languageCode: p.language})); });
    el.querySelector('.device-select').addEventListener('change', (e) => { p.deviceId = e.target.value; el.querySelector('.device-name').textContent = getDeviceName(p.deviceId); });
    el.querySelector('.audio-toggle').addEventListener('change', (e) => {
      p.audioEnabled = e.target.checked;
      if (p.websocket?.readyState === 1) { p.websocket.send(JSON.stringify({type:'voice', enabled: p.audioEnabled})); updatePlayerStatus(p, 'connected'); }
      if (p.audioEnabled) processAudioQueue(p); else stopPlayerAudio(p);
    });
    el.querySelector('.collapse-btn').addEventListener('click', () => { p.collapsed = !p.collapsed; el.querySelector('.player-content').classList.toggle('collapsed', p.collapsed); el.querySelector('.collapse-btn').textContent = p.collapsed ? 'Expand' : 'Collapse'; });
    el.querySelector('.remove-btn').addEventListener('click', () => { if(confirm('Remove?')) { stopPlayerAudio(p); if(p.websocket) p.websocket.close(); el.remove(); state.players = state.players.filter(i=>i.id!==p.id); }});
  }

  function toggleAllPlayers() { state.allCollapsed = !state.allCollapsed; state.players.forEach(p => { p.collapsed = state.allCollapsed; p.element.querySelector('.player-content').classList.toggle('collapsed', p.collapsed); p.element.querySelector('.collapse-btn').textContent = p.collapsed ? 'Expand' : 'Collapse'; }); globalCollapseBtn.textContent = state.allCollapsed ? 'Expand All' : 'Collapse All'; }
  function showLoginError(m) { loginStatus.textContent = m; loginStatus.className = 'status-message error'; }
  function showLoginSuccess(m) { loginStatus.textContent = m; loginStatus.className = 'status-message success'; }
  function updatePlayerStatus(p, s) {
    let cls = s;
    if (s === 'connected') cls = p.audioEnabled ? 'connected-active' : 'connected-muted';
    const light = p.element.querySelector('.player-status-light');
    if (light) light.className = `player-status-light ${cls}`;
  }
  
  function loadPresetsFromStorage() { const s = localStorage.getItem('wordlyPresets'); if (s) { state.presets = JSON.parse(s); updatePresetDropdown(); } }
  function updatePresetDropdown() { presetSelect.innerHTML = '<option value="">-- Select Preset --</option>' + Object.keys(state.presets).sort().map(p => `<option value="${p}">${p}</option>`).join(''); }
  function savePreset() { const n = presetNameInput.value.trim(); if (!n || !state.sessionId) return; state.presets[n] = { players: state.players.map(p => ({ language: p.language, deviceId: p.deviceId, audioEnabled: p.audioEnabled, collapsed: p.collapsed })) }; localStorage.setItem('wordlyPresets', JSON.stringify(state.presets)); updatePresetDropdown(); presetNameInput.value = ''; }
  function loadSelectedPreset() { const p = state.presets[presetSelect.value]; if (!p) return; state.players.forEach(i => { stopPlayerAudio(i); if(i.websocket) i.websocket.close(); }); playerGrid.innerHTML = ''; state.players = []; p.players.forEach(cfg => addNewPlayer(cfg)); }
  function deleteSelectedPreset() { delete state.presets[presetSelect.value]; localStorage.setItem('wordlyPresets', JSON.stringify(state.presets)); updatePresetDropdown(); }
});