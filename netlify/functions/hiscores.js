function sendJson(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(data),
  };
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

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return sendJson(405, { error: "Method not allowed." });
  }

  const player = (event.queryStringParameters?.player || "").trim();
  if (!/^[a-zA-Z0-9 _-]{1,12}$/.test(player)) {
    return sendJson(400, {
      error: "Enter a valid OSRS display name (up to 12 letters, numbers, spaces, _ or -).",
    });
  }

  try {
    const hiscoresUrl = new URL(
      "https://secure.runescape.com/m=hiscore_oldschool/index_lite.json",
    );
    hiscoresUrl.searchParams.set("player", player);
    const data = await fetchJson(hiscoresUrl);

    if (!Array.isArray(data.activities)) {
      return sendJson(502, {
        error: "The OSRS hiscores returned an unexpected response.",
      });
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

    return sendJson(200, {
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
    return sendJson(status, {
      error: status === 404
        ? "That account was not found on the OSRS hiscores."
        : `Could not load this account: ${message}`,
    });
  }
};
