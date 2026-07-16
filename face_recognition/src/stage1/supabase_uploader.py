import os
import uuid
import requests
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
load_dotenv(env_path)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
SHELTER_ID = os.environ.get("SHELTER_ID")
BOT_TOKEN = os.environ.get("BOT_TOKEN")
CHAT_ID_FALLBACK = os.environ.get("CHAT_ID")
BUCKET_NAME = "cctv-evidence"

# Initialize Supabase client
if SUPABASE_URL and SUPABASE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    supabase = None
    print("Warning: SUPABASE_URL or SUPABASE_KEY missing. Upload disabled.")

def get_telegram_chat_ids() -> list:
    if not supabase:
        return [CHAT_ID_FALLBACK] if CHAT_ID_FALLBACK else []
    try:
        resp = supabase.table("users").select("telegram_chat_id").not_.is_("telegram_chat_id", "null").execute()
        ids = [row["telegram_chat_id"] for row in (resp.data or []) if row.get("telegram_chat_id")]
        if ids:
            return ids
    except Exception as e:
        print(f"[TG] Gagal fetch Chat ID dari DB: {e}")
    return [CHAT_ID_FALLBACK] if CHAT_ID_FALLBACK else []

def send_telegram(message: str) -> None:
    if not BOT_TOKEN:
        print("[TG] BOT_TOKEN belum diset di .env, skip.")
        return
    chat_ids = get_telegram_chat_ids()
    if not chat_ids:
        print("[TG] Tidak ada Chat ID yang tersedia, skip.")
        return
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    for chat_id in chat_ids:
        try:
            requests.post(url, data={"chat_id": chat_id, "text": message}, timeout=5)
            print(f"[TG] Alert sent to {chat_id}.")
        except Exception as e:
            print(f"[TG ERROR] chat_id={chat_id}: {e}")

def upload_snapshot_and_alert(filepath, filename, detection_result):
    """
    Uploads the image to Supabase storage, creates an alert, and links it in cctv_evidence.
    """
    if not supabase:
        return

    try:
        # 1. Upload file to Storage Bucket
        with open(filepath, 'rb') as f:
            storage_path = f"{datetime.now().strftime('%Y%m%d')}/{filename}"
            supabase.storage.from_(BUCKET_NAME).upload(
                path=storage_path,
                file=f,
                file_options={"content-type": "image/jpeg"}
            )
        
        # 2. Get Public URL
        public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(storage_path)
        
        alert_message = "Unrecognized person detected."
        alert_response = supabase.table('alerts').insert({
            "shelter_id": SHELTER_ID,
            "alert_type": "unknown_person",
            "status": "open",
            "severity": "critical",
            "message": alert_message,
        }).execute()
        
        if not alert_response.data:
            print("Failed to create alert.")
            return
            
        alert_id = alert_response.data[0]['alert_id']
        
        # 4. Create CCTV Evidence record
        supabase.table('cctv_evidence').insert({
            "alert_id": alert_id,
            "storage_path": storage_path,
            "public_url": public_url,
            "captured_at": detection_result['timestamp'],
            "faces_detected": len(detection_result.get('faces', [])),
            "face_metadata": detection_result,
        }).execute()

        print(f"  [Supabase] Successfully uploaded snapshot & created alert: {alert_id}")
        
        # 5. Send Telegram notification
        shelter_short = SHELTER_ID[-4:] if SHELTER_ID else "UNKNOWN"
        send_telegram(f"🚨 [SHELTER {shelter_short}] CCTV Alert: {alert_message}\nEvidence: {public_url}")
        
    except Exception as e:
        print(f"  [Supabase] Error uploading evidence: {e}")
