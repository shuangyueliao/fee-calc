// ============================================================================
// data.mjs — 费率数据单一来源（纯静态站，无后端）
//
// 铁律：
//   1. `raw` 字段 = 费率总表原文，逐条照抄，不得改写数字与表述。
//   2. `model` 字段 = 计算器使用的数值化字段，仅从 raw 同源数字提取；
//      任何未给官方数字的项目（换汇费、支付宝提现手续费等）一律按 0 计并在 hints 中注明。
//   3. 数据快照日期：2026-10-28（各来源官方页实抓，出处见各 path.raw.source）。
//   4. POLICY_STATUS = 政策状态表【手工维护区】：编辑此数组即可更新页面表格。
// ============================================================================

export const DATA_AS_OF = '2026-10-28';

/** 场景选项（页面下拉与 fit 字段的 key 一一对应） */
export const SCENARIOS = [
  { id: 'saas', label: 'SaaS / 订阅软件' },
  { id: 'app', label: 'App（应用商店 / 广告变现）' },
  { id: 'content', label: '内容 / 数字商品' },
];

/**
 * 各路径数据。
 * fit: 场景适用性（yes=适用 / partial=有限适用 / no=不适用）
 * fitHints: 不适用或有限适用时的解释
 * model: 计算器数值模型（字段含义见 js/calc.mjs 顶部注释）
 *   - pct: 通道费率（场景附加见 scenarioAdd；境外/国际卡附加见 intlAdd，显示标签见 intlAddLabel）
 *   - perOrder: 每笔固定费（USD）
 *   - monthlyFixed: 月费（全部为 $0，与总表一致）
 *   - withdrawPct: 提现费率（按出款额计，如 LS 非美 Stripe 渠道 1%）
 *   - withdrawFixedPerEvent / payoutsPerYear: 按次提现费与年出款次数（当前各路径均为 $0/次或未公布数字，保留字段位）
 *   - pctLabel: 口径行显示标签覆盖（Payoneer 用：其 2% 为官方上限口径的提现费、非通道费率）
 *   - tiers: 阶梯费率（边际制分段计价。Apple：未超 $100 万部分 → SBP 15%；超出部分 → 标准 30%。
 *           官方门槛按佣金后「收益」计、资格按上一日历年收益认定——计算器以佣金前流水近似并在 hints 披露这两点）
 */
