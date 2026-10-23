document.addEventListener("DOMContentLoaded", () => {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const copyButton = document.getElementById("copyDiscord");
  const discordElement = document.getElementById("discordName");
  const copyStatus = document.getElementById("copyStatus");

  if (!copyButton || !discordElement || !copyStatus) return;

  copyButton.addEventListener("click", async () => {
    const username = discordElement.textContent.trim();
    try {
      if (!navigator.clipboard || !window.isSecureContext) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(username);
      copyStatus.textContent = "Copied! Find me on Discord.";
    } catch (error) {
      copyStatus.textContent = "Username: " + username + ". Press and hold the username above to copy it.";
    }
  });
});
