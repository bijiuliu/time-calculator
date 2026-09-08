# 时间计算器 2.0

这是可直接运行的完整网页应用，支持手机浏览器和 PWA 安装。

## 打开方式

直接双击 `index.html` 可以使用主要计算功能。若需要安装到桌面、离线缓存或测试 PWA，请使用任意本地静态服务器打开项目目录。

例如：

```bash
npx serve .
```

## 完整功能

- 时间差计算与自动跨天
- 时间往前、往后推算
- 日期差计算与日期顺序自动处理
- 日期往前、往后推算
- 系统选择器与数字分项输入
- 连续累计
- 时间差结果单位切换
- 时间、日期统一历史记录
- 按今天、昨天和日期分组
- 记录筛选、复制、删除、清空和重新带入
- 默认计算器、默认模式、记录数量、外观、紧凑布局和震动反馈设置
- 深色、浅色和跟随系统外观
- 旧版记录与常用设置首次启动迁移
- PWA 安装和离线缓存

## 数据说明

所有设置和记录保存在浏览器 `localStorage` 中，不会上传到服务器。

## 图标规范

- Safari 兼容入口固定为仓库子路径下的 `favicon.ico` 与 `apple-touch-icon.png`，页面同时显式声明 32px 和 192px PNG。
- PWA 图标固定使用 `assets/icons/time-calculator-pwa-{192,512,1024}.png`，页面品牌图只使用 `time-calculator-brand.png`，二者不能混用。
- 所有 URL 使用相对路径，禁止以 `/` 开头或引用其他仓库；Manifest 保持独立的 `id`、`start_url` 与 `scope`。
- 替换图标时必须同步更新 URL 版本号、Service Worker 的 `CACHE_NAME`，并运行 `node scripts/check-icons.mjs`。
- Service Worker 只能清理 `time-calculator-` 前缀的缓存，不能删除同域其他项目的缓存。

## 版本

2.0.0
