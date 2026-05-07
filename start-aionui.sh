#!/bin/bash
# Wrapper script to run AionUI in headless mode with virtual display
cd /home/ubuntu/GitHub/forks/AionUi
exec /usr/bin/xvfb-run --auto-servernum --server-args="-screen 0 1280x1024x24" \
  /home/ubuntu/.nvm/versions/node/v24.13.1/bin/node \
  /home/ubuntu/GitHub/forks/AionUi/node_modules/.bin/electron-vite dev -- --webui --remote
