const canvas = document.getElementById("overlayCanvas");
const ctx = canvas.getContext("2d");

const controls = {
  rank1: document.getElementById("rank1"),
  name1: document.getElementById("name1"),
  tone1: document.getElementById("tone1"),
  rank2: document.getElementById("rank2"),
  name2: document.getElementById("name2"),
  tone2: document.getElementById("tone2"),
  rank3: document.getElementById("rank3"),
  name3: document.getElementById("name3"),
  tone3: document.getElementById("tone3"),
  brandText: document.getElementById("brandText"),
  fontFamily: document.getElementById("fontFamily"),
  laurelStyle: document.getElementById("laurelStyle"),
  laurelPreview: document.getElementById("laurelPreview"),
  scale: document.getElementById("scale"),
  textScale: document.getElementById("textScale"),
  nameScale: document.getElementById("nameScale"),
  spacing: document.getElementById("spacing"),
  speed: document.getElementById("speed"),
  glow: document.getElementById("glow"),
  glitter: document.getElementById("glitter"),
  shine: document.getElementById("shine"),
  sparkles: document.getElementById("sparkles"),
  dust: document.getElementById("dust"),
  hologram: document.getElementById("hologram"),
  neon: document.getElementById("neon"),
  fire: document.getElementById("fire"),
  ice: document.getElementById("ice"),
  lightning: document.getElementById("lightning"),
};

const effectKeys = [
  "glow",
  "glitter",
  "shine",
  "sparkles",
  "dust",
  "hologram",
  "neon",
  "fire",
  "ice",
  "lightning",
];

// GIF 변환 시 검은 노이즈를 유발하는 효과들(흩뿌려진 반투명 입자·가산 합성·부드러운 그라데이션).
// 텍스트에 붙는 안정적 효과(glow/hologram/neon)는 GIF에서도 유지한다.
const gifUnsafeEffects = ["glitter", "shine", "sparkles", "dust", "fire", "ice", "lightning"];

const statusEl = document.getElementById("status");
const extraWinnersEl = document.getElementById("extraWinners");
const addExtraWinnerButton = document.getElementById("addExtraWinner");
const params = new URLSearchParams(location.search);

let start = performance.now();
let exporting = false;
let recorder = null;
let recordedChunks = [];
let extraWinners = [{ label: "", name: "", tone: "platinum" }];

const podium = [
  { rankKey: "rank1", key: "name1", toneKey: "tone1", fallbackTone: "gold", labelOffset: -48, scale: 1.08 },
  { rankKey: "rank2", key: "name2", toneKey: "tone2", fallbackTone: "silver", labelOffset: -42, scale: 0.98 },
  { rankKey: "rank3", key: "name3", toneKey: "tone3", fallbackTone: "bronze", labelOffset: -42, scale: 0.98 },
];

const toneTemplates = {
  gold: "금",
  silver: "은",
  bronze: "동",
  platinum: "민트(플래티넘)",
};

const palettes = {
  gold: {
    laurelA: "#ffe88d",
    laurelB: "#a96d13",
    textA: "#fff6bd",
    textB: "#f3bd3d",
    textC: "#9e5d10",
    glow: "rgba(255, 204, 64, 0.84)",
    particle: "#fff0a2",
    shadow: "rgba(45, 27, 4, 0.92)",
  },
  silver: {
    laurelA: "#f7fbff",
    laurelB: "#8a98a4",
    textA: "#ffffff",
    textB: "#cbd7df",
    textC: "#75838e",
    glow: "rgba(216, 235, 246, 0.78)",
    particle: "#eef9ff",
    shadow: "rgba(20, 26, 31, 0.9)",
  },
  bronze: {
    laurelA: "#ffd0a1",
    laurelB: "#87431c",
    textA: "#ffe6cc",
    textB: "#ca7b36",
    textC: "#743314",
    glow: "rgba(229, 118, 45, 0.74)",
    particle: "#ffd0a1",
    shadow: "rgba(44, 20, 7, 0.9)",
  },
  platinum: {
    laurelA: "#d7fff4",
    laurelB: "#57bfae",
    textA: "#f2fffb",
    textB: "#8de6d8",
    textC: "#2b8f83",
    glow: "rgba(117, 245, 223, 0.62)",
    particle: "#cffff6",
    shadow: "rgba(5, 31, 35, 0.9)",
  },
  black: {
    laurelA: "#6f7780",
    laurelB: "#15191e",
    textA: "#f1f4f7",
    textB: "#848d96",
    textC: "#252b31",
    glow: "rgba(190, 200, 210, 0.48)",
    particle: "#d9e0e6",
    shadow: "rgba(0, 0, 0, 0.96)",
  },
};

// 월계관 스타일 정의.
// rx/ry: 반지름 배율, yOffset: 세로 보정, halfSpan: 한쪽 아크 반각(π 단위),
// leafTilt: 잎 기울기(라디안), length/width: [기본값, 테이퍼 가중치],
// rows: 겹쳐 그릴 줄([{ r: 반지름 배율, len: 잎 크기 배율 }])
const laurelStyles = Object.fromEntries(
  Array.from({ length: 16 }, (_, index) => {
    const number = index + 1;
    const padded = String(number).padStart(2, "0");
    return [
      "extra" + padded,
      {
        label: "월계관 " + number,
        source: "extra",
        assetKey: "extra_" + padded,
      },
    ];
  })
);

const fontFamilies = {
  system: "\"Segoe UI\", Pretendard, system-ui, sans-serif",
  gang: "\"NanumGangBuJang\", \"Segoe UI\", Pretendard, system-ui, sans-serif",
  dad: "\"NanumDadLoveLetter\", \"Segoe UI\", Pretendard, system-ui, sans-serif",
};

const seededParticles = Array.from({ length: 96 }, (_, index) => {
  const x = fract(Math.sin(index * 91.13) * 10000);
  const y = fract(Math.sin(index * 37.71 + 4) * 10000);
  const phase = fract(Math.sin(index * 17.41 + 9) * 10000);
  return { x, y, phase, size: 1 + fract(Math.sin(index * 7.9) * 10000) * 3.2 };
});

function fract(value) {
  return value - Math.floor(value);
}

