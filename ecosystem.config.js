const path = require('path');

const PROJECT_ROOT = '/home/ubuntu/GitHub/Programs/AionUi';

module.exports = {
  apps: [
    {
      name: 'aionui-web',
      namespace: 'aionui',
      script: '/home/ubuntu/GitHub/Programs/AionUi/start-aionui.sh',
      cwd: PROJECT_ROOT,
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        AIONUI_PORT: 34005,
        AIONUI_REMOTE: 'true',
        SERVER_BASE_URL: 'https://aion.atius.com.br',
        AIONUI_ALLOWED_ORIGINS: 'https://aion.atius.com.br',
        APP_VERSION: '1.9.21',
      },
      wait_ready: false,
      kill_timeout: 10000,
      max_memory_restart: '4G',
      restart_delay: 10000,
    },
  ],
};
