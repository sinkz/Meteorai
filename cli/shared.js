import { resolvePaths } from '../lib/paths.js';
import { openDb } from '../lib/db.js';
import { loadConfig } from '../lib/config.js';

export function dbHandle() {
  const paths = resolvePaths();
  const db = openDb(paths.db);
  const config = loadConfig(paths.config);
  return { db, paths, config };
}

export function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return Math.floor(d.getTime() / 1000);
}

export function fmtUsd(n) {
  return '$' + (n ?? 0).toFixed(2);
}

export function fmtTokens(n) {
  if (n == null) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

export function fmtDate(unix) {
  if (!unix) return '-';
  const d = new Date(unix * 1000);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}`;
}

export function fmtDuration(seconds) {
  if (!seconds) return '-';
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h${String(m % 60).padStart(2, '0')}`;
}
