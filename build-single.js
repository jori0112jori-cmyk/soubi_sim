// build-single.js
// node build-single.js
// 分割版(index.html/css/js)から、単一HTML(single file)を生成します。
const fs = require('fs');
const path = require('path');

const root = __dirname;
const htmlPath = path.join(root, 'index.html');
const cssPath  = path.join(root, 'css', 'styles.css');
const dataPath = path.join(root, 'js', 'data.js');
const appPath  = path.join(root, 'js', 'app.js');

let html = fs.readFileSync(htmlPath, 'utf8');
const css  = fs.readFileSync(cssPath, 'utf8');
const data = fs.readFileSync(dataPath, 'utf8');
const app  = fs.readFileSync(appPath, 'utf8');

// CSS link -> inline
html = html.replace(
  /<link\s+rel="stylesheet"\s+href="css\/styles\.css">\s*/i,
  `<style>\n${css}\n</style>\n`
);

// JS includes -> inline
html = html.replace(
  /<script\s+src="js\/data\.js"><\/script>\s*<script\s+src="js\/app\.js"><\/script>/i,
  `<script>\n${data}\n\n${app}\n</script>`
);

const out = path.join(root, 'single.html');
fs.writeFileSync(out, html, 'utf8');
console.log('wrote:', out);
