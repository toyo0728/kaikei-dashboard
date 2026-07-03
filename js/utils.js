// utils.js — 共通ユーティリティ（整形・日付・ID）
'use strict';

const U = {
  uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  },

  // DR-01: 金額は円単位の整数で保持し、表示時のみ3桁区切り
  yen(n) {
    const v = Math.round(Number(n) || 0);
    return '¥' + v.toLocaleString('ja-JP');
  },

  int(v) {
    const n = parseInt(String(v).replace(/[,¥\s]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  },

  pad(n) { return String(n).padStart(2, '0'); },

  toISO(d) {
    return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())}`;
  },

  today() { return U.toISO(new Date()); },

  // 'YYYY-MM-DD' → 'YYYY-MM'（不正値は null）
  ym(dateStr) {
    if (!dateStr || !/^\d{4}-\d{2}/.test(dateStr)) return null;
    return dateStr.slice(0, 7);
  },

  thisYM() { return U.today().slice(0, 7); },

  // n ヶ月ずらした 'YYYY-MM'
  shiftYM(ym, n) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`;
  },

  ymLabel(ym) {
    const [y, m] = ym.split('-');
    return `${y}年${Number(m)}月`;
  },

  ymShort(ym) { return `${Number(ym.split('-')[1])}月`; },

  dateLabel(dateStr) {
    if (!dateStr) return '―';
    const [y, m, d] = dateStr.split('-');
    return `${y}/${Number(m)}/${Number(d)}`;
  },

  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  },

  el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  },
};
