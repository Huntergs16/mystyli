const img = document.getElementById("screenshot");
const overlay = document.getElementById("overlay");

const colorInfo = {
  hex: document.getElementById("hexVal"),
  rgb: document.getElementById("rgbVal"),
  hsl: document.getElementById("hslVal"),
};

document.getElementById("capture").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const screenshotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });
  img.src = screenshotUrl;
});

document.getElementById("upload").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => (img.src = event.target.result);
    reader.readAsDataURL(file);
  }
});

let isDragging = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;

// Helper to compute correct image mapping
function getImageDisplayMetrics() {
  const wrapper = document
    .getElementById("imageWrapper")
    .getBoundingClientRect();
  const imageRatio = img.naturalWidth / img.naturalHeight;
  const wrapperRatio = wrapper.width / wrapper.height;

  let displayWidth, displayHeight;
  if (imageRatio > wrapperRatio) {
    // Image fills width, black bars top/bottom
    displayWidth = wrapper.width;
    displayHeight = wrapper.width / imageRatio;
  } else {
    // Image fills height, black bars sides
    displayHeight = wrapper.height;
    displayWidth = wrapper.height * imageRatio;
  }

  const offsetX = (wrapper.width - displayWidth) / 2;
  const offsetY = (wrapper.height - displayHeight) / 2;

  return { wrapper, displayWidth, displayHeight, offsetX, offsetY };
}

img.addEventListener("mousedown", (e) => {
  if (!img.complete || img.naturalWidth === 0) return;
  isDragging = true;

  const { wrapper, offsetX, offsetY } = getImageDisplayMetrics();
  startX = e.clientX - wrapper.left - offsetX;
  startY = e.clientY - wrapper.top - offsetY;

  overlay.style.left = `${e.clientX - wrapper.left}px`;
  overlay.style.top = `${e.clientY - wrapper.top}px`;
  overlay.style.width = "0px";
  overlay.style.height = "0px";
  overlay.style.display = "block";
});

img.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  const { wrapper, offsetX, offsetY } = getImageDisplayMetrics();

  currentX = e.clientX - wrapper.left - offsetX;
  currentY = e.clientY - wrapper.top - offsetY;

  const x = Math.min(startX, currentX);
  const y = Math.min(startY, currentY);
  const w = Math.abs(currentX - startX);
  const h = Math.abs(currentY - startY);

  overlay.style.left = `${x + offsetX}px`;
  overlay.style.top = `${y + offsetY}px`;
  overlay.style.width = `${w}px`;
  overlay.style.height = `${h}px`;
});

img.addEventListener("mouseup", (e) => {
  if (!isDragging) return;
  isDragging = false;

  const { wrapper, displayWidth, displayHeight, offsetX, offsetY } =
    getImageDisplayMetrics();

  const x = Math.min(startX, currentX);
  const y = Math.min(startY, currentY);
  const w = Math.abs(currentX - startX);
  const h = Math.abs(currentY - startY);

  if (w < 5 || h < 5) return;

  const scaleX = img.naturalWidth / displayWidth;
  const scaleY = img.naturalHeight / displayHeight;

  const realX = x * scaleX;
  const realY = y * scaleY;
  const realW = w * scaleX;
  const realH = h * scaleY;

  overlay.style.display = "block"; // keep visible
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
    const key = `${r},${g},${b}`;
    colorCount[key] = (colorCount[key] || 0) + 1;
  }
  const sorted = Object.entries(colorCount).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 5).map(([rgb]) => rgb.split(",").map(Number));
}

function displayColors(colors) {
  const container = document.getElementById("colors");
  container.innerHTML = "";
  colorInfo.hex.textContent = "";
  colorInfo.rgb.textContent = "";
  colorInfo.hsl.textContent = "";

  colors.forEach(([r, g, b]) => {
    const box = document.createElement("div");
    box.className = "color-box";
    box.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    box.addEventListener("click", () => {
      const hex = rgbToHex(r, g, b);
      const hsl = rgbToHsl(r, g, b);
      colorInfo.hex.textContent = `HEX: ${hex}`;
      colorInfo.rgb.textContent = `RGB: ${r}, ${g}, ${b}`;
      colorInfo.hsl.textContent = `HSL: ${hsl}`;
    });
    container.appendChild(box);
  });
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return `(${(h * 360).toFixed(1)}, ${(s * 100).toFixed(1)}%, ${(
    l * 100
  ).toFixed(1)}%)`;
}
