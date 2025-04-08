// Wordly Audio Routing Script - Revised
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
    players: [], // Stores state for each player instance
    presets: {},
    supportsSinkId: typeof HTMLAudioElement !== 'undefined' && 
                   typeof HTMLAudioElement.prototype.setSinkId === 'function',
    allCollapsed: false
  };
  
  // Define language mapping
  const languageMap = {
    'af': 'Afrikaans', 'sq': 'Albanian', 'ar': 'Arabic', 'hy': 'Armenian', 'bn': 'Bengali', 
    'bg': 'Bulgarian', 'zh-HK': 'Cantonese', 'ca': 'Catalan', 'zh-CN': 'Chinese (Simplified)', 
    'zh-TW': 'Chinese (Traditional)', 'hr': 'Croatian', 'cs': 'Czech', 'da': 'Danish', 
    'nl': 'Dutch', 'en': 'English (US)', 'en-AU': 'English (AU)', 'en-GB': 'English (UK)', 
    'et': 'Estonian', 'fi': 'Finnish', 'fr': 'French (FR)', 'fr-CA': 'French (CA)', 
    'ka': 'Georgian', 'de': 'German', 'el': 'Greek', 'gu': 'Gujarati', 'he': 'Hebrew', 
    'hi': 'Hindi', 'hu': 'Hungarian', 'is': 'Icelandic', 'id': 'Indonesian', 'ga': 'Irish', 
    'it': 'Italian', 'ja': 'Japanese', 'kn': 'Kannada', 'ko': 'Korean', 'lv': 'Latvian', 
    'lt': 'Lithuanian', 'mk': 'Macedonian', 'ms': 'Malay', 'mt': 'Maltese', 'no': 'Norwegian', 
    'fa': 'Persian', 'pl': 'Polish', 'pt': 'Portuguese (PT)', 'pt-BR': 'Portuguese (BR)', 
    'ro': 'Romanian', 'ru': 'Russian', 'sr': 'Serbian', 'sk': 'Slovak', 'sl': 'Slovenian', 
    'es': 'Spanish (ES)', 'es-MX': 'Spanish (MX)', 'sv': 'Swedish', 'tl': 'Tagalog', 
    'th': 'Thai', 'tr': 'Turkish', 'uk': 'Ukrainian', 'vi': 'Vietnamese', 'cy': 'Welsh', 
    'pa': 'Punjabi', 'sw': 'Swahili', 'ta': 'Tamil', 'ur': 'Urdu', 
    'zh': 'Chinese' // Backward compatibility
  };
  
  // Initialize the application
  init();
  
  // --- Initialization Functions ---

  function init() {
    setupTabs();
    setupLoginForms();
    setupPresetControls();
    setupAppControls();
    checkBrowserCompatibility();
    loadPresetsFromStorage();
  }

  function checkBrowserCompatibility() {
    const isChromeBased = /Chrome/.test(navigator.userAgent) || /Edg/.test(navigator.userAgent);
    if (!isChromeBased) {
      browserWarning.style.display = 'block';
    }
    if (!state.supportsSinkId) {
      noDeviceSupportMessage.style.display = 'block';
    }
  }

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

  function setupLoginForms() {
    credentialsForm.addEventListener('submit', handleCredentialsForm);
    linkForm.addEventListener('submit', handleLinkForm);
  }

  function setupAppControls() {
    disconnectBtn.addEventListener('click', disconnectFromSession);
    addDeviceBtn.addEventListener('click', () => addNewPlayer()); // Allow adding player with default settings
    globalCollapseBtn.addEventListener('click', toggleAllPlayers);
  }

  function setupPresetControls() {
    savePresetBtn.addEventListener('click', savePreset);
    loadPresetBtn.addEventListener('click', loadSelectedPreset);
    deletePresetBtn.addEventListener('click', deleteSelectedPreset);
  }

  // --- Login and Session Management ---

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

  function handleLinkForm(e) {
    e.preventDefault();
    const weblink = document.getElementById('weblink').value.trim();
    const { sessionId: parsedSessionId, passcode: parsedPasscode } = parseWeblink(weblink);
    if (!parsedSessionId) {
      showLoginError('Unable to extract session information from the provided link');
      return;
    }
    processLogin(parsedSessionId, parsedPasscode || '');
  }

  function isValidSessionId(sessionId) {
    return /^[A-Za-z0-9]{4}-\d{4}$/.test(sessionId);
  }

  function formatSessionId(input) {
    const cleaned = input.replace(/[^A-Za-z0-9]/g, '');
    return cleaned.length === 8 ? `${cleaned.substring(0, 4)}-${cleaned.substring(4)}` : input;
  }

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
          const formatted = formatSessionId(potentialSessionId);
          if (isValidSessionId(formatted)) sessionId = formatted;
        }
      }
      return { sessionId, passcode };
    } catch (error) {
      console.error('Error parsing weblink:', error);
      return { sessionId: null, passcode: '' };
    }
  }

  function showLoginError(message) {
    loginStatus.textContent = message;
    loginStatus.className = 'status-message error';
  }

  function showLoginSuccess(message) {
    loginStatus.textContent = message;
    loginStatus.className = 'status-message success';
  }

  async function processLogin(sessionId, passcode) {
    showLoginSuccess('Fetching audio devices...');
    try {
        // Must get devices *before* switching page to ensure dropdowns populate
        await initializeAudioDevices(); 
        
        state.sessionId = sessionId;
        state.passcode = passcode;

        showLoginSuccess('Login successful! Connecting to session...');
        
        // Switch to app page
        loginPage.style.display = 'none';
        appPage.style.display = 'block'; // Use 'block' or 'flex' depending on CSS needs
        
        sessionIdDisplay.textContent = `Session: ${sessionId}`;
        
        // Add a default player if none exist
        if (state.players.length === 0) {
          addNewPlayer(); // Add player with default settings (audio off)
        }
        showNotification(`Connected to session ${sessionId}`, 'success');

    } catch (err) {
        showLoginError(`Failed to initialize audio devices: ${err.message}. Please grant microphone permission.`);
    }
  }

  async function initializeAudioDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        throw new Error("Media device enumeration not supported.");
    }
    try {
      // Request microphone access to get permission for device enumeration with labels
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getTracks().forEach(track => track.stop()); // We don't need the stream, just permission

      const devices = await navigator.mediaDevices.enumerateDevices();
      state.devices = devices.filter(device => device.kind === 'audiooutput');
      
      if(state.devices.length === 0) {
         console.warn("No audio output devices found. setSinkId will not work.");
      } else {
         console.log(`Found ${state.devices.length} audio output devices.`);
      }
      
      // Update device dropdowns in existing players if any (e.g., after permission granted later)
      state.players.forEach(p => {
          const deviceSelect = p.element.querySelector('.device-select');
          if (deviceSelect) {
              populateDeviceSelect(deviceSelect, p.deviceId);
          }
      });

    } catch (error) {
      console.error('Error accessing audio devices:', error);
      // Re-throw specific error types if needed, or a generic message
      throw new Error(error.name === 'NotAllowedError' ? 'Microphone permission denied.' : 'Could not access audio devices.');
    }
  }

  function disconnectFromSession() {
    console.log("Disconnecting from session...");
    // Stop audio and clear queues for all players first
    state.players.forEach(player => {
        stopPlayerAudio(player); // Ensure audio stops
        if (player.websocket && player.websocket.readyState === WebSocket.OPEN) {
            try {
                player.websocket.close(1000, "User disconnected"); // Normal closure
            } catch (e) { console.error("Error closing websocket:", e); }
        }
    });

    // Clear players from state and DOM
    playerGrid.innerHTML = '';
    state.players = [];
    
    credentialsForm.reset();
    linkForm.reset();
    
    appPage.style.display = 'none';
    loginPage.style.display = 'flex'; // Use 'flex' as per initial CSS
    
    state.sessionId = null;
    state.passcode = '';
    loginStatus.textContent = '';
    loginStatus.className = 'status-message';
    
    showNotification('Disconnected from session', 'success');
  }

  // --- Player Management ---

  function addNewPlayer(config = {}) {
    const playerId = `player-${Date.now()}`;
    
    // *** FIX #1: Default audioEnabled to false ***
    const defaultConfig = {
      language: 'en',
      deviceId: '', // Default to system default initially
      audioEnabled: false, // Default to OFF
      collapsed: false
    };
    
    const playerConfig = { ...defaultConfig, ...config };

    // Ensure deviceId exists if set, otherwise use default
    if (playerConfig.deviceId && !state.devices.find(d => d.deviceId === playerConfig.deviceId)) {
        console.warn(`Device ID ${playerConfig.deviceId} not found, using system default.`);
        playerConfig.deviceId = ''; 
    }
    
    const playerEl = document.createElement('div');
    playerEl.className = 'player';
    playerEl.id = playerId;
    
    const deviceName = getDeviceName(playerConfig.deviceId);
    const languageName = getLanguageName(playerConfig.language);
    
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
          <select class="setting-select language-select"></select>
        </div>
        <div class="setting-group">
          <span class="setting-label">Device:</span>
          <select class="setting-select device-select"></select>
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
        <div class="audio-status">Audio ${playerConfig.audioEnabled ? 'ready' : 'off'}</div>
      </div>
    `;
    
    playerGrid.appendChild(playerEl);
    
    const languageSelect = playerEl.querySelector('.language-select');
    populateLanguageSelect(languageSelect, playerConfig.language);
    
    const deviceSelect = playerEl.querySelector('.device-select');
    populateDeviceSelect(deviceSelect, playerConfig.deviceId);
    
    // Create player state object
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
      audioQueue: [],        // *** FIX #2: Added audio queue ***
      isPlayingAudio: false, // *** FIX #2: Flag for queue processing ***
      currentAudioElement: null // *** FIX #6: Track current audio element ***
    };
    
    state.players.push(playerInstance);
    addPlayerEventListeners(playerEl, playerInstance); // Pass instance directly
    connectPlayerWebSocket(playerInstance);
    
    return playerInstance;
  }

  function removePlayer(player) {
    console.log(`Removing player ${player.id}`);
    stopPlayerAudio(player); // Stop audio first

    if (player.websocket && player.websocket.readyState !== WebSocket.CLOSED) {
      try {
        player.websocket.close(1000, "Player removed");
      } catch (e) { console.error("Error closing websocket:", e); }
    }
    
    player.element.remove();
    
    const index = state.players.findIndex(p => p.id === player.id);
    if (index !== -1) {
      state.players.splice(index, 1);
    }
    showNotification('Player removed', 'success');
  }

  function getPlayerById(playerId) {
    return state.players.find(player => player.id === playerId) || null;
  }

  // --- WebSocket Handling ---

  function connectPlayerWebSocket(player) {
    if (!state.sessionId) {
        updatePlayerStatus(player, 'error', 'Missing Session ID');
        return;
    }
    if (player.websocket && player.websocket.readyState === WebSocket.OPEN) {
        console.log(`WebSocket for player ${player.id} already open.`);
        return;
    }

    updatePlayerStatus(player, 'connecting');
    try {
      player.websocket = new WebSocket('wss://endpoint.wordly.ai/attend');
      player.websocket.onopen = () => handleWebSocketOpen(player);
      player.websocket.onmessage = (event) => handleWebSocketMessage(player, event);
      player.websocket.onclose = (event) => handleWebSocketClose(player, event);
      player.websocket.onerror = (error) => handleWebSocketError(player, error);
    } catch (error) {
      console.error(`Error creating WebSocket for player ${player.id}:`, error);
      updatePlayerStatus(player, 'error', 'Connection error');
    }
  }

  function handleWebSocketOpen(player) {
    console.log(`WebSocket connection established for player ${player.id}`);
    const connectRequest = {
      type: 'connect',
      presentationCode: state.sessionId,
      languageCode: player.language,
      identifier: player.id // Use player ID as attendee identifier
    };
    if (state.passcode) {
      connectRequest.accessKey = state.passcode;
    }
    
    try {
      player.websocket.send(JSON.stringify(connectRequest));
      // Send initial voice request based on player state ONLY after successful connection confirmation (in status message)
    } catch (error) {
      console.error(`Error sending connect request for player ${player.id}:`, error);
      updatePlayerStatus(player, 'error', 'Connection error');
    }
  }

  function handleWebSocketMessage(player, event) {
    try {
      const message = JSON.parse(event.data);
      // console.log(`Received message type: ${message.type} for player ${player.id}`); // DEBUG
      
      switch (message.type) {
        case 'status': handleStatusMessage(player, message); break;
        case 'phrase': handlePhraseMessage(player, message); break;
        case 'speech': handleSpeechMessage(player, message); break;
        case 'users': handleUsersMessage(player, message); break;
        case 'end': handleEndMessage(player); break;
        case 'error': handleErrorMessage(player, message); break;
        case 'echo': console.log(`Echo received for player ${player.id}`); break; // Handle echo if needed
        default: console.warn(`Unhandled message type: ${message.type} for player ${player.id}`);
      }
    } catch (error) {
      console.error(`Error processing message for player ${player.id}:`, error, event.data);
    }
  }

  function handleWebSocketClose(player, event) {
    console.log(`WebSocket closed for player ${player.id}. Code: ${event.code}, Reason: ${event.reason}, Was Clean: ${event.wasClean}`);
    stopPlayerAudio(player); // Ensure audio stops on close
    const status = event.wasClean || event.code === 1000 ? 'disconnected' : 'error';
    const message = status === 'disconnected' ? 'Disconnected' : `Connection lost (Code: ${event.code})`;
    updatePlayerStatus(player, status, message);
    player.websocket = null; // Clear reference

    // Optional: Reconnect logic (consider adding backoff)
    if (!event.wasClean && state.sessionId && state.players.find(p => p.id === player.id)) {
       console.log(`Attempting to reconnect player ${player.id} in 5 seconds...`);
       // setTimeout(() => {
       //    if (state.players.find(p => p.id === player.id)) { // Check if player still exists
       //       connectPlayerWebSocket(player);
       //    }
       // }, 5000);
    }
  }

  function handleWebSocketError(player, error) {
    console.error(`WebSocket error for player ${player.id}:`, error);
    stopPlayerAudio(player); // Ensure audio stops on error
    updatePlayerStatus(player, 'error', 'Connection error');
    // Consider attempting reconnect or closing cleanly
    if (player.websocket && player.websocket.readyState !== WebSocket.CLOSED) {
        player.websocket.close(1011, "WebSocket error"); // Internal error code
    }
    player.websocket = null;
  }

  // --- Message Handling Logic ---

  function handleStatusMessage(player, message) {
    if (message.success) {
      updatePlayerStatus(player, 'connected', 'Connected');
      addSystemMessage(player, 'Connected. Waiting for translations...');
      // Now send initial voice request if needed
      if (player.audioEnabled) {
        sendVoiceRequest(player, true); 
      }
    } else {
      updatePlayerStatus(player, 'error', message.message || 'Connection failed');
      addSystemMessage(player, `Connection error: ${message.message || 'Unknown error'}`, true);
    }
  }

  function handlePhraseMessage(player, message) {
    const phraseId = message.phraseId;
    const transcriptContainer = player.element.querySelector('.player-transcript');
    let phraseElement = transcriptContainer.querySelector(`#phrase-${player.id}-${phraseId}`); // Prefix with player ID for uniqueness across players

    if (!phraseElement) {
        phraseElement = document.createElement('div');
        phraseElement.id = `phrase-${player.id}-${phraseId}`;
        phraseElement.className = 'phrase';
        phraseElement.innerHTML = `
            <div class="phrase-header">
                <span class="speaker-name">${message.name || `Speaker ${message.speakerId.slice(-4)}`}</span>
                <span class="phrase-time">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="phrase-text"></div>`;
        transcriptContainer.insertBefore(phraseElement, transcriptContainer.firstChild);
        limitTranscriptSize(transcriptContainer);
    }

    const textElement = phraseElement.querySelector('.phrase-text');
    textElement.textContent = message.translatedText;

    player.phrases[phraseId] = message; // Store phrase data if needed later
  }

  function limitTranscriptSize(transcriptContainer, maxPhrases = 50) {
    while (transcriptContainer.children.length > maxPhrases) {
      transcriptContainer.removeChild(transcriptContainer.lastChild);
    }
  }

  function handleSpeechMessage(player, message) {
    // Add to queue only if audio is generally enabled for this player
    if (!player.audioEnabled) return;

    if (message.synthesizedSpeech && message.synthesizedSpeech.data && message.synthesizedSpeech.data.length > 0) {
      // *** FIX #2: Add to queue instead of playing directly ***
      player.audioQueue.push({ 
          data: message.synthesizedSpeech.data, 
          phraseId: message.phraseId,
          deviceId: player.deviceId // Use the device ID set for the player at this moment
      });
      // console.log(`Player ${player.id}: Queued audio for phrase ${message.phraseId}. Queue size: ${player.audioQueue.length}`); // DEBUG
      processAudioQueue(player); // Attempt to process the queue
    } else {
      const audioStatusEl = player.element.querySelector('.audio-status');
      if (audioStatusEl) audioStatusEl.textContent = 'Received empty audio data';
    }
  }

  function handleUsersMessage(player, message) {
    // Could update UI with presenter/attendee info if needed
    const attendeeCount = (message.others || 0) + (message.attendees?.length || 0);
    if (player.status === 'connected') { // Only update if connected
        const statusEl = player.element.querySelector('.player-status');
        if(statusEl) statusEl.textContent = `Connected (${attendeeCount} attendees)`;
    }
  }

  function handleEndMessage(player) {
    updatePlayerStatus(player, 'ended', 'Session ended');
    addSystemMessage(player, 'The presentation has ended.');
    stopPlayerAudio(player); // Stop any playing audio
    if (player.websocket && player.websocket.readyState === WebSocket.OPEN) {
      try {
        player.websocket.close(1000, "Presentation ended");
      } catch (e) { console.error("Error closing websocket:", e); }
    }
    player.websocket = null;
  }

  function handleErrorMessage(player, message) {
    updatePlayerStatus(player, 'error', message.message || 'Unknown error');
    addSystemMessage(player, `Error: ${message.message || 'Unknown error'}`, true);
    // Consider stopping audio or attempting to close connection on critical errors
  }

  // --- Audio Playback & Queuing ---

