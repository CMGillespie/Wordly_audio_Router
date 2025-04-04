// Wordly Audio Router - GitHub-friendly version
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
  
  // Parse weblink
  function parseWeblink(weblink) {
    try {
      // Using standard URL constructor for GitHub version
      const url = new URL(weblink);
      
      let sessionId = null;
      let passcode = '';
      
      // Extract session ID from path
      const pathParts = url.pathname.split('/').filter(part => part);
      
      for (const part of pathParts) {
        // Check for XXXX-0000 format
        if (/^[A-Za-z0-9]{4}-\d{4}$/.test(part)) {
          sessionId = part;
          break;
        }
        
        // Check for XXXX0000 format
        if (/^[A-Za-z0-9]{8}$/.test(part)) {
          const formatted = `${part.substring(0, 4)}-${part.substring(4)}`;
          if (isValidSessionId(formatted)) {
            sessionId = formatted;
            break;
          }
        }
      }
      
      // Get passcode from 'key' parameter
      passcode = url.searchParams.get('key') || '';
      
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
  

    }, calculatedDelay);
    
    console.log(`Scheduled reconnect for player ${playerId} in ${calculatedDelay}ms`);
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
    state.activityTimers = {};
    
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
});// Wordly Audio Router - GitHub-friendly version
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
  
  // Parse weblink
  function parseWeblink(weblink) {
    try {
      // Using standard URL constructor for GitHub version
      const url = new URL(weblink);
      
      let sessionId = null;
      let passcode = '';
      
      // Extract session ID from path
      const pathParts = url.pathname.split('/').filter(part => part);
      
      for (const part of pathParts) {
        // Check for XXXX-0000 format
        if (/^[A-Za-z0-9]{4}-\d{4}$/.test(part)) {
          sessionId = part;
          break;
        }
        
        // Check for XXXX0000 format
        if (/^[A-Za-z0-9]{8}$/.test(part)) {
          const formatted = `${part.substring(0, 4)}-${part.substring(4)}`;
          if (isValidSessionId(formatted)) {
            sessionId = formatted;
            break;
          }
        }
      }
      
      // Get passcode from 'key' parameter
      passcode = url.searchParams.get('key') || '';
      
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
  

    }, calculatedDelay);
    
    console.log(`Scheduled reconnect for player ${playerId} in ${calculatedDelay}ms`);
  }
