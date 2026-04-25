
import fs from 'fs';

const content = fs.readFileSync('src/app/admin/events/page.tsx', 'utf8');
const lines = content.split('\n');

let balance = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let lineBalance = 0;
  for (const char of line) {
    if (char === '(') { balance++; lineBalance++; }
    if (char === ')') { balance--; lineBalance--; }
    if (balance < 0) {
      console.log(`Balance dropped below zero at line ${i + 1}: ${line.trim()}`);
      balance = 0; // reset
    }
  }
}
console.log(`Final balance: ${balance}`);
