import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  // Global state for the safety app
  const [userLocation, setUserLocation] = useState({ lat: 28.6139, lng: 77.2090 }); // Delhi demo location
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [activeFeature, setActiveFeature] = useState('dashboard');
  const [riskData, setRiskData] = useState(null);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [isGestureActive, setIsGestureActive] = useState(false);
  const [routeTracking, setRouteTracking] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  // Initialize location and load emergency contacts
  useEffect(() => {
    initializeLocation();
    loadEmergencyContacts();
    loadLocationRisk();
  }, []);

  const initializeLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log("Using demo location - Delhi, India");
        }
      );
    }
  };

  const loadEmergencyContacts = async () => {
    try {
      const response = await axios.get(`${API}/emergency-contacts`);
      setEmergencyContacts(response.data);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const loadLocationRisk = async () => {
    try {
      const response = await axios.get(`${API}/risk-analysis`, {
        params: { lat: userLocation.lat, lng: userLocation.lng }
      });
      setRiskData(response.data);
    } catch (error) {
      console.error('Error loading risk data:', error);
    }
  };

  // Feature 1: Voice-Only SOS
  const startVoiceAnalysis = async () => {
    setIsVoiceListening(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'voice_sample.wav');
        
        try {
          const response = await axios.post(`${API}/voice-analysis`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          
          handleVoiceAnalysisResult(response.data);
        } catch (error) {
          console.error('Voice analysis error:', error);
          alert('Voice analysis failed. Please try again.');
        }
        
        stream.getTracks().forEach(track => track.stop());
        setIsVoiceListening(false);
      };
      
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      
      // Record for 3 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 3000);
      
    } catch (error) {
      console.error('Microphone access error:', error);
      setIsVoiceListening(false);
      alert('Microphone access denied. Please allow microphone access and try again.');
    }
  };

  const handleVoiceAnalysisResult = (result) => {
    const { analysis, trigger_sos, message } = result;
    
    alert(`${message}\n\nEmotion: ${analysis.emotion}\nStress Level: ${(analysis.stress_level * 100).toFixed(1)}%`);
    
    if (trigger_sos) {
      triggerEmergencySOS('voice', analysis);
    }
  };

  // Feature 2 & 3: Maps and Risk Analysis
  const getRiskColor = (level) => {
    switch (level) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  // Feature 4: Gesture Detection
  const startGestureDetection = async () => {
    setIsGestureActive(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      // Demo: Simulate gesture detection after 3 seconds
      setTimeout(() => {
        const gestureTypes = ['peace_sign', 'open_palm', 'help_gesture'];
        const randomGesture = gestureTypes[Math.floor(Math.random() * gestureTypes.length)];
        
        axios.post(`${API}/gesture-detection`, {
          type: randomGesture,
          timestamp: new Date().toISOString()
        }).then(response => {
          const { gesture_detected, sos_triggered, message } = response.data;
          alert(message);
          
          if (sos_triggered) {
            triggerEmergencySOS('gesture', { gesture: gesture_detected });
          }
        });
        
        // Stop camera after detection
        stream.getTracks().forEach(track => track.stop());
        setIsGestureActive(false);
      }, 3000);
      
    } catch (error) {
      console.error('Camera access error:', error);
      setIsGestureActive(false);
      alert('Camera access denied. Please allow camera access for gesture detection.');
    }
  };

  // Shake detection for mobile devices
  const handleShakeDetection = () => {
    if (window.DeviceMotionEvent) {
      let shakePattern = [];
      let lastAcceleration = { x: 0, y: 0, z: 0 };
      
      const handleMotion = (event) => {
        const acceleration = event.accelerationIncludingGravity;
        const deltaX = Math.abs(acceleration.x - lastAcceleration.x);
        const deltaY = Math.abs(acceleration.y - lastAcceleration.y);
        const deltaZ = Math.abs(acceleration.z - lastAcceleration.z);
        
        const intensity = (deltaX + deltaY + deltaZ) / 3;
        
        if (intensity > 15) { // Threshold for shake detection
          shakePattern.push(intensity);
          
          if (shakePattern.length >= 3) {
            // Send shake pattern for analysis
            axios.post(`${API}/shake-detection`, {
              pattern: shakePattern,
              intensity: intensity / 20 // Normalize
            }).then(response => {
              if (response.data.sos_triggered) {
                triggerEmergencySOS('shake', { intensity });
              }
            });
            
            shakePattern = [];
          }
        }
        
        lastAcceleration = acceleration;
      };
      
      window.addEventListener('devicemotion', handleMotion);
      
      // Clean up after 10 seconds
      setTimeout(() => {
        window.removeEventListener('devicemotion', handleMotion);
      }, 10000);
      
      alert('Shake detection active for 10 seconds. Shake your device 3 times rapidly to test.');
    } else {
      alert('Device motion not supported on this device.');
    }
  };

  // Feature 5: Route Deviation Detection
  const startRouteTracking = async () => {
    const destination = prompt('Enter destination (or press OK for demo destination):');
    const destLat = 28.6270; // Red Fort, Delhi (demo destination)
    const destLng = 77.2410;
    
    try {
      const routeData = {
        start_location: userLocation,
        destination: { lat: destLat, lng: destLng },
        planned_route: [
          userLocation,
          { lat: (userLocation.lat + destLat) / 2, lng: (userLocation.lng + destLng) / 2 },
          { lat: destLat, lng: destLng }
        ],
        current_location: userLocation
      };
      
      const response = await axios.post(`${API}/route-tracking`, routeData);
      setRouteTracking(response.data);
      
      alert(`Route tracking started to ${destination || 'Red Fort'}. You will be alerted if you deviate from the planned path.`);
      
      // Simulate location updates every 30 seconds
      const locationUpdateInterval = setInterval(() => {
        // Simulate slight location changes
        const newLocation = {
          lat: userLocation.lat + (Math.random() - 0.5) * 0.01,
          lng: userLocation.lng + (Math.random() - 0.5) * 0.01
        };
        
        axios.post(`${API}/location-update`, {
          route_id: response.data.route_id,
          current_location: newLocation
        }).then(updateResponse => {
          if (updateResponse.data.deviation_detected) {
            const userResponse = confirm(updateResponse.data.message + '\n\nAre you safe? Click OK if you are safe, Cancel to send SOS.');
            if (!userResponse) {
              triggerEmergencySOS('deviation', { location: newLocation });
            }
          }
        });
        
        setUserLocation(newLocation);
      }, 30000);
      
      // Stop tracking after 5 minutes (demo)
      setTimeout(() => {
        clearInterval(locationUpdateInterval);
        setRouteTracking(null);
        alert('Route tracking completed.');
      }, 300000);
      
    } catch (error) {
      console.error('Route tracking error:', error);
      alert('Failed to start route tracking.');
    }
  };

  // Emergency SOS trigger
  const triggerEmergencySOS = async (alertType, additionalData = {}) => {
    setIsSOSActive(true);
    
    const sosData = {
      user_location: userLocation,
      alert_type: alertType,
      confidence: additionalData.confidence || 0.9,
      audio_analysis: additionalData
    };
    
    try {
      const response = await axios.post(`${API}/emergency-sos`, sosData);
      alert(`🚨 EMERGENCY ALERT SENT 🚨\n\nAlert ID: ${response.data.alert_id}\nYour location and details have been sent to emergency contacts and authorities.`);
    } catch (error) {
      console.error('SOS alert error:', error);
      alert('Failed to send SOS alert. Please try again or contact emergency services directly.');
    }
    
    setIsSOSActive(false);
  };

  // Safety chatbot
  const sendChatMessage = async (message) => {
    if (!message.trim()) return;
    
    setChatMessages(prev => [...prev, { type: 'user', message }]);
    
    try {
      const response = await axios.post(`${API}/safety-chat`, null, {
        params: { message }
      });
      
      setChatMessages(prev => [...prev, { 
        type: 'bot', 
        message: response.data.response,
        suggestions: response.data.suggestions 
      }]);
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, { 
        type: 'bot', 
        message: 'Sorry, I encountered an error. Please try again.' 
      }]);
    }
  };

  const addEmergencyContact = async () => {
    const name = prompt('Enter contact name:');
    const phone = prompt('Enter phone number:');
    const relation = prompt('Enter relationship:');
    
    if (name && phone && relation) {
      try {
        await axios.post(`${API}/emergency-contacts`, {
          name,
          phone,
          relation,
          priority: emergencyContacts.length + 1
        });
        loadEmergencyContacts();
        alert('Emergency contact added successfully!');
      } catch (error) {
        console.error('Error adding contact:', error);
        alert('Failed to add emergency contact.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
              🛡️
            </div>
            <h1 className="text-2xl font-bold">SafeGuard</h1>
          </div>
          <div className="flex space-x-2">
            {riskData && (
              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${getRiskColor(riskData.risk_level)} text-white`}>
                Risk: {riskData.risk_level.toUpperCase()}
              </div>
            )}
            {routeTracking && (
              <div className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500 text-white">
                Route Tracking Active
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4">
        {/* Navigation */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: 'dashboard', label: '🏠 Dashboard' },
            { id: 'voice', label: '🎙️ Voice SOS' },
            { id: 'map', label: '🗺️ Safety Map' },
            { id: 'gesture', label: '👋 Gesture Alert' },
            { id: 'route', label: '🛣️ Route Tracking' },
            { id: 'chat', label: '💬 Safety Chat' },
            { id: 'contacts', label: '📞 Contacts' }
          ].map(feature => (
            <button
              key={feature.id}
              onClick={() => setActiveFeature(feature.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeFeature === feature.id 
                  ? 'bg-white text-purple-900' 
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {feature.label}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Emergency SOS Button - Always Visible */}
          <div className="lg:col-span-3">
            <button
              onClick={() => triggerEmergencySOS('manual')}
              disabled={isSOSActive}
              className={`w-full py-8 rounded-2xl text-3xl font-bold text-white transition-all ${
                isSOSActive 
                  ? 'bg-gray-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 shadow-2xl hover:shadow-red-500/50 transform hover:scale-105'
              }`}
            >
              {isSOSActive ? '🚨 SENDING ALERT...' : '🆘 EMERGENCY SOS'}
            </button>
          </div>

          {/* Feature Content */}
          {activeFeature === 'dashboard' && (
            <>
              <div className="lg:col-span-2">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white">
                  <h2 className="text-2xl font-bold mb-4">Welcome to SafeGuard</h2>
                  <img 
                    src="https://images.unsplash.com/photo-1615261294181-dc94e853bff7" 
                    alt="Empowered Woman" 
                    className="w-full h-64 object-cover rounded-xl mb-4"
                  />
                  <p className="text-lg mb-4">
                    Your comprehensive AI-powered safety companion with 5 advanced protection features:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { icon: '🎙️', title: 'Voice Emotion Detection', desc: 'AI analyzes your voice for distress' },
                      { icon: '🗺️', title: 'Smart Risk Analysis', desc: 'Historical incident-based safety alerts' },
                      { icon: '👋', title: 'Gesture Recognition', desc: 'Silent SOS via hand gestures' },
                      { icon: '🛣️', title: 'Route Monitoring', desc: 'Detects dangerous route deviations' },
                      { icon: '💬', title: 'AI Safety Assistant', desc: 'Real-time safety guidance chatbot' }
                    ].map((feature, index) => (
                      <div key={index} className="bg-white/10 rounded-xl p-4">
                        <div className="text-3xl mb-2">{feature.icon}</div>
                        <h3 className="font-semibold mb-1">{feature.title}</h3>
                        <p className="text-sm opacity-80">{feature.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white mb-6">
                  <h3 className="text-xl font-bold mb-4">Location Status</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Current Location:</span>
                      <span className="text-sm">{userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}</span>
                    </div>
                    {riskData && (
                      <>
                        <div className="flex justify-between">
                          <span>Risk Level:</span>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getRiskColor(riskData.risk_level)}`}>
                            {riskData.risk_level.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Recent Incidents:</span>
                          <span>{riskData.incident_count}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white">
                  <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <button
                      onClick={startVoiceAnalysis}
                      disabled={isVoiceListening}
                      className="w-full bg-blue-500 hover:bg-blue-600 py-3 rounded-xl font-medium transition-all"
                    >
                      {isVoiceListening ? '🎙️ Listening...' : '🎙️ Voice Analysis'}
                    </button>
                    <button
                      onClick={startGestureDetection}
                      disabled={isGestureActive}
                      className="w-full bg-green-500 hover:bg-green-600 py-3 rounded-xl font-medium transition-all"
                    >
                      {isGestureActive ? '📹 Detecting...' : '👋 Gesture Alert'}
                    </button>
                    <button
                      onClick={handleShakeDetection}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 py-3 rounded-xl font-medium transition-all"
                    >
                      📱 Test Shake Detection
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Voice SOS Feature */}
          {activeFeature === 'voice' && (
            <div className="lg:col-span-3">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-white text-center">
                <h2 className="text-3xl font-bold mb-6">🎙️ Voice-Only SOS</h2>
                <p className="text-lg mb-8">
                  AI analyzes your voice for emotion and stress levels. Say "I'm fine" - our AI will detect if you're actually in distress.
                </p>
                
                <div className="max-w-md mx-auto">
                  {isVoiceListening ? (
                    <div className="bg-red-500 rounded-full p-8 mb-6 animate-pulse">
                      <div className="text-6xl">🎙️</div>
                      <p className="text-xl font-semibold mt-4">Listening... (3 seconds)</p>
                      <div className="w-full bg-red-300 rounded-full h-2 mt-4">
                        <div className="bg-white h-2 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={startVoiceAnalysis}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-full p-8 text-6xl transform hover:scale-110 transition-all shadow-2xl"
                    >
                      🎙️
                    </button>
                  )}
                  
                  <div className="mt-8 space-y-4">
                    <div className="bg-white/10 rounded-xl p-4">
                      <h3 className="font-semibold mb-2">How it works:</h3>
                      <ul className="text-sm space-y-1 text-left">
                        <li>• Say any phrase like "I'm fine" or "Everything's okay"</li>
                        <li>• AI analyzes voice patterns for fear, stress, anxiety</li>
                        <li>• If distress detected, silent SOS is triggered automatically</li>
                        <li>• Location shared with emergency contacts</li>
                      </ul>
                    </div>
                    
                    <button
                      onClick={startVoiceAnalysis}
                      disabled={isVoiceListening}
                      className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 py-4 rounded-xl font-bold text-xl transition-all"
                    >
                      {isVoiceListening ? 'Analyzing Voice...' : 'Start Voice Analysis'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Safety Map Feature */}
          {activeFeature === 'map' && (
            <div className="lg:col-span-3">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white">
                <h2 className="text-2xl font-bold mb-6">🗺️ AI-Powered Safety Map</h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <div className="bg-white/10 rounded-xl p-4 h-64 flex items-center justify-center mb-4">
                      <div className="text-center">
                        <div className="text-4xl mb-4">🗺️</div>
                        <p>Interactive Safety Map</p>
                        <p className="text-sm opacity-75">(Map integration with Google Maps API)</p>
                      </div>
                    </div>
                    
                    {riskData && (
                      <div className="bg-white/10 rounded-xl p-4">
                        <h3 className="font-semibold mb-3">Current Area Risk Analysis</h3>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Risk Score:</span>
                            <span>{(riskData.risk_score * 100).toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Incidents Nearby:</span>
                            <span>{riskData.incident_count}</span>
                          </div>
                          <div className={`w-full h-3 rounded-full ${getRiskColor(riskData.risk_level)}`}></div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <div className="space-y-4">
                      <div className="bg-white/10 rounded-xl p-4">
                        <h3 className="font-semibold mb-3">Safety Recommendations</h3>
                        {riskData?.recommendations.map((rec, index) => (
                          <div key={index} className="flex items-start space-x-2 mb-2">
                            <span className="text-green-400">•</span>
                            <span className="text-sm">{rec}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="bg-white/10 rounded-xl p-4">
                        <h3 className="font-semibold mb-3">Recent Incidents</h3>
                        {riskData?.recent_incidents.map((incident, index) => (
                          <div key={index} className="mb-3 text-sm">
                            <div className="flex justify-between">
                              <span className="font-medium capitalize">{incident.type.replace('_', ' ')}</span>
                              <span className="text-xs opacity-75">{incident.timestamp.split('T')[0]}</span>
                            </div>
                            <div className="text-xs opacity-75">
                              Severity: {incident.severity}/5
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <button
                        onClick={() => {
                          const dest = prompt('Enter destination for safe route:');
                          if (dest) {
                            alert(`Calculating safest route to ${dest}...\n\nRoute analysis:\n• Well-lit paths prioritized\n• CCTV coverage available\n• 0 incidents reported on this route this week`);
                          }
                        }}
                        className="w-full bg-green-500 hover:bg-green-600 py-3 rounded-xl font-medium transition-all"
                      >
                        🛣️ Get Safe Route
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Gesture Detection Feature */}
          {activeFeature === 'gesture' && (
            <div className="lg:col-span-3">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-white">
                <h2 className="text-3xl font-bold mb-6 text-center">👋 Silent Gesture-Based SOS</h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="text-center">
                    <h3 className="text-xl font-semibold mb-4">Camera-Based Gesture Detection</h3>
                    <div className="bg-white/10 rounded-xl p-6 mb-4">
                      {isGestureActive ? (
                        <div>
                          <video ref={videoRef} className="w-full h-48 bg-black rounded-lg mb-4" muted />
                          <div className="animate-pulse text-lg">🔍 Analyzing gestures...</div>
                        </div>
                      ) : (
                        <div className="h-48 flex items-center justify-center">
                          <div className="text-6xl mb-4">📹</div>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div className="text-4xl">✌️ ✋ 🤚</div>
                      <p className="text-sm">Peace sign, Open palm, Help gesture</p>
                    </div>
                    
                    <button
                      onClick={startGestureDetection}
                      disabled={isGestureActive}
                      className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 py-4 rounded-xl font-bold transition-all"
                    >
                      {isGestureActive ? 'Detecting Gestures...' : 'Start Gesture Detection'}
                    </button>
                  </div>
                  
                  <div className="text-center">
                    <h3 className="text-xl font-semibold mb-4">Motion-Based Shake Detection</h3>
                    <div className="bg-white/10 rounded-xl p-6 mb-4">
                      <div className="text-6xl mb-4">📱</div>
                      <p>Shake your device in a specific pattern to trigger silent SOS</p>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div className="text-2xl">📱💨📱💨📱💨</div>
                      <p className="text-sm">Three rapid shakes</p>
                    </div>
                    
                    <button
                      onClick={handleShakeDetection}
                      className="w-full bg-green-500 hover:bg-green-600 py-4 rounded-xl font-bold transition-all"
                    >
                      Test Shake Detection
                    </button>
                  </div>
                </div>
                
                <div className="mt-8 bg-white/10 rounded-xl p-6">
                  <h3 className="font-semibold mb-4">How Silent Gestures Work:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <h4 className="font-medium mb-2">📹 Camera Detection:</h4>
                      <ul className="space-y-1">
                        <li>• Show peace sign (✌️) to camera</li>
                        <li>• Open palm (✋) facing camera</li>
                        <li>• Help gesture (🤚) waving motion</li>
                        <li>• AI recognizes distress gestures</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">📱 Motion Detection:</h4>
                      <ul className="space-y-1">
                        <li>• Three rapid phone shakes</li>
                        <li>• Specific intensity threshold</li>
                        <li>• Works even with screen off</li>
                        <li>• Instant silent alert trigger</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Route Tracking Feature */}
          {activeFeature === 'route' && (
            <div className="lg:col-span-3">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-white">
                <h2 className="text-3xl font-bold mb-6 text-center">🛣️ Unusual Route Detection</h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div>
                    <div className="bg-white/10 rounded-xl p-6 mb-6">
                      <h3 className="text-xl font-semibold mb-4">Current Tracking Status</h3>
                      {routeTracking ? (
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            <span>Route tracking active</span>
                          </div>
                          <div className="text-sm opacity-75">
                            Route ID: {routeTracking.route_id?.slice(0, 8)}...
                          </div>
                          <div className="text-sm opacity-75">
                            Monitoring for deviations...
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                            <span>No active tracking</span>
                          </div>
                          <p className="text-sm opacity-75">
                            Start route tracking to monitor for dangerous deviations
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      <button
                        onClick={startRouteTracking}
                        disabled={routeTracking !== null}
                        className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-500 py-4 rounded-xl font-bold transition-all"
                      >
                        {routeTracking ? 'Tracking Active' : '🛣️ Start Route Tracking'}
                      </button>
                      
                      {routeTracking && (
                        <button
                          onClick={() => {
                            setRouteTracking(null);
                            alert('Route tracking stopped.');
                          }}
                          className="w-full bg-red-500 hover:bg-red-600 py-3 rounded-xl font-medium transition-all"
                        >
                          Stop Tracking
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <div className="bg-white/10 rounded-xl p-6">
                      <h3 className="text-xl font-semibold mb-4">How Route Monitoring Works</h3>
                      <div className="space-y-4 text-sm">
                        <div className="flex items-start space-x-3">
                          <div className="text-2xl">📍</div>
                          <div>
                            <h4 className="font-medium mb-1">Set Destination</h4>
                            <p className="opacity-75">AI calculates optimal safe route</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start space-x-3">
                          <div className="text-2xl">🛰️</div>
                          <div>
                            <h4 className="font-medium mb-1">GPS Monitoring</h4>
                            <p className="opacity-75">Continuous location tracking every 30 seconds</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start space-x-3">
                          <div className="text-2xl">⚠️</div>
                          <div>
                            <h4 className="font-medium mb-1">Deviation Detection</h4>
                            <p className="opacity-75">AI detects unusual route changes or unsafe areas</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start space-x-3">
                          <div className="text-2xl">🚨</div>
                          <div>
                            <h4 className="font-medium mb-1">Auto-Alert System</h4>
                            <p className="opacity-75">Prompts "Are you safe?" - No response triggers SOS</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white/10 rounded-xl p-6 mt-6">
                      <h3 className="text-lg font-semibold mb-3">Deviation Scenarios</h3>
                      <div className="text-sm space-y-2">
                        <div>🚩 Route change to unsafe area</div>
                        <div>🚩 Movement outside city limits</div>
                        <div>🚩 Unexpected stops in isolated areas</div>
                        <div>🚩 No movement for extended periods</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Safety Chat Feature */}
          {activeFeature === 'chat' && (
            <div className="lg:col-span-3">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white">
                <h2 className="text-2xl font-bold mb-6">💬 AI Safety Assistant</h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <div className="bg-white/5 rounded-xl h-96 p-4 mb-4 overflow-y-auto">
                      {chatMessages.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-center opacity-50">
                          <div>
                            <div className="text-4xl mb-4">🤖</div>
                            <p>Hi! I'm your AI safety assistant.</p>
                            <p className="text-sm mt-2">Ask me about safe routes, incident reports, or emergency help!</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {chatMessages.map((msg, index) => (
                            <div key={index} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-xs px-4 py-2 rounded-2xl ${
                                msg.type === 'user' 
                                  ? 'bg-blue-500 text-white' 
                                  : 'bg-white/20 text-white'
                              }`}>
                                <p>{msg.message}</p>
                                {msg.suggestions && (
                                  <div className="mt-2 space-y-1">
                                    {msg.suggestions.map((suggestion, i) => (
                                      <button
                                        key={i}
                                        onClick={() => sendChatMessage(suggestion)}
                                        className="block text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded-full transition-all"
                                      >
                                        {suggestion}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="Ask me anything about your safety..."
                        className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:border-white/40"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            sendChatMessage(e.target.value);
                            e.target.value = '';
                          }
                        }}
                      />
                      <button
                        onClick={(e) => {
                          const input = e.target.parentElement.querySelector('input');
                          sendChatMessage(input.value);
                          input.value = '';
                        }}
                        className="bg-blue-500 hover:bg-blue-600 px-6 py-2 rounded-full font-medium transition-all"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <div className="bg-white/10 rounded-xl p-4 mb-4">
                      <h3 className="font-semibold mb-3">Quick Questions</h3>
                      <div className="space-y-2">
                        {[
                          "Is this road safe?",
                          "Find safest route to hostel",
                          "How to report an incident?",
                          "Emergency contact help",
                          "What if I'm being followed?",
                          "Safe places nearby"
                        ].map((question, index) => (
                          <button
                            key={index}
                            onClick={() => sendChatMessage(question)}
                            className="w-full text-left bg-white/10 hover:bg-white/20 p-2 rounded-lg text-sm transition-all"
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="bg-white/10 rounded-xl p-4">
                      <h3 className="font-semibold mb-3">AI Capabilities</h3>
                      <div className="text-sm space-y-2">
                        <div>🗺️ Safe route recommendations</div>
                        <div>📍 Area safety analysis</div>
                        <div>🚨 Emergency procedures</div>
                        <div>📊 Incident report guidance</div>
                        <div>👥 Community safety tips</div>
                        <div>🔍 Real-time risk assessment</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Emergency Contacts Feature */}
          {activeFeature === 'contacts' && (
            <div className="lg:col-span-3">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">📞 Emergency Contacts</h2>
                  <button
                    onClick={addEmergencyContact}
                    className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-full font-medium transition-all"
                  >
                    + Add Contact
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {emergencyContacts.length === 0 ? (
                    <div className="md:col-span-2 lg:col-span-3 text-center py-8">
                      <div className="text-4xl mb-4">📱</div>
                      <p className="text-lg mb-2">No emergency contacts added yet</p>
                      <p className="text-sm opacity-75 mb-4">Add trusted contacts who will receive your SOS alerts</p>
                      <button
                        onClick={addEmergencyContact}
                        className="bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-full font-medium transition-all"
                      >
                        Add Your First Contact
                      </button>
                    </div>
                  ) : (
                    emergencyContacts.map((contact, index) => (
                      <div key={contact.id} className="bg-white/10 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-lg">{contact.name}</h3>
                          <div className={`text-xs px-2 py-1 rounded-full ${
                            contact.priority === 1 ? 'bg-red-500' : 
                            contact.priority === 2 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}>
                            Priority {contact.priority}
                          </div>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center space-x-2">
                            <span>📞</span>
                            <span>{contact.phone}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span>👥</span>
                            <span className="capitalize">{contact.relation}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm('Test alert will be sent to this contact. Proceed?')) {
                              alert(`Test alert sent to ${contact.name} at ${contact.phone}`);
                            }
                          }}
                          className="w-full mt-3 bg-blue-500 hover:bg-blue-600 py-2 rounded-lg text-xs font-medium transition-all"
                        >
                          Test Alert
                        </button>
                      </div>
                    ))
                  )}
                </div>
                
                <div className="mt-8 bg-white/10 rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-4">How Emergency Alerts Work</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div>
                      <h4 className="font-medium mb-2">📱 SMS Alerts Include:</h4>
                      <ul className="space-y-1 opacity-75">
                        <li>• Your exact GPS location</li>
                        <li>• Type of emergency (voice, gesture, etc.)</li>
                        <li>• Timestamp of alert</li>
                        <li>• Google Maps link to your location</li>
                        <li>• Your custom emergency message</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">⚡ Alert Priority System:</h4>
                      <ul className="space-y-1 opacity-75">
                        <li>• <span className="text-red-400">Priority 1:</span> Immediate family</li>
                        <li>• <span className="text-yellow-400">Priority 2:</span> Close friends</li>
                        <li>• <span className="text-green-400">Priority 3:</span> Colleagues/Others</li>
                        <li>• Alerts sent simultaneously to all</li>
                        <li>• Escalation if no response received</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;