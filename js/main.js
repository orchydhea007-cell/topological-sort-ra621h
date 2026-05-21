/**
 * main.js  (Pyodide bridge + UI controller)
 * Topological Sort Step-by-Step Visualizer
 * Honda RA621H Assembly Scheduling
 *
 * Algorithm logic lives in js/kahn.py (Python).
 * Pyodide loads it and calls run_from_json() as the bridge.
 */

'use strict';

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
const S = {
  components: [],
  result: null,        // { graph, steps, order, waves, valid, stats }
  stepIdx: -1,
  playing: false,
  playTimer: null,
  speed: 700,          // ms between auto-steps
  pyodide: null,       // Pyodide runtime
};

/* ══════════════════════════════════════
   SUBSYSTEM COLORS
══════════════════════════════════════ */
const SUB_COLORS = {
  'ICE – Internal Combustion Engine': '#CC0000',
  'Turbocharger System':              '#E65100',
  'Hybrid – MGU-H':                  '#6A1B9A',
  'Hybrid – MGU-K':                  '#1565C0',
  'Energy Store (ES)':               '#2E7D32',
  'Lubrication System':              '#5D4037',
  'Cooling System':                  '#00695C',
  'Fuel System':                     '#F57F17',
  'Electronics & Control':           '#37474F',
  'Chassis & Monocoque':             '#555',
  'Suspension – Front':              '#880E4F',
  'Suspension – Rear':               '#AD1457',
  'Aerodynamics – Front':            '#0277BD',
  'Aerodynamics – Rear':             '#01579B',
  'Gearbox & Drivetrain':            '#4A148C',
  'Braking System':                  '#B71C1C',
  'Wheels & Tyres':                  '#33691E',
  'Cockpit & Safety':                '#006064',
  'Final Assembly':                  '#333',
};

