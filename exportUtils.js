// Export utilities: video recording and HTML export

// ============================================================================
// Video Recording
// ============================================================================

function pickMime(preferredFormat) {
  const isSupported = (t) => {
    try {
      return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t);
    } catch {
      return false;
    }
  };

  if (preferredFormat === "mp4") {
    const candidates = [
      "video/mp4;codecs=avc1.42E01E",
      "video/mp4;codecs=avc1",
      "video/mp4",
    ];
    for (const type of candidates) {
      if (isSupported(type)) return { mimeType: type, extension: "mp4" };
    }
  }

  const webmCandidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const type of webmCandidates) {
    if (isSupported(type)) return { mimeType: type, extension: "webm" };
  }

  return null;
}

/**
 * Start recording the canvas as video
 * @param {HTMLCanvasElement} canvas - The canvas to record
 * @param {"webm"|"mp4"} preferredFormat - Preferred container format
 * @returns {Object|null} Recorder object and chunks array, or null if not supported
 */
export function startVideoRecording(canvas, preferredFormat = "webm") {
  if (!canvas || !canvas.captureStream) {
    console.error("Canvas capture not supported");
    return null;
  }

  const fps = 60;
  const stream = canvas.captureStream(fps);
  const chunks = [];

  const picked = pickMime(preferredFormat);
  if (!picked) {
    console.error("No supported recording MIME type found");
    return null;
  }

  const recorder = new MediaRecorder(stream, {
    mimeType: picked.mimeType,
    videoBitsPerSecond: 8000000,
  });
  
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };
  
  recorder.start();

  return { recorder, chunks, mimeType: picked.mimeType, extension: picked.extension, fps };
}

async function probeVideo(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    await new Promise((resolve, reject) => {
      const onMeta = () => resolve();
      const onErr = () => reject(new Error("Failed to read video metadata"));
      video.addEventListener("loadedmetadata", onMeta, { once: true });
      video.addEventListener("error", onErr, { once: true });
    });

    const durationSec = Number.isFinite(video.duration) ? video.duration : null;
    return {
      width: video.videoWidth || null,
      height: video.videoHeight || null,
      durationSec,
      bytes: blob.size,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Download recorded video chunks as a file
 * @param {Blob[]} chunks - Array of video data chunks
 */
export async function downloadVideo(chunks, opts = {}) {
  if (!chunks.length) return;

  const mimeType = opts.mimeType || chunks[0]?.type || "video/webm";
  const extension = opts.extension || (mimeType.includes("mp4") ? "mp4" : "webm");

  const blob = new Blob(chunks, { type: mimeType });
  const url = URL.createObjectURL(blob);

  try {
    const info = await probeVideo(blob);
    if (opts.onInfo) opts.onInfo(info);
  } catch {
    if (opts.onInfo) opts.onInfo(null);
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = `particle-recording-${Date.now()}.${extension}`;
  a.click();

  URL.revokeObjectURL(url);
}

// ============================================================================
// HTML Export
// ============================================================================

/**
 * Export current composition as a single HTML file (served over http/https).
 * @param {Object} settings - Serialized settings object
 */
export async function downloadHtml(settings) {
  const template = await fetch("./standalone-template.html").then((r) => r.text());
  const injected = `const PRESET_SETTINGS = ${JSON.stringify(settings, null, 2)};`;

  const html = template.includes("/* SETTINGS_PLACEHOLDER */")
    ? template.replace("/* SETTINGS_PLACEHOLDER */", injected)
    : `${injected}\n${template}`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `particles-html-${Date.now()}.html`;
  a.click();

  URL.revokeObjectURL(url);
}
