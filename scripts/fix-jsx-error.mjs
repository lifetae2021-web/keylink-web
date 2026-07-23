import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/app/admin/events/page.tsx';
let content = readFileSync(filePath, 'utf-8');

const oldSyntax = `                  </p>
                </div>
              </div>

              {/* 테스트 기수 여부 (v10.0.0) */}`;

const newSyntax = `                  </p>
                </div>

              {/* 테스트 기수 여부 (v10.0.0) */}`;

if(content.includes(oldSyntax)) {
  content = content.replace(oldSyntax, newSyntax);
  writeFileSync(filePath, content, 'utf-8');
  console.log('Successfully fixed JSX syntax error!');
} else {
  console.log('Could not find the old syntax.');
}
