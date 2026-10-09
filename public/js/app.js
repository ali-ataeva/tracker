import { analyze, autoEndDate, periodLength } from './cycle.js';
import { formatDate, formatRange, isISODate, todayISO } from './dates.js';

const $ = (id) => document.getElementById(id);

const state = {
  periods: [],
  analysis: analyze([], todayISO()),
  today: todayISO(),
  loadedAt: 0,
};

/* ───────────── Talking to the server ───────────── */

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function api(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Couldn't reach the server. Check your internet connection and try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== '/api/login') showScreen('login');
  if (!response.ok) throw new ApiError(response.status, data.error || 'Something went wrong. Please try again.');
  return data;
}

async function load({ quiet = false } = {}) {
  try {
    const { periods } = await api('/api/periods');
    setPeriods(periods);
    showScreen('app');
  } catch (err) {
    if (err.status === 401 || quiet) return;
    $('loading-logo').hidden = true;
    $('loading-error-text').textContent = err.message;
    $('loading-error').hidden = false;
    showScreen('loading');
  }
}

function setPeriods(periods) {
  state.periods = periods;
  state.today = todayISO();
  state.analysis = analyze(periods, state.today);
  state.loadedAt = Date.now();
  render();
}

/* ───────────── Screens ───────────── */

function showScreen(name) {
  $('loading-screen').hidden = name !== 'loading';
  $('login-screen').hidden = name !== 'login';
  $('app-screen').hidden = name !== 'app';
  if (name === 'login') setTimeout(() => $('passcode').focus(), 50);
}

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button');
  const error = $('login-error');
  error.hidden = true;
  button.disabled = true;
  try {
    await api('/api/login', { method: 'POST', body: { passcode: $('passcode').value } });
    $('passcode').value = '';
    await load();
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
    form.classList.remove('shake');
    void form.offsetWidth; // restart the wobble animation
    form.classList.add('shake');
    $('passcode').select();
  } finally {
    button.disabled = false;
  }
});

$('logout').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  showScreen('login');
});

$('retry').addEventListener('click', () => {
  $('loading-error').hidden = true;
  $('loading-logo').hidden = false;
  load();
});

// When you come back to the tab, pick up anything the other person changed.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || $('app-screen').hidden) return;
  if (Date.now() - state.loadedAt > 30_000 || todayISO() !== state.today) load({ quiet: true });
});

/* ───────────── Drawing the page ───────────── */

/** Tiny helper for building elements: h('p', { className: 'x' }, 'text', child) */
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  el.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function render() {
  renderQuickCard();
  renderHistory();
}

function renderQuickCard() {
  const { periodLength: predicted, periodStats } = state.analysis;
  $('quick-hint').textContent = periodStats
    ? `New entries end automatically after ${plural(predicted, 'day')}, your average period length.`
    : `New entries end automatically after ${plural(predicted, 'day')} until you've confirmed a few real end dates.`;
}

function renderHistory() {
  const list = $('history');
  const { periods, cycles } = state.analysis;
  if (periods.length === 0) {
    list.replaceChildren(
      h('li', { className: 'empty' }, h('strong', {}, 'Nothing logged yet'), 'Use “Log a period” to add your first one.')
    );
    return;
  }

  const cycleFrom = new Map(cycles.map((c) => [c.from.id, c]));
  const items = [...periods].reverse().map((period) => {
    const days = periodLength(period);
    const cycle = cycleFrom.get(period.id);
    const ongoing = period.start_date <= state.today && state.today <= period.end_date;

    const meta = [];
    if (ongoing) meta.push('Happening now');
    if (cycle) meta.push(`${cycle.length}-day cycle${cycle.counted ? '' : ' (too long to count)'}`);
    else if (!ongoing) meta.push('Most recent');

    return h(
      'li',
      {},
      h(
        'button',
        { type: 'button', className: 'history-item', onclick: () => openPeriodDialog({ period }) },
        h('span', { className: 'history-badge' }, String(days), h('small', {}, days === 1 ? 'day' : 'days')),
        h(
          'span',
          { className: 'history-text' },
          h('span', { className: 'history-dates' }, formatRange(period.start_date, period.end_date)),
          h(
            'span',
            { className: 'history-meta' },
            meta.join(' · '),
            period.end_confirmed ? null : [' ', h('span', { className: 'tag tag-peach' }, 'end not confirmed')]
          )
        ),
        h('span', { className: 'history-edit' }, 'Edit')
      )
    );
  });
  list.replaceChildren(...items);
}

