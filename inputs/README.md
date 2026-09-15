# 词书输入

`qwerty-learner/` 保存导入时使用的固定上游快照。运行 `npm run download:wordbooks` 可从第三方项目的固定提交重新下载，运行 `npm run import:wordbooks` 可更新主库、镜像和客户端预览数据。

不要直接在 `data/vocabulary.csv` 或生成的 `src/data/catalog.generated.ts` 中维护词条。
