/**
 * Improved BPM Detection Module
 * Implementation for detecting beats per minute in audio tracks with better isolation
 */

class BPMDetector {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.bufferSize = 2048;
        this.minBeat = 60;  // 60 BPM minimum
        this.maxBeat = 200; // 200 BPM maximum
    }

    /**
     * Detect BPM from an audio source
     * @param {HTMLAudioElement} audioElement - Original audio element (won't be modified)
     * @param {Function} progressCallback - Callback for progress updates (0-100)
     * @returns {Promise<number>} - Detected BPM
     */
    async detectBPM(audioElement, progressCallback = null) {
        return new Promise(async (resolve, reject) => {
            if (!this.audioContext) {
                reject(new Error('Audio context not initialized'));
                return;
            }

            // Create a clone of the audio element to prevent conflicts with existing audio routing
            const tempAudio = new Audio();
            let tempSource = null;
            let analyzer = null;
            
            try {
                // Store original state for reference
                const originalSrc = audioElement.src;
                const originalTime = audioElement.currentTime;
                
                // Set up temporary audio
                tempAudio.crossOrigin = "anonymous";
                tempAudio.src = originalSrc;
                tempAudio.volume = 0; // Mute during analysis
                
                // Wait for the metadata to load before continuing
                await new Promise((resolve) => {
                    if (tempAudio.readyState >= 2) { // HAVE_CURRENT_DATA or higher
                        resolve();
                    } else {
                        tempAudio.addEventListener('loadedmetadata', resolve, { once: true });
                        tempAudio.addEventListener('error', (e) => reject(new Error(`Error loading audio: ${e.message}`)), { once: true });
                    }
                });
                
                // Set playback position to 25% of track for better analysis
                const duration = tempAudio.duration || 0;
                if (duration > 0) {
                    // Start around 25% into the song, but use original time if it's already past that
                    tempAudio.currentTime = Math.max(duration * 0.25, Math.min(originalTime, duration * 0.75));
                }
                
                // Set up audio analysis chain
                tempSource = this.audioContext.createMediaElementSource(tempAudio);
                analyzer = this.audioContext.createAnalyser();
                analyzer.fftSize = this.bufferSize;
                tempSource.connect(analyzer);
                
                // Connect to destination with zero gain to properly process audio without sound
                const silentGain = this.audioContext.createGain();
                silentGain.gain.value = 0;
                analyzer.connect(silentGain);
                silentGain.connect(this.audioContext.destination);
                
                // Begin playback for analysis
                await tempAudio.play();
                
                // Data for beat detection
                const beats = [];
                const dataArray = new Float32Array(analyzer.fftSize);
                let lastBeatTime = 0;
                let energyThreshold = 0;
                let samplesProcessed = 0;
                let targetSamples = Math.min(duration, 12) * 4; // Analyze up to 12 seconds
                
                // Initial detection loop
                const detectBeats = async () => {
                    return new Promise((resolve) => {
                        const detector = () => {
                            // Get audio data
                            analyzer.getFloatTimeDomainData(dataArray);
                            
                            // Calculate energy (how "loud" the current frame is)
                            let energy = 0;
                            for (let i = 0; i < dataArray.length; i++) {
                                energy += Math.abs(dataArray[i]);
                            }
                            energy /= dataArray.length;
                            
                            // First frame setup - establish initial threshold
                            if (energyThreshold === 0) {
                                energyThreshold = energy * 1.5;
                            } else {
                                // Dynamic threshold that follows the audio with some inertia
                                energyThreshold = 0.85 * energyThreshold + 0.15 * energy;
                            }
                            
                            // Detect beat (when energy spikes above threshold)
                            const now = this.audioContext.currentTime;
                            if (energy > energyThreshold * 1.2 && now - lastBeatTime > 0.3) {
                                beats.push(now);
                                lastBeatTime = now;
                            }
                            
                            // Update progress
                            samplesProcessed++;
                            if (progressCallback && samplesProcessed % 10 === 0) {
                                progressCallback(Math.min(100, (samplesProcessed / targetSamples) * 100));
                            }
                            
                            // Continue sampling or finish
                            if (samplesProcessed < targetSamples && 
                                tempAudio.currentTime < duration * 0.75 && 
                                !tempAudio.paused && 
                                !tempAudio.ended) {
                                requestAnimationFrame(detector);
                            } else {
                                resolve();
                            }
                        };
                        
                        // Start detection loop
                        detector();
                    });
                };
                
                // Run detection
                await detectBeats();
                
                // Clean up resources
                tempAudio.pause();
                silentGain.disconnect();
                analyzer.disconnect();
                tempSource.disconnect();
                
                // Calculate BPM from collected beats
                const bpm = this.calculateBPM(beats);
                
                // Return result with confidence measure
                resolve(bpm);
                
            } catch (error) {
                console.error("BPM detection error:", error);
                
                // Ensure cleanup even in error case
                if (tempSource) {
                    try { tempSource.disconnect(); } catch (e) {}
                }
                if (analyzer) {
                    try { analyzer.disconnect(); } catch (e) {}
                }
                try { tempAudio.pause(); } catch (e) {}
                
                // If we were able to collect some beats, try to salvage a result
                // otherwise reject with error
                reject(error);
            }
        });
    }
    
    /**
     * Calculate BPM from beat times using multiple techniques for better accuracy
     * @param {Array<number>} beats - Array of beat timestamps
     * @returns {number} - Detected BPM
     */
    calculateBPM(beats) {
        if (beats.length < 4) {
            return 120; // Default if not enough beats detected
        }
        
        // Calculate intervals between beats
        const intervals = [];
        for (let i = 1; i < beats.length; i++) {
            intervals.push(beats[i] - beats[i-1]);
        }
        
        // Use median filtering to eliminate outliers
        const sortedIntervals = [...intervals].sort((a, b) => a - b);
        const medianInterval = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
        
        // Filter intervals that are within a reasonable range of the median
        // This eliminates extreme outliers while keeping valid data
        const validIntervals = intervals.filter(interval => 
            interval >= medianInterval * 0.5 && 
            interval <= medianInterval * 1.5
        );
        
        if (validIntervals.length === 0) {
            return 120; // Default if all intervals were outliers
        }
        
        // Calculate average interval
        const sum = validIntervals.reduce((a, b) => a + b, 0);
        const avgInterval = sum / validIntervals.length;
        
        // Convert to BPM
        let bpm = 60 / avgInterval;
        
        // Check for half/double tempo and correct
        if (bpm < this.minBeat && bpm * 2 <= this.maxBeat) {
            bpm *= 2; // Double if too slow
        } else if (bpm > this.maxBeat && bpm / 2 >= this.minBeat) {
            bpm /= 2; // Halve if too fast
        }
        
        // Ensure BPM is within valid range
        bpm = Math.max(this.minBeat, Math.min(this.maxBeat, bpm));
        
        // Round to one decimal place
        return Math.round(bpm * 10) / 10;
    }
}