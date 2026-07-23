import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/app/admin/events/page.tsx';
let content = readFileSync(filePath, 'utf-8');

const oldSyntax = '<div className="flex border-b border-slate-100 px-4 overflow-x-auto sm:overflow-x-visible gap-1">';
const newSyntax = '<div className="flex border-b border-slate-100 px-4 overflow-x-auto overflow-y-hidden sm:overflow-visible gap-1 [&::-webkit-scrollbar]:hidden">';

if (content.includes(oldSyntax)) {
  content = content.replace(oldSyntax, newSyntax);
  writeFileSync(filePath, content, 'utf-8');
  console.log('Successfully added overflow-y-hidden and hidden scrollbar to tabs!');
} else {
  console.log('Could not find the old syntax.');
}
