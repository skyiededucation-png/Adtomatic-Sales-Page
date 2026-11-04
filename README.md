# Adtomatic 免费 Zoom Landing Page — 上线 SOP

目标：广告 → Landing Page → 预约 Zoom → Meta 看到 **Schedule** 事件 → Ads Manager 的 Cost per Result = **Cost per Appointment**。

```
index.html      Landing Page（底部晃动按钮 → /book）
book.html       Cal.com 选时间 + 填资料
thank-you.html  预约成功 + 加进 Google Calendar 按钮
api/cal-webhook.js  Cal.com 预约成功 → Meta Conversions API（服务器端 Schedule）
js/config.js    Pixel ID / Cal.com 链接 / WhatsApp 链接（只改这里）
```

## 追踪逻辑（为什么数据会准）

| 时机 | 浏览器 Pixel | 服务器 CAPI |
|---|---|---|
| 打开任何一页 | PageView | — |
| 点底部按钮 | InitiateCheckout | — |
| 点 WhatsApp 拿 Case Study | Contact | — |
| 打开预约页 | ViewContent | — |
| **预约成功** | **Schedule**（event_id = `cal_<booking uid>`） | **Schedule**（同一个 event_id，带 hash 过的 email + 电话） |

两边 event_id 一样 → Meta 自动去重，只算 1 次预约。浏览器被挡掉时，服务器那一份照样算。

---

## Step 1 · Cal.com 设定（你做）

1. Settings → Calendars：确认已连接 Google Calendar，「Add to calendar」选你的主 Calendar
2. 打开 event `skyied-client-appt-booking`：
   - 时长 **45 分钟**，地点 **Zoom**（Apps 里先装 Zoom）
   - Availability：只开你们真的能接的时段
   - **Advanced → Booking questions**，加这几个（勾 Required）：
     - 名字、Email（默认就有）
     - **Phone number 类型**，label 写「WhatsApp 号码」← 一定要用 Phone 类型，CAPI 才认得到
     - 「你的行业」（Select：装修 / 地产 / 贷款 / 教育培训 / 餐饮 / 其他）
     - 「目前广告的 Cost Per Lead，或生意上遇到的挑战和问题」（Long text）
   - Limits：限制每天 / 每周最多几个，配合「每月 5 个名额」
3. **不要**开 Redirect on Booking（预约页已经自己处理跳转）

## Step 2 · 部署到 Vercel（你做，约 5 分钟）

1. 把这个文件夹上传到一个 GitHub repo（或用 `npx vercel` 直接部署）
2. Vercel → Add New Project → 选这个 repo → Framework Preset 选 **Other** → Deploy
3. 记下网址，例如 `https://adtomatic-zoom.vercel.app`（之后可以接你自己的域名）

> ⚠️ Vercel **Hobby（免费）只限非商业用途**。测试可以，正式开广告前升级 Pro，或改放允许商用的托管。

## Step 3 · Meta 设定（你做）

1. Events Manager → 选你的 Pixel → 复制 **Pixel ID** → 填进 `js/config.js` 的 `pixelId`，重新部署
2. Settings → Conversions API → **Generate access token**（不要发给任何人 / 不要贴在聊天里）
3. Vercel → Project → Settings → **Environment Variables**，加：

| Name | Value |
|---|---|
| `META_PIXEL_ID` | 你的 Pixel ID |
| `META_CAPI_TOKEN` | 刚生成的 token |
| `CAL_WEBHOOK_SECRET` | 自己想一串长密码（下一步 Cal.com 也填同一串） |
| `META_TEST_EVENT_CODE` | 测试时才填（Events Manager → Test events 里的代码），测完删掉 |

加完要 **Redeploy** 一次才生效。

4. Business Settings → Brand safety → Domains：验证你的域名（用自己域名时）

## Step 4 · 接 Cal.com Webhook（你做）

Cal.com → Settings → Developer → **Webhooks → New**
- Subscriber URL：`https://你的网址/api/cal-webhook`
- Event triggers：只勾 **Booking Created**
- Secret：填和 `CAL_WEBHOOK_SECRET` 一样的那串
- 按 Ping test → 应该显示 200

## Step 5 · 测试（上线前一定要做）

1. Vercel 填好 `META_TEST_EVENT_CODE` → Redeploy
2. Events Manager → **Test events** 打开
3. 用手机打开网站 → 点按钮 → 真的 book 一个时间
4. Test events 里应该看到：PageView、InitiateCheckout、ViewContent、**Schedule（Browser）** + **Schedule（Server）**，而且 Schedule 显示 *Deduplicated*
5. 检查 Google Calendar 有没有出现这个预约、你邮箱有没有收到邀请
6. 删掉 `META_TEST_EVENT_CODE` → Redeploy → 去 Cal.com 取消测试预约

## Step 6 · 开广告

- Campaign objective：**Sales**（或 Leads）→ Conversion location：**Website**
- Conversion event：**Schedule**
- Ads Manager 加栏位：Results（Schedule）、Cost per Result = **Cost per Appointment**
- 广告链接用 `https://你的网址/?utm_source=meta&utm_campaign=…`（参数会一路带到 Cal.com）

## 每个预约之后（手动）

- 名额数字在 3 个地方：`index.html`（零风险段、底部按钮小字）和 `book.html`，接满就更新，保持真实
- Show / No-show / 成交：之后可以再加 Attended、Purchase 事件回传给 Meta，算真正的 Cost per Show / CAC

## 已知限制

- `metadata[fbp] / [fbc] / [ua]` 是通过 Cal.com 嵌入参数带进预约的；如果 Cal.com 没保存这些，CAPI 仍然会用 hash 过的 email + 电话匹配，只是匹配率略低，事件会改用 `system_generated` 来源发送。上线测试时在 Test events 看 Server 事件的 Event Match Quality。
- Meta Graph API 版本默认 `v23.0`；Meta 淘汰旧版本时，在 Vercel 加 `META_API_VERSION` 改新版本即可。
