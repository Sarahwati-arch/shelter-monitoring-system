import os
import json
import math
import glob

def process_file(filepath):
    print(f"Processing {filepath}")
    magnitudes = []
    
    with open(filepath, 'r') as f:
        content = f.read()
        
    # Check if it's already a valid json array (could have been processed before)
    try:
        data = json.loads(content)
        if isinstance(data, list):
            print(f"File {filepath} is already a valid JSON array, skipping.")
            return
    except json.JSONDecodeError:
        pass # It's a text log as expected
        
    lines = content.split('\n')
    current_accel_x = None
    current_accel_y = None
    current_accel_z = None
    
    for line in lines:
        line = line.strip()
        if line.startswith("accel_x:"):
            try:
                current_accel_x = float(line.split(":")[1].strip())
            except ValueError:
                pass
        elif line.startswith("accel_y:"):
            try:
                current_accel_y = float(line.split(":")[1].strip())
            except ValueError:
                pass
        elif line.startswith("accel_z:"):
            try:
                current_accel_z = float(line.split(":")[1].strip())
            except ValueError:
                pass
            
            # Assuming z is the last one in the block and all three are present
            if current_accel_x is not None and current_accel_y is not None and current_accel_z is not None:
                magnitude = math.sqrt(current_accel_x**2 + current_accel_y**2 + current_accel_z**2)
                magnitudes.append(magnitude)
                current_accel_x, current_accel_y, current_accel_z = None, None, None

    if len(magnitudes) > 0:
        # Save as valid JSON
        with open(filepath, 'w') as f:
            json.dump(magnitudes, f, indent=4)
        print(f"Successfully converted {filepath}. Found {len(magnitudes)} readings.")
    else:
        print(f"Warning: No valid acceleration data found in {filepath}. File might be empty or invalid format.")
        
def main():
    base_dir = r"d:\shelter-monitoring-system\vibration_ai\models\real_life_datasets"
    # Find all .json files in subdirectories
    json_files = glob.glob(os.path.join(base_dir, "**", "*.json"), recursive=True)
    
    for filepath in json_files:
        # Ignore empty files that are 0 bytes
        if os.path.getsize(filepath) == 0:
            print(f"Skipping empty file: {filepath}")
            continue
        process_file(filepath)

if __name__ == "__main__":
    main()
