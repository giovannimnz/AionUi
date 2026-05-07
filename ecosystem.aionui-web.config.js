module.exports = {
  apps: [
    {
      name: 'aionui-web',
      script: '/usr/bin/xvfb-run',
      args: '--auto-servernum --server-args=-screen 0 1280x1024x24 /home/ubuntu/.nvm/versions/node/v24.13.1/bin/node /home/ubuntu/GitHub/forks/AionUi/node_modules/.bin/electron-vite dev -- --webui --remote',
      cwd: '/home/ubuntu/GitHub/forks/AionUi',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
        PATH: '/home/ubuntu/.nvm/versions/node/v24.13.1/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      },
      max_restarts: 30,
      min_uptime: 5000,
      watch: false,
      kill_timeout: 10000,
    },
  ],
};
