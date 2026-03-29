#!/usr/bin/env node

/**
 * DSX Chart Recovery Tool
 * Recovers charts from LevelDB auto-save database with automatic corruption repair
 */

const fs = require('fs');
const path = require('path');

console.log('╔════════════════════════════════════════╗');
console.log('║  DSX Chart Recovery Tool               ║');
console.log('╚════════════════════════════════════════╝\n');

const leveldbPath = path.join(
    process.env.APPDATA || process.env.HOME,
    'dsx-editor',
    'Local Storage',
    'leveldb'
);

if (!fs.existsSync(leveldbPath)) {
    console.error('❌ LevelDB folder not found at:', leveldbPath);
    process.exit(1);
}

// Get all database files
const files = fs.readdirSync(leveldbPath)
    .filter(f => f.endsWith('.log') || f.endsWith('.ldb'))
    .sort()
    .reverse(); // Newest first

console.log(`📂 Found ${files.length} database file(s)\n`);

const allCharts = [];

// Process each file
files.forEach(filename => {
    const filepath = path.join(leveldbPath, filename);
    const buffer = fs.readFileSync(filepath);

    console.log(`Scanning: ${filename} (${buffer.length} bytes)`);

    // Search for auto-save entries by looking for timestamps
    const timestampPattern = /"timestamp":(\d{13})/g;
    const text = buffer.toString('utf8', 0, buffer.length);

    let match;
    const positions = [];

    while ((match = timestampPattern.exec(text)) !== null) {
        positions.push({
            pos: match.index,
            timestamp: parseInt(match[1])
        });
    }

    console.log(`  Found ${positions.length} auto-save entry(s)`);

    positions.forEach(({ pos, timestamp }) => {
        const date = new Date(timestamp);

        // Find chart start
        let chartStart = -1;
        for (let i = pos - 1; i >= Math.max(0, pos - 50000); i--) {
            if (buffer[i] === 0x7B) {
                const snippet = buffer.slice(i, Math.min(i + 20, buffer.length)).toString('utf8');
                if (snippet.includes('"chart"')) {
                    chartStart = i;
                    break;
                }
            }
        }

        if (chartStart === -1) return;

        // Extract with corruption repair
        let jsonText = '';
        let depth = 0;
        let inString = false;
        let escape = false;
        let lastChar = '';

        for (let i = chartStart; i < buffer.length; i++) {
            const byte = buffer[i];

            // Skip problematic bytes
            if (byte === 0x00 || (byte > 0x00 && byte < 0x09) || (byte > 0x0D && byte < 0x20) || byte > 0x7E) {
                if (!inString) continue;
                if (byte === 0x00) continue;
            }

            const char = String.fromCharCode(byte);

            if (escape) {
                jsonText += char;
                escape = false;
                lastChar = char;
                continue;
            }

            if (char === '\\') {
                escape = true;
                jsonText += char;
                lastChar = char;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                jsonText += char;
                lastChar = char;
                continue;
            }

            if (!inString) {
                // Fix corruption pattern: "typeZh: -> "type":
                if (char === 'Z' && lastChar === '"' && buffer[i + 1] === 0x68) {
                    jsonText += '":';
                    i++;
                    lastChar = ':';
                    continue;
                }

                if (char === '{') depth++;
                if (char === '}') {
                    depth--;
                    jsonText += char;
                    lastChar = char;
                    if (depth === 0) break;
                    continue;
                }
            }

            jsonText += char;
            lastChar = char;
        }

        // Additional cleanup
        jsonText = jsonText
            .replace(/"type"Zh:/g, '"type":')
            .replace(/,(\s*[}\]])/g, '$1');

        // Try to parse
        try {
            const data = JSON.parse(jsonText);
            const chart = data.chart || data;

            if (!chart.notes || !Array.isArray(chart.notes)) return;

            const noteCount = chart.notes.length;
            const title = chart.meta?.title || 'Unknown';

            // Check for duplicates
            const isDuplicate = allCharts.some(c =>
                c.noteCount === noteCount &&
                Math.abs(c.timestamp - timestamp) < 1000
            );

            if (!isDuplicate) {
                console.log(`  ✅ ${noteCount} notes - ${title} (${date.toLocaleString()})`);

                allCharts.push({
                    chart: chart,
                    noteCount: noteCount,
                    title: title,
                    timestamp: timestamp,
                    date: date,
                    sourceFile: filename
                });
            }

        } catch (err) {
            // Silent fail - corrupted entry
        }
    });

    console.log('');
});

console.log('═'.repeat(60) + '\n');

if (allCharts.length === 0) {
    console.log('❌ No charts found in auto-save database\n');
    process.exit(1);
}

// Sort by note count (highest first), then by timestamp (newest first)
allCharts.sort((a, b) => {
    if (b.noteCount !== a.noteCount) return b.noteCount - a.noteCount;
    return b.timestamp - a.timestamp;
});

console.log(`✅ Found ${allCharts.length} chart version(s):\n`);

allCharts.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.title}`);
    console.log(`   Notes: ${item.noteCount}`);
    console.log(`   Saved: ${item.date.toLocaleString()}`);
    console.log(`   Source: ${item.sourceFile}`);

    // Save each version
    const safeTitle = item.title.replace(/[^a-zA-Z0-9]/g, '-');
    const timeStr = `${item.date.getHours()}${String(item.date.getMinutes()).padStart(2, '0')}`;
    const filename = `RECOVERED-${safeTitle}-${item.noteCount}notes-${timeStr}.json`;

    fs.writeFileSync(
        path.join(__dirname, filename),
        JSON.stringify(item.chart, null, 2),
        'utf8'
    );

    console.log(`   📁 ${filename}`);
    console.log('');
});

const best = allCharts[0];

console.log('═'.repeat(60));
console.log('\n🎉 Recovery Complete!\n');
console.log(`Best version: ${best.noteCount} notes`);
console.log(`Saved at: ${best.date.toLocaleString()}\n`);
console.log('Import the recovered JSON file in DSX Editor.\n');
