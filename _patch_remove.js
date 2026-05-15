const fs = require('fs');
const path = '/Users/harrietmackie/Desktop/6WA/index.html';
let text = fs.readFileSync(path, 'utf8');

const rstStart = '\n\n    const resetBtn = el(\'resetBtn\');';
const exportStart = "\n\n    el('exportBtn').addEventListener('click'";
const rsi = text.indexOf(rstStart);
const exportI = text.indexOf(exportStart);
if (rsi === -1 || exportI === -1 || exportI <= rsi) {
  console.error('reset block', rsi, exportI);
  process.exit(1);
}
text = text.slice(0, rsi) + text.slice(exportI);

const startMorning = '\n\n    // Morning screen functions';
const si = text.indexOf(startMorning);
const scriptEnd = text.lastIndexOf('\n  </script>');
if (si === -1 || scriptEnd === -1 || scriptEnd <= si) {
  console.error('morning', si, scriptEnd);
  process.exit(1);
}
text =
  text.slice(0, si) +
  '\n\n    renderPresetTiles();\n    renderStatsView(false);\n    render();\n' +
  text.slice(scriptEnd);

fs.writeFileSync(path, text);
console.log('patched');
