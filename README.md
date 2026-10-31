# 出海收款到账试算站（fee-calc-site）

面向**大陆个人出海开发者**的收款路径年成本试算站。纯静态、零后端、零依赖、零构建：HTML + 原生 ES Module + 原生 CSS，计算全部在浏览器本地完成。

> ⚠️ **免责声明**：本站内容不构成税务、法律或投资建议。费率与政策可能随时变化——数据快照 **2026-10-28**（各来源官方页实抓，出处见页面路径详解卡）。重大决策请咨询专业税务/法律人士，并逐条向官方复核。

## 功能

1. **试算器**：输入月流水（USD）、客单价（USD）、场景（App / SaaS / 内容），可选高级假设（换汇/汇损 %、CNY/USD 参考汇率——仅用于限额提示，不进成本计算）。
2. **各路径年成本对比表**：覆盖 7 条路径——Creem 直收（MoR）、Paddle（MoR）、Lemon Squeezy（2026 并入 Stripe 后口径）、Stripe 直收+香港账户、Payoneer（官方口径估算）、万里汇 WorldFirst（仅 App/广告场景）、Apple IAP（App 场景）。每行给出年成本、计算公式（口径透明）、占年流水比、到账周期、适用性（✓/△/✗）与动态提示（Paddle <$10 定制价、Creem 支付宝年限额、Apple SBP 门槛、$5 万结汇额度等）。
3. **路径详解卡**：费率 / 到账周期 / 限制合规三段均为费率总表**原文**，附官方来源链接与本站计算口径说明。
4. **政策状态表（手工维护区）**：14 项已核 / 待复核 / 非官方口径事项，含境外所得稽查时间线、Stripe Managed Payments 第三方 3.5% 口径禁用声明等。
5. **显著免责声明**（置顶横幅 + 页脚全文）与**返佣/联盟占位区**（万里汇 ¥1000/人、Creem 占位、其他联盟位——均未接入真实链接）。

## 目录结构

```
fee-calc-site/
├── index.html          # 页面骨架（含置顶免责横幅、五个区块、页脚免责全文）
├── css/style.css       # 样式（无外部依赖）
├── js/data.mjs         # 费率数据单一来源：raw=总表原文；model=计算数值字段；POLICY_STATUS=政策状态手工维护区
├── js/calc.mjs         # 计算器核心（独立模块：纯函数、零 DOM，浏览器与 Node 通用）
├── js/app.mjs          # 页面渲染逻辑（DOM，计算全部委托 calc.mjs）
├── tests/calc.test.mjs # 单元测试（Node 内置 test runner，零依赖）
└── README.md
```

## 本地运行

ES Module 需要 HTTP 服务（`file://` 直接打开会因 CORS 失败）：

```bash
cd fee-calc-site
python3 -m http.server 8000     # 打开 http://127.0.0.1:8000
# 或
npx wrangler pages dev .        # Cloudflare 本地预览（与线上行为一致）
```

## 运行测试

```bash
node tests/calc.test.mjs
```

使用 Node 内置 test runner（Node ≥ 18，零依赖），共 21 个用例：费率数据与总表逐条一致性、三条典型流水（SaaS $2000/$25、App $5000/$10、内容 $800/$20）各路径年成本断言、动态规则（Paddle <$10、Creem 支付宝限额、Apple SBP 阶梯、换汇假设、结汇额度提示）、排序/健壮性/确定性。当前实跑结果：**21 pass / 0 fail**。

## Cloudflare Pages 部署

### 方式 A：Wrangler 直传（最快）

```bash
cd fee-calc-site
npx wrangler login                      # 首次需浏览器授权
npx wrangler pages deploy . --project-name=fee-calc
```

完成后得到 `https://fee-calc.pages.dev`。更新数据后重复执行最后一条命令即重新部署。

> 可选：若不想把 `tests/`、`README.md` 一起发布，先复制到 dist 再部署：
> ```bash
> mkdir -p dist && cp -R index.html css js dist/ && npx wrangler pages deploy dist --project-name=fee-calc
> ```

