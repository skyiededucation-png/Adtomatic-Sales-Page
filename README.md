# Adtomatic 免费 Zoom Landing Page — 上线 SOP

目标：广告 → Landing Page → 预约 Zoom → Meta 看到 **Schedule** 事件 → Ads Manager 的 Cost per Result = **Cost per Appointment**。

```
index.html      Landing Page（VSL + 底部晃动按钮 → /book）
book.html       填资料 + 选日期 / 时间 → 打开 WhatsApp 发预约讯息给 018-262 6442
thank-you.html  预约已送出 + 补发 WhatsApp 按钮 + 加进 Google Calendar + 准备清单
api/lead.js     预约送出 → Meta Conversions API（服务器端 Schedule）
js/config.js    Pixel ID / 预约 WhatsApp 号码 / 可选时段 / 休息日（只改这里）
assets/vsl.mp4  Landing Page VSL（720p，约 7MB）
```

## 追踪逻辑

| 时机 | 浏览器 Pixel | 服务器 CAPI |
|---|---|---|
| 打开任何一页 | PageView | — |
| 播放 VSL / 看到 50% / 看完 | VSLView（custom） | — |
| 点底部按钮 | InitiateCheckout | — |
| 点 WhatsApp 拿 Case Study | Contact | — |
| 打开预约页 | ViewContent | — |
| **按「确认预约 · 发送到 WhatsApp」** | **Schedule**（event_id = `bk_…`） | **Schedule**（同一个 event_id，带 hash 过的电话 + IP + UA） |

两边 event_id 一样 → Meta 只算 1 次。

⚠️ Schedule 是在客户按下按钮时算的。客户打开 WhatsApp 后**没按发送**，Meta 还是会算 1 个预约。所以每周要用 WhatsApp 实际收到的预约数对一下 Ads Manager。

## Step 1 · 改设定（js/config.js）

- `pixelId`：你的 Pixel ID
- `bookingWhatsApp`：预约讯息发去哪个号码（现在是 60182626442）
- `timeSlots`：可选时段
- `closedWeekdays`：休息日，例如 `[0]` = 星期日不开放
- 没有接 Google Calendar：同一个时段可能有两个人选到，由 setter 打电话时调整

## Step 2 · 部署到 Vercel（你做，约 5 分钟）

1. 把这个文件夹上传到一个 GitHub repo（或用 `npx vercel` 直接部署）
2. Vercel → Add New Project → 选这个 repo → Framework Preset 选 **Other** → Deploy
3. 记下网址，例如 `https://adtomatic-zoom.vercel.app`（之后可以接你自己的域名）

> ⚠️ Vercel **Hobby（免费）只限非商业用途**。测试可以，正式开广告前升级 Pro，或改放允许商用的托管。

## Step 3 · Meta 设定（你做）

1. Events Manager → 选你的 Pixel → 复制 **Pixel ID** → 填进 `js/config.js` 的 `pixelId`
2. Settings → Conversions API → **Generate access token**（不要发给任何人 / 不要贴在聊天里）
3. Vercel → Project → Settings → **Environment Variables**，加：

| Name | Value |
|---|---|
| `META_PIXEL_ID` | 你的 Pixel ID |
| `META_CAPI_TOKEN` | 刚生成的 token |
| `META_TEST_EVENT_CODE` | 测试时才填（Events Manager → Test events 里的代码），测完删掉 |

加完要 **Redeploy** 一次才生效。

## Step 5 · 测试（上线前一定要做）

1. Vercel 填好 `META_TEST_EVENT_CODE` → Redeploy
2. Events Manager → **Test events** 打开
3. 用手机打开网站 → 点按钮 → 填资料、选时间 → 按「确认预约」→ 在 WhatsApp 按发送
4. Test events 里应该看到：PageView、InitiateCheckout、ViewContent、**Schedule（Browser）** + **Schedule（Server）**，而且 Schedule 显示 *Deduplicated*
5. 检查 018-262 6442 有没有收到预约讯息；也用 Facebook / Instagram 广告预览点进来测一次（in-app browser）
6. 删掉 `META_TEST_EVENT_CODE` → Redeploy

## Step 6 · 开广告

- Campaign objective：**Sales**（或 Leads）→ Conversion location：**Website**
- Conversion event：**Schedule**
- Ads Manager 加栏位：Results（Schedule）、Cost per Result = **Cost per Appointment**
- 广告链接用 `https://你的网址/?utm_source=meta&utm_campaign=…`（fbclid 会一路带到预约页，提高 Meta 匹配率）

## 每个预约之后（手动）

- 名额数字在 3 个地方：`index.html`（零风险段、底部按钮小字）和 `book.html`，接满就更新，保持真实
- 时段被订走：在 `js/config.js` 调整 `timeSlots` / `closedWeekdays`
- Show / No-show / 成交：之后可以再加 Attended、Purchase 事件回传给 Meta，算真正的 Cost per Show / CAC
