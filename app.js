document.getElementById("capture").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const screenshotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });
    const img = document.getElementById("screenshot");
    img.src = screenshotUrl;
  } catch (err) {
    console.error("Screenshot failed:", err);
  }
});

const img = document.getElementById("screenshot");
const overlay = document.getElementById("overlay");

let isDragging = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;

function getImageOffsets(img) {
  // Calculates offset caused by object-fit: contain
  const container = img.getBoundingClientRect();
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const containerAspect = container.width / container.height;

  let renderWidth, renderHeight, offsetX, offsetY;

  if (imgAspect > containerAspect) {
    // Image is wider
    renderWidth = container.width;
    renderHeight = container.width / imgAspect;
    offsetX = 0;
    offsetY = (container.height - renderHeight) / 2;
  } else {
    // Image is taller
    renderHeight = container.height;
    renderWidth = container.height * imgAspect;
    offsetX = (container.width - renderWidth) / 2;
    offsetY = 0;
  }

  return { renderWidth, renderHeight, offsetX, offsetY };
}

img.addEventListener("mousedown", (e) => {
  if (!img.complete || img.naturalWidth === 0) return;
  isDragging = true;

  const rect = img.getBoundingClientRect();
  startX = e.offsetX;
  startY = e.offsetY;

  overlay.style.left = `${startX}px`;
  overlay.style.top = `${startY}px`;
  overlay.style.width = "0px";
  overlay.style.height = "0px";
  overlay.style.display = "block";
});

img.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  currentX = e.offsetX;
  currentY = e.offsetY;

  const x = Math.min(startX, currentX);
  const y = Math.min(startY, currentY);
  const w = Math.abs(currentX - startX);
  const h = Math.abs(currentY - startY);

  overlay.style.left = `${x}px`;
  overlay.style.top = `${y}px`;
  overlay.style.width = `${w}px`;
  overlay.style.height = `${h}px`;
});

img.addEventListener("mouseup", (e) => {
  if (!isDragging) return;
  isDragging = false;
  overlay.style.display = "none";

  const rect = img.getBoundingClientRect();
  const scaleX = img.naturalWidth / rect.width;
  const scaleY = img.naturalHeight / rect.height;

  const x = Math.min(startX, currentX);
  const y = Math.min(startY, currentY);
  const w = Math.abs(currentX - startX);
  const h = Math.abs(currentY - startY);

  if (w < 5 || h < 5) return;

  const realX = x * scaleX;
  const realY = y * scaleY;
  const realW = w * scaleX;
  const realH = h * scaleY;

  cropAndAnalyze(img, realX, realY, realW, realH);
});

function cropAndAnalyze(image, x, y, w, h) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(image, x, y, w, h, 0, 0, w, h);

  const data = ctx.getImageData(0, 0, w, h).data;
  const topColors = getTopColors(data);
  displayColors(topColors);
}

function getTopColors(data) {
  const colorCount = {};
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const brightness = (r + g + b) / 3;
    if (
      brightness > 240 ||
      brightness < 20 ||
      (Math.abs(r - g) < 15 && Math.abs(g - b) < 15)
    )
      continue;
    const key = `${r},${g},${b}`;
    colorCount[key] = (colorCount[key] || 0) + 1;
  }
  const sorted = Object.entries(colorCount).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 5).map(([rgb]) => rgb.split(",").map(Number));
}

function displayColors(colors) {
  const container = document.getElementById("colors");
  container.innerHTML = "";
  colors.forEach(([r, g, b]) => {
    const box = document.createElement("div");
    box.className = "color-box";
    box.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    container.appendChild(box);
  });
}