/* ───────────── Log / edit dialog ───────────── */

const dialog = $('period-dialog');
const startInput = $('start-date');
const endInput = $('end-date');
const confirmedInput = $('end-confirmed');
const deleteButton = $('delete-period');
let editing = null; // the period being edited, or null when logging a new one
let endTouched = false;

function autoEnd(start) {
  return autoEndDate(start, state.periods, state.analysis.periodLength, editing?.id);
}

function openPeriodDialog({ period = null, start = state.today } = {}) {
  editing = period;
  endTouched = false;
  $('period-form-title').textContent = period ? 'Edit period' : 'Log a period';
  $('save-period').textContent = period ? 'Save changes' : 'Log period';
  deleteButton.hidden = !period;
  deleteButton.textContent = 'Delete';
  delete deleteButton.dataset.armed;

  startInput.max = state.today;
  startInput.value = period ? period.start_date : start;
  endInput.value = period ? period.end_date : autoEnd(start);
  endInput.min = startInput.value;
  confirmedInput.checked = period ? period.end_confirmed : false;
  updateEndHint();
  showFormError(null);

  dialog.showModal();
  $('save-period').focus();
}

function updateEndHint() {
  $('end-hint').textContent = confirmedInput.checked
    ? 'This end date counts towards your average period length.'
    : `Filled in from your average period length (${plural(state.analysis.periodLength, 'day')}). ` +
      'It stays unconfirmed until one of you confirms or changes it.';
}

function showFormError(message) {
  $('period-error').textContent = message || '';
  $('period-error').hidden = !message;
}

startInput.addEventListener('input', () => {
  if (!isISODate(startInput.value)) return;
  endInput.min = startInput.value;
  // Keep an automatic end date in step with the start date.
  if (!endTouched && !confirmedInput.checked) endInput.value = autoEnd(startInput.value);
});

endInput.addEventListener('input', () => {
  endTouched = true;
  confirmedInput.checked = true;
  updateEndHint();
});

confirmedInput.addEventListener('change', updateEndHint);

$('cancel-period').addEventListener('click', () => dialog.close());

// Clicking the dimmed area around the dialog closes it.
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

function checkPeriod(period) {
  if (!isISODate(period.start_date)) return 'Please pick the date it started.';
  if (!isISODate(period.end_date)) return 'Please pick the date it ended.';
  if (period.start_date > state.today) return "A period can't start in the future.";
  if (period.end_date < period.start_date) return "The end date can't be before the start date.";
  const clash = state.periods.find(
    (p) => p.id !== editing?.id && p.start_date <= period.end_date && period.start_date <= p.end_date
  );
  if (clash) return `That overlaps with the period from ${formatRange(clash.start_date, clash.end_date)}.`;
  return null;
}

$('period-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const period = {
    start_date: startInput.value,
    end_date: endInput.value,
    end_confirmed: confirmedInput.checked,
  };
  const problem = checkPeriod(period);
  if (problem) return showFormError(problem);

  const button = $('save-period');
  button.disabled = true;
  try {
    if (editing) {
      await api(`/api/periods?id=${encodeURIComponent(editing.id)}`, { method: 'PATCH', body: period });
    } else {
      await api('/api/periods', { method: 'POST', body: period });
    }
    dialog.close();
    toast(editing ? 'Saved ✨' : `Period logged from ${formatDate(period.start_date)} 🌸`);
    await load({ quiet: true });
  } catch (err) {
    showFormError(err.message);
  } finally {
    button.disabled = false;
  }
});

deleteButton.addEventListener('click', async () => {
  // First click asks "are you sure?", second click deletes.
  if (!deleteButton.dataset.armed) {
    deleteButton.dataset.armed = 'yes';
    deleteButton.textContent = 'Really delete?';
    return;
  }
  deleteButton.disabled = true;
  try {
    await api(`/api/periods?id=${encodeURIComponent(editing.id)}`, { method: 'DELETE' });
    dialog.close();
    toast('Deleted');
    await load({ quiet: true });
  } catch (err) {
    showFormError(err.message);
  } finally {
    deleteButton.disabled = false;
  }
});

$('log-today').addEventListener('click', () => openPeriodDialog());

/* ───────────── Little pop-up messages ───────────── */

let toastTimer;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

load();
