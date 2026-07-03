// tax.js — 税金積立シミュレーター（FR-201〜FR-205）
// ここでの計算はすべて概算・参考値。正確な税額は確定申告で確定する（FR-204）。
'use strict';

const Tax = {
  // 所得税：速算表（taxSettings.brackets）で計算
  incomeTax(taxable, brackets) {
    if (taxable <= 0) return 0;
    const sorted = [...brackets].sort((a, b) => a.min - b.min);
    let hit = sorted[0];
    for (const b of sorted) if (taxable >= b.min) hit = b;
    return Math.max(0, Math.floor(taxable * hit.rate / 100 - hit.ded));
  },

  // FR-201: 年間利益を基に各税目の推定納税額を概算する
  estimate(s) {
    const t = s.taxSettings;
    const year = String(new Date().getFullYear());
    const actualProfit = Calc.profitInYear(s, year);
    const elapsed = Calc.elapsedMonths();

    // 年換算: 経過月の実績を12ヶ月に引き延ばして年間見込みとする
    const profit = t.annualize && elapsed > 0
      ? Math.round(actualProfit / elapsed * 12)
      : actualProfit;

    const taxable = Math.max(0, profit - t.blueDeduction - t.basicDeduction);

    let income = Tax.incomeTax(taxable, t.brackets);
    if (t.reconstructionTax) income = Math.floor(income * 1.021); // 復興特別所得税 2.1%

    const resident = Math.floor(taxable * t.residentRate / 100);
    const bizTax = Math.floor(Math.max(0, profit - t.bizTaxDeduction) * t.bizTaxRate / 100);
    const nhi = Math.min(t.nhiCap,
      Math.floor(Math.max(0, profit - t.nhiDeduction) * t.nhiRate / 100));

    let consumption = 0;
    if (t.consumptionEnabled) {
      const salesActual = Calc.salesInYear(s, year);
      const sales = t.annualize && elapsed > 0 ? Math.round(salesActual / elapsed * 12) : salesActual;
      consumption = Math.floor(sales * t.consumptionRate / 100);
    }

    const total = income + resident + bizTax + nhi + consumption;

    // FR-202: 推奨額＝推定納税額 ÷ 残り月数（または12）
    const remaining = t.divideBy12 ? 12 : Math.max(1, 12 - new Date().getMonth());
    const monthly = Math.ceil(total / remaining);

    return {
      actualProfit, profit, taxable, annualized: t.annualize,
      income, resident, bizTax, nhi, consumption,
      consumptionEnabled: t.consumptionEnabled,
      total, monthly, remaining,
    };
  },
};

// FR-204: 免責の注記（税金関連のカード・画面に常時表示する）
const TAX_DISCLAIMER =
  'この試算は概算・参考値です。正確な税額は確定申告で確定します。';
