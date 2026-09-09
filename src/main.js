import '@fontsource-variable/space-grotesk';
import '@fontsource/ibm-plex-mono/latin-400.css';
import './style.css';
import { createIcons, Orbit, ArrowUpRight, ArrowRight, ArrowDown, Plus, Minus, RotateCcw, Pause, Play, Volume2, VolumeX, Camera, Maximize, Minimize, X, Radio, Search, Check, Copy, Shuffle, Crosshair, Send, RefreshCw, Globe2, ExternalLink } from 'lucide';
import gsap from 'gsap';
import { ObservatoryAudio } from './audio.js';
import { fetchSignals, fetchSignal, sendSignal, subscribeSignals } from './data.js';
import { formatCoordinates, validateSignal } from './coordinates.js';

const icons = { Orbit, ArrowUpRight, ArrowRight, ArrowDown, Plus, Minus, RotateCcw, Pause, Play, Volume2, VolumeX, Camera, Maximize, Minimize, X, Radio, Search, Check, Copy, Shuffle, Crosshair, Send, RefreshCw, Globe2, ExternalLink };
const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const iconButton = (id, name, label) => `<button class="icon-button" id="${id}" aria-label="${label}" data-tooltip="${label}">${icon(name)}</button>`;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const refreshIcons = () => createIcons({ icons, attrs: { 'stroke-width': 1.5 } });

