/**
 * =============================================================================
 * Headless WhatsApp Interface - PM2 Configuration
 * =============================================================================
 * Usage:
 *   Start:   pm2 start ecosystem.config.js
 *   Stop:    pm2 stop whatsapp-interface
 *   Restart: pm2 restart whatsapp-interface
 *   Logs:    pm2 logs whatsapp-interface
 *   Monitor: pm2 monit
 * =============================================================================
 */

module.exports = {
  apps: [
    {
      // Application name
      name: "whatsapp-interface",

      // Start script (Next.js production server)
      script: "npm",
      args: "start",

      // Working directory
      cwd: "./",

      // Environment variables
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },

      // Production environment variables
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },

      // Cluster mode for multi-core utilization
      // Set to 'max' to use all available cores
      // Or set to a specific number (e.g., 2)
      instances: 1,

      // Enable cluster mode
      exec_mode: "fork",

      // Auto-restart on crash
      autorestart: true,

      // Watch for file changes (disable in production)
      watch: false,

      // Maximum memory before restart (optional)
      max_memory_restart: "500M",

      // Log configuration
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      merge_logs: true,

      // Restart delay (ms)
      restart_delay: 5000,

      // Maximum restart attempts
      max_restarts: 10,

      // Minimum uptime to consider started
      min_uptime: "10s",

      // Kill timeout (ms)
      kill_timeout: 5000,

      // Wait for ready signal
      wait_ready: false,

      // Listen timeout
      listen_timeout: 8000,
    },
  ],

  // Deployment configuration (optional - for PM2 deploy)
  deploy: {
    production: {
      // SSH user
      user: "deploy",

      // Target host(s)
      host: ["your-server.com"],

      // Git reference
      ref: "origin/main",

      // Git repository
      repo: "git@github.com:your-org/whatsapp-interface.git",

      // Target directory
      path: "/var/www/whatsapp-interface",

      // Pre-deploy commands (on local machine)
      "pre-deploy-local": "",

      // Post-deploy commands (on remote server)
      "post-deploy":
        "npm ci && npm run build && pm2 reload ecosystem.config.js --env production",

      // Environment variables
      env: {
        NODE_ENV: "production",
      },
    },
  },
};
