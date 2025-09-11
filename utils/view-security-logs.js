#!/usr/bin/env node
/**
 * Security Log Viewer Utility
 * Usage: node utils/view-security-logs.js [options]
 * 
 * Options:
 *   --tail N    Show last N entries (default: 50)
 *   --level L   Filter by log level (INFO, WARN, ERROR)
 *   --email E   Filter by email address
 *   --today     Show only today's entries
 *   --watch     Watch for new entries (like tail -f)
 */

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(process.cwd(), 'logs', 'security.log');

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        tail: 50,
        level: null,
        email: null,
        today: false,
        watch: false
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--tail':
                options.tail = parseInt(args[++i]) || 50;
                break;
            case '--level':
                options.level = args[++i];
                break;
            case '--email':
                options.email = args[++i];
                break;
            case '--today':
                options.today = true;
                break;
            case '--watch':
                options.watch = true;
                break;
            case '--help':
                console.log(`
Security Log Viewer

Usage: node utils/view-security-logs.js [options]

Options:
  --tail N    Show last N entries (default: 50)
  --level L   Filter by log level (INFO, WARN, ERROR)
  --email E   Filter by email address
  --today     Show only today's entries
  --watch     Watch for new entries (like tail -f)
  --help      Show this help message

Examples:
  node utils/view-security-logs.js --tail 10
  node utils/view-security-logs.js --level WARN
  node utils/view-security-logs.js --email admin@example.com
  node utils/view-security-logs.js --today --level ERROR
                `);
                process.exit(0);
        }
    }

    return options;
}

function formatLogEntry(entry) {
    const timestamp = new Date(entry.timestamp).toLocaleString();
    const level = entry.level.padEnd(5);
    const message = entry.message;
    
    let details = '';
    if (entry.email) details += ` [${entry.email}]`;
    if (entry.clientIP) details += ` [${entry.clientIP}]`;
    if (entry.attemptNumber) details += ` [Attempt ${entry.attemptNumber}/${entry.maxAttempts}]`;
    
    return `${timestamp} ${level} ${message}${details}`;
}

function readLogs(options) {
    if (!fs.existsSync(LOG_FILE)) {
        console.log('No security log file found. Logs will be created when login attempts occur.');
        return [];
    }

    const content = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    let entries = lines.map(line => {
        try {
            return JSON.parse(line);
        } catch (e) {
            return null;
        }
    }).filter(entry => entry !== null);

    // Apply filters
    if (options.level) {
        entries = entries.filter(entry => entry.level === options.level);
    }

    if (options.email) {
        entries = entries.filter(entry => entry.email && entry.email.includes(options.email));
    }

    if (options.today) {
        const today = new Date().toDateString();
        entries = entries.filter(entry => new Date(entry.timestamp).toDateString() === today);
    }

    // Apply tail
    if (options.tail && entries.length > options.tail) {
        entries = entries.slice(-options.tail);
    }

    return entries;
}

function main() {
    const options = parseArgs();
    
    console.log(`📝 Security Log Viewer - ${LOG_FILE}`);
    console.log('=' .repeat(80));

    const entries = readLogs(options);
    
    if (entries.length === 0) {
        console.log('No log entries found matching the criteria.');
        return;
    }

    entries.forEach(entry => {
        console.log(formatLogEntry(entry));
    });

    console.log('=' .repeat(80));
    console.log(`Showing ${entries.length} entries`);

    if (options.watch) {
        console.log('\nWatching for new entries... (Press Ctrl+C to exit)');
        // Simple file watching - in production you might want to use fs.watch
        let lastSize = fs.statSync(LOG_FILE).size;
        setInterval(() => {
            const currentSize = fs.statSync(LOG_FILE).size;
            if (currentSize > lastSize) {
                const newEntries = readLogs({ tail: 1 });
                if (newEntries.length > 0) {
                    console.log(formatLogEntry(newEntries[0]));
                }
                lastSize = currentSize;
            }
        }, 1000);
    }
}

if (require.main === module) {
    main();
}

module.exports = { readLogs, formatLogEntry };
