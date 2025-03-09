/**
 * DJ Hands - Main Application Script
 * Control music with hand gestures
 */

// Prevent default browser behavior for drag and drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
}

// Main app
document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('music-upload');
    const trackList = document.getElementById('track-list');
    const visualizer = document.getElementById('visualizer');
    
    // Audio players
    const leftPlayer = document.getElementById('left-player');
    const rightPlayer = document.getElementById('right-player');
    
    // BPM controls
    const leftBpmValue = document.getElementById('left-bpm-value');
    const leftBpmInput = document.getElementById('left-bpm-input');
    const leftBpmDetect = document.getElementById('left-bpm-detect');
    const leftBpmSet = document.getElementById('left-bpm-set');
    const leftBpmSync = document.getElementById('left-bpm-sync');
    
    const rightBpmValue = document.getElementById('right-bpm-value');
    const rightBpmInput = document.getElementById('right-bpm-input');
    const rightBpmDetect = document.getElementById('right-bpm-detect');
    const rightBpmSet = document.getElementById('right-bpm-set');
    const rightBpmSync = document.getElementById('right-bpm-sync');
    
    // Transport controls
    const leftPlay = document.getElementById('left-play');
    const leftCue = document.getElementById('left-cue');
    const leftStop = document.getElementById('left-stop');
    const rightPlay = document.getElementById('right-play');
    const rightCue = document.getElementById('right-cue');
    const rightStop = document.getElementById('right-stop');
    
    // Volume and speed controls
    const leftVolume = document.getElementById('left-volume');
    const leftSpeed = document.getElementById('left-speed');
    const rightVolume = document.getElementById('right-volume');
    const rightSpeed = document.getElementById('right-speed');
    
    // Mixer controls
    const crossfader = document.getElementById('crossfader');
    
    // Display elements
    const leftNowPlaying = document.getElementById('left-now-playing');
    const rightNowPlaying = document.getElementById('right-now-playing');
    const crossfaderValue = document.querySelector('.crossfader-value');
    const eqLowValue = document.getElementById('eq-low-value');
    const eqMidValue = document.getElementById('eq-mid-value');
    const eqHighValue = document.getElementById('eq-high-value');
    
    // DJ app state
    const playlist = [];
    const deck = {
        left: {
            player: leftPlayer,
            currentTrack: null,
            isPlaying: false,
            volume: 0.8,
            speed: 1.0,
            cuePoint: 0,
            bpm: 120.0,
            originalBpm: 0,
            bpmDetecting: false
        },
        right: {
            player: rightPlayer,
            currentTrack: null,
            isPlaying: false,
            volume: 0.8,
            speed: 1.0,
            cuePoint: 0,
            bpm: 120.0,
            originalBpm: 0,
            bpmDetecting: false
        }
    };
    
    // Audio processing setup
    let audioContext;
    let leftAnalyser;
    let rightAnalyser;
    let visualizerContext;
    let animationFrame;
    let bpmDetector;
    
    // Initialize audio context once the user interacts with the page
    document.addEventListener('click', initAudioContext, { once: true });
    
    // Drop zone handlers
    dropZone.addEventListener('dragenter', () => {
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragover', () => {
        dropZone.classList.add('drag-over');
        return false;
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        handleFiles({ target: { files } });
        return false;
    });
    
    // File upload handlers
    fileInput.addEventListener('change', handleFiles);
    
    // Player controls
    leftPlay.addEventListener('click', () => togglePlayPause('left'));
    rightPlay.addEventListener('click', () => togglePlayPause('right'));
    
    leftCue.addEventListener('click', () => setCuePoint('left'));
    rightCue.addEventListener('click', () => setCuePoint('right'));
    
    leftStop.addEventListener('click', () => stopTrack('left'));
    rightStop.addEventListener('click', () => stopTrack('right'));
    
    // Volume and speed controls
    leftVolume.addEventListener('input', (e) => applyVolume('left', e.target.value));
    rightVolume.addEventListener('input', (e) => applyVolume('right', e.target.value));
    
    leftSpeed.addEventListener('input', (e) => applySpeed('left', e.target.value));
    rightSpeed.addEventListener('input', (e) => applySpeed('right', e.target.value));
    
    // Crossfader
    crossfader.addEventListener('input', (e) => applyCrossfade(e.target.value));
    
    // BPM controls - Left deck
    leftBpmDetect.addEventListener('click', () => detectBPM('left'));
    leftBpmSet.addEventListener('click', () => setBPM('left'));
    leftBpmSync.addEventListener('click', () => syncBPM('left', 'right'));
    leftBpmInput.addEventListener('change', () => validateBpmInput(leftBpmInput));
    
    // BPM controls - Right deck
    rightBpmDetect.addEventListener('click', () => detectBPM('right'));
    rightBpmSet.addEventListener('click', () => setBPM('right'));
    rightBpmSync.addEventListener('click', () => syncBPM('right', 'left'));
    rightBpmInput.addEventListener('change', () => validateBpmInput(rightBpmInput));
    
    // Initialize custom EQ sliders
    setupCustomEQSliders();
    
    /**
     * Initialize audio context and setup audio processing
     */
    function initAudioContext() {
        try {
            // Create audio context
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create analyzers
            leftAnalyser = audioContext.createAnalyser();
            leftAnalyser.fftSize = 256;
            
            rightAnalyser = audioContext.createAnalyser();
            rightAnalyser.fftSize = 256;
            
            // Initialize BPM detector
            bpmDetector = new BPMDetector(audioContext);
            
            // Setup visualization
            setupVisualization();
            
            console.log('Audio context initialized successfully');
        } catch (error) {
            console.error('Error initializing audio context:', error);
            showNotification('Error initializing audio system. Some features may be limited.', 'error');
        }
    }
    
    /**
     * Setup visualization canvas
     */
    function setupVisualization() {
        const canvas = document.createElement('canvas');
        canvas.width = visualizer.clientWidth;
        canvas.height = visualizer.clientHeight;
        visualizer.appendChild(canvas);
        visualizerContext = canvas.getContext('2d');
        
        // Start visualization loop
        drawWaveform();
    }
    
    /**
     * Draw waveform for visualization
     */
    function drawWaveform() {
        animationFrame = requestAnimationFrame(drawWaveform);
        visualizerContext.clearRect(0, 0, visualizer.clientWidth, visualizer.clientHeight);
        
        // Only visualize if audio context is initialized
        if (!audioContext) return;
        
        // Get buffer size
        const bufferLength = leftAnalyser.frequencyBinCount;
        
        // Draw left deck waveform if playing
        if (deck.left.isPlaying && deck.left.currentTrack) {
            const leftData = new Uint8Array(bufferLength);
            leftAnalyser.getByteTimeDomainData(leftData);
            
            visualizerContext.lineWidth = 2;
            visualizerContext.strokeStyle = 'rgba(121, 40, 202, 0.8)';
            visualizerContext.beginPath();
            
            const sliceWidth = visualizer.clientWidth / bufferLength;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                const v = leftData[i] / 128.0;
                const y = v * (visualizer.clientHeight / 2);
                
                if (i === 0) {
                    visualizerContext.moveTo(x, y);
                } else {
                    visualizerContext.lineTo(x, y);
                }
                
                x += sliceWidth;
            }
            
            visualizerContext.stroke();
        }
        
        // Draw right deck waveform if playing
        if (deck.right.isPlaying && deck.right.currentTrack) {
            const rightData = new Uint8Array(bufferLength);
            rightAnalyser.getByteTimeDomainData(rightData);
            
            visualizerContext.lineWidth = 2;
            visualizerContext.strokeStyle = 'rgba(255, 0, 128, 0.8)';
            visualizerContext.beginPath();
            
            const sliceWidth = visualizer.clientWidth / bufferLength;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                const v = rightData[i] / 128.0;
                const y = (visualizer.clientHeight / 2) + v * (visualizer.clientHeight / 2);
                
                if (i === 0) {
                    visualizerContext.moveTo(x, y);
                } else {
                    visualizerContext.lineTo(x, y);
                }
                
                x += sliceWidth;
            }
            
            visualizerContext.stroke();
        }
    }
    
    /**
     * Connect audio to filters and analyzers
     * @param {string} deckName - 'left' or 'right'
     */
    function connectAudio(deckName) {
        // Only proceed if audio context exists
        if (!audioContext) return;
        
        try {
            const currentDeck = deck[deckName];
            const player = currentDeck.player;
            const analyser = deckName === 'left' ? leftAnalyser : rightAnalyser;
            
            // Create media element source
            const source = audioContext.createMediaElementSource(player);
            
            // Create filter nodes
            const lowFilter = audioContext.createBiquadFilter();
            lowFilter.type = 'lowshelf';
            lowFilter.frequency.value = 320;
            lowFilter.gain.value = 0;
            
            const midFilter = audioContext.createBiquadFilter();
            midFilter.type = 'peaking';
            midFilter.frequency.value = 1000;
            midFilter.Q.value = 1;
            midFilter.gain.value = 0;
            
            const highFilter = audioContext.createBiquadFilter();
            highFilter.type = 'highshelf';
            highFilter.frequency.value = 3200;
            highFilter.gain.value = 0;
            
            // Store filters for future reference
            currentDeck.filters = {
                low: lowFilter,
                mid: midFilter,
                high: highFilter
            };
            
            // Create gain node (volume control)
            const gainNode = audioContext.createGain();
            gainNode.gain.value = currentDeck.volume;
            currentDeck.gainNode = gainNode;
            
            // Connect the chain
            source.connect(gainNode);
            gainNode.connect(lowFilter);
            lowFilter.connect(midFilter);
            midFilter.connect(highFilter);
            highFilter.connect(analyser);
            analyser.connect(audioContext.destination);
            
            // Store source for future reference
            currentDeck.source = source;
            
            console.log(`Audio chain setup complete for ${deckName} deck`);
        } catch (error) {
            console.error(`Error connecting audio for ${deckName} deck:`, error);
            // Fall back to standard HTML5 audio if Web Audio API fails
            showNotification('Audio effect processing not available. Playing with standard audio.', 'warning');
        }
    }
    
    /**
     * Handle file uploads
     * @param {Event} e - File input change event
     */
    function handleFiles(e) {
        const files = e.target.files;
        
        if (!files || files.length === 0) return;
        
        showNotification(`Processing ${files.length} file(s)...`, 'info');
        
        // Filter audio files
        Array.from(files).forEach(file => {
            if (!file.type.startsWith('audio/')) {
                showNotification(`Skipped ${file.name} - not an audio file`, 'error');
                return;
            }
            
            const fileUrl = URL.createObjectURL(file);
            
            // Create audio element to get metadata
            const audio = new Audio();
            audio.src = fileUrl;
            
            audio.addEventListener('loadedmetadata', () => {
                // Format duration
                const duration = audio.duration;
                const minutes = Math.floor(duration / 60);
                const seconds = Math.floor(duration % 60);
                const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                
                // Format filename (remove extension)
                const fileName = file.name.replace(/\.[^/.]+$/, "");
                
                // Add to playlist
                const track = {
                    id: playlist.length,
                    name: file.name,
                    displayName: fileName,
                    url: fileUrl,
                    duration: formattedDuration,
                    rawDuration: duration
                };
                
                playlist.push(track);
                addTrackToList(track);
                
                showNotification(`Added: ${file.name}`, 'success');
                
                // Auto-load first track to left deck if no track is loaded
                if (playlist.length === 1 && !deck.left.currentTrack) {
                    loadTrackToDeck(track.id, 'left');
                }
                
                // Auto-load second track to right deck if no track is loaded
                if (playlist.length === 2 && !deck.right.currentTrack) {
                    loadTrackToDeck(track.id, 'right');
                }
            });
            
            audio.addEventListener('error', () => {
                showNotification(`Error loading ${file.name}`, 'error');
            });
        });
        
        // Reset file input
        fileInput.value = '';
    }
    
    /**
     * Add track to UI playlist
     * @param {Object} track - Track data
     */
    function addTrackToList(track) {
        const li = document.createElement('li');
        
        const trackInfo = document.createElement('div');
        trackInfo.className = 'track-info';
        trackInfo.innerHTML = `
            <div class="track-name" title="${track.name}">${track.displayName}</div>
            <div class="track-duration">${track.duration}</div>
        `;
        
        const deckButtons = document.createElement('div');
        deckButtons.className = 'deck-buttons';
        
        const leftButton = document.createElement('button');
        leftButton.className = 'deck-button';
        leftButton.setAttribute('data-deck', 'left');
        leftButton.setAttribute('data-track-id', track.id);
        leftButton.textContent = 'Deck 1';
        leftButton.addEventListener('click', () => {
            loadTrackToDeck(track.id, 'left');
        });
        
        const rightButton = document.createElement('button');
        rightButton.className = 'deck-button';
        rightButton.setAttribute('data-deck', 'right');
        rightButton.setAttribute('data-track-id', track.id);
        rightButton.textContent = 'Deck 2';
        rightButton.addEventListener('click', () => {
            loadTrackToDeck(track.id, 'right');
        });
        
        deckButtons.appendChild(leftButton);
        deckButtons.appendChild(rightButton);
        
        li.appendChild(trackInfo);
        li.appendChild(deckButtons);
        trackList.appendChild(li);
        
        // Scroll to bottom to show newly added track
        trackList.scrollTop = trackList.scrollHeight;
    }
    
    /**
     * Load a track to a deck
     * @param {number} trackId - Track ID in the playlist
     * @param {string} deckName - 'left' or 'right'
     */
    function loadTrackToDeck(trackId, deckName) {
        const track = playlist.find(t => t.id === trackId);
        if (!track) return;
        
        const currentDeck = deck[deckName];
        
        // Ensure audio context is initialized if not already
        if (!audioContext) {
            initAudioContext();
        }
        
        // Stop current track if playing
        if (currentDeck.isPlaying) {
            currentDeck.player.pause();
            currentDeck.isPlaying = false;
        }
        
        // If this is the first load for this deck, connect audio chain
        const isFirstLoad = !currentDeck.source && audioContext;
        
        // Update deck state
        currentDeck.currentTrack = track;
        currentDeck.cuePoint = 0;
        currentDeck.bpm = 120.0; // Default BPM
        currentDeck.originalBpm = 0; // Reset original BPM (will be set by detection)
        
        // Update player
        currentDeck.player.src = track.url;
        currentDeck.player.volume = currentDeck.volume;
        currentDeck.player.playbackRate = currentDeck.speed;
        
        // Connect audio processing if first load
        if (isFirstLoad) {
            try {
                connectAudio(deckName);
            } catch (error) {
                console.error(`Error connecting audio processing for ${deckName} deck:`, error);
            }
        }
        
        // Update UI
        if (deckName === 'left') {
            leftNowPlaying.textContent = track.displayName;
            leftPlay.innerHTML = '▶️';
            leftBpmValue.textContent = '120.0';
            leftBpmInput.value = '120.0';
            applyVolume('left', leftVolume.value);
        } else {
            rightNowPlaying.textContent = track.displayName;
            rightPlay.innerHTML = '▶️';
            rightBpmValue.textContent = '120.0';
            rightBpmInput.value = '120.0';
            applyVolume('right', rightVolume.value);
        }
        
        showNotification(`Loaded "${track.displayName}" to Deck ${deckName === 'left' ? '1' : '2'}`, 'info');
    }
    
    /**
     * Toggle play/pause on a deck
     * @param {string} deckName - 'left' or 'right'
     */
    function togglePlayPause(deckName) {
        const currentDeck = deck[deckName];
        const playButton = deckName === 'left' ? leftPlay : rightPlay;
        
        if (!currentDeck.currentTrack) {
            showNotification(`No track loaded on Deck ${deckName === 'left' ? '1' : '2'}`, 'error');
            return;
        }
        
        // Try to resume audio context if it's suspended
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        if (currentDeck.isPlaying) {
            currentDeck.player.pause();
            currentDeck.isPlaying = false;
            playButton.innerHTML = '▶️';
        } else {
            // If at cue point, start from there
            if (currentDeck.player.currentTime === currentDeck.cuePoint) {
                currentDeck.player.play();
            } else {
                // If track ended, restart from beginning or cue point
                if (currentDeck.player.ended) {
                    currentDeck.player.currentTime = currentDeck.cuePoint;
                }
                currentDeck.player.play();
            }
            currentDeck.isPlaying = true;
            playButton.innerHTML = '⏸️';
        }
    }
    
    /**
     * Set cue point on a deck
     * @param {string} deckName - 'left' or 'right'
     */
    function setCuePoint(deckName) {
        const currentDeck = deck[deckName];
        
        if (!currentDeck.currentTrack) {
            showNotification(`No track loaded on Deck ${deckName === 'left' ? '1' : '2'}`, 'error');
            return;
        }
        
        currentDeck.cuePoint = currentDeck.player.currentTime;
        showNotification(`Cue point set at ${formatTime(currentDeck.cuePoint)} on Deck ${deckName === 'left' ? '1' : '2'}`, 'info');
    }
    
    /**
     * Stop track and return to cue point
     * @param {string} deckName - 'left' or 'right'
     */
    function stopTrack(deckName) {
        const currentDeck = deck[deckName];
        const playButton = deckName === 'left' ? leftPlay : rightPlay;
        
        if (!currentDeck.currentTrack) {
            showNotification(`No track loaded on Deck ${deckName === 'left' ? '1' : '2'}`, 'error');
            return;
        }
        
        currentDeck.player.pause();
        currentDeck.player.currentTime = currentDeck.cuePoint;
        currentDeck.isPlaying = false;
        playButton.innerHTML = '▶️';
    }
    
    /**
     * Apply volume to a deck
     * @param {string} deckName - 'left' or 'right'
     * @param {number} value - Volume value (0-100)
     */
    function applyVolume(deckName, value) {
        const volumeValue = value / 100;
        const currentDeck = deck[deckName];
        
        currentDeck.volume = volumeValue;
        
        // Apply directly to player (fallback)
        currentDeck.player.volume = volumeValue * getCrossfadeGain(deckName);
        
        // Also apply to gain node if using Web Audio API
        if (currentDeck.gainNode) {
            try {
                currentDeck.gainNode.gain.value = volumeValue * getCrossfadeGain(deckName);
            } catch(e) {
                console.warn('Error setting gain:', e);
            }
        }
    }
    
    /**
     * Apply playback speed to a deck and update BPM accordingly
     * @param {string} deckName - 'left' or 'right'
     * @param {number} value - Speed value (50-150)
     */
    function applySpeed(deckName, value) {
        const speedValue = value / 100;
        const currentDeck = deck[deckName];
        const bpmValue = deckName === 'left' ? leftBpmValue : rightBpmValue;
        const bpmInput = deckName === 'left' ? leftBpmInput : rightBpmInput;
        
        // Update speed
        currentDeck.speed = speedValue;
        currentDeck.player.playbackRate = speedValue;
        
        // Update BPM based on speed if we have a valid original BPM
        if (currentDeck.originalBpm > 0) {
            // Calculate new BPM based on speed ratio
            currentDeck.bpm = Math.round(currentDeck.originalBpm * speedValue * 10) / 10;
            
            // Update UI
            bpmValue.textContent = currentDeck.bpm.toFixed(1);
            bpmInput.value = currentDeck.bpm.toFixed(1);
        }
    }
    
    /**
     * Apply crossfader
     * @param {number} value - Crossfader value (0-100)
     */
    function applyCrossfade(value) {
        const crossfadeValue = value / 100;
        crossfaderValue.textContent = `${value}%`;
        
        // Apply crossfade to both decks
        applyVolume('left', leftVolume.value);
        applyVolume('right', rightVolume.value);
        
        // Update EQs based on new crossfader position
        applyEQ('low', document.getElementById('low-slider-handle').getAttribute('data-value') || 50);
        applyEQ('mid', document.getElementById('mid-slider-handle').getAttribute('data-value') || 50);
        applyEQ('high', document.getElementById('high-slider-handle').getAttribute('data-value') || 50);
    }
    
    /**
     * Get gain for a deck based on crossfader position
     * @param {string} deckName - 'left' or 'right'
     * @returns {number} - Gain value (0-1)
     */
    function getCrossfadeGain(deckName) {
        const crossfadeValue = crossfader.value / 100;
        
        // Equal power crossfade curve
        if (deckName === 'left') {
            return Math.cos(crossfadeValue * Math.PI / 2);
        } else {
            return Math.cos((1 - crossfadeValue) * Math.PI / 2);
        }
    }
    
    /**
     * Apply EQ
     * @param {string} band - 'low', 'mid', or 'high'
     * @param {number} value - EQ value (0-100)
     */
    function applyEQ(band, value) {
        const eqValue = value / 100;
        const dbValue = (eqValue * 24) - 12; // Convert to -12dB to +12dB range
        
        // Update display
        switch (band) {
            case 'low':
                eqLowValue.textContent = `${dbValue.toFixed(1)} dB`;
                break;
            case 'mid':
                eqMidValue.textContent = `${dbValue.toFixed(1)} dB`;
                break;
            case 'high':
                eqHighValue.textContent = `${dbValue.toFixed(1)} dB`;
                break;
        }
        
        // Apply EQ to both decks if they have filters
        if (!audioContext) return; // Skip if audio context not initialized
        
        // Apply to left deck
        if (deck.left.filters && deck.left.filters[band]) {
            try {
                // Get the crossfader position to determine which deck gets more EQ effect
                const crossfadeValue = crossfader.value / 100;
                const leftWeight = Math.cos(crossfadeValue * Math.PI / 2);
                deck.left.filters[band].gain.value = dbValue * leftWeight;
            } catch(e) {
                console.warn(`Error applying ${band} EQ to left deck:`, e);
            }
        }
        
        // Apply to right deck
        if (deck.right.filters && deck.right.filters[band]) {
            try {
                // Get the crossfader position to determine which deck gets more EQ effect
                const crossfadeValue = crossfader.value / 100;
                const rightWeight = Math.cos((1 - crossfadeValue) * Math.PI / 2);
                deck.right.filters[band].gain.value = dbValue * rightWeight;
            } catch(e) {
                console.warn(`Error applying ${band} EQ to right deck:`, e);
            }
        }
    }
    
    /**
     * Detect BPM for a deck
     * @param {string} deckName - 'left' or 'right'
     */
    async function detectBPM(deckName) {
        const currentDeck = deck[deckName];
        const bpmValueElement = deckName === 'left' ? leftBpmValue : rightBpmValue;
        const bpmDetectButton = deckName === 'left' ? leftBpmDetect : rightBpmDetect;
        const bpmInput = deckName === 'left' ? leftBpmInput : rightBpmInput;
        
        if (!currentDeck.currentTrack) {
            showNotification(`No track loaded on Deck ${deckName === 'left' ? '1' : '2'}`, 'error');
            return;
        }
        
        if (!audioContext) {
            try {
                initAudioContext();
            } catch (error) {
                showNotification('Could not initialize audio processing', 'error');
                return;
            }
        }
        
        if (currentDeck.bpmDetecting) {
            showNotification('BPM detection already in progress', 'info');
            return;
        }
        
        try {
            // Update UI state
            currentDeck.bpmDetecting = true;
            bpmDetectButton.classList.add('active');
            bpmDetectButton.innerHTML = '<span>Detecting...</span>';
            bpmValueElement.textContent = '...';
            showNotification(`Detecting BPM for "${currentDeck.currentTrack.displayName}"...`, 'info');
            
            // Store playback state
            const wasPlaying = currentDeck.isPlaying;
            
            // Create BPM detector if not already available
            if (!bpmDetector) {
                bpmDetector = new BPMDetector(audioContext);
            }
            
            // Detect BPM
            const detectedBpm = await bpmDetector.detectBPM(
                currentDeck.player, 
                progress => {
                    // Update progress in UI
                    bpmValueElement.textContent = `${progress.toFixed(0)}%`;
                }
            );
            
            // Update deck state with detected BPM
            currentDeck.bpm = detectedBpm;
            currentDeck.originalBpm = detectedBpm;
            
            // Update UI
            bpmValueElement.textContent = `${detectedBpm.toFixed(1)}`;
            bpmInput.value = detectedBpm.toFixed(1);
            
            showNotification(`BPM detected: ${detectedBpm.toFixed(1)}`, 'success');
        } catch (error) {
            console.error('BPM detection error:', error);
            showNotification(`BPM detection failed. ${error.message || 'Try a different section of the track.'}`, 'error');
            
            // Reset BPM display to previous value
            bpmValueElement.textContent = currentDeck.bpm.toFixed(1);
        } finally {
            // Reset UI state
            currentDeck.bpmDetecting = false;
            bpmDetectButton.classList.remove('active');
            bpmDetectButton.innerHTML = '<span>Detect</span>';
        }
    }
    
    /**
     * Set BPM manually for a deck
     * @param {string} deckName - 'left' or 'right'
     */
    function setBPM(deckName) {
        const currentDeck = deck[deckName];
        const bpmInput = deckName === 'left' ? leftBpmInput : rightBpmInput;
        const bpmValue = deckName === 'left' ? leftBpmValue : rightBpmValue;
        const speedSlider = deckName === 'left' ? leftSpeed : rightSpeed;
        
        if (!currentDeck.currentTrack) {
            showNotification(`No track loaded on Deck ${deckName === 'left' ? '1' : '2'}`, 'error');
            return;
        }
        
        // Get BPM from input and validate
        let newBpm = parseFloat(bpmInput.value);
        
        // Validate BPM range
        if (isNaN(newBpm) || newBpm < 60 || newBpm > 200) {
            showNotification('BPM must be between 60 and 200', 'error');
            bpmInput.value = currentDeck.bpm.toFixed(1);
            return;
        }
        
        // If no original BPM is set (first time), use this as original
        if (currentDeck.originalBpm <= 0) {
            currentDeck.originalBpm = newBpm;
            currentDeck.bpm = newBpm;
            bpmValue.textContent = newBpm.toFixed(1);
            showNotification(`BPM set to ${newBpm.toFixed(1)}`, 'success');
            return;
        }
        
        // Calculate new speed based on BPM ratio
        const speedRatio = newBpm / currentDeck.originalBpm;
        
        // Clamp speed between 50% and 150%
        const newSpeed = Math.min(Math.max(50, speedRatio * 100), 150);
        
        // Update speed slider
        speedSlider.value = newSpeed;
        
        // Apply speed (this will also update the BPM display)
        applySpeed(deckName, newSpeed);
        
        showNotification(`BPM set to ${newBpm.toFixed(1)}`, 'success');
    }
    
    /**
     * Synchronize BPM between decks
     * @param {string} sourceDeck - Source deck ('left' or 'right')
     * @param {string} targetDeck - Target deck ('left' or 'right')
     */
    function syncBPM(sourceDeck, targetDeck) {
        const source = deck[sourceDeck];
        const target = deck[targetDeck];
        
        if (!source.currentTrack) {
            showNotification(`No track loaded on source Deck ${sourceDeck === 'left' ? '1' : '2'}`, 'error');
            return;
        }
        
        if (!target.currentTrack) {
            showNotification(`No track loaded on target Deck ${targetDeck === 'left' ? '1' : '2'}`, 'error');
            return;
        }
        
        if (source.bpm <= 0) {
            showNotification(`Source deck BPM not detected or set`, 'error');
            return;
        }
        
        if (target.originalBpm <= 0) {
            // If target has no original BPM, just set it
            target.originalBpm = target.bpm > 0 ? target.bpm : 120.0;
        }
        
        // Set target BPM input to match source BPM
        const targetBpmInput = targetDeck === 'left' ? leftBpmInput : rightBpmInput;
        targetBpmInput.value = source.bpm.toFixed(1);
        
        // Apply BPM to target deck
        setBPM(targetDeck);
        
        showNotification(`Deck ${targetDeck === 'left' ? '1' : '2'} synced to ${source.bpm.toFixed(1)} BPM`, 'success');
    }
    
    /**
     * Validate BPM input and format to one decimal place
     * @param {HTMLInputElement} input - BPM input element
     */
    function validateBpmInput(input) {
        let value = parseFloat(input.value);
        
        if (isNaN(value)) {
            value = 120.0;
        } else {
            value = Math.min(Math.max(60.0, value), 200.0);
        }
        
        input.value = value.toFixed(1);
    }
    
    /**
     * Format time in seconds to MM:SS format
     * @param {number} seconds - Time in seconds
     * @returns {string} - Formatted time
     */
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    
    /**
     * Show notification
     * @param {string} message - Notification message
     * @param {string} type - 'info', 'success', or 'error'
     */
    function showNotification(message, type = 'info') {
        const notifications = document.getElementById('notifications');
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        notifications.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(50px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
    
    /**
     * Setup custom EQ sliders
     */
    function setupCustomEQSliders() {
        const sliders = {
            low: {
                container: document.getElementById('low-slider-container'),
                handle: document.getElementById('low-slider-handle'),
                fill: document.getElementById('low-slider-fill'),
                value: document.getElementById('eq-low-value')
            },
            mid: {
                container: document.getElementById('mid-slider-container'),
                handle: document.getElementById('mid-slider-handle'),
                fill: document.getElementById('mid-slider-fill'),
                value: document.getElementById('eq-mid-value')
            },
            high: {
                container: document.getElementById('high-slider-container'),
                handle: document.getElementById('high-slider-handle'),
                fill: document.getElementById('high-slider-fill'),
                value: document.getElementById('eq-high-value')
            }
        };
        
        // Set initial values (middle position = 0dB)
        Object.keys(sliders).forEach(band => {
            setupSlider(sliders[band], band);
        });
        
        function setupSlider(slider, band) {
            let isDragging = false;
            let containerRect;
            
            // Get initial container dimensions once
            function updateContainerRect() {
                containerRect = slider.container.getBoundingClientRect();
            }
            
            // Initialize to middle position (0dB)
            slider.handle.style.top = '50%';
            slider.fill.style.height = '50%';
            slider.handle.setAttribute('data-value', '50'); // Store normalized value (50 = 0dB)
            
            // Call once at setup
            updateContainerRect();
            
            // Update on window resize
            window.addEventListener('resize', updateContainerRect);
            
            slider.handle.addEventListener('mousedown', startDrag);
            slider.container.addEventListener('mousedown', containerClick);
            
            function startDrag(e) {
                // Prevent text selection and default behaviors
                e.preventDefault();
                e.stopPropagation();
                
                // Update container rect before drag starts
                updateContainerRect();
                
                isDragging = true;
                
                // Use event listeners on document for better drag handling
                document.addEventListener('mousemove', handleDrag);
                document.addEventListener('mouseup', stopDrag);
            }
            
            function containerClick(e) {
                // If clicking the container but not the handle, move handle to clicked position
                if (e.target !== slider.handle) {
                    e.preventDefault();
                    updateContainerRect();
                    moveHandleToPosition(e.clientY);
                    updateSliderValue();
                }
            }
            
            function handleDrag(e) {
                if (isDragging) {
                    // Prevent any possible text selection during drag
                    e.preventDefault();
                    moveHandleToPosition(e.clientY);
                    updateSliderValue();
                }
            }
            
            function moveHandleToPosition(clientY) {
                // Calculate position relative to container
                let position = clientY - containerRect.top;
                
                // Constrain to container bounds
                position = Math.max(0, Math.min(position, containerRect.height));
                
                // Convert to percentage (0% = top, 100% = bottom)
                const percentage = (position / containerRect.height) * 100;
                
                // Invert because we want 0% to be bottom, 100% to be top
                const invertedPercentage = 100 - percentage;
                
                // Position handle - use transform for smoother performance
                slider.handle.style.transform = `translate(-50%, -50%)`;
                slider.handle.style.top = `${percentage}%`;
                
                // Update fill with a direct height setting
                slider.fill.style.height = `${invertedPercentage}%`;
                
                // Store value for later use
                slider.handle.setAttribute('data-value', invertedPercentage.toString());
            }
            
            function updateSliderValue() {
                const normalized = parseFloat(slider.handle.getAttribute('data-value'));
                
                // Convert to EQ value (-12dB to +12dB, with middle=0dB)
                const eqValue = ((normalized / 100) * 24) - 12;
                
                // Update display
                slider.value.textContent = `${eqValue.toFixed(1)} dB`;
                
                // Call the audio processing function
                applyEQ(band, normalized);
            }
            
            function stopDrag() {
                isDragging = false;
                document.removeEventListener('mousemove', handleDrag);
                document.removeEventListener('mouseup', stopDrag);
            }
            
            // Add touch support for mobile devices
            slider.handle.addEventListener('touchstart', handleTouchStart, { passive: false });
            slider.container.addEventListener('touchstart', handleContainerTouchStart, { passive: false });
            
            function handleTouchStart(e) {
                // Prevent scrolling
                e.preventDefault();
                updateContainerRect();
                isDragging = true;
                document.addEventListener('touchmove', handleTouchMove, { passive: false });
                document.addEventListener('touchend', handleTouchEnd);
            }
            
            function handleContainerTouchStart(e) {
                if (e.target !== slider.handle) {
                    e.preventDefault();
                    updateContainerRect();
                    const touch = e.touches[0];
                    moveHandleToPosition(touch.clientY);
                    updateSliderValue();
                }
            }
            
            function handleTouchMove(e) {
                if (isDragging) {
                    e.preventDefault();
                    const touch = e.touches[0];
                    moveHandleToPosition(touch.clientY);
                    updateSliderValue();
                }
            }
            
            function handleTouchEnd() {
                isDragging = false;
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
            }
        }
    }
});