/** * Processes the audio queue for a player. Plays the next item if not already playing.
   * @param {Object} player - The player object
   */
  function processAudioQueue(player) {
    if (player.isPlayingAudio || player.audioQueue.length === 0) {
      // console.log(`Player ${player.id}: Skipping queue processing. Playing: ${player.isPlayingAudio}, Queue size: ${player.audioQueue.length}`); // DEBUG
      return; 
    }

    player.isPlayingAudio = true;
    const audioItem = player.audioQueue.shift(); // Get the next item
    // console.log(`Player ${player.id}: Dequeued audio for phrase ${audioItem.phraseId}. Queue size: ${player.audioQueue.length}`); // DEBUG
    
    const audioStatusEl = player.element.querySelector('.audio-status');
    const phraseElement = player.element.querySelector(`#phrase-${player.id}-${audioItem.phraseId}`); // Find corresponding phrase element

    try {
      const blob = new Blob([new Uint8Array(audioItem.data)], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(blob);
      const audioElement = new Audio();
      player.currentAudioElement = audioElement; // *** FIX #6: Track current element ***

      audioElement.src = audioUrl;

      audioElement.oncanplaythrough = async () => {
          // *** FIX #5: Attempt setSinkId after src is set and potentially ready ***
          if (audioItem.deviceId && state.supportsSinkId) {
              try {
                  // console.log(`Player ${player.id}: Attempting to set Sink ID: ${audioItem.deviceId}`); // DEBUG
                  await audioElement.setSinkId(audioItem.deviceId);
                  // console.log(`Player ${player.id}: Sink ID set successfully.`); // DEBUG
              } catch (error) {
                  console.error(`Player ${player.id}: Error setting Sink ID ${audioItem.deviceId}:`, error);
                  if(audioStatusEl) audioStatusEl.textContent = 'Error setting audio device';
                  // Playback will continue on default device
              }
          } else if (audioItem.deviceId && !state.supportsSinkId) {
              console.warn(`Player ${player.id}: Sink ID ${audioItem.deviceId} selected, but browser doesn't support setSinkId.`);
          }

          // Play the audio
          try {
              await audioElement.play();
              if(audioStatusEl) audioStatusEl.textContent = 'Playing audio...';
              // *** FIX #3: Add playing class ***
              if (phraseElement) phraseElement.classList.add('phrase-playing'); 
          } catch (playError) {
              console.error(`Player ${player.id}: Error playing audio:`, playError);
              if(audioStatusEl) audioStatusEl.textContent = 'Audio playback error';
              cleanupAudio(player, audioUrl, phraseElement); // Cleanup on play error too
          }
      };
      
      audioElement.onended = () => {
          // console.log(`Player ${player.id}: Audio ended for phrase ${audioItem.phraseId}`); // DEBUG
          if(audioStatusEl) audioStatusEl.textContent = 'Audio playback completed';
          cleanupAudio(player, audioUrl, phraseElement);
      };

      audioElement.onerror = (errorEvent) => { // Capture the event object
          console.error(`Player ${player.id}: Audio element error event occurred.`); // Original log line
          
          // *** ADDED DETAIL LOGGING ***
          if (audioElement.error) {
              console.error(`  >> Audio Error Code: ${audioElement.error.code}, Message: ${audioElement.error.message}`);
          } else {
              console.error("  >> No specific audioElement.error details available.");
          }
          // ***************************

          if(audioStatusEl) audioStatusEl.textContent = 'Audio playback error';
          cleanupAudio(player, audioUrl, phraseElement);
      };

      audioElement.onstalled = () => {
          console.warn(`Player ${player.id}: Audio stalled.`);
          // Maybe cleanup and try next? Or just let it resolve?
      };
      
      // Load the audio (required by some browsers before setting sinkId or playing)
      audioElement.load();

    } catch (error) {
      console.error(`Player ${player.id}: Error processing audio blob:`, error);
      if(audioStatusEl) audioStatusEl.textContent = 'Error processing audio';
      player.isPlayingAudio = false; // Ensure flag is reset on error
      processAudioQueue(player); // Try next item? Or maybe stop?
    }
  }

  /**
   * Cleans up after audio playback (ended or error).
   * @param {Object} player - The player object
   * @param {string} audioUrl - The blob URL to revoke
   * @param {HTMLElement|null} phraseElement - The phrase element to remove styling from
   */
  function cleanupAudio(player, audioUrl, phraseElement) {
      URL.revokeObjectURL(audioUrl);
      // *** FIX #3: Remove playing class ***
      if (phraseElement) phraseElement.classList.remove('phrase-playing'); 
      player.isPlayingAudio = false;
      player.currentAudioElement = null; // *** FIX #6: Clear current element tracking ***
      processAudioQueue(player); // Trigger processing the next item
  }

  /**
   * Stops currently playing audio and clears the queue for a player.
   * @param {Object} player - The player object
   */
  function stopPlayerAudio(player) {
      // *** FIX #6: Stop current audio element ***
      if (player.currentAudioElement) {
          try {
              player.currentAudioElement.pause();
              player.currentAudioElement.src = ""; // Release resource
              // Find the URL associated with this element if needed for revokeObjectURL
              // This might require storing the URL alongside currentAudioElement
          } catch(e) { console.error(`Error stopping audio for player ${player.id}:`, e); }
          player.currentAudioElement = null;
      }
      // *** FIX #2 & #6: Clear the queue ***
      // If URLs were stored in queue, revoke them here
      // For simplicity, we assume cleanupAudio handles revoking URLs as items are processed/ended/errored
      player.audioQueue = []; 
      player.isPlayingAudio = false; // Reset flag
      const audioStatusEl = player.element.querySelector('.audio-status');
      if(audioStatusEl) audioStatusEl.textContent = player.audioEnabled ? "Audio ready" : "Audio off";
      console.log(`Player ${player.id}: Audio stopped and queue cleared.`);
  }


  // --- UI Updates and Event Handling ---

  function updatePlayerStatus(player, status, message) {
    player.status = status;
    const statusLight = player.element.querySelector('.player-status-light');
    const statusEl = player.element.querySelector('.player-status');
    if (statusLight) statusLight.className = `player-status-light ${status}`;
    if (statusEl) {
      statusEl.className = `player-status ${status}`;
      statusEl.textContent = message || status.charAt(0).toUpperCase() + status.slice(1);
    }
  }

  function addSystemMessage(player, message, isError = false) {
    const transcriptContainer = player.element.querySelector('.player-transcript');
    if (!transcriptContainer) return;
    const messageEl = document.createElement('div');
    messageEl.className = isError ? 'phrase system-message error' : 'phrase system-message';
    messageEl.textContent = message;
    transcriptContainer.insertBefore(messageEl, transcriptContainer.firstChild);
  }

  function populateLanguageSelect(selectElement, selectedLanguage) {
    selectElement.innerHTML = ''; // Clear existing
    Object.entries(languageMap).forEach(([code, name]) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = name;
      selectElement.appendChild(option);
    });
    selectElement.value = selectedLanguage; // Set selected
  }

  function populateDeviceSelect(selectElement, selectedDeviceId) {
    selectElement.innerHTML = ''; // Clear existing
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'System Default';
    selectElement.appendChild(defaultOption);
    
    state.devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Output ${device.deviceId.slice(0, 6)}...`;
      selectElement.appendChild(option);
    });

    // Ensure the selectedDeviceId still exists, otherwise revert to default
    if (selectedDeviceId && state.devices.find(d => d.deviceId === selectedDeviceId)) {
         selectElement.value = selectedDeviceId;
    } else {
         selectElement.value = ''; // Default if ID not found
    }
  }

  function getDeviceName(deviceId) {
      if (!deviceId) return 'System Default';
      const device = state.devices.find(d => d.deviceId === deviceId);
      return device?.label || `Output ${deviceId.slice(0, 6)}...` || 'Unknown Device';
  }

  function getLanguageName(code) {
    return languageMap[code] || code;
  }

  function addPlayerEventListeners(playerEl, player) { // Pass player instance
    if (!player) {
        console.error("Attempted to add listeners to non-existent player for element:", playerEl);
        return;
    }
    
    // Language select change
    const languageSelect = playerEl.querySelector('.language-select');
    languageSelect.addEventListener('change', (e) => {
      const newLanguage = e.target.value;
      if (newLanguage === player.language) return;

      const oldLanguageName = getLanguageName(player.language);
      player.language = newLanguage;
      const newLanguageName = getLanguageName(newLanguage);
      
      playerEl.querySelector('.player-language-indicator').textContent = newLanguageName;
      
      if (player.websocket && player.websocket.readyState === WebSocket.OPEN) {
        // *** FIX #4: Log the message being sent ***
        const changeRequest = { type: 'change', languageCode: newLanguage };
        console.log(`Player ${player.id}: Sending language change request:`, JSON.stringify(changeRequest));
        
        try {
           // Stop audio before changing language to avoid mismatched audio
           const wasAudioEnabled = player.audioEnabled;
           if(wasAudioEnabled) sendVoiceRequest(player, false);
           stopPlayerAudio(player); // Clear queue etc.

           player.websocket.send(JSON.stringify(changeRequest));
           addSystemMessage(player, `Language changed to ${newLanguageName}.`);

           // Re-enable voice if it was on before changing language
           if (wasAudioEnabled) {
              setTimeout(() => {
                // Ensure websocket is still open before sending
                if (player.websocket && player.websocket.readyState === WebSocket.OPEN) {
                   sendVoiceRequest(player, true);
                }
              }, 500); // Small delay for change to process
           }
        } catch (e) {
           console.error(`Player ${player.id}: Error sending language change:`, e);
           addSystemMessage(player, `Error changing language: ${e.message}`, true);
           // Revert language?
           player.language = languageSelect.value; // Keep UI consistent with state
        }
      } else {
          console.warn(`Player ${player.id}: WebSocket not open. Language change only affects future connection.`);
      }
    });
    
    // Device select change
    const deviceSelect = playerEl.querySelector('.device-select');
    deviceSelect.addEventListener('change', (e) => {
      player.deviceId = e.target.value;
      const deviceName = getDeviceName(player.deviceId);
      playerEl.querySelector('.device-name').textContent = deviceName;
      addSystemMessage(player, `Output device set to: ${deviceName}`);
      // Future audio will use this device ID (passed in audioItem)
    });
    
    // Audio toggle
    const audioToggle = playerEl.querySelector('.audio-toggle');
    audioToggle.addEventListener('change', (e) => {
      player.audioEnabled = e.target.checked;
      const audioStatusEl = player.element.querySelector('.audio-status');
      
      if (player.audioEnabled) {
        if(audioStatusEl) audioStatusEl.textContent = 'Audio ready';
        addSystemMessage(player, 'Audio translations enabled.');
        // Send voice request only if connected
        if (player.websocket && player.websocket.readyState === WebSocket.OPEN) {
           sendVoiceRequest(player, true);
        }
        // Start processing queue if items exist
        processAudioQueue(player); 
      } else {
        if(audioStatusEl) audioStatusEl.textContent = 'Audio off';
        addSystemMessage(player, 'Audio translations disabled.');
        // Stop current playback and clear queue
        stopPlayerAudio(player); 
        // Send voice disable request only if connected
        if (player.websocket && player.websocket.readyState === WebSocket.OPEN) {
          sendVoiceRequest(player, false);
        }
      }
    });
    
    // Player header buttons (Collapse/Remove)
    playerEl.querySelector('.player-header').addEventListener('click', (e) => {
        // *** FIX #7: Delegate from header, check target specifically ***
        if (e.target.matches('.collapse-btn')) {
            // console.log(`Player ${player.id}: Collapse button clicked`); // DEBUG
            togglePlayerCollapse(player);
        } else if (e.target.matches('.remove-btn')) {
            // console.log(`Player ${player.id}: Remove button clicked`); // DEBUG
            if (confirm(`Are you sure you want to remove the player for ${getLanguageName(player.language)}?`)) {
               removePlayer(player);
            }
        }
    });
  }

  function sendVoiceRequest(player, enabled) {
    if (player.websocket && player.websocket.readyState === WebSocket.OPEN) {
      try {
        const voiceRequest = { type: 'voice', enabled: enabled };
        player.websocket.send(JSON.stringify(voiceRequest));
        console.log(`Player ${player.id}: Voice request sent (enabled=${enabled})`);
      } catch (e) {
        console.error(`Player ${player.id}: Error sending voice request (enabled=${enabled}):`, e);
      }
    } else {
        console.warn(`Player ${player.id}: Cannot send voice request, WebSocket not open.`);
    }
  }

  function togglePlayerCollapse(player) {
    // *** FIX #7: Added console logs for debugging ***
    // console.log(`Toggling collapse for player ${player.id}. Current state: ${player.collapsed}`); // DEBUG
    player.collapsed = !player.collapsed;
    
    const contentEl = player.element.querySelector('.player-content');
    const collapseBtn = player.element.querySelector('.collapse-btn'); // Query within player element
    
    if (!contentEl || !collapseBtn) {
        console.error(`Player ${player.id}: Could not find content or collapse button elements.`);
        return; // Exit if elements aren't found
    }

    contentEl.classList.toggle('collapsed', player.collapsed);
    collapseBtn.textContent = player.collapsed ? 'Expand' : 'Collapse';
    // console.log(`Player ${player.id}: New collapsed state: ${player.collapsed}`); // DEBUG
  }

  function toggleAllPlayers() {
    state.allCollapsed = !state.allCollapsed;
    state.players.forEach(player => {
      if (player.collapsed !== state.allCollapsed) { // Only toggle if needed
        togglePlayerCollapse(player); // Use the single toggle function
      }
    });
    globalCollapseBtn.textContent = state.allCollapsed ? 'Expand All' : 'Collapse All';
  }
  
  // --- Presets (LocalStorage) ---

  function loadPresetsFromStorage() {
    try {
      const savedPresets = localStorage.getItem('wordlyAudioPresets'); // Use a more specific key
      if (savedPresets) {
        state.presets = JSON.parse(savedPresets);
        updatePresetDropdown();
      }
    } catch (error) {
      console.error('Error loading presets:', error);
      localStorage.removeItem('wordlyAudioPresets'); // Clear potentially corrupt data
    }
  }

  function updatePresetDropdown() {
    while (presetSelect.options.length > 1) {
      presetSelect.remove(1);
    }
    Object.keys(state.presets).sort().forEach(presetName => { // Sort names alphabetically
      const option = document.createElement('option');
      option.value = presetName;
      option.textContent = presetName;
      presetSelect.appendChild(option);
    });
  }

  function savePreset() {
    const presetName = presetNameInput.value.trim();
    if (!presetName) {
      showNotification('Please enter a name for the preset', 'error');
      return;
    }
    if (!state.sessionId) {
      showNotification('Cannot save preset, not connected to a session.', 'error');
      return;
    }

    const presetConfig = {
      // sessionId: state.sessionId, // Maybe don't save session ID? Or make optional?
      // passcode: state.passcode,  // Definitely don't save passcode
      players: state.players.map(p => ({ // Only save player layout/settings
        language: p.language,
        deviceId: p.deviceId,
        audioEnabled: p.audioEnabled,
        collapsed: p.collapsed
      }))
    };
    
    state.presets[presetName] = presetConfig;
    try {
      localStorage.setItem('wordlyAudioPresets', JSON.stringify(state.presets));
      updatePresetDropdown();
      showNotification(`Preset "${presetName}" saved`, 'success');
      presetNameInput.value = '';
      presetSelect.value = presetName; // Select the newly saved preset
    } catch (error) {
      console.error('Error saving preset:', error);
      showNotification('Error saving preset. Storage might be full.', 'error');
    }
  }

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
    if (!state.sessionId) {
        showNotification('Connect to a session before loading a preset layout.', 'error');
        return;
    }

    console.log(`Loading preset "${presetName}"`);
    
    // Remove players that are not in the preset
    const presetPlayerConfigs = preset.players || [];
    const currentPlayerIds = state.players.map(p => p.id);
    const presetLanguages = presetPlayerConfigs.map(p => p.language); // Use language as a loose identifier for now

    // Simple approach: Remove all current players and add preset players
    // More complex: Try to match and update existing players - skipped for now
    
    // Disconnect and remove all existing players cleanly
    state.players.forEach(p => {
        stopPlayerAudio(p);
        if (p.websocket && p.websocket.readyState !== WebSocket.CLOSED) {
             p.websocket.close(1000, "Loading preset");
        }
    });
    playerGrid.innerHTML = '';
    state.players = [];

    // Add players from the preset
    if (presetPlayerConfigs.length > 0) {
        presetPlayerConfigs.forEach(playerConfig => {
            addNewPlayer(playerConfig); // Add player using saved config
        });
        showNotification(`Loaded preset "${presetName}"`, 'success');
    } else {
        showNotification(`Preset "${presetName}" loaded (no players defined)`, 'info');
    }
  }

  function deleteSelectedPreset() {
    const presetName = presetSelect.value;
    if (!presetName) {
      showNotification('Please select a preset to delete', 'error');
      return;
    }
    if (confirm(`Are you sure you want to delete the preset "${presetName}"?`)) {
        delete state.presets[presetName];
        try {
          localStorage.setItem('wordlyAudioPresets', JSON.stringify(state.presets));
          updatePresetDropdown();
          showNotification(`Preset "${presetName}" deleted`, 'success');
        } catch (error) {
          console.error('Error deleting preset:', error);
          showNotification('Error deleting preset', 'error');
        }
    }
  }
  
  // --- Notifications ---

  function showNotification(message, type = 'success') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove(); // Remove previous one immediately

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000); // Auto-remove after 3s
  }
});
