const fs = require('fs');
const path = require('path');

function loadConfig(configPath = path.join(__dirname, 'src', 'config.txt')) {
    const config = {};
    try {
        const content = fs.readFileSync(configPath, 'utf-8');
        content.split(/\r?\n/).forEach(line => {
            if (line.trim() && line.includes('=')) {
                const [key, value] = line.split('=');
                // If value is a comma-separated list, convert to array of numbers
                if (value.includes(',')) {
                    config[key.trim()] = value.split(',').map(v => isNaN(v) ? v.trim() : Number(v));
                } else if (!isNaN(value)) {
                    config[key.trim()] = Number(value);
                } else {
                    config[key.trim()] = value.trim();
                }
            }
        });
        // Override with environment variables if present
        Object.keys(config).forEach(key => {
            const envKey = key.toUpperCase();
            if (process.env[envKey] !== undefined) {
                const envVal = process.env[envKey];
                if (Array.isArray(config[key])) {
                    config[key] = envVal.split(',').map(v => isNaN(v) ? v.trim() : Number(v));
                } else if (!isNaN(config[key])) {
                    config[key] = isNaN(envVal) ? envVal : Number(envVal);
                } else {
                    config[key] = envVal;
                }
            }
        });
    } catch (err) {
        console.error('Error loading config:', err.message);
    }
    return config;
}

module.exports = loadConfig;
