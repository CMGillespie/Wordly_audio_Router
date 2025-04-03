// Wordly Audio Router - CodePen-friendly version
document.addEventListener('DOMContentLoaded', () => {
  // DOM elements for login page
  const loginPage = document.getElementById('login-page');
  const appPage = document.getElementById('app-page');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const credentialsForm = document.getElementById('credentials-form');
  const linkForm = document.getElementById('link-form');
  const loginStatus = document.getElementById('login-status');
  
  // DOM elements for app page
  const sessionIdDisplay = document.getElementById('session-id-display');
  const disconnectBtn = document.getElementById('disconnect-btn');
  const addDeviceBtn = document.getElementById('add-device-btn');
  const playerGrid = document.getElementById('player-grid');
  const browserWarning = document.getElementById('browser-warning');
  const noDeviceSupport = document.getElementById('no-device-support');
  const globalCollapseBtn = document.getElementById('global-collapse-btn');
  
  // Preset elements
  const presetNameInput = document.getElementById('preset-name');
  const savePresetBtn = document.getElementById('save-preset-btn');
  const presetSelect = document.getElementById('preset-select');
  const loadPresetBtn = document.getElementById('load-preset-btn');
  const deletePresetBtn = document.getElementById('delete-preset-btn');
  
  // Language map
  const languageMap = {
    'af': 'Afrikaans', 'sq': 'Albanian', 'ar': 'Arabic', 'hy': 'Armenian', 
    'bn': 'Bengali', 'bg': 'Bulgarian', 'zh-HK': 'Cantonese', 'ca': 'Catalan', 
    'zh-CN': 'Chinese (Simplified)', 'zh-TW': 'Chinese (Traditional)', 
    'hr': 'Croatian', 'cs': 'Czech', 'da': 'Danish', 'nl': 'Dutch', 
    'en': 'English (US)', 'en-AU': 'English (AU)', 'en-GB': 'English (UK)', 
    'et': 'Estonian', 'fi': 'Finnish', 'fr': 'French (FR)', 'fr-CA': 'French (CA)', 
    'ka': 'Georgian', 'de': 'German', 'el': 'Greek', 'gu': 'Gujarati', 
    'he': 'Hebrew', 'hi': 'Hindi', 'hu': 'Hungarian', 'is': 'Icelandic', 
    'id': 'Indonesian', 'ga': 'Irish', 'it': 'Italian', 'ja': 'Japanese', 
    'kn': 'Kannada', 'ko': 'Korean', 'lv': 'Latvian', 'lt': 'Lithuanian', 
    'mk': 'Macedonian', 'ms': 'Malay', 'mt': 'Maltese', 'no': 'Norwegian', 
    'fa': 'Persian', 'pl': 'Polish', 'pt': 'Portuguese (PT)', 'pt-BR': 'Portuguese (BR)', 
    'ro': 'Romanian', 'ru': 'Russian', 'sr': 'Serbian', 'sk': 'Slovak', 
    'sl': 'Slovenian', 'es': 'Spanish (ES)', 'es-MX': 'Spanish (MX)', 
    'sv': 'Swedish', 'tl': 'Tagalog', 'th': 'Thai', 'tr': 'Turkish', 
    'uk': 'Ukrainian', 'vi': 'Vietnamese', 'cy': 'Welsh', 'pa': 'Punjabi', 
    'sw': 'Swahili', 'ta': 'Tamil', 'ur': 'Urdu', 'zh': 'Chinese'
  };
  
  // State variables
  const state = {
    sessionId: '',
    passcode: '',
    nextPlayerId: 1,
    audioDevices: [],
    audioSupported: false,
    websockets: {}, // playerId -> websocket
    players: {}, // playerId -> player info
    phrases: {}, // playerId -> phrases
    audioQueues: {}, // playerId -> audio queue
    connectionStates: {}, // playerId -> connection state
    presets: {}, // presetName -> preset config
    activityTimers: {}, // playerId -> activity timers
    currentPreset: null
  };
  
  // ==========================================
  // Utility Functions
  // ==========================================
  
  // Check if session ID is valid
  function isValidSessionId(sessionId) {
    const regex = /^[A-Za-z0-9]{4}-\d{4}$/;
    return regex.test(sessionId);
  }
  
  // Format session ID if needed
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
  
  // Parse weblink without using URL constructor (CodePen safe)
  function parseWeblink(weblink) {
    try {
      let sessionId = null;
      let passcode = '';
      
      // Extract session ID from path using simple string manipulation
      const segments = weblink.split('/');
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        
        // Check for XXXX-0000 format
        if (/^[A-Za-z0-9]{4}-\d{4}$/.test(segment)) {
          sessionId = segment;
          break;
        }
        
        // Check for XXXX0000 format
        if (/^[A-Za-z0-9]{8}$/.test(segment)) {
          const formatted = `${segment.substring(0, 4)}-${segment.substring(4)}`;
          if (isValidSessionId(formatted)) {
            sessionId = formatted;
            break;
          }
        }
      }
      
      // Extract passcode (key parameter)
      if (weblink.includes('?')) {
        const queryPart = weblink.split('?')[1];
        const params = queryPart.split('&');
        
        for (const param of params) {
          if (param.startsWith('key=')) {
            passcode = param.split('=')[1] || '';
            break;
          }
        }
      }
      
      return { sessionId, passcode };
    } catch (error) {
      console.error('Error parsing weblink:', error);
      return { sessionId: null, passcode: '' };
    }
  }
  
  // Show login error message
  function showLoginError(message) {
    loginStatus.textContent = message;
    loginStatus.className = 'status-message error';
    
    setTimeout(() => {
      loginStatus.textContent = '';
      loginStatus.className = 'status-message';
    }, 5000);
  }
  
  // Show login success message
  function showLoginSuccess(message) {
    loginStatus.textContent = message;
    loginStatus.className = 'status-message success';
  }
  
  // Show notification
  function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Add to the document
    document.body.appendChild(notification);
    
    // Remove after a delay
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
  
  // ==========================================
  // Audio System Initialization
  // ==========================================
  
  // Initialize audio system
  async function initializeAudio() {
    try {
      // Check Web Audio API support
      if (window.AudioContext || window.webkitAudioContext) {
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          
          // Create a test tone when user interacts with the page
          window.addEventListener('click', function audioTestSetup() {
            // Remove this handler after first click
            window.removeEventListener('click', audioTestSetup);
            
            // Resume context if suspended
            if (audioContext.state === 'suspended') {
              audioContext.resume();
            }
          }, { once: true });
        } catch (e) {
          console.warn('Could not initialize Web Audio API:', e);
        }
      }
      
      // Check for setSinkId support
      state.audioSupported = typeof HTMLAudioElement !== 'undefined' && 
                             typeof HTMLAudioElement.prototype.setSinkId === 'function';
      
      // Show warning if not supported
      if (!state.audioSupported) {
        noDeviceSupport.style.display = 'block';
      }
      
      // Get audio devices permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Release the stream
        
        // Enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        state.audioDevices = devices.filter(device => device.kind === 'audiooutput');
        console.log(`Found ${state.audioDevices.length} audio output devices`);
      } catch (err) {
        console.warn('Could not access audio devices:', err);
        // Still continue without device access
      }
      
      // Show browser warning if not Chrome/Edge
      const isChromeBased = /Chrome/.test(navigator.userAgent) || /Edg/.test(navigator.userAgent);
      if (!isChromeBased) {
        browserWarning.style.display = 'block';
      }
      
      return true;
    } catch (error) {
      console.error('Error initializing audio system:', error);
      return false;
    }
  }
  
  // ==========================================
  // Player Management
  // ==========================================
  
  // Add a new player
  function addPlayer(config = {}) {
    const playerId = `player-${state.nextPlayerId++}`;
    
    // Create player element in the DOM
    const playerEl = createPlayerElement(playerId);
    playerGrid.appendChild(playerEl);
    
    // Default config
    const defaultConfig = {
      language: 'en',
      deviceId: '',
      audioEnabled: false
    };
    
    // Merge with provided config
    const playerConfig = {...defaultConfig, ...config};
    
    // Create player in state
    state.players[playerId] = {
      id: playerId,
      language: playerConfig.language,
      deviceId: playerConfig.deviceId,
      audioEnabled: playerConfig.audioEnabled,
      status: 'disconnected',
      lastMessage: null,
      connectionAttempts: 0
    };
    
    // Initialize empty audio queue and phrases
    state.audioQueues[playerId] = [];
    state.phrases[playerId] = {};
    state.connectionStates[playerId] = {
      isPlaying: false,
      reconnectTimeout: null,
      lastActivity: null
    };
    
    // Set up event handlers
    setupPlayerEventHandlers(playerId);
    
    // Populate selects
    populateDeviceSelect(playerId, playerConfig.deviceId);
    populateLanguageSelect(playerId, playerConfig.language);
    
    // Set audio toggle state
    const audioToggle = playerEl.querySelector('.audio-toggle');
    if (audioToggle) {
      audioToggle.checked = playerConfig.audioEnabled;
      
      // Update audio status text
      const audioStatus = document.getElementById(`${playerId}-audio-status`);
      if (audioStatus) {
        audioStatus.textContent = playerConfig.audioEnabled ? 'Audio enabled' : 'Audio disabled';
      }
    }
    
    // Connect to Wordly
    connectPlayer(playerId);
    
    // Set up activity timer
    startActivityTimer(playerId);
    
    return playerId;
  }
  
  // Create player DOM element
  function createPlayerElement(playerId) {
    const playerEl = document.createElement('div');
    playerEl.className = 'player';
    playerEl.id = playerId;
    
    playerEl.innerHTML = `
      <div class="player-header">
        <div class="player-title">
          <span class="player-status-light connecting" id="${playerId}-status-light" title="Connecting..."></span>
          <span class="player-name">Device</span>
          <span class="player-language-indicator">English (US)</span>
        </div>
        <div class="player-controls">
          <button class="player-btn collapse-btn" data-action="collapse">Collapse</button>
          <button class="player-btn remove-btn" data-action="remove">Remove</button>
        </div>
      </div>
      <div class="player-settings">
        <div class="setting-group">
          <span class="setting-label">Language:</span>
          <select class="setting-select language-select" data-player="${playerId}">
            <!-- Languages will be added dynamically -->
          </select>
        </div>
        <div class="setting-group">
          <span class="setting-label">Device:</span>
          <select class="setting-select device-select" data-player="${playerId}">
            <!-- Devices will be added dynamically -->
          </select>
        </div>
        <label class="toggle">
          <input type="checkbox" class="audio-toggle" data-player="${playerId}">
          <span class="slider"></span>
          <span class="setting-label">Enable Audio</span>
        </label>
      </div>
      <div class="player-content">
        <div class="player-transcript" id="${playerId}-transcript">
          <div class="phrase system-message">
            Connected to Wordly session. Waiting for translations...
          </div>
        </div>
        <div class="player-status connecting" id="${playerId}-status">Connecting...</div>
        <div class="audio-status" id="${playerId}-audio-status">Audio disabled</div>
      </div>
    `;
    
    return playerEl;
  }
  
  // Set up event handlers for a player
  function setupPlayerEventHandlers(playerId) {
    const playerEl = document.getElementById(playerId);
    if (!playerEl) return;
    
    // Language select change event
    const languageSelect = playerEl.querySelector('.language-select');
    languageSelect.addEventListener('change', (e) => {
      const newLanguage = e.target.value;
      changeLanguage(playerId, newLanguage);
      
      // Update language indicator
      const languageIndicator = playerEl.querySelector('.player-language-indicator');
      languageIndicator.textContent = languageMap[newLanguage] || newLanguage;
    });
    
    // Device select change event
    const deviceSelect = playerEl.querySelector('.device-select');
    deviceSelect.addEventListener('change', (e) => {
      const newDeviceId = e.target.value;
      changeOutputDevice(playerId, newDeviceId);
      
      // Update player name
      const playerName = playerEl.querySelector('.player-name');
      const deviceName = deviceSelect.options[deviceSelect.selectedIndex].text;
      playerName.textContent = deviceName;
    });
    
    // Audio toggle event
    const audioToggle = playerEl.querySelector('.audio-toggle');
    audioToggle.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      toggleAudio(playerId, enabled);
      
      // Update audio status
      const audioStatus = document.getElementById(`${playerId}-audio-status`);
      if (audioStatus) {
        audioStatus.textContent = enabled ? 'Audio enabled' : 'Audio disabled';
      }
    });
    
    // Remove button event
    const removeBtn = playerEl.querySelector('.remove-btn');
    removeBtn.addEventListener('click', () => {
      removePlayer(playerId);
    });
    
    // Collapse button event
    const collapseBtn = playerEl.querySelector('[data-action="collapse"]');
    const playerContent = playerEl.querySelector('.player-content');
    if (collapseBtn && playerContent) {
      collapseBtn.addEventListener('click', () => {
        playerContent.classList.toggle('collapsed');
        collapseBtn.textContent = playerContent.classList.contains('collapsed') ? 'Expand' : 'Collapse';
      });
    }
  }
  
  // Populate device select dropdown
  function populateDeviceSelect(playerId, selectedDeviceId = '') {
    const playerEl = document.getElementById(playerId);
    if (!playerEl) return;
    
    const deviceSelect = playerEl.querySelector('.device-select');
    if (!deviceSelect) return;
    
    // Clear existing options
    deviceSelect.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'System Default';
    deviceSelect.appendChild(defaultOption);
    
    // Add each device as an option
    state.audioDevices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Device ${device.deviceId.slice(0, 4)}...`;
      deviceSelect.appendChild(option);
    });
    
    // Set selected device if provided
    if (selectedDeviceId) {
      deviceSelect.value = selectedDeviceId;
    }
    
    // Update player name with selected device
    const playerName = playerEl.querySelector('.player-name');
    const deviceName = deviceSelect.options[deviceSelect.selectedIndex].text;
    playerName.textContent = deviceName;
  }
  
  // Populate language select dropdown
  function populateLanguageSelect(playerId, selectedLanguage = 'en') {
    const playerEl = document.getElementById(playerId);
    if (!playerEl) return;
    
    const languageSelect = playerEl.querySelector('.language-select');
    if (!languageSelect) return;
    
    // Clear existing options
    languageSelect.innerHTML = '';
    
    // Add each language as an option
    Object.entries(languageMap).forEach(([code, name]) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = name;
      languageSelect.appendChild(option);
    });
    
    // Set selected language if provided
    languageSelect.value = selectedLanguage;
    
    // Update language indicator
    const languageIndicator = playerEl.querySelector('.player-language-indicator');
    languageIndicator.textContent = languageMap[selectedLanguage] || selectedLanguage;
  }
  
  // Remove a player
  function removePlayer(playerId) {
    // Close websocket if open
    disconnectPlayer(playerId);
    
    // Remove element from DOM
    const playerEl = document.getElementById(playerId);
    if (playerEl) {
      playerEl.remove();
    }
    
    // Clear activity timer
    if (state.activityTimers[playerId]) {
      clearInterval(state.activityTimers[playerId]);
      delete state.activityTimers[playerId];
    }
    
    // Clean up from state
    delete state.players[playerId];
    delete state.websockets[playerId];
    delete state.audioQueues[playerId];
    delete state.phrases[playerId];
    delete state.connectionStates[playerId];
  }
  
  // Start activity timer for a player
  function startActivityTimer(playerId) {
    // Clear any existing timer
    if (state.activityTimers[playerId]) {
      clearInterval(state.activityTimers[playerId]);
    }
    
    // Set up timer to update status light
    state.activityTimers[playerId] = setInterval(() => {
      const player = state.players[playerId];
      const connState = state.connectionStates[playerId];
      if (!player || !connState) return;
      
      // Update status light based on recent activity
      const statusLight = document.getElementById(`${playerId}-status-light`);
      if (statusLight && connState.lastActivity) {
        // If we received a message in the last 3 seconds, briefly show green
        const timeSinceLastActivity = Date.now() - connState.lastActivity;
        if (timeSinceLastActivity < 3000 && player.status !== 'connected') {
          // Flash green to indicate activity
          statusLight.classList.add('connected');
          setTimeout(() => {
            if (player.status !== 'connected') {
              statusLight.classList.remove('connected');
              statusLight.className = `player-status-light ${player.status}`;
            }
          }, 500);
        }
      }
    }, 1000);
  }
  
  // ==========================================
  // WebSocket Connection & Messaging
  // ==========================================
  
  // Connect a player to Wordly
  function connectPlayer(playerId) {
    const player = state.players[playerId];
    if (!player) return;
    
    // Update status
    updatePlayerStatus(playerId, 'connecting');
    
    // Track connection attempt
    player.connectionAttempts++;
    
    // Create WebSocket
    try {
      // Close existing socket if any
      disconnectPlayer(playerId, false);
      
      // Create new socket
      const socket = new WebSocket('wss://endpoint.wordly.ai/attend');
      state.websockets[playerId] = socket;
      
      // Set up event handlers
      socket.onopen = () => handleSocketOpen(playerId);
      socket.onmessage = (event) => handleSocketMessage(playerId, event);
      socket.onclose = (event) => handleSocketClose(playerId, event);
      socket.onerror = (error) => handleSocketError(playerId, error);
      
      // Set up connection timeout
      const connectionTimeout = setTimeout(() => {
        if (player.status === 'connecting') {
          updatePlayerStatus(playerId, 'error', 'Connection timeout');
          socket.close();
        }
      }, 10000);
      
      // Store timeout in connection state
      state.connectionStates[playerId].connectionTimeout = connectionTimeout;
      
    } catch (error) {
      console.error(`Error creating WebSocket for player ${playerId}:`, error);
      updatePlayerStatus(playerId, 'error', `WebSocket error: ${error.message}`);
      
      // Schedule reconnect
      scheduleReconnect(playerId);
    }
  }
  
  // Disconnect a player
  function disconnectPlayer(playerId, updateStatus = true) {
    const socket = state.websockets[playerId];
    const connState = state.connectionStates[playerId];
    
    // Clear any reconnect timeout
    if (connState && connState.reconnectTimeout) {
      clearTimeout(connState.reconnectTimeout);
      connState.reconnectTimeout = null;
    }
    
    // Clear connection timeout
    if (connState && connState.connectionTimeout) {
      clearTimeout(connState.connectionTimeout);
      connState.connectionTimeout = null;
    }
    
    // Close socket if it exists
    if (socket) {
      try {
        // Send disconnect request if possible
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({ type: 'disconnect' }));
          } catch (e) {
            console.warn(`Error sending disconnect for player ${playerId}:`, e);
          }
        }
        
        // Close the socket
        socket.close();
      } catch (e) {
        console.warn(`Error closing socket for player ${playerId}:`, e);
      }
      
      // Remove from state
      delete state.websockets[playerId];
    }
    
    // Update status if requested
    if (updateStatus) {
      updatePlayerStatus(playerId, 'disconnected', 'Disconnected');
    }
  }
  
  // Schedule reconnection for a player
  function scheduleReconnect(playerId, delay = 2000) {
    const player = state.players[playerId];
    const connState = state.connectionStates[playerId];
    if (!player || !connState) return;
    
    // Clear any existing timeout
    if (connState.reconnectTimeout) {
      clearTimeout(connState.reconnectTimeout);
    }
    
    // Calculate delay with exponential backoff
    const maxDelay = 30000; // Cap at 30 seconds
    const calculatedDelay = Math.min(delay * Math.pow(1.5, player.connectionAttempts - 1), maxDelay);
    
    // Set up reconnection timeout
    connState.reconnectTimeout = setTimeout(() => {
      if (player.status !== 'connected') {
        console.log(`Attempting to reconnect player ${playerId} (attempt ${player.connectionAttempts})...`);
        connectPlayer(playerId);
      }
    }, calculatedDelay);
    
    console.log(`Scheduled reconnect for player ${playerId} in ${calculatedDelay}ms`);
  }
  
  // Handle socket open event
  function handleSocketOpen(playerId) {
    const player = state.players[playerId];
    const socket = state.websockets[playerId];
    const connState = state.connectionStates[playerId];
    
    if (!player || !socket) return;
    
    console.log(`WebSocket opened for player ${playerId}`);
    connState.lastActivity = Date.now();
    
    // Send connect request
    try {
      const connectRequest = {
        type: 'connect',
        presentationCode: state.sessionId,
        languageCode: player.language
      };
      
      if (state.passcode) {
        connectRequest.accessKey = state.passcode;
      }
      
      socket.send(JSON.stringify(connectRequest));
    } catch (error) {
      console.error(`Error sending connect request for player ${playerId}:`, error);
      updatePlayerStatus(playerId, 'error', 'Failed to send connect request');
    }
  }
  
  // Handle socket message event
  function handleSocketMessage(playerId, event) {
    const player = state.players[playerId];
    const connState = state.connectionStates[playerId];
    
    if (!player || !connState) return;
    
    // Update activity timestamp
    connState.lastActivity = Date.now();
    player.lastMessage = new Date();
    
    try {
      const message = JSON.parse(event.data);
      console.log(`Received message type '${message.type}' for player ${playerId}`);
      
      switch (message.type) {
        case 'status':
          handleStatusMessage(playerId, message);
          break;
        case 'phrase':
          handlePhraseMessage(playerId, message);
          break;
        case 'speech':
          handleSpeechMessage(playerId, message);
          break;
        case 'users':
          handleUsersMessage(playerId, message);
          break;
        case 'end':
          handleEndMessage(playerId);
          break;
        case 'error':
          handleErrorMessage(playerId, message);
          break;
      }
    } catch (error) {
      console.error(`Error processing message for player ${playerId}:`, error);
      addSystemMessage(playerId, `Error processing message: ${error.message}`, true);
    }
  }
  
  // Handle socket close event
  function handleSocketClose(playerId, event) {
    const player = state.players[playerId];
    if (!player) return;
    
    // Only update status if we're not already in error state (which takes precedence)
    if (player.status !== 'error') {
      updatePlayerStatus(playerId, 'disconnected', 
        event.wasClean ? 'Disconnected' : 'Connection lost unexpectedly');
    }
    
    // If connection was not closed cleanly, schedule reconnect
    if (!event.wasClean) {
      scheduleReconnect(playerId);
    }
  }
  
  // Handle socket error event
  function handleSocketError(playerId, error) {
    console.error(`WebSocket error for player ${playerId}:`, error);
    updatePlayerStatus(playerId, 'error', 'WebSocket error');
  }
  
  // Handle status message from server
  function handleStatusMessage(playerId, message) {
    if (message.success) {
      // Connection successful
      updatePlayerStatus(playerId, 'connected', 'Connected');
      
      // Reset connection attempts counter
      const player = state.players[playerId];
      if (player) {
        player.connectionAttempts = 0;
      }
      
      // Send voice request if audio is enabled
      if (player && player.audioEnabled) {
        sendVoiceRequest(playerId, true);
      }
    } else {
      // Connection failed
      const errorMessage = message.message || 'Connection failed';
      updatePlayerStatus(playerId, 'error', errorMessage);
      addSystemMessage(playerId, `Connection error: ${errorMessage}`, true);
    }
  }
  
  // Handle phrase message from server
  function handlePhraseMessage(playerId, message) {
    const phrases = state.phrases[playerId];
    if (!phrases) return;
    
    // Store the phrase
    phrases[message.phraseId] = message;
    
    // Get transcript container
    const transcriptEl = document.getElementById(`${playerId}-transcript`);
    if (!transcriptEl) return;
    
    // Check if we already have this phrase in the transcript
    const existingPhrase = document.getElementById(`${playerId}-phrase-${message.phraseId}`);
    
    if (existingPhrase) {
      // Update existing phrase
      const textEl = existingPhrase.querySelector('.phrase-text');
      if (textEl) {
        textEl.textContent = message.translatedText;
      }
      
      // Mark as final if needed
      if (message.isFinal) {
        existingPhrase.style.backgroundColor = '#e8f4fc';
      }
    } else {
      // Create new phrase element
      const phraseEl = document.createElement('div');
      phraseEl.className = 'phrase';
      phraseEl.id = `${playerId}-phrase-${message.phraseId}`;
      
      if (message.isFinal) {
        phraseEl.style.backgroundColor = '#e8f4fc';
      }
      
      // Create header
      const headerEl = document.createElement('div');
      headerEl.className = 'phrase-header';
      
      const speakerName = message.name || `Speaker ${message.speakerId.slice(-4)}`;
      headerEl.innerHTML = `
        <span class="speaker-name">${speakerName}</span>
        <span class="phrase-time">${new Date().toLocaleTimeString()}</span>
      `;
      
      // Create text content
      const textEl = document.createElement('div');
      textEl.className = 'phrase-text';
      textEl.textContent = message.translatedText;
      
      // Assemble phrase
      phraseEl.appendChild(headerEl);
      phraseEl.appendChild(textEl);
      
      // Add to transcript at the beginning (newest first)
      transcriptEl.prepend(phraseEl);
      
      // Limit number of phrases to avoid performance issues
      const allPhrases = transcriptEl.querySelectorAll('.phrase');
      if (allPhrases.length > 50) { // Keep only the most recent 50 phrases
        for (let i = 50; i < allPhrases.length; i++) {
          allPhrases[i].remove();
        }
      }
    }
  }
  
  // Handle speech message from server
  function handleSpeechMessage(playerId, message) {
    const player = state.players[playerId];
    if (!player || !player.audioEnabled) return;
    
    const audioLanguage = message.translatedLanguageCode || player.language;
    console.log(`Received audio for player ${playerId} (${audioLanguage})`);
    
    // Ensure we have valid audio data
    if (!message.synthesizedSpeech?.data?.length) {
      console.warn(`Empty audio data received for player ${playerId}`);
      return;
    }
    
    try {
      // Create audio element
      const audioElement = new Audio();
      audioElement.autoplay = false; // Don't autoplay - we'll handle playback with our queue
      
      // Convert the byte array to a playable blob
      const blob = new Blob([new Uint8Array(message.synthesizedSpeech.data)], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(blob);
      audioElement.src = audioUrl;
      
      // Create audio queue item
      const audioItem = {
        element: audioElement,
        url: audioUrl,
        phraseId: message.phraseId,
        language: audioLanguage,
        deviceId: player.deviceId
      };
      
      // Get the audio queue
      const audioQueue = state.audioQueues[playerId];
      if (!audioQueue) return;
      
      // Remove existing items with the same phraseId (replace with newer version)
      const existingIndex = audioQueue.findIndex(item => item.phraseId === message.phraseId);
      if (existingIndex >= 0) {
        const existingItem = audioQueue[existingIndex];
        if (existingItem.url) {
          URL.revokeObjectURL(existingItem.url);
        }
        audioQueue.splice(existingIndex, 1);
      }
      
      // Add to queue
      audioQueue.push(audioItem);
      
      // Set up event handlers for the audio element
      audioElement.addEventListener('ended', () => {
        console.log(`Audio playback completed for player ${playerId}`);
        
        // Clean up the audio URL
        URL.revokeObjectURL(audioUrl);
        
        // Play next audio in queue
        const connState = state.connectionStates[playerId];
        if (connState) {
          connState.isPlaying = false;
          playNextAudio(playerId);
        }
      });
      
      audioElement.addEventListener('error', (e) => {
        const errorMessage = e.target.error ? e.target.error.message : 'Unknown error';
        console.error(`Audio playback error for player ${playerId}:`, errorMessage);
        
        // Clean up the audio URL
        URL.revokeObjectURL(audioUrl);
        
        // Try next audio
        const connState = state.connectionStates[playerId];
        if (connState) {
          connState.isPlaying = false;
          playNextAudio(playerId);
        }
        
        addSystemMessage(playerId, `Audio playback error: ${errorMessage}`, true);
      });
      
      // If not already playing, start playing
      const connState = state.connectionStates[playerId];
      if (connState && !connState.isPlaying) {
        playNextAudio(playerId);
      }
      
    } catch (error) {
      console.error(`Error processing audio message for player ${playerId}:`, error);
      addSystemMessage(playerId, `Error processing audio: ${error.message}`, true);
    }
  }
  
  // Play next audio in queue
  async function playNextAudio(playerId) {
    const audioQueue = state.audioQueues[playerId];
    const connState = state.connectionStates[playerId];
    const player = state.players[playerId];
    
    if (!audioQueue || !connState || !player) return;
    
    if (audioQueue.length === 0) {
      connState.isPlaying = false;
      return;
    }
    
    connState.isPlaying = true;
    const nextAudio = audioQueue.shift();
    
    try {
      // Set output device if supported and specified
      if (state.audioSupported && nextAudio.deviceId) {
        try {
          await nextAudio.element.setSinkId(nextAudio.deviceId);
        } catch (error) {
          console.error(`Error setting audio output device for player ${playerId}:`, error);
          // Continue with default device
        }
      }
      
      // Play the audio
      try {
        await nextAudio.element.play();
      } catch (error) {
        console.error(`Error playing audio for player ${playerId}:`, error);
        // Try next audio
        connState.isPlaying = false;
        playNextAudio(playerId);
      }
    } catch (error) {
      console.error(`Error during audio playback for player ${playerId}:`, error);
      // Try next audio
      connState.isPlaying = false;
      playNextAudio(playerId);
    }
  }
  
  // Handle users message from server
  function handleUsersMessage(playerId, message) {
    // Extract presenters and add to transcript
    if (message.presenters && message.presenters.length > 0) {
      const presenterNames = message.presenters.map(p => p.name || `Speaker ${p.speakerId.slice(-4)}`);
      addSystemMessage(playerId, `Presenters: ${presenterNames.join(', ')}`);
    }
    
    // Update attendee count
    const attendeeCount = (message.others || 0) + (message.attendees?.length || 0);
    if (attendeeCount > 0) {
      addSystemMessage(playerId, `${attendeeCount} attendees connected`);
    }
  }
  
  // Handle end message from server
  function handleEndMessage(playerId) {
    updatePlayerStatus(playerId, 'ended', 'Session ended');
    addSystemMessage(playerId, 'The presentation has ended.');
    
    // Close the WebSocket connection
    disconnectPlayer(playerId, false);
  }
  
  // Handle error message from server
  function handleErrorMessage(playerId, message) {
    const errorMessage = message.message || 'Unknown error';
    updatePlayerStatus(playerId, 'error', errorMessage);
    addSystemMessage(playerId, `Error: ${errorMessage}`, true);
  }
  
  // Update player status
  function updatePlayerStatus(playerId, status, statusMessage = '') {
    const player = state.players[playerId];
    if (!player) return;
    
    // Update player state
    player.status = status;
    
    // Update status text
    const statusEl = document.getElementById(`${playerId}-status`);
    if (statusEl) {
      statusEl.className = `player-status ${status}`;
      statusEl.textContent = statusMessage || status;
    }
    
    // Update status light
    const statusLight = document.getElementById(`${playerId}-status-light`);
    if (statusLight) {
      statusLight.className = `player-status-light ${status}`;
      statusLight.title = statusMessage || status;
    }
  }
  
  // Add system message to player transcript
  function addSystemMessage(playerId, message, isError = false) {
    const transcriptEl = document.getElementById(`${playerId}-transcript`);
    if (!transcriptEl) return;
    
    const messageEl = document.createElement('div');
    messageEl.className = 'phrase system-message';
    if (isError) {
      messageEl.style.backgroundColor = '#ffeded';
      messageEl.style.color = '#e74c3c';
    }
    messageEl.textContent = message;
    
    transcriptEl.prepend(messageEl);
  }
  
  // Change language for a player
  function changeLanguage(playerId, language) {
    const player = state.players[playerId];
    const socket = state.websockets[playerId];
    
    if (!player) return;
    
    // Update state
    player.language = language;
    
    // Send change request if connected
    if (socket && socket.readyState === WebSocket.OPEN) {
      // First disable voice if enabled
      if (player.audioEnabled) {
        sendVoiceRequest(playerId, false);
      }
      
      // Then send language change
      try {
        const changeRequest = {
          type: 'change',
          languageCode: language
        };
        
        socket.send(JSON.stringify(changeRequest));
        console.log(`Language change request sent for player ${playerId}: ${language}`);
        
        // Add system message about language change
        const languageName = languageMap[language] || language;
        addSystemMessage(playerId, `Language changed to ${languageName}`);
        
        // Re-enable voice if needed after a short delay
        if (player.audioEnabled) {
          setTimeout(() => {
            sendVoiceRequest(playerId, true);
          }, 1000);
        }
      } catch (error) {
        console.error(`Error changing language for player ${playerId}:`, error);
        addSystemMessage(playerId, `Error changing language: ${error.message}`, true);
      }
    }
  }
  
  // Change output device for a player
  function changeOutputDevice(playerId, deviceId) {
    const player = state.players[playerId];
    if (!player) return;
    
    player.deviceId = deviceId;
    
    // Update device for any queued or playing audio
    if (state.audioSupported) {
      // Find any currently playing audio
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach(audio => {
        if (!audio.paused && audio.dataset.playerId === playerId) {
          try {
            audio.setSinkId(deviceId);
          } catch (error) {
            console.error(`Error changing output device for playing audio:`, error);
          }
        }
      });
    }
  }
  
  // Toggle audio for a player
  function toggleAudio(playerId, enabled) {
    const player = state.players[playerId];
    const socket = state.websockets[playerId];
    
    if (!player) return;
    
    player.audioEnabled = enabled;
    
    // Send voice request if connected
    if (socket && socket.readyState === WebSocket.OPEN) {
      sendVoiceRequest(playerId, enabled);
    }
  }
  
  // Send voice request
  function sendVoiceRequest(playerId, enabled) {
    const socket = state.websockets[playerId];
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    
    try {
      const voiceRequest = {
        type: 'voice',
        enabled: enabled
      };
      
      socket.send(JSON.stringify(voiceRequest));
      console.log(`Voice request sent for player ${playerId} (enabled=${enabled})`);
    } catch (error) {
      console.error(`Error sending voice request for player ${playerId}:`, error);
    }
  }
  
  // ==========================================
  // Presets Management
  // ==========================================
  
  // Load presets from localStorage
  function loadPresets() {
    try {
      const savedPresets = localStorage.getItem('wordlyPresets');
      if (savedPresets) {
        state.presets = JSON.parse(savedPresets);
        updatePresetSelect();
      }
    } catch (error) {
      console.error('Error loading presets:', error);
      showNotification('Error loading saved presets', 'error');
    }
  }
  
  // Update the preset select dropdown
  function updatePresetSelect() {
    // Clear existing options except the first
    while (presetSelect.options.length > 1) {
      presetSelect.remove(1);
    }
    
    // Add each preset as an option
    Object.keys(state.presets).forEach(presetName => {
      const option = document.createElement('option');
      option.value = presetName;
      option.textContent = presetName;
      presetSelect.appendChild(option);
    });
  }
  
  // Capture current configuration for presets
  function captureCurrentConfig() {
    const playerConfigs = [];
    
    // For each player, get its configuration
    Object.keys(state.players).forEach(playerId => {
      const player = state.players[playerId];
      const playerEl = document.getElementById(playerId);
      
      if (player && playerEl) {
        // Get collapsed state
        const isCollapsed = playerEl.querySelector('.player-content').classList.contains('collapsed');
        
        playerConfigs.push({
          language: player.language,
          deviceId: player.deviceId,
          audioEnabled: player.audioEnabled,
          collapsed: isCollapsed
        });
      }
    });
    
    return {
      sessionId: state.sessionId,
      passcode: state.passcode,
      players: playerConfigs
    };
  }
  
  // Load a preset configuration
  function loadPresetByName(presetName) {
    const preset = state.presets[presetName];
    if (!preset) {
      showNotification(`Preset "${presetName}" not found`, 'error');
      return;
    }
    
    // Check if session ID matches current session
    if (preset.sessionId !== state.sessionId) {
      showNotification('Warning: Preset is for a different session ID', 'error');
      // Don't return, we'll still try to apply what makes sense
    }
    
    // Disconnect all players
    Object.keys(state.players).forEach(playerId => {
      disconnectPlayer(playerId);
    });
    
    // Clear player grid
    playerGrid.innerHTML = '';
    
    // Reset player ID counter
    state.nextPlayerId = 1;
    
    // Reset state collections
    state.players = {};
    state.websockets = {};
    state.audioQueues = {};
    state.phrases = {};
    state.connectionStates = {};
    
    // Add players from preset
    preset.players.forEach(playerConfig => {
      const playerId = addPlayer(playerConfig);
      
      // Set collapsed state
      if (playerConfig.collapsed) {
        const playerEl = document.getElementById(playerId);
        if (playerEl) {
          const content = playerEl.querySelector('.player-content');
          const collapseBtn = playerEl.querySelector('[data-action="collapse"]');
          
          if (content && collapseBtn) {
            content.classList.add('collapsed');
            collapseBtn.textContent = 'Expand';
          }
        }
      }
    });
    
    state.currentPreset = presetName;
    showNotification(`Preset "${presetName}" loaded successfully`, 'success');
  }
  
  // ==========================================
  // Init & Event Handlers
  // ==========================================
  
  // Handle tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      
      const tabId = button.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });
  
  // Handle credentials form submission
  credentialsForm.addEventListener('submit', (e) => {
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
  });
  
  // Handle link form submission
  linkForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const weblink = document.getElementById('weblink').value.trim();
    const { sessionId: parsedSessionId, passcode: parsedPasscode } = parseWeblink(weblink);
    
    if (!parsedSessionId) {
      showLoginError('Unable to extract session information from the provided link');
      return;
    }
    
    processLogin(parsedSessionId, parsedPasscode);
  });
  
  // Process login
  function processLogin(sessionId, passcode) {
    state.sessionId = sessionId;
    state.passcode = passcode || '';
    
    showLoginSuccess('Login successful! Initializing audio system...');
    
    // Initialize audio
    initializeAudio().then(success => {
      console.log('Audio initialization:', success ? 'success' : 'failed but continuing');
      
      // Load presets
      loadPresets();
      
      // Switch to app page
      loginPage.style.display = 'none';
      appPage.style.display = 'block';
      
      // Set session ID display
      sessionIdDisplay.textContent = `Session: ${sessionId}`;
      
      // Add first player
      addPlayer();
    });
  }
  
  // Global collapse/expand button
  if (globalCollapseBtn) {
    globalCollapseBtn.addEventListener('click', () => {
      // Check if all players are already collapsed
      const playerContents = document.querySelectorAll('.player-content');
      const allCollapsed = Array.from(playerContents).every(content => 
        content.classList.contains('collapsed'));
      
      // Toggle collapse for all players
      playerContents.forEach(content => {
        if (allCollapsed) {
          content.classList.remove('collapsed');
        } else {
          content.classList.add('collapsed');
        }
      });
      
      // Update all collapse buttons
      document.querySelectorAll('.player-btn[data-action="collapse"]').forEach(button => {
        button.textContent = allCollapsed ? 'Collapse' : 'Expand';
      });
      
      // Update global collapse button text
      globalCollapseBtn.textContent = allCollapsed ? 'Collapse All' : 'Expand All';
    });
  }
  
  // Add device button
  addDeviceBtn.addEventListener('click', () => {
    addPlayer();
  });
  
  // Disconnect button
  disconnectBtn.addEventListener('click', () => {
    // Disconnect all players
    Object.keys(state.players).forEach(playerId => {
      disconnectPlayer(playerId);
    });
    
    // Clear player grid
    playerGrid.innerHTML = '';
    
    // Reset state
    state.nextPlayerId = 1;
    state.players = {};
    state.websockets = {};
    state.audioQueues = {};
    state.phrases = {};
    state.connectionStates = {};
    
    // Go back to login page
    appPage.style.display = 'none';
    loginPage.style.display = 'flex';
  });
  
  // Save preset button
  savePresetBtn.addEventListener('click', () => {
    const presetName = presetNameInput.value.trim();
    
    if (!presetName) {
      showNotification('Please enter a name for this preset', 'error');
      return;
    }
    
    // Get current configuration
    const config = captureCurrentConfig();
    
    // Save to state
    state.presets[presetName] = config;
    
    // Save to localStorage
    try {
      localStorage.setItem('wordlyPresets', JSON.stringify(state.presets));
      updatePresetSelect();
      showNotification(`Preset "${presetName}" saved successfully`, 'success');
      presetNameInput.value = '';
    } catch (error) {
      console.error('Error saving preset:', error);
      showNotification('Error saving preset', 'error');
    }
  });
  
  // Load preset button
  loadPresetBtn.addEventListener('click', () => {
    const presetName = presetSelect.value;
    
    if (!presetName) {
      showNotification('Please select a preset to load', 'error');
      return;
    }
    
    loadPresetByName(presetName);
  });
  
  // Delete preset button
  deletePresetBtn.addEventListener('click', () => {
    const presetName = presetSelect.value;
    
    if (!presetName) {
      showNotification('Please select a preset to delete', 'error');
      return;
    }
    
    if (confirm(`Are you sure you want to delete preset "${presetName}"?`)) {
      // Remove from state
      delete state.presets[presetName];
      
      // Update localStorage
      try {
        localStorage.setItem('wordlyPresets', JSON.stringify(state.presets));
        updatePresetSelect();
        showNotification(`Preset "${presetName}" deleted`, 'success');
        presetSelect.value = '';
      } catch (error) {
        console.error('Error deleting preset:', error);
        showNotification('Error deleting preset', 'error');
      }
    }
  });
});