const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}

async function fetchJson(url) {
  const result = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "OSRS-Boss-Log/1.0",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!result.ok) {
    throw new Error(`Upstream service returned ${result.status}.`);
  }

  return result.json();
}

async function getBossImages(bosses) {
  const imageByName = new Map();
  const batches = [];

  for (let index = 0; index < bosses.length; index += 50) {
    batches.push(bosses.slice(index, index + 50));
  }

  await Promise.all(
    batches.map(async (batch) => {
      const params = new URLSearchParams({
        action: "query",
        format: "json",
        pithumbsize: "128",
        prop: "pageimages",
        redirects: "1",
        titles: batch.map((boss) => boss.name).join("|"),
      });
      const data = await fetchJson(
        `https://oldschool.runescape.wiki/api.php?${params.toString()}`,
      );

      for (const page of Object.values(data.query?.pages || {})) {
        if (page.thumbnail?.source) {
          imageByName.set(page.title.toLowerCase(), page.thumbnail.source);
        }
      }
    }),
  );

  return imageByName;
}

async function handleHiscores(response, requestUrl) {
  const player = (requestUrl.searchParams.get("player") || "").trim();

  if (!/^[a-zA-Z0-9 _-]{1,12}$/.test(player)) {
    sendJson(response, 400, {
      error: "Enter a valid OSRS display name (up to 12 letters, numbers, spaces, _ or -).",
    });
    return;
  }

  try {
    const hiscoresUrl = new URL(
      "https://secure.runescape.com/m=hiscore_oldschool/index_lite.json",
    );
    hiscoresUrl.searchParams.set("player", player);
    const data = await fetchJson(hiscoresUrl);

    if (!Array.isArray(data.activities)) {
      sendJson(response, 502, {
        error: "The OSRS hiscores returned an unexpected response.",
      });
      return;
    }

    const bosses = data.activities
      .filter((activity) => activity.id >= 20 && activity.name !== "Lunar Chests")
      .map((activity) => ({
        name: activity.name,
        kc: Math.max(0, activity.score),
        rank: activity.rank,
      }));
    const collectionLogCount = Math.max(
      0,
      data.activities.find((activity) => activity.name === "Collections Logged")?.score || 0,
    );

    let iconWarning = "";
    try {
      const images = await getBossImages(bosses);
      for (const boss of bosses) {
        boss.icon = images.get(boss.name.toLowerCase()) || "";
      }
    } catch (error) {
      iconWarning = "Boss stats loaded, but the OSRS Wiki portraits could not be reached.";
      console.error("Could not load boss portraits:", error.message);
    }

    sendJson(response, 200, {
      player: data.name || player,
      bosses,
      collectionLogCount,
      iconWarning,
    });
  } catch (error) {
    const message = error.name === "TimeoutError"
      ? "The hiscores request timed out. Please try again."
      : error.message;
    const status = message.includes("returned 404") ? 404 : 502;
    sendJson(response, status, {
      error: status === 404
        ? "That account was not found on the OSRS hiscores."
        : `Could not load this account: ${message}`,
    });
  }
}

function serveFile(response, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(ROOT, `.${requestedPath}`);

  if (!filePath.startsWith(`${ROOT}${path.sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end(error.code === "ENOENT" ? "Not found" : "Could not read file");
      return;
    }

    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(content);
  });
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && requestUrl.pathname === "/api/hiscores") {
    handleHiscores(response, requestUrl);
    return;
  }

  if (request.method !== "GET") {
    response.writeHead(405, { Allow: "GET" });
    response.end("Method not allowed");
    return;
  }

  serveFile(response, requestUrl.pathname);
});

server.listen(PORT, () => {
  console.log(`OSRS Boss Log is running at http://localhost:${PORT}`);
});
