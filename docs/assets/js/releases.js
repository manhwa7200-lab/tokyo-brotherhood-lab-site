/* APK releases page for What's Next.
 *
 * Data source order:
 *   1. ../../data/releases.json  - snapshot written by the "Update release data"
 *      GitHub Action (no API rate limit for visitors).
 *   2. GitHub's public Releases API - used when the snapshot is missing or is
 *      still the empty placeholder.
 *
 * Everything is built with DOM nodes / textContent (never innerHTML), so release
 * notes cannot inject markup.
 */
(function () {
  "use strict";

  var SNAPSHOT_URL = "../../data/releases.json";
  var LIVE_API = "https://api.github.com/repos/tokyo720022-create/What-Next/releases?per_page=100&page=";
  var OFFICIAL_RELEASES_URL = "https://github.com/tokyo720022-create/What-Next/releases";
  var MAX_PAGES = 20;
  var LONG_NOTES = 500;

  var releaseList = document.getElementById("releaseList");
  var releaseStatus = document.getElementById("releaseStatus");
  if (!releaseList || !releaseStatus) return;

  /* ---------- small helpers ---------- */

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function safeUrl(value, hostRule) {
    try {
      var parsed = new URL(value);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
      if (hostRule && !hostRule(parsed)) return null;
      return parsed.href;
    } catch (error) {
      return null;
    }
  }

  function githubUrl(value) {
    return safeUrl(value, function (u) {
      return u.protocol === "https:" && u.hostname === "github.com";
    }) || OFFICIAL_RELEASES_URL;
  }

  function externalLink(url, label) {
    var link = element("a", "", label);
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }

  function formatDate(value) {
    if (!value) return "Date not listed";
    var date = new Date(value);
    if (isNaN(date.getTime())) return "Date not listed";
    return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
  }

  function formatSize(bytes) {
    if (bytes === null || bytes === undefined || bytes === "" || !Number.isFinite(Number(bytes)) || Number(bytes) < 0) {
      return "Size not listed";
    }
    var mb = Number(bytes) / (1024 * 1024);
    return mb < 0.01 ? String(bytes) + " bytes" : mb.toFixed(mb >= 100 ? 0 : 2) + " MB";
  }

  function timeOf(value) {
    var t = Date.parse(value || "");
    return isNaN(t) ? 0 : t;
  }

  /* ---------- minimal, safe Markdown for release notes ---------- */

  var INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>]*[^\s<>.,;:!?)'"\]])/g;

  function appendInline(parent, text) {
    var last = 0;
    var match;
    INLINE.lastIndex = 0;
    while ((match = INLINE.exec(text)) !== null) {
      if (match.index > last) parent.appendChild(document.createTextNode(text.slice(last, match.index)));
      if (match[1] !== undefined) {
        parent.appendChild(element("code", "", match[1]));
      } else if (match[2] !== undefined) {
        parent.appendChild(element("strong", "", match[2]));
      } else {
        var label = match[3] !== undefined ? match[3] : match[5];
        var url = safeUrl(match[3] !== undefined ? match[4] : match[5]);
        parent.appendChild(url ? externalLink(url, label) : document.createTextNode(label));
      }
      last = INLINE.lastIndex;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }

  function renderNotes(container, markdown) {
    var lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
    var paragraph = [];
    var list = null;
    var quote = null;
    var i = 0;

    function flushParagraph() {
      if (!paragraph.length) return;
      var p = element("p");
      appendInline(p, paragraph.join("\n"));
      container.appendChild(p);
      paragraph = [];
    }
    function flushAll() {
      flushParagraph();
      list = null;
      quote = null;
    }

    while (i < lines.length) {
      var line = lines[i];
      var m;

      if (/^\s*```/.test(line)) {                       // fenced code block
        flushAll();
        var code = [];
        i += 1;
        while (i < lines.length && !/^\s*```/.test(lines[i])) { code.push(lines[i]); i += 1; }
        var pre = element("pre");
        pre.appendChild(element("code", "", code.join("\n")));
        container.appendChild(pre);
        i += 1;
        continue;
      }
      if (!line.trim()) { flushAll(); i += 1; continue; }
      if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) { flushAll(); i += 1; continue; }   // horizontal rule

      if ((m = line.match(/^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/))) {                    // heading
        flushAll();
        var h = element("h3");
        appendInline(h, m[1]);
        container.appendChild(h);
        i += 1;
        continue;
      }
      if ((m = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/))) {                        // list item
        flushParagraph();
        quote = null;
        var ordered = /\d/.test(m[1]);
        if (!list || list.ordered !== ordered) {
          list = { ordered: ordered, node: element(ordered ? "ol" : "ul") };
          container.appendChild(list.node);
        }
        var li = element("li");
        appendInline(li, m[2]);
        list.node.appendChild(li);
        i += 1;
        continue;
      }
      if ((m = line.match(/^\s*>\s?(.*)$/))) {                                       // block quote
        flushParagraph();
        list = null;
        if (!quote) { quote = element("blockquote"); container.appendChild(quote); }
        var qp = element("p");
        appendInline(qp, m[1]);
        quote.appendChild(qp);
        i += 1;
        continue;
      }
      list = null;
      quote = null;
      paragraph.push(line.trim());
      i += 1;
    }
    flushAll();
  }

  /* ---------- rendering ---------- */

  function emptyMessage(title, message, fallbackUrl) {
    releaseList.replaceChildren();
    var box = element("div", "empty-state");
    box.appendChild(element("strong", "", title));
    box.appendChild(element("p", "", message));
    if (fallbackUrl) box.appendChild(externalLink(fallbackUrl, "View official GitHub releases ↗")).className = "text-link";
    releaseList.appendChild(box);
  }

  function renderEntry(entry, isLatest) {
    var release = entry.release;
    var asset = entry.asset;
    var isDebug = /debug/i.test(asset.name || "");

    var card = element("article", "release-card");
    var head = element("div", "release-card-head");
    var titleWrap = element("div");
    titleWrap.appendChild(element("div", "release-tag", release.tag_name || "GitHub release"));
    titleWrap.appendChild(element("h2", "", release.name || release.tag_name || "APK release"));
    head.appendChild(titleWrap);

    var badges = element("div", "release-badges");
    if (isLatest) badges.appendChild(element("span", "release-badge latest", "Latest APK"));
    if (release.prerelease) badges.appendChild(element("span", "release-badge", "Pre-release"));
    if (isDebug) badges.appendChild(element("span", "release-badge debug", "Debug / test build"));
    head.appendChild(badges);
    card.appendChild(head);

    var meta = element("div", "release-meta");
    meta.appendChild(element("span", "", "APK uploaded: " + formatDate(asset.created_at || asset.updated_at || release.published_at)));
    meta.appendChild(element("span", "", "File size: " + formatSize(asset.size)));
    meta.appendChild(element("span", "", "Downloads: " + Number(asset.download_count || 0).toLocaleString()));
    card.appendChild(meta);

    var body = release.body && release.body.trim() ? release.body.trim() : "";
    var notes = element("div", "release-notes");
    if (!body) {
      notes.appendChild(element("p", "", "No release notes were provided for this build."));
    } else if (body.length > LONG_NOTES) {
      var details = element("details");
      details.appendChild(element("summary", "", "Release notes"));
      renderNotes(details, body);
      notes.appendChild(details);
    } else {
      renderNotes(notes, body);
    }
    card.appendChild(notes);

    var assetBox = element("div", "asset-box");
    var assetInfo = element("div", "asset-info");
    assetInfo.appendChild(element("div", "asset-name", asset.name || "APK file"));
    assetInfo.appendChild(element("div", "asset-description", "Android application package · " + formatSize(asset.size)));
    assetBox.appendChild(assetInfo);

    var download = element("a", "download-button", "Download APK ↓");
    download.href = githubUrl(asset.browser_download_url);
    download.rel = "noopener noreferrer";
    download.setAttribute("aria-label", "Download " + (asset.name || "APK file"));
    assetBox.appendChild(download);
    card.appendChild(assetBox);

    var actions = element("div", "release-actions");
    var releaseLink = externalLink(githubUrl(release.html_url), "Release page and notes ↗");
    releaseLink.className = "text-link";
    actions.appendChild(releaseLink);
    card.appendChild(actions);

    if (asset.digest && /^sha256:/i.test(asset.digest)) {
      var checksum = element("details", "checksum");
      checksum.appendChild(element("summary", "", "Show SHA-256 checksum"));
      checksum.appendChild(element("code", "", asset.digest.replace(/^sha256:/i, "")));
      card.appendChild(checksum);
    }
    return card;
  }

  function buildEntries(releases) {
    var entries = [];
    releases.forEach(function (release) {
      if (!release || release.draft) return;
      (release.assets || []).forEach(function (asset) {
        if (asset && asset.name && /\.apk$/i.test(asset.name) && asset.browser_download_url) {
          entries.push({ release: release, asset: asset });
        }
      });
    });
    // Newest release first; the asset's own date breaks ties inside one release.
    entries.sort(function (a, b) {
      var byRelease = timeOf(b.release.published_at || b.release.created_at) - timeOf(a.release.published_at || a.release.created_at);
      if (byRelease) return byRelease;
      var byAsset = timeOf(b.asset.created_at || b.asset.updated_at) - timeOf(a.asset.created_at || a.asset.updated_at);
      return byAsset || String(a.asset.name).localeCompare(String(b.asset.name));
    });
    return entries;
  }

  // "Latest" = newest stable, non-debug APK; falls back to the newest non-debug APK.
  function latestIndex(entries) {
    var fallback = -1;
    for (var i = 0; i < entries.length; i += 1) {
      if (/debug/i.test(entries[i].asset.name)) continue;
      if (!entries[i].release.prerelease) return i;
      if (fallback === -1) fallback = i;
    }
    return fallback;
  }

  function render(releases, syncedAt) {
    var entries = buildEntries(releases);
    releaseList.replaceChildren();
    if (!entries.length) {
      releaseStatus.textContent = "No APK files found in the published release list.";
      emptyMessage("No APKs published yet", "When an Android APK is attached to a published What's Next release, it will appear here automatically.", OFFICIAL_RELEASES_URL);
      return;
    }
    var text = entries.length + " APK file" + (entries.length === 1 ? "" : "s") + " found across the published GitHub releases.";
    if (syncedAt) text += " Release data last updated: " + formatDate(syncedAt) + ".";
    releaseStatus.textContent = text;

    var latest = latestIndex(entries);
    entries.forEach(function (entry, index) {
      releaseList.appendChild(renderEntry(entry, index === latest));
    });
  }

  /* ---------- data loading ---------- */

  async function loadSnapshot() {
    try {
      var response = await fetch(SNAPSHOT_URL, { cache: "no-cache" });
      if (!response.ok) return null;
      var data = await response.json();
      if (!data || typeof data.updated_at !== "string" || !Array.isArray(data.releases)) return null;
      return data;
    } catch (error) {
      return null;
    }
  }

  async function loadLive() {
    var all = [];
    var page = 1;
    var batch;
    do {
      var response = await fetch(LIVE_API + page, { headers: { "Accept": "application/vnd.github+json" } });
      if (!response.ok) throw new Error("GitHub returned " + response.status);
      batch = await response.json();
      if (!Array.isArray(batch)) throw new Error("Unexpected release response");
      all = all.concat(batch);
      page += 1;
    } while (batch.length === 100 && page <= MAX_PAGES);
    return all;
  }

  async function loadReleases() {
    try {
      var snapshot = await loadSnapshot();
      if (snapshot) {
        render(snapshot.releases, snapshot.updated_at);
      } else {
        render(await loadLive(), null);
      }
    } catch (error) {
      releaseStatus.textContent = "The automatic release list could not be loaded right now.";
      emptyMessage("Couldn't load releases", "You can still browse the published builds directly on GitHub. The release list here will retry when the page is refreshed.", OFFICIAL_RELEASES_URL);
    }
  }

  loadReleases();
}());
