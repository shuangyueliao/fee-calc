// ============================================================================
// calc.mjs — 计算器核心（独立模块：纯函数、零 DOM、零依赖，浏览器与 Node 通用）
//
// 输入 input = {
//   monthlyVolume: 月流水（USD/月，>0）
//   aov:           客单价（USD/笔，>0）
//   scenario:      'saas' | 'app' | 'content'
//   fxPct:         换汇/汇损假设 %（默认 0；用于模拟回款人民币化的汇损，各路径官方口径不同，见 hints）
//   cnyPerUsd:     CNY/USD 参考汇率（默认 7.2；仅用于 Creem 支付宝限额等额度换算提示，不进成本计算）
// }
//
// 输出 compare(input) = {
//   rows:  各路径 { id, name, applicability, annualCost, effectivePct, payoutCycle, badges, hints, formula }
//   notes: 全局提示（结汇额度、税务申报、数据快照）
//   best:  适用路径中按年成本最低者（排除「官方口径估算」，可能为 null）
//   error: 输入无效时的错误信息
// }
//
// 成本口径（所有路径统一）：
//   年成本 = 年流水 × 通道费率 + 年笔数 × 单笔费 + 月费×12 + 年流水 × 提现费率
//            + 年出款次数 × 单次提现费 + 年流水 × 换汇假设%
//   阶梯路径（Apple）的通道费为边际制分段计价：未超 SBP 门槛部分 15%、仅超出部分按标准费率——非「全额跳档」；
//   门槛与资格的两处近似（流水≈收益、默认上年未超限）在结果行 hints 中披露。
//   官方未给数字的项目（Creem 支付宝提现手续费、各路径换汇费、万里汇点差等）一律按 0 计，
//   并在对应行的 hints 中注明——绝不采用非官方口径的费率（如 Stripe Managed Payments +3.5%）。
// ============================================================================

import { PATHS, SCENARIO_NOTES, DATA_AS_OF } from './data.mjs';

export const DEFAULT_INPUT = Object.freeze({
  monthlyVolume: 2000,
  aov: 25,
  scenario: 'saas',
  fxPct: 0,
  cnyPerUsd: 7.2,
});

