// views.js — 各タブの画面描画とフォーム
'use strict';

// ---------- フォーム部品 ----------

const F = {
  text: (name, label, value = '', attrs = '') =>
    `<label class="fld"><span>${label}</span><input name="${name}" value="${U.esc(value)}" ${attrs}></label>`,
  num: (name, label, value = '', attrs = '') =>
    `<label class="fld"><span>${label}</span><input type="number" step="1" name="${name}" value="${U.esc(value)}" ${attrs}></label>`,
  date: (name, label, value = '') =>
    `<label class="fld"><span>${label}</span><input type="date" name="${name}" value="${U.esc(value || '')}"></label>`,
  select: (name, label, options, value) =>
    `<label class="fld"><span>${label}</span><select name="${name}">${options.map(o =>
      `<option value="${U.esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${U.esc(o.label)}</option>`
    ).join('')}</select></label>`,
  check: (name, label, checked) =>
    `<label class="fld chk"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span>${label}</span></label>`,
};

function openDialog(title, bodyHTML, onSubmit) {
  const dlg = U.el(`
    <dialog class="form-dialog">
      <form method="dialog">
        <h3>${U.esc(title)}</h3>
        <div class="dlg-body">${bodyHTML}</div>
        <div class="dlg-actions">
          <button type="button" class="btn ghost" data-close>キャンセル</button>
          <button value="ok" class="btn primary">保存</button>
        </div>
      </form>
    </dialog>`);
  document.body.appendChild(dlg);
  const form = dlg.querySelector('form');
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close('cancel'));
  form.addEventListener('submit', () => {
    onSubmit(Object.fromEntries(new FormData(form).entries()), form);
  });
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
  return dlg;
}

// ---------- 共通ツールチップ（グラフ用） ----------

function bindTooltips(root) {
  let tip = document.getElementById('tooltip');
  if (!tip) {
    tip = U.el('<div id="tooltip" hidden></div>');
    document.body.appendChild(tip);
  }
  root.querySelectorAll('[data-tip]').forEach(elm => {
    elm.addEventListener('mouseenter', () => { tip.textContent = elm.dataset.tip; tip.hidden = false; });
    elm.addEventListener('mousemove', e => {
      tip.style.left = Math.min(e.clientX + 12, window.innerWidth - 180) + 'px';
      tip.style.top = (e.clientY + 14) + 'px';
    });
    elm.addEventListener('mouseleave', () => { tip.hidden = true; });
  });
}

// ---------- グラフ（FR-302）----------

function niceCeil(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const d = v / p;
  return (d <= 1 ? 1 : d <= 2 ? 2 : d <= 5 ? 5 : 10) * p;
}

function fmtAxis(v) {
  if (Math.abs(v) >= 100000000) return (v / 100000000) + '億';
  if (Math.abs(v) >= 10000) return Math.round(v / 10000) + '万';
  return String(v);
}

const CHART = { w: 720, h: 230, l: 48, r: 10, t: 12, b: 26 };

function chartFrame(yMin, yMax, inner) {
  const { w, h, l, r, t, b } = CHART;
  const plotH = h - t - b;
  const ticks = 4;
  let grid = '';
  for (let i = 0; i <= ticks; i++) {
    const v = yMin + (yMax - yMin) * i / ticks;
    const y = t + plotH - plotH * i / ticks;
    grid += `<line x1="${l}" x2="${w - r}" y1="${y}" y2="${y}" class="grid"></line>
             <text x="${l - 6}" y="${y + 4}" class="axis-label" text-anchor="end">${fmtAxis(v)}</text>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img">${grid}${inner}</svg>`;
}

// 収入・支出のグループ棒グラフ
function incomeExpenseChart(rows) {
  const { w, h, l, r, t, b } = CHART;
  const plotW = w - l - r, plotH = h - t - b;
  const yMax = niceCeil(Math.max(1, ...rows.map(d => Math.max(d.income, d.expense))));
  const groupW = plotW / rows.length;
  const barW = Math.min(16, groupW * 0.3);
  const y = v => t + plotH - (v / yMax) * plotH;
  let bars = '';
  rows.forEach((d, i) => {
    const cx = l + groupW * i + groupW / 2;
    const label = U.ymLabel(d.ym);
    bars += `
      <rect x="${cx - barW - 1}" y="${y(d.income)}" width="${barW}" height="${Math.max(0, t + plotH - y(d.income))}"
        rx="3" class="bar-income" data-tip="${label} 収入 ${U.yen(d.income)}"></rect>
      <rect x="${cx + 1}" y="${y(d.expense)}" width="${barW}" height="${Math.max(0, t + plotH - y(d.expense))}"
        rx="3" class="bar-expense" data-tip="${label} 支出 ${U.yen(d.expense)}"></rect>
      <text x="${cx}" y="${h - 8}" class="axis-label" text-anchor="middle">${U.ymShort(d.ym)}</text>`;
  });
  bars += `<line x1="${l}" x2="${w - r}" y1="${t + plotH}" y2="${t + plotH}" class="baseline"></line>`;
  return chartFrame(0, yMax, bars);
}

