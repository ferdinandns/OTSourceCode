// module.exports = {
//   apps: [
//       {
//           name: "index",
//           script: "index.js",
//           cron_restart: "0 6 * * *", // Setiap hari pukul 6 pagi
//           args: ['--max-heap-size=8GB'],
//       },
//   ],
// };

module.exports = {
  apps: [
    {
      name: "index",
      script: "index.js",
      instances: "max",    // <--- 1. Set instances to "max" (or a number like 2, 4)
      exec_mode: "cluster", // <--- 2. Explicitly set mode to "cluster"
      cron_restart: "0 6 * * *", 
      
      // ⚠️ IMPORTANT FIX: 
      // V8 flags like heap size must go in 'node_args', not 'args'.
      // 'args' is for script arguments; 'node_args' is for Node.js engine flags.
      node_args: "--max-old-space-size=8192", // 8GB in MB
      
      autorestart: true,
      max_memory_restart: "2G", 
    },
  ],
};