$('#app').innerHTML = `
  <header class="site-header">
    <a class="brand" href="#observatory" aria-label="Mercuryzz observatory">${icon('orbit')}<span>mercuryzz<span class="brand-dot">.</span></span></a>
    <nav aria-label="Main navigation">
      <a class="nav-link active" href="#observatory">Observatory</a>
      <a class="nav-link" href="#signals">Signals <span class="nav-count" id="nav-count">0</span></a>
      <button class="nav-link" id="notes-button">Field notes ${icon('arrow-up-right')}</button>
    </nav>
    <div class="header-right"><span class="network-state" id="network-state"><span class="status-dot"></span><span id="network-label">Connecting</span></span><span class="utc-clock" id="clock">00:00:00 UTC</span></div>
  </header>

  <main>
    <section class="observatory" id="observatory" aria-label="Mercury observatory">
      <div class="section-index mono"><span class="cross">+</span> SOL SYSTEM <span class="faint">/</span> OBJECT 01</div>
      <div class="hero-copy">
        <div class="eyebrow"><span class="short-line"></span> THE INNERMOST WORLD</div>
        <h1>Mercury<span class="title-period">.</span></h1>
        <p class="hero-description">Somewhere between<br>the Sun and the silence.</p>
        <div class="planet-facts">
          <div><span class="fact-label">DISTANCE FROM SUN</span><span class="fact-value">57.9 <small>million km</small></span></div>
          <div class="fact-pair"><div><span class="fact-label">ONE YEAR</span><span class="fact-value">88 <small>Earth days</small></span></div><div><span class="fact-label">RADIUS</span><span class="fact-value">2,440 <small>km</small></span></div></div>
        </div>
        <button class="primary-button" id="leave-signal">Leave a signal ${icon('arrow-up-right')}</button>
        <div class="hero-footnote mono"><span class="status-dot"></span> A LITTLE PROOF YOU WERE HERE.</div>
      </div>

      <div class="scene-wrap" id="scene-wrap">
        <div class="scene" id="scene"></div>
        <div class="scene-loader" id="scene-loader"><span class="loader-orbit"></span><span class="mono">ACQUIRING SURFACE</span></div>
        <div class="scene-error" id="scene-error" hidden><p></p><button class="text-button" id="reload-scene">Reload ${icon('refresh-cw')}</button></div>
        <div class="polar-label mono"><span class="cross">+</span> N <span class="polar-line"></span></div>
        <div class="scale-label mono"><span></span> SURFACE VIEW <span></span></div>
        <div class="globe-tag mono"><span class="status-dot"></span> MERCURY <span class="faint">/ 01</span></div>
      </div>

      <div class="scene-topbar">
        <div class="segmented" role="group" aria-label="Surface view">
          <button class="selected" data-mode="surface" aria-pressed="true">Surface</button>
          <button data-mode="nightfall" aria-pressed="false">Nightfall</button>
          <button data-mode="contours" aria-pressed="false">Contours</button>
        </div>
        ${iconButton('focus-view', 'maximize', 'Focus view')}
      </div>
      <div class="view-caption mono" id="view-caption">VISIBLE LIGHT <span class="faint">/</span> SURFACE MOSAIC</div>
      <div class="scene-side-tools">
        ${iconButton('zoom-in', 'plus', 'Zoom in')}
        ${iconButton('zoom-out', 'minus', 'Zoom out')}
        <span class="tool-divider"></span>
        ${iconButton('reset-view', 'rotate-ccw', 'Reset orbit')}
      </div>
      <div class="scene-bottom-bar">
        <div class="coordinate-block"><span class="fact-label">VIEW COORDINATES</span><span class="mono" id="coordinates">7.0&deg; N / 87.0&deg; E</span></div>
        <div class="capture-tools">
          ${iconButton('rotation-toggle', 'pause', 'Pause orbit')}
          ${iconButton('sound-toggle', 'volume-x', 'Enable ambient sound')}
          <span class="tool-divider vertical"></span>
          ${iconButton('capture', 'camera', 'Save observation')}
        </div>
      </div>
      <div class="pick-banner" id="pick-banner" hidden><span class="status-dot"></span><span>Select a surface coordinate</span><button class="icon-button" id="cancel-pick" aria-label="Cancel coordinate selection">${icon('x')}</button></div>
      <div class="observatory-footer"><div class="mono"><span class="orbit-glyph">${icon('orbit')}</span> INDEPENDENT OBSERVATORY <span class="faint">EST. 2026</span></div><a href="#signals" class="discover-link">Voices from Earth ${icon('arrow-down')}</a></div>
    </section>

    <section class="signals-section" id="signals">
      <div class="signals-heading"><div><div class="eyebrow"><span class="short-line"></span> THE HUMAN FREQUENCY</div><h2>No world is empty<br>once someone listens<span class="title-period">.</span></h2></div><div class="signal-total"><span class="total-number" id="total-signals">00</span><span class="mono">SIGNALS RECEIVED</span></div></div>
      <div class="signal-toolbar"><div class="filters" role="group" aria-label="Filter signals"><button class="selected" data-filter="all" aria-pressed="true">All signals</button><button data-filter="wonder" aria-pressed="false"><span class="mood-dot wonder"></span>Wonder</button><button data-filter="hope" aria-pressed="false"><span class="mood-dot hope"></span>Hope</button><button data-filter="curiosity" aria-pressed="false"><span class="mood-dot curiosity"></span>Curiosity</button></div><label class="search-field">${icon('search')}<input id="signal-search" type="search" placeholder="Find a signal" aria-label="Search signals" maxlength="100"></label></div>
      <div class="signal-grid" id="signal-grid" aria-live="polite"><p class="empty-state">Listening for the first signal...</p></div>
      <div class="feed-footer"><span class="mono" id="feed-status">CONNECTING TO THE ARCHIVE</span><button class="text-button" id="more-signals" hidden>More signals ${icon('arrow-down')}</button><button class="text-button" id="retry-signals" hidden>Reconnect ${icon('refresh-cw')}</button></div>
    </section>
  </main>
  <footer class="site-footer"><a class="brand" href="#observatory">${icon('orbit')}<span>mercuryzz.</span></a><span>A small planet. An open invitation.</span><button class="text-button" id="credits-button">About this observatory ${icon('arrow-up-right')}</button></footer>

  <dialog class="signal-dialog" id="compose-dialog" aria-labelledby="compose-title">
    <form id="signal-form">
      <div class="dialog-top"><span class="eyebrow">OUTBOUND / NEW SIGNAL</span><button type="button" class="icon-button" data-close="compose-dialog" aria-label="Close">${icon('x')}</button></div>
      <div class="dialog-symbol">${icon('radio')}</div><h2 id="compose-title">Leave something<br>worth finding<span class="title-period">.</span></h2>
      <div class="destination"><div><span class="fact-label">DESTINATION / MERCURY</span><span class="mono" id="destination-coordinates"></span></div><div>${iconButton('random-coordinate', 'shuffle', 'Random coordinate')}${iconButton('pick-coordinate', 'crosshair', 'Choose on globe')}</div></div>
      <label class="form-label" for="callsign">Callsign</label><input class="text-input" id="callsign" name="name" maxlength="32" placeholder="Your name, or a name for tonight" required autocomplete="nickname">
      <div class="form-label-row"><label class="form-label" for="signal-message">Your signal</label><span class="mono" id="character-count">0 / 280</span></div><textarea id="signal-message" name="message" maxlength="280" rows="4" placeholder="To whoever finds this..." required></textarea>
      <fieldset class="mood-fieldset"><legend class="form-label">Frequency</legend><div class="mood-options"><label><input type="radio" name="mood" value="wonder" checked><span><span class="mood-dot wonder"></span>Wonder</span></label><label><input type="radio" name="mood" value="hope"><span><span class="mood-dot hope"></span>Hope</span></label><label><input type="radio" name="mood" value="curiosity"><span><span class="mood-dot curiosity"></span>Curiosity</span></label></div></fieldset>
      <p class="form-error" id="form-error" role="alert" hidden></p>
      <button class="primary-button send-button" id="send-signal" type="submit">Transmit signal ${icon('send')}</button><p class="privacy-note">Your callsign and message will be public.</p>
    </form>
  </dialog>

  <dialog class="signal-dialog read-dialog" id="read-dialog" aria-labelledby="read-title"><div class="dialog-top"><span class="eyebrow" id="read-id"></span><button class="icon-button" data-close="read-dialog" aria-label="Close signal">${icon('x')}</button></div><div class="read-frequency" id="read-frequency"></div><h2 id="read-title">A voice from Earth.</h2><blockquote id="read-message"></blockquote><div class="read-author"><span class="avatar" id="read-avatar"></span><div><strong id="read-name"></strong><span class="mono" id="read-date"></span></div></div><div class="destination"><div><span class="fact-label">SURFACE COORDINATES</span><span class="mono" id="read-coordinates"></span></div>${icon('crosshair')}</div><div class="read-actions"><button class="primary-button" id="locate-signal">Go to coordinate ${icon('arrow-up-right')}</button>${iconButton('share-signal', 'copy', 'Copy signal link')}</div></dialog>

  <dialog class="notes-dialog" id="notes-dialog" aria-labelledby="notes-title"><div class="dialog-top"><span class="eyebrow">FIELD NOTES / 001</span><button class="icon-button" data-close="notes-dialog" aria-label="Close field notes">${icon('x')}</button></div><h2 id="notes-title">A world of<br>beautiful extremes<span class="title-period">.</span></h2><p>Smallest of the planets. Closest to our star. A cratered world with almost no atmosphere, where daylight can reach 430&deg;C and the night can fall to &minus;180&deg;C.</p><div class="note-stats"><div><strong>3.7 <small>m/s&sup2;</small></strong><span>Surface gravity</span></div><div><strong>58.6 <small>days</small></strong><span>One rotation</span></div><div><strong>0</strong><span>Moons</span></div></div><p>Our observatory pairs a spacecraft-derived surface mosaic with an imagined place for human messages. Signals belong to this digital Mercury, not to a spacecraft.</p><p class="note-small">Nightfall is an artistic lighting study. Contours trace image brightness, not measured elevation. The view is freely composed, not a live ephemeris.</p><div class="source-links"><a href="https://science.nasa.gov/mercury/facts/" target="_blank" rel="noopener noreferrer">Planetary facts / NASA ${icon('external-link')}</a><a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener noreferrer">Surface texture / Solar System Scope ${icon('external-link')}</a><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">Texture license / CC BY 4.0 ${icon('external-link')}</a><a href="https://github.com/Chengwei0521/Mercuryzz" target="_blank" rel="noopener noreferrer">Made on Earth / Source code ${icon('external-link')}</a></div></dialog>
  <div class="toast" id="toast" role="status" aria-live="polite"><span class="toast-icon">${icon('check')}</span><span id="toast-message"></span></div>
`;