export const PATHS = [
  {
    id: 'creem',
    name: 'Creem 直收（MoR）',
    badges: ['MoR · 代缴税费', '身份证可开'],
    cycleShort: '每月 2 次（1 日 / 15 日）；≥$50 起提；7-12 天风控冻结',
    fit: { saas: 'yes', content: 'yes', app: 'partial' },
    fitHints: {
      app: 'App 内虚拟商品/订阅必须走 Apple IAP；Creem 仅适用于 App 的网页侧销售（官网卖 license/订阅）。',
      saas: '',
      content: '',
    },
    raw: {
      fees: '通道费 3.9% + $0.40/笔、$0 月费（$100 销售扣 $4.30 净 $95.70）——creem.io/pricing 实抓 2026-10-28；提现费：银行转账 7 USD/EUR 或 1% 取高（payouts 文档与 supported-countries 页一致）、USDC(Polygon) 提现 2%、支付宝提现未单列手续费——docs.creem.io/merchant-of-record/finance/payouts 实抓 2026-10-28；汇损：提现币种≠销售币种时另收合作方换汇费，官方未给数字；附加产品费：Splits 2%、联盟 2%、弃单挽回 5%，平台费按含税订单总额计',
      payoutCycle: '每月 1 日与 15 日两次；余额 ≥$50/€50 方可提现；交易后 7-12 天风控冻结期才计入可提余额；付款日遇周末/节假日顺延下一工作日（官方 payouts 文档实抓 2026-10-28）',
      constraints: '大陆身份证可开（supported-countries 实抓 2026-10-29：官方正文 "We support merchants in 87 countries"、表格 87 行，均含 China——页面小标题仍写 "Supported Countries (86)" 为官方页内陈旧计数）；支持列表『星号条件』已向官方 docs 逐字核实（实抓 2026-10-29）：单星号仅 China——超链接至 payouts 文档 Transfer Limits 节，原文 "Individual recipient: Alipay / You can receive up to 50,000 CNY per payout and between 300,000—600,000 CNY per year / Business recipient: Local Bank Account / Receiving via Local Bank account: Unlimited"，即个人收款人=支付宝，硬限额：单笔 ≤50,000 CNY、每年 300,000-600,000 CNY；企业收款人=本地银行账户无限额；双星号 6 国（Bangladesh/Colombia/Nepal/Pakistan/Tanzania/Ukraine）为 "Bank Transfer Partner Restrictions"——本地银行出款受合作方（Wise）附加限制（如仅支持个人账户、企业转账不可用），与中国大陆收款人无关；结汇占个人年度 5 万美元额度（上游已核事实）',
      source: 'https://www.creem.io/pricing（实抓 2026-10-28）；https://docs.creem.io/merchant-of-record/finance/payouts；https://docs.creem.io/merchant-of-record/supported-countries（后两页复抓 2026-10-29，星号条件逐字核实，官方 Mintlify .md 直出核验）',
    },
    model: {
      pct: 0.039,          // 通道费 3.9%（creem.io/pricing）
      perOrder: 0.40,      // $0.40/笔
      monthlyFixed: 0,     // $0 月费
      withdrawPct: 0,      // 支付宝提现官方未单列手续费 → 按 0 计（银行转账 7 USD/EUR 或 1% 取高未计入默认模型）
      withdrawFixedPerEvent: 0,
      payoutsPerYear: 24,  // 每月 1 日与 15 日两次
    },
  },
  {
    id: 'paddle',
    name: 'Paddle（MoR）',
    badges: ['MoR · 代缴税费'],
    cycleShort: '月结：1 日转账 → 15 日前发出 → +最多 3 个工作日；$100 起付',
    fit: { saas: 'yes', content: 'yes', app: 'partial' },
    fitHints: {
      app: 'App 内虚拟商品/订阅必须走 Apple IAP；Paddle 仅适用于 App 的网页侧销售。',
      saas: '',
      content: '',
    },
    raw: {
      fees: '通道费 5% + $0.50/笔、无月费/迁移费/隐藏费用（paddle.com/pricing 实抓 2026-10-28）；提现费：多数国家 $0，部分国家 $15 SWIFT 电汇费，银行端/中间行费用自理（官方 help 实抓 2026-10-28）；汇损：官方页未公布换汇费率；<$10 产品需联系销售定制价（pricing FAQ 原文）',
      payoutCycle: '月结：每月 1 日余额超阈值转为 payout → 15 日前发出 → 到账再加最多 3 个工作日；最低起付 $100/£100/€100（可调至 $100,000），不足滚入下月；不可随取（官方 help 页原文实抓 2026-10-28）',
      constraints: '出款方式仅电汇或 Payoneer（PayPal 未列出）；对大陆用户曾有大范围关户的社区多源反映——无官方文件佐证，上游核查记录风险提示（out/shovel-market-research.md:148/396），非官方口径',
      source: 'https://www.paddle.com/pricing；https://www.paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid（实抓 2026-10-28）',
    },
    model: {
      pct: 0.05,           // 通道费 5%（paddle.com/pricing）
      perOrder: 0.50,      // $0.50/笔
      monthlyFixed: 0,     // 无月费
      withdrawPct: 0,      // 多数国家提现 $0（部分国家 $15 SWIFT 未计入默认模型，见 hints）
      withdrawFixedPerEvent: 0,
      payoutsPerYear: 12,  // 月结
    },
  },
  {
    id: 'lemonsqueezy',
    name: 'Lemon Squeezy（2026 并入 Stripe 后口径）',
    badges: ['并入 Stripe 中 · 维护期', '新户注册入口实测在线（2026-10-29）'],
    cycleShort: '每月自动出款两次',
    fit: { saas: 'yes', content: 'yes', app: 'partial' },
    fitHints: {
      app: 'App 内虚拟商品/订阅必须走 Apple IAP；LS 仅适用于网页侧销售，且平台正并入 Stripe；新户注册入口 2026-10-29 实测在线（auth.lemonsqueezy.com/register 服务端表单可访问，未提交开户）。',
      saas: '',
      content: '',
    },
    raw: {
      fees: '基础 $0.50 + 5%/笔（官方 fees 文档实抓 2026-10-28）；附加费：美国境外交易 +1.5%、PayPal 交易 +1.5%、订阅支付 +0.5% → 美境内订阅综合 ≈5.5%+$0.50（与给定背景『新账户订阅约 5.5%』同口径）；提现费：Stripe 渠道——美国银行 $0、非美国 1%/笔；PayPal 渠道——美国 $0.50/笔、非美国 3% 单笔封顶 $30；换汇费官方未给百分比；附加：弃单挽回 +5%、联盟 3%（商家侧）/2%（联盟侧）',
      payoutCycle: "每月自动出款两次（lemonsqueezy.com/pricing 原文 'automatically processed into your preferred method twice a month'，实抓 2026-10-28）",
      constraints: '官方博客 2026-01-28 宣布并入 Stripe Managed Payments：LS 产品进入维护期（官方自认支持变慢）、迁移通道规划中；Managed Payments 现为 waitlist/早access、35+ 国（博客原文）；LS 定价页 2026-10-29 实抓仍挂 5%+50¢、5 个 Get started 全指向 app.lemonsqueezy.com/register（302→auth.lemonsqueezy.com/register，服务端注册表单在线、国家下拉含 China）；官方无停接新户声明，注册表单页实测在线但未提交开户。新增硬约束：China 不在银行出款国列表（HK/Macao/Taiwan 在列），大陆仅 PayPal 出款路线（官方 Alert 原文 "If you don\'t see your country listed by PayPal or in the list below, sorry, you won\'t be able to use Lemon Squeezy at this time (either as a merchant or an affiliate)."），PayPal 渠道提现费非美 3%/笔封顶 $30——即 model 的 1%（Stripe 渠道）对大陆用户不适用、实际成本更高；Stripe Managed Payments 官方文档（docs.stripe.com/managed-payments 实抓）不公布 MoR 费率——第三方流传『标准处理费 +3.5%』为非官方口径，计算器不得采用',
      source: 'https://docs.lemonsqueezy.com/help/getting-started/fees；https://www.lemonsqueezy.com/pricing；https://www.lemonsqueezy.com/blog/2026-update；https://docs.stripe.com/managed-payments（实抓 2026-10-28）；https://docs.lemonsqueezy.com/help/getting-started/supported-countries（实抓 2026-10-29）',
    },
    model: {
      pct: 0.05,           // 基础 5%（官方 fees 文档）
      intlAdd: 0.015,      // 美国境外交易 +1.5%（按大陆开发者买家主要在境外保守计入，见 hints）
      intlAddLabel: '境外交易附加',
      scenarioAdd: { saas: 0.005, content: 0, app: 0.005 }, // 订阅支付 +0.5%
      perOrder: 0.50,      // $0.50/笔
      monthlyFixed: 0,
      withdrawPct: 0.01,   // Stripe 渠道非美国 1%/笔，按全年出款额≈年流水计
      withdrawFixedPerEvent: 0,
      payoutsPerYear: 24,  // 每月两次
    },
  },
  {
    id: 'stripe-hk',
    name: 'Stripe 直收 + 香港账户',
    badges: ['非 MoR · 合规自理', '需香港主体+港卡'],
    cycleShort: '首笔结算 7 个日历日；首次出款 7-14 天',
    fit: { saas: 'yes', content: 'yes', app: 'partial' },
    fitHints: {
      app: 'App 内虚拟商品/订阅必须走 Apple IAP；Stripe 仅适用于 App 的网页侧销售，且需香港主体。',
      saas: '',
      content: '',
    },
    raw: {
      fees: '本港卡 3.4% + HK$2.35/笔；国际卡 +0.5%；需换汇 +2%；USD 结算收单 3.4% + US$0.30；支付宝/微信支付电子钱包 2.2% + HK$2.00；拒付费 HK$85/笔（stripe.com/en-hk/pricing 实抓 2026-10-28）；提现费：标准周期出款 $0、USD 出款 1%（最低 US$5）、即时出款 1%（最低 HK$5）；汇损：换汇场景官方口径 +2%；无 setup/月费',
      payoutCycle: '香港账户首笔结算周期 7 个日历日（docs.stripe.com/payouts 实抓：Hong Kong = 7 calendar days）；首次出款一般 7-14 天内完成（同文档）',
      constraints: '中国大陆不在 Stripe 开户国家列表——stripe.com/global 实抓 46 国名单无 CN，页面自注『本网站展示的产品和服务并不在中国大陆提供』，需香港主体+香港银行账户（社区通行路径：护照+港司+港卡，非官方文档）；Stripe 非 MoR：销售税/VAT/个税合规自理；MoR 版 Managed Payments 不支持 Connect、暂处 waitlist；美元回大陆结汇占个人年度 5 万美元额度（上游已核事实）',
      source: 'https://stripe.com/en-hk/pricing；https://docs.stripe.com/payouts；https://stripe.com/global（实抓 2026-10-28）',
    },
    model: {
      pct: 0.034,          // USD 结算收单 3.4%（stripe.com/en-hk/pricing）
      intlAdd: 0.005,      // 国际卡 +0.5%（跨境买家几乎全为国际卡，与 LS 境外附加同口径保守计入，见 hints）
      intlAddLabel: '国际卡附加',
      perOrder: 0.30,      // US$0.30/笔
      monthlyFixed: 0,     // 无 setup/月费
      withdrawPct: 0,      // 标准周期出款 $0
      withdrawFixedPerEvent: 0,
      payoutsPerYear: null, // 官方未给固定出款次数，且标准出款 $0，不影响成本
    },
  },
  {
    id: 'payoneer',
    name: 'Payoneer（平台/市场收款与 Paddle 下挂提现层）',
    badges: ['官方口径估算', '非独立收款主力'],
    cycleShort: '最快 T+0 到账、7×24 可提现（官方定性，无具体数字）',
    fit: { saas: 'no', content: 'no', app: 'partial' },
    fitHints: {
      saas: 'Payoneer 定位为收款/提现层（Paddle 官方出款方式之一），不适合做独立站 SaaS 直接收款主力。',
      content: 'Payoneer 定位为收款/提现层（对接平台/市场），不是独立站内容变现的直收主力。',
      app: '适合对接平台/市场（11 币种本地收款账户）与广告变现收款；App Store 出款通常直入银行，Payoneer 非必需。',
    },
    raw: {
      fees: '提现费（官方全球定价页 payoneer.com/pricing 实抓 2026-10-29，页首 "Last updated on 1 January 2026"）：提现至「同国本币银行账户（受支持国家）」1.50 USD；涉换汇提现逐字 "1.2% – 4%"；注脚逐字 "Fees depend on sender and recipient locations, payment method, and currency corridor, with minimum fees where applicable."；官方明示 "Full fee details are available on the fees page when signed in to Payoneer."、免责声明 "Different prices and fees may be applied in different territories…"、"Currency conversion rates … include the conversion fee where indicated."；余额互转 0.50%（"Move funds between your Payoneer balances"）。官方资源文（/resources/how-to-use-payoneer/how-payoneer-calculates-withdrawal-fees，2017-05-02 发布、modified 2026-01-16，自注营销信息用途）逐字 "When withdrawing to a local bank account in a different currency, the fee applied for this transaction will be up to 2%."、同币种固定费 "EUR – €1.50, GBP – £1.50"。旧费率页 /about/fees/ 的 "UP TO 2%"/"UP TO 1.2%" 属 PAY 对外付款区非提现；其 WITHDRAW 区仅 "Fees vary depending on the currency of your account" 无数字。官方帮助 FAQ（payoneer.custhelp.com a_id/18605 实抓 2026-10-29）逐字 "Fees vary according to the type of withdrawal and will be displayed in the withdrawal summary page. Note that if there is currency conversion involved, the fee is included in the conversion rate."、"There are no setup or recurring (monthly/annual) fees associated with making withdrawals to your bank account."、时效 "most withdrawals will land in your account the same day, while some may take up to 2 business days."。中国内地走廊精确费率官方公开页均未公布（payoneer.cn 全站 316 URL 及 /product/withdraw 实抓仅『更低费率』『专属费率』定性语；help.payoneer.com 本网络 DNS 不可达 curl exit6 / WebFetch ENOTFOUND）——计算器 2% 取官方资源文跨币种提现上限口径、落于官方 1.2%–4% 区间；上游二手记录 out/shovel-market-research.md:211/450『约 2%』与该官方上限一致，予以佐证；精确费率以注册流程与登录后账户 Fees 页为准',
      payoutCycle: '官方定性表述『最快 T+0 到账，7×24 小时可提现』（payoneer.cn 实抓 2026-10-28）；官方帮助 FAQ 量化 "most withdrawals will land in your account the same day, while some may take up to 2 business days"（payoneer.custhelp.com a_id/18605 实抓 2026-10-29）',
      constraints: '定位为收款/提现层（Paddle 官方出款方式之一；11 币种本地收款账户对接平台市场）；不适合做独立站 SaaS 直接收款主力；真实费率开户后账户后台才可见，计算器该路径费率字段应显示『估算，待复核』',
      source: 'https://www.payoneer.com/pricing/；https://www.payoneer.com/resources/how-to-use-payoneer/how-payoneer-calculates-withdrawal-fees；https://payoneer.custhelp.com/app/answers/detail/a_id/18605/~/withdraw-to-bank---faq；https://www.payoneer.cn/product/withdraw（均实抓 2026-10-29；注意：本地网络 curl 访问 payoneer.com 一律 302→payoneer.cn（geo 重定向），正文经服务端 reader 抓取；help.payoneer.com DNS 不可达，官方帮助实际托管于 payoneer.custhelp.com）',
    },
    model: {
      pct: 0.02,           // 官方资源文跨币种提现上限 "up to 2%"（how-payoneer-calculates-withdrawal-fees，modified 2026-01-16），落于官方定价页涉换汇提现区间 1.2%–4%；中国走廊精确费率官方不公开、登录后账户 Fees 页可见
      pctLabel: '提现费率（官方口径 up to 2% 上限；定价页区间 1.2%–4%，中国走廊精确费率登录后可见）', // 口径行显示：2% 是提现费口径而非通道费率，已按年流水计入总成本
      perOrder: 0,
      monthlyFixed: 0,
      withdrawPct: 0,
      withdrawFixedPerEvent: 0,
      payoutsPerYear: null,
    },
  },
  {
    id: 'worldfirst',
    name: '万里汇 WorldFirst（开发者账户——仅 App/广告收入场景）',
    badges: ['仅 App/广告场景', 'SaaS 排除·官方枚举已核'],
    cycleShort: '极速到账（官方定性，无具体数字）',
    fit: { saas: 'no', content: 'no', app: 'yes' },
    fitHints: {
      saas: '开发者账户官方场景口径=应用商店及广告变现平台；官方指南「支持的收款平台」封闭枚举仅 App Store/Facebook Audience Network/Google Admob/Google Adsense/Google Play/Steam，不支持 SaaS 网站收款（与 out/shovel-market-research.md:150/415 一致）。',
      content: '开发者账户官方场景口径=应用商店及广告变现平台，不覆盖独立站内容变现。',
      app: '',
    },
    raw: {
      fees: '收款/换汇费率 0.7% 封顶、提款越多费率越低（worldfirst.com.cn/static/developer 原文实抓 2026-10-28）；提款至支付宝官方宣称『独家支持』（未给手续费数字）；汇损：官方营销口径『实时货币兑换，所见即所得，真正实现 0 汇损』——未给具体点差，计算器换汇字段留用户自填位',
      payoutCycle: '官方页仅『极速到账』定性表述，无具体时效数字（实抓 2026-10-28）',
      constraints: '【场景硬限制】开发者账户官方场景口径=应用商店及广告变现平台（原文『灵活绑定应用商店及广告变现平台，展业无忧』）；『不支持 SaaS 网站收款（仅 APP/广告收入）』已核（2026-10-29 官方指南实抓）：官方「支持的收款平台」封闭枚举仅 App Store/Facebook Audience Network/Google Admob/Google Adsense/Google Play/Steam，无 SaaS/自建站收款入口；官方无一字面「不支持 SaaS」句，系由封闭枚举推出；与上游核查记录（out/shovel-market-research.md:150/415）一致；结汇额度需『平台直连或手动上传交易明细』获取；站点侧返佣条款（¥1000/人、180 天入账 ≥$100）为给定背景、可变，不进费率计算',
      source: 'https://www.worldfirst.com.cn/static/developer（实抓 2026-10-28）；https://www.worldfirst.com.cn/content/articles/developer-guide/；https://www.worldfirst.com.cn/content/articles/developer-guide/a9aum248；https://www.worldfirst.com.cn/content/articles/developer-guide/w8i5vmbc（均实抓 2026-10-29）；SaaS 排除项=out/shovel-market-research.md:150/415（上游核查记录）→ 已核（官方封闭枚举）',
    },
    model: {
      pct: 0.007,          // 收款/换汇 0.7% 封顶（worldfirst.com.cn/static/developer；提款越多越低）
      perOrder: 0,
      monthlyFixed: 0,
      withdrawPct: 0,      // 提款至支付宝手续费官方未给数字 → 按 0 计
      withdrawFixedPerEvent: 0,
      payoutsPerYear: null,
    },
  },
  {
    id: 'apple',
    name: 'Apple IAP（App 收入场景）',
    badges: ['仅 App 场景', '海外区口径'],
    cycleShort: '每财月每币种一笔，财月结束后 45 天内到账',
    fit: { saas: 'no', content: 'no', app: 'yes' },
    fitHints: {
      saas: 'Apple IAP 仅针对 App 内数字商品/订阅；纯网页 SaaS 不经 App Store 分发则不产生 IAP 佣金（走 MoR/Stripe 路径）。',
      content: '内容若不经 App 内购分发则无 IAP 佣金；经 App 内购分发时按 App 场景试算。',
      app: '',
    },
    raw: {
      fees: '佣金即通道费——中国内地 App Store（iOS/iPadOS）2026-03-15 起标准 25%（原 30%）；Small Business Program / Mini Apps Partner Program 及第一年后自动续费订阅 12%（原 15%），无需签署新条款（官方公告 developer.apple.com/cn/news/?id=dadukodv 实抓 2026-10-28）；海外区 SBP 15%（年收益 ≤$100 万，超额当年转标准费率，developer.apple.com/app-store/small-business-program 实抓）；海外区标准 30%（官方原文：The commission on the sale of digital goods and services through the App Store is 30%——developer.apple.com/programs/whats-included 实抓 2026-10-30；该页费率例外脚注仅列 Brazil/EU/Japan/Netherlands/Russia/South Korea）；当年超额后标准费率仅适用于其后销售（future sales）；提现费：Apple 无提现费，官方注明『可能产生银行手续费与中间行费用』（无数字）；结汇占个人年度 5 万美元额度（上游已核事实）',
      payoutCycle: '每财月每币种一笔合并付款，财月结束后 45 天内到账；财务报告于当前财月第一个周五前发布上月数据；有最低付款门槛（金额在官方另一参考页）（官方 help 实抓 2026-10-28）',
      constraints: '仅支持一个收款银行账户（不支持分账）；25%/12% 仅适用中国内地 App Store 的 iOS/iPadOS——macOS/tvOS 及海外区不适用；SBP 资格按上一日历年收益 ≤$100 万、关联开发者账户合并计算，超额当年即转标准费率',
      source: 'https://developer.apple.com/cn/news/?id=dadukodv；https://developer.apple.com/app-store/small-business-program/；https://developer.apple.com/help/app-store-connect/getting-paid/overview-of-receiving-payments（实抓 2026-10-28）；https://developer.apple.com/programs/whats-included/（实抓 2026-10-30）',
    },
    model: {
      tiers: [             // 海外区口径（出海主场景），边际制分段计价：未超门槛部分 SBP 15%、超出部分标准 30%——非「全额跳档」
        { upTo: 1000000, pct: 0.15 },
        { upTo: Infinity, pct: 0.30 }, // 30% 出处见 raw.fees（whats-included 官方原文）
      ],
      perOrder: 0,
      monthlyFixed: 0,
      withdrawPct: 0,      // Apple 无提现费
      withdrawFixedPerEvent: 0,
      payoutsPerYear: 12,  // 每财月每币种一笔（费用为 0，仅周期语义）
    },
  },
];

