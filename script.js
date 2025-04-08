// Wordly Audio Routing Script
document.addEventListener('DOMContentLoaded', () => {
  // DOM elements - Login page
  const loginPage = document.getElementById('login-page');
  const appPage = document.getElementById('app-page');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const credentialsForm = document.getElementById('credentials-form');
  const linkForm = document.getElementById('link-form');
  const loginStatus = document.getElementById('login-status');
  
  // DOM elements - App page
  const sessionIdDisplay = document.getElementById('session-id-display');
  const disconnectBtn = document.getElementById('disconnect-btn');
  const addDeviceBtn = document.getElementById('add-device-btn');
  const playerGrid = document.getElementById('player-grid');
  const browserWarning = document.getElementById('browser-warning');
  const noDeviceSupportMessage = document.getElementById('no-device-support');
  const globalCollapseBtn = document.getElementById('global-collapse-btn');
  
  // DOM elements - Preset controls
  const presetNameInput = document.getElementById('preset-name');
  const savePresetBtn = document.getElementById('save-preset-btn');
  const presetSelect = document.getElementById('preset-select');
  const loadPresetBtn = document.getElementById('load-preset-btn');
  const deletePresetBtn = document.getElementById('delete-preset-btn');
  
  // Application state
  const state = {
    sessionId: null,
    passcode: '',
    devices: [],
    players: [],
    presets: {},
    supportsSinkId: typeof HTMLAudioElement !== 'undefined' && 
                   typeof HTMLAudioElement.prototype.setSinkId === 'function',
    allCollapsed: false
  };
  
  // Define language mapping
  const languageMap = {
    'af': 'Afrikaans',
    'sq': 'Albanian',
    'ar': 'Arabic',
    'hy': 'Armenian',
    'bn': 'Bengali',
    'bg': 'Bulgarian',
    'zh-HK': 'Cantonese',
    'ca': 'Catalan',
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    'hr': 'Croatian',
    'cs': 'Czech',
    'da': 'Danish',
    'nl': 'Dutch',
    'en': 'English (US)',
    'en-AU': 'English (AU)',
    'en-GB': 'English (UK)',
    'et': 'Estonian',
    'fi': 'Finnish',
    'fr': 'French (FR)',
    'fr-CA': 'French (CA)',
    'ka': 'Georgian',
    'de': 'German',
    'el': 'Greek',
    'gu': 'Gujarati',
    'he': 'Hebrew',
    'hi': 'Hindi',
    'hu': 'Hungarian',
    'is': 'Icelandic',
    'id': 'Indonesian',
    'ga': 'Irish',
    'it': 'Italian',
    'ja': 'Japanese',
    'kn': 'Kannada',
    'ko': 'Korean',
    'lv': 'Latvian',
    'lt': 'Lithuanian',
    'mk': 'Macedonian',
    'ms': 'Malay',
    'mt': 'Maltese',
    'no': 'Norwegian',
    'fa': 'Persian',
    'pl': 'Polish',
    'pt': 'Portuguese (PT)',
    'pt-BR': 'Portuguese (BR)',
    'ro': 'Romanian',
    'ru': 'Russian',
    'sr': 'Serbian',
    'sk': 'Slovak',
    'sl': 'Slovenian',
    'es': 'Spanish (ES)',
    'es-MX': 'Spanish (MX)',
    'sv': 'Swedish',
    'tl': 'Tagalog',
    'th': 'Thai',
    'tr': 'Turkish',
    'uk': 'Ukrainian',
    'vi': 'Vietnamese',
    'cy': 'Welsh',
    'pa': 'Punjabi',
    'sw': 'Swahili',
    'ta': 'Tamil',
    'ur': 'Urdu',
    'zh': 'Chinese' // For backward compatibility
  };
  
  // Initialize the application
  init();
  
  /**
   * Initialize the application
   */
  function init() {
    // Set up tab switching
    setupTabs();
    
    // Setup login forms
    setupLoginForms();
    
    // Setup preset controls
    setupPresetControls();
    
    // Setup app page controls
    setupAppControls();
    
    // Check browser compatibility
    checkBrowserCompatibility();
    
    // Load presets from local storage
    loadPresetsFromStorage();
  }
  
  /**
   * Check browser compatibility
   */
  function checkBrowserCompatibility() {
    const isChromeBased = /Chrome/.test(navigator.userAgent) || /Edg/.test(navigator.userAgent);
    
    if (!isChromeBased) {
      browserWarning.style.display = 'block';
    }
    
    if (!state.supportsSinkId) {
      noDeviceSupportMessage.style.display = 'block';
    }
  }
  
  /**
   * Set up tab switching
   */
  function setupTabs() {
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        button.classList.add('active');
        
        const tabId = button.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
      });
    });
  }
  
  /**
   * Set up login forms
   */
  function setupLoginForms() {
    credentialsForm.addEventListener('submit', handleCredentialsForm);
    linkForm.addEventListener('submit', handleLinkForm);
  }
  
  /**
   * Set up app controls
   */
  function setupAppControls() {
    disconnectBtn.addEventListener('click', disconnectFromSession);
    addDeviceBtn.addEventListener('click', addNewPlayer);
    globalCollapseBtn.addEventListener('click', toggleAllPlayers);
  }
  
  /**
   * Set up preset controls
   */
  function setupPresetControls() {
    savePresetBtn.addEventListener('click', savePreset);
    loadPresetBtn.addEventListener('click', loadSelectedPreset);
    deletePresetBtn.addEventListener('click', deleteSelectedPreset);
  }
  
  /**
   * Handle credentials form submission
   * @param {Event} e - The form event
   */
  function handleCredentialsForm(e) {
    e.preventDefault();
    
    let inputSessionId = document.getElementById('session-id').value.trim();
    const inputPasscode = document.getElementById('passcode').value.trim();
    
    if (!isValidSessionId(inputSessionId)) {
      inputSessionId = formatSessionId(inputSessionId);
      
      if (!isValidSessionId(inputSessionId)) {
        showLoginError('Please enter a valid session ID in the format XXXX-0000');
        return;
      }
    }
    
    processLogin(inputSessionId, inputPasscode);
  }
  
  /**
   * Handle link form submission
   * @param {Event} e - The form event
   */
  function handleLinkForm(e) {
    e.preventDefault();
    
    const weblink = document.getElementById('weblink').value.trim();
    const { sessionId: parsedSessionId, passcode: parsedPasscode } = parseWeblink(weblink);
    
    if (!parsedSessionId) {
      showLoginError('Unable to extract session information from the provided link');
      return;
    }
    
    processLogin(parsedSessionId, parsedPasscode);
  }
  
  /**
   * Validates session ID format
   * @param {string} sessionId - The session ID to validate
   * @returns {boolean} Whether the session ID is valid
   */
  function isValidSessionId(sessionId) {
    const regex = /^[A-Za-z0-9]{4}-\d{4}$/;
    return regex.test(sessionId);
  }
  
  /**
   * Formats session ID to the correct format if possible
   * @param {string} input - The input to format
   * @returns {string} The formatted session ID
   */
  function formatSessionId(input) {
    if (isValidSessionId(input)) {
      return input;
    }
    
    const cleaned = input.replace(/[^A-Za-z0-9]/g, '');
    
    if (cleaned.length === 8) {
      return `${cleaned.substring(0, 4)}-${cleaned.substring(4)}`;
    }
    
    return input;
  }
  
  /**
   * Parses a weblink to extract session ID and passcode
   * @param {string} weblink - The weblink to parse
   * @returns {Object} The session ID and passcode
   */
  function parseWeblink(weblink) {
    try {
      const url = new URL(weblink);
      
      let sessionId = null;
      let passcode = url.searchParams.get('key') || '';
      
      const pathParts = url.pathname.split('/').filter(part => part);
      
      if (pathParts.length > 0) {
        const potentialSessionId = pathParts[pathParts.length - 1];
        
        if (isValidSessionId(potentialSessionId)) {
          sessionId = potentialSessionId;
        } else if (potentialSessionId.length === 8) {
          sessionId = `${potentialSessionId.substring(0, 4)}-${potentialSessionId.substring(4)}`;
          if (!isValidSessionId(sessionId)) {
            sessionId = null;
          }
        }
      }
      
      return { sessionId, passcode };
    } catch (error) {
      console.error('Error parsing weblink:', error);
      return { sessionId: null, passcode: '' };
    }
  }
  
  /**
   * Shows an error message in the login form
   * @param {string} message - The error message to display
   */
  function showLoginError(message) {
    loginStatus.textContent = message;
    loginStatus.className = 'status-message error';
  }
  
  /**
   * Shows a success message in the login form
   * @param {string} message - The success message to display
   */
  function showLoginSuccess(message) {
    loginStatus.textContent = message;
    loginStatus.className = 'status-message success';
  }
  
  /**
   * Process login with the provided credentials
   * @param {string} sessionId - The session ID
   * @param {string} passcode - The passcode (optional)
   */
  function processLogin(sessionId, passcode) {
    state.sessionId = sessionId;
    state.passcode = passcode || '';
    
    showLoginSuccess('Login successful! Connecting to session...');
    
    // Initialize audio devices
    initializeAudioDevices().then(() => {
      // Switch to app page
      setTimeout(() => {
        loginPage.style.display = 'none';
        appPage.style.display = 'block';
        
        // Display session ID
        sessionIdDisplay.textContent = `Session: ${sessionId}`;
        
        // Add a default player
        if (state.players.length === 0) {
          addNewPlayer();
        }
        
        showNotification(`Connected to session ${sessionId}`, 'success');
      }, 500);
    });
  }
  
  /**
   * Initialize audio devices by requesting permissions
   * @returns {Promise} Promise that resolves when devices are initialized
   */
  async function initializeAudioDevices() {
    try {
      // Request microphone permission to access devices
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      
      // Get list of audio output devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      state.devices = devices.filter(device => device.kind === 'audiooutput');
      
      console.log(`Found ${state.devices.length} audio devices`);
      return state.devices;
    } catch (error) {
      console.error('Error accessing audio devices:', error);
      showNotification('Error accessing audio devices. Please grant microphone permission.', 'error');
      return [];
    }
  }
  
  /**
   * Disconnect from the current session
   */
  function disconnectFromSession() {
    // Clear all players
    playerGrid.innerHTML = '';
    state.players = [];
    
    // Reset form
    credentialsForm.reset();
    linkForm.reset();
    
    // Switch back to login page
    appPage.style.display = 'none';
    loginPage.style.display = 'flex';
    
    // Reset state
    state.sessionId = null;
    state.passcode = '';
    
    showNotification('Disconnected from session', 'success');
  }
  
  /**
   * Add a new player with the specified language/device
   * @param {Object} config - Optional configuration for the player
   */
  function addNewPlayer(config = {}) {
    // Generate unique ID for this player
    const playerId = `player-${Date.now()}`;
    
    // Default configuration
    const defaultConfig = {
      language: 'en',
      deviceId: state.devices.length > 0 ? state.devices[0].deviceId : '',
      audioEnabled: true,
      collapsed: false
    };
    
    // Merge configurations
    const playerConfig = { ...defaultConfig, ...config };
    
    // Create player element
    const playerEl = document.createElement('div');
    playerEl.className = 'player';
    playerEl.id = playerId;
    
    // Get device name
    let deviceName = 'System Default';
    if (playerConfig.deviceId) {
      const device = state.devices.find(d => d.deviceId === playerConfig.deviceId);
      if (device && device.label) {
        deviceName = device.label;
      }
    }
    
    // Get language name
    const languageName = languageMap[playerConfig.language] || 'Unknown';
    
    // Create player HTML
    playerEl.innerHTML = `
      <div class="player-header">
        <div class="player-title">
          <span class="player-status-light connecting"></span>
          <span class="device-name">${deviceName}</span>
          <span class="player-language-indicator">${languageName}</span>
        </div>
        <div class="player-controls">
          <button class="player-btn collapse-btn" data-action="toggle">Collapse</button>
          <button class="player-btn remove-btn" data-action="remove">Remove</button>
        </div>
      </div>
      <div class="player-settings">
        <div class="setting-group">
          <span class="setting-label">Language:</span>
          <select class="setting-select language-select">
            </select>
        </div>
        <div class="setting-group">
          <span class="setting-label">Device:</span>
          <select class="setting-select device-select">
            </select>
        </div>
        <label class="toggle">
          <input type="checkbox" class="audio-toggle" ${playerConfig.audioEnabled ? 'checked' : ''}>
          <span class="slider"></span>
          <span class="setting-label">Audio</span>
        </label>
      </div>
      <div class="player-content ${playerConfig.collapsed ? 'collapsed' : ''}">
        <div class="player-transcript"></div>
        <div class="player-status connecting">Connecting...</div>
        <div class="audio-status">Audio ready</div>
      </div>
    `;
    
    // Add to player grid
    playerGrid.appendChild(playerEl);
    
    // Populate language select
    const languageSelect = playerEl.querySelector('.language-select');
    populateLanguageSelect(languageSelect, playerConfig.language);
    
    // Populate device select
    const deviceSelect = playerEl.querySelector('.device-select');
    populateDeviceSelect(deviceSelect, playerConfig.deviceId);
    
    // Add event listeners
    addPlayerEventListeners(playerEl);
    
    // Create WebSocket
    const playerInstance = {
      id: playerId,
      element: playerEl,
      language: playerConfig.language,
      deviceId: playerConfig.deviceId,
      audioEnabled: playerConfig.audioEnabled,
      collapsed: playerConfig.collapsed,
      websocket: null,
      status: 'connecting',
      phrases: {},
      audioQueue: [],
      isPlayingAudio: false
    };
    
    // Add to state
    state.players.push(playerInstance);
    
    // Connect WebSocket
    connectPlayerWebSocket(playerInstance);
    
    return playerInstance;
  }
  
  /**
   * Connect WebSocket for a player
   * @param {Object} player - The player object
   */
  function connectPlayerWebSocket(player) {
    // Update status to connecting
    updatePlayerStatus(player, 'connecting');
    
    try {
      // Create WebSocket connection
      player.websocket = new WebSocket('wss://endpoint.wordly.ai/attend');
      
      // Set up event handlers
      player.websocket.onopen = () => handleWebSocketOpen(player);
      player.websocket.onmessage = (event) => handleWebSocketMessage(player, event);
      player.websocket.onclose = (event) => handleWebSocketClose(player, event);
      player.websocket.onerror = (error) => handleWebSocketError(player, error);
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      updatePlayerStatus(player, 'error', 'Connection error');
    }
  }
  
  /**
   * Handle WebSocket open event
   * @param {Object} player - The player object
   */
  function handleWebSocketOpen(player) {
    console.log(`WebSocket connection established for player ${player.id}`);
    
    const connectRequest = {
      type: 'connect',
      presentationCode: state.sessionId,
      languageCode: player.language
    };
    
    if (state.passcode) {
      connectRequest.accessKey = state.passcode;
    }
    
    try {
      player.websocket.send(JSON.stringify(connectRequest));
      
      // After connecting, if audio is enabled, send a voice request
      if (player.audioEnabled) {
        setTimeout(() => sendVoiceRequest(player, true), 1000);
      }
    } catch (error) {
      console.error('Error sending connect request:', error);
      updatePlayerStatus(player, 'error', 'Connection error');
    }
  }
  
  /**
   * Handle WebSocket message event
   * @param {Object} player - The player object
   * @param {MessageEvent} event - The message event
   */
  function handleWebSocketMessage(player, event) {
    try {
      const message = JSON.parse(event.data);
      console.log(`Received message type: ${message.type} for player ${player.id}`);
      
      switch (message.type) {
        case 'status':
          handleStatusMessage(player, message);
          break;
        case 'phrase':
          handlePhraseMessage(player, message);
          break;
        case 'speech':
          handleSpeechMessage(player, message);
          break;
        case 'users':
          handleUsersMessage(player, message);
          break;
        case 'end':
          handleEndMessage(player);
          break;
        case 'error':
          handleErrorMessage(player, message);
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  }
  
  /**
   * Handle WebSocket close event
   * @param {Object} player - The player object
   * @param {CloseEvent} event - The close event
   */
  function handleWebSocketClose(player, event) {
    if (event.wasClean) {
      updatePlayerStatus(player, 'disconnected', 'Disconnected');
    } else {
      updatePlayerStatus(player, 'error', `Connection closed unexpectedly (code: ${event.code})`);
      
      // Try to reconnect after a delay if session is still active
      if (state.sessionId) {
        setTimeout(() => {
          if (state.players.find(p => p.id === player.id)) {
            connectPlayerWebSocket(player);
          }
        }, 5000);
      }
    }
  }
  
  /**
   * Handle WebSocket error event
   * @param {Object} player - The player object
   * @param {Event} error - The error event
   */
  function handleWebSocketError(player, error) {
    console.error(`WebSocket error for player ${player.id}:`, error);
    updatePlayerStatus(player, 'error', 'Connection error');
  }
  
  /**
   * Handle status message from WebSocket
   * @param {Object} player - The player object
   * @param {Object} message - The status message
   */
  function handleStatusMessage(player, message) {
    if (message.success) {
      updatePlayerStatus(player, 'connected', 'Connected');
      addSystemMessage(player, 'Connected to Wordly session. Waiting for translations...');
    } else {
      updatePlayerStatus(player, 'error', message.message || 'Connection failed');
      addSystemMessage(player, `Connection error: ${message.message || 'Unknown error'}`, true);
    }
  }
  
  /**
   * Handle phrase message from WebSocket
   * @param {Object} player - The player object
   * @param {Object} message - The phrase message
   */
  function handlePhraseMessage(player, message) {
    const phraseId = message.phraseId;
    const transcriptContainer = player.element.querySelector('.player-transcript');
    
    let phraseElement = player.element.querySelector(`#phrase-${phraseId}`);
    
    if (!phraseElement) {
      phraseElement = document.createElement('div');
      phraseElement.id = `phrase-${phraseId}`;
      phraseElement.className = 'phrase';
      
      const headerElement = document.createElement('div');
      headerElement.className = 'phrase-header';
      
      const speakerName = message.name || `Speaker ${message.speakerId.slice(-4)}`;
      headerElement.innerHTML = `
        <span class="speaker-name">${speakerName}</span>
        <span class="phrase-time">${new Date().toLocaleTimeString()}</span>
      `;
      
      const textElement = document.createElement('div');
      textElement.className = 'phrase-text';
      
      phraseElement.appendChild(headerElement);
      phraseElement.appendChild(textElement);
      
      transcriptContainer.insertBefore(phraseElement, transcriptContainer.firstChild);
      
      // Limit the number of phrases to avoid performance issues
      limitTranscriptSize(transcriptContainer);
    }
    
    const textElement = phraseElement.querySelector('.phrase-text');
    textElement.textContent = message.translatedText;
    
    player.phrases[phraseId] = message;
  }
  
  /**
   * Limit the transcript size to avoid performance issues
   * @param {HTMLElement} transcriptContainer - The transcript container
   * @param {number} maxPhrases - Maximum number of phrases to keep
   */
  function limitTranscriptSize(transcriptContainer, maxPhrases = 50) {
    const allPhrases = transcriptContainer.querySelectorAll('.phrase');
    
    if (allPhrases.length > maxPhrases) {
      // Remove excess phrases from bottom
      for (let i = maxPhrases; i < allPhrases.length; i++) {
        if (allPhrases[i]) {
          allPhrases[i].remove();
        }
      }
    }
  }
  
  /**
   * Handle speech message from WebSocket
   * @param {Object} player - The player object
   * @param {Object} message - The speech message
   */
  function handleSpeechMessage(player, message) {
    if (!player.audioEnabled) return;
    
    const audioLanguage = message.translatedLanguageCode || player.language;
    const audioStatusEl = player.element.querySelector('.audio-status');
    
    audioStatusEl.textContent = `Received audio translation (${getLanguageName(audioLanguage)})...`;
    
    // Process audio data if available
    if (message.synthesizedSpeech && message.synthesizedSpeech.data && message.synthesizedSpeech.data.length > 0) {
      try {
        // Convert the byte array to a playable audio source
        const blob = new Blob([new Uint8Array(message.synthesizedSpeech.data)], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(blob);
        
        // Create the audio element
        const audioElement = new Audio();
        audioElement.src = audioUrl;
        
        // If there's a selected device and browser supports it, try to use it
        if (player.deviceId && state.supportsSinkId) {
          audioElement.setSinkId(player.deviceId)
            .then(() => {
              playAudio(player, audioElement, audioUrl);
            })
            .catch(error => {
              console.error('Error setting audio output device:', error);
              // Try playing anyway on default device
              playAudio(player, audioElement, audioUrl);
            });
        } else {
          // Play on default device
          playAudio(player, audioElement, audioUrl);
        }
      } catch (error) {
        console.error('Error processing audio:', error);
        audioStatusEl.textContent = 'Error processing audio';
      }
    } else {
      audioStatusEl.textContent = 'Audio data empty or invalid';
    }
  }
  
  /**
   * Play audio for a player
   * @param {Object} player - The player object
   * @param {HTMLAudioElement} audioElement - The audio element
   * @param {string} audioUrl - The audio URL (blob)
   */
  function playAudio(player, audioElement, audioUrl) {
    const audioStatusEl = player.element.querySelector('.audio-status');
    
    // Set up audio element events
    audioElement.onplay = () => {
      audioStatusEl.textContent = 'Playing audio...';
    };
    
    audioElement.onended = () => {
      audioStatusEl.textContent = 'Audio playback completed';
      URL.revokeObjectURL(audioUrl);
    };
    
    audioElement.onerror = (error) => {
      console.error('Audio playback error:', error);
      audioStatusEl.textContent = 'Audio playback error';
      URL.revokeObjectURL(audioUrl);
    };
    
    // Play the audio
    audioElement.play().catch(error => {
      console.error('Error playing audio:', error);
      audioStatusEl.textContent = 'Error playing audio: ' + error.message;
      URL.revokeObjectURL(audioUrl);
    });
  }
  
  /**
   * Handle users message from WebSocket
   * @param {Object} player - The player object
   * @param {Object} message - The users message
   */
  function handleUsersMessage(player, message) {
    // Extract presenters
    const presenters = {};
    
    if (message.presenters && message.presenters.length > 0) {
      message.presenters.forEach(presenter => {
        presenters[presenter.speakerId] = presenter.name || `Speaker ${presenter.speakerId.slice(-4)}`;
      });
      
      // Add a system message with presenters
      const presenterNames = Object.values(presenters);
      addSystemMessage(player, `Presenters: ${presenterNames.join(', ')}`);
    }
    
    // Update status with attendee count
    const attendeeCount = (message.others || 0) + (message.attendees?.length || 0);
    const statusEl = player.element.querySelector('.player-status');
    statusEl.textContent = `Connected (${attendeeCount} attendees)`;
  }
  
  /**
   * Handle end message from WebSocket
   * @param {Object} player - The player object
   */
  function handleEndMessage(player) {
    updatePlayerStatus(player, 'ended', 'Session ended');
    addSystemMessage(player, 'The presentation has ended.');
    
    if (player.websocket && player.websocket.readyState === WebSocket.OPEN) {
      try {
        player.websocket.close();
      } catch (e) {
        console.error("Error closing websocket:", e);
      }
    }
  }
  
  /**
   * Handle error message from WebSocket
   * @param {Object} player - The player object
   * @param {Object} message - The error message
   */
  function handleErrorMessage(player, message) {
    updatePlayerStatus(player, 'error', message.message || 'Unknown error');
    addSystemMessage(player, `Error: ${message.message || 'Unknown error'}`, true);
  }
  
  /**
   * Send a voice request to enable/disable audio
   * @param {Object} player - The player object
   * @param {boolean} enabled - Whether to enable voice
   */
  function sendVoiceRequest(player, enabled) {
    if (player.websocket && player.websocket.readyState === WebSocket.OPEN) {
      try {
        const voiceRequest = {
          type: 'voice',
          enabled: enabled
        };
        player.websocket.send(JSON.stringify(voiceRequest));
        console.log(`Voice request sent with enabled=${enabled} for player ${player.id}`);
      } catch (e) {
        console.error(`Error sending voice request (enabled=${enabled}):`, e);
      }
    }
  }
  
  /**
   * Update the player's status
   * @param {Object} player - The player object
   * @param {string} status - The status ('connecting', 'connected', 'disconnected', 'error', 'ended')
   * @param {string} message - Optional status message
   */
  function updatePlayerStatus(player, status, message) {
    player.status = status;
    
    // Update status light
    const statusLight = player.element.querySelector('.player-status-light');
    statusLight.className = `player-status-light ${status}`;
    
    // Update status message
    const statusEl = player.element.querySelector('.player-status');
    statusEl.className = `player-status ${status}`;
    statusEl.textContent = message || status.charAt(0).toUpperCase() + status.slice(1);
  }
  
  /**
   * Add a system message to the player's transcript
   * @param {Object} player - The player object
   * @param {string} message - The message to add
   * @param {boolean} isError - Whether this is an error message
   */
  function addSystemMessage(player, message, isError = false) {
    const transcriptContainer = player.element.querySelector('.player-transcript');
    
    const messageEl = document.createElement('div');
    messageEl.className = isError ? 'phrase system-message error' : 'phrase system-message';
    messageEl.textContent = message;
    transcriptContainer.insertBefore(messageEl, transcriptContainer.firstChild);
  }
  
  /**
   * Populate language select dropdown
   * @param {HTMLSelectElement} selectElement - The select element
   * @param {string} selectedLanguage - The currently selected language
   */
  function populateLanguageSelect(selectElement, selectedLanguage) {
    // Clear existing options
    selectElement.innerHTML = '';
    
    // Add options for each language
    Object.entries(languageMap).forEach(([code, name]) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = name;
      selectElement.appendChild(option);
    });
    
    // Set current language
    selectElement.value = selectedLanguage;
  }
  
  /**
   * Populate device select dropdown
   * @param {HTMLSelectElement} selectElement - The select element
   * @param {string} selectedDeviceId - The currently selected device ID
   */
  function populateDeviceSelect(selectElement, selectedDeviceId) {
    // Clear existing options
    selectElement.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'System Default';
    selectElement.appendChild(defaultOption);
    
    // Add options for each device
    state.devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Audio Output ${device.deviceId.slice(0, 5)}`;
      selectElement.appendChild(option);
    });
    
    // Set selected device
    selectElement.value = selectedDeviceId;
  }
  
  /**
   * Add event listeners to a player element
   * @param {HTMLElement} playerEl - The player element
   */
  function addPlayerEventListeners(playerEl) {
    const playerId = playerEl.id;
    const player = getPlayerById(playerId);
    
    if (!player) return;
    
    // Language select change
    const languageSelect = playerEl.querySelector('.language-select');
    languageSelect.addEventListener('change', (e) => {
      const newLanguage = e.target.value;
      
      if (newLanguage !== player.language) {
        const oldLanguageName = getLanguageName(player.language);
        player.language = newLanguage;
        const newLanguageName = getLanguageName(newLanguage);
        
        // Update language indicator
        const languageIndicator = playerEl.querySelector('.player-language-indicator');
        languageIndicator.textContent = newLanguageName;
        
        // If websocket is connected, send language change
        if (player.websocket && player.websocket.readyState === WebSocket.OPEN) {
          // First disable voice if enabled
          if (player.audioEnabled) {
            sendVoiceRequest(player, false);
          }
          
          // Then send language change
          try {
            const changeRequest = {
              type: 'change',
              languageCode: newLanguage
            };
            
            player.websocket.send(JSON.stringify(changeRequest));
            
            // Then re-enable voice if it was enabled
            if (player.audioEnabled) {
              setTimeout(() => {
                sendVoiceRequest(player, true);
              }, 1000);
            }
            
            addSystemMessage(player, `Language changed from ${oldLanguageName} to ${newLanguageName}`);
          } catch (e) {
            console.error("Error sending language change:", e);
            addSystemMessage(player, `Error changing language: ${e.message}`, true);
          }
        }
      }
    });
    
    // Device select change
    const deviceSelect = playerEl.querySelector('.device-select');
    deviceSelect.addEventListener('change', (e) => {
      player.deviceId = e.target.value;
      
      // Update device name in the title
      const deviceNameEl = playerEl.querySelector('.device-name');
      const selectedOption = deviceSelect.options[deviceSelect.selectedIndex];
      deviceNameEl.textContent = selectedOption.textContent;
      
      addSystemMessage(player, `Output device set to: ${selectedOption.textContent}`);
    });
    
    // Audio toggle
    const audioToggle = playerEl.querySelector('.audio-toggle');
    audioToggle.addEventListener('change', (e) => {
      player.audioEnabled = e.target.checked;
      
      // Send voice request if websocket is connected
      if (player.websocket && player.websocket.readyState === WebSocket.OPEN) {
        sendVoiceRequest(player, player.audioEnabled);
        
        // Add a system message
        if (player.audioEnabled) {
          addSystemMessage(player, 'Audio translations enabled');
        } else {
          addSystemMessage(player, 'Audio translations disabled');
        }
      }
    });
    
    // Button actions
    playerEl.querySelectorAll('.player-btn').forEach(button => {
      button.addEventListener('click', () => {
        const action = button.getAttribute('data-action');
        
        if (action === 'toggle') {
          togglePlayerCollapse(player);
        } else if (action === 'remove') {
          removePlayer(player);
        }
      });
    });
  }
  
  /**
   * Toggle the collapse state of a player
   * @param {Object} player - The player object
   */
  function togglePlayerCollapse(player) {
    player.collapsed = !player.collapsed;
    
    const contentEl = player.element.querySelector('.player-content');
    const collapseBtn = player.element.querySelector('.collapse-btn');
    
    if (player.collapsed) {
      contentEl.classList.add('collapsed');
      collapseBtn.textContent = 'Expand';
    } else {
      contentEl.classList.remove('collapsed');
      collapseBtn.textContent = 'Collapse';
    }
  }
  
  /**
   * Toggle collapse state for all players
   */
  function toggleAllPlayers() {
    state.allCollapsed = !state.allCollapsed;
    
    state.players.forEach(player => {
      player.collapsed = state.allCollapsed;
      
      const contentEl = player.element.querySelector('.player-content');
      const collapseBtn = player.element.querySelector('.collapse-btn');
      
      if (player.collapsed) {
        contentEl.classList.add('collapsed');
        collapseBtn.textContent = 'Expand';
      } else {
        contentEl.classList.remove('collapsed');
        collapseBtn.textContent = 'Collapse';
      }
    });
    
    // Update global collapse button
    globalCollapseBtn.textContent = state.allCollapsed ? 'Expand All' : 'Collapse All';
  }
  
  /**
   * Remove a player
   * @param {Object} player - The player object
   */
  function removePlayer(player) {
    // Close websocket if open
    if (player.websocket && player.websocket.readyState === WebSocket.OPEN) {
      try {
        player.websocket.close();
      } catch (e) {
        console.error("Error closing websocket:", e);
      }
    }
    
    // Remove from DOM
    player.element.remove();
    
    // Remove from state
    const index = state.players.findIndex(p => p.id === player.id);
    if (index !== -1) {
      state.players.splice(index, 1);
    }
    
    showNotification('Player removed', 'success');
  }
  
  /**
   * Get player by ID
   * @param {string} playerId - The player ID
   * @returns {Object|null} The player object or null if not found
   */
  function getPlayerById(playerId) {
    return state.players.find(player => player.id === playerId) || null;
  }
  
  /**
   * Get language name from language code
   * @param {string} code - The language code
   * @returns {string} The language name
   */
  function getLanguageName(code) {
    return languageMap[code] || code;
  }
  
  /**
   * Load presets from local storage
   */
  function loadPresetsFromStorage() {
    try {
      const savedPresets = localStorage.getItem('wordlyPresets');
      if (savedPresets) {
        state.presets = JSON.parse(savedPresets);
        updatePresetDropdown();
      }
    } catch (error) {
      console.error('Error loading presets:', error);
    }
  }
  
  /**
   * Update preset dropdown with saved presets
   */
  function updatePresetDropdown() {
    // Clear existing options (except the first one)
    while (presetSelect.options.length > 1) {
      presetSelect.remove(1);
    }
    
    // Add presets as options
    Object.keys(state.presets).forEach(presetName => {
      const option = document.createElement('option');
      option.value = presetName;
      option.textContent = presetName;
      presetSelect.appendChild(option);
    });
  }
  
  /**
   * Save current configuration as a preset
   */
  function savePreset() {
    const presetName = presetNameInput.value.trim();
    
    if (!presetName) {
      showNotification('Please enter a name for the preset', 'error');
      return;
    }
    
    // Create preset config
    const presetConfig = {
      sessionId: state.sessionId,
      passcode: state.passcode,
      players: state.players.map(player => ({
        language: player.language,
        deviceId: player.deviceId,
        audioEnabled: player.audioEnabled,
        collapsed: player.collapsed
      }))
    };
    
    // Save to state
    state.presets[presetName] = presetConfig;
    
    // Save to localStorage
    try {
      localStorage.setItem('wordlyPresets', JSON.stringify(state.presets));
      updatePresetDropdown();
      showNotification(`Preset "${presetName}" saved`, 'success');
      presetNameInput.value = '';
    } catch (error) {
      console.error('Error saving preset:', error);
      showNotification('Error saving preset', 'error');
    }
  }
  
  /**
   * Load the currently selected preset
   */
  function loadSelectedPreset() {
    const presetName = presetSelect.value;
    
    if (!presetName) {
      showNotification('Please select a preset to load', 'error');
      return;
    }
    
    const preset = state.presets[presetName];
    if (!preset) {
      showNotification(`Preset "${presetName}" not found`, 'error');
      return;
    }
    
    // If session ID is different, we need to reconnect
    if (preset.sessionId !== state.sessionId) {
      state.sessionId = preset.sessionId;
      state.passcode = preset.passcode;
      
      // Update session display
      sessionIdDisplay.textContent = `Session: ${preset.sessionId}`;
      
      // Clear existing players
      playerGrid.innerHTML = '';
      state.players = [];
      
      // Create new players from preset
      preset.players.forEach(playerConfig => {
        addNewPlayer(playerConfig);
      });
      
      showNotification(`Loaded preset "${presetName}" with new session`, 'success');
    } else {
      // Same session, just update existing players or add new ones
      
      // Remove extra players
      while (state.players.length > preset.players.length) {
        removePlayer(state.players[state.players.length - 1]);
      }
      
      // Update existing players
      for (let i = 0; i < Math.min(state.players.length, preset.players.length); i++) {
        const player = state.players[i];
        const config = preset.players[i];
        
        // Update language if different
        if (player.language !== config.language) {
          const languageSelect = player.element.querySelector('.language-select');
          languageSelect.value = config.language;
          languageSelect.dispatchEvent(new Event('change'));
        }
        
        // Update device if different
        if (player.deviceId !== config.deviceId) {
          const deviceSelect = player.element.querySelector('.device-select');
          deviceSelect.value = config.deviceId;
          deviceSelect.dispatchEvent(new Event('change'));
        }
        
        // Update audio if different
        if (player.audioEnabled !== config.audioEnabled) {
          const audioToggle = player.element.querySelector('.audio-toggle');
          audioToggle.checked = config.audioEnabled;
          audioToggle.dispatchEvent(new Event('change'));
        }
        
        // Update collapsed state if different
        if (player.collapsed !== config.collapsed) {
          togglePlayerCollapse(player);
        }
      }
      
      // Add new players if needed
      for (let i = state.players.length; i < preset.players.length; i++) {
        addNewPlayer(preset.players[i]);
      }
      
      showNotification(`Loaded preset "${presetName}"`, 'success');
    }
  }
  
  /**
   * Delete the currently selected preset
   */
  function deleteSelectedPreset() {
    const presetName = presetSelect.value;
    
    if (!presetName) {
      showNotification('Please select a preset to delete', 'error');
      return;
    }
    
    // Remove from state
    delete state.presets[presetName];
    
    // Save to localStorage
    try {
      localStorage.setItem('wordlyPresets', JSON.stringify(state.presets));
      updatePresetDropdown();
      showNotification(`Preset "${presetName}" deleted`, 'success');
    } catch (error) {
      console.error('Error deleting preset:', error);
      showNotification('Error deleting preset', 'error');
    }
  }
  
  /**
   * Show a notification message
   * @param {string} message - The message to show
   * @param {string} type - The notification type ('success' or 'error')
   */
  function showNotification(message, type = 'success') {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => {
      notification.remove();
    });
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Remove after animation
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
});
