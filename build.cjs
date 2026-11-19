const fs = require('node:fs');
const path = require('node:path');
const dir = __dirname;
const upstream = dir;
const read = (file, root = dir) => fs.readFileSync(path.join(root,file),'utf8');
const data = fs.readFileSync(path.join(upstream,'data/beijing.json.gz')).toString('base64');
const notice = read('vendor/LICENSE.txt',upstream).replaceAll('*/','* /');
const engine = read('vendor/maplibre-gl.js',upstream).replace(/\n\/\/# sourceMappingURL=.*$/m,'');
const parts = {
  CSS:read('style.css'),
  MAPLIBRE:'/*\n'+notice+'\n*/\n'+engine,
  BASE:read('src/basemap.js',upstream).replace('/*__MAP_DATA__*/',data),
  MARKERS:read('src/hotel-markers.js',upstream),
  APP:read('app.js'),
};
let html = read('page.html');
for(const [key,value] of Object.entries(parts)){
  const token = '/*__'+key+'__*/';
  if(html.split(token).length !== 2) throw new Error('Missing unique token '+token);
  html = html.replace(token,()=>key==='CSS'?value:value.replace(/<\/script/gi,'<\\/script'));
}
fs.writeFileSync(path.join(dir,'index.html'),html);
console.log('Built index.html');
