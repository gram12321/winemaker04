/**
 * Test Viewer - Extracts and displays test information
 * Standalone viewer that reads test files and displays scenarios
 */

// Test file paths relative to project root
const TEST_FILES = [
  'tests/vineyard/yieldCalculator.test.ts',
  'tests/vineyard/grapeSuitability.test.ts',
  'tests/finance/wageService.test.ts',
  'tests/finance/loanService.test.ts',
  'tests/wine/fermentationCharacteristics.test.ts',
  'tests/activity/workCalculator.test.ts'
];

async function fetchTestFile(path) {
  try {
    // Try to fetch from the file system (works if viewer is served from project root)
    const response = await fetch(path);
    if (response.ok) {
      return await response.text();
    }
  } catch (e) {
    console.warn(`Could not fetch ${path}`, e);
  }
  return null;
}

function parseTestFile(content, filePath) {
  if (!content) return null;

  const lines = content.split('\n');
  const result = {
    file: filePath,
    title: extractTitle(content),
    description: extractDescription(content),
    formula: extractFormula(content),
    impact: extractImpact(content),
    testGroups: [],
    testData: {}
  };

  // Extract test groups and scenarios
  let currentGroup = null;
  let inDescribe = false;
  let currentTest = null;

  lines.forEach((line, index) => {
    // Extract describe blocks (test groups)
    const describeMatch = line.match(/describe\(['"](.+?)['"]/);
    if (describeMatch) {
      inDescribe = true;
      if (currentGroup) {
        result.testGroups.push(currentGroup);
      }
      currentGroup = {
        name: describeMatch[1],
        description: extractGroupDescription(lines, index),
        tests: []
      };
    }

    // Extract test cases (it blocks)
    const itMatch = line.match(/it\(['"](.+?)['"]/);
    if (itMatch && currentGroup) {
      currentTest = {
        name: itMatch[1],
        scenario: extractComment(lines, index, 'SCENARIO:'),
        expected: extractComment(lines, index, 'EXPECTED:'),
        whyItMatters: extractComment(lines, index, 'WHY IT MATTERS:'),
        example: extractComment(lines, index, 'EXAMPLE:')
      };
      currentGroup.tests.push(currentTest);
    }

    // Extract test data (const definitions)
    extractTestData(line, result.testData);
  });

  if (currentGroup) {
    result.testGroups.push(currentGroup);
  }

  return result;
}

function extractTitle(content) {
  const match = content.match(/WHAT THIS TESTS:[\s\S]*?(?=\n\n|$)/);
  if (match) {
    return match[0].replace(/WHAT THIS TESTS:\s*/, '').trim().split('\n')[0];
  }
  return null;
}

function extractDescription(content) {
  const lines = content.split('\n');
  let inComment = false;
  let description = [];

  for (const line of lines) {
    if (line.includes('/**')) inComment = true;
    if (line.includes('*/')) break;
    if (inComment && !line.includes('*') && line.trim()) {
      description.push(line.trim());
    }
    if (line.includes('WHAT THIS TESTS:') || line.includes('WHY THESE TESTS MATTER:')) {
      break;
    }
  }
  return description.join(' ').substring(0, 200);
}

function extractFormula(content) {
  const match = content.match(/FORMULA BEING TESTED:[\s\S]*?\n([^\n]+)/);
  return match ? match[1].trim() : null;
}

function extractImpact(content) {
  const match = content.match(/WHY THESE TESTS MATTER:[\s\S]*?\n([^\n]+)/);
  return match ? match[1].trim() : null;
}

function extractGroupDescription(lines, startIndex) {
  for (let i = startIndex + 1; i < Math.min(startIndex + 10, lines.length); i++) {
    const descMatch = lines[i].match(/\/\/\s*(.+)/);
    if (descMatch) return descMatch[1].trim();
  }
  return null;
}

function extractComment(lines, testIndex, prefix) {
  for (let i = testIndex; i < Math.min(testIndex + 15, lines.length); i++) {
    const commentMatch = lines[i].match(new RegExp(`//\\s*${prefix}\\s*(.+)`));
    if (commentMatch) return commentMatch[1].trim();
  }
  return null;
}

function extractTestData(line, testData) {
  // Extract vineyard configurations
  const vineyardMatch = line.match(/const\s+(\w+):\s*Vineyard\s*=\s*\{/);
  if (vineyardMatch && !testData.vineyards) {
    testData.vineyards = [];
  }

  // Extract staff configurations
  const staffMatch = line.match(/const\s+(\w+):\s*Staff/);
  if (staffMatch && !testData.staff) {
    testData.staff = [];
  }

  // Extract loan configurations
  const loanMatch = line.match(/baseRate:\s*([\d.]+)/);
  if (loanMatch && !testData.loans) {
    testData.loans = [];
  }
}

export { fetchTestFile, parseTestFile, TEST_FILES };


