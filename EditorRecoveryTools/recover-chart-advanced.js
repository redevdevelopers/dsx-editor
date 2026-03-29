#!/usr/bin/env node

/**
 * Repair and Extract the 12:30 AM Chart
 * Fixes binary corruption in the JSON
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Repairing and Extracting 12:30 AM Chart\n');

const logFile = path.join(
    process.env.APPDATA || process.env.HOME,
    'dsx-editor',
    'Local Storage',
    'leveldb',
    '000156.log'
);

const buffer = fs.readFileSync(logFile);
console.log(`✓ Loaded ${buffer.length} bytes\n`);

// Find the timestamp
const targetTimestamp = '1771345811611';
const timestampBuffer = Buffer.from(`"timestamp":${targetTimestamp}`, 'utf8');

let timestampPos = -1;
for (let i = 0; i < buffer.length - timestampBuffer.length; i++) {
    let match = true;
    for (let j = 0; j < timestampBuffer.length; j++) {
        if (buffer[i + j] !== timestampBuffer[j]) {
            match = false;
            break;
        }
    }
    if (match) {
        timestampPos = i;
        break;
    }
}

if (timestampPos === -1) {
    console.error('❌ Timestamp not found');
    process.exit(1);
}

console.log(`Found timestamp at byte ${timestampPos}\n`);

// Find chart start
let chartStart = -1;
for (let i = timestampPos - 1; i >= Math.max(0, timestampPos - 50000); i--) {
    if (buffer[i] === 0x7B) {
        const snippet = buffer.slice(i, Math.min(i + 20, buffer.length)).toString('utf8');
        if (snippet.includes('"chart"')) {
            chartStart = i;
            break;
        }
    }
}

if (chartStart === -1) {
    console.error('❌ Chart start not found');
    process.exit(1);
}

console.log(`Found chart start at byte ${chartStart}\n`);

// Extract with aggressive cleaning and repair
let jsonText = '';
let depth = 0;
let inString = false;
let escape = false;
let lastChar = '';

for (let i = chartStart; i < buffer.length; i++) {
    const byte = buffer[i];

    // Skip null bytes and other problematic control characters
    if (byte === 0x00 || (byte > 0x00 && byte < 0x09) || (byte > 0x0D && byte < 0x20) || byte > 0x7E) {
        // If we're in a string and hit a bad byte, try to recover
        if (inString && byte !== 0x00) {
            // Skip it
            continue;
        } else if (!inString) {
            continue;
        }
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
        // Fix common corruption patterns
        if (char === 'Z' && lastChar === '"' && buffer[i + 1] === 0x68) { // "Zh pattern
            // This should be ":"
            jsonText += '":';
            i++; // Skip the 'h'
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

console.log(`Extracted ${jsonText.length} characters\n`);

// Additional cleanup
jsonText = jsonText
    .replace(/"type"Zh:/g, '"type":')  // Fix the specific corruption
    .replace(/,(\s*[}\]])/g, '$1');     // Remove trailing commas

// Save debug version
fs.writeFileSync(path.join(__dirname, 'repaired-12-30.txt'), jsonText, 'utf8');
console.log('📝 Saved repaired JSON to: repaired-12-30.txt\n');

// Try to parse
try {
    const data = JSON.parse(jsonText);
    const chart = data.chart || data;

    if (!chart.notes || !Array.isArray(chart.notes)) {
        console.error('❌ No notes array found');
        process.exit(1);
    }

    const noteCount = chart.notes.length;
    const title = chart.meta?.title || 'Unknown';
    const bpm = chart.meta?.bpm?.init || 0;

    console.log('✅ Successfully parsed and repaired!');
    console.log(`   Title: ${title}`);
    console.log(`   Notes: ${noteCount} ${noteCount === 718 ? '⭐⭐⭐ THIS IS IT! ⭐⭐⭐' : ''}`);
    console.log(`   BPM: ${bpm}\n`);

    // Save the chart
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '-');
    const outputFile = path.join(__dirname, `RECOVERED-${safeTitle}-${noteCount}notes-REPAIRED.json`);
    fs.writeFileSync(outputFile, JSON.stringify(chart, null, 2), 'utf8');

    console.log(`📁 Saved to: ${path.basename(outputFile)}\n`);

    if (noteCount === 718) {
        console.log('╔════════════════════════════════════════╗');
        console.log('║  🎉🎉🎉 SUCCESS! 🎉🎉🎉                ║');
        console.log('║  Recovered the 718-note chart!         ║');
        console.log('╚════════════════════════════════════════╝\n');
        console.log('✨ Import this file in DSX Editor!\n');
    }

} catch (err) {
    console.error(`❌ Parse error: ${err.message}`);
    console.log('\nTrying manual repair...\n');

    // Try to fix more aggressively
    let fixed = jsonText;

    // Find and fix all "typeZh: patterns
    const corruptions = [];
    for (let i = 0; i < fixed.length - 10; i++) {
        if (fixed.substring(i, i + 7) === '"type"Z') {
            corruptions.push(i);
        }
    }

    console.log(`Found ${corruptions.length} corruption pattern(s)`);

    // Fix from end to start to preserve positions
    for (let i = corruptions.length - 1; i >= 0; i--) {
        const pos = corruptions[i];
        // Replace "type"Zh: with "type":
        fixed = fixed.substring(0, pos + 6) + '":' + fixed.substring(pos + 9);
    }

    fs.writeFileSync(path.join(__dirname, 'repaired-12-30-fixed.txt'), fixed, 'utf8');
    console.log('📝 Saved fixed version to: repaired-12-30-fixed.txt\n');

    try {
        const data2 = JSON.parse(fixed);
        const chart2 = data2.chart || data2;

        if (chart2.notes && Array.isArray(chart2.notes)) {
            const noteCount = chart2.notes.length;
            const title = chart2.meta?.title || 'Unknown';

            console.log('✅ Manual repair successful!');
            console.log(`   Notes: ${noteCount}\n`);

            const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '-');
            const outputFile = path.join(__dirname, `RECOVERED-${safeTitle}-${noteCount}notes-REPAIRED.json`);
            fs.writeFileSync(outputFile, JSON.stringify(chart2, null, 2), 'utf8');

            console.log(`📁 Saved to: ${path.basename(outputFile)}\n`);
        }
    } catch (err2) {
        console.error(`❌ Still failed: ${err2.message}`);
    }
}
