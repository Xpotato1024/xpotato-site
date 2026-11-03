# 旧mediaの保全専用

現行サイトの公開ディレクトリは`apps/site/public`。ここへ新しい素材やrobotsを追加しない。

この旧rootには9 raster（photo/screenshot等）のGitコピーを保持する。ownerはlegacy media migration。固定Gitから読めるだけでは実R2の保護・復旧の成立を代用できないため、public/protection receipt/compact recovery bindingと代表復元SHAが揃うまでこの9件は削除しない。

SVG7件と旧robotsは、[ADR-0066](../docs/design/adr/0066-reproducible-repository-copy-retirement.md)の124 frozen text/configコピー撤去対象。現在は実削除確認待ち。記事のhold解除や本番転送の成立とは別であり、ここにファイルがあることも公開の証明ではない。

正確な配置・再現入口は[所有表](../docs/operations/repository-ownership.md)を参照。
