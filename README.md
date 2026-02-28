# ラストウォー育成シミュレーター（分割版） v1.4

このフォルダは、1枚HTML（single file）を **CSS/JSに分割**した構成です。

## 構成
- index.html
- css/styles.css
- js/data.js（キャラ/装備などの定数）
- js/app.js（UI/計算ロジック）

## Cloudflare Pages（GitHub連携）想定
- Build command: （不要 / none）
- Output directory: `/`（リポジトリ直下にこのファイル群を置く場合）

もし `public/` 配下で運用したい場合は、このフォルダの中身を `public/` に移動し、
Output directory を `public` にしてください。

## ローカル確認
mac:
- `python3 -m http.server 8080`
windows:
- `py -m http.server 8080`

その後ブラウザで `http://localhost:8080` を開きます。

## 画像・アイコン
このHTMLは `tank.png` / `air.png` / `misile.png` / `karyoku.png` 等の画像を相対パス参照しています。
同じ階層（index.html と同じ場所）に置くか、パスを合わせてください。
