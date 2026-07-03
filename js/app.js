// app.js — タブ切り替えと初期化
'use strict';

const TABS = [
  { key: 'dashboard',   label: 'ダッシュボード' },
  { key: 'invoices',    label: '入金管理' },
  { key: 'projects',    label: '案件' },
  { key: 'costs',       label: '固定費・サブスク' },
  { key: 'investments', label: '自己投資' },
  { key: 'cashflow',    label: 'キャッシュフロー' },
  { key: 'tax',         label: '税金積立' },
  { key: 'settings',    label: '設定' },
];

const App = {
  ui: { tab: 'dashboard', customize: false, invoiceFilter: 'すべて' },

  save() {
    Store.save();
    App.rerender();
  },

  rerender() {
    App.renderNav();
    const root = document.getElementById('view');
    Views[App.ui.tab](root, Store.state);
    window.scrollTo(0, window.scrollY); // 再描画で位置が飛ばないように
  },

  renderNav() {
    const nav = document.getElementById('nav');
    const overdue = Calc.overdueInvoices(Store.state).length;
    nav.innerHTML = TABS.map(t => `
      <button class="tab ${t.key === App.ui.tab ? 'on' : ''}" data-tab="${t.key}">
        ${t.label}${t.key === 'invoices' && overdue ? ` <span class="nav-badge">${overdue}</span>` : ''}
      </button>`).join('');
    nav.querySelectorAll('.tab').forEach(b =>
      b.addEventListener('click', () => {
        App.ui.tab = b.dataset.tab;
        history.replaceState(null, '', '#' + b.dataset.tab);
        App.rerender();
      }));
  },

  init() {
    Store.load();
    const hash = location.hash.slice(1);
    if (TABS.some(t => t.key === hash)) App.ui.tab = hash;
    App.rerender();
  },
};

document.addEventListener('DOMContentLoaded', App.init);
