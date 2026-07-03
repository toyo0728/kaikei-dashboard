// calc.js — 集計ロジック（DR-02: 集計値・判定値は保存せず都度算出する）
'use strict';

const Calc = {
  // ---- 請求・入金（用語定義: 未入金 = ステータスが「入金済み」以外） ----

  isUnpaid(inv) { return inv.status !== '入金済み'; },

  // 売上（請求ベース）: 請求段階に達した請求のみ計上（未請求は含めない）
  isBilled(inv) { return inv.status !== '未請求'; },

  unpaidInvoices(s) { return s.invoices.filter(Calc.isUnpaid); },

  unpaidTotal(s) {
    return Calc.unpaidInvoices(s).reduce((a, i) => a + (i.billedAmount || 0), 0);
  },

  // FR-105: 今月入金予定（入金予定日が当月かつ未入金）
  dueThisMonth(s) {
    const ym = U.thisYM();
    return Calc.unpaidInvoices(s).filter(i => U.ym(i.dueDate) === ym);
  },

  // FR-106: 遅延（入金予定日 < 当日 かつ 未入金）— 都度算出
  overdueInvoices(s) {
    const today = U.today();
    return Calc.unpaidInvoices(s).filter(i => i.dueDate && i.dueDate < today);
  },

  sum(list, f) { return list.reduce((a, x) => a + (f(x) || 0), 0); },

  // ---- 売上・経費・利益 ----

  salesInMonth(s, ym) {
    return Calc.sum(
      s.invoices.filter(i => Calc.isBilled(i) && U.ym(i.invoiceDate) === ym),
      i => i.billedAmount);
  },

  salesInYear(s, year) {
    return Calc.sum(
      s.invoices.filter(i => Calc.isBilled(i) && i.invoiceDate && i.invoiceDate.startsWith(year + '-')),
      i => i.billedAmount);
  },

  fixedMonthly(s) { return Calc.sum(s.fixedCosts, c => c.amount); },
  subsMonthly(s) { return Calc.sum(s.subscriptions, c => c.amount); },

  investmentsInMonth(s, ym) {
    return Calc.sum(s.investments.filter(i => U.ym(i.date) === ym), i => i.amount);
  },

  investmentsInYear(s, year) {
    return Calc.sum(s.investments.filter(i => i.date && i.date.startsWith(year + '-')), i => i.amount);
  },

  // 支出＝固定費＋サブスク＋経費（自己投資）
  expensesInMonth(s, ym) {
    return Calc.fixedMonthly(s) + Calc.subsMonthly(s) + Calc.investmentsInMonth(s, ym);
  },

  profitInMonth(s, ym) { return Calc.salesInMonth(s, ym) - Calc.expensesInMonth(s, ym); },

  // 年間利益（実績）: 今年の売上 −（固定費＋サブスク）×経過月数 − 今年の自己投資
  profitInYear(s, year) {
    const now = new Date();
    const elapsed = (String(now.getFullYear()) === String(year)) ? now.getMonth() + 1 : 12;
    return Calc.salesInYear(s, year)
      - (Calc.fixedMonthly(s) + Calc.subsMonthly(s)) * elapsed
      - Calc.investmentsInYear(s, year);
  },

  elapsedMonths() { return new Date().getMonth() + 1; },

  // ---- キャッシュフロー（入金ベース） ----

  paidInMonth(s, ym) {
    return Calc.sum(
      s.invoices.filter(i => i.status === '入金済み' && U.ym(i.paidDate) === ym),
      i => i.paidAmount);
  },

  // 来月の入金予定（入金予定日が来月かつ未入金）
  expectedNextMonth(s) {
    const next = U.shiftYM(U.thisYM(), 1);
    return Calc.sum(
      Calc.unpaidInvoices(s).filter(i => U.ym(i.dueDate) === next),
      i => i.billedAmount);
  },

  // FR-301: 予測残高＝現在残高＋来月入金予定−来月固定費予定
  cashflowSummary(s) {
    const ym = U.thisYM();
    const balance = s.cashflow.balance || 0;
    const nextFixed = Calc.fixedMonthly(s) + Calc.subsMonthly(s);
    const nextIncome = Calc.expectedNextMonth(s);
    return {
      balance,
      balanceDate: s.cashflow.balanceDate,
      incomeThisMonth: Calc.paidInMonth(s, ym),
      expenseThisMonth: Calc.expensesInMonth(s, ym),
      nextFixed,
      nextIncome,
      forecast: balance + nextIncome - nextFixed,
    };
  },

  // FR-302: 過去 n ヶ月の月次収支（収入=入金ベース / 支出 / 残高は現在残高から遡って推定）
  monthlySeries(s, n = 12) {
    const cur = U.thisYM();
    const months = [];
    for (let i = n - 1; i >= 0; i--) months.push(U.shiftYM(cur, -i));
    const rows = months.map(ym => ({
      ym,
      income: Calc.paidInMonth(s, ym),
      expense: Calc.expensesInMonth(s, ym),
    }));
    let bal = s.cashflow.balance || 0;
    for (let i = rows.length - 1; i >= 0; i--) {
      rows[i].balance = bal;
      bal = bal - rows[i].income + rows[i].expense; // 前月末残高を逆算
    }
    return rows;
  },

  // ---- 案件ランキング ----

  projectRanking(s, limit = 5) {
    return [...s.projects]
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .slice(0, limit);
  },

  // 利益率＝（契約金額−案件経費）÷ 契約金額
  profitRateRanking(s, limit = 5) {
    return s.projects
      .filter(p => (p.amount || 0) > 0)
      .map(p => ({ ...p, rate: (p.amount - (p.cost || 0)) / p.amount }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, limit);
  },

  projectName(s, projectId) {
    const p = s.projects.find(p => p.id === projectId);
    return p ? p.name : '（案件なし）';
  },
};
