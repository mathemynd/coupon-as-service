'use strict';

var path = require('path');
var rootPath = path.normalize(__dirname + '/..');
var env = process.env.NODE_ENV || 'development';

var configSchema = {
	DATABASE_URL: { type: 'string', required: true },
	API_PASSWORD: { type: 'string', required: true },
	PORT: { type: 'number', required: false, default: 3014 },
	NODE_ENV: { type: 'string', required: false, default: 'development', enum: ['development', 'test', 'production'] }
};

var envFiles = {
	development: '.env.development',
	test: '.env.test',
	production: '.env.production'
};

function loadEnvFile(filePath) {
	var fs = require('fs');
	var fullPath = path.join(rootPath, filePath);
	if (!fs.existsSync(fullPath)) return {};
	var contents = fs.readFileSync(fullPath, 'utf8');
	var vars = {};
	contents.split('\n').forEach(function (line) {
		line = line.trim();
		if (!line || line.startsWith('#')) return;
		var eqIndex = line.indexOf('=');
		if (eqIndex === -1) return;
		var key = line.substring(0, eqIndex).trim();
		var val = line.substring(eqIndex + 1).trim();
		if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
			val = val.slice(1, -1);
		}
		vars[key] = val;
	});
	return vars;
}

function validate(envVars) {
	var config = {};
	var errors = [];

	Object.keys(configSchema).forEach(function (key) {
		var spec = configSchema[key];
		var val = envVars[key];

		if (val === undefined || val === '') {
			if (spec.required) {
				errors.push('Missing required config: ' + key);
				return;
			}
			val = spec.default;
		}

		if (spec.type === 'number' && val !== undefined) {
			val = Number(val);
			if (isNaN(val)) {
				errors.push(key + ' must be a number');
				return;
			}
		}

		if (spec.enum && val !== undefined && spec.enum.indexOf(val) === -1) {
			errors.push(key + ' must be one of: ' + spec.enum.join(', ') + ' (got: ' + val + ')');
			return;
		}

		config[key] = val;
	});

	if (errors.length > 0) {
		console.error('\n=== Config validation failed ===');
		errors.forEach(function (e) { console.error('  - ' + e); });
		console.error('================================\n');
		process.exit(1);
	}

	return config;
}

var fileVars = loadEnvFile(envFiles[env] || envFiles.development);

var merged = {};
Object.keys(configSchema).forEach(function (key) {
	merged[key] = process.env[key] || fileVars[key];
});

var config = validate(merged);

module.exports = {
	root: rootPath,
	app: { name: 'coupon-as-service' },
	env: config.NODE_ENV,
	port: config.PORT,
	db: config.DATABASE_URL,
	password: config.API_PASSWORD,
	configSchema: configSchema,
	_internal: { validate: validate, loadEnvFile: loadEnvFile }
};
