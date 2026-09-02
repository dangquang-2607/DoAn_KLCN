import os
import glob

files = glob.glob('app/models/*.py')
for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    content = content.replace('func.now()', 'func.sysutcdatetime()')
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)

print(f"Reverted to sysutcdatetime in {len(files)} files.")
