// store.js — localStorage への永続化と既定値（FR-403 / DR-03）
'use strict';

const STORE_KEY = 'kaikei-dashboard-v1';

// FR-401 表示カード候補（NFR-02: 新カードは CARDS レジストリへの追加で完結。ここは既定の並びのみ）
const DEFAULT_CARD_ORDER = [
  'monthSales', 'monthProfit', 'yearProfit', 'unpaid',
  'cashflow', 'taxReserve', 'salesGoal', 'projectRanking',
  'profitRateRanking', 'fixedCosts', 'subscriptions', 'investment',
];

function defaultState() {
  return {
    projects: [],        // {id, name, client, amount, cost, status, startDate, memo}
    invoices: [],        // DR-03 invoices: projects と N:1
    fixedCosts: [],      // {id, name, amount, payDay}
    subscriptions: [],   // {id, name, amount, payDay}
    investments: [],     // {id, name, amount, date, category}
    taxSettings: {       // DR-03 tax_settings（単一レコード）/ FR-205 可変パラメータ
      basicDeduction: 480000,      // 基礎控除
      blueDeduction: 650000,       // 青色申告特別控除
      residentRate: 10,            // 住民税率 %
      bizTaxRate: 5,               // 個人事業税率 %
      bizTaxDeduction: 2900000,    // 事業主控除
      nhiRate: 12,                 // 国民健康保険 概算料率 %
      nhiDeduction: 430000,        // 国保 基礎控除
      nhiCap: 1090000,             // 国保 上限額
      reconstructionTax: true,     // 復興特別所得税 2.1%
      consumptionEnabled: false,   // FR-201: 消費税は有効時のみ
      consumptionRate: 2,          // 売上に対する % （2割特例相当の概算）
      annualize: true,             // 実績利益を年換算して試算
      divideBy12: false,           // FR-202: false=残り月数で割る / true=12で割る
      brackets: [                  // 所得税 速算表（編集可能）
        { min: 0,        rate: 5,  ded: 0 },
        { min: 1950000,  rate: 10, ded: 97500 },
        { min: 3300000,  rate: 20, ded: 427500 },
        { min: 6950000,  rate: 23, ded: 636000 },
        { min: 9000000,  rate: 33, ded: 1536000 },
        { min: 18000000, rate: 40, ded: 2796000 },
        { min: 40000000, rate: 45, ded: 4796000 },
      ],
    },
    cashflow: { balance: 0, balanceDate: null }, // 現在の口座残高（手入力）
    goals: { yearlySales: 0 },                   // 売上目標（年間）
    dashboardCards: DEFAULT_CARD_ORDER.map(key => ({ key, visible: true })), // DR-03 dashboard_cards
  };
}