// 残高推移の折れ線グラフ
function balanceChart(rows) {
  const { w, h, l, r, t, b } = CHART;
  const plotW = w - l - r, plotH = h - t - b;
  const vals = rows.map(d => d.balance);
  const yMin = Math.min(0, ...vals);
  const yMax = niceCeil(Math.max(1, ...vals));
  const x = i => l + plotW * (rows.length === 1 ? 0.5 : i / (rows.length - 1));
  const y = v => t + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const pts = rows.map((d, i) => `${x(i)},${y(d.balance)}`).join(' ');
  let inner = `<polyline points="${pts}" class="line-balance"></polyline>`;
  rows.forEach((d, i) => {
    inner += `
      <circle cx="${x(i)}" cy="${y(d.balance)}" r="3.5" class="dot-balance"></circle>
      <circle cx="${x(i)}" cy="${y(d.balance)}" r="11" class="hit"
        data-tip="${U.ymLabel(d.ym)} 残高 ${U.yen(d.balance)}"></circle>
      <text x="${x(i)}" y="${h - 8}" class="axis-label" text-anchor="middle">${U.ymShort(d.ym)}</text>`;
  });
  if (yMin < 0) inner += `<line x1="${l}" x2="${w - r}" y1="${y(0)}" y2="${y(0)}" class="baseline"></line>`;
  return chartFrame(yMin, yMax, inner);
}

// ---------- 画面ごとの部品 ----------

const INVOICE_STATUSES = ['未請求', '請求済み', '入金待ち', '入金済み'];

function statusBadge(inv) {
  const overdue = Calc.isUnpaid(inv) && inv.dueDate && inv.dueDate < U.today();
  const cls = { '未請求': 'st-draft', '請求済み': 'st-billed', '入金待ち': 'st-waiting', '入金済み': 'st-paid' }[inv.status];
  return `<span class="badge ${cls}">${inv.status}</span>` +
    (overdue ? ' <span class="badge st-overdue">⚠ 遅延</span>' : '');
}

function summaryStrip(s) {
  const overdue = Calc.overdueInvoices(s);
  const due = Calc.dueThisMonth(s);
  return `
    <div class="summary-strip">
      <div class="stat"><div class="stat-label">未入金総額</div><div class="stat-value">${U.yen(Calc.unpaidTotal(s))}</div></div>
      <div class="stat"><div class="stat-label">今月入金予定</div><div class="stat-value">${U.yen(Calc.sum(due, i => i.billedAmount))}</div><div class="stat-sub">${due.length}件</div></div>
      <div class="stat ${overdue.length ? 'danger' : ''}"><div class="stat-label">入金遅延</div><div class="stat-value">${overdue.length}件</div><div class="stat-sub">${U.yen(Calc.sum(overdue, i => i.billedAmount))}</div></div>
    </div>`;
}

// FR-106: 遅延の警告バー（ダッシュボード上部）
function overdueAlert(s) {
  const overdue = Calc.overdueInvoices(s);
  if (!overdue.length) return '';
  return `
    <div class="alert-overdue">
      <div class="alert-title">⚠ 入金遅延 ${overdue.length}件 / 合計 ${U.yen(Calc.sum(overdue, i => i.billedAmount))}</div>
      <ul>${overdue.map(i => `
        <li>
          <span>${U.esc(Calc.projectName(s, i.projectId))} ― ${U.yen(i.billedAmount)}（予定日 ${U.dateLabel(i.dueDate)}）</span>
          <button class="btn small" data-action="mark-paid" data-id="${i.id}">入金済みにする</button>
        </li>`).join('')}
      </ul>
    </div>`;
}

// FR-103: ワンクリックで入金済みにする（入金日=当日 / 入金金額=請求金額）
function markPaid(id) {
  const inv = Store.state.invoices.find(i => i.id === id);
  if (!inv) return;
  inv.status = '入金済み';
  inv.paidDate = U.today();
  inv.paidAmount = inv.billedAmount;
  App.save();
}

