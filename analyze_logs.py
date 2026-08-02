import json
import glob
import os

log_dir = r'd:\shelter-monitoring-system\face_recognition\logs'
json_files = glob.glob(os.path.join(log_dir, '*.json'))

total_frames = 0
no_face = 0
recognized = 0
unknown = 0

known_identities = set()

for file in json_files:
    with open(file, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
            for frame in data:
                total_frames += 1
                if 'faces' not in frame or not frame['faces']:
                    no_face += 1
                else:
                    has_unknown = False
                    has_known = False
                    for face in frame['faces']:
                        if face.get('identity') == 'unknown':
                            has_unknown = True
                        else:
                            has_known = True
                            known_identities.add(face.get('identity'))
                    
                    if has_unknown:
                        unknown += 1
                    if has_known:
                        recognized += 1
        except Exception as e:
            pass

print(f'Total Frames: {total_frames}')
print(f'No Face: {no_face}')
print(f'Recognized: {recognized}')
print(f'Unknown: {unknown}')
print(f'Known Identities: {known_identities}')
