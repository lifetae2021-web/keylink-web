import os
import glob

src_dir = '/Users/lifetae2021/Desktop/keylink/src'
files = glob.glob(src_dir + '/**/*.tsx', recursive=True)
files += glob.glob(src_dir + '/**/*.ts', recursive=True)

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if '10,000원 할인 쿠폰' in content:
        new_content = content.replace('10,000원 할인 쿠폰', '50% 할인쿠폰')
        with open(file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {file}")
