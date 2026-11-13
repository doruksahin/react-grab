/**
 * The page a recording link opens (SPEC-020). rrweb-player is loaded from
 * jsDelivr at a pinned version with Subresource Integrity, so the Worker ships
 * no player code and a changed CDN file is refused by the browser.
 */

const PLAYER_BASE_URL = "https://cdn.jsdelivr.net/npm/rrweb-player@2.2.2";
const PLAYER_SCRIPT_INTEGRITY =
  "sha384-17brZPiXiPP8V8QIkni+PMysKUusdF3emDyHLaqCrqUE9XsDpQMB7rWXRnF6mMNi";
const PLAYER_STYLE_INTEGRITY =
  "sha384-2cCaS5NGITw/fSwdjW6F5YDnyyalL5sITZIQKK0MwTsgrBS798qFpSD+r+S3bI4V";

export const renderReplayPage = (eventsUrl: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>How we got here · React Grab</title>
<link rel="stylesheet" href="${PLAYER_BASE_URL}/dist/style.css" integrity="${PLAYER_STYLE_INTEGRITY}" crossorigin="anonymous">
<style>
  html, body { margin: 0; height: 100%; background: #111; color: #ddd; font: 14px system-ui, sans-serif; }
  body { display: flex; align-items: center; justify-content: center; }
</style>
</head>
<body>
<p id="status">Loading the recording…</p>
<script src="${PLAYER_BASE_URL}/umd/rrweb-player.js" integrity="${PLAYER_SCRIPT_INTEGRITY}" crossorigin="anonymous"></script>
<script>
(async () => {
  const status = document.getElementById("status");
  try {
    const response = await fetch(${JSON.stringify(eventsUrl)});
    if (!response.ok) throw new Error("HTTP " + response.status);
    const json = await new Response(
      response.body.pipeThrough(new DecompressionStream("gzip")),
    ).text();
    const events = JSON.parse(json);
    status.remove();
    const Player = window.rrwebPlayer.default ?? window.rrwebPlayer;
    new Player({
      target: document.body,
      props: {
        events,
        width: Math.min(window.innerWidth - 40, 1280),
        height: Math.min(window.innerHeight - 120, 720),
        autoPlay: true,
      },
    });
  } catch (error) {
    status.textContent = "Could not load the recording: " + error.message;
  }
})();
</script>
</body>
</html>`;
