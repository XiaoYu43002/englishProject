# 第三方资源说明

## Qwerty Learner wordbooks

- 项目：https://github.com/RealKai42/qwerty-learner
- 拉取渠道：`cdn.jsdelivr.net/gh/RealKai42/qwerty-learner@master/public/dicts/`
- 使用文件：
  - `ChuZhongluan_2_T.json`（初中）
  - `ZhongKaoHeXin.json`（中考）
  - `GaoKao_3500.json`（高考）
  - `CET4_T.json` / `CET6_T.json`（四六级）
  - `Level4luan_2_T.json`（专四）
  - `KaoYan_2024.json`（考研）
  - `IELTS_3_T.json` / `TOEFL_3_T.json` / `SAT_3_T.json`
  - `GRE_1500.json` / `GRE3000_3_T.json`
  - `BEC_2_T.json`（商务英语）
- 上游许可证：GNU General Public License v3.0
- 许可证副本：`third_party/qwerty-learner.LICENSE`

本项目仅对上述词书进行字段规范化、去重、词书归属整理和初步语义分类。若用于商业发布，请结合你的发布方式复核上游数据来源、许可证义务及目标市场的合规要求。

## 有道智云

有道智云接口未附带任何密钥或抓取内容。本项目仅提供官方 HTTPS API 的服务端调用适配器。使用者需要自行申请应用 ID、应用密钥并遵守有道智云的服务协议、计费和内容使用要求。

## RapidOCR

- 项目：https://github.com/RapidAI/RapidOCR
- 用途：服务端图片文字检测、方向分类和中英文识别
- 推理后端：ONNX Runtime（CPU）
- 上游许可证：Apache License 2.0

本项目只提供 RapidOCR 的调用服务和版本范围，Python 依赖由部署者根据
`ocr_service/requirements.txt` 安装，并未将模型或第三方 Python wheel
直接打入源码包。RapidOCR 使用的识别模型源自 PaddleOCR；发布时仍应保留
相关项目的许可证及模型说明。

## PaddleOCR

- 项目：https://github.com/PaddlePaddle/PaddleOCR
- 用途：RapidOCR 默认 OCR 模型的上游来源
- 上游许可证：Apache License 2.0