/** 场景解读（结果表下方固定说明） */
export const SCENARIO_NOTES = {
  saas: 'SaaS 场景主路径：MoR（Creem / Paddle / Lemon Squeezy，费率高但代缴销售税）或 Stripe 直收+香港账户（通道费低但需香港主体、税务合规自理）。万里汇开发者账户不支持 SaaS 网站收款（官方指南封闭枚举已核，2026-10-29）。',
  app: 'App 收入典型链路分两层：① Apple IAP 佣金层（海外区 SBP 15% / 标准 30%）；② 收款提现层（万里汇开发者账户 0.7% 封顶，或银行直入）。表中各路径为单层成本——Apple 与万里汇是上下游关系、可叠加，不互斥。App 内虚拟商品不可用 Creem/Paddle/LS 直收。',
  content: '内容 / 数字商品场景与 SaaS 同构：MoR 或 Stripe 直收。Apple IAP 与万里汇开发者账户不适用。',
};

/**
 * 政策状态表【手工维护区】——直接编辑此数组即可更新页面。
 * status 取值：已核（可带括号限定，如「已核（全球官方口径）」）/ 上游已核事实 / 待复核 / 非官方口径 / 持续跟踪 / 占位——新增 status 值需同步 js/app.mjs 的 STATUS_CLASS 映射
 */
