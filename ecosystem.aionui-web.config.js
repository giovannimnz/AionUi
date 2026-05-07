module.exports = {
  apps: [
    {
      name: 'aionui-web',
      script: '/home/ubuntu/GitHub/forks/AionUi/node_modules/.bin/electron-vite',
      args: 'dev -- --webui --remote',
      cwd: '/home/ubuntu/GitHub/forks/AionUi',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
        AIONUI_PORT: '34005',
        AIONUI_REMOTE: 'true',
        PATH: '/home/ubuntu/.nvm/versions/node/v24.13.1/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      },
      max_restarts: 30,
      min_uptime: 5000,
      watch: false,
      kill_timeout: 5000,
    },
  ],
};
