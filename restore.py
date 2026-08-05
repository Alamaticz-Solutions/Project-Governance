import os
import glob
import json
import time

appdata = os.getenv('APPDATA')
history_dir = os.path.join(appdata, 'Code', 'User', 'History')
target_resource = "bta-review.component.ts"

if not os.path.exists(history_dir):
    print("History directory doesn't exist.")
    exit(0)

found = []
for root, dirs, files in os.walk(history_dir):
    if 'entries.json' in files:
        entries_path = os.path.join(root, 'entries.json')
        try:
            with open(entries_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if data and data.get('resource', '') and target_resource in data.get('resource', ''):
                for entry in data.get('entries', []):
                    entry_path = os.path.join(root, entry['id'])
                    found.append((entry['timestamp'], entry_path))
        except Exception as e:
            pass

found.sort(key=lambda x: x[0])
for ts, path in found:
    print(f"Time: {time.ctime(ts/1000.0)}, ID: {path}")

if found:
    # Try to find a version older than 60 mins (3600 seconds)
    current_time = time.time() * 1000
    older = [x for x in found if (current_time - x[0]) > 3000000] # ~50 mins 
    if older:
        print(f"\nRecommended Old Version: {older[-1][1]} - Time: {time.ctime(older[-1][0]/1000.0)}")
        # Let's save this safely for the agent to inspect
        import shutil
        shutil.copy(older[-1][1], "bta_old_version.txt")
        print("I have copied the old version to bta_old_version.txt")
    else:
        print("No versions older than 50 mins found.")
        # fallback to the oldest one
        import shutil
        shutil.copy(found[0][1], "bta_old_version.txt")
        print("I have copied the oldest available version to bta_old_version.txt")
else:
    print("No history found.")