const Store = {
  state: null,

  load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (_) { /* 破損時は既定値 */ }
    const def = defaultState();
    if (!saved || typeof saved !== 'object') {
      Store.state = def;
      return;
    }
    // 既定値とマージ（バージョンアップで項目が増えても壊れないように）
    Store.state = Object.assign(def, saved);
    Store.state.taxSettings = Object.assign(def.taxSettings, saved.taxSettings || {});
    Store.state.cashflow = Object.assign(def.cashflow, saved.cashflow || {});
    Store.state.goals = Object.assign(def.goals, saved.goals || {});
    // カード候補の増減を吸収
    const savedCards = Array.isArray(saved.dashboardCards) ? saved.dashboardCards : [];
    const known = savedCards.filter(c => DEFAULT_CARD_ORDER.includes(c.key));
    const missing = DEFAULT_CARD_ORDER.filter(k => !known.some(c => c.key === k))
      .map(key => ({ key, visible: true }));
    Store.state.dashboardCards = [...known, ...missing];
  },

  save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(Store.state));
  },

  exportJSON() {
    return JSON.stringify(Store.state, null, 2);
  },

  importJSON(text) {
    const data = JSON.parse(text); // 不正なら例外
    // このアプリのバックアップ以外を誤って読み込むとデータが既定値で上書きされるため弾く
    if (!data || typeof data !== 'object' || Array.isArray(data) ||
        !Array.isArray(data.projects) || !Array.isArray(data.invoices)) {
      throw new Error('not a kaikei backup');
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    Store.load();
  },

  wipe() {
    localStorage.removeItem(STORE_KEY);
    Store.load();
  },

  // 動作確認用サンプルデータ
  seedSample() {
    const s = defaultState();
    const ym = U.thisYM();
    const m = n => U.shiftYM(ym, n); // n ヶ月前後
    const P = (name, client, amount, cost, status, startDate) =>
      ({ id: U.uid(), name, client, amount, cost, status, startDate, memo: '' });
    const p1 = P('コーポレートサイト制作', '株式会社アルファ', 480000, 60000, '完了', `${m(-4)}-01`);
    const p2 = P('LPコーディング一式', 'ベータデザイン', 180000, 0, '完了', `${m(-2)}-10`);
    const p3 = P('ECサイト改修', 'ガンマ商事', 350000, 40000, '進行中', `${m(-1)}-05`);
    const p4 = P('WordPressテーマ開発', 'デルタ企画', 300000, 20000, '進行中', `${ym}-01`);
    const p5 = P('保守契約（月額）', '株式会社アルファ', 30000, 0, '進行中', `${m(-5)}-01`);
    s.projects = [p1, p2, p3, p4, p5];
    const I = (p, status, invoiceDate, dueDate, paidDate, billed, paid, num, memo = '') =>
      ({ id: U.uid(), projectId: p.id, status, invoiceDate, dueDate, paidDate,
         billedAmount: billed, paidAmount: paid, invoiceNumber: num, memo });
    s.invoices = [
      I(p1, '入金済み', `${m(-3)}-28`, `${m(-2)}-28`, `${m(-2)}-25`, 480000, 480000, 'INV-001'),
      I(p2, '入金済み', `${m(-2)}-28`, `${m(-1)}-28`, `${m(-1)}-28`, 180000, 180000, 'INV-002'),
      I(p5, '入金済み', `${m(-1)}-25`, `${ym}-10`, `${ym}-08`, 30000, 30000, 'INV-003'),
      I(p3, '入金待ち', `${m(-1)}-28`, `${m(-1)}-28`, null, 350000, null, 'INV-004', '着手金'),
      I(p5, '請求済み', `${m(-1)}-25`, `${ym}-25`, null, 30000, null, 'INV-005'),
      I(p4, '未請求', null, `${m(1)}-28`, null, 300000, null, ''),
    ];
    const C = (name, amount, payDay) => ({ id: U.uid(), name, amount, payDay });
    s.fixedCosts = [
      C('コワーキングスペース', 22000, 27), C('通信費（光回線＋スマホ）', 9800, 25),
      C('国民年金', 16980, 30), C('会計ソフト等 事務費', 3000, 27),
    ];
    s.subscriptions = [
      C('Adobe CC', 6480, 5), C('GitHub Copilot', 1500, 12),
      C('ChatGPT Plus', 3000, 15), C('レンタルサーバー', 1100, 1),
    ];
    s.investments = [
      { id: U.uid(), name: 'Reactの技術書2冊', amount: 7400, date: `${m(-2)}-14`, category: '書籍' },
      { id: U.uid(), name: 'Udemy講座（Next.js）', amount: 12800, date: `${m(-1)}-03`, category: '講座' },
      { id: U.uid(), name: '外部ディスプレイ', amount: 42000, date: `${ym}-02`, category: '機材' },
    ];
    s.cashflow = { balance: 1250000, balanceDate: U.today() };
    s.goals = { yearlySales: 6000000 };
    s.dashboardCards = Store.state.dashboardCards; // カード設定は維持
    Store.state = s;
    Store.save();
  },
};