// Tool buttons inside the composition form must never submit it implicitly.
$$('#compose-dialog .icon-button').forEach((button) => { button.type = 'button'; });
refreshIcons();
let scene;
let signals = [];
let total = 0;
let filter = 'all';
let visibleLimit = 6;
let currentCoordinates = { latitude: 7, longitude: 87 };
let destination = { ...currentCoordinates };
let selectedSignal = null;
let picking = false;
let connected = false;
let loadingSignals = false;
let toastTimeout;
const audio = new ObservatoryAudio();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const composeDialog = $('#compose-dialog');
const readDialog = $('#read-dialog');
const notesDialog = $('#notes-dialog');

function setButtonIcon(button, name, label) {
  button.innerHTML = icon(name);
  button.setAttribute('aria-label', label);
  button.dataset.tooltip = label;
  refreshIcons();
}

function toast(message) {
  $('#toast-message').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 4500);
}

function showDialog(dialog) {
  for (const other of [composeDialog, readDialog, notesDialog]) if (other.open) other.close();
  dialog.showModal();
}

$$('[data-close]').forEach((button) => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
for (const dialog of [composeDialog, readDialog, notesDialog]) {
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
}
$('#notes-button').addEventListener('click', () => showDialog(notesDialog));
$('#credits-button').addEventListener('click', () => showDialog(notesDialog));
$('#reload-scene').addEventListener('click', () => location.reload());

function handleSceneError(message) {
  $('#scene-loader').hidden = true;
  $('#scene-error').hidden = false;
  $('#scene-error p').textContent = message;
}

async function startScene() {
try {
  const { MercuryScene } = await import('./planet.js');
  scene = new MercuryScene($('#scene'), {
    onReady: () => {
      $('#scene-loader').hidden = true;
      $('#scene-wrap').classList.add('ready');
      if (!reducedMotion) gsap.fromTo('#scene canvas', { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 1.8, ease: 'power2.out' });
    },
    onError: handleSceneError,
    onCoordinates: (coordinates) => { currentCoordinates = coordinates; $('#coordinates').textContent = formatCoordinates(coordinates.latitude, coordinates.longitude); },
    onPlaying: (playing) => {
      setButtonIcon($('#rotation-toggle'), playing ? 'pause' : 'play', playing ? 'Pause orbit' : 'Resume orbit');
      $('#rotation-toggle').setAttribute('aria-pressed', String(playing));
    },
    onPick: (coordinates) => {
      destination = coordinates;
      if (picking) stopPicking();
      openCompose(coordinates);
    },
    onSignal: openSignal,
  });
  scene.setSignals(signals);
  if (reducedMotion) setButtonIcon($('#rotation-toggle'), 'play', 'Resume orbit');
} catch {
  handleSceneError('This browser could not start 3D graphics. Signals are still available below.');
  $$('.scene-side-tools button, .capture-tools button, [data-mode], #pick-coordinate').forEach((button) => { button.disabled = true; });
}
}
startScene();

if (!reducedMotion) gsap.from('.hero-copy > *, .section-index', { opacity: 0, y: 14, duration: 0.8, stagger: 0.08, ease: 'power2.out' });

$$('[data-mode]').forEach((button) => button.addEventListener('click', () => {
  if (!scene?.setMode(button.dataset.mode)) return toast('Surface imagery is still loading.');
  $$('[data-mode]').forEach((tab) => { tab.classList.toggle('selected', tab === button); tab.setAttribute('aria-pressed', String(tab === button)); });
  const captions = { surface: 'VISIBLE LIGHT / SURFACE MOSAIC', nightfall: 'NIGHTFALL / LIGHTING STUDY', contours: 'CONTOURS / STYLIZED RELIEF' };
  $('#view-caption').textContent = captions[button.dataset.mode];
}));
$('#zoom-in').addEventListener('click', () => scene?.zoom(1));
$('#zoom-out').addEventListener('click', () => scene?.zoom(-1));
$('#reset-view').addEventListener('click', () => scene?.reset());
$('#rotation-toggle').addEventListener('click', () => scene?.setPlaying(!scene.controls.autoRotate));
$('#sound-toggle').addEventListener('click', async () => {
  try {
    const enabled = await audio.toggle();
    setButtonIcon($('#sound-toggle'), enabled ? 'volume-2' : 'volume-x', enabled ? 'Mute ambient sound' : 'Enable ambient sound');
    $('#sound-toggle').setAttribute('aria-pressed', String(enabled));
  } catch { toast('Audio is unavailable in this browser.'); }
});
$('#focus-view').addEventListener('click', () => {
  const focused = document.body.classList.toggle('focused');
  setButtonIcon($('#focus-view'), focused ? 'minimize' : 'maximize', focused ? 'Exit focus view' : 'Focus view');
  $('#observatory').scrollIntoView({ behavior: 'instant' });
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (picking) { stopPicking(); scene?.clearSelection(); }
  if (document.body.classList.contains('focused') && !composeDialog.open && !readDialog.open && !notesDialog.open) $('#focus-view').click();
});
$('#capture').addEventListener('click', async () => {
  if (!scene) return;
  try {
    const blob = await scene.capture();
    if (!blob) throw new Error('No image');
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mercury-observation-${new Date().toISOString().slice(0, 10)}.png`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast('Observation saved. A little piece of Mercury.');
  } catch { toast('The observation could not be saved. Please try again.'); }
});

function updateDestination() {
  $('#destination-coordinates').textContent = formatCoordinates(destination.latitude, destination.longitude);
  scene?.setSelection(destination);
}

function openCompose(coordinates = currentCoordinates) {
  destination = { latitude: Number(coordinates.latitude.toFixed(3)), longitude: Number(coordinates.longitude.toFixed(3)) };
  updateDestination();
  $('#form-error').hidden = true;
  scene?.setPlaying(false);
  showDialog(composeDialog);
}
$('#leave-signal').addEventListener('click', () => openCompose());
$('#random-coordinate').addEventListener('click', () => {
  destination = { latitude: Number((Math.asin(Math.random() * 2 - 1) * 180 / Math.PI).toFixed(3)), longitude: Number((Math.random() * 360 - 180).toFixed(3)) };
  updateDestination();
  scene?.focus(destination);
});
$('#pick-coordinate').addEventListener('click', () => {
  if (!scene) return;
  picking = true;
  scene.picking = true;
  composeDialog.close();
  $('#pick-banner').hidden = false;
  $('#scene').classList.add('picking');
  scene.updateLabels();
  $('#observatory').scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' });
});
function stopPicking() {
  picking = false;
  if (scene) { scene.picking = false; scene.updateLabels(); }
  $('#pick-banner').hidden = true;
  $('#scene').classList.remove('picking');
}
$('#cancel-pick').addEventListener('click', () => { stopPicking(); openCompose(destination); });
composeDialog.addEventListener('close', () => { if (!picking) scene?.clearSelection(); });
$('#signal-message').addEventListener('input', (event) => { $('#character-count').textContent = `${[...event.target.value].length} / 280`; });
try { $('#callsign').value = localStorage.getItem('mercury-callsign') || ''; } catch { /* Storage may be disabled in private browsing. */ }

$('#signal-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#send-signal');
  if (button.disabled) return;
  const form = new FormData(event.currentTarget);
  const signal = { name: String(form.get('name')).trim(), message: String(form.get('message')).trim(), mood: String(form.get('mood')), ...destination };
  const validation = validateSignal(signal);
  if (validation) { $('#form-error').hidden = false; $('#form-error').textContent = validation; return; }
  button.disabled = true;
  button.textContent = 'Transmitting...';
  $('#form-error').hidden = true;
  try {
    const saved = await sendSignal(signal);
    addSignal(saved);
    composeDialog.close();
    $('#signal-message').value = '';
    $('#character-count').textContent = '0 / 280';
    try { localStorage.setItem('mercury-callsign', signal.name); } catch { /* Optional preference. */ }
    $('#observatory').scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' });
    scene?.focus(saved);
    audio.signal();
    setTimeout(() => scene?.pulse(saved), reducedMotion ? 0 : 1600);
    toast(`Signal ${String(saved.id).padStart(3, '0')} received. You are part of this world now.`);
  } catch (error) {
    $('#form-error').hidden = false;
    $('#form-error').textContent = error.message?.includes('Signals are') || error.message?.includes('daily signal') ? error.message : 'Transmission could not be confirmed. Your draft is here; check the archive before retrying.';
  } finally {
    button.disabled = false;
    button.innerHTML = `Transmit signal ${icon('send')}`;
    refreshIcons();
  }
});

function prettyTime(value) {
  const date = new Date(value);
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function renderSignals() {
  const query = $('#signal-search').value.trim().toLowerCase();
  const matching = signals.filter((signal) => (filter === 'all' || signal.mood === filter) && `${signal.name} ${signal.message}`.toLowerCase().includes(query));
  const grid = $('#signal-grid');
  grid.replaceChildren();
  $('#nav-count').textContent = total;
  $('#total-signals').textContent = String(total).padStart(2, '0');
  if (!matching.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = signals.length ? 'No signals on this frequency. Try another.' : connected ? 'A quiet world. Leave its first signal.' : 'The archive is out of range. Reconnect to try again.';
    grid.append(empty);
  }
  matching.slice(0, visibleLimit).forEach((signal) => {
    const card = document.createElement('button');
    card.className = `signal-card ${signal.mood}`;
    card.innerHTML = `<div class="signal-card-top"><span class="signal-type mono"><span class="mood-dot"></span><span class="mood-label"></span></span><span class="signal-number mono"></span></div><p class="signal-message"></p><div class="signal-card-bottom"><span class="signal-author"></span><span class="signal-time mono"></span>${icon('arrow-up-right')}</div>`;
    card.querySelector('.mood-label').textContent = signal.mood.toUpperCase();
    card.querySelector('.signal-number').textContent = `S-${String(signal.id).padStart(3, '0')}`;
    card.querySelector('.signal-message').textContent = signal.message;
    card.querySelector('.signal-author').textContent = signal.is_observatory ? 'Observatory / opening log' : signal.name;
    card.querySelector('.signal-time').textContent = prettyTime(signal.created_at);
    card.addEventListener('click', () => openSignal(signal));
    grid.append(card);
  });
  $('#more-signals').hidden = matching.length <= visibleLimit;
  $('#feed-status').textContent = `${matching.length} ${filter === 'all' ? 'SIGNALS' : filter.toUpperCase() + ' SIGNALS'} IN VIEW${total > 100 ? ' / LATEST 100' : ''}`;
  refreshIcons();
}

function addSignal(signal) {
  if (signals.some((existing) => existing.id === signal.id)) return;
  signals = [signal, ...signals].sort((a, b) => b.id - a.id).slice(0, 100);
  total += 1;
  renderSignals();
  scene?.setSignals(signals);
}

function setNetwork(state) {
  $('#network-state').dataset.state = state;
  $('#network-label').textContent = { live: 'Live connection', ready: 'Archive online', offline: 'Reconnecting', loading: 'Connecting' }[state];
}

async function loadSignals() {
  if (loadingSignals) return;
  loadingSignals = true;
  $('#retry-signals').hidden = true;
  try {
    const result = await fetchSignals();
    signals = result.signals;
    total = result.count;
    connected = true;
    if ($('#network-state').dataset.state !== 'live') setNetwork('ready');
    scene?.setSignals(signals);
    renderSignals();
  } catch {
    connected = false;
    setNetwork('offline');
    if (!signals.length) renderSignals();
    $('#feed-status').textContent = 'ARCHIVE TEMPORARILY UNAVAILABLE';
    $('#retry-signals').hidden = false;
  } finally { loadingSignals = false; }
}

$('#retry-signals').addEventListener('click', loadSignals);
$$('[data-filter]').forEach((button) => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  visibleLimit = 6;
  $$('[data-filter]').forEach((other) => { other.classList.toggle('selected', other === button); other.setAttribute('aria-pressed', String(other === button)); });
  renderSignals();
}));
$('#signal-search').addEventListener('input', () => { visibleLimit = 6; renderSignals(); });
$('#more-signals').addEventListener('click', () => { visibleLimit += 6; renderSignals(); });

function openSignal(signal) {
  selectedSignal = signal;
  $('#read-id').textContent = `INBOUND / SIGNAL ${String(signal.id).padStart(3, '0')}`;
  $('#read-frequency').textContent = signal.mood;
  $('#read-frequency').className = `read-frequency ${signal.mood}`;
  $('#read-message').textContent = signal.message;
  $('#read-name').textContent = signal.is_observatory ? 'Observatory / opening log' : signal.name;
  $('#read-avatar').textContent = [...signal.name][0].toUpperCase();
  $('#read-date').textContent = new Date(signal.created_at).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' });
  $('#read-coordinates').textContent = formatCoordinates(signal.latitude, signal.longitude);
  scene?.setPlaying(false);
  showDialog(readDialog);
}
$('#locate-signal').addEventListener('click', () => {
  readDialog.close();
  $('#observatory').scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' });
  scene?.focus(selectedSignal);
  const target = selectedSignal;
  setTimeout(() => scene?.pulse(target), reducedMotion ? 0 : 1500);
  toast(`Signal from ${target.name} / ${formatCoordinates(target.latitude, target.longitude)}`);
});
$('#share-signal').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(`${location.origin}/#signal=${selectedSignal.id}`);
    toast('Signal link copied. Send it back to Earth.');
  } catch { toast('Link could not be copied. Clipboard access is unavailable.'); }
});

async function openLinkedSignal() {
  const match = location.hash.match(/^#signal=(\d{1,15})$/);
  if (!match) return;
  try {
    const signal = signals.find((entry) => String(entry.id) === match[1]) || await fetchSignal(match[1]);
    openSignal(signal);
  } catch { toast('This signal could not be found.'); }
}
window.addEventListener('hashchange', openLinkedSignal);

function updateClock() {
  $('#clock').textContent = `${new Date().toLocaleTimeString('en-GB', { timeZone: 'UTC', hour12: false })} UTC`;
}
updateClock();
setInterval(updateClock, 1000);
loadSignals().then(openLinkedSignal);
const realtimeStatus = (status) => {
  if (status === 'SUBSCRIBED') { setNetwork('live'); loadSignals(); }
  else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setNetwork(connected ? 'ready' : 'offline');
};
let unsubscribe = subscribeSignals(addSignal, realtimeStatus);
// Reconcile missed websocket events after reconnecting or returning to the tab.
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadSignals(); });
window.addEventListener('online', loadSignals);
window.addEventListener('offline', () => setNetwork('offline'));
setInterval(() => { if (!document.hidden) loadSignals(); }, 45000);
window.addEventListener('pagehide', () => unsubscribe());
window.addEventListener('pageshow', (event) => {
  if (event.persisted) { unsubscribe = subscribeSignals(addSignal, realtimeStatus); loadSignals(); }
});

const sectionObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) if (entry.isIntersecting) {
    $$('.nav-link[href]').forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
  }
}, { rootMargin: '-20% 0px -50% 0px' });
sectionObserver.observe($('#observatory'));
sectionObserver.observe($('#signals'));
