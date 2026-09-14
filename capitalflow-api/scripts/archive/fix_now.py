import os
import glob

files = glob.glob('app/models/*.py')
for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    content = content.replace('func.sysutcdatetime()', 'func.now()')
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)

print(f"Replaced sysutcdatetime with now in {len(files)} files.")