function fontStack(state) {
  return fontFamilies[state.fontFamily] || fontFamilies.system;
}

function canvasFont(weight, size, state, style = "") {
  const prefix = style ? `${style} ` : "";
  return `${prefix}${weight} ${size}px ${fontStack(state)}`;
}

function readState() {
  // 입력값은 비운 그대로 반영한다(기본값으로 되돌리지 않는다).
  // 라벨과 닉네임이 모두 비면 그 슬롯은 그리지 않는다.
  const filledExtraWinners = extraWinners
    .map((item, index) => ({
      rank: item.label.trim(),
      name: item.name.trim(),
      tone: palettes[item.tone] ? item.tone : "platinum",
      labelOffset: -42,
      scale: 0.95,
      extraIndex: index,
    }))
    .filter((item) => item.name || item.rank);

  return {
    winners: [
      ...podium
        .map((item) => ({
          ...item,
          rank: controls[item.rankKey].value.trim(),
          name: controls[item.key].value.trim(),
          tone: palettes[controls[item.toneKey].value] ? controls[item.toneKey].value : item.fallbackTone,
        }))
        .filter((item) => item.name || item.rank),
      ...filledExtraWinners,
    ],
    brandText: controls.brandText.value.trim(),
    fontFamily: fontFamilies[controls.fontFamily.value] ? controls.fontFamily.value : "system",
    laurelStyle: laurelStyles[controls.laurelStyle.value] ? controls.laurelStyle.value : "extra01",
    scale: Number(controls.scale.value) / 100,
    textScale: Number(controls.textScale.value) / 100,
    nameScale: Number(controls.nameScale.value) / 100,
    spacing: Number(controls.spacing.value) / 100,
    speed: Number(controls.speed.value) / 100,
    effects: Object.fromEntries(effectKeys.map((key) => [key, controls[key].checked])),
  };
}

function applyUrlState() {
  if (params.get("overlay") === "1") {
    document.body.classList.add("overlay-mode");
  }

  podium.forEach((item) => {
    if (item.rankKey && params.has(item.rankKey)) controls[item.rankKey].value = params.get(item.rankKey);
    if (params.has(item.key)) controls[item.key].value = params.get(item.key);
    if (params.has(item.toneKey) && palettes[params.get(item.toneKey)]) {
      controls[item.toneKey].value = params.get(item.toneKey);
    }
  });

  if (params.has("extra")) {
    try {
      const parsed = JSON.parse(params.get("extra"));
      if (Array.isArray(parsed)) {
        extraWinners = parsed.map((item) => ({
          label: String(item.label ?? "").slice(0, 8),
          name: String(item.name || "").slice(0, 18),
          tone: palettes[item.tone] ? item.tone : "platinum",
        }));
      }
    } catch {
      extraWinners = [{ label: "", name: "", tone: "platinum" }];
    }
  }

  if (extraWinners.length === 0) {
    extraWinners = [{ label: "", name: "", tone: "platinum" }];
  }

  if (params.has("brandText")) controls.brandText.value = params.get("brandText");
  if (params.has("fontFamily") && fontFamilies[params.get("fontFamily")]) {
    controls.fontFamily.value = params.get("fontFamily");
  }
  if (params.has("laurelStyle") && laurelStyles[params.get("laurelStyle")]) {
    controls.laurelStyle.value = params.get("laurelStyle");
  }
  if (params.has("scale")) controls.scale.value = params.get("scale");
  if (params.has("textScale")) controls.textScale.value = params.get("textScale");
  if (params.has("nameScale")) controls.nameScale.value = params.get("nameScale");
  if (params.has("spacing")) controls.spacing.value = params.get("spacing");
  if (params.has("speed")) controls.speed.value = params.get("speed");

  Object.keys(controls).forEach((key) => {
    if (params.has(key) && controls[key].type === "checkbox") {
      controls[key].checked = params.get(key) === "1";
    }
  });
}

function renderLaurelStyleOptions() {
  controls.laurelStyle.replaceChildren();

  Object.entries(laurelStyles).forEach(([key, style]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = style.label;
    controls.laurelStyle.append(option);
  });
}