function round2(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

export function usd(x) {
  return '$' + round2(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function num(x) {
  const r = round2(x);
  return Number.isInteger(r)
    ? r.toLocaleString('en-US')
    : r.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function pctLabel(p) {
  const v = round2(p * 100);
  return (Number.isInteger(v) ? v.toString() : v.toFixed(2)) + '%';
}

/** 年化：年流水与年笔数（客单价为分母） */
export function annualize(input) {
  const v = Number(input.monthlyVolume);
  const a = Number(input.aov);
  if (!Number.isFinite(v) || v <= 0 || !Number.isFinite(a) || a <= 0) return null;
  return { annualVolume: v * 12, annualOrders: (v / a) * 12 };
}

/** 该路径在当前场景下的有效费率（普通路径；阶梯路径走 tierCost 分段计价，不经此函数） */
function effectivePct(model, scenario) {
  return (
    (model.pct || 0) +
    (model.intlAdd || 0) +
    ((model.scenarioAdd && model.scenarioAdd[scenario]) || 0)
  );
}

/** 阶梯费率（边际制分段计价）：各区间段分别按所在档费率计——未超门槛部分按低档、仅超出部分按高档 */
function tierCost(model, annualVolume) {
  let cost = 0;
  let lower = 0;
  for (const t of model.tiers) {
    if (annualVolume <= lower) break;
    const upper = Math.min(annualVolume, t.upTo);
    cost += (upper - lower) * t.pct;
    lower = t.upTo;
  }
  return cost;
}

/** 各路径动态提示（基于输入的规则引擎） */
function dynamicHints(path, input, A) {
  const hints = [];
  const cny = A.annualVolume * Number(input.cnyPerUsd || 0);
  switch (path.id) {
    case 'creem':
      if (cny > 600000) {
        hints.push(`⚠️ 按参考汇率（1 USD ≈ ${input.cnyPerUsd} CNY）年入账约 ${num(cny)} CNY，已超个人支付宝提现年度限额上限（600,000 CNY）——需改用企业收款人（本地银行账户、无限额）或银行转账提现（7 USD/EUR 或 1% 取高）。`);
      } else if (cny > 300000) {
        hints.push(`⚠️ 按参考汇率年入账约 ${num(cny)} CNY，已进入个人支付宝提现年度限额区间（300,000–600,000 CNY），注意额度规划。`);
      }
      hints.push('个人支付宝提现硬限额：单笔 ≤50,000 CNY；余额 ≥$50 方可提现；交易后 7-12 天风控冻结期。');
      hints.push('支付宝提现官方页未单列手续费（本试算按 $0 计）；跨币种换汇合作方费率官方未公布——可用「换汇假设」字段模拟。');
      break;
    case 'paddle':
      if (Number(input.aov) < 10) {
        hints.push('⚠️ 官方 FAQ：<$10 产品需联系销售定制价——本试算仍按标准 5% + $0.50 计算，实际成本可能不同。');
      }
      if (Number(input.monthlyVolume) < 100) {
        hints.push('每月余额可能不足最低起付 $100，将滚入下月，实际到账周期拉长。');
      }
      hints.push('出款方式仅电汇或 Payoneer（PayPal 未列出）；多数国家提现 $0，部分国家 $15 SWIFT，银行端/中间行费用自理。');
      hints.push('⚠️ 大陆用户曾有大范围关户的社区多源反映（非官方口径、无官方文件佐证）——采用前自行评估风险。');
      break;
    case 'lemonsqueezy':
      hints.push('⚠️ 官方 2026-01-28 宣布并入 Stripe Managed Payments：产品进入维护期；注册入口 2026-10-29 实测在线（表单可访问、未提交开户），店铺激活与身份验证仍需自行完成。');
      hints.push('综合费率口径：5% 基础 + 订阅附加 0.5%（SaaS/App 场景计入）+ 美国境外交易 1.5%（按买家主要在境外保守计入；若买家主要在美境内可减 1.5%）。');
      hints.push('提现费按 Stripe 渠道非美国 1%/笔、全年出款额≈年流水计；大陆不在 LS 银行出款国列表（仅 PayPal 出款路线：非美国 3% 封顶 $30/笔，未计入）——对大陆用户实际提现成本高于本行试算。');
      break;
    case 'stripe-hk':
      hints.push('需香港主体 + 香港银行账户（大陆不在 Stripe 开户 46 国名单）。');
      hints.push('非 MoR：销售税/VAT/个税合规自理——本试算仅含通道成本，未含合规成本。');
      hints.push('按 USD 结算收单口径 3.4% + US$0.30，国际卡 +0.5% 已保守计入（跨境买家几乎全为国际卡，与 LS 境外附加同口径）；拒付费 HK$85/笔、支付宝/微信钱包 2.2%+HK$2.00 未计入默认计算；换汇场景官方口径 +2%——可用「换汇假设」字段模拟。');
      break;
    case 'payoneer':
      hints.push('⚠️ 2% 取官方资源文跨币种提现上限口径 "up to 2%"（官方定价页涉换汇提现区间 1.2%–4%）；中国内地走廊精确费率官方公开页不公布，开户后以账户 Fees 页为准。');
      hints.push('定位为收款/提现层（Paddle 官方出款方式之一）；若经 Paddle 提现，Paddle 行成本未含此约 2% 中转费。');
      break;
    case 'worldfirst':
      hints.push('与 Apple IAP 为上下游叠加关系：Apple 抽佣后的 App Store/广告平台出款 → 万里汇收款（0.7% 封顶）→ 支付宝提现。');
      hints.push('收款/换汇 0.7% 为封顶值，提款越多越低；提款至支付宝手续费官方未给数字（按 $0 计）。');
      hints.push('换汇官方营销口径「0 汇损」未给点差——保守模拟可用「换汇假设」字段。');
      hints.push('结汇额度需「平台直连或手动上传交易明细」获取。');
      break;
    case 'apple': {
      const sbpUpTo = path.model.tiers?.[0]?.upTo ?? 0;
      if (A.annualVolume > sbpUpTo) {
        hints.push(
          `⚠️ 年流水已超 SBP 门槛（${usd(sbpUpTo)}）：本试算按分段计价——未超出部分 15%、超出部分按海外区标准费率 30%。` +
            '这是近似：① SBP 资格按上一日历年收益认定，本试算默认上年未超限；若上年收益已超 $100 万（无 SBP 资格），则全年均按标准费率、成本更高；' +
            '② 官方门槛按佣金后「收益」计，本试算以佣金前流水近似（同额流水对应收益约低 15%），实际越线部分可能更小。'
        );
      } else {
        hints.push('按海外区 Small Business Program 15% 计（年收益 ≤$100 万，关联开发者账户合并计算）。');
      }
      hints.push('本试算为海外区口径（出海主场景）；中国内地 App Store 2026-03-15 起为标准 25% / SBP 12%。');
      hints.push('Apple 无提现费（银行端/中间行费用自理）；仅支持一个收款银行账户（不支持分账）；结汇占个人年度 5 万美元额度。');
      break;
    }
  }
  return hints;
}

/** 计算单条路径 */
export function computePath(path, input, A) {
  const fit = (path.fit && path.fit[input.scenario]) || 'no';
  const row = {
    id: path.id,
    name: path.name,
    applicability: fit,
    payoutCycle: path.cycleShort,
    badges: [...(path.badges || [])],
    hints: [],
    annualCost: null,
    effectivePct: null,
    formula: null,
  };

  if (fit === 'no') {
    row.hints.push(path.fitHints?.[input.scenario] || '不适用于当前场景。');
    return row;
  }

  const m = path.model;
  const fx = A.annualVolume * (Number(input.fxPct || 0) / 100);

  // 通道费部分：普通路径 = 年流水×有效费率；阶梯路径（Apple）= 边际制分段计价（未超门槛部分低档、仅超出部分高档）
  const channelCost = m.tiers
    ? tierCost(m, A.annualVolume)
    : A.annualVolume * effectivePct(m, input.scenario);

  let cost =
    channelCost +
    A.annualOrders * (m.perOrder || 0) +
    (m.monthlyFixed || 0) * 12 +
    A.annualVolume * (m.withdrawPct || 0) +
    (m.payoutsPerYear || 0) * (m.withdrawFixedPerEvent || 0) +
    fx;

  cost = round2(cost);
  row.annualCost = cost;
  row.effectivePct = round2((cost / A.annualVolume) * 100);

  const parts = [];
  if (m.tiers) {
    let lower = 0;
    for (const t of m.tiers) {
      if (A.annualVolume <= lower) break;
      const upper = Math.min(A.annualVolume, t.upTo);
      parts.push(`${usd(upper - lower)} × ${pctLabel(t.pct)}${t.note ? `[${t.note}]` : ''}`);
      lower = t.upTo;
    }
  } else {
    parts.push(`${usd(A.annualVolume)} × ${pctLabel(effectivePct(m, input.scenario))}`);
  }
  if (m.perOrder) parts.push(`${num(A.annualOrders)} 笔 × ${usd(m.perOrder)}`);
  if (m.monthlyFixed) parts.push(`月费 ${usd(m.monthlyFixed)} × 12`);
  if (m.withdrawPct) parts.push(`提现 ${usd(A.annualVolume)} × ${pctLabel(m.withdrawPct)}`);
  if (fx > 0) parts.push(`换汇假设 ${usd(A.annualVolume)} × ${pctLabel(Number(input.fxPct) / 100)}`);
  row.formula = parts.join(' + ') + ` = ${usd(cost)}`;

  if (path.fitHints?.[input.scenario]) row.hints.push(path.fitHints[input.scenario]);
  row.hints.push(...dynamicHints(path, input, A));
  return row;
}

/**
 * 主入口：各路径年成本对比。
 * 排序：适用（yes）→ 有限适用（partial）→ 不适用（no）；同级按年成本升序。
 */
export function compare(input) {
  const A = annualize(input);
  if (!A) {
    return { rows: [], notes: [], best: null, error: '请输入有效的月流水与客单价（需大于 0）。' };
  }

  const rows = PATHS.map((p) => computePath(p, input, A));
  const rank = { yes: 0, partial: 1, no: 2 };
  rows.sort(
    (x, y) =>
      rank[x.applicability] - rank[y.applicability] ||
      (x.annualCost ?? Infinity) - (y.annualCost ?? Infinity)
  );

  const notes = [];
  if (A.annualVolume > 50000) {
    notes.push(`年流水 ${usd(A.annualVolume)} 已超个人年度 $50,000 结汇额度——所有路径回款结汇均占用该额度，需关注结汇安排与申报。`);
  }
  notes.push('无论走哪条路径，境外所得均涉及中国税务申报义务（背景：2025-03 四地通报 → 2025-11 六地跟进、单人补缴最高 698.7 万 → 2026-03 个税 APP 境外所得弹窗）——本站不构成税务建议，请咨询专业人士。');
  notes.push(`费率数据快照：${DATA_AS_OF} 官方页实抓；采用任一路径前请逐条复核官方页与下方政策状态表。`);

  const eligible = rows.filter(
    (r) => r.applicability === 'yes' && !r.badges.includes('官方口径估算') && r.annualCost != null
  );
  const best = eligible.length
    ? eligible.reduce((a, b) => (a.annualCost <= b.annualCost ? a : b))
    : null;

  return {
    rows,
    notes,
    best,
    scenarioNote: SCENARIO_NOTES[input.scenario] || '',
    annualVolume: round2(A.annualVolume),
    annualOrders: round2(A.annualOrders),
    error: null,
  };
}
