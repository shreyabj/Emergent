#!/usr/bin/env python3
"""
SafeGuard Women's Safety App - Backend API Testing
Tests all 10 API endpoints for the women's safety application
"""

import requests
import sys
import json
import io
from datetime import datetime
import time

class SafeGuardAPITester:
    def __init__(self, base_url="https://fd62e6fc-ea20-48c6-9d4e-9ccbc85f1636.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def test_risk_analysis(self):
        """Test GET /api/risk-analysis endpoint"""
        try:
            response = requests.get(f"{self.api_url}/risk-analysis", 
                                  params={"lat": 28.6139, "lng": 77.2090, "radius": 1000},
                                  timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["location", "risk_score", "risk_level", "incident_count", "recent_incidents", "recommendations"]
                
                if all(field in data for field in required_fields):
                    self.log_test("Risk Analysis API", True, f"Risk level: {data['risk_level']}, Incidents: {data['incident_count']}")
                    return True
                else:
                    self.log_test("Risk Analysis API", False, "Missing required fields in response")
                    return False
            else:
                self.log_test("Risk Analysis API", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Risk Analysis API", False, str(e))
            return False

    def test_voice_analysis(self):
        """Test POST /api/voice-analysis endpoint"""
        try:
            # Create a mock audio file
            audio_data = b"mock_audio_data_for_testing"
            files = {'audio': ('test_voice.wav', io.BytesIO(audio_data), 'audio/wav')}
            
            response = requests.post(f"{self.api_url}/voice-analysis", 
                                   files=files, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["analysis", "trigger_sos", "message"]
                
                if all(field in data for field in required_fields):
                    analysis = data["analysis"]
                    if "emotion" in analysis and "confidence" in analysis:
                        self.log_test("Voice Analysis API", True, f"Emotion: {analysis['emotion']}, SOS: {data['trigger_sos']}")
                        return True
                    else:
                        self.log_test("Voice Analysis API", False, "Missing analysis fields")
                        return False
                else:
                    self.log_test("Voice Analysis API", False, "Missing required fields")
                    return False
            else:
                self.log_test("Voice Analysis API", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Voice Analysis API", False, str(e))
            return False

    def test_gesture_detection(self):
        """Test POST /api/gesture-detection endpoint"""
        try:
            gesture_data = {
                "type": "peace_sign",
                "timestamp": datetime.now().isoformat()
            }
            
            response = requests.post(f"{self.api_url}/gesture-detection", 
                                   json=gesture_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["gesture_detected", "confidence", "sos_triggered", "message"]
                
                if all(field in data for field in required_fields):
                    self.log_test("Gesture Detection API", True, f"Gesture: {data['gesture_detected']}, SOS: {data['sos_triggered']}")
                    return True
                else:
                    self.log_test("Gesture Detection API", False, "Missing required fields")
                    return False
            else:
                self.log_test("Gesture Detection API", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Gesture Detection API", False, str(e))
            return False

    def test_shake_detection(self):
        """Test POST /api/shake-detection endpoint"""
        try:
            shake_data = {
                "pattern": [0.8, 0.9, 0.85],
                "intensity": 0.8
            }
            
            response = requests.post(f"{self.api_url}/shake-detection", 
                                   json=shake_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["pattern_recognized", "shake_intensity", "sos_triggered", "message"]
                
                if all(field in data for field in required_fields):
                    self.log_test("Shake Detection API", True, f"Pattern: {data['pattern_recognized']}, SOS: {data['sos_triggered']}")
                    return True
                else:
                    self.log_test("Shake Detection API", False, "Missing required fields")
                    return False
            else:
                self.log_test("Shake Detection API", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Shake Detection API", False, str(e))
            return False

    def test_route_tracking(self):
        """Test POST /api/route-tracking endpoint"""
        try:
            route_data = {
                "start_location": {"lat": 28.6139, "lng": 77.2090},
                "destination": {"lat": 28.6270, "lng": 77.2410},
                "planned_route": [
                    {"lat": 28.6139, "lng": 77.2090},
                    {"lat": 28.6200, "lng": 77.2250},
                    {"lat": 28.6270, "lng": 77.2410}
                ],
                "current_location": {"lat": 28.6139, "lng": 77.2090}
            }
            
            response = requests.post(f"{self.api_url}/route-tracking", 
                                   json=route_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["route_id", "status", "message"]
                
                if all(field in data for field in required_fields):
                    self.log_test("Route Tracking API", True, f"Route ID: {data['route_id'][:8]}...")
                    return data["route_id"]  # Return route_id for location update test
                else:
                    self.log_test("Route Tracking API", False, "Missing required fields")
                    return False
            else:
                self.log_test("Route Tracking API", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Route Tracking API", False, str(e))
            return False

    def test_location_update(self, route_id):
        """Test POST /api/location-update endpoint"""
        if not route_id:
            self.log_test("Location Update API", False, "No route_id from previous test")
            return False
            
        try:
            update_data = {
                "route_id": route_id,
                "current_location": {"lat": 28.6150, "lng": 77.2100}
            }
            
            response = requests.post(f"{self.api_url}/location-update", 
                                   json=update_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["route_id", "current_location", "deviation_detected", "message"]
                
                if all(field in data for field in required_fields):
                    self.log_test("Location Update API", True, f"Deviation: {data['deviation_detected']}")
                    return True
                else:
                    self.log_test("Location Update API", False, "Missing required fields")
                    return False
            else:
                self.log_test("Location Update API", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Location Update API", False, str(e))
            return False

    def test_emergency_sos(self):
        """Test POST /api/emergency-sos endpoint"""
        try:
            sos_data = {
                "user_location": {"lat": 28.6139, "lng": 77.2090},
                "alert_type": "manual",
                "confidence": 0.9
            }
            
            response = requests.post(f"{self.api_url}/emergency-sos", 
                                   json=sos_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["alert_id", "status", "message", "timestamp"]
                
                if all(field in data for field in required_fields):
                    self.log_test("Emergency SOS API", True, f"Alert ID: {data['alert_id'][:8]}...")
                    return True
                else:
                    self.log_test("Emergency SOS API", False, "Missing required fields")
                    return False
            else:
                self.log_test("Emergency SOS API", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Emergency SOS API", False, str(e))
            return False

    def test_safety_chat(self):
        """Test POST /api/safety-chat endpoint"""
        try:
            response = requests.post(f"{self.api_url}/safety-chat", 
                                   params={"message": "Is this road safe?"}, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["response", "suggestions"]
                
                if all(field in data for field in required_fields):
                    self.log_test("Safety Chat API", True, f"Response length: {len(data['response'])} chars")
                    return True
                else:
                    self.log_test("Safety Chat API", False, "Missing required fields")
                    return False
            else:
                self.log_test("Safety Chat API", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Safety Chat API", False, str(e))
            return False

    def test_emergency_contacts_get(self):
        """Test GET /api/emergency-contacts endpoint"""
        try:
            response = requests.get(f"{self.api_url}/emergency-contacts", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Get Emergency Contacts API", True, f"Found {len(data)} contacts")
                    return True
                else:
                    self.log_test("Get Emergency Contacts API", False, "Response is not a list")
                    return False
            else:
                self.log_test("Get Emergency Contacts API", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Get Emergency Contacts API", False, str(e))
            return False

    def test_emergency_contacts_post(self):
        """Test POST /api/emergency-contacts endpoint"""
        try:
            contact_data = {
                "name": "Test Contact",
                "phone": "+1234567890",
                "relation": "friend",
                "priority": 1
            }
            
            response = requests.post(f"{self.api_url}/emergency-contacts", 
                                   json=contact_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["message", "contact_id"]
                
                if all(field in data for field in required_fields):
                    self.log_test("Add Emergency Contact API", True, f"Contact ID: {data['contact_id'][:8]}...")
                    return True
                else:
                    self.log_test("Add Emergency Contact API", False, "Missing required fields")
                    return False
            else:
                self.log_test("Add Emergency Contact API", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Add Emergency Contact API", False, str(e))
            return False

    def test_safety_route(self):
        """Test GET /api/safety-route endpoint"""
        try:
            params = {
                "start_lat": 28.6139,
                "start_lng": 77.2090,
                "end_lat": 28.6270,
                "end_lng": 77.2410
            }
            
            response = requests.get(f"{self.api_url}/safety-route", 
                                  params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["route", "total_distance", "estimated_time", "safety_score", "alerts"]
                
                if all(field in data for field in required_fields):
                    self.log_test("Safety Route API", True, f"Distance: {data['total_distance']}, Safety: {data['safety_score']}")
                    return True
                else:
                    self.log_test("Safety Route API", False, "Missing required fields")
                    return False
            else:
                self.log_test("Safety Route API", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Safety Route API", False, str(e))
            return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting SafeGuard API Tests...")
        print(f"📡 Testing backend at: {self.base_url}")
        print("=" * 60)
        
        # Test all endpoints
        self.test_risk_analysis()
        self.test_voice_analysis()
        self.test_gesture_detection()
        self.test_shake_detection()
        
        # Route tracking tests (dependent)
        route_id = self.test_route_tracking()
        self.test_location_update(route_id)
        
        self.test_emergency_sos()
        self.test_safety_chat()
        self.test_emergency_contacts_get()
        self.test_emergency_contacts_post()
        self.test_safety_route()
        
        # Print summary
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed! Backend is working correctly.")
            return 0
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed.")
            print("\nFailed tests:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  ❌ {result['test']}: {result['details']}")
            return 1

def main():
    tester = SafeGuardAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())