### 方式 B：Git 集成（自动部署）

1. 把本目录推到 GitHub/GitLab 仓库（可独立成库，或作为仓库子目录）。
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**，选中仓库。
3. 构建设置：**Framework preset = None；Build command 留空；Build output directory = `/`**（若仓库根不是本目录，则填 `/fee-calc-site`）。
4. Save and Deploy。此后每次 push 自动重新部署，Pull Request 自动生成预览 URL。

### 自定义域名与大陆访问

- Dashboard → 该 Pages 项目 → **Custom domains** 添加自有域名，按提示加 CNAME（免费计划即可）。
- `*.pages.dev` 域名从大陆直连可能间歇性不稳定；绑定自定义域名通常可改善。站点无后端，大陆访问延迟只影响首屏静态资源加载。

### 更新费率 / 政策状态

只改 `js/data.mjs`：

- `PATHS[].raw.*`：与费率总表逐条对应的原文（改前须官方页实抓核对）；
- `PATHS[].model.*`：计算器数值字段（仅从 raw 同源数字提取，禁止引入非官方口径）；
- `POLICY_STATUS`：政策状态表手工维护区（增删行即可）。

改完跑 `node tests/calc.test.mjs`——数据一致性断言（含「禁用 3.5% 第三方口径」检查）会拦截与总表不符的改动。

## 计算口径（摘要）

年成本 = 年流水 × 通道费率 + 年笔数 × 单笔费 + 月费×12 + 年流水 × 提现费率 + 年出款次数 × 单次提现费 + 年流水 × 换汇假设%。

- 官方**未给数字**的项目（Creem 支付宝提现手续费、各路径换汇费、万里汇点差等）一律按 0 计并在结果行注明；
- **非官方口径费率一律不采用**（如 Stripe Managed Payments 第三方流传 +3.5%）；
- Payoneer 2% 为官方资源文跨币种提现上限口径（官方定价页涉换汇提现区间 1.2%–4%；中国内地走廊精确费率官方不公布），计算结果带「官方口径估算」徽章且不参与最低成本推荐；
- Apple 按海外区口径**边际制分段计价**：未超 SBP 门槛部分 15%、仅超出部分按标准 30%（非「全额跳档」）；门槛按官方口径为佣金后「收益」，计算器以佣金前流水近似、并默认上年未超限——两处近似在结果行提示中披露，中国内地 25%/12% 在详解卡列明。

## TODO

- [ ] Payoneer 中国内地走廊精确提现费率回填：官方公开页均不公布（全球口径已核 2026-10-29——定价页 1.2%–4%、资源文跨币种上限 "up to 2%"），开户后从账户 Fees 页回填。
- [x] 万里汇「不支持 SaaS 网站收款」向官方逐字确认——2026-10-29 已核：官方指南「支持的收款平台」封闭枚举（App Store/FAN/AdMob/AdSense/Google Play/Steam）无 SaaS/自建站入口。
- [x] Creem supported-countries『星号条件』原文逐条向官方 docs 确认——2026-10-29 已核（单星号仅 China：Alipay 限额；双星号 6 国为 Wise 附加限制）。
- [x] Lemon Squeezy『是否还接新独立开发者』实测——2026-10-29 注册入口实测在线（auth.lemonsqueezy.com/register 表单可访问；未提交完整开户）。
- [x] Apple 海外区标准佣金 30% 的官方页数字复核——2026-10-30 已核：developer.apple.com/programs/whats-included 原文 "The commission … is 30%"。
- [ ] 回填返佣/联盟占位链接（回填前与官方最新条款核对；外链加 `rel="sponsored nofollow"` 并公示佣金关系）。
- [ ] 政策状态表人工定期复查：境外所得稽查时间线（2025-03 → 2025-11 → 2026-03 之后）、各费率页季度复核。
