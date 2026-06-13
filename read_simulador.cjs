const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'SIMULADOR_SUELDO_LIQUIDO_V18.xlsx');
try {
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  console.log("Sheet names:", sheetNames);
  
  sheetNames.forEach(sheetName => {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    
    // Print the first 40 rows to see the structure and formulas
    for(let i = 0; i < Math.min(40, data.length); i++) {
       console.log(`Row ${i+1}:`, data[i].filter(cell => cell !== '').join(' | '));
    }
  });
} catch (e) {
  console.error(e);
}
