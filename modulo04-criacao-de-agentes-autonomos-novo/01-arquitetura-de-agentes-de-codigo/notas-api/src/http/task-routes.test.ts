import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";

import { createTaskApp } from "../factories/task-app.js";
import { InMemoryTaskStore } from "../store/in-memory-task-store.js";

const startServer = async (): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> => {
  let nextId = 1;
  const { httpHandler } = createTaskApp(
    new InMemoryTaskStore(() => `${nextId++}`),
  );
  const server: Server = createServer((request, response) => {
    void httpHandler(request, response);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to determine server address");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
};

test("POST /tasks returns 201 with the created task", async () => {
  const app = await startServer();

  try {
    const response = await fetch(`${app.baseUrl}/tasks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "Buy milk" }),
    });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      id: "1",
      title: "Buy milk",
      status: "open",
    });
  } finally {
    await app.close();
  }
});

test("POST /tasks returns 400 for invalid title", async () => {
  const app = await startServer();

  try {
    const response = await fetch(`${app.baseUrl}/tasks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "   " }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "Validation failed",
      issues: ["Task title is required"],
    });
  } finally {
    await app.close();
  }
});

test("GET /tasks returns all tasks", async () => {
  const app = await startServer();

  try {
    await fetch(`${app.baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Buy milk" }),
    });
    await fetch(`${app.baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Walk dog" }),
    });

    const response = await fetch(`${app.baseUrl}/tasks`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [
      { id: "1", title: "Buy milk", status: "open" },
      { id: "2", title: "Walk dog", status: "open" },
    ]);
  } finally {
    await app.close();
  }
});

test("GET /tasks filters by open and done status", async () => {
  const app = await startServer();

  try {
    await fetch(`${app.baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Buy milk" }),
    });
    await fetch(`${app.baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Walk dog" }),
    });
    await fetch(`${app.baseUrl}/tasks/2/complete`, {
      method: "PATCH",
    });

    const openResponse = await fetch(`${app.baseUrl}/tasks?status=open`);
    const doneResponse = await fetch(`${app.baseUrl}/tasks?status=done`);

    assert.equal(openResponse.status, 200);
    assert.deepEqual(await openResponse.json(), [
      { id: "1", title: "Buy milk", status: "open" },
    ]);
    assert.equal(doneResponse.status, 200);
    assert.deepEqual(await doneResponse.json(), [
      { id: "2", title: "Walk dog", status: "done" },
    ]);
  } finally {
    await app.close();
  }
});

test("GET /tasks returns 400 for an invalid status filter", async () => {
  const app = await startServer();

  try {
    const response = await fetch(`${app.baseUrl}/tasks?status=invalid`);

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "Validation failed");
  } finally {
    await app.close();
  }
});

test("PATCH /tasks/:id/complete returns 200 with the completed task", async () => {
  const app = await startServer();

  try {
    await fetch(`${app.baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Buy milk" }),
    });

    const response = await fetch(`${app.baseUrl}/tasks/1/complete`, {
      method: "PATCH",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      id: "1",
      title: "Buy milk",
      status: "done",
    });
  } finally {
    await app.close();
  }
});

test("PATCH /tasks/:id/complete returns 404 for unknown task", async () => {
  const app = await startServer();

  try {
    const response = await fetch(`${app.baseUrl}/tasks/missing/complete`, {
      method: "PATCH",
    });

    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, 'Task "missing" was not found');
  } finally {
    await app.close();
  }
});

test("DELETE /tasks/:id returns 204 and removes the task", async () => {
  const app = await startServer();

  try {
    await fetch(`${app.baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Buy milk" }),
    });

    const deleteResponse = await fetch(`${app.baseUrl}/tasks/1`, {
      method: "DELETE",
    });
    const listResponse = await fetch(`${app.baseUrl}/tasks`);

    assert.equal(deleteResponse.status, 204);
    assert.equal(await deleteResponse.text(), "");
    assert.deepEqual(await listResponse.json(), []);
  } finally {
    await app.close();
  }
});

test("DELETE /tasks/:id returns 404 for unknown task", async () => {
  const app = await startServer();

  try {
    const response = await fetch(`${app.baseUrl}/tasks/missing`, {
      method: "DELETE",
    });

    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, 'Task "missing" was not found');
  } finally {
    await app.close();
  }
});