function invoiceDialog(inv) {
  const s = Store.state;
  const isNew = !inv;
  const v = inv || { projectId: s.projects[0]?.id || '', status: '未請求', billedAmount: s.projects[0]?.amount ?? '' };
  const projectOpts = s.projects.map(p => ({ value: p.id, label: `${p.name}（${U.yen(p.amount)}）` }));
  if (!projectOpts.length) { alert('先に「案件」タブで案件を登録してください。'); return; }
  const dlg = openDialog(isNew ? '請求を新規作成' : '請求を編集', `
    ${F.select('projectId', '案件', projectOpts, v.projectId)}
    ${F.select('status', 'ステータス', INVOICE_STATUSES.map(x => ({ value: x, label: x })), v.status)}
    <div class="fld-row">
      ${F.num('billedAmount', '請求金額（円）', v.billedAmount ?? '', 'required')}
      ${F.num('paidAmount', '入金金額（円）', v.paidAmount ?? '')}
    </div>
    <div class="fld-row">
      ${F.date('invoiceDate', '請求日', v.invoiceDate)}
      ${F.date('dueDate', '入金予定日', v.dueDate)}
      ${F.date('paidDate', '入金日', v.paidDate)}
    </div>
    ${F.text('invoiceNumber', '請求書番号', v.invoiceNumber || '')}
    ${F.text('memo', 'メモ', v.memo || '')}
  `, (d) => {
    const rec = {
      id: isNew ? U.uid() : inv.id,
      projectId: d.projectId,
      status: d.status,
      billedAmount: U.int(d.billedAmount),
      paidAmount: d.paidAmount === '' ? null : U.int(d.paidAmount),
      invoiceDate: d.invoiceDate || null,
      dueDate: d.dueDate || null,
      paidDate: d.paidDate || null,
      invoiceNumber: d.invoiceNumber.trim(),
      memo: d.memo.trim(),
    };
    if (isNew) Store.state.invoices.push(rec);
    else Object.assign(inv, rec);
    App.save();
  });
  // FR-104: 案件選択で請求金額を契約金額から自動補完（上書き可能）
  const sel = dlg.querySelector('select[name=projectId]');
  sel.addEventListener('change', () => {
    const p = s.projects.find(p => p.id === sel.value);
    if (p) dlg.querySelector('input[name=billedAmount]').value = p.amount;
  });
}

// 汎用の一覧テーブル
function table(headers, rowsHTML, emptyMsg) {
  if (!rowsHTML) return `<p class="empty">${emptyMsg}</p>`;
  return `<div class="table-wrap"><table>
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rowsHTML}</tbody></table></div>`;
}

function crudButtons(id) {
  return `<button class="btn small ghost" data-action="edit" data-id="${id}">編集</button>
          <button class="btn small ghost danger" data-action="del" data-id="${id}">削除</button>`;
}

// ---------- 各タブのビュー ----------

