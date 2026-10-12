const STORAGE_KEY = 'xanh.fontScale.v1';
const DEFAULT_STEP = 0;
const MIN_STEP = -2;
const MAX_STEP = 3;
const STEPS = [0.9, 0.95, 1, 1.1, 1.2, 1.3];
const INCLUDED_TEXT_TAGS = new Set(['A','ABBR','B','BDI','BDO','BLOCKQUOTE','BUTTON','CAPTION','CITE','CODE','DD','DT','EM','FIGCAPTION','H1','H2','H3','H4','H5','H6','I','INPUT','LABEL','LEGEND','LI','MARK','OPTION','P','PRE','Q','S','SAMP','SELECT','SMALL','SPAN','STRONG','SUMMARY','TD','TEXTAREA','TH','TIME']);
const widget = document.getElementById('font-accessibility-tools');
let step = DEFAULT_STEP;
let applying = false;
let scheduled = false;

function readSavedStep() {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(n) && n >= MIN_STEP && n <= MAX_STEP ? n : DEFAULT_STEP;
  } catch { return DEFAULT_STEP; }
}
function saveStep() {
  try { localStorage.setItem(STORAGE_KEY, String(step)); } catch { /* storage may be disabled */ }
}
function factorForStep(value = step) { return STEPS[value - MIN_STEP]; }
function isTextElement(el) {
  if (!(el instanceof HTMLElement) || el === widget || widget?.contains(el)) return false;
  if (['SCRIPT','STYLE','NOSCRIPT','TEMPLATE','SVG','PATH','IMG','PICTURE','VIDEO','CANVAS','AUDIO','SOURCE','TRACK','IFRAME','OBJECT','EMBED'].includes(el.tagName)) return false;
  if (INCLUDED_TEXT_TAGS.has(el.tagName)) return true;
  return [...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 0);
}
function eligibleElements() {
  return [...document.body.querySelectorAll('*')].filter(isTextElement);
}
function restoreOriginalFontSizes(elements) {
  for (const el of elements) {
    if (el.dataset.xanhFontScaled !== '1') continue;
    if (el.dataset.xanhFontOriginalInline === '1') {
      el.style.setProperty('font-size', el.dataset.xanhFontOriginalValue || '', el.dataset.xanhFontOriginalPriority || '');
    } else {
      el.style.removeProperty('font-size');
    }
    delete el.dataset.xanhFontScaled;
    delete el.dataset.xanhFontOriginalInline;
    delete el.dataset.xanhFontOriginalValue;
    delete el.dataset.xanhFontOriginalPriority;
  }
}
function applyFontScale() {
  if (applying || !document.body) return;
  applying = true;
  const factor = factorForStep();
  try {
    const elements = eligibleElements();
    // Restore the unscaled inline styles before measurement so repeated clicks never compound.
    restoreOriginalFontSizes(elements);
    // Snapshot every baseline first; do not measure a child after its parent has already been scaled.
    const measurements = elements.map(el => ({ el, baseline: Number.parseFloat(getComputedStyle(el).fontSize) }));
    for (const { el, baseline } of measurements) {
      if (!Number.isFinite(baseline) || baseline <= 0) continue;
      const inlineValue = el.style.getPropertyValue('font-size');
      const inlinePriority = el.style.getPropertyPriority('font-size');
      el.dataset.xanhFontOriginalInline = inlineValue ? '1' : '0';
      if (inlineValue) {
        el.dataset.xanhFontOriginalValue = inlineValue;
        el.dataset.xanhFontOriginalPriority = inlinePriority;
      }
      el.style.setProperty('font-size', `${Math.max(10, Math.min(60, baseline * factor))}px`, 'important');
      el.dataset.xanhFontScaled = '1';
    }
    document.documentElement.dataset.fontScale = String(step);
    document.documentElement.style.setProperty('--xanh-font-scale', String(factor));
    if (widget) {
      const status = widget.querySelector('.font-accessibility-status');
      const label = {[-2]:'Nhỏ',[-1]:'Hơi nhỏ',[0]:'Mặc định',[1]:'Lớn',[2]:'Rất lớn',[3]:'Cực lớn'}[step] || 'Mặc định';
      if (status) status.textContent = label;
      widget.querySelectorAll('[data-font-step]').forEach(button => {
        const value = Number(button.dataset.fontStep);
        button.setAttribute('aria-pressed', String(value === 0 && step === 0));
        button.disabled = (value < 0 && step === MIN_STEP) || (value > 0 && step === MAX_STEP);
      });
    }
  } finally {
    applying = false;
  }
}
function scheduleApply() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; applyFontScale(); });
}
function changeBy(delta) {
  if (delta === 0) step = DEFAULT_STEP;
  else step = Math.max(MIN_STEP, Math.min(MAX_STEP, step + delta));
  saveStep();
  scheduleApply();
}

if (widget) {
  widget.querySelectorAll('[data-font-step]').forEach(button => button.addEventListener('click', () => changeBy(Number(button.dataset.fontStep))));
  step = readSavedStep();
  applyFontScale();
  // Observe only structural changes so typography style changes cannot create an observer loop.
  const root = document.body;
  const observer = new MutationObserver(records => {
    if (applying) return;
    // Ignore mutations inside the widget itself (notably its live status label),
    // otherwise updating that label could cause an observer loop.
    if (records.some(r => r.type === 'childList' && !widget?.contains(r.target) && (r.addedNodes.length || r.removedNodes.length))) scheduleApply();
  });
  observer.observe(root, { childList: true, subtree: true });
  window.addEventListener('resize', scheduleApply, { passive: true });
  if (document.fonts?.ready) document.fonts.ready.then(scheduleApply).catch(() => {});
}
