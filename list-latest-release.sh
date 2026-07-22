#!/usr/bin/bash
curl -sL "https://api.github.com/repos/BrettFX/Trackwise/releases/latest" | python3 -c "
import sys,json
r=json.load(sys.stdin)
print('tag:', r.get('tag_name'))
print('draft:', r.get('draft'))
print('assets:')
for a in r.get('assets', []):
    print(' ', a['name'], '-', a['browser_download_url'])
"
