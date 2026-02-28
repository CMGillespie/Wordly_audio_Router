// Wordly Audio Routing Script v2.0
document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const loginPage = document.getElementById('login-page');
  const appPage = document.getElementById('app-page');
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
    sessionId: null,
    passcode: '',
    devices: [],
    players: [], 
    presets: {},
    supportsSinkId: typeof HTMLAudioElement !== 'undefined' && 
                   typeof HTMLAudioElement.prototype.setSinkId === 'function',
    allCollapsed: false,
    languageMap: {},
    isUserDisconnecting: false
  };

  const fallbackLanguageMap = {
    'en': 'English (US)', 'es': 'Spanish (ES)', 'fr': 'French (FR)',
    'de': 'German', 'ja': 'Japanese', 'pt-BR': 'Portuguese (BR)', 'zh-CN': 'Chinese (Simplified)'
  };

  init();

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
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + start);
        osc.stop(audioCtx.currentTime + start + duration);
      };
      playTone(440, 0, 0.2);
      playTone(880, 0.2, 0.4);
    } catch (e) { console.error("Alert failed:", e); }
  }

  function handleReconnection(player) {
    player.reconnectAttempts = (player.reconnectAttempts || 0) + 1;
    if (player.reconnectAttempts === 3) playAlertSound();

    const delay = Math.min(100 * Math.pow(2, player.reconnectAttempts - 1), 10000);
    updatePlayerStatus(player, 'connecting', `Retrying (${player.reconnectAttempts})...`);
    
    setTimeout(() => {
        if (!state.isUserDisconnecting && state.players.find(p => p.id === player.id)) {
            connectPlayerWebSocket(player);
        }
    }, delay);
  }

  // --- Initialization ---

  async function loadLanguageData() {
    const url = 'https://assets.wordly.ai/language-config/languages.json';
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      state.languageMap = data.languages.filter(l => l.isTranslatable)
        .reduce((map, l) => { map[l.wordlyCode] = l.englishName; return map; }, {});
    } catch (error) {
      state.languageMap = fallbackLanguageMap;
      showLoginError('Could not load full language list. Using fallback.');
    }
  }

  async function init() {
    await loadLanguageData();
    setupTabs();
    setupLoginForms();
    setupPresetControls();
    setupAppControls();
    checkBrowserCompatibility();
    loadPresetsFromStorage();
  }

  function checkBrowserCompatibility() {
    if (!(/Chrome/.test(navigator.userAgent) || /Edg/.test(navigator.userAgent))) browserWarning.style.display = 'block';
    if (!state.supportsSinkId) noDeviceSupportMessage.style.display = 'block';
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
    credentialsForm.addEventListener('submit', handleCredentialsForm);
    linkForm.addEventListener('submit', handleLinkForm);
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

  // --- Login & Session ---

  function handleCredentialsForm(e) {
    e.preventDefault();
    state.isUserDisconnecting = false;
    let sid = document.getElementById('session-id').value.trim();
    const pc = document.getElementById('passcode').value.trim();
    if (!isValidSessionId(sid)) {
      sid = sid.replace(/[^A-Za-z0-9]/g, '');
      if (sid.length === 8) sid = `${sid.substring(0, 4)}-${sid.substring(4)}`;
      if (!isValidSessionId(sid)) { showLoginError('Invalid Session ID format'); return; }
    }
    processLogin(sid, pc);
  }

  function handleLinkForm(e) {
    e.preventDefault();
    state.isUserDisconnecting = false;
    const link = document.getElementById('weblink').value.trim();
    try {
      const url = new URL(link);
      const parts = url.pathname.split('/').filter(p => p);
      const sid = parts[parts.length - 1].length === 8 ? `${parts[parts.length - 1].substring(0, 4)}-${parts[parts.length - 1].substring(4)}` : parts[parts.length - 1];
      if (!isValidSessionId(sid)) throw new Error();
      processLogin(sid, url.searchParams.get('key') || '');
    } catch (e) { showLoginError('Invalid invite link'); }
  }

  function isValidSessionId(id) { return /^[A-Za-z0-9]{4}-\d{4}$/.test(id); }

  async function processLogin(sessionId, passcode) {
    showLoginSuccess('Initializing devices...');
    try {
        await initializeAudioDevices(); 
        state.sessionId = sessionId;
        state.passcode = passcode;
        loginPage.style.display = 'none';
        appPage.style.display = 'flex';
        sessionIdDisplay.textContent = `Session: ${sessionId}`;
        if (state.players.length === 0) addNewPlayer();
        showNotification(`Connected to ${sessionId}`, 'success');
    } catch (err) { showLoginError(`Device Error: ${err.message}`); }
  }

  async function initializeAudioDevices() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    const devices = await navigator.mediaDevices.enumerateDevices();
    state.devices = devices.filter(d => d.kind === 'audiooutput');
    state.players.forEach(p => populateDeviceSelect(p.element.querySelector('.device-select'), p.deviceId));
  }

  function disconnectFromSession() {
    state.isUserDisconnecting = true;
    state.players.forEach(p => {
        stopPlayerAudio(p);
        if (p.websocket) p.websocket.close(1000, "User Exit");
    });
    playerGrid.innerHTML = '';
    state.players = [];
    appPage.style.display = 'none';
    loginPage.style.display = 'flex';
    loginStatus.textContent = '';
  }

  // --- Player Management ---

  function addNewPlayer(config = {}) {
    const id = `player-${Date.now()}`;
    const cfg = { language: 'en', deviceId: '', audioEnabled: false, collapsed: false, ...config };
    const el = document.createElement('div');
    el.className = 'player';
    el.id = id;
    
    el.innerHTML = `
      <div class="player-header">
        <div class="player-title">
          <span class="player-status-light connecting"></span>
          <span class="device-name">${getDeviceName(cfg.deviceId)}</span>
          <span class="player-language-indicator">${getLanguageName(cfg.language)}</span>
        </div>
        <div class="player-controls">
          <button class="player-btn collapse-btn">Collapse</button>
          <button class="player-btn remove-btn">Remove</button>
        </div>
      </div>
      <div class="player-settings">
        <div class="setting-group">
          <span class="setting-label">Language:</span>
          <select class="setting-select language-select"></select>
        </div>
        <div class="setting-group">
          <span class="setting-label">Device:</span>
          <select class="setting-select device-select"></select>
        </div>
        <label class="toggle">
          <input type="checkbox" class="audio-toggle" ${cfg.audioEnabled ? 'checked' : ''}>
          <span class="slider"></span>
          <span class="setting-label">Audio</span>
        </label>
      </div>
      <div class="player-content ${cfg.collapsed ? 'collapsed' : ''}">
        <div class="player-transcript"></div>
        <div class="audio-status">Audio ready</div>
      </div>
    `;
    
    playerGrid.appendChild(el);
    populateLanguageSelect(el.querySelector('.language-select'), cfg.language);
    populateDeviceSelect(el.querySelector('.device-select'), cfg.deviceId);
    
    const inst = {
      id, element: el, language: cfg.language, deviceId: cfg.deviceId,
      audioEnabled: cfg.audioEnabled, collapsed: cfg.collapsed,
      websocket: null, audioQueue: [], isPlayingAudio: false, currentAudioElement: null
    };
    
    state.players.push(inst);
    addPlayerListeners(el, inst);
    connectPlayerWebSocket(inst);
    return inst;
  }

  // --- WebSocket & Messaging ---

  function connectPlayerWebSocket(player) {
    if (player.heartbeatTimer) clearInterval(player.heartbeatTimer);
    try {
      player.websocket = new WebSocket('wss://endpoint.wordly.ai/attend');
      player.websocket.onopen = () => {
        player.reconnectAttempts = 0;
        // v2.0 Identity Fix: Join strictly as listener 
        player.websocket.send(JSON.stringify({
          type: 'connect', presentationCode: state.sessionId, languageCode: player.language
        }));
        player.heartbeatTimer = setInterval(() => {
          if (player.websocket.readyState === 1) player.websocket.send(JSON.stringify({type: 'echo'}));
        }, 30000);
      };
      player.websocket.onmessage = (e) => handleWSMessage(player, JSON.parse(e.data));
      player.websocket.onclose = () => {
        if (player.heartbeatTimer) clearInterval(player.heartbeatTimer);
        if (!state.isUserDisconnecting) handleReconnection(player);
      };
      player.websocket.onerror = () => player.websocket.close();
    } catch (e) { handleReconnection(player); }
  }

  function handleWSMessage(player, msg) {
    switch (msg.type) {
      case 'status': if (msg.success && player.audioEnabled) player.websocket.send(JSON.stringify({type: 'voice', enabled: true})); break;
      case 'phrase': handlePhrase(player, msg); break;
      case 'speech': handleSpeech(player, msg); break;
    }
  }

  function handlePhrase(player, msg) {
    const container = player.element.querySelector('.player-transcript');
    let el = container.querySelector(`#p-${player.id}-${msg.phraseId}`);
    if (!el) {
      el = document.createElement('div');
      el.id = `p-${player.id}-${msg.phraseId}`;
      el.className = 'phrase';
      el.innerHTML = `<div class="phrase-header"><span>${msg.name || 'Speaker'}</span></div><div class="phrase-text"></div>`;
      container.insertBefore(el, container.firstChild);
    }
    el.querySelector('.phrase-text').textContent = msg.translatedText;
  }

  function handleSpeech(player, msg) {
    if (!player.audioEnabled || !msg.synthesizedSpeech?.data) return;
    player.audioQueue.push({ data: msg.synthesizedSpeech.data, phraseId: msg.phraseId });
    processAudioQueue(player);
  }

  // --- v2.0 Robust Audio Engine ---

  function processAudioQueue(player) {
    const status = player.element.querySelector('.audio-status');
    if (status && player.audioEnabled) {
      status.textContent = player.audioQueue.length > 0 ? `Queue: ${player.audioQueue.length} items` : 'Audio ready';
    }

    if (player.isPlayingAudio || player.audioQueue.length === 0) return;

    player.isPlayingAudio = true;
    const item = player.audioQueue.shift();
    const phraseEl = player.element.querySelector(`#p-${player.id}-${item.phraseId}`);
    
    // v2.0 WATCHDOG: Safety net for browser stalls
    player.watchdog = setTimeout(() => {
      console.warn(`Watchdog reset for ${player.id}`);
      playAlertSound();
      cleanupAudio(player, player.currentUrl, phraseEl);
    }, 60000);

    try {
      const blob = new Blob([new Uint8Array(item.data)], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      player.currentUrl = url;

      const aud = new Audio();
      player.currentAudioElement = aud;
      aud.src = url;

      aud.oncanplaythrough = async () => {
        if (player.deviceId && state.supportsSinkId) try { await aud.setSinkId(player.deviceId); } catch(e){}
        try {
          await aud.play();
          if (phraseEl) phraseEl.classList.add('phrase-playing');
        } catch(e) { cleanupAudio(player, url, phraseEl); }
      };
      aud.onended = () => cleanupAudio(player, url, phraseEl);
      aud.onerror = () => cleanupAudio(player, url, phraseEl);
      aud.load();
    } catch(e) { player.isPlayingAudio = false; setTimeout(() => processAudioQueue(player), 0); }
  }

  function cleanupAudio(player, url, el) {
    if (player.watchdog) { clearTimeout(player.watchdog); player.watchdog = null; }
    if (url) URL.revokeObjectURL(url);
    if (el) el.classList.remove('phrase-playing');
    player.isPlayingAudio = false;
    player.currentAudioElement = null;
    setTimeout(() => processAudioQueue(player), 0);
  }

  function stopPlayerAudio(player) {
    if (player.watchdog) clearTimeout(player.watchdog);
    if (player.currentAudioElement) {
        try { player.currentAudioElement.pause(); player.currentAudioElement.src = ''; } catch(e){}
    }
    player.audioQueue = []; player.isPlayingAudio = false;
  }

  // --- UI Helpers ---

  function populateLanguageSelect(sel, selected) {
    sel.innerHTML = Object.entries(state.languageMap).sort((a,b) => a[1].localeCompare(b[1]))
      .map(([c,n]) => `<option value="${c}" ${c===selected?'selected':''}>${n}</option>`).join('');
  }

  function populateDeviceSelect(sel, selected) {
    sel.innerHTML = `<option value="">System Default</option>` + 
      state.devices.map(d => `<option value="${d.deviceId}" ${d.deviceId===selected?'selected':''}>${d.label}</option>`).join('');
  }

  function getDeviceName(id) { return state.devices.find(d => d.deviceId === id)?.label || 'System Default'; }
  function getLanguageName(c) { return state.languageMap[c] || c; }

  function addPlayerListeners(el, p) {
    el.querySelector('.language-select').addEventListener('change', (e) => {
      p.language = e.target.value;
      el.querySelector('.player-language-indicator').textContent = getLanguageName(p.language);
      if (p.websocket?.readyState === 1) p.websocket.send(JSON.stringify({type:'change', languageCode: p.language}));
    });
    el.querySelector('.device-select').addEventListener('change', (e) => {
      p.deviceId = e.target.value;
      el.querySelector('.device-name').textContent = getDeviceName(p.deviceId);
    });
    el.querySelector('.audio-toggle').addEventListener('change', (e) => {
      p.audioEnabled = e.target.checked;
      if (p.websocket?.readyState === 1) p.websocket.send(JSON.stringify({type:'voice', enabled: p.audioEnabled}));
      if (p.audioEnabled) processAudioQueue(p); else stopPlayerAudio(p);
    });
    el.querySelector('.collapse-btn').addEventListener('click', () => {
      p.collapsed = !p.collapsed;
      el.querySelector('.player-content').classList.toggle('collapsed', p.collapsed);
      el.querySelector('.collapse-btn').textContent = p.collapsed ? 'Expand' : 'Collapse';
    });
    el.querySelector('.remove-btn').addEventListener('click', () => { if(confirm('Remove?')) { stopPlayerAudio(p); p.websocket?.close(); el.remove(); state.players = state.players.filter(i=>i.id!==p.id); }});
  }

  function toggleAllPlayers() {
    state.allCollapsed = !state.allCollapsed;
    state.players.forEach(p => {
        p.collapsed = state.allCollapsed;
        p.element.querySelector('.player-content').classList.toggle('collapsed', p.collapsed);
        p.element.querySelector('.collapse-btn').textContent = p.collapsed ? 'Expand' : 'Collapse';
    });
    globalCollapseBtn.textContent = state.allCollapsed ? 'Expand All' : 'Collapse All';
  }

  function showLoginError(m) { loginStatus.textContent = m; loginStatus.className = 'status-message error'; }
  function showLoginSuccess(m) { loginStatus.textContent = m; loginStatus.className = 'status-message success'; }
  function showNotification(m, t) {
    const n = document.createElement('div'); n.className = `notification ${t}`; n.textContent = m;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('visible'), 10);
    setTimeout(() => { n.classList.remove('visible'); setTimeout(() => n.remove(), 500); }, 3000);
  }
  
  // --- Storage ---
  function loadPresetsFromStorage() {
    const s = localStorage.getItem('wordlyPresets');
    if (s) { state.presets = JSON.parse(s); updatePresetDropdown(); }
  }
  function updatePresetDropdown() {
    presetSelect.innerHTML = '<option value="">-- Select Preset --</option>' + 
      Object.keys(state.presets).sort().map(p => `<option value="${p}">${p}</option>`).join('');
  }
  function savePreset() {
    const n = presetNameInput.value.trim(); if (!n || !state.sessionId) return;
    state.presets[n] = { players: state.players.map(p => ({ language: p.language, deviceId: p.deviceId, audioEnabled: p.audioEnabled, collapsed: p.collapsed })) };
    localStorage.setItem('wordlyPresets', JSON.stringify(state.presets));
    updatePresetDropdown(); presetNameInput.value = '';
  }
  function loadSelectedPreset() {
    const p = state.presets[presetSelect.value]; if (!p) return;
    state.players.forEach(i => { stopPlayerAudio(i); i.websocket?.close(); });
    playerGrid.innerHTML = ''; state.players = [];
    p.players.forEach(cfg => addNewPlayer(cfg));
  }
  function deleteSelectedPreset() {
    delete state.presets[presetSelect.value];
    localStorage.setItem('wordlyPresets', JSON.stringify(state.presets));
    updatePresetDropdown();
  }
  function updatePlayerStatus(p, s, m) {
    p.element.querySelector('.player-status-light').className = `player-status-light ${s}`;
  }
});
