// cards.js — ダッシュボードカードのレジストリ（NFR-02: 新カードはここへ1件追加するだけ）
// 各カードは { title, render(state) → HTML文字列 } を持つ。表示/非表示・並び順は store 側で管理。
'use strict';

function statCard(label, value, sub = '', tone = '') {
  return `
    <div class="stat ${tone}">
      <div class="stat-label">${U.esc(label)}</div>
      <div class="stat-value">${value}</div>
      ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
    </div>`;
}

function rankList(rows) {
  if (!rows.length) return '<p class="empty">データがありません</p>';
  return `<ol class="rank">${rows.map(r => `
    <li><span class="rank-name">${U.esc(r.name)}</span><span class="rank-val">${r.value}</span></li>
  `).join('')}</ol>`;
}

const CARDS = {
  monthSales: {
    title: '今月売上',
    render(s) {
      const ym = U.thisYM();
      return statCard('今月売上（請求ベース）', U.yen(Calc.salesInMonth(s, ym)), U.ymLabel(ym));
    },
  },

  monthProfit: {
    title: '今月利益',
    render(s) {
      const ym = U.thisYM();
      const p = Calc.profitInMonth(s, ym);
      return statCard('今月利益', U.yen(p),
        `売上 ${U.yen(Calc.salesInMonth(s, ym))} − 支出 ${U.yen(Calc.expensesInMonth(s, ym))}`,
        p < 0 ? 'neg' : '');
    },
  },

  yearProfit: {
    title: '年間利益',
    render(s) {
      const year = String(new Date().getFullYear());
      const p = Calc.profitInYear(s, year);
      return statCard(`年間利益（${year}年 実績）`, U.yen(p),
        `売上 ${U.yen(Calc.salesInYear(s, year))}（経過 ${Calc.elapsedMonths()}ヶ月）`,
        p < 0 ? 'neg' : '');
    },
  },

  unpaid: {
    title: '未入金',
    render(s) {
      const overdue = Calc.overdueInvoices(s);
      const due = Calc.dueThisMonth(s);
      return `
        ${statCard('未入金総額', U.yen(Calc.unpaidTotal(s)),
          `今月入金予定 ${U.yen(Calc.sum(due, i => i.billedAmount))}（${due.length}件）`)}
        ${overdue.length ? `<div class="badge-danger">⚠ 入金遅延 ${overdue.length}件 / ${U.yen(Calc.sum(overdue, i => i.billedAmount))}</div>` : ''}
      `;
    },
  },

  cashflow: {
    title: 'キャッシュフロー',
    render(s) {
      const c = Calc.cashflowSummary(s);
      return `
        ${statCard('予測残高（来月）', U.yen(c.forecast),
          `現在残高 ${U.yen(c.balance)} ＋ 来月入金予定 ${U.yen(c.nextIncome)} − 来月固定費予定 ${U.yen(c.nextFixed)}`,
          c.forecast < 0 ? 'neg' : '')}
      `;
    },
  },

  taxReserve: {
    title: '税金積立',
    render(s) {
      const e = Tax.estimate(s);
      return `
        ${statCard('毎月の推奨積立額', U.yen(e.monthly),
          `推定納税額 ${U.yen(e.total)} ÷ ${e.remaining}ヶ月`)}
        <p class="disclaimer">${TAX_DISCLAIMER}</p>
      `;
    },
  },

  salesGoal: {
    title: '売上目標',
    render(s) {
      const goal = s.goals.yearlySales || 0;
      const year = String(new Date().getFullYear());
      const sales = Calc.salesInYear(s, year);
      if (!goal) return '<p class="empty">設定画面で年間売上目標を入力してください</p>';
      const pct = Math.min(100, Math.round(sales / goal * 100));
      return `
        ${statCard('売上目標の達成率', `${pct}%`, `${U.yen(sales)} / ${U.yen(goal)}`)}
        <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
      `;
    },
  },

  projectRanking: {
    title: '案件ランキング',
    render(s) {
      return rankList(Calc.projectRanking(s).map(p =>
        ({ name: p.name, value: U.yen(p.amount) })));
    },
  },

  profitRateRanking: {
    title: '利益率ランキング',
    render(s) {
      return rankList(Calc.profitRateRanking(s).map(p =>
        ({ name: p.name, value: Math.round(p.rate * 100) + '%' })));
    },
  },

  fixedCosts: {
    title: '固定費',
    render(s) {
      return statCard('固定費（月額）', U.yen(Calc.fixedMonthly(s)), `${s.fixedCosts.length}件`);
    },
  },

  subscriptions: {
    title: 'サブスク',
    render(s) {
      return statCard('サブスク（月額）', U.yen(Calc.subsMonthly(s)), `${s.subscriptions.length}件`);
    },
  },

  investment: {
    title: '自己投資額',
    render(s) {
      const year = String(new Date().getFullYear());
      return statCard('自己投資額', U.yen(Calc.investmentsInYear(s, year)),
        `${year}年累計 / 今月 ${U.yen(Calc.investmentsInMonth(s, U.thisYM()))}`);
    },
  },
};