/* ══════════════════════════════════════
   BOOT
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  showLoader('Memuat Pyodide…');
  await initPyodide();
  showLoader('Memuat dataset…');
  await loadData();
  showLoader('Menjalankan algoritma Python…');
  await buildResult();
  hideLoader();
  renderWaveGrid();
  renderInDegreeGrid();
  goToStep(0);
  wireControls();
  wirePseudo();
});

/* ══════════════════════════════════════
   LOADER OVERLAY
══════════════════════════════════════ */
function showLoader(msg) {
  let el = document.getElementById('py-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'py-loader';
    el.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.82);
      display:flex;flex-direction:column;align-items:center;
      justify-content:center;z-index:9999;gap:1rem;
      font-family:var(--ff-m,monospace);color:#fff;letter-spacing:.08em;
    `;
    el.innerHTML = `
      <div style="font-size:.65rem;color:#e4003b;letter-spacing:.2em">● PYTHON ENGINE</div>
      <div id="py-loader-msg" style="font-size:.8rem"></div>
      <div style="width:200px;height:2px;background:#333;border-radius:2px;overflow:hidden">
        <div id="py-loader-bar" style="height:100%;width:0;background:#e4003b;transition:width .4s ease"></div>
      </div>
    `;
    document.body.appendChild(el);
  }
  document.getElementById('py-loader-msg').textContent = msg;
}
function setLoaderProgress(pct) {
  const bar = document.getElementById('py-loader-bar');
  if (bar) bar.style.width = pct + '%';
}
function hideLoader() {
  const el = document.getElementById('py-loader');
  if (el) { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; setTimeout(() => el.remove(), 400); }
}

/* ══════════════════════════════════════
   PYODIDE INIT
══════════════════════════════════════ */
async function initPyodide() {
  setLoaderProgress(10);
  S.pyodide = await loadPyodide();
  setLoaderProgress(40);

  // Fetch kahn.py source and run it in Pyodide
  const pyRes = await fetch('js/kahn.py');
  const pySrc = await pyRes.text();
  setLoaderProgress(60);
  await S.pyodide.runPythonAsync(pySrc);
  setLoaderProgress(80);
}

/* ══════════════════════════════════════
   LOAD + RUN
══════════════════════════════════════ */
async function loadData() {
  const res = await fetch('data/components.json');
  S.components = await res.json();
  setLoaderProgress(85);
}

async function buildResult() {
  // Call the Python bridge function
  const jsonStr = JSON.stringify(S.components);
  const resultJson = S.pyodide.runPython(`run_from_json('''${JSON.stringify(S.components)}''')`);
  S.result = JSON.parse(resultJson);
  setLoaderProgress(100);

  const st = S.result.stats;

  // Header stats
  $('hdr-nodes').textContent = st.nodeCount;
  $('hdr-edges').textContent = st.edgeCount;
  $('hdr-waves').textContent = st.waveCount;
  $('hdr-steps').textContent = S.result.steps.length;

  // Restore Map-like accessors expected by rendering code
  S.result.graph._nodesMap    = new Map(Object.entries(S.result.graph.nodes));
  S.result.graph._inDegreeMap = new Map(Object.entries(S.result.graph.in_degree));

  buildStepLog();
}

/* ══════════════════════════════════════
   BUILD STEP LOG (left panel)
══════════════════════════════════════ */
function buildStepLog() {
  const log = $('step-log');
  log.innerHTML = '';

  S.result.steps.forEach((step, i) => {
    const div = document.createElement('div');
    div.className = 'log-item';
    div.dataset.idx = i;
    div.onclick = () => goToStep(i);

    const phaseLabel = {
      init:         'INIT',
      'wave-start': 'WAVE',
      process:      'PROCESS',
      done:         'DONE',
    }[step.phase] ?? step.phase.toUpperCase();

    const phaseClass = {
      init:         'phase-init',
      'wave-start': 'phase-wave',
      process:      'phase-proc',
      done:         'phase-done',
    }[step.phase] ?? 'phase-init';

    const queuePills = (step.queue ?? []).map(id =>
      `<span class="qpill ${(step.justQueued ?? []).includes(id) ? 'just-queued' : ''}">${id}</span>`
    ).join('');

    const donePills = (step.justDone ?? []).map(id =>
      `<span class="qpill just-done">${id}</span>`
    ).join('');

    div.innerHTML = `
      <div class="log-step-num">STEP ${String(i + 1).padStart(3,'0')} / ${S.result.steps.length}</div>
      <span class="log-phase-badge ${phaseClass}">${phaseLabel}</span>
      <div class="log-desc">${step.description}</div>
      ${donePills || queuePills ? `
        <div class="log-queue">
          ${donePills ? `<span class="log-queue-label">DONE:</span>${donePills}` : ''}
          ${queuePills.length ? `<span class="log-queue-label" style="margin-left:${donePills?'0.5rem':'0'}">QUEUE:</span>${queuePills}` : ''}
        </div>` : ''}
    `;
    log.appendChild(div);
  });
}

/* ══════════════════════════════════════
   BUILD WAVE GRID (right panel)
══════════════════════════════════════ */
function renderWaveGrid() {
  const area = $('wave-area');
  area.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'wave-grid';
  grid.id = 'wave-grid';

  const nodesMap    = S.result.graph._nodesMap;
  const inDegreeMap = S.result.graph._inDegreeMap;

  S.result.waves.forEach((wave, wi) => {
    const row = document.createElement('div');
    row.className = 'wave-row';
    row.dataset.wave = wi;

    row.innerHTML = `
      <div class="wave-label-col">
        <div class="wave-num">Wave ${wi + 1}</div>
        <div class="wave-sub">${wave.length} node${wave.length > 1 ? 's' : ''}</div>
      </div>
      <div class="wave-nodes" id="wave-nodes-${wi}">
        ${wave.map(id => {
          const comp      = nodesMap.get(id);
          const color     = SUB_COLORS[comp?.subsystem] ?? '#555';
          const shortName = (comp?.name ?? id).slice(0, 18) + ((comp?.name?.length ?? 0) > 18 ? '…' : '');
          return `
            <div class="node-card state-pending" id="nc-${id}" data-id="${id}">
              <span class="nc-id">${id}</span>
              <span class="nc-name" style="--sub-color:${color}" title="${comp?.name ?? ''}">${shortName}</span>
              <span class="nc-deg" id="ncdeg-${id}">in: ${inDegreeMap.get(id) ?? 0}</span>
            </div>`;
        }).join('')}
      </div>
    `;
    grid.appendChild(row);
  });

  area.appendChild(grid);
}

/* ══════════════════════════════════════
   IN-DEGREE GRID
══════════════════════════════════════ */
function renderInDegreeGrid() {
  const grid = $('indegree-grid');
  grid.innerHTML = '';
  const nodesMap    = S.result.graph._nodesMap;
  const inDegreeMap = S.result.graph._inDegreeMap;

  for (const [id] of nodesMap) {
    const d   = inDegreeMap.get(id) ?? 0;
    const div = document.createElement('div');
    div.className = `id-cell ${d === 0 ? 'zero' : ''}`;
    div.id = `idc-${id}`;
    div.innerHTML = `
      <span class="id-cell-id">${id}</span>
      <span class="id-cell-deg ${d === 0 ? 'deg-zero' : 'deg-pos'}" id="idcd-${id}">${d}</span>
    `;
    grid.appendChild(div);
  }
}

/* ══════════════════════════════════════
   GO TO STEP
══════════════════════════════════════ */
function goToStep(idx) {
  if (!S.result) return;
  idx = Math.max(0, Math.min(idx, S.result.steps.length - 1));
  S.stepIdx = idx;
  const step = S.result.steps[idx];

  updateStepLog(idx);
  updateAlgoHighlight(step);
  updateWaveGrid(step);
  updateInDegreeGrid(step);
  updateOrderStrip(step);
  updateResultBanner(step);
  updatePseudoHighlight(step);
  updateNavButtons();
  $('step-counter').textContent = `${idx + 1} / ${S.result.steps.length}`;
}

/* ─── Step Log ─── */
function updateStepLog(idx) {
  document.querySelectorAll('.log-item').forEach((el, i) => {
    el.classList.remove('current', 'past');
    if (i === idx)    el.classList.add('current');
    else if (i < idx) el.classList.add('past');
    if (i === idx) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

/* ─── Top algo step highlight ─── */
function updateAlgoHighlight(step) {
  document.querySelectorAll('.asi-step').forEach(el => el.classList.remove('active-phase'));
  const map = {
    init:         'asi-1',
    'wave-start': 'asi-2',
    process:      'asi-3',
    done:         'asi-4',
  };
  const target = map[step.phase];
  if (target) $(target)?.classList.add('active-phase');
}

/* ─── Wave Grid ─── */
function updateWaveGrid(step) {
  const { order, justDone, justQueued, wave, phase } = step;
  const processedSet  = new Set(order ?? []);
  const queueSet      = new Set(step.queue ?? []);
  const activeNode    = step.activeNode;

  document.querySelectorAll('.wave-row').forEach(row => {
    const wi = parseInt(row.dataset.wave);
    row.classList.remove('active-wave', 'done-wave');
    if (wi === step.waveIndex && phase !== 'done') row.classList.add('active-wave');
    else if (wi < step.waveIndex) row.classList.add('done-wave');
  });

  S.result.waves.forEach(w => {
    w.forEach(id => {
      const card = $(`nc-${id}`);
      if (!card) return;
      card.classList.remove('state-pending', 'state-queued', 'state-active', 'state-done');

      if (processedSet.has(id))  card.classList.add('state-done');
      else if (id === activeNode) card.classList.add('state-active');
      else if (queueSet.has(id)) card.classList.add('state-queued');
      else                       card.classList.add('state-pending');

      const degEl = $(`ncdeg-${id}`);
      if (degEl) {
        const d = (step.degree ?? {})[id] ?? 0;
        degEl.textContent = processedSet.has(id) ? '✓' : `in: ${d}`;
      }
    });
  });
}

/* ─── In-Degree Grid ─── */
function updateInDegreeGrid(step) {
  const { order, degree, activeNode, justQueued } = step;
  const processedSet  = new Set(order ?? []);
  const justQueuedSet = new Set(justQueued ?? []);

  for (const [id] of S.result.graph._nodesMap) {
    const cell  = $(`idc-${id}`);
    const degEl = $(`idcd-${id}`);
    if (!cell || !degEl) continue;

    cell.classList.remove('done', 'zero', 'active-node', 'just-freed');

    if (processedSet.has(id)) {
      cell.classList.add('done');
      degEl.className   = 'id-cell-deg deg-done';
      degEl.textContent = '✓';
    } else {
      const d = (degree ?? {})[id] ?? 0;
      degEl.textContent = d;
      if (id === activeNode) {
        cell.classList.add('active-node');
        degEl.className = 'id-cell-deg deg-pos';
      } else if (justQueuedSet.has(id)) {
        cell.classList.add('just-freed');
        degEl.className = 'id-cell-deg deg-zero';
      } else if (d === 0) {
        cell.classList.add('zero');
        degEl.className = 'id-cell-deg deg-zero';
      } else {
        degEl.className = 'id-cell-deg deg-pos';
      }
    }
  }
}

/* ─── Sorted Order Strip ─── */
function updateOrderStrip(step) {
  const strip    = $('order-nodes');
  const newOrder = step.order ?? [];
  const prevLen  = strip.querySelectorAll('.onode').length;

  if (newOrder.length === prevLen) return;
  strip.innerHTML = newOrder.map((id, i) =>
    `<span class="onode ${i >= prevLen ? 'newest' : ''}">${id}</span>`
  ).join('');
  strip.scrollLeft = strip.scrollWidth;
}

/* ─── Result Banner ─── */
function updateResultBanner(step) {
  const banner = $('result-banner');
  if (step.phase === 'done') {
    banner.classList.add('show');
    const st = S.result.stats;
    banner.innerHTML = `
      <div class="rb-title">${step.valid ? '✓ VALID — No Cycles' : '⚠ CYCLE DETECTED'}</div>
      <div class="rb-stats">
        <div class="rb-stat"><span>${st.nodeCount}</span> nodes sorted</div>
        <div class="rb-stat"><span>${st.waveCount}</span> waves</div>
        <div class="rb-stat"><span>${st.maxWaveSize}</span> max parallel</div>
        <div class="rb-stat"><span>${st.avgWaveSize}</span> avg wave size</div>
      </div>
    `;
  } else {
    banner.classList.remove('show');
  }
}

/* ─── Pseudocode highlight ─── */
const PSEUDO_HIGHLIGHT_MAP = {
  init:         [1, 2, 3, 4, 5],
  'wave-start': [7, 8, 9],
  process:      [10, 11, 12, 13, 14],
  done:         [16, 17],
};
function updatePseudoHighlight(step) {
  const lines = PSEUDO_HIGHLIGHT_MAP[step.phase] ?? [];
  document.querySelectorAll('.pseudo-line').forEach(el => {
    const ln = parseInt(el.dataset.line);
    el.classList.toggle('hl', lines.includes(ln));
  });
}

/* ─── Nav buttons ─── */
function updateNavButtons() {
  $('btn-prev').disabled  = S.stepIdx <= 0;
  $('btn-next').disabled  = S.stepIdx >= S.result.steps.length - 1;
  $('btn-play').textContent = S.playing ? '⏸ Pause' : '▶ Play';
}

/* ══════════════════════════════════════
   CONTROLS
══════════════════════════════════════ */
function wireControls() {
  $('btn-prev').onclick  = () => { stopPlay(); goToStep(S.stepIdx - 1); };
  $('btn-next').onclick  = () => { stopPlay(); goToStep(S.stepIdx + 1); };
  $('btn-first').onclick = () => { stopPlay(); goToStep(0); };
  $('btn-last').onclick  = () => { stopPlay(); goToStep(S.result.steps.length - 1); };

  $('btn-play').onclick = () => {
    if (S.playing) stopPlay();
    else startPlay();
  };

  $('speed-range').oninput = e => {
    const v = parseInt(e.target.value);
    S.speed = Math.round(1600 - v * 150);
    $('speed-label').textContent = v <= 3 ? 'slow' : v <= 7 ? 'mid' : 'fast';
  };

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight' || e.key === 'l') { stopPlay(); goToStep(S.stepIdx + 1); }
    if (e.key === 'ArrowLeft'  || e.key === 'h') { stopPlay(); goToStep(S.stepIdx - 1); }
    if (e.key === ' ') { e.preventDefault(); S.playing ? stopPlay() : startPlay(); }
    if (e.key === 'Home') { stopPlay(); goToStep(0); }
    if (e.key === 'End')  { stopPlay(); goToStep(S.result.steps.length - 1); }
  });
}

function startPlay() {
  if (S.stepIdx >= S.result.steps.length - 1) goToStep(0);
  S.playing = true;
  updateNavButtons();
  tick();
}
function stopPlay() {
  S.playing = false;
  clearTimeout(S.playTimer);
  updateNavButtons();
}
function tick() {
  if (!S.playing) return;
  if (S.stepIdx >= S.result.steps.length - 1) { stopPlay(); return; }
  goToStep(S.stepIdx + 1);
  S.playTimer = setTimeout(tick, S.speed);
}

/* ══════════════════════════════════════
   PSEUDOCODE PANEL
══════════════════════════════════════ */
function wirePseudo() {
  const panel = $('pseudo-panel');
  $('pseudo-header').onclick = () => panel.classList.toggle('collapsed');
}

/* ══════════════════════════════════════
   UTIL
══════════════════════════════════════ */
function $(id) { return document.getElementById(id); }
