document.addEventListener("DOMContentLoaded", () => {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const copyButton = document.getElementById("copyDiscord");
  const discordElement = document.getElementById("discordName");
  const copyStatus = document.getElementById("copyStatus");

  if (!copyButton || !discordElement || !copyStatus) return;

  // Highlight the username so it can be copied by hand if automatic copy fails.
  function selectUsername() {
    const range = document.createRange();
    range.selectNodeContents(discordElement);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // Fallback for browsers/contexts without the async Clipboard API.
  function legacyCopy() {
    try {
      selectUsername();
      return document.execCommand("copy");
    } catch (error) {
      return false;
    }
  }

  copyButton.addEventListener("click", async () => {
    const username = discordElement.textContent.trim();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(username);
      } else if (!legacyCopy()) {
        throw new Error("Copy is not available");
      }
      copyStatus.textContent = "Copied! Find me on Discord.";
    } catch (error) {
      selectUsername();
      copyStatus.textContent =
        "Username: " + username + ". It is selected above. Press Ctrl+C (Cmd+C on Mac) or long-press to copy it.";
    }
  });
});
