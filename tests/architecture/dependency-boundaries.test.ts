import fs from 'node:fs';
import path from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const repositoryRoot = process.cwd();

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

    const extension = path.extname(entry.name);
    if (SOURCE_EXTENSIONS.has(extension)) {
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
    let match: RegExpExecArray | null = regex.exec(fileContent);
    while (match) {
      imports.add(match[1]);
      match = regex.exec(fileContent);
    }
  }

  return Array.from(imports);
}

function findViolations(
  files: string[],
  isViolation: (importSpecifier: string, filePath: string) => boolean
): string[] {
  const violations: string[] = [];

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8');
    const imports = extractImportSpecifiers(source);

    for (const importSpecifier of imports) {
      if (isViolation(importSpecifier, filePath)) {
        violations.push(`${toPosixPath(path.relative(repositoryRoot, filePath))} -> ${importSpecifier}`);
      }
    }
  }

  return violations;
}

describe('Architecture Dependency Boundaries', () => {
  it('components/hooks do not import database directly', () => {
    const files = [
      ...collectSourceFiles(path.join(repositoryRoot, 'src/components')),
      ...collectSourceFiles(path.join(repositoryRoot, 'src/hooks'))
    ];

    const violations = findViolations(files, (importSpecifier) => importSpecifier.includes('/database'));
    expect(violations).toEqual([]);
  });

  it('services do not import hooks or components', () => {
    const files = collectSourceFiles(path.join(repositoryRoot, 'src/lib/services'));
    const violations = findViolations(
      files,
      (importSpecifier) =>
        importSpecifier.includes('/hooks') ||
        importSpecifier.includes('/components')
    );

    expect(violations).toEqual([]);
  });

  it('database layer does not import services/hooks/components', () => {
    const files = collectSourceFiles(path.join(repositoryRoot, 'src/lib/database'));
    const violations = findViolations(
      files,
      (importSpecifier) =>
        importSpecifier.includes('/services') ||
        importSpecifier.includes('/hooks') ||
        importSpecifier.includes('/components')
    );

    expect(violations).toEqual([]);
  });

  it('deep internal imports stay within their owning feature', () => {
    const files = collectSourceFiles(path.join(repositoryRoot, 'src'));
    const violations: string[] = [];

    for (const filePath of files) {
      const source = fs.readFileSync(filePath, 'utf8');
      const imports = extractImportSpecifiers(source);
      const normalizedFilePath = toPosixPath(filePath);

      const importerServiceFeatureMatch = normalizedFilePath.match(/\/src\/lib\/services\/([^/]+)\//);
      const importerDatabaseFeatureMatch = normalizedFilePath.match(/\/src\/lib\/database\/([^/]+)\//);

      for (const importSpecifier of imports) {
        const serviceInternalMatch = importSpecifier.match(/^@\/lib\/services\/([^/]+)\/internal\//);
        if (serviceInternalMatch) {
          const importedFeature = serviceInternalMatch[1];
          const importerFeature = importerServiceFeatureMatch?.[1];
          if (importerFeature !== importedFeature) {
            violations.push(
              `${toPosixPath(path.relative(repositoryRoot, filePath))} -> ${importSpecifier}`
            );
          }
        }

        const databaseInternalMatch = importSpecifier.match(/^@\/lib\/database\/([^/]+)\/internal\//);
        if (databaseInternalMatch) {
          const importedFeature = databaseInternalMatch[1];
          const importerFeature = importerDatabaseFeatureMatch?.[1];
          if (importerFeature !== importedFeature) {
            violations.push(
              `${toPosixPath(path.relative(repositoryRoot, filePath))} -> ${importSpecifier}`
            );
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
