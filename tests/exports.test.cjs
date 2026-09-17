const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
// Keep production functions intact; only skip the page's initial DOM setup.
const app = read('app.js').split('\nrenderLaurelStyleOptions();')[0];
const vendor = read('vendor/gif.js/gif.js');
const workerSource = read('vendor/gif.js/gif.worker.js');

function harness(mode = 'success', onYield = () => {}) {
  const workers = [], downloads = [], copies = [], errors = [], revoked = [];
  const events = {};
  const elements = {};
  let attempts = 0;
  class Context {
    constructor(canvas) { this.canvas = canvas; this.texts = []; }
    save() {} restore() {} translate() {} scale() {} rotate() {}
    beginPath() {} moveTo() {} lineTo() {} stroke() {} fill() {}
    ellipse() {} closePath() {} bezierCurveTo() {} quadraticCurveTo() {}
    clearRect() { this.texts = []; }
    measureText(text) { return { width: text.length * 10 }; }
    strokeText() {}
    fillText(text) { this.texts.push(text); }
    createLinearGradient() { return { addColorStop() {} }; }
    createRadialGradient() { return { addColorStop() {} }; }
    getImageData(x, y, width, height) {
      const data = new Uint8ClampedArray(width * height * 4);
      const pixel = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4;
      data.set([255, 200, 10, 255], pixel);
      return { data };
    }
    putImageData() {}
    drawImage(source) {
      copies.push({ source, width: source.width, height: source.height, texts: [...source.context.texts] });
    }
  }
  function canvas() {
    const result = { width: 800, height: 450, getBoundingClientRect: () => ({ width: 640, height: 360 }) };
    result.context = new Context(result);
    result.getContext = () => result.context;
    result.toDataURL = () => 'data:image/png;base64,test';
    return result;
  }
  elements.overlayCanvas = canvas();
  const defaults = { name1: 'Before', rank1: '1', name2: '', rank2: '', name3: '', rank3: '',
    tone1: 'gold', tone2: 'silver', tone3: 'bronze', brandText: 'Brand', fontFamily: 'system',
    laurelStyle: 'extra01', scale: '100', textScale: '100', nameScale: '100', spacing: '62',
    speed: '100', gifWidth: '864', gifFrames: '4', gifQuality: '6' };
  const element = (id) => elements[id] ||= {
    value: defaults[id] || '', checked: false, disabled: false,
    addEventListener() {},
  };
  class Worker {
    constructor() {
      if (mode === 'constructor-error' && ++attempts === 2) throw new Error('constructor failed');
      workers.push(this);
      this.runtime = { self: { postMessage: (data) => {
        setImmediate(() => {
          if (!this.terminated) this.onmessage?.({ data: structuredClone(data) });
        });
      } } };
      vm.createContext(this.runtime);
      vm.runInContext(workerSource, this.runtime);
    }
    postMessage(task) {
      if (mode === 'post-error') throw new Error('post failed');
      if (mode === 'timeout') return;
      const cloned = structuredClone(task);
      setImmediate(() => {
        if (this.terminated) return;
        if (mode === 'error') return this.onerror?.({ message: 'worker failed', preventDefault() {} });
        if (mode === 'messageerror') return this.onmessageerror?.({});
        if (mode === 'bad-result') return this.onmessage?.({ data: null });
        this.runtime.self.onmessage({ data: cloned });
      });
    }
    terminate() { this.terminated = true; }
  }
  const url = class extends URL {};
  url.createObjectURL = (blob) => { downloads.push({ blob }); return `blob:test-${downloads.length}`; };
  url.revokeObjectURL = (value) => revoked.push(value);
  const sandbox = {
    console: { log() {}, error: (...args) => errors.push(args) },
    URL: url, URLSearchParams, Blob, Uint8Array, Uint8ClampedArray,
    CanvasRenderingContext2D: Context, Worker, Path2D: class {},
    navigator: { userAgent: 'chrome/130', platform: 'win' },
    location: { search: '', href: 'http://localhost/' }, performance: { now: () => 1000 },
    requestAnimationFrame() {}, clearTimeout,
    setTimeout(callback, delay) {
      if (delay === 0) onYield({ elements, events, sandbox });
      // Accelerate only the production watchdog for the nonresponding-worker test.
      return setTimeout(callback, delay === 120000 && mode === 'timeout' ? 15 : delay);
    },
    window: { devicePixelRatio: 1, addEventListener: (name, callback) => { events[name] = callback; } },
    document: {
      getElementById: element,
      createElement(tag) {
        if (tag === 'canvas') return canvas();
        return { click() { downloads.push({ filename: this.download, href: this.href }); } };
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(vendor, sandbox);
  sandbox.GIF = sandbox.window.GIF;
  vm.runInContext(read('vendor/gif.js/gif.worker.inline.js'), sandbox);
  vm.runInContext(read('assets/laurelExtraPaths.js'), sandbox);
  vm.runInContext(app, sandbox);
  // No preview thumbnail is needed for resize events in this DOM double.
  vm.runInContext('controls.laurelPreview = null; attachEvents();', sandbox);
  return { sandbox, elements, workers, downloads, copies, revoked, errors,
    setMode: (value) => { mode = value; },
    run: (code) => vm.runInContext(code, sandbox) };
}

test('GIF uses one settings snapshot and independent canvas despite resize and edits', async () => {
  let yields = 0;
  const h = harness('success', ({ elements, events, sandbox }) => {
    if (yields++ !== 0) return;
    elements.name1.value = 'After';
    elements.brandText.value = 'Changed';
    elements.scale.value = '72';
    events.resize();
    sandbox.render(2000);
  });
  await h.sandbox.downloadGif();
  assert.equal(h.errors.length, 0);
  assert.equal(h.copies.length, 4);
  for (const frame of h.copies) {
    assert.notEqual(frame.source, h.elements.overlayCanvas);
    assert.equal(frame.width, 640);
    assert.equal(frame.height, 360);
    assert.ok(frame.texts.includes('Before'));
    assert.ok(frame.texts.includes('Brand'));
    assert.ok(!frame.texts.includes('After'));
  }
  assert.equal(h.elements.overlayCanvas.width, 640);
  assert.equal(h.elements.overlayCanvas.height, 360);
  assert.ok(h.elements.overlayCanvas.context.texts.includes('After'));
  assert.equal(h.downloads.find((d) => d.filename).filename, 'Before-podium-animation.gif');
  const blob = h.downloads.find((d) => d.blob?.type === 'image/gif').blob;
  assert.equal(Buffer.from(await blob.arrayBuffer()).subarray(0, 6).toString(), 'GIF89a');
  assert.ok(h.workers.every((w) => w.terminated));
  assert.equal(h.elements.downloadPng.disabled, false);
  assert.equal(h.elements.downloadGif.disabled, false);
});

for (const mode of ['error', 'messageerror', 'bad-result', 'constructor-error', 'post-error', 'timeout']) {
  test(`${mode}: unlock both buttons, release workers/URL, and allow retry`, async () => {
    const h = harness(mode);
    await h.sandbox.downloadGif();
    assert.equal(h.run('exportInProgress'), false);
    assert.equal(h.elements.downloadPng.disabled, false);
    assert.equal(h.elements.downloadGif.disabled, false);
    assert.match(h.elements.status.textContent, /실패/);
    assert.equal(h.downloads.filter((d) => d.filename).length, 0);
    assert.ok(h.workers.length > 0 && h.workers.every((w) => w.terminated));
    assert.ok(h.revoked.includes('blob:test-1'));
    // Once the failure is gone, a fresh request must successfully save a GIF.
    const previousErrors = h.errors.length;
    h.setMode('success');
    await h.sandbox.downloadGif();
    assert.equal(h.errors.length, previousErrors);
    assert.equal(h.downloads.filter((d) => d.filename).length, 1);
    assert.ok(h.workers.every((w) => w.terminated));
  });
}

test('second export request is ignored while GIF is running', async () => {
  const h = harness();
  const first = h.sandbox.downloadGif();
  assert.equal(h.elements.downloadPng.disabled, true);
  await h.sandbox.downloadGif();
  h.sandbox.downloadPng();
  await first;
  assert.equal(h.downloads.filter((d) => d.filename).length, 1);
});

test('drawing failure restores preview context', () => {
  const h = harness();
  const original = h.run('ctx');
  assert.throws(() => h.sandbox.drawScene(0, true, {}, { getContext: () => null }));
  assert.equal(h.run('ctx'), original);
});

test('PNG retains content-sized crop after shared renderer changes', () => {
  const h = harness();
  h.sandbox.downloadPng();
  assert.equal(h.errors.length, 0);
  assert.match(h.elements.status.textContent, /1×1 PNG/);
  assert.equal(h.elements.overlayCanvas.width, 800);
  assert.equal(h.elements.overlayCanvas.height, 450);
  assert.equal(h.elements.downloadPng.disabled, false);
});

test('alpha crop ignores GIF-transparent pixels and adds no padding at edges', () => {
  const h = harness();
  const data = new Uint8ClampedArray(10 * 8 * 4);
  data[3] = 8;
  data[(7 * 10 + 9) * 4 + 3] = 109;
  data[(2 * 10 + 3) * 4 + 3] = 110;
  data[(4 * 10 + 5) * 4 + 3] = 255;
  const bounds = h.sandbox.findAlphaBounds(data, 10, 8, 110);
  assert.deepEqual({ ...bounds }, { x: 3, y: 2, w: 3, h: 3 });
  data.fill(0);
  data[3] = 255;
  assert.deepEqual({ ...h.sandbox.findAlphaBounds(data, 10, 8, 110) }, { x: 0, y: 0, w: 1, h: 1 });
  data.fill(0);
  assert.equal(h.sandbox.findAlphaBounds(data, 10, 8, 110), null);
});

test('all GIF frames including unsampled intermediate motion contribute to crop', async () => {
  const h = harness();
  let frameIndex = 0;
  h.sandbox.drawScene = () => {};
  const target = { width: 12, height: 1, getContext: () => ({
    getImageData() {
      const data = new Uint8ClampedArray(12 * 4);
      data[((frameIndex++ === 1 ? 11 : 4) * 4) + 3] = 255;
      return { data };
    },
  }) };
  const bounds = await h.sandbox.measureContentBounds(12, 1 / 15, target, {}, 110);
  assert.equal(frameIndex, 12);
  assert.deepEqual({ ...bounds }, { x: 4, y: 0, w: 8, h: 1 });
});

test('empty PNG and GIF do not download a full canvas', async () => {
  const h = harness();
  h.elements.name1.value = h.elements.rank1.value = '';
  h.sandbox.downloadPng();
  assert.match(h.elements.status.textContent, /저장할 내용이 없습니다/);
  await h.sandbox.downloadGif();
  assert.match(h.elements.status.textContent, /저장할 내용이 없습니다/);
  assert.equal(h.downloads.length, 0);
  assert.equal(h.elements.downloadPng.disabled, false);
  assert.equal(h.elements.downloadGif.disabled, false);
});
