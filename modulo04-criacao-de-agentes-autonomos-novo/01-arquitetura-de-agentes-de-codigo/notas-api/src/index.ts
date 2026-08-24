import { createServer } from "node:http";

import { createTaskApp } from "./factories/task-app.js";

const port = 3000;
const { httpHandler } = createTaskApp();

const server = createServer((request, response) => {
  void httpHandler(request, response);
});

server.listen(port, () => {
  console.log(`HTTP server listening on http://localhost:${port}`);
});
