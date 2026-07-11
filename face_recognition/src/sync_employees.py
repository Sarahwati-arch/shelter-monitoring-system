import os
import time
import urllib.request
import logging
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

# Ensure we're in the right directory structure
BASE_DIR = Path(__file__).resolve().parents[1]
sys_path = str(BASE_DIR)
import sys
if sys_path not in sys.path:
    sys.path.insert(0, sys_path)

from src.stage2.stage2_face_recognition import enroll_single_image, enroll_multiple_images

# ─────────────────────────────────────────────────────────────────
# Setup & Configuration
# ─────────────────────────────────────────────────────────────────

# Load .env file from face_recognition/.env or root
load_dotenv(BASE_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") # We need service role for writing is_synced

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from environment.", file=sys.stderr)
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] (Sync) %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(BASE_DIR / "logs" / "sync_employees.log")
    ]
)
logger = logging.getLogger(__name__)

TEMP_DIR = BASE_DIR / "data" / "temp"
TEMP_DIR.mkdir(parents=True, exist_ok=True)

SYNC_INTERVAL = 60 # Check every 60 seconds

def sync_new_employees():
    """
    Fetches unenrolled employees from Supabase, downloads their image,
    enrolls them locally, and marks them as synced.
    """
    logger.info("Checking for new employees to sync...")
    
    try:
        response = supabase.table("employees").select("*").eq("is_synced", False).execute()
        new_employees = response.data
        
        if not new_employees:
            logger.info("No new employees found.")
            return

        logger.info(f"Found {len(new_employees)} new employee(s) to enroll.")
        
        for emp in new_employees:
            emp_id = emp["id"]
            name = emp["name"]
            image_paths = emp.get("image_paths", []) # Array of paths within 'employee-faces' bucket
            
            logger.info(f"Processing employee: {name} ({emp_id}) with {len(image_paths)} photos")
            
            if not image_paths:
                logger.warning(f"No photos found for employee {name}. Marking as synced anyway.")
                supabase.table("employees").update({"is_synced": True}).eq("id", emp_id).execute()
                continue
            
            all_success = True
            temp_files = []
            
            for idx, image_path in enumerate(image_paths):
                try:
                    # Download image
                    res = supabase.storage.from_("employee-faces").download(image_path)
                    
                    # Save temporarily
                    ext = image_path.split('.')[-1]
                    temp_file_path = TEMP_DIR / f"temp_{emp_id}_{idx}.{ext}"
                    
                    with open(temp_file_path, "wb") as f:
                        f.write(res)
                        
                    logger.info(f"Downloaded image {idx+1}/{len(image_paths)} to {temp_file_path}")
                    temp_files.append(str(temp_file_path))
                        
                except Exception as loop_e:
                    logger.error(f"Error downloading photo {idx+1} for {name}: {loop_e}")
                    all_success = False
            
            # Enroll all downloaded faces in batch
            if temp_files:
                batch_success = enroll_multiple_images(name, temp_files)
                if not batch_success:
                    all_success = False
                    logger.error(f"Batch enrollment failed for {name}")
                
                # Clean up raw images immediately
                for temp_file_path in temp_files:
                    if os.path.exists(temp_file_path):
                        os.remove(temp_file_path)
                        logger.info(f"Cleaned up temporary file {temp_file_path}")
            else:
                all_success = False
                logger.error(f"No photos were successfully downloaded for {name}")
            
            # Update Supabase status if at least one photo was processed (we can mark synced if we tried everything)
            # Or only if all_success is true. Let's do if all_success.
            if all_success:
                supabase.table("employees").update({"is_synced": True}).eq("id", emp_id).execute()
                logger.info(f"Successfully synced employee {name}.")
            else:
                logger.error(f"Failed to fully enroll employee {name}. Will retry next cycle.")
                
                
    except Exception as e:
        logger.error(f"Error during sync: {e}")

if __name__ == "__main__":
    logger.info("Starting Edge Sync Worker...")
    while True:
        sync_new_employees()
        time.sleep(SYNC_INTERVAL)
