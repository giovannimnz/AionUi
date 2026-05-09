module.exports = {
  apps: [
    {
      name: "hermes-gateway-adapter",
      script: "src/adapter-server.mjs",
      cwd: "/home/ubuntu/GitHub/forks/AionUi/hermes_gateway_adapter",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        ADAPTER_PORT: 8200,
        HERMES_HOME: "/home/ubuntu/.hermes",
        HERMES_CLI: "hermes",
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      watch: false,
      exp_backoff_restart_delay: 100,
    },
  ],
};
