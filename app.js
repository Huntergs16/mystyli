const img = document.getElementById("screenshot");
const overlay = document.getElementById("overlay");
const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("upload");

document.getElementById("capture").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const screenshotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });
  img.src = screenshotUrl;
});

// Handle file upload
uploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

let isDragging = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;

img.addEventListener("mousedown", (e) => {
  if (!img.complete || img.naturalWidth === 0) return;
  isDragging = true;

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
    // Lightly filter near black, white, and gray
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
