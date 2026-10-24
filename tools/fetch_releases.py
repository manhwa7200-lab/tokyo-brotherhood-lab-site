#!/usr/bin/env python3
"""Snapshot the public GitHub releases of What-Next into docs/data/releases.json.

The releases page reads this file instead of calling the GitHub API from every
visitor's browser (which is rate-limited to 60 requests/hour per IP).

The file is only rewritten when something visible changed, or when it is more
than 24 hours old (to refresh download counts), so the repo does not collect a
commit on every run.

Environment (all optional):
  GITHUB_TOKEN / GH_TOKEN   token for a higher API rate limit (set by the workflow)
  RELEASES_REPO             owner/name, default tokyo720022-create/What-Next
  RELEASES_API_URL          override the API URL (used by tests)
  RELEASES_OUT              output path, default docs/data/releases.json
"""
import copy
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

REPO = os.environ.get("RELEASES_REPO", "tokyo720022-create/What-Next")
API = os.environ.get("RELEASES_API_URL", "https://api.github.com/repos/%s/releases" % REPO)
OUT = os.environ.get("RELEASES_OUT", "docs/data/releases.json")
TOKEN = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
MAX_AGE = timedelta(hours=24)
MAX_PAGES = 20


def request_json(url):
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "tokyo-brotherhood-lab-site-release-snapshot",
    }
    if TOKEN:
        headers["Authorization"] = "Bearer " + TOKEN
    last_error = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code < 500 and error.code != 429:
                break                                  # 4xx: retrying will not help
        except (urllib.error.URLError, TimeoutError) as error:
            last_error = error
        time.sleep(2 * (attempt + 1))
    raise RuntimeError("Could not fetch %s: %s" % (url, last_error))


def fetch_all():
    releases = []
    for page in range(1, MAX_PAGES + 1):
        batch = request_json("%s?per_page=100&page=%d" % (API, page))
        if not isinstance(batch, list):
            raise RuntimeError("Unexpected API response (not a list)")
        releases.extend(batch)
        if len(batch) < 100:
            break
    return releases


def trim(release):
    """Keep only what the page uses, and only APK assets."""
    assets = []
    for asset in release.get("assets") or []:
        name = asset.get("name") or ""
        if not name.lower().endswith(".apk") or not asset.get("browser_download_url"):
            continue
        assets.append({
            "name": name,
            "size": asset.get("size"),
            "download_count": asset.get("download_count", 0),
            "browser_download_url": asset.get("browser_download_url"),
            "created_at": asset.get("created_at"),
            "updated_at": asset.get("updated_at"),
            "digest": asset.get("digest"),
        })
    return {
        "tag_name": release.get("tag_name"),
        "name": release.get("name"),
        "body": release.get("body"),
        "prerelease": bool(release.get("prerelease")),
        "draft": bool(release.get("draft")),
        "html_url": release.get("html_url"),
        "published_at": release.get("published_at"),
        "assets": assets,
    }


def without_counts(releases):
    clean = copy.deepcopy(releases)
    for release in clean:
        for asset in release.get("assets", []):
            asset.pop("download_count", None)
    return clean


def load_existing():
    try:
        with open(OUT, encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def parse_time(value):
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (AttributeError, ValueError):
        return None


def main():
    releases = [trim(r) for r in fetch_all() if not r.get("draft")]
    releases = [r for r in releases if r["assets"]]
    releases.sort(key=lambda r: r.get("published_at") or "", reverse=True)

    existing = load_existing()
    old_releases = existing.get("releases")
    old_time = parse_time(existing.get("updated_at"))
    now = datetime.now(timezone.utc)

    changed = not isinstance(old_releases, list) or without_counts(old_releases) != without_counts(releases)
    stale = old_time is None or now - old_time > MAX_AGE
    if not (changed or stale):
        print("Release data unchanged (%d releases with APKs)." % len(releases))
        return 0

    payload = {
        "updated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "https://github.com/%s/releases" % REPO,
        "releases": releases,
    }
    os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    print("Wrote %s (%d releases with APKs, %s)." % (OUT, len(releases), "changed" if changed else "refreshed counts"))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:                         # fail the workflow run visibly
        print("ERROR: %s" % error, file=sys.stderr)
        sys.exit(1)
