from fastapi import FastAPI, APIRouter, HTTPException, File, UploadFile, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import asyncio
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Pydantic models for the women's safety app
class EmergencyContact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    relation: str
    priority: int = 1

class IncidentReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    location: Dict[str, float]  # {lat: float, lng: float}
    incident_type: str
    description: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    severity: int = 1  # 1-5 scale

class SOSAlert(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_location: Dict[str, float]
    alert_type: str  # voice, gesture, deviation, manual
    confidence: float = 0.0
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    status: str = "active"  # active, resolved
    audio_analysis: Optional[Dict[str, Any]] = None

class VoiceAnalysis(BaseModel):
    emotion: str
    confidence: float
    fear_detected: bool
    stress_level: float

class RouteData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    start_location: Dict[str, float]
    destination: Dict[str, float]
    planned_route: List[Dict[str, float]]
    current_location: Dict[str, float]
    deviation_threshold: int = 500  # meters
    is_active: bool = True

# Mock data for demo
DEMO_INCIDENTS = [
    {"lat": 28.6139, "lng": 77.2090, "type": "harassment", "severity": 3, "timestamp": "2024-01-15T20:30:00"},
    {"lat": 28.6129, "lng": 77.2080, "type": "stalking", "severity": 4, "timestamp": "2024-01-10T21:15:00"},
    {"lat": 28.6149, "lng": 77.2100, "type": "catcalling", "severity": 2, "timestamp": "2024-01-08T19:45:00"},
    {"lat": 28.6155, "lng": 77.2095, "type": "inappropriate_behavior", "severity": 3, "timestamp": "2024-01-05T22:00:00"}
]

# Routes for Feature 1: Voice-Only SOS
@api_router.post("/voice-analysis")
async def analyze_voice_emotion(audio: UploadFile = File(...)):
    """Analyze voice for emotion detection (Demo mode)"""
    try:
        # Simulate voice analysis processing
        await asyncio.sleep(2)  # Simulate processing time
        
        # Demo: Random emotion detection based on filename or random
        emotions = ["calm", "fear", "stress", "neutral", "anxiety"]
        detected_emotion = random.choice(emotions)
        
        fear_detected = detected_emotion in ["fear", "stress", "anxiety"]
        confidence = random.uniform(0.7, 0.95)
        stress_level = random.uniform(0.3, 0.9) if fear_detected else random.uniform(0.1, 0.4)
        
        analysis = VoiceAnalysis(
            emotion=detected_emotion,
            confidence=confidence,
            fear_detected=fear_detected,
            stress_level=stress_level
        )
        
        return {
            "analysis": analysis.dict(),
            "trigger_sos": fear_detected and confidence > 0.75,
            "message": f"Voice analysis complete. Emotion: {detected_emotion} (confidence: {confidence:.2f})"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice analysis failed: {str(e)}")

# Routes for Feature 2: Historical Incident Reports & Risk Analysis
@api_router.get("/risk-analysis")
async def get_location_risk(lat: float, lng: float, radius: int = 1000):
    """Analyze location risk based on historical incidents"""
    
    # Calculate risk based on nearby incidents (demo data)
    nearby_incidents = []
    for incident in DEMO_INCIDENTS:
        # Simple distance calculation (not accurate for production)
        lat_diff = abs(incident["lat"] - lat)
        lng_diff = abs(incident["lng"] - lng)
        if lat_diff < 0.01 and lng_diff < 0.01:  # Roughly within radius
            nearby_incidents.append(incident)
    
    risk_score = len(nearby_incidents) * 0.2  # Simple risk calculation
    risk_level = "low" if risk_score < 0.3 else "medium" if risk_score < 0.7 else "high"
    
    return {
        "location": {"lat": lat, "lng": lng},
        "risk_score": min(risk_score, 1.0),
        "risk_level": risk_level,
        "incident_count": len(nearby_incidents),
        "recent_incidents": nearby_incidents[:3],
        "recommendations": get_safety_recommendations(risk_level)
    }

def get_safety_recommendations(risk_level: str) -> List[str]:
    if risk_level == "high":
        return [
            "Consider alternative route",
            "Travel with companion if possible", 
            "Stay in well-lit areas",
            "Keep emergency contacts ready"
        ]
    elif risk_level == "medium":
        return [
            "Stay alert and aware",
            "Avoid isolated areas",
            "Share location with trusted contacts"
        ]
    else:
        return [
            "Normal precautions apply",
            "Stay aware of surroundings"
        ]

# Routes for Feature 3: Safety Maps & Chatbot
@api_router.get("/safety-route")
async def get_safe_route(start_lat: float, start_lng: float, end_lat: float, end_lng: float):
    """Get safest route between two points"""
    
    # Demo: Return mock route data with safety analysis
    waypoints = [
        {"lat": start_lat, "lng": start_lng, "safety": "high"},
        {"lat": (start_lat + end_lat)/2, "lng": (start_lng + end_lng)/2, "safety": "medium"},
        {"lat": end_lat, "lng": end_lng, "safety": "high"}
    ]
    
    return {
        "route": waypoints,
        "total_distance": "2.3 km",
        "estimated_time": "8 minutes",
        "safety_score": 0.85,
        "alerts": [
            "Well-lit path recommended",
            "CCTV coverage available on this route"
        ]
    }

@api_router.post("/safety-chat")
async def safety_chatbot(message: str):
    """AI chatbot for safety queries"""
    
    # Demo: Simple keyword-based responses
    message_lower = message.lower()
    
    if "safe" in message_lower and ("route" in message_lower or "road" in message_lower):
        return {
            "response": "Based on recent data, I recommend taking the main road with better lighting. The side streets have had 2 incidents reported this month.",
            "suggestions": ["Take main road", "Travel before 9 PM", "Share live location"]
        }
    elif "emergency" in message_lower or "help" in message_lower:
        return {
            "response": "In case of emergency, press the SOS button. Your location will be shared with emergency contacts. Say 'I'm fine' calmly if you need silent help.",
            "suggestions": ["Press SOS", "Use voice alert", "Share location"]
        }
    elif "incident" in message_lower or "report" in message_lower:
        return {
            "response": "You can report incidents anonymously. This helps other users stay informed about unsafe areas.",
            "suggestions": ["Report incident", "View incident map", "Get area alerts"]
        }
    else:
        return {
            "response": "I'm here to help with your safety concerns. You can ask about safe routes, report incidents, or get emergency help.",
            "suggestions": ["Find safe route", "Report incident", "Emergency help"]
        }

# Routes for Feature 4: Gesture-based SOS
@api_router.post("/gesture-detection")
async def detect_gesture(gesture_data: Dict[str, Any]):
    """Process gesture detection data"""
    
    # Demo: Simulate gesture recognition
    gesture_type = gesture_data.get("type", "unknown")
    confidence = random.uniform(0.6, 0.95)
    
    recognized_gestures = ["peace_sign", "open_palm", "help_gesture"]
    is_sos_gesture = gesture_type in recognized_gestures and confidence > 0.8
    
    return {
        "gesture_detected": gesture_type,
        "confidence": confidence,
        "sos_triggered": is_sos_gesture,
        "message": f"Gesture {'recognized' if is_sos_gesture else 'detected'}: {gesture_type}"
    }

@api_router.post("/shake-detection")
async def process_shake_pattern(shake_data: Dict[str, Any]):
    """Process accelerometer shake pattern"""
    
    # Demo: Simulate shake pattern analysis
    pattern = shake_data.get("pattern", [])
    intensity = shake_data.get("intensity", 0)
    
    # Simple pattern matching (demo)
    is_emergency_shake = len(pattern) >= 3 and intensity > 0.7
    
    return {
        "pattern_recognized": is_emergency_shake,
        "shake_intensity": intensity,
        "sos_triggered": is_emergency_shake,
        "message": "Emergency shake pattern detected" if is_emergency_shake else "Normal movement detected"
    }

# Routes for Feature 5: Route Deviation Detection
@api_router.post("/route-tracking")
async def start_route_tracking(route_data: RouteData):
    """Start tracking a planned route"""
    
    # Save route to database (demo)
    route_dict = route_data.dict()
    await db.active_routes.insert_one(route_dict)
    
    return {
        "route_id": route_data.id,
        "status": "tracking_started",
        "message": "Route tracking activated. You will be alerted if you deviate from the planned path."
    }

@api_router.post("/location-update")
async def update_location(route_id: str, current_location: Dict[str, float]):
    """Update current location and check for deviation"""
    
    # Get route from database (demo)
    route = await db.active_routes.find_one({"id": route_id})
    
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Simple deviation calculation (demo)
    planned_route = route["planned_route"]
    deviation_detected = False
    
    # Check if current location is too far from planned route
    for point in planned_route:
        lat_diff = abs(point["lat"] - current_location["lat"])
        lng_diff = abs(point["lng"] - current_location["lng"])
        if lat_diff < 0.01 and lng_diff < 0.01:  # Within acceptable range
            deviation_detected = False
            break
        else:
            deviation_detected = True
    
    return {
        "route_id": route_id,
        "current_location": current_location,
        "deviation_detected": deviation_detected,
        "message": "Route deviation detected! Are you safe?" if deviation_detected else "On track",
        "requires_response": deviation_detected
    }

# Emergency SOS endpoints
@api_router.post("/emergency-sos")
async def trigger_emergency_sos(alert_data: SOSAlert):
    """Trigger emergency SOS alert"""
    
    # Save SOS alert to database
    alert_dict = alert_data.dict()
    await db.sos_alerts.insert_one(alert_dict)
    
    # Demo: Simulate sending alerts to emergency contacts
    await send_emergency_notifications(alert_data)
    
    return {
        "alert_id": alert_data.id,
        "status": "alert_sent",
        "message": "Emergency alert sent to your contacts and authorities",
        "timestamp": alert_data.timestamp
    }

async def send_emergency_notifications(alert: SOSAlert):
    """Send notifications to emergency contacts (demo)"""
    # This would integrate with Twilio, email services, etc.
    print(f"🚨 EMERGENCY ALERT SENT 🚨")
    print(f"Type: {alert.alert_type}")
    print(f"Location: {alert.user_location}")
    print(f"Time: {alert.timestamp}")

# Contact management
@api_router.post("/emergency-contacts")
async def add_emergency_contact(contact: EmergencyContact):
    """Add emergency contact"""
    contact_dict = contact.dict()
    await db.emergency_contacts.insert_one(contact_dict)
    return {"message": "Emergency contact added successfully", "contact_id": contact.id}

@api_router.get("/emergency-contacts")
async def get_emergency_contacts():
    """Get all emergency contacts"""
    contacts = await db.emergency_contacts.find().to_list(100)
    return [EmergencyContact(**contact) for contact in contacts]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()