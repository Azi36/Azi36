# azi36.com 主站

纯静态站，没有构建步骤：改完 HTML/CSS/JS 直接推。发布由
`.github/workflows/deploy.yml` 做——推上 main 后体检通过才上线，大概半分钟。
**体检不过就不发布**，线上维持上一版。所以推 main 就是发布，别把半成品推上来。

产品各有各的仓库，主站只放站点本身：
Az-term → `Azi36/Az-terminal-tools`，Az-im → `Azi36/Az-image-tools`。

## 提交前必跑

```
node tools/check.mjs
```

这是全站体检，不过就别推。它会查：每个页面的共享资源**版本号是否全站一致**
（不一致会让 CDN 缓存出两份）、head 必备项、分享卡片、五个频道的导航和页脚有没有漏、
深浅色开关、404 只能用绝对路径、站内链接指向的文件存不存在、有没有占位文案漏出去、
栏目标题里的计数跟实际条目数对不对得上，以及**深色规则是否成对**。

加了新页面：在 `tools/check.mjs` 的 `PAGES` 里补一行，其余检查自动覆盖。

本地跑的时候日报页会跳过（产物不在 main，见下），CI 里取回日报之后跑的那次才是全量。

## 两条最容易犯的错

1. **改了 `assets/style.css` 或 `site.js`，就得把所有页面引用它的 `?v=` 一起加一**，
   所有页面必须完全一致——漏一个，那一页会拿到旧缓存。（日报页由 `tools/daily.mjs` 生成，
   版本号从 `index.html` 读，首页加一它自动跟上。）

2. **深色模式的规则必须成对写**，而且两条内容逐行一致：
   ```css
   :root[data-theme="dark"] .foo { ... }
   @media (prefers-color-scheme: dark) {
     :root:not([data-theme="light"]) .foo { ... }
   }
   ```
   一条走属性（手动开关），一条走媒体查询（跟随系统），CSS 没法合成一条。
   `check.mjs` 会比对，只改一处会被拦下。

## 设计语言

颜色、圆角、阴影、缓动一律用 `assets/style.css` 里的 CSS 变量，不自己发明。
频道换装靠给 `<body>` 加类（`ch-orange` / `ch-green` / `ch-pink` / `ch-purple`），
每个频道写两套值：`--xx` 给浅色，`--dk-xx` 给深色，深色映射规则统一在文件上方，
加频道只改一处。

产品卡（`.prod`）**不是一个模板换文字**：共用的只有外框、编号水印、底栏和主色变量，
每个产品的「脸」（`.prod-face`）各长各的：色阶、终端、图片、区块链。加新产品就在
`.prod[data-p="xx"]` 里给一组 `--prod-accent` / `--dk-prod-accent`，再给它写一张自己的脸。
首页只放最新三个（`.showcase`），全部清单和访问量在 `products/`。

日报（`daily/ai`、`daily/crypto`）由 `.github/workflows/daily.yml` 每天 08:30 跑 `tools/daily.mjs`
生成，**产物不在 main**：它推到 `daily-data` 这个孤立分支，发布时才被取回 `daily/` 合进站点。
不这么绕的话一天一条提交，main 的历史很快就只剩日报了。
所以本地 `daily/` 是空的（已 gitignore），想看长什么样自己跑一次 `node tools/daily.mjs all`。
别手改生成物；要改长相改 `style.css` 的「日报页」块，要改内容改脚本。