const Views = {

  // ==== ダッシュボード（FR-401〜403） ====
  dashboard(root, s) {
    const visibleCards = s.dashboardCards.filter(c => c.visible && CARDS[c.key]);
    root.innerHTML = `
      ${overdueAlert(s)}
      <div class="view-head">
        <h2>ダッシュボード</h2>
        <button class="btn ghost" data-action="toggle-customize">⚙ カスタマイズ</button>
      </div>
      <div class="customize-panel" id="customize" ${App.ui.customize ? '' : 'hidden'}>
        <p>表示するカードを選択（カードはドラッグ＆ドロップで並び替えできます）</p>
        <div class="customize-list">
          ${s.dashboardCards.map(c => `
            <label class="chk"><input type="checkbox" data-card="${c.key}" ${c.visible ? 'checked' : ''}>
            <span>${U.esc(CARDS[c.key]?.title || c.key)}</span></label>`).join('')}
        </div>
      </div>
      <div class="card-grid" id="card-grid">
        ${visibleCards.map(c => `
          <section class="card" draggable="true" data-key="${c.key}">
            <header class="card-head"><span class="drag-handle" title="ドラッグで並び替え">⠿</span>${U.esc(CARDS[c.key].title)}</header>
            <div class="card-body">${CARDS[c.key].render(s)}</div>
          </section>`).join('')}
      </div>
      ${visibleCards.length ? '' : '<p class="empty">表示中のカードがありません。「カスタマイズ」から選択してください。</p>'}
    `;

    root.querySelector('[data-action=toggle-customize]').addEventListener('click', () => {
      App.ui.customize = !App.ui.customize;
      App.rerender();
    });
    root.querySelectorAll('#customize input[data-card]').forEach(cb => {
      cb.addEventListener('change', () => {
        const c = s.dashboardCards.find(c => c.key === cb.dataset.card);
        if (c) { c.visible = cb.checked; App.save(); }
      });
    });
    root.querySelectorAll('[data-action=mark-paid]').forEach(btn =>
      btn.addEventListener('click', () => markPaid(btn.dataset.id)));

    // FR-402: ドラッグ＆ドロップで並び替え → FR-403: 並び順を保存
    const grid = root.querySelector('#card-grid');
    let dragged = null;
    grid.querySelectorAll('.card').forEach(card => {
      card.addEventListener('dragstart', () => { dragged = card; card.classList.add('dragging'); });
      card.addEventListener('dragover', e => {
        e.preventDefault();
        if (!dragged || dragged === card) return;
        const r = card.getBoundingClientRect();
        const before = (e.clientY - r.top) / r.height < 0.5;
        grid.insertBefore(dragged, before ? card : card.nextSibling);
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        const domOrder = [...grid.querySelectorAll('.card')].map(el => el.dataset.key);
        const hidden = s.dashboardCards.filter(c => !domOrder.includes(c.key));
        s.dashboardCards = [
          ...domOrder.map(key => s.dashboardCards.find(c => c.key === key)),
          ...hidden,
        ];
        App.save();
      });
    });
  },

  // ==== 入金管理（FR-101〜106） ====
  invoices(root, s) {
    const filter = App.ui.invoiceFilter || 'すべて';
    const today = U.today();
    let list = [...s.invoices].sort((a, b) => (b.invoiceDate || '9999') < (a.invoiceDate || '9999') ? -1 : 1);
    if (filter === '遅延') list = list.filter(i => Calc.isUnpaid(i) && i.dueDate && i.dueDate < today);
    else if (filter !== 'すべて') list = list.filter(i => i.status === filter);

    const chips = ['すべて', ...INVOICE_STATUSES, '遅延'];
    const rows = list.map(i => `
      <tr>
        <td>${U.esc(Calc.projectName(s, i.projectId))}</td>
        <td>${statusBadge(i)}</td>
        <td>${U.esc(i.invoiceNumber || '―')}</td>
        <td>${U.dateLabel(i.invoiceDate)}</td>
        <td>${U.dateLabel(i.dueDate)}</td>
        <td>${U.dateLabel(i.paidDate)}</td>
        <td class="num">${U.yen(i.billedAmount)}</td>
        <td class="num">${i.paidAmount == null ? '―' : U.yen(i.paidAmount)}</td>
        <td>${U.esc(i.memo || '')}</td>
        <td class="actions">
          ${i.status !== '入金済み' ? `<button class="btn small primary" data-action="mark-paid" data-id="${i.id}">入金済みにする</button>` : ''}
          ${crudButtons(i.id)}
        </td>
      </tr>`).join('');

    root.innerHTML = `
      <div class="view-head"><h2>入金管理</h2>
        <button class="btn primary" data-action="add">＋ 請求を作成</button></div>
      ${summaryStrip(s)}
      <div class="chips">${chips.map(c =>
        `<button class="chip ${c === filter ? 'on' : ''}" data-filter="${c}">${c}</button>`).join('')}</div>
      ${table(['案件', 'ステータス', '請求書番号', '請求日', '入金予定日', '入金日', '請求金額', '入金金額', 'メモ', '操作'],
        rows, '請求がありません。「＋ 請求を作成」から登録してください。')}
    `;

    root.querySelector('[data-action=add]').addEventListener('click', () => invoiceDialog(null));
    root.querySelectorAll('.chip').forEach(ch => ch.addEventListener('click', () => {
      App.ui.invoiceFilter = ch.dataset.filter; App.rerender();
    }));
    root.querySelectorAll('[data-action=mark-paid]').forEach(b =>
      b.addEventListener('click', () => markPaid(b.dataset.id)));
    root.querySelectorAll('[data-action=edit]').forEach(b =>
      b.addEventListener('click', () => invoiceDialog(s.invoices.find(i => i.id === b.dataset.id))));
    root.querySelectorAll('[data-action=del]').forEach(b =>
      b.addEventListener('click', () => {
        if (!confirm('この請求を削除しますか？')) return;
        s.invoices = s.invoices.filter(i => i.id !== b.dataset.id);
        App.save();
      }));
  },

  // ==== 案件管理 ====
  projects(root, s) {
    const rows = s.projects.map(p => `
      <tr>
        <td>${U.esc(p.name)}</td>
        <td>${U.esc(p.client || '')}</td>
        <td>${U.esc(p.status)}</td>
        <td class="num">${U.yen(p.amount)}</td>
        <td class="num">${U.yen(p.cost || 0)}</td>
        <td class="num">${p.amount ? Math.round((p.amount - (p.cost || 0)) / p.amount * 100) + '%' : '―'}</td>
        <td>${U.dateLabel(p.startDate)}</td>
        <td>${U.esc(p.memo || '')}</td>
        <td class="actions">${crudButtons(p.id)}</td>
      </tr>`).join('');

    root.innerHTML = `
      <div class="view-head"><h2>案件管理</h2>
        <button class="btn primary" data-action="add">＋ 案件を追加</button></div>
      ${table(['案件名', 'クライアント', 'ステータス', '契約金額', '案件経費', '利益率', '開始日', 'メモ', '操作'],
        rows, '案件がありません。')}
    `;

    const dialog = (p) => {
      const isNew = !p;
      const v = p || { status: '進行中' };
      openDialog(isNew ? '案件を追加' : '案件を編集', `
        ${F.text('name', '案件名', v.name || '', 'required')}
        ${F.text('client', 'クライアント', v.client || '')}
        <div class="fld-row">
          ${F.num('amount', '契約金額（円）', v.amount ?? '', 'required')}
          ${F.num('cost', '案件経費・外注費（円）', v.cost ?? 0)}
        </div>
        <div class="fld-row">
          ${F.select('status', 'ステータス', ['見込み', '進行中', '完了'].map(x => ({ value: x, label: x })), v.status)}
          ${F.date('startDate', '開始日', v.startDate)}
        </div>
        ${F.text('memo', 'メモ', v.memo || '')}
      `, d => {
        const rec = {
          id: isNew ? U.uid() : p.id,
          name: d.name.trim(), client: d.client.trim(), status: d.status,
          amount: U.int(d.amount), cost: U.int(d.cost),
          startDate: d.startDate || null, memo: d.memo.trim(),
        };
        if (isNew) s.projects.push(rec); else Object.assign(p, rec);
        App.save();
      });
    };

    root.querySelector('[data-action=add]').addEventListener('click', () => dialog(null));
    root.querySelectorAll('[data-action=edit]').forEach(b =>
      b.addEventListener('click', () => dialog(s.projects.find(p => p.id === b.dataset.id))));
    root.querySelectorAll('[data-action=del]').forEach(b =>
      b.addEventListener('click', () => {
        const related = s.invoices.filter(i => i.projectId === b.dataset.id).length;
        if (!confirm(`この案件を削除しますか？${related ? `\n紐づく請求 ${related}件 も削除されます。` : ''}`)) return;
        s.projects = s.projects.filter(p => p.id !== b.dataset.id);
        s.invoices = s.invoices.filter(i => i.projectId !== b.dataset.id);
        App.save();
      }));
  },

  // ==== 固定費・サブスク ====
  costs(root, s) {
    const section = (title, listKey, items) => {
      const rows = items.map(c => `
        <tr>
          <td>${U.esc(c.name)}</td>
          <td class="num">${U.yen(c.amount)}</td>
          <td>${c.payDay ? `毎月${c.payDay}日` : '―'}</td>
          <td class="actions">${crudButtons(c.id).replaceAll('data-id', `data-list="${listKey}" data-id`)}</td>
        </tr>`).join('');
      return `
        <div class="view-head sub"><h3>${title}（月額合計 ${U.yen(Calc.sum(items, c => c.amount))}）</h3>
          <button class="btn primary" data-action="add" data-list="${listKey}">＋ 追加</button></div>
        ${table(['名称', '月額', '支払日', '操作'], rows, `${title}がありません。`)}`;
    };

    root.innerHTML = `
      <div class="view-head"><h2>固定費・サブスク</h2></div>
      ${section('固定費', 'fixedCosts', s.fixedCosts)}
      ${section('サブスク', 'subscriptions', s.subscriptions)}
    `;

    const dialog = (listKey, item) => {
      const isNew = !item;
      const v = item || {};
      openDialog(isNew ? '追加' : '編集', `
        ${F.text('name', '名称', v.name || '', 'required')}
        ${F.num('amount', '月額（円）', v.amount ?? '', 'required')}
        ${F.num('payDay', '支払日（1〜31・任意）', v.payDay ?? '', 'min="1" max="31"')}
      `, d => {
        const rec = {
          id: isNew ? U.uid() : item.id,
          name: d.name.trim(), amount: U.int(d.amount),
          payDay: d.payDay ? U.int(d.payDay) : null,
        };
        if (isNew) s[listKey].push(rec); else Object.assign(item, rec);
        App.save();
      });
    };

    root.querySelectorAll('[data-action=add]').forEach(b =>
      b.addEventListener('click', () => dialog(b.dataset.list, null)));
    root.querySelectorAll('[data-action=edit]').forEach(b =>
      b.addEventListener('click', () => dialog(b.dataset.list, s[b.dataset.list].find(x => x.id === b.dataset.id))));
    root.querySelectorAll('[data-action=del]').forEach(b =>
      b.addEventListener('click', () => {
        if (!confirm('削除しますか？')) return;
        s[b.dataset.list] = s[b.dataset.list].filter(x => x.id !== b.dataset.id);
        App.save();
      }));
  },

  // ==== 自己投資 ====
  investments(root, s) {
    const year = String(new Date().getFullYear());
    const rows = [...s.investments].sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1).map(i => `
      <tr>
        <td>${U.dateLabel(i.date)}</td>
        <td>${U.esc(i.name)}</td>
        <td>${U.esc(i.category || '')}</td>
        <td class="num">${U.yen(i.amount)}</td>
        <td class="actions">${crudButtons(i.id)}</td>
      </tr>`).join('');

    root.innerHTML = `
      <div class="view-head"><h2>自己投資（${year}年 累計 ${U.yen(Calc.investmentsInYear(s, year))}）</h2>
        <button class="btn primary" data-action="add">＋ 追加</button></div>
      ${table(['日付', '内容', 'カテゴリ', '金額', '操作'], rows, '自己投資の記録がありません。')}
    `;

    const dialog = (item) => {
      const isNew = !item;
      const v = item || { date: U.today() };
      openDialog(isNew ? '自己投資を追加' : '編集', `
        ${F.text('name', '内容', v.name || '', 'required')}
        <div class="fld-row">
          ${F.num('amount', '金額（円）', v.amount ?? '', 'required')}
          ${F.date('date', '日付', v.date)}
        </div>
        ${F.select('category', 'カテゴリ', ['書籍', '講座', '機材', 'イベント', 'その他'].map(x => ({ value: x, label: x })), v.category || '書籍')}
      `, d => {
        const rec = {
          id: isNew ? U.uid() : item.id,
          name: d.name.trim(), amount: U.int(d.amount),
          date: d.date || U.today(), category: d.category,
        };
        if (isNew) s.investments.push(rec); else Object.assign(item, rec);
        App.save();
      });
    };

    root.querySelector('[data-action=add]').addEventListener('click', () => dialog(null));
    root.querySelectorAll('[data-action=edit]').forEach(b =>
      b.addEventListener('click', () => dialog(s.investments.find(x => x.id === b.dataset.id))));
    root.querySelectorAll('[data-action=del]').forEach(b =>
      b.addEventListener('click', () => {
        if (!confirm('削除しますか？')) return;
        s.investments = s.investments.filter(x => x.id !== b.dataset.id);
        App.save();
      }));
  },

  // ==== キャッシュフロー（FR-301 / FR-302） ====
  cashflow(root, s) {
    const c = Calc.cashflowSummary(s);
    const rows = Calc.monthlySeries(s, 12);
    root.innerHTML = `
      <div class="view-head"><h2>キャッシュフロー</h2></div>
      <div class="balance-edit">
        <label>現在の口座残高（円）
          <input type="number" step="1" id="balance-input" value="${c.balance}">
        </label>
        <button class="btn primary" id="balance-save">更新</button>
        <span class="stat-sub">${c.balanceDate ? `最終更新 ${U.dateLabel(c.balanceDate)}` : '未設定'}</span>
      </div>
      <div class="summary-strip wide">
        <div class="stat"><div class="stat-label">現在の口座残高</div><div class="stat-value">${U.yen(c.balance)}</div></div>
        <div class="stat"><div class="stat-label">今月の収入（入金ベース）</div><div class="stat-value">${U.yen(c.incomeThisMonth)}</div></div>
        <div class="stat"><div class="stat-label">今月の支出</div><div class="stat-value">${U.yen(c.expenseThisMonth)}</div></div>
        <div class="stat"><div class="stat-label">来月の入金予定</div><div class="stat-value">${U.yen(c.nextIncome)}</div></div>
        <div class="stat"><div class="stat-label">来月の固定費予定</div><div class="stat-value">${U.yen(c.nextFixed)}</div></div>
        <div class="stat ${c.forecast < 0 ? 'danger' : 'accent'}"><div class="stat-label">予測残高</div><div class="stat-value">${U.yen(c.forecast)}</div>
          <div class="stat-sub">現在残高＋来月入金予定−来月固定費予定</div></div>
      </div>

      <section class="panel">
        <h3>月次収支（過去12ヶ月）</h3>
        <div class="legend">
          <span><i class="sw sw-income"></i>収入（入金ベース）</span>
          <span><i class="sw sw-expense"></i>支出</span>
        </div>
        ${incomeExpenseChart(rows)}
      </section>

      <section class="panel">
        <h3>残高推移（現在残高からの推定）</h3>
        ${balanceChart(rows)}
      </section>

      <details class="panel">
        <summary>月次データ表</summary>
        ${table(['月', '収入', '支出', '収支', '残高（推定）'], rows.map(r => `
          <tr><td>${U.ymLabel(r.ym)}</td>
          <td class="num">${U.yen(r.income)}</td>
          <td class="num">${U.yen(r.expense)}</td>
          <td class="num ${r.income - r.expense < 0 ? 'neg' : ''}">${U.yen(r.income - r.expense)}</td>
          <td class="num">${U.yen(r.balance)}</td></tr>`).join(''), '')}
      </details>
    `;

    root.querySelector('#balance-save').addEventListener('click', () => {
      s.cashflow.balance = U.int(root.querySelector('#balance-input').value);
      s.cashflow.balanceDate = U.today();
      App.save();
    });
    bindTooltips(root);
  },

  // ==== 税金積立シミュレーター（FR-201〜204） ====
  tax(root, s) {
    const e = Tax.estimate(s);
    const row = (label, val, note = '') =>
      `<tr><td>${label}</td><td class="num">${U.yen(val)}</td><td class="stat-sub">${note}</td></tr>`;
    root.innerHTML = `
      <div class="view-head"><h2>税金積立シミュレーター</h2></div>
      <p class="disclaimer big">⚠ ${TAX_DISCLAIMER}</p>
      <div class="summary-strip">
        <div class="stat"><div class="stat-label">年間利益（${e.annualized ? '年換算見込み' : '実績'}）</div><div class="stat-value">${U.yen(e.profit)}</div>
          <div class="stat-sub">実績 ${U.yen(e.actualProfit)}（経過 ${Calc.elapsedMonths()}ヶ月）</div></div>
        <div class="stat"><div class="stat-label">推定納税額（年間）</div><div class="stat-value">${U.yen(e.total)}</div></div>
        <div class="stat accent"><div class="stat-label">毎月の推奨積立額</div><div class="stat-value">${U.yen(e.monthly)}</div>
          <div class="stat-sub">推定納税額 ÷ ${e.remaining}ヶ月</div></div>
      </div>
      <section class="panel">
        <h3>内訳（概算）</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>税目</th><th>概算額</th><th></th></tr></thead>
          <tbody>
            ${row('所得税', e.income, `課税所得 ${U.yen(e.taxable)}${s.taxSettings.reconstructionTax ? ' ・復興特別所得税 2.1% 含む' : ''}`)}
            ${row('住民税', e.resident, `${s.taxSettings.residentRate}%`)}
            ${row('個人事業税', e.bizTax, `（利益 − ${U.yen(s.taxSettings.bizTaxDeduction)}）× ${s.taxSettings.bizTaxRate}%`)}
            ${row('国民健康保険', e.nhi, `概算 ${s.taxSettings.nhiRate}% ・上限 ${U.yen(s.taxSettings.nhiCap)}`)}
            ${e.consumptionEnabled
              ? row('消費税', e.consumption, `売上 × ${s.taxSettings.consumptionRate}%`)
              : `<tr><td>消費税</td><td class="num">―</td><td class="stat-sub">設定で無効（免税事業者など）</td></tr>`}
            <tr class="total-row"><td>合計（推定納税額）</td><td class="num">${U.yen(e.total)}</td><td></td></tr>
          </tbody>
        </table></div>
        <p class="stat-sub">税率・控除・計算パラメータは「設定」タブから変更できます（変更は即時反映されます）。</p>
      </section>
    `;
  },

  // ==== 設定（FR-205 / FR-403 ほか） ====
  settings(root, s) {
    const t = s.taxSettings;
    root.innerHTML = `
      <div class="view-head"><h2>設定</h2></div>

      <section class="panel">
        <h3>売上目標</h3>
        <div class="fld-row">
          ${F.num('yearlySales', '年間売上目標（円）', s.goals.yearlySales || '')}
        </div>
        <button class="btn primary" id="save-goal">保存</button>
      </section>

      <section class="panel">
        <h3>税金の計算パラメータ（FR-205: 変更は試算に即時反映）</h3>
        <p class="disclaimer">${TAX_DISCLAIMER}</p>
        <form id="tax-form">
          <div class="fld-row">
            ${F.num('basicDeduction', '基礎控除（円）', t.basicDeduction)}
            ${F.num('blueDeduction', '青色申告特別控除（円）', t.blueDeduction)}
          </div>
          <div class="fld-row">
            ${F.num('residentRate', '住民税率（%）', t.residentRate)}
            ${F.num('bizTaxRate', '個人事業税率（%）', t.bizTaxRate)}
            ${F.num('bizTaxDeduction', '事業主控除（円）', t.bizTaxDeduction)}
          </div>
          <div class="fld-row">
            ${F.num('nhiRate', '国保 概算料率（%）', t.nhiRate)}
            ${F.num('nhiDeduction', '国保 基礎控除（円）', t.nhiDeduction)}
            ${F.num('nhiCap', '国保 上限額（円）', t.nhiCap)}
          </div>
          ${F.check('reconstructionTax', '復興特別所得税（2.1%）を含める', t.reconstructionTax)}
          ${F.check('consumptionEnabled', '消費税を計算に含める（課税事業者）', t.consumptionEnabled)}
          <div class="fld-row">${F.num('consumptionRate', '消費税 概算率（売上に対する%）', t.consumptionRate)}</div>
          ${F.check('annualize', '利益を年換算して試算する（経過月の実績 ÷ 経過月数 × 12）', t.annualize)}
          ${F.check('divideBy12', '積立推奨額を12ヶ月で割る（オフ: 年内の残り月数で割る）', t.divideBy12)}

          <h4>所得税 速算表</h4>
          <div class="table-wrap"><table id="brackets">
            <thead><tr><th>課税所得（下限・円）</th><th>税率（%）</th><th>控除額（円）</th><th></th></tr></thead>
            <tbody>
              ${t.brackets.map((b, i) => `
                <tr>
                  <td><input type="number" step="1" data-b="min" data-i="${i}" value="${b.min}"></td>
                  <td><input type="number" step="0.1" data-b="rate" data-i="${i}" value="${b.rate}"></td>
                  <td><input type="number" step="1" data-b="ded" data-i="${i}" value="${b.ded}"></td>
                  <td><button type="button" class="btn small ghost danger" data-del-bracket="${i}">削除</button></td>
                </tr>`).join('')}
            </tbody>
          </table></div>
          <button type="button" class="btn ghost small" id="add-bracket">＋ 行を追加</button>
          <div class="dlg-actions"><button type="submit" class="btn primary">税設定を保存</button></div>
        </form>
      </section>

      <section class="panel">
        <h3>データ管理</h3>
        <div class="btn-row">
          <button class="btn ghost" id="seed">サンプルデータを投入</button>
          <button class="btn ghost" id="export">エクスポート（JSON）</button>
          <label class="btn ghost" for="import-file">インポート（JSON）</label>
          <input type="file" id="import-file" accept=".json,application/json" hidden>
          <button class="btn ghost danger" id="wipe">全データを削除</button>
        </div>
        <p class="stat-sub">データはこのブラウザ内（localStorage）にのみ保存されます。単一ユーザー・個人利用前提です（NFR-05）。</p>
      </section>
    `;

    root.querySelector('#save-goal').addEventListener('click', () => {
      s.goals.yearlySales = U.int(root.querySelector('input[name=yearlySales]').value);
      App.save();
    });

    const form = root.querySelector('#tax-form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const g = n => form.querySelector(`[name=${n}]`);
      const num = n => U.int(g(n).value);
      Object.assign(t, {
        basicDeduction: num('basicDeduction'), blueDeduction: num('blueDeduction'),
        residentRate: parseFloat(g('residentRate').value) || 0,
        bizTaxRate: parseFloat(g('bizTaxRate').value) || 0,
        bizTaxDeduction: num('bizTaxDeduction'),
        nhiRate: parseFloat(g('nhiRate').value) || 0,
        nhiDeduction: num('nhiDeduction'), nhiCap: num('nhiCap'),
        reconstructionTax: g('reconstructionTax').checked,
        consumptionEnabled: g('consumptionEnabled').checked,
        consumptionRate: parseFloat(g('consumptionRate').value) || 0,
        annualize: g('annualize').checked,
        divideBy12: g('divideBy12').checked,
      });
      t.brackets = [...form.querySelectorAll('#brackets tbody tr')].map(tr => ({
        min: U.int(tr.querySelector('[data-b=min]').value),
        rate: parseFloat(tr.querySelector('[data-b=rate]').value) || 0,
        ded: U.int(tr.querySelector('[data-b=ded]').value),
      })).sort((a, b) => a.min - b.min);
      App.save();
      alert('税設定を保存しました。試算に反映されています。');
    });
    root.querySelector('#add-bracket').addEventListener('click', () => {
      t.brackets.push({ min: 0, rate: 0, ded: 0 });
      App.rerender();
    });
    root.querySelectorAll('[data-del-bracket]').forEach(b =>
      b.addEventListener('click', () => {
        t.brackets.splice(Number(b.dataset.delBracket), 1);
        App.rerender();
      }));

    root.querySelector('#seed').addEventListener('click', () => {
      if (!confirm('サンプルデータを投入します。現在のデータは上書きされます。よろしいですか？')) return;
      Store.seedSample();
      App.rerender();
    });
    root.querySelector('#export').addEventListener('click', () => {
      const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `kaikei-backup-${U.today()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
    root.querySelector('#import-file').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        Store.importJSON(await file.text());
        App.rerender();
        alert('インポートしました。');
      } catch (_) {
        alert('インポートに失敗しました。JSONファイルを確認してください。');
      }
    });
    root.querySelector('#wipe').addEventListener('click', () => {
      if (!confirm('すべてのデータを削除します。この操作は取り消せません。よろしいですか？')) return;
      Store.wipe();
      App.rerender();
    });
  },
};
