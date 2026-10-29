const form = document.querySelector("#search-form");
const playerInput = document.querySelector("#player-name");
const searchButton = document.querySelector("#search-button");
const message = document.querySelector("#message");
const results = document.querySelector("#results");
const accountName = document.querySelector("#account-name");
const bossCount = document.querySelector("#boss-count");
const collectionLogCount = document.querySelector("#collection-log-count");
const totalKc = document.querySelector("#total-kc");
const bossGrid = document.querySelector("#boss-grid");
const bossFilter = document.querySelector("#boss-filter");
const sortOrder = document.querySelector("#sort-order");
const visibleCount = document.querySelector("#visible-count");
const emptyFilter = document.querySelector("#empty-filter");
const iconWarning = document.querySelector("#icon-warning");

let currentBosses = [];

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

function renderBosses() {
  const query = bossFilter.value.trim().toLocaleLowerCase();
  const filtered = currentBosses.filter((boss) =>
    boss.name.toLocaleLowerCase().includes(query),
  );

  if (sortOrder.value === "kc") {
    filtered.sort((first, second) => second.kc - first.kc || first.name.localeCompare(second.name));
  } else {
    filtered.sort((first, second) => first.name.localeCompare(second.name));
  }

  bossGrid.replaceChildren();
  visibleCount.textContent = `(${filtered.length})`;
  emptyFilter.hidden = filtered.length !== 0;

  for (const boss of filtered) {
    const card = document.createElement("article");
    card.className = "boss-card";

    const portrait = document.createElement("div");
    portrait.className = "boss-portrait";
    if (boss.icon) {
      const image = document.createElement("img");
      image.src = boss.icon;
      image.alt = "";
      image.loading = "lazy";
      image.onerror = () => {
        const placeholder = document.createElement("span");
        placeholder.className = "portrait-placeholder";
        placeholder.textContent = boss.name.charAt(0);
        portrait.replaceChildren(placeholder);
      };
      portrait.append(image);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "portrait-placeholder";
      placeholder.textContent = boss.name.charAt(0);
      portrait.append(placeholder);
    }

    const name = document.createElement("div");
    name.className = "boss-name";
    name.textContent = boss.name;
    name.title = boss.name;

    const kc = document.createElement("div");
    kc.className = `boss-kc${boss.kc === 0 ? " zero" : ""}`;
    kc.textContent = `${formatNumber(boss.kc)} KC`;

    const rank = document.createElement("div");
    rank.className = "boss-rank";
    rank.textContent = boss.rank > 0 ? `Rank #${formatNumber(boss.rank)}` : "Unranked";

    card.append(portrait, name, kc, rank);
    bossGrid.append(card);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const player = playerInput.value.trim();
  if (!player) return;

  searchButton.disabled = true;
  searchButton.querySelector("span").textContent = "Searching...";
  message.hidden = true;
  results.hidden = true;

  try {
    const response = await fetch(`/api/hiscores?player=${encodeURIComponent(player)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");

    currentBosses = data.bosses;
    accountName.textContent = data.player;
    bossCount.textContent = formatNumber(currentBosses.length);
    collectionLogCount.textContent = formatNumber(data.collectionLogCount);
    totalKc.textContent = formatNumber(currentBosses.reduce((sum, boss) => sum + boss.kc, 0));
    bossFilter.value = "";
    iconWarning.textContent = data.iconWarning;
    iconWarning.hidden = !data.iconWarning;
    results.hidden = false;
    renderBosses();
  } catch (error) {
    message.textContent = error.message;
    message.hidden = false;
  } finally {
    searchButton.disabled = false;
    searchButton.querySelector("span").textContent = "Find account";
  }
});

bossFilter.addEventListener("input", renderBosses);
sortOrder.addEventListener("change", renderBosses);