function createTonePalette(select, onChange) {
  const paletteEl = document.createElement("div");
  paletteEl.className = "tone-palette";
  Object.entries(toneTemplates).forEach(([key, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tone-swatch tone-swatch-${key}`;
    button.dataset.tone = key;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", () => {
      select.value = key;
      updateTonePalette(paletteEl, key);
      select.dispatchEvent(new Event("change", { bubbles: true }));
      onChange?.(key);
    });
    paletteEl.append(button);
  });
  updateTonePalette(paletteEl, select.value);
  return paletteEl;
}

function updateTonePalette(paletteEl, activeTone) {
  paletteEl.querySelectorAll(".tone-swatch").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tone === activeTone);
  });
}

function renderTonePalettes() {
  document.querySelectorAll(".winner-row > .tone-palette").forEach((item) => item.remove());
  podium.forEach((item) => {
    const select = controls[item.toneKey];
    if (!select) return;
    const paletteEl = createTonePalette(select);
    select.after(paletteEl);
  });
}

function renderLaurelPreview() {
  const preview = controls.laurelPreview;
  if (!preview || !window.LAUREL_EXTRA_PATHS || typeof Path2D !== "function") return;

  const previewCtx = preview.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = preview.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (preview.width !== width || preview.height !== height) {
    preview.width = width;
    preview.height = height;
  }

  previewCtx.clearRect(0, 0, width, height);
  const style = laurelStyles[controls.laurelStyle.value] || laurelStyles.extra01;
  const asset = window.LAUREL_EXTRA_PATHS[style.assetKey];
  if (!asset) return;
  if (!asset.pathObjects) asset.pathObjects = asset.paths.map((path) => ({ d: path }));

  const bounds = {
    minX: asset.bounds[0],
    minY: asset.bounds[1],
    maxX: asset.bounds[2],
    maxY: asset.bounds[3],
  };
  const assetWidth = bounds.maxX - bounds.minX;
  const assetHeight = bounds.maxY - bounds.minY;
  const assetCx = bounds.minX + assetWidth / 2;
  const assetCy = bounds.minY + assetHeight / 2;
  const fittedScale = Math.min((width * 0.72) / assetWidth, (height * 0.72) / assetHeight);
  const paths = asset.pathObjects.map((item) => {
    if (!item.path2d) item.path2d = new Path2D(item.d);
    return item.path2d;
  });

  drawVectorAsset(previewCtx, paths, bounds, assetCx, assetCy, width / 2, height / 2, fittedScale, 1, palettes.black, 0);
}

function renderExtraWinnerInputs() {
  extraWinnersEl.replaceChildren();

  extraWinners.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "extra-row";

    const labelInput = document.createElement("input");
    labelInput.className = "extra-label-input";
    labelInput.type = "text";
    labelInput.value = item.label;
    labelInput.maxLength = 8;
    labelInput.placeholder = "라벨";
    labelInput.setAttribute("aria-label", `추가 월계관 ${index + 1} 라벨`);
    labelInput.addEventListener("input", () => {
      extraWinners[index].label = labelInput.value;
    });

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = item.name;
    nameInput.maxLength = 18;
    nameInput.placeholder = "추가 닉네임";
    nameInput.setAttribute("aria-label", `추가 월계관 ${index + 1} 닉네임`);
    nameInput.addEventListener("input", () => {
      extraWinners[index].name = nameInput.value;
    });

    const toneSelect = document.createElement("select");
    toneSelect.className = "tone-select";
    toneSelect.setAttribute("aria-label", `추가 월계관 ${index + 1} 색상`);
    Object.entries(toneTemplates).forEach(([key, label]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = label;
      toneSelect.append(option);
    });
    toneSelect.value = palettes[item.tone] ? item.tone : "platinum";
    toneSelect.addEventListener("change", () => {
      extraWinners[index].tone = toneSelect.value;
    });
    const tonePalette = createTonePalette(toneSelect, (tone) => {
      extraWinners[index].tone = tone;
    });

    const removeButton = document.createElement("button");
    removeButton.className = "icon-action";
    removeButton.type = "button";
    removeButton.textContent = "-";
    removeButton.setAttribute("aria-label", `추가 월계관 ${index + 1} 삭제`);
    removeButton.addEventListener("click", () => {
      extraWinners.splice(index, 1);
      if (extraWinners.length === 0) extraWinners.push({ label: "", name: "", tone: "platinum" });
      renderExtraWinnerInputs();
    });

    row.append(labelInput, nameInput, toneSelect, tonePalette, removeButton);
    extraWinnersEl.append(row);
  });
}

function fitCanvasToDisplay() {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const width = Math.round(rect.width * ratio);
  const height = Math.round(rect.height * ratio);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function drawWinner(winner, cx, cy, blockWidth, centerGap, baseScale, time, state, index) {
  const palette = palettes[winner.tone] || palettes.gold;
  const localScale = baseScale * winner.scale;
  const textScale = localScale * state.textScale;
  // 이웃 수상자와 겹치지 않도록 콘텐츠 폭을 중심 간격(centerGap) 이내로 제한한다.
  // 단일 수상자(centerGap === 0)면 제한을 두지 않는다.
  const overlapLimit = centerGap > 0 ? centerGap * 0.94 : Infinity;
  // 월계관은 서로 살짝 겹쳐도 자연스러우므로 여유를 둔다.
  // 0.5로 잡으면 간격을 줄일 때 가까워지는 대신 월계관만 작아진다.
  const radius = Math.min(blockWidth * 0.42, 118 * localScale, centerGap > 0 ? centerGap * 0.66 : Infinity);
  const topTextSize = fitTextSize(winner.rank, Math.min(blockWidth * 0.46, overlapLimit), 30 * textScale, 16 * textScale, state);
  const nameSize = fitTextSize(winner.name, Math.min(blockWidth * 0.72, overlapLimit), 44 * textScale * state.nameScale, 20 * textScale, state);
  const brandSize = fitTextSize(state.brandText, Math.min(blockWidth * 0.52, overlapLimit), 23 * textScale, 12 * textScale, state);
  const phaseTime = time + index * 0.32;

  drawParticles(cx, cy, radius * 1.35, radius * 1.15, phaseTime, palette, state, index);
  drawLaurel(cx, cy, radius, palette, phaseTime, localScale, state.laurelStyle);
  if (winner.rank) drawRank(winner.rank, cx, cy - 43 * localScale, topTextSize, palette, state);
  drawText(winner.name, cx, cy - 2 * localScale, nameSize, palette, phaseTime, state);
  drawBrand(state.brandText, cx, cy + 35 * localScale, brandSize, palette, phaseTime, state);
}

function fitTextSize(text, maxWidth, startSize, minSize, state) {
  let size = startSize;
  ctx.save();
  ctx.font = canvasFont(900, size, state);
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = canvasFont(900, size, state);
  }
  ctx.restore();
  return size;
}

function drawRank(rank, cx, cy, fontSize, palette, state) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = canvasFont(900, fontSize, state);
  ctx.lineWidth = fontSize * 0.14;
  ctx.strokeStyle = palette.shadow;
  ctx.strokeText(rank, cx, cy);
  ctx.fillStyle = state.effects.hologram ? "#ffffff" : palette.textB;
  ctx.fillText(rank, cx, cy);
  ctx.restore();
}

function drawLaurel(cx, cy, radius, palette, time, scale, styleKey) {
  const style = laurelStyles[styleKey] || laurelStyles.extra01;
  if (style.source === "extra" && drawExtraLaurel(cx, cy, radius, palette, time, style.assetKey)) return;

  const rows = style.rows || [{ r: 1, len: 1 }];

  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.96;

  [-1, 1].forEach((side) => {
    rows.forEach((row, rowIndex) => {
      const rowRadius = radius * row.r;
      const stemGradient = ctx.createLinearGradient(side * rowRadius * 0.5, -rowRadius * 0.62, side * rowRadius * 0.56, rowRadius * 0.34);
      stemGradient.addColorStop(0, palette.laurelA);
      stemGradient.addColorStop(0.42, palette.laurelB);
      stemGradient.addColorStop(1, palette.laurelA);

      if (style.stem) drawLaurelStem(rowRadius, side, stemGradient, palette, scale, style);

      for (let i = 0; i < style.leafCount; i += 1) {
        const t = i / (style.leafCount - 1);
        const point = laurelPoint(rowRadius, side, t, style);
        const tangent = laurelTangent(rowRadius, side, t, style);
        const leafAngle = Math.atan2(tangent.y, tangent.x) + side * style.leafTilt;
        const sizeTaper = 0.78 + Math.sin(t * Math.PI) * 0.24;
        const pulse = 0.96 + Math.sin(time * 1.7 + i * 0.7) * 0.045;
        const length = (style.length[0] + style.length[1] * sizeTaper) * scale * pulse * row.len;
        const width = (style.width[0] + style.width[1] * sizeTaper) * scale * row.len;

        drawLeaf(style.shape, point.x, point.y, leafAngle, length, width, palette, side, i);
      }

      if (style.berries && rowIndex === 0) drawLaurelBerries(rowRadius, side, palette, scale, style, time);
    });
  });

  ctx.restore();
}

function drawExtraLaurel(cx, cy, radius, palette, time, assetKey) {
  if (!window.LAUREL_EXTRA_PATHS || typeof Path2D !== "function") return false;
  const asset = window.LAUREL_EXTRA_PATHS[assetKey];
  if (!asset) return false;
  if (!asset.pathObjects) asset.pathObjects = asset.paths.map((path) => ({ d: path }));

  return drawVectorLaurel(cx, cy, radius, palette, time, {
    paths: asset.pathObjects,
    bounds: asset.bounds,
    widthRatio: 1.72,
    heightRatio: 1.4,
  });
}

function drawVectorLaurel(cx, cy, radius, palette, time, asset) {
  const bounds = {
    minX: asset.bounds[0],
    minY: asset.bounds[1],
    maxX: asset.bounds[2],
    maxY: asset.bounds[3],
  };
  const assetWidth = bounds.maxX - bounds.minX;
  const assetHeight = bounds.maxY - bounds.minY;
  if (assetWidth <= 0 || assetHeight <= 0) return false;

  const assetCx = bounds.minX + assetWidth / 2;
  const assetCy = bounds.minY + assetHeight / 2;
  const targetWidth = radius * asset.widthRatio;
  const targetHeight = radius * asset.heightRatio;
  const fittedScale = Math.min(targetWidth / assetWidth, targetHeight / assetHeight);
  const pulse = 1 + Math.sin(time * 1.55) * 0.007;
  const paths = asset.paths.map((item) => {
    if (!item.path2d) item.path2d = new Path2D(item.d);
    return item.path2d;
  });

  drawVectorAsset(ctx, paths, bounds, assetCx, assetCy, cx, cy - radius * 0.02, fittedScale, pulse, palette, time);
  return true;
}

function drawVectorAsset(targetCtx, paths, bounds, assetCx, assetCy, cx, cy, fittedScale, pulse, palette, time) {
  targetCtx.save();
  targetCtx.translate(cx, cy);
  targetCtx.scale(fittedScale * pulse, fittedScale * pulse);
  targetCtx.translate(-assetCx, -assetCy);

  const shadowScale = 1 / Math.max(fittedScale, 0.001);
  const gradient = targetCtx.createLinearGradient(bounds.minX, assetCy, bounds.maxX, assetCy);
  gradient.addColorStop(0, palette.laurelB);
  gradient.addColorStop(0.24, palette.laurelA);
  gradient.addColorStop(0.5, palette.textB);
  gradient.addColorStop(0.76, palette.laurelA);
  gradient.addColorStop(1, palette.laurelB);

  targetCtx.globalAlpha = 0.96;
  targetCtx.shadowBlur = 9 * shadowScale;
  targetCtx.shadowColor = palette.glow;
  targetCtx.fillStyle = gradient;
  paths.forEach((path) => targetCtx.fill(path));

  targetCtx.shadowBlur = 0;
  targetCtx.globalCompositeOperation = "lighter";
  targetCtx.globalAlpha = 0.2 + Math.sin(time * 2.2) * 0.035;
  targetCtx.fillStyle = palette.textA;
  paths.forEach((path) => targetCtx.fill(path));

  targetCtx.restore();
}

function drawLaurelStem(radius, side, stemGradient, palette, scale, style) {
  const stemScale = style.stemWidth || 1;

  ctx.lineWidth = 3.6 * scale * stemScale;
  ctx.strokeStyle = palette.shadow;
  ctx.beginPath();
  for (let i = 0; i <= 20; i += 1) {
    const t = i / 20;
    const { x, y } = laurelPoint(radius, side, t, style);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.lineWidth = 1.5 * scale * stemScale;
  ctx.strokeStyle = stemGradient;
  ctx.beginPath();
  for (let i = 0; i <= 20; i += 1) {
    const t = i / 20;
    const { x, y } = laurelPoint(radius, side, t, style);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function laurelAngle(side, t, style) {
  const half = Math.PI * style.halfSpan;
  return side < 0 ? Math.PI + half - t * half * 2 : -half + t * half * 2;
}

function laurelPoint(radius, side, t, style) {
  const angle = laurelAngle(side, t, style);
  return {
    x: Math.cos(angle) * radius * style.rx,
    y: Math.sin(angle) * radius * style.ry - radius * style.yOffset,
  };
}

function laurelTangent(radius, side, t, style) {
  const angle = laurelAngle(side, t, style);
  const direction = side < 0 ? -1 : 1;
  return normalize({
    x: -Math.sin(angle) * radius * style.rx * direction,
    y: Math.cos(angle) * radius * style.ry * direction,
  });
}

function drawLeaf(shape, x, y, angle, length, width, palette, side, index) {
  if (shape === "round") drawRoundLeaf(x, y, angle, length, width, palette, side, index);
  else if (shape === "needle") drawNeedleLeaf(x, y, angle, length, width, palette);
  else if (shape === "olive") drawOliveLeaf(x, y, angle, length, width, palette);
  else drawGrainLeaf(x, y, angle, length, width, palette, side, index);
}

function drawLaurelBerries(radius, side, palette, scale, style, time) {
  ctx.save();
  for (let i = 0; i < 4; i += 1) {
    const t = 0.2 + (i / 3) * 0.58;
    const point = laurelPoint(radius, side, t, style);
    const px = point.x * 0.84;
    const py = point.y * 0.84;
    const r = 2.2 * scale * (0.92 + Math.sin(time * 2 + i * 1.3) * 0.08);
    const gradient = ctx.createRadialGradient(px - r * 0.35, py - r * 0.35, r * 0.1, px, py, r);
    gradient.addColorStop(0, palette.textA);
    gradient.addColorStop(1, palette.laurelB);

    ctx.fillStyle = gradient;
    ctx.strokeStyle = palette.shadow;
    ctx.lineWidth = Math.max(0.35, r * 0.2);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function drawGrainLeaf(x, y, angle, length, width, palette, side, index) {
  const gradient = ctx.createLinearGradient(-length * 0.25, 0, length, 0);
  gradient.addColorStop(0, palette.laurelB);
  gradient.addColorStop(0.45, palette.laurelA);
  gradient.addColorStop(0.78, palette.textB);
  gradient.addColorStop(1, palette.laurelB);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowBlur = 3;
  ctx.shadowColor = palette.shadow;
  ctx.fillStyle = gradient;
  ctx.strokeStyle = palette.shadow;
  ctx.lineWidth = Math.max(0.45, width * 0.11);

  ctx.beginPath();
  ctx.moveTo(-length * 0.08, 0);
  ctx.quadraticCurveTo(length * 0.18, -width * 1.25, length * 0.92, 0);
  ctx.quadraticCurveTo(length * 0.18, width * 1.25, -length * 0.08, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = palette.textA;
  ctx.lineWidth = Math.max(0.4, width * 0.1);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(length * 0.76, 0);
  ctx.stroke();

  ctx.globalAlpha = 0.36 + (index % 3) * 0.08;
  ctx.fillStyle = palette.textA;
  ctx.beginPath();
  ctx.ellipse(length * 0.38, -width * 0.2 * side, width * 0.22, width * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRoundLeaf(x, y, angle, length, width, palette, side, index) {
  const gradient = ctx.createLinearGradient(0, -width, length, width);
  gradient.addColorStop(0, palette.laurelB);
  gradient.addColorStop(0.38, palette.laurelA);
  gradient.addColorStop(0.74, palette.textB);
  gradient.addColorStop(1, palette.laurelB);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowBlur = 3;
  ctx.shadowColor = palette.shadow;
  ctx.fillStyle = gradient;
  ctx.strokeStyle = palette.shadow;
  ctx.lineWidth = Math.max(0.45, width * 0.09);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(length * 0.2, -width, length * 0.74, -width * 0.86, length, 0);
  ctx.bezierCurveTo(length * 0.74, width * 0.86, length * 0.2, width, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.62;
  ctx.strokeStyle = palette.textA;
  ctx.lineWidth = Math.max(0.4, width * 0.085);
  ctx.beginPath();
  ctx.moveTo(length * 0.06, 0);
  ctx.lineTo(length * 0.84, 0);
  ctx.stroke();

  ctx.globalAlpha = 0.3 + (index % 3) * 0.07;
  ctx.lineWidth = Math.max(0.3, width * 0.055);
  for (let i = 1; i <= 3; i += 1) {
    const t = i / 4;
    ctx.beginPath();
    ctx.moveTo(length * t, 0);
    ctx.lineTo(length * (t + 0.12), -width * 0.46 * side);
    ctx.stroke();
  }
  ctx.restore();
}

function drawNeedleLeaf(x, y, angle, length, width, palette) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.lineCap = "round";

  ctx.strokeStyle = palette.shadow;
  ctx.lineWidth = Math.max(0.5, width * 0.36);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(length * 0.96, 0);
  ctx.stroke();

  const gradient = ctx.createLinearGradient(0, 0, length, 0);
  gradient.addColorStop(0, palette.laurelB);
  gradient.addColorStop(0.5, palette.laurelA);
  gradient.addColorStop(1, palette.textB);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = Math.max(0.4, width * 0.2);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(length * 0.92, 0);
  ctx.stroke();
  ctx.restore();
}

function drawOliveLeaf(x, y, angle, length, width, palette) {
  const gradient = ctx.createLinearGradient(0, -width, length, width);
  gradient.addColorStop(0, palette.laurelB);
  gradient.addColorStop(0.45, palette.laurelA);
  gradient.addColorStop(0.85, palette.textB);
  gradient.addColorStop(1, palette.laurelB);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowBlur = 3;
  ctx.shadowColor = palette.shadow;
  ctx.fillStyle = gradient;
  ctx.strokeStyle = palette.shadow;
  ctx.lineWidth = Math.max(0.4, width * 0.1);

  // 양 끝이 뾰족한 매끄러운 올리브 잎
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(length * 0.42, -width * 0.95, length, 0);
  ctx.quadraticCurveTo(length * 0.42, width * 0.95, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = palette.textA;
  ctx.lineWidth = Math.max(0.35, width * 0.09);
  ctx.beginPath();
  ctx.moveTo(length * 0.08, 0);
  ctx.lineTo(length * 0.84, 0);
  ctx.stroke();
  ctx.restore();
}

function drawText(name, cx, cy, fontSize, palette, time, state) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = canvasFont(900, fontSize, state);
  ctx.lineJoin = "round";

  const metrics = ctx.measureText(name);
  const textWidth = metrics.width;
  const x0 = cx - textWidth / 2;

  if (state.effects.glow) {
    const glowSize = 10 + Math.sin(time * 2.1) * 5;
    ctx.shadowBlur = glowSize;
    ctx.shadowColor = palette.glow;
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = palette.glow;
    ctx.lineWidth = fontSize * 0.1;
    ctx.strokeText(name, cx, cy);
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.lineWidth = fontSize * 0.16;
  ctx.strokeStyle = palette.shadow;
  ctx.strokeText(name, cx, cy);

  const gradient = ctx.createLinearGradient(x0, cy - fontSize, x0 + textWidth, cy + fontSize);
  if (state.effects.hologram) {
    gradient.addColorStop(0, "#ff9bd5");
    gradient.addColorStop(0.24, "#fff6a8");
    gradient.addColorStop(0.5, "#9fffe0");
    gradient.addColorStop(0.74, "#9ab8ff");
    gradient.addColorStop(1, "#ffffff");
  } else {
    gradient.addColorStop(0, palette.textC);
    gradient.addColorStop(0.24, palette.textA);
    gradient.addColorStop(0.5, palette.textB);
    gradient.addColorStop(0.76, palette.textA);
    gradient.addColorStop(1, palette.textC);
  }

  ctx.fillStyle = gradient;
  ctx.fillText(name, cx, cy);

  if (state.effects.neon) {
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#6ff7ff";
    ctx.strokeStyle = "rgba(111, 247, 255, 0.7)";
    ctx.lineWidth = fontSize * 0.045;
    ctx.strokeText(name, cx, cy);
  }

  if (state.effects.shine) drawShine(cx, cy, textWidth, fontSize, time, state.speed);
  if (state.effects.glitter) drawGlitterOverText(x0, cy, textWidth, fontSize, time, palette);
  if (state.effects.ice) drawIce(cx, cy, textWidth, fontSize, time);
  if (state.effects.fire) drawFire(cx, cy, textWidth, fontSize, time);
  if (state.effects.lightning) drawLightning(cx, cy, textWidth, fontSize, time);

  ctx.restore();
}

function drawBrand(label, cx, cy, fontSize, palette, time, state) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.rotate(Math.sin(time * 1.5) * 0.015);
  ctx.font = canvasFont(900, fontSize, state, "italic");
  ctx.lineWidth = fontSize * 0.18;
  ctx.strokeStyle = palette.shadow;
  ctx.strokeText(label, 0, 0);
  ctx.shadowBlur = 8;
  ctx.shadowColor = palette.glow;
  ctx.fillStyle = palette.textA;
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

function drawShine(cx, cy, width, fontSize, time, speed) {
  const sweep = ((time * 0.42 * speed) % 1) * (width + fontSize * 2) - fontSize - width / 2;
  const shine = ctx.createLinearGradient(cx + sweep - 42, cy, cx + sweep + 42, cy);
  shine.addColorStop(0, "rgba(255,255,255,0)");
  shine.addColorStop(0.5, "rgba(255,255,255,0.82)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(cx + sweep, cy);
  ctx.rotate(-0.28);
  ctx.fillStyle = shine;
  ctx.fillRect(-26, -fontSize * 0.95, 52, fontSize * 1.9);
  ctx.restore();
}

function drawGlitterOverText(x, y, width, fontSize, time, palette) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  seededParticles.slice(0, 26).forEach((p, index) => {
    const alpha = Math.max(0, Math.sin(time * 4 + p.phase * 8 + index));
    if (alpha < 0.45) return;
    const px = x + p.x * width;
    const py = y - fontSize * 0.52 + p.y * fontSize * 0.98;
    drawStar(px, py, p.size * 1.45, palette.particle, alpha);
  });
  ctx.restore();
}

function drawParticles(cx, cy, w, h, time, palette, state, offset) {
  if (!state.effects.sparkles && !state.effects.dust) return;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  seededParticles.forEach((p, index) => {
    if ((index + offset) % 3 !== 0) return;
    const drift = (time * (0.02 + p.phase * 0.04) + p.phase) % 1;
    const px = cx - w / 2 + p.x * w + Math.sin(time + index) * 10;
    const py = cy - h / 2 + ((p.y + drift) % 1) * h;
    const alpha = state.effects.dust ? 0.22 + p.phase * 0.28 : Math.max(0, Math.sin(time * 3 + p.phase * 10));
    const size = state.effects.dust ? p.size * 0.72 : p.size * 1.5;
    drawStar(px, py, size, palette.particle, alpha);
  });
  ctx.restore();
}

function drawStar(x, y, radius, color, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const r = i % 2 === 0 ? radius : radius * 0.28;
    const a = (Math.PI * 2 * i) / 8;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawIce(cx, cy, width, fontSize, time) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = "rgba(178, 239, 255, 0.62)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i += 1) {
    const x = cx - width / 2 + (i / 5) * width;
    const y = cy + fontSize * 0.43 + Math.sin(time * 2 + i) * 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 7, y + 13);
    ctx.lineTo(x + 14, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFire(cx, cy, width, fontSize, time) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 12; i += 1) {
    const phase = i * 0.73;
    const x = cx - width / 2 + ((i + 0.5) / 12) * width + Math.sin(time * 5 + phase) * 5;
    const y = cy + fontSize * 0.48 - Math.abs(Math.sin(time * 3 + phase)) * 18;
    const gradient = ctx.createRadialGradient(x, y, 1, x, y, 13);
    gradient.addColorStop(0, "rgba(255, 241, 126, 0.72)");
    gradient.addColorStop(0.45, "rgba(255, 109, 43, 0.34)");
    gradient.addColorStop(1, "rgba(255, 55, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y, 8, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLightning(cx, cy, width, fontSize, time) {
  if (Math.sin(time * 5.4) < 0.78) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.86)";
  ctx.shadowBlur = 10;
  ctx.shadowColor = "#f9fbff";
  ctx.lineWidth = 2.2;
  const x = cx - width * 0.36 + fract(Math.sin(Math.floor(time * 5) * 41) * 1000) * width * 0.72;
  ctx.beginPath();
  ctx.moveTo(x, cy - fontSize * 0.78);
  ctx.lineTo(x + 14, cy - fontSize * 0.24);
  ctx.lineTo(x - 3, cy - fontSize * 0.18);
  ctx.lineTo(x + 12, cy + fontSize * 0.5);
  ctx.stroke();
  ctx.restore();
}

function drawScene(now, gifSafe = false) {
  const state = readState();
  // GIF는 반투명/가산 합성 효과를 깨끗이 담지 못해 검은 노이즈가 생긴다.
  // GIF 저장 시에는 노이즈 유발 효과를 끄고, 텍스트에 붙는 안정적 효과만 남긴다.
  if (gifSafe) {
    gifUnsafeEffects.forEach((key) => {
      state.effects[key] = false;
    });
  }
  const time = ((now - start) / 1000) * state.speed;
  const w = canvas.width;
  const h = canvas.height;
  const baseScale = Math.min(w / 1280, h / 360) * state.scale;
  const count = Math.max(state.winners.length, 1);
  const blockWidth = Math.min(w / Math.max(count, 3), w / 3);
  const centerGap = count > 1 ? (w / Math.max(count, 3)) * state.spacing : 0;
  const cy = h * 0.5;

  ctx.clearRect(0, 0, w, h);

  state.winners.forEach((winner, index) => {
    const cx = w / 2 + (index - (count - 1) / 2) * centerGap;
    drawWinner(winner, cx, cy, blockWidth, centerGap, baseScale, time, state, index);
  });
}

function render(now) {
  // 내보내기 중에는 캔버스를 건드리지 않는다(해상도/내용이 덮어써지지 않도록).
  if (!exporting) {
    fitCanvasToDisplay();
    drawScene(now);
  }
  requestAnimationFrame(render);
}

function buildObsUrl() {
  const state = readState();
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("overlay", "1");
  podium.forEach((item) => {
    url.searchParams.set(item.rankKey, controls[item.rankKey].value.trim());
    url.searchParams.set(item.key, controls[item.key].value.trim());
    url.searchParams.set(item.toneKey, controls[item.toneKey].value);
  });
  url.searchParams.set("extra", JSON.stringify(extraWinners));
  url.searchParams.set("brandText", state.brandText);
  url.searchParams.set("fontFamily", state.fontFamily);
  url.searchParams.set("laurelStyle", state.laurelStyle);
  url.searchParams.set("scale", controls.scale.value);
  url.searchParams.set("textScale", controls.textScale.value);
  url.searchParams.set("nameScale", controls.nameScale.value);
  url.searchParams.set("spacing", controls.spacing.value);
  url.searchParams.set("speed", controls.speed.value);
  Object.entries(state.effects).forEach(([key, value]) => url.searchParams.set(key, value ? "1" : "0"));
  return url.href;
}

function filePrefix() {
  const names = readState()
    .winners.map((winner) => winner.name)
    .filter(Boolean)
    .join("-")
    .replace(/[\\/:*?"<>|]/g, "")
    .slice(0, 80);

  return names || "laurel";
}

function downloadPng() {
  const link = document.createElement("a");
  link.download = `${filePrefix()}-podium-overlay.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  setStatus("PNG를 저장했습니다.");
}

async function downloadGif() {
  if (typeof GIF !== "function") {
    setStatus("GIF 라이브러리를 불러오지 못했습니다.");
    return;
  }

  const gifWidthInput = document.getElementById("gifWidth");
  const gifFramesInput = document.getElementById("gifFrames");
  const gifQualityInput = document.getElementById("gifQuality");
  const maxWidth = gifWidthInput ? Number(gifWidthInput.value) : 864;
  // 슬라이더는 높을수록 고화질(직관적)이지만 gif.js quality는 낮을수록 고화질이라 반전
  const quality = gifQualityInput ? 11 - Number(gifQualityInput.value) : 5;
  const frameCount = gifFramesInput ? Number(gifFramesInput.value) : 30;
  const motionStep = 1 / 15; // 프레임당 진행하는 애니메이션 시간(초)
  const delayMs = Math.round(motionStep * 1000); // 실제 속도로 재생되도록 프레임 시간과 맞춤

  // 화면 캔버스 해상도가 낮으면 잘라낸 영역도 작아져 흐릿해진다.
  // 내보내는 동안에는 캔버스를 고해상도로 키워 선명도를 확보한다.
  const previousWidth = canvas.width;
  const previousHeight = canvas.height;
  const aspect = canvas.width > 0 ? canvas.height / canvas.width : 9 / 16;
  exporting = true;
  canvas.width = 1920;
  canvas.height = Math.max(1, Math.round(1920 * aspect));

  // 캔버스는 16:9 전체이지만 실제 내용은 가운데 일부뿐이라, 빈 여백을 잘라내고
  // 내용 영역만 인코딩한다. 여백이 사라져 파일 크기가 크게 줄어든다.
  setStatus("GIF 영역을 계산하는 중입니다.");
  const crop = measureContentBounds(frameCount, motionStep);
  const outputScale = Math.min(1, maxWidth / crop.w);
  const width = Math.max(1, Math.round(crop.w * outputScale));
  const height = Math.max(1, Math.round(crop.h * outputScale));
  const offscreen = document.createElement("canvas");
  const offscreenCtx = offscreen.getContext("2d", { willReadFrequently: true });
  const workerScript = createGifWorkerScriptUrl();
  const gif = new GIF({
    workers: 4,
    quality, // gif.js의 quality는 낮을수록 색 재현이 좋음(기본 10)
    // 디더링은 켜지 않음: 투명 색상 키 방식과 충돌해 배경이
    // 불투명한 검은 얼룩으로 남기 때문. 오버레이는 깨끗한 투명 배경이 우선.
    width,
    height,
    repeat: 0,
    // 깜빡임의 핵심 원인: 기본값은 프레임마다 팔레트를 새로 만들기 때문에
    // 같은 색이 프레임마다 미세하게 달라진다. 특히 그림자·블랙 월계관 같은
    // 어두운 영역이 떨려 보인다. 전역 팔레트로 고정해 프레임 간 색을 일치시킨다.
    globalPalette: true,
    // 투명 키는 마젠타. gif.js는 팔레트에서 "키 색과 가장 가까운 색"을 투명
    // 인덱스로 삼으므로, 검정에 가까운 키는 어두운 내용 색과 혼동될 수 있다.
    transparent: 0xff00ff,
    workerScript,
  });

  offscreen.width = width;
  offscreen.height = height;
  offscreenCtx.imageSmoothingEnabled = true;
  offscreenCtx.imageSmoothingQuality = "high";
  // 이 값 미만의 반투명 픽셀(희미한 파티클/글로우 가장자리)은 투명 처리한다.
  // GIF는 1비트 투명도만 지원하므로, 알파를 이진화해 검은 노이즈/테두리를 제거한다.
  const alphaThreshold = 110;
  setStatus("GIF 프레임을 만드는 중입니다.");

  try {
    for (let i = 0; i < frameCount; i += 1) {
      const now = start + i * motionStep * 1000;
      drawScene(now, true); // GIF 안전 모드: 노이즈 유발 효과 비활성화
      // 검정 배경에 합성하지 않고 투명 캔버스에 그대로 그린 뒤 알파를 이진화한다.
      offscreenCtx.clearRect(0, 0, width, height);
      offscreenCtx.drawImage(canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, width, height);
      const frame = offscreenCtx.getImageData(0, 0, width, height);
      const data = frame.data;
      for (let p = 0; p < data.length; p += 4) {
        if (data[p + 3] < alphaThreshold) {
          // 투명 키 색(마젠타)으로 지정 → GIF가 투명 처리
          data[p] = 255;
          data[p + 1] = 0;
          data[p + 2] = 255;
        }
        // 임계값 이상은 원래 색을 유지한 채 완전 불투명으로(검정과 섞지 않아 테두리 방지)
        data[p + 3] = 255;
      }
      offscreenCtx.putImageData(frame, 0, 0);
      gif.addFrame(offscreenCtx, { copy: true, delay: delayMs });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    // 화면 렌더링 복구
    canvas.width = previousWidth;
    canvas.height = previousHeight;
    exporting = false;
  }

  setStatus("GIF를 인코딩하는 중입니다.");
  gif.on("finished", (blob) => {
    if (workerScript.startsWith("blob:")) URL.revokeObjectURL(workerScript);
    const link = document.createElement("a");
    link.download = `${filePrefix()}-podium-animation.gif`;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    setStatus("GIF를 저장했습니다.");
  });
  gif.on("abort", () => {
    if (workerScript.startsWith("blob:")) URL.revokeObjectURL(workerScript);
    setStatus("GIF 저장이 중단되었습니다.");
  });
  gif.on("progress", (progress) => {
    setStatus(`GIF 인코딩 중 ${Math.round(progress * 100)}%`);
  });
  gif.render();
}

// 애니메이션 전체에서 실제 내용이 차지하는 영역을 구한다.
// 프레임마다 글로우/맥동으로 크기가 조금씩 달라지므로 여러 프레임의 합집합을 쓴다.
function measureContentBounds(frameCount, motionStep) {
  const w = canvas.width;
  const h = canvas.height;
  const full = { x: 0, y: 0, w, h };
  const samples = Math.min(frameCount, 6);
  const alphaFloor = 8; // 이보다 옅은 픽셀은 여백으로 본다

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let s = 0; s < samples; s += 1) {
    drawScene(start + (s / samples) * frameCount * motionStep * 1000, true);

    let data;
    try {
      data = ctx.getImageData(0, 0, w, h).data;
    } catch {
      return full; // 캔버스를 읽을 수 없으면 자르지 않는다
    }

    for (let y = 0; y < h; y += 1) {
      const rowStart = y * w * 4;
      for (let x = 0; x < w; x += 1) {
        if (data[rowStart + x * 4 + 3] <= alphaFloor) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return full; // 내용이 없으면 전체 사용

  const padX = Math.round(w * 0.01);
  const padY = Math.round(h * 0.01);
  const x = Math.max(0, minX - padX);
  const y = Math.max(0, minY - padY);

  return {
    x,
    y,
    w: Math.min(w - x, maxX - minX + 1 + padX * 2),
    h: Math.min(h - y, maxY - minY + 1 + padY * 2),
  };
}

function createGifWorkerScriptUrl() {
  const raw = window.GIF_WORKER_SOURCE;
  const source =
    typeof raw === "string" ? raw : raw && typeof raw.value === "string" ? raw.value : "";

  if (source.length > 0) {
    return URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  }

  return new URL("vendor/gif.js/gif.worker.js", location.href).href;
}

function toggleRecording() {
  if (recorder && recorder.state === "recording") {
    recorder.stop();
    return;
  }

  if (!canvas.captureStream || !window.MediaRecorder) {
    setStatus("이 브라우저는 애니메이션 저장을 지원하지 않습니다.");
    return;
  }

  recordedChunks = [];
  const stream = canvas.captureStream(60);
  recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) recordedChunks.push(event.data);
  };
  recorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const link = document.createElement("a");
    link.download = `${filePrefix()}-podium-animation.webm`;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    setStatus("애니메이션 WebM을 저장했습니다.");
  };
  recorder.start();
  setStatus("5초 동안 애니메이션을 녹화합니다.");
  setTimeout(() => {
    if (recorder && recorder.state === "recording") recorder.stop();
  }, 5000);
}

async function copyObsUrl() {
  const url = buildObsUrl();
  try {
    await navigator.clipboard.writeText(url);
    setStatus("OBS Browser Source 주소를 복사했습니다.");
  } catch {
    setStatus(url);
  }
}

function setStatus(message) {
  if (statusEl) statusEl.textContent = message;
}

function handleInquiry() {
  window.open("https://www.sooplive.com/station/wjs8679", "_blank", "noopener,noreferrer");
  setStatus("문의 페이지를 열었습니다.");
}

function attachEvents() {
  addExtraWinnerButton?.addEventListener("click", () => {
    extraWinners.push({ label: "", name: "", tone: "platinum" });
    renderExtraWinnerInputs();
  });
  document.getElementById("downloadPng")?.addEventListener("click", downloadPng);
  document.getElementById("downloadGif")?.addEventListener("click", downloadGif);
  document.getElementById("recordWebm")?.addEventListener("click", toggleRecording);
  document.getElementById("copyUrl")?.addEventListener("click", copyObsUrl);
  document.getElementById("inquiryButton")?.addEventListener("click", handleInquiry);
  controls.laurelStyle?.addEventListener("change", renderLaurelPreview);
  window.addEventListener("resize", () => {
    fitCanvasToDisplay();
    renderLaurelPreview();
  });
}

renderLaurelStyleOptions();
applyUrlState();
renderTonePalettes();
renderExtraWinnerInputs();
attachEvents();
if (document.fonts?.ready) {
  document.fonts.ready.then(() => {
    renderLaurelPreview();
    requestAnimationFrame(render);
  });
} else {
  renderLaurelPreview();
  requestAnimationFrame(render);
}
