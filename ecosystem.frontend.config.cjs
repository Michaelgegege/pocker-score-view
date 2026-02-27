module.exports = {
  apps: [
    {
      name: 'poker-scorekeeper-frontend',
      script: 'node_modules/vite/bin/vite.js',
      interpreter: 'node',
      args: 'preview --host 0.0.0.0 --port 5173',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_memory_restart: '512M',
      out_file: './logs/frontend-out.log',
      error_file: './logs/frontend-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
