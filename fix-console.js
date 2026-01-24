const fs = require('fs');

function removeConsoleCalls(content) {
  // Remove console.log/warn/error with multiline objects
  // This regex matches console.log( ... ); including nested braces and multiline

  let result = content;
  let changed = true;

  while (changed) {
    const before = result;

    // Pattern 1: Simple single-line console calls
    result = result.replace(/^\s*console\.(log|warn|error)\([^)]*\);\s*$/gm, '');

    // Pattern 2: Console calls with template literals (backticks)
    result = result.replace(/^\s*console\.(log|warn|error)\(`[^`]*`[^;]*;\s*$/gm, '');

    // Pattern 3: Multiline console calls - match opening and find closing
    // Look for console.log({ ... }); spanning multiple lines
    const multilinePattern = /^\s*console\.(log|warn|error)\(\s*\{[\s\S]*?\}\s*\);\s*$/gm;
    result = result.replace(multilinePattern, '');

    // Pattern 4: Console with string + object like console.log('text', { ... });
    const mixedPattern = /^\s*console\.(log|warn|error)\([^{]*\{[\s\S]*?\}\s*\);\s*$/gm;
    result = result.replace(mixedPattern, '');

    // Pattern 5: Orphaned object properties (leftover from bad removal)
    // Lines that start with property: value, or just });
    result = result.replace(/^\s+[a-zA-Z_]+:\s+[^,\n]+,?\s*$/gm, '');
    result = result.replace(/^\s+\}\);\s*$/gm, '');

    changed = (before !== result);
  }

  // Clean up multiple empty lines
  result = result.replace(/\n\s*\n\s*\n/g, '\n\n');

  return result;
}

// Process content.js
const contentPath = './src/content/content.js';
let content = fs.readFileSync(contentPath, 'utf8');

// First, let's do a more surgical approach: remove entire console statements
// by finding them and tracking brace depth

function removeConsoleStatements(code) {
  const lines = code.split('\n');
  const result = [];
  let skipUntilClosing = false;
  let braceDepth = 0;
  let parenDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if this line starts a console statement
    if (trimmed.match(/^console\.(log|warn|error)\(/)) {
      // Count opening and closing parens/braces
      let openParens = (line.match(/\(/g) || []).length;
      let closeParens = (line.match(/\)/g) || []).length;

      // If balanced on same line, just skip this line
      if (openParens === closeParens && trimmed.endsWith(';')) {
        continue; // Skip this line
      }

      // Otherwise, we need to skip until we find the closing
      skipUntilClosing = true;
      parenDepth = openParens - closeParens;
      continue;
    }

    if (skipUntilClosing) {
      let openParens = (line.match(/\(/g) || []).length;
      let closeParens = (line.match(/\)/g) || []).length;
      parenDepth += openParens - closeParens;

      if (parenDepth <= 0 && (trimmed.endsWith(');') || trimmed === '});')) {
        skipUntilClosing = false;
        parenDepth = 0;
        continue;
      }
      continue; // Skip this line too
    }

    result.push(line);
  }

  return result.join('\n');
}

content = removeConsoleStatements(content);
fs.writeFileSync(contentPath, content);
console.log('Fixed content.js');

// Process background.js
const bgPath = './src/background/background.js';
let bgContent = fs.readFileSync(bgPath, 'utf8');
bgContent = removeConsoleStatements(bgContent);
fs.writeFileSync(bgPath, bgContent);
console.log('Fixed background.js');

console.log('Done!');
