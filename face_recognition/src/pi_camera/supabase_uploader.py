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

def upload_storage_snapshot(filepath: str, filename: str) -> tuple[str, str] | None:
    """
    Uploads image file to Supabase Storage bucket 'cctv-evidence'.
    Returns tuple (storage_path, public_url) if successful, None otherwise.
    """
    if not supabase:
        return None
    try:
        with open(filepath, 'rb') as f:
            storage_path = f"{datetime.now().strftime('%Y%m%d')}/{filename}"
            supabase.storage.from_(BUCKET_NAME).upload(
                path=storage_path,
                file=f,
                file_options={"content-type": "image/jpeg"}
            )
        public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(storage_path)
        return storage_path, public_url
    except Exception as e:
        print(f"  [Supabase] Error uploading snapshot to storage: {e}")
        return None

def create_alert(shelter_id: str = SHELTER_ID, alert_type: str = "intrusion", severity: str = "critical", message: str = "Unrecognized person detected.") -> str | None:
    """
    Creates an alert entry in the 'alerts' table for intrusion events.
    Returns alert_id if successful, None otherwise.
    """
    if not supabase:
        return None
    try:
        alert_response = supabase.table('alerts').insert({
            "shelter_id": shelter_id,
            "alert_type": alert_type,
            "status": "open",
            "severity": severity,
            "message": message,
        }).execute()
        
        if alert_response.data:
            return alert_response.data[0]['alert_id']
        else:
            print("Failed to create alert.")
            return None
    except Exception as e:
        print(f"  [Supabase] Error creating alert: {e}")
        return None

def create_evidence(storage_path: str, public_url: str, detection_result: dict, alert_id: str | None = None) -> dict | None:
    """
    Creates a record in the 'cctv_evidence' table.
    Links to alert_id if provided (set to None for known persons).
    """
    if not supabase:
        return None
    try:
        resp = supabase.table('cctv_evidence').insert({
            "alert_id": alert_id,
            "storage_path": storage_path,
            "public_url": public_url,
            "captured_at": detection_result.get('timestamp', datetime.now().isoformat()),
            "faces_detected": len(detection_result.get('faces', [])),
            "face_metadata": detection_result,
        }).execute()
        return resp.data[0] if resp.data else None
    except Exception as e:
        print(f"  [Supabase] Error creating CCTV evidence: {e}")
        return None

def upload_snapshot_and_alert(filepath: str, filename: str, detection_result: dict, is_known: bool | None = None) -> None:
    """
    Uploads snapshot to Supabase Storage and records evidence.
    - If is_known is True: Uploads snapshot & creates cctv_evidence with alert_id = None.
      Does NOT create an alert in 'alerts' table.
    - If is_known is False: Uploads snapshot, creates 'intrusion' alert, and creates cctv_evidence
      linked to alert_id.
    - If is_known is None: Automatically infers based on presence of unknown faces in detection_result.
    """
    if not supabase:
        return

    # Auto-infer is_known if not explicitly provided
    if is_known is None:
        faces = detection_result.get("faces", [])
        is_known = len(faces) > 0 and not any(f.get("identity") == "unknown" for f in faces)

    try:
        # 1. Upload snapshot to Storage Bucket
        upload_res = upload_storage_snapshot(filepath, filename)
        if not upload_res:
            print("  [Supabase] Failed to upload snapshot to storage bucket.")
            return
        
        storage_path, public_url = upload_res

        if is_known:
            # Known person flow: No alert in alerts table, alert_id = None
            evidence = create_evidence(storage_path, public_url, detection_result, alert_id=None)
            if evidence:
                identities = [f.get("identity") for f in detection_result.get("faces", []) if f.get("identity") and f.get("identity") != "—"]
                id_str = ", ".join(identities) if identities else "Known person"
                print(f"  [Supabase] Successfully logged known person evidence ({id_str}): {storage_path}")
        else:
            # Unknown person flow: Create alert & link evidence
            alert_message = "Unrecognized person detected."
            alert_id = create_alert(shelter_id=SHELTER_ID, alert_type="intrusion", severity="critical", message=alert_message)
            if not alert_id:
                print("  [Supabase] Aborting evidence record creation because alert insertion failed.")
                return
            
            evidence = create_evidence(storage_path, public_url, detection_result, alert_id=alert_id)
            if evidence:
                print(f"  [Supabase] Successfully uploaded snapshot & created alert: {alert_id}")

    except Exception as e:
        print(f"  [Supabase] Error uploading evidence: {e}")

