module.exports = {
  apps: [
      {
          name: "index",
          script: "index.js",
          cron_restart: "0 6 * * *", // Setiap hari pukul 6 pagi
          args: ['--max-heap-size=8GB'],
      },
  ],
};
