import fs from 'node:fs';
import path from 'node:path';
import {
  getFeatureRegistry,
  getMainNavigationItems,
  getAccountNavigationItems,
  type FeatureId
} from '@/lib/services/core/featureComposition';

const repositoryRoot = process.cwd();
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

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

describe('Feature Composition Registry', () => {
  it('contains the required removable feature ids', () => {
    const expectedFeatureIds: FeatureId[] = [
      'staff',
      'contracts',
      'loans',
      'orders',
      'wineFeatures',
      'wineAging',
      'vineyard',
      'winery'
    ];

    const registered = new Set(getFeatureRegistry().map((feature) => feature.id));
    const missing = expectedFeatureIds.filter((featureId) => !registered.has(featureId));
    expect(missing).toEqual([]);
  });

  it('provides deterministic nav composition', () => {
    const mainNav = getMainNavigationItems();
    const accountNav = getAccountNavigationItems();

    expect(mainNav.length).toBeGreaterThan(0);
    expect(accountNav.length).toBeGreaterThan(0);
    expect(mainNav.map((item) => item.pageId)).toEqual([
      'dashboard',
      'finance',
      'staff',
      'vineyard',
      'winery',
      'sales'
    ]);
  });

  it('allows multi-facade orchestration only from composition layer', () => {
    const files = collectSourceFiles(path.join(repositoryRoot, 'src'));
    const allowedOrchestrators = new Set([
      'src/lib/services/core/featureComposition.ts'
    ]);

    const violations: string[] = [];

    for (const filePath of files) {
      const source = fs.readFileSync(filePath, 'utf8');
      const imports = extractImportSpecifiers(source);
      const importedFacades = new Set(
        imports
          .map((importSpecifier) => {
            const match = importSpecifier.match(/^@\/lib\/services\/facades\/([^/'"]+)/);
            return match?.[1];
          })
          .filter((value): value is string => Boolean(value))
      );

      if (importedFacades.size > 1) {
        const relativePath = toPosixPath(path.relative(repositoryRoot, filePath));
        if (!allowedOrchestrators.has(relativePath)) {
          violations.push(`${relativePath} imports ${Array.from(importedFacades).join(', ')}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
