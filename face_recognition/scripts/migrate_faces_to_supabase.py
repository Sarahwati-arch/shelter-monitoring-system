import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
import time

# Ensure we're in the right directory structure
BASE_DIR = Path(__file__).resolve().parents[2]
sys_path = str(BASE_DIR)
if sys_path not in sys.path:
    sys.path.insert(0, sys_path)

load_dotenv(BASE_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from environment.", file=sys.stderr)
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

FACES_DIR = BASE_DIR / "data" / "faces"

def migrate():
    if not FACES_DIR.exists():
        print(f"Error: {FACES_DIR} does not exist.")
        return

    for person_dir in FACES_DIR.iterdir():
        if not person_dir.is_dir():
            continue
            
        name = person_dir.name.capitalize()
        role = "Shelter Officer" # Default role
        
        print(f"Processing {name}...")
        
        uploaded_paths = []
        files = list(person_dir.glob("*.*"))
        
        for idx, file_path in enumerate(files):
            if file_path.suffix.lower() not in ['.jpg', '.jpeg', '.png']:
                continue
                
            file_ext = file_path.suffix.lower()
            file_name = f"{int(time.time())}_{idx}_{name}{file_ext}"
            storage_path = f"enrollment/{file_name}"
            
            print(f"  Uploading {file_path.name} to {storage_path}...")
            
            with open(file_path, "rb") as f:
                res = supabase.storage.from_("employee-faces").upload(storage_path, f.read())
            
            # Note: We don't check upload error robustly here for a one-off script, 
            # but if it fails, it will raise an exception in the supabase python client.
            uploaded_paths.append(storage_path)
            
        if uploaded_paths:
            print(f"  Inserting {name} into database with {len(uploaded_paths)} photos...")
            
            # Mark is_synced = True because they are already enrolled in the local embeddings!
            res = supabase.table("employees").insert({
                "name": name,
                "role": role,
                "image_paths": uploaded_paths,
                "is_synced": True
            }).execute()
            
            print(f"  Successfully migrated {name}.")

if __name__ == "__main__":
    migrate()
    print("Migration complete!")
