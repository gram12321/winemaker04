import fs from 'node:fs';
import path from 'node:path';

const repositoryRoot = process.cwd();
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

function collectSourceFiles(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) return [];

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(absolutePath));
      continue;
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(absolutePath);
    }
  }

  return files;
}

function extractImportSpecifiers(fileContent: string): string[] {
  const imports = new Set<string>();
  const importFromRegex = /import[\s\S]*?from\s*['"]([^'"]+)['"]/g;
  const importOnlyRegex = /import\s*['"]([^'"]+)['"]/g;
  const dynamicImportRegex = /import\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const regex of [importFromRegex, importOnlyRegex, dynamicImportRegex]) {
    let match = regex.exec(fileContent);
    while (match) {
      imports.add(match[1]);
      match = regex.exec(fileContent);
    }
  }

  return Array.from(imports);
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

describe('Feature Ownership Boundaries', () => {
  it('services use feature-owned database namespaces instead of legacy database path buckets', () => {
    const files = collectSourceFiles(path.join(repositoryRoot, 'src/lib/services'));
    const violations: string[] = [];

    for (const filePath of files) {
      const source = fs.readFileSync(filePath, 'utf8');
      const imports = extractImportSpecifiers(source);
      const relativePath = toPosixPath(path.relative(repositoryRoot, filePath));

      for (const importSpecifier of imports) {
        if (
          importSpecifier.includes('/database/activities/') ||
          importSpecifier.includes('/database/customers/') ||
          importSpecifier.includes('/database/sales/') ||
          importSpecifier.includes('/database/core/loansDB') ||
          importSpecifier.includes('/database/core/lendersDB') ||
          importSpecifier.includes('/database/core/transactionsDB') ||
          importSpecifier.includes('/database/core/staffDB') ||
          importSpecifier.includes('/database/core/teamDB') ||
          importSpecifier.includes('/database/core/usersDB') ||
          importSpecifier.includes('/database/core/userSettingsDB') ||
          importSpecifier.includes('/database/core/companiesDB') ||
          importSpecifier.includes('/database/core/highscoresDB') ||
          importSpecifier.includes('/database/core/achievementsDB') ||
          importSpecifier.includes('/database/core/researchUnlocksDB') ||
          importSpecifier.includes('/database/core/wineLogDB')
        ) {
          violations.push(`${relativePath} -> ${importSpecifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('service database imports are limited to approved feature namespace barrels', () => {
    const files = collectSourceFiles(path.join(repositoryRoot, 'src/lib/services'));
    const approvedPrefixes = [
      '@/lib/database/activity',
      '@/lib/database/finance',
      '@/lib/database/prestige',
      '@/lib/database/research',
      '@/lib/database/sales',
      '@/lib/database/user',
      '@/lib/database/vineyard',
      '@/lib/database/wine',
      '@/lib/database/core/supabase',
      '@/lib/database/core/notificationsDB'
    ];

    const violations: string[] = [];

    for (const filePath of files) {
      const source = fs.readFileSync(filePath, 'utf8');
      const imports = extractImportSpecifiers(source);
      const relativePath = toPosixPath(path.relative(repositoryRoot, filePath));

      for (const importSpecifier of imports) {
        if (!importSpecifier.includes('@/lib/database/')) continue;

        if (!approvedPrefixes.some((prefix) => importSpecifier.startsWith(prefix))) {
          violations.push(`${relativePath} -> ${importSpecifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('shared types barrel is only a re-export surface', () => {
    const typesFilePath = path.join(repositoryRoot, 'src/lib/types/types.ts');
    const source = fs.readFileSync(typesFilePath, 'utf8');

    expect(source).not.toMatch(/^\s*(export\s+)?interface\s+\w+/m);
    expect(source).not.toMatch(/^\s*(export\s+)?enum\s+\w+/m);
    expect(source).not.toMatch(/^\s*(export\s+)?type\s+\w+/m);
  });
});
