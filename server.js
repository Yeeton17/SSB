const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { handler: generate } = require("./netlify/functions/generate");

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);
const maxRequestBytes = 256 * 1024;
const staticFiles = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
};

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error("PORT must be an integer between 0 and 65535.");
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytesRead = 0;
    let tooLarge = false;

    request.on("data", (chunk) => {
      if (tooLarge) return;

      bytesRead += chunk.length;
      if (bytesRead > maxRequestBytes) {
        tooLarge = true;
        reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
        request.resume();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      if (!tooLarge) resolve(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", reject);
  });
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  const pathname = (request.url || "/").split("?")[0];

  if (pathname === "/.netlify/functions/generate") {
    if (request.method !== "POST") {
      response.writeHead(405, { Allow: "POST" });
      response.end("Method Not Allowed");
      return;
    }

    try {
      const result = await generate({
        httpMethod: request.method,
        body: await readRequestBody(request),
      });
      response.writeHead(result.statusCode, result.headers || {});
      response.end(result.body);
    } catch (error) {
      if (error.statusCode === 413) {
        sendJson(response, 413, { error: error.message });
        return;
      }

      console.error("Failed to handle generation request:", error);
      sendJson(response, 500, { error: "Internal server error." });
    }
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method Not Allowed");
    return;
  }

  const file = staticFiles[pathname];
  if (!file) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not Found");
    return;
  }

  fs.readFile(path.join(__dirname, file[0]), (error, contents) => {
    if (error) {
      console.error(`Failed to serve ${file[0]}:`, error);
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Internal Server Error");
      return;
    }

    response.writeHead(200, {
      "Content-Type": file[1],
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : contents);
  });
});

server.listen(port, host, () => {
  const address = server.address();
  console.log(`Smart Study Buddy is running at http://${host}:${address.port}`);
});