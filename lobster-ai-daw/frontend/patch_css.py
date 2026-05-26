filepath = r'src\styles\glassmorphism.css'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

import re

# .progress-bar-fill 블록을 찾아 교체
old_pattern = r'\.progress-bar-fill\s*\{[^}]*\}'
new_block = '''.progress-bar-fill {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--primary-royal) 0%,
    #a855f7 50%,
    var(--primary-royal-glow) 100%
  );
  background-size: 200% 100%;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  animation: progressShimmer 2s linear infinite;
  border-radius: 4px;
}

@keyframes progressShimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}'''

new_content, count = re.subn(old_pattern, new_block, content, count=1, flags=re.DOTALL)
if count == 0:
    print("PATTERN NOT FOUND")
    exit(1)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(new_content)
print(f"SUCCESS - replaced {count} occurrence(s)")