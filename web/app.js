import { renderLineChart } from './chart.js';

const $ = id => document.getElementById(id);

function fmt(n, type) {
  if (n == null) return '-';
  if (type === 'usd') return '$' + Number(n).toFixed(4);
  if (type === 'tokens') {
    if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
    return String(n);
  }
  if (type === 'dur') {
    const m = Math.round(n / 60);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`;
  }
  if (type === 'date') {
    const d = new Date(n * 1000);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  }
  return String(n);
}

async function api(path) {
  const r = await fetch(path);
  return r.json();
}

async function loadDashboard() {
  const period = $('period-select')?.value ?? 'sprint';
  const data = await api(`/api/summary?period=${period}`);
  const s = data.summary;
  $('stat-sessions').textContent = s.session_count ?? 0;
  $('stat-cost').textContent = fmt(s.cost_usd, 'usd');
  $('stat-tokens').textContent = fmt(s.tokens_input, 'tokens') + ' / ' + fmt(s.tokens_output, 'tokens');
  $('stat-commits').textContent = s.commit_count ?? 0;

  const now = Math.floor(Date.now()/1000);
  const from = period === 'day' ? now - 86400 : period === 'week' ? now - 7*86400 : now - 14*86400;
  const ts = await api(`/api/timeseries?metric=cost&bucket=day&from=${from}&to=${now}`);
  const svg = $('cost-chart');
  if (svg) renderLineChart(svg, ts);

  const tbody = $('branches-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    for (const b of data.topBranches) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${b.branch_name ?? '—'}</td><td>${b.session_count}</td><td>${fmt(b.cost_usd,'usd')}</td>`;
      tbody.appendChild(tr);
    }
  }
}

async function loadSessions() {
  const branch = $('branch-filter')?.value ?? '';
  const url = '/api/sessions?limit=50' + (branch ? '&branch=' + encodeURIComponent(branch) : '');
  const rows = await api(url);
  const tbody = $('sessions-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  for (const r of rows) {
    const tr = document.createElement('tr');
    const badge = r.exit_reason ? `<span class="badge ${r.exit_reason}">${r.exit_reason}</span>` : '-';
    tr.innerHTML = `<td>${String(r.session_id).slice(0,8)}</td><td>${fmt(r.started_at,'date')}</td><td>${fmt(r.duration_seconds,'dur')}</td><td>${fmt(r.tokens_input,'tokens')}</td><td>${fmt(r.cost_usd,'usd')}</td><td>${r.commit_count??0}</td><td>${badge}</td>`;
    tbody.appendChild(tr);
  }
}

function initNav() {
  document.querySelectorAll('nav a[data-view]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('nav a').forEach(x => x.classList.remove('active'));
      a.classList.add('active');
      document.querySelectorAll('[data-view-content]').forEach(el => {
        el.style.display = el.dataset.viewContent === a.dataset.view ? '' : 'none';
      });
      if (a.dataset.view === 'sessions') loadSessions();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  $('period-select')?.addEventListener('change', loadDashboard);
  $('branch-filter')?.addEventListener('input', loadSessions);
  loadDashboard();
});
