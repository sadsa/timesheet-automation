#!/usr/bin/env python3
"""
Dangerous command blocker hook for Claude Code.
Reads the tool input from stdin and blocks known destructive patterns.
Exits 0 to allow, non-zero to block.
"""
import sys
import json

try:
    data = json.load(sys.stdin)
    command = data.get("command", "")
except Exception:
    sys.exit(0)

BLOCKED_PATTERNS = [
    "rm -rf /",
    "rm -rf ~",
    "dd if=",
    ":(){:|:&};:",
    "mkfs.",
    "> /dev/sd",
    "chmod -R 777 /",
    "chown -R",
    "git push --force origin main",
    "git push --force origin master",
    "git push -f origin main",
    "git push -f origin master",
]

for pattern in BLOCKED_PATTERNS:
    if pattern in command:
        print(f"Blocked: command contains dangerous pattern: {pattern}", file=sys.stderr)
        sys.exit(1)

sys.exit(0)
