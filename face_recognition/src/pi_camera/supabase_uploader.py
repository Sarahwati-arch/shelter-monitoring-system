import os
import uuid
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
SHELTER_ID = os.environ.get("SHELTER_ID")
BUCKET_NAME = "cctv-evidence"

if SUPABASE_URL and SUPABASE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    supabase = None
    print("Warning: SUPABASE_URL or SUPABASE_KEY missing. Upload disabled.")

def upload_snapshot_and_alert(filepath, filename, detection_result):
    if not supabase:
        return

    try:
        with open(filepath, 'rb') as f:
            storage_path = f"{datetime.now().strftime('%Y%m%d')}/{filename}"
            supabase.storage.from_(BUCKET_NAME).upload(
                path=storage_path,
                file=f,
                file_options={"content-type": "image/jpeg"}
            )
        public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(storage_path)
        
        alert_response = supabase.table('alerts').insert({
            "shelter_id": SHELTER_ID,
            "alert_type": "intrusion",
            "status": "open",
            "severity": "critical",
            "message": "Unrecognized person detected.",
        }).execute()
        
        if not alert_response.data:
            print("Failed to create alert.")
            return
            
        alert_id = alert_response.data[0]['alert_id']
        
        supabase.table('cctv_evidence').insert({
            "alert_id": alert_id,
            "storage_path": storage_path,
            "public_url": public_url,
            "captured_at": detection_result['timestamp'],
            "faces_detected": len(detection_result.get('faces', [])),
            "face_metadata": detection_result,
        }).execute()

        print(f"  [Supabase] Successfully uploaded snapshot & created alert: {alert_id}")
        
    except Exception as e:
        print(f"  [Supabase] Error uploading evidence: {e}")
