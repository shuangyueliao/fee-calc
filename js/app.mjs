// ============================================================================
// app.mjs — 页面逻辑（DOM 渲染；计算全部委托给 js/calc.mjs 纯函数模块）
// 纯静态：无后端请求、无追踪。
// ============================================================================

import { PATHS, POLICY_STATUS, SCENARIOS, DATA_AS_OF } from './data.mjs';
import { compare, DEFAULT_INPUT, usd, pctLabel } from './calc.mjs';

const $ = (sel) => document.querySelector(sel);

const FIT_LABEL = { yes: '✓ 适用', partial: '△ 有限适用', no: '✗ 不适用' };
const STATUS_CLASS = {
  '已核': 'st-ok',
  '已核（官方宣布）': 'st-ok',
  '已核（官方宣布+实测）': 'st-ok',
  '已核（全球官方口径）': 'st-ok',
  '已核（官方封闭枚举）': 'st-ok',
  '上游已核事实': 'st-ok',
  '待复核': 'st-warn',
  '非官方口径': 'st-warn',
  '非官方口径（禁用）': 'st-bad',
  '给定背景·可变': 'st-warn',
  '持续跟踪': 'st-track',
  '占位': 'st-track',
};

/** 把文本中的 http(s) URL 转为链接（来源字段用） */
function linkify(text) {
  const escaped = text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  return escaped.replace(
    /(https?:\/\/[^\s；;，,）(（]+)/g,
    (m) => `<a href="${m}" target="_blank" rel="noopener nofollow">${m}</a>`
  );
}

function esc(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/* ---------------- 结果对比表 ---------------- */

function readInput() {
  return {
    monthlyVolume: parseFloat($('#in-monthly').value),
    aov: parseFloat($('#in-aov').value),
    scenario: $('#in-scenario').value,
    fxPct: parseFloat($('#in-fx').value) || 0,
    cnyPerUsd: parseFloat($('#in-rate').value) || DEFAULT_INPUT.cnyPerUsd,
  };
}

function renderResult() {
  const input = readInput();
  const out = compare(input);
  const errEl = $('#calc-error');
  const tbody = $('#result-table tbody');

  if (out.error) {
    errEl.textContent = out.error;
    errEl.hidden = false;
    tbody.innerHTML = '';
    $('#summary-line').textContent = '';
    $('#scenario-note').textContent = '';
    $('#global-notes').innerHTML = '';
    return;
  }
  errEl.hidden = true;

  $('#summary-line').innerHTML = out.best
    ? `按当前输入（年流水 <strong>${usd(out.annualVolume)}</strong>、约 <strong>${out.annualOrders.toLocaleString('en-US')}</strong> 笔/年）：适用路径中年成本最低的是 <strong>${esc(out.best.name)}</strong>（${usd(out.best.annualCost)}/年，约 ${out.best.effectivePct}%）——请务必核对其适用条件与合规提示。`
    : `按当前输入（年流水 ${usd(out.annualVolume)}）：当前场景下无「完全适用且非估算」的路径，请查看各行适用性提示。`;

  $('#scenario-note').textContent = out.scenarioNote;

  tbody.innerHTML = out.rows
    .map((r) => {
      const costCell =
        r.annualCost == null
          ? '—'
          : `<strong>${usd(r.annualCost)}</strong><br /><code class="formula">${esc(r.formula)}</code>`;
      const pctCell = r.effectivePct == null ? '—' : `约 ${r.effectivePct}%`;
      const cycleCell = esc(r.payoutCycle);
      const fitCell = `
        <span class="fit fit-${r.applicability}">${FIT_LABEL[r.applicability]}</span>
        ${r.badges.map((b) => `<span class="badge">${esc(b)}</span>`).join(' ')}
        <ul class="hints">${r.hints.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>`;
      return `<tr class="row-${r.applicability}">
        <th scope="row">${esc(r.name)}</th>
        <td>${costCell}</td>
        <td>${pctCell}</td>
        <td class="cycle">${cycleCell}</td>
        <td>${fitCell}</td>
      </tr>`;
    })
    .join('');

  $('#global-notes').innerHTML = out.notes.map((n) => `<li>${esc(n)}</li>`).join('');
}

/* ---------------- 路径详解卡（渲染一次） ---------------- */

function renderPathCards() {
  $('#path-cards').innerHTML = PATHS.map((p) => {
    // 阶梯路径：按边际制分段渲染（未超门槛部分低档、超出部分高档），档位 note（如「待复核」）随行标注
    const tierDesc = (t, i, tiers) => {
      const seg = Number.isFinite(t.upTo)
        ? `≤ ${t.upTo.toLocaleString('en-US')} → ${pctLabel(t.pct)}`
        : `超出 ${tiers[i - 1].upTo.toLocaleString('en-US')} 部分 → ${pctLabel(t.pct)}`;
      return `${i === 0 ? '年收益 ' : ''}${seg}${t.note ? `[${t.note}]` : ''}`;
    };
    const modelDesc = p.model.tiers
      ? `分段计价：${p.model.tiers.map((t, i) => tierDesc(t, i, p.model.tiers)).join('；')}`
      : `${p.model.pctLabel || '通道费率'} ${pctLabel(p.model.pct)}${
          p.model.intlAdd ? ` + ${p.model.intlAddLabel || '境外交易附加'} ${pctLabel(p.model.intlAdd)}` : ''
        }${
          p.model.scenarioAdd?.saas ? ` + 订阅附加 ${pctLabel(p.model.scenarioAdd.saas)}（SaaS/App）` : ''
        }、单笔 ${usd(p.model.perOrder || 0)}`;
    // pctLabel 覆盖（Payoneer）= pct 本身已是提现费口径，末尾不再重复列「提现费率」
    const withdrawPart = p.model.pctLabel
      ? ''
      : `；提现费率 ${p.model.withdrawPct ? `${pctLabel(p.model.withdrawPct)}（按出款额）` : '按 0 计'}`;
    return `<article class="card" id="card-${p.id}">
      <h3>${esc(p.name)}</h3>
      <div class="badge-row">${(p.badges || []).map((b) => `<span class="badge">${esc(b)}</span>`).join(' ')}</div>
      <h4>费率（总表原文）</h4>
      <p class="raw">${esc(p.raw.fees)}</p>
      <h4>到账周期（原文）</h4>
      <p class="raw">${esc(p.raw.payoutCycle)}</p>
      <h4>限制与合规（原文）</h4>
      <p class="raw">${esc(p.raw.constraints)}</p>
      <h4>本站计算口径</h4>
      <p class="model-line">计算器采用：${modelDesc}${withdrawPart}。官方未给数字的项目（换汇、部分提现费）一律按 0 计并在结果行注明；非官方口径费率一律不采用。</p>
      <h4>来源（${DATA_AS_OF} 实抓）</h4>
      <p class="source">${linkify(p.raw.source)}</p>
    </article>`;
  }).join('');
}

/* ---------------- 政策状态表（渲染一次；数据源=手工维护区） ---------------- */

function renderPolicyTable() {
  $('#policy-table tbody').innerHTML = POLICY_STATUS.map((r) => {
    const cls = STATUS_CLASS[r.status] || 'st-warn';
    return `<tr>
      <th scope="row">${esc(r.item)}</th>
      <td><span class="status ${cls}">${esc(r.status)}</span></td>
      <td>${esc(r.note)}</td>
      <td>${esc(r.asOf)}</td>
    </tr>`;
  }).join('');
}

/* ---------------- 启动 ---------------- */

function main() {
  // 场景下拉（与 data.mjs 的 SCENARIOS 保持同源）
  const sel = $('#in-scenario');
  sel.innerHTML = SCENARIOS.map((s) => `<option value="${s.id}">${s.label}</option>`).join('');
  sel.value = DEFAULT_INPUT.scenario;

  renderPathCards();
  renderPolicyTable();

  ['#in-monthly', '#in-aov', '#in-fx', '#in-rate'].forEach((s) => {
    $(s).addEventListener('input', renderResult);
  });
  sel.addEventListener('change', renderResult);

  renderResult();
}

main();
