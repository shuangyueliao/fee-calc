// ============================================================================
// tests/calc.test.mjs — 计算器核心单元测试（Node 内置 test runner，零依赖）
// 运行：node tests/calc.test.mjs
//
// 典型流水断言（成本口径见 js/calc.mjs 顶部注释）：
//   年成本 = 年流水×通道费率 + 年笔数×单笔费 + 月费×12 + 年流水×提现费率 + 换汇假设
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PATHS, POLICY_STATUS, SCENARIOS, DATA_AS_OF } from '../js/data.mjs';
import { compare, computePath, annualize, DEFAULT_INPUT, usd } from '../js/calc.mjs';

const byId = (rows, id) => rows.find((r) => r.id === id);
function assertCost(actual, expected, label) {
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${label}: 期望 ≈ ${expected}，实际 ${actual}`
  );
}

/* ---------------- 数据完整性：费率数据与总表逐条一致 ---------------- */

test('数据：共 7 条路径，raw 字段与总表关键数字逐条对应', () => {
  assert.equal(PATHS.length, 7);
  assert.deepEqual(
    PATHS.map((p) => p.id).sort(),
    ['apple', 'creem', 'lemonsqueezy', 'paddle', 'payoneer', 'stripe-hk', 'worldfirst']
  );
  for (const p of PATHS) {
    for (const k of ['fees', 'payoutCycle', 'constraints', 'source']) {
      assert.ok(typeof p.raw[k] === 'string' && p.raw[k].length > 20, `${p.id}.raw.${k} 缺失`);
    }
    assert.ok(p.raw.source.includes('http'), `${p.id} 缺来源 URL`);
    assert.ok(p.raw.source.includes('2026-10-28') || p.raw.source.includes('2026-10-29') || p.raw.source.includes('上游') || p.raw.source.includes('待复核'), `${p.id} 来源未标实抓日期`);
    assert.ok(['yes', 'partial', 'no'].includes(p.fit.saas));
    assert.ok(['yes', 'partial', 'no'].includes(p.fit.app));
    assert.ok(['yes', 'partial', 'no'].includes(p.fit.content));
  }
});

test('数据：各路径 model 数值与总表一致', () => {
  const m = Object.fromEntries(PATHS.map((p) => [p.id, p.model]));
  // Creem：3.9% + $0.40/笔、$0 月费、每月 2 次出款
  assert.equal(m.creem.pct, 0.039);
  assert.equal(m.creem.perOrder, 0.4);
  assert.equal(m.creem.monthlyFixed, 0);
  assert.equal(m.creem.payoutsPerYear, 24);
  // Paddle：5% + $0.50/笔、无月费、月结
  assert.equal(m.paddle.pct, 0.05);
  assert.equal(m.paddle.perOrder, 0.5);
  assert.equal(m.paddle.monthlyFixed, 0);
  assert.equal(m.paddle.payoutsPerYear, 12);
  // Lemon Squeezy：基础 5% + $0.50/笔 + 境外 1.5% + 订阅 0.5%（SaaS）+ 提现 1%（非美 Stripe 渠道）
  assert.equal(m.lemonsqueezy.pct, 0.05);
  assert.equal(m.lemonsqueezy.perOrder, 0.5);
  assert.equal(m.lemonsqueezy.intlAdd, 0.015);
  assert.equal(m.lemonsqueezy.scenarioAdd.saas, 0.005);
  assert.equal(m.lemonsqueezy.withdrawPct, 0.01);
  assert.equal(m.lemonsqueezy.payoutsPerYear, 24);
  // Stripe HK：USD 结算收单 3.4% + 国际卡 0.5%（保守计入）+ US$0.30、标准出款 $0
  assert.equal(m['stripe-hk'].pct, 0.034);
  assert.equal(m['stripe-hk'].intlAdd, 0.005);
  assert.equal(m['stripe-hk'].perOrder, 0.3);
  assert.equal(m['stripe-hk'].withdrawPct, 0);
  // Payoneer：约 2%（官方口径估算）
  assert.equal(m.payoneer.pct, 0.02);
  // 万里汇：0.7% 封顶
  assert.equal(m.worldfirst.pct, 0.007);
  // Apple：海外区 SBP 15%（≤$100 万）/ 标准 30%；超出部分按边际制分段计价
  assert.equal(m.apple.tiers[0].upTo, 1000000);
  assert.equal(m.apple.tiers[0].pct, 0.15);
  assert.equal(m.apple.tiers[1].pct, 0.30);
  assert.equal(m.apple.tiers[1].note, undefined); // 30% 已核（whats-included 官方原文），「待复核」note 已移除
});

test('数据：raw 原文包含总表关键表述（防篡改抽查）', () => {
  const raw = Object.fromEntries(PATHS.map((p) => [p.id, p.raw]));
  assert.ok(raw.creem.fees.includes('3.9% + $0.40/笔'));
  assert.ok(raw.creem.fees.includes('支付宝提现未单列手续费'));
  assert.ok(raw.creem.constraints.includes('单笔 ≤50,000 CNY、每年 300,000-600,000 CNY'));
  assert.ok(raw.paddle.fees.includes('5% + $0.50/笔'));
  assert.ok(raw.paddle.fees.includes('<$10 产品需联系销售定制价'));
  assert.ok(raw.paddle.constraints.includes('out/shovel-market-research.md:148/396'));
  assert.ok(raw.lemonsqueezy.fees.includes('美国境外交易 +1.5%'));
  assert.ok(raw.lemonsqueezy.constraints.includes('标准处理费 +3.5%』为非官方口径，计算器不得采用'));
  assert.ok(raw['stripe-hk'].fees.includes('USD 结算收单 3.4% + US$0.30'));
  assert.ok(raw['stripe-hk'].constraints.includes('46 国名单无 CN'));
  assert.ok(raw.payoneer.fees.includes('1.2% – 4%'));
  assert.ok(raw.payoneer.fees.includes('out/shovel-market-research.md:211/450'));
  assert.ok(raw.worldfirst.fees.includes('0.7% 封顶'));
  assert.ok(raw.worldfirst.constraints.includes('out/shovel-market-research.md:150/415'));
  assert.ok(raw.apple.fees.includes('2026-03-15 起标准 25%'));
  assert.ok(raw.apple.fees.includes('海外区 SBP 15%'));
});

test('数据：任何路径 model 均未混入被禁用的第三方口径 3.5%（Stripe Managed Payments）', () => {
  const dumped = JSON.stringify(PATHS.map((p) => ({ id: p.id, model: p.model })));
  assert.ok(!dumped.includes('0.035'), '不得采用第三方流传的 +3.5% 口径');
});

test('数据：政策状态表（手工维护区）非空且状态值合法', () => {
  assert.ok(POLICY_STATUS.length >= 12);
  for (const r of POLICY_STATUS) {
    assert.ok(r.item && r.status && r.note, '政策状态行字段缺失');
  }
  assert.ok(SCENARIOS.map((s) => s.id).join() === 'saas,app,content');
  assert.equal(DATA_AS_OF, '2026-10-28');
});

/* ---------------- 典型流水 A：SaaS，月流水 $2,000、客单价 $25 ---------------- */

test('典型 A（SaaS $2000/$25）：Creem 年成本 $1,320（3.9%+单笔费）', () => {
  const out = compare({ ...DEFAULT_INPUT, monthlyVolume: 2000, aov: 25, scenario: 'saas' });
  const r = byId(out.rows, 'creem');
  assert.equal(r.applicability, 'yes');
  // 24000×3.9% = 936；960 笔×$0.40 = 384；合计 1320
  assertCost(r.annualCost, 1320, 'Creem');
  assertCost(r.effectivePct, 5.5, 'Creem 占比');
  assert.ok(r.formula.includes('= $1,320.00'));
  assert.ok(r.hints.some((h) => h.includes('单笔 ≤50,000 CNY')));
});

test('典型 A（SaaS $2000/$25）：Paddle $1,680、LS $2,400（含境外+订阅附加与 1% 提现）', () => {
  const out = compare({ ...DEFAULT_INPUT, monthlyVolume: 2000, aov: 25, scenario: 'saas' });
  // Paddle：24000×5% = 1200；960×0.50 = 480 → 1680
  assertCost(byId(out.rows, 'paddle').annualCost, 1680, 'Paddle');
  // LS：24000×(5%+1.5%+0.5%) = 1680；960×0.50 = 480；提现 24000×1% = 240 → 2400
  const ls = byId(out.rows, 'lemonsqueezy');
  assertCost(ls.annualCost, 2400, 'LS');
  assertCost(ls.effectivePct, 10, 'LS 占比');
});

test('典型 A（SaaS $2000/$25）：Stripe HK $1,224（含国际卡 0.5%）为最低适用路径；Payoneer 仅估算不入选', () => {
  const out = compare({ ...DEFAULT_INPUT, monthlyVolume: 2000, aov: 25, scenario: 'saas' });
  // Stripe：24000×(3.4%+0.5%) = 936；960×0.30 = 288 → 1224
  assertCost(byId(out.rows, 'stripe-hk').annualCost, 1224, 'Stripe');
  assert.equal(out.best.id, 'stripe-hk');

  const po = byId(out.rows, 'payoneer');
  assert.equal(po.applicability, 'no'); // SaaS 场景非独立收款主力
  assert.equal(po.annualCost, null);
  assert.ok(po.badges.includes('官方口径估算'));

  // 万里汇与 Apple 在 SaaS 场景不适用
  assert.equal(byId(out.rows, 'worldfirst').applicability, 'no');
  assert.equal(byId(out.rows, 'apple').applicability, 'no');
  assert.ok(byId(out.rows, 'worldfirst').hints[0].includes('不支持 SaaS'));
});

/* ---------------- 典型流水 B：App，月流水 $5,000、客单价 $10 ---------------- */

test('典型 B（App $5000/$10）：Apple 佣金 SBP 15% = $9,000；万里汇 0.7% = $420', () => {
  const out = compare({ ...DEFAULT_INPUT, monthlyVolume: 5000, aov: 10, scenario: 'app' });
  const apple = byId(out.rows, 'apple');
  assert.equal(apple.applicability, 'yes');
  assertCost(apple.annualCost, 9000, 'Apple SBP');
  assertCost(apple.effectivePct, 15, 'Apple 占比');

  const wf = byId(out.rows, 'worldfirst');
  assert.equal(wf.applicability, 'yes');
  assertCost(wf.annualCost, 420, '万里汇');
  assertCost(wf.effectivePct, 0.7, '万里汇占比');
  assert.equal(out.best.id, 'worldfirst');
  assert.ok(wf.hints.some((h) => h.includes('上下游叠加')));
});

test('典型 B（App $5000/$10）：MoR/Stripe 为有限适用（网页侧），Payoneer 估算 $1,200 不入选', () => {
  const out = compare({ ...DEFAULT_INPUT, monthlyVolume: 5000, aov: 10, scenario: 'app' });
  assert.equal(byId(out.rows, 'creem').applicability, 'partial');
  assert.equal(byId(out.rows, 'paddle').applicability, 'partial');
  assert.equal(byId(out.rows, 'lemonsqueezy').applicability, 'partial');
  assert.equal(byId(out.rows, 'stripe-hk').applicability, 'partial');
  assert.equal(byId(out.rows, 'payoneer').applicability, 'partial');
  assert.ok(byId(out.rows, 'payoneer').badges.includes('官方口径估算'));
  // 排序：yes 行在前
  assert.equal(out.rows[0].applicability, 'yes');
});

/* ---------------- 典型流水 C：内容，月流水 $800、客单价 $20 ---------------- */

test('典型 C（内容 $800/$20）：Creem $566.40、Paddle $720、LS $960（内容无订阅附加）、Stripe $518.40 最低', () => {
  const out = compare({ ...DEFAULT_INPUT, monthlyVolume: 800, aov: 20, scenario: 'content' });
  assertCost(byId(out.rows, 'creem').annualCost, 566.4, 'Creem');
  assertCost(byId(out.rows, 'paddle').annualCost, 720, 'Paddle');
  const ls = byId(out.rows, 'lemonsqueezy');
  assertCost(ls.annualCost, 960, 'LS'); // 9600×6.5% + 480×0.5 + 96 = 624+240+96
  assert.ok(!ls.formula.includes('7%')); // 内容场景不含订阅附加 0.5%
  // Stripe：9600×(3.4%+0.5%) = 374.4；480×0.30 = 144 → 518.4
  assertCost(byId(out.rows, 'stripe-hk').annualCost, 518.4, 'Stripe');
  assert.equal(out.best.id, 'stripe-hk');
  assert.equal(byId(out.rows, 'worldfirst').applicability, 'no');
  assert.equal(byId(out.rows, 'apple').applicability, 'no');
});

/* ---------------- 规则引擎：动态提示 ---------------- */

test('规则：Paddle 客单价 <$10 → 官方「需联系销售定制价」提示', () => {
  const out = compare({ ...DEFAULT_INPUT, monthlyVolume: 500, aov: 5, scenario: 'saas' });
  const p = byId(out.rows, 'paddle');
  assert.ok(p.hints.some((h) => h.includes('<$10 产品需联系销售定制价')));
});

test('规则：Creem 支付宝限额——年入账折 CNY 进入 30-60 万区间与超上限分别提示', () => {
  // 年流水 $48,000 × 7.2 = 345,600 CNY → 区间提示
  const mid = compare({ ...DEFAULT_INPUT, monthlyVolume: 4000, aov: 50, scenario: 'saas' });
  assert.ok(byId(mid.rows, 'creem').hints.some((h) => h.includes('年度限额区间')));
  // 年流水 $84,000 × 7.2 = 604,800 CNY → 超上限提示
  const over = compare({ ...DEFAULT_INPUT, monthlyVolume: 7000, aov: 50, scenario: 'saas' });
  assert.ok(byId(over.rows, 'creem').hints.some((h) => h.includes('超个人支付宝提现年度限额上限')));
});

test('规则：Apple 超 SBP 门槛（年流水 >$100 万）→ 边际制分段计价（未超部分 15%＋超出部分 30%）', () => {
  const out = compare({ ...DEFAULT_INPUT, monthlyVolume: 90000, aov: 30, scenario: 'app' });
  const apple = byId(out.rows, 'apple');
  // 1,080,000 = 1,000,000×15% + 80,000×30% = 150,000 + 24,000 → 174,000（非「全额跳档」的 324,000）
  assertCost(apple.annualCost, 174000, 'Apple 分段');
  assertCost(apple.effectivePct, 16.11, 'Apple 占比'); // 174,000 / 1,080,000
  assert.ok(apple.formula.includes('= $174,000.00'));
  assert.ok(apple.formula.includes('× 15%'));
  assert.ok(apple.formula.includes('× 30%'));
  assert.ok(apple.hints.some((h) => h.includes('SBP 门槛')));
  assert.ok(apple.hints.some((h) => h.includes('近似'))); // 披露流水≈收益、默认上年未超限两处近似
});

test('规则：换汇假设 2% → 各适用路径成本同步上浮（Creem $1,320 → $1,800）', () => {
  const out = compare({ ...DEFAULT_INPUT, monthlyVolume: 2000, aov: 25, scenario: 'saas', fxPct: 2 });
  assertCost(byId(out.rows, 'creem').annualCost, 1800, 'Creem+汇损'); // 1320 + 24000×2%
  assert.ok(byId(out.rows, 'creem').formula.includes('换汇假设'));
});

test('规则：年流水 >$50,000 → 全局提示个人年度结汇额度', () => {
  const big = compare({ ...DEFAULT_INPUT, monthlyVolume: 5000, aov: 25, scenario: 'saas' });
  assert.ok(big.notes.some((n) => n.includes('5 万') || n.includes('$50,000')));
  const small = compare({ ...DEFAULT_INPUT, monthlyVolume: 2000, aov: 25, scenario: 'saas' });
  assert.ok(!small.notes.some((n) => n.includes('结汇额度')));
});

/* ---------------- 排序、健壮性与确定性 ---------------- */

test('排序：适用 → 有限适用 → 不适用；不适用行年成本为 null；同级按成本升序', () => {
  const out = compare({ ...DEFAULT_INPUT, monthlyVolume: 5000, aov: 10, scenario: 'app' });
  const ranks = out.rows.map((r) => ({ yes: 0, partial: 1, no: 2 })[r.applicability]);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
  for (const r of out.rows.filter((x) => x.applicability === 'no')) {
    assert.equal(r.annualCost, null);
    assert.ok(r.hints.length > 0);
  }
  const yesCosts = out.rows.filter((r) => r.applicability === 'yes').map((r) => r.annualCost);
  assert.deepEqual(yesCosts, [...yesCosts].sort((a, b) => a - b));
});

test('健壮性：非法输入返回错误且不抛异常', () => {
  for (const bad of [
    { ...DEFAULT_INPUT, monthlyVolume: 0 },
    { ...DEFAULT_INPUT, aov: -5 },
    { ...DEFAULT_INPUT, monthlyVolume: NaN },
  ]) {
    const out = compare(bad);
    assert.ok(out.error);
    assert.equal(out.rows.length, 0);
  }
});

test('确定性：同输入两次计算结果完全一致', () => {
  const a = compare({ ...DEFAULT_INPUT, monthlyVolume: 3000, aov: 15, scenario: 'saas' });
  const b = compare({ ...DEFAULT_INPUT, monthlyVolume: 3000, aov: 15, scenario: 'saas' });
  assert.deepEqual(a.rows.map((r) => [r.id, r.annualCost, r.effectivePct]), b.rows.map((r) => [r.id, r.annualCost, r.effectivePct]));
});

test('工具函数：annualize 与 usd', () => {
  const A = annualize({ monthlyVolume: 2000, aov: 25 });
  assert.equal(A.annualVolume, 24000);
  assert.equal(A.annualOrders, 960);
  assert.equal(annualize({ monthlyVolume: -1, aov: 10 }), null);
  assert.equal(usd(1320), '$1,320.00');
  assert.equal(usd(566.4), '$566.40');
});

test('单路径：computePath 对每条适用路径均给出公式与到账周期', () => {
  const A = annualize({ monthlyVolume: 2000, aov: 25 });
  for (const p of PATHS) {
    const r = computePath(p, { ...DEFAULT_INPUT, scenario: 'saas' }, A);
    assert.ok(r.payoutCycle.length > 4, `${p.id} 缺到账周期`);
    if (r.annualCost != null) {
      assert.ok(r.formula.includes('= $'), `${p.id} 缺公式`);
    }
  }
});