export const POLICY_STATUS = [
  { item: 'Creem 大陆身份证可开', status: '已核', note: 'supported-countries 实抓 2026-10-29：官方正文 "We support merchants in 87 countries"、表格 87 行均含 China（页面小标题 "Supported Countries (86)" 为官方页内陈旧计数）；星号条件已逐字核实：单星号仅 China，超链接至 payouts 文档 Transfer Limits 节——个人收款人=Alipay，单笔 ≤50,000 CNY、年 300,000—600,000 CNY；企业收款人=本地银行账户 Unlimited。双星号 6 国（Bangladesh/Colombia/Nepal/Pakistan/Tanzania/Ukraine）为合作方 Wise 本地转账附加限制（如仅支持个人账户），不影响大陆收款人。', asOf: '2026-10-29' },
  { item: 'Creem 支付宝提现手续费', status: '已核', note: '官方 payouts 文档未单列手续费（计算器按 $0 计）；跨币种换汇另收合作方费用，官方未给数字。', asOf: '2026-10-28' },
  { item: 'Paddle 对大陆用户关户风险', status: '非官方口径', note: '社区多源反映曾大范围关户，无官方文件佐证（out/shovel-market-research.md:148/396）。采用前自行评估风险。', asOf: '2026-10-28' },
  { item: 'Lemon Squeezy 并入 Stripe Managed Payments', status: '已核（官方宣布+实测）', note: '官方博客 2026-01-28 宣布；LS 进入维护期、迁移通道规划中；Managed Payments 为 waitlist/早access（35+ 国）。LS 是否还接新独立开发者：已实测（2026-10-29）——注册入口在线（auth.lemonsqueezy.com/register 表单可访问）、官方无停接新户声明；大陆不在银行出款国列表，仅 PayPal 出款路线（3%/笔封顶 $30），model 默认 1% 口径对大陆不适用。', asOf: '2026-10-28' },
  { item: 'Stripe Managed Payments MoR 费率', status: '非官方口径（禁用）', note: '官方文档不公布 MoR 费率；第三方流传『标准处理费 +3.5%』为非官方口径，本站计算器不得采用。', asOf: '2026-10-28' },
  { item: 'Stripe 大陆开户资格', status: '已核', note: 'stripe.com/global 实抓 46 国名单无 CN；需香港主体+香港银行账户（社区通行路径，非官方文档）。', asOf: '2026-10-28' },
  { item: 'Payoneer 费率', status: '已核（全球官方口径）', note: '官方定价页实抓（2026-10-29）：同国本币提现 1.50 USD、涉换汇提现 1.2%–4%；官方资源文跨币种提现上限 "up to 2%"（2017 发布/2026-01-16 修改，营销信息用途）——计算器 2% 即取该上限口径。中国内地走廊精确费率官方公开页均不公布（官方明示注册时审阅、登录后账户 Fees 页可见；payoneer.cn 全站无数字；help.payoneer.com 本网络 DNS 不可达，官方帮助实际托管 payoneer.custhelp.com 可达）——中国走廊子项维持待复核，开户后以账户 Fees 页为准。', asOf: '2026-10-29' },
  { item: '万里汇开发者账户场景限制', status: '已核（官方封闭枚举）', note: '官方指南实抓（2026-10-29）：开发者账号「适用于面向海外市场的应用开发者/发行商和广告代理」「主要覆盖应用市场和广告平台」；「支持的收款平台」封闭枚举仅 App Store/Facebook Audience Network/Google Admob/Google Adsense/Google Play/Steam（content/articles/developer-guide/a9aum248），无 SaaS/自建站收款入口；「不支持 SaaS 网站收款」系由官方封闭枚举+场景限定推出，官方无一字面排除句，与上游记录（out/shovel-market-research.md:150/415）一致。', asOf: '2026-10-29' },
  { item: '万里汇返佣（站点侧）', status: '已核', note: '¥1000/人、被推荐人注册后 180 天内累计入账 ≥$100——与官方开发者推荐有礼活动页逐字一致（worldfirst.com.cn/static/activity/campaign/developer-referral 实抓 2026-10-30，ICP 沪ICP备2021033667号-2 与官网同主体）：达成后下一自然月 15 日以人民币发至推荐人万里汇绑定的同名个人支付宝账号（节假日顺延）、上不封顶；推荐人须实名认证且认证主体在中国内地或中国香港；活动期=被推荐人注册 2026-07-01~2026-12-31；万里汇账户间转账不计入入账；官方保留变更/暂停/取消权。不进费率计算；回填邀请链接前再核活动是否顺延。', asOf: '2026-10-30' },
  { item: 'Creem 返佣 / 联盟条款', status: '待复核', note: '官方自家推荐计划已核实存在（docs.creem.io/features/referral-program 实抓 2026-10-30）：被推荐商家须新注册+建店+完成 KYC+结算付款 ≥$1,000 方达标；奖励一次性计入 Creem 余额，达标后 30 天内发放、另有 30 天 hold（可因退款/拒付被 Reversed）；提现走常规出款周期（1/15 日、≥$50、7-12 天）；完成 KYC 的个人 "regardless of location (subject to local laws)" 可参加——大陆个人可参加（Creem 商户大陆身份证可开已核）；官方页自相矛盾：正文 "You receive your $100 reward" vs 条款表 "Reward per referral | $50 USD"——单一金额待官方确认后方可回填占位区；条款自述 discretionary、禁止付费广告投推荐链接。creem.io/affiliates 为商家侧联盟功能（对应路径卡『联盟 2%』附加费），与本计划是两回事。', asOf: '2026-10-30' },
  { item: 'Apple 中国内地佣金新率', status: '已核', note: '2026-03-15 起中国内地 App Store（iOS/iPadOS）标准 25%、SBP/Mini Apps 及第一年后自动续费订阅 12%（官方公告实抓）。', asOf: '2026-10-28' },
  { item: 'Apple 海外区标准佣金 30%', status: '已核', note: '30% 出处：whats-included 官方原文（见 raw.fees）；SBP 门槛 $100 万按佣金后收益（sales net of Apple\'s commission and certain taxes and adjustments）计、资格按上一日历年、当年超额后标准费率仅适用于其后销售——与计算器边际制分段计价一致；以佣金前流水近似、默认上年未超限的两点披露保留', asOf: '2026-10-30' },
  { item: '个人年度结汇额度 $5 万', status: '上游已核事实', note: '所有路径回款结汇均占用个人年度 5 万美元额度；万里汇结汇额度需『平台直连或手动上传交易明细』获取。', asOf: '上游核查' },
  { item: '境外所得稽查时间线', status: '持续跟踪', note: '已核（官方原文实抓 2026-10-29，与 out/radar/manual.md §6.2 同源）：2025-03-26 上海通报补缴合计 18.48 万、2025-11-11 北京通报补缴合计 51 万、2026-01 官方提醒对 2022-2024 年度境外所得自查补正。待复核：①"2025-11 六地跟进、单人补缴最高 698.7 万"——仅二手标题级确认，未复核到官方出处，引用前必须逐字核对；②"2026-03 个税 APP 境外所得弹窗"——未复核到"弹窗"官方表述，已核的是申报入口"取得了境外所得，点击这里"。两项对应手册附录 A 问题 9/10，更新时两边同步。本站不构成税务建议，请咨询专业税务人士。', asOf: '2026-10-29' },
];
