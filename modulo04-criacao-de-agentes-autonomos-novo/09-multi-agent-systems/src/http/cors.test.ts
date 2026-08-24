import assert from "node:assert/strict";
import type { Server } from "node:http";
import test from "node:test";
import express from "express";

import { createCorsMiddleware } from "./cors.js";

async function withServer(
  app: express.Express,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server: Server = await new Promise((resolve, reject) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
    s.on("error", reject);
  });
  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("bind failed");
    }
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("CORS default: any Origin is reflected", async () => {
  const app = express();
  app.use(createCorsMiddleware());
  app.post("/chat", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  await withServer(app, async (baseUrl) => {
    const options = await fetch(`${baseUrl}/chat`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    assert.equal(options.status, 204);
    assert.equal(
      options.headers.get("access-control-allow-origin"),
      "http://localhost:5173",
    );

    const post = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: {
        Origin: "http://evil.example",
        "content-type": "application/json",
      },
      body: "{}",
    });
    assert.equal(post.status, 200);
    assert.equal(post.headers.get("access-control-allow-origin"), "http://evil.example");
  });
});

test("CORS allowlist: unknown origin is not reflected", async () => {
  const app = express();
  app.use(createCorsMiddleware(["http://localhost:5173"]));
  app.post("/chat", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  await withServer(app, async (baseUrl) => {
    const post = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: {
        Origin: "http://evil.example",
        "content-type": "application/json",
      },
      body: "{}",
    });
    assert.equal(post.status, 200);
    assert.equal(post.headers.get("access-control-allow-origin"), null);
  });
});

test("CORS allowlist: OPTIONS and POST set ACAO", async () => {
  const app = express();
  app.use(createCorsMiddleware(["http://localhost:5173"]));
  app.post("/chat", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  await withServer(app, async (baseUrl) => {
    const options = await fetch(`${baseUrl}/chat`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
      },
    });
    assert.equal(options.status, 204);
    assert.equal(
      options.headers.get("access-control-allow-origin"),
      "http://localhost:5173",
    );
  });
});
