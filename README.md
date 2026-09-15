# 知觅英语 uni-app V1.2

从 Figma `02 · Mobile Prototype V1` 延展实现的跨端英语学习项目。一套
`uni-app + Vue 3 + TypeScript + Pinia` 代码同时面向微信小程序、
Android App 和 H5。

## V1.2 能力

- 拍照或从相册选择英文书页，调用 RapidOCR 提取候选单词
- OCR 候选词去重、噪声过滤、置信度展示和手动勾选确认
- 命中本地 7361 词主库后返回中文释义、音标和 12 类语义路径
- 未命中的新词标记“待核”，加入个人生词本后可用有道智云补充释义与发音
- 确认后的词可分别加入“今日学习”或“我的生词”，并本地持久化
- 开源词书扩展：初中、中考、高考、CET-4/6、专四、考研、雅思、托福、SAT、GRE、BEC 等（源自 Qwerty Learner）
- 服务端限制图片类型、8 MB 大小和 2400 万像素；图片只在内存中处理，不落盘

## 为什么选 RapidOCR

项目需要同时识别中文页面和英文单词，并运行在普通 CPU 服务器或开发电脑上。
RapidOCR 基于 PaddleOCR 模型，默认可通过 ONNX Runtime 在 CPU 推理，
部署体积与复杂度都比完整训练框架更适合当前阶段。OCR 放在服务端，避免把模型
塞进小程序分包，也让 Android 和微信端共用同一个接口。

## 最快启动（推荐 Docker）

准备 Node.js 20/22、Docker Desktop，然后在项目目录执行：

```bash
npm install
docker compose up --build
```

另开终端：

```bash
npm run dev:h5
```

浏览器访问终端显示的地址，通常是 `http://localhost:5173`。
Node API 为 `http://localhost:8787`，OCR 为 `http://localhost:8790`。

## Windows 本地启动（不用 Docker）

建议安装 Python 3.11。首次安装会下载 RapidOCR、ONNX Runtime 及模型，
需要联网，第一次识别也可能比后续更慢。

终端 1：

```bat
py -3.11 -m venv .venv
.venv\Scripts\activate
python -m pip install -r ocr_service\requirements.txt
npm run dev:ocr
```

终端 2：

```bat
copy .env.example .env
npm run dev:server
```

终端 3：

```bat
npm run dev:h5
```

健康检查：

- `http://localhost:8790/health`：RapidOCR 服务
- `http://localhost:8787/api/ocr/status`：客户端实际经过的代理链路
- `http://localhost:8787/health`：词库与有道代理

如果只运行 `npm run dev:h5`，词书仍可离线预览，但拍照识词需要同时启动
OCR 和 Node API。

## 环境配置

复制 `.env.example` 为 `.env`。有道应用密钥只放服务端：

```env
VITE_API_BASE_URL=http://localhost:8787
YOUDAO_APP_KEY=你的应用ID
YOUDAO_APP_SECRET=你的应用密钥
OCR_SERVICE_URL=http://127.0.0.1:8790
```

密钥由 `server/index.mjs` 生成 v3 签名，不会打进 H5、小程序或 Android
客户端。未配置有道时优先使用本地词义；配置后打开单词详情会获取有道释义、
音标和音频。正式环境必须用 HTTPS，并限制 `CORS_ORIGIN`。

## OCR 数据流

```text
相机/相册 → Node 上传代理 → RapidOCR → 英文候选词过滤
          → 本地主词库匹配 → 用户勾选确认 → 今日学习/我的生词
                                      ↘ 未命中词标记待核
```

照片不会写入磁盘。OCR 结果不会自动进词书，必须由用户确认。纯数字、网址片段、
单字符噪声会被过滤，同一图片里的重复单词只保留置信度最高的一项。

## 微信小程序

1. 将 `src/manifest.json` 中 `mp-weixin.appid` 换成真实 AppID。
2. 将正式 HTTPS API 域名加入微信公众平台的 request/uploadFile 合法域名。
3. 开发与构建：

```bash
npm run dev:mp-weixin
npm run build:mp-weixin
```

微信开发者工具分别导入 `dist/dev/mp-weixin` 或
`dist/build/mp-weixin`。相机权限说明已在 manifest 中配置。

## Android App

1. 在 DCloud 申请 uni-app AppID，替换 manifest 顶层 `appid`。
2. 修改 Android 包名、证书和正式 API 地址。
3. 调试或构建：

```bash
npm run dev:app
npm run build:app
```

使用 HBuilderX 运行到真机，或通过“发行 → 原生 App-云打包”生成 APK/AAB。
manifest 已包含相机、联网及分版本相册读取权限。

## 词库数据

```text
inputs/
  qwerty-learner/         固定版本的上游原始词书
taxonomy/
  taxonomy.json           固定 12 类语义骨架
data/
  vocabulary.json         唯一词汇主库
  vocabulary.csv          主库 CSV 镜像
  wordbooks.json          词书元数据与词序
outputs/
  html/vocabulary_map.html
  review/needs_review.csv
```

数据流程固定为：

```text
inputs → taxonomy/taxonomy.json → data/vocabulary.json → outputs/html/vocabulary_map.html
```

重新同步或只重新生成：

```bash
npm run sync:wordbooks
npm run import:wordbooks
```

## 项目目录

```text
src/             uni-app 客户端
server/          词库、有道与 OCR 上传代理
ocr_service/     FastAPI + RapidOCR 服务
tests/           OCR 文本过滤测试
data/            完整词汇主库
taxonomy/        12 类语义结构
docker-compose.yml
```

## 检查与构建

```bash
npm run test:ocr
npm run type-check
npm run build:h5
npm run build:mp-weixin
npm run build:app
```

开源来源与许可证见 `THIRD_PARTY_NOTICES.md`。
