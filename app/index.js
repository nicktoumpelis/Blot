const async = require("async");
const fs = require("fs-extra");
const config = require("config");
const cluster = require("cluster");
const clfdate = require("helper").clfdate;

if (cluster.isMaster) {
  const NUMBER_OF_CORES = require("os").cpus().length;
  const scheduler = require("./scheduler");

  console.log(
    clfdate(),
    `Starting pid=${process.pid} environment=${config.environment} cache=${config.cache}`
  );

  // Write the master process PID so we can signal it
  fs.writeFileSync(config.pidfile, process.pid, "utf-8");

  // Launch scheduler for background tasks, like backups, emails
  scheduler();

  // Fork workers.
  for (let i = 0; i < NUMBER_OF_CORES; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    if (worker.exitedAfterDisconnect === false) {
      console.log(clfdate(), "Worker died unexpectedly, starting a new one");
      cluster.fork();
    }
  });

  // SIGUSR1 is used by node for debugging, so we use SIGUSR2 to
  // signal the master process that it's time to reboot the servers
  process.on("SIGUSR2", function () {
    let workerIDs = Object.keys(cluster.workers);
    let totalWorkers = workerIDs.length;

    console.log(
      clfdate(),
      `Recieved signal to replace ${totalWorkers} workers`
    );

    async.eachSeries(
      workerIDs,
      function (workerID, next) {
        let worker;
        let workerIndex = workerIDs.indexOf(workerID) + 1;
        let replacementWorker;
        let timeout;

        console.log(
          clfdate(),
          `Replacing worker ${workerIndex}/${totalWorkers}`
        );

        worker = cluster.workers[workerID];

        worker.on("disconnect", function () {
          clearTimeout(timeout);
        });

        worker.disconnect();

        timeout = setTimeout(() => {
          worker.kill();
        }, 2000);

        replacementWorker = cluster.fork();

        replacementWorker.on("listening", function () {
          console.log(
            clfdate(),
            `Replaced worker ${workerIndex}/${totalWorkers}`
          );
          workerID++;
          next();
        });
      },
      function () {
        console.log(clfdate(), `Replaced all workers`);
      }
    );
  });
} else {
  console.log(clfdate(), `Worker process running pid=${process.pid}`);

  // Open the server to handle requests
  require("./server").listen(config.port, function () {
    console.log(
      clfdate(),
      `Worker process listening pid=${process.pid} port=${config.port}`
    );
  });
}
