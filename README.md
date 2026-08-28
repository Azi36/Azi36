# daily-data

azi36.com 的日报产物，由 main 分支的 `tools/daily.mjs` 每天早上生成。

这个分支不是给人读的：发布时 `.github/workflows/deploy.yml` 会把它 checkout 到
站点的 `daily/` 目录，跟 main 的源码合起来发出去。单独放一个分支，是为了让 main
的历史只留人写的提交——日报一天一条，很快就把它淹了。

**别在这儿手改文件**，下一次生成会盖掉。站点源码和生成脚本都在 main。
