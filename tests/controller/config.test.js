'use strict';

var path = require('path');
var config = require('../../app/config');
var validate = config._internal.validate;
var loadEnvFile = config._internal.loadEnvFile;

describe('Config', () => {

	describe('validate', () => {

		test('passes with all required fields', () => {
			var result = validate({
				DATABASE_URL: 'postgresql://localhost/test',
				API_PASSWORD: 'secret'
			});

			expect(result.DATABASE_URL).toBe('postgresql://localhost/test');
			expect(result.API_PASSWORD).toBe('secret');
		});

		test('applies defaults for optional fields', () => {
			var result = validate({
				DATABASE_URL: 'postgresql://localhost/test',
				API_PASSWORD: 'secret'
			});

			expect(result.PORT).toBe(3014);
			expect(result.NODE_ENV).toBe('development');
		});

		test('exits on missing required field', () => {
			var mockExit = vi.spyOn(process, 'exit').mockImplementation(function () {});
			var mockError = vi.spyOn(console, 'error').mockImplementation(function () {});

			validate({ API_PASSWORD: 'secret' });

			expect(mockExit).toHaveBeenCalledWith(1);
			expect(mockError).toHaveBeenCalledWith(expect.stringContaining('Config validation failed'));

			mockExit.mockRestore();
			mockError.mockRestore();
		});

		test('exits when multiple required fields missing', () => {
			var mockExit = vi.spyOn(process, 'exit').mockImplementation(function () {});
			var mockError = vi.spyOn(console, 'error').mockImplementation(function () {});

			validate({});

			expect(mockExit).toHaveBeenCalledWith(1);

			var errorCalls = mockError.mock.calls.map(function (c) { return c[0]; }).join(' ');
			expect(errorCalls).toContain('DATABASE_URL');
			expect(errorCalls).toContain('API_PASSWORD');

			mockExit.mockRestore();
			mockError.mockRestore();
		});

		test('exits on invalid number type', () => {
			var mockExit = vi.spyOn(process, 'exit').mockImplementation(function () {});
			var mockError = vi.spyOn(console, 'error').mockImplementation(function () {});

			validate({
				DATABASE_URL: 'postgresql://localhost/test',
				API_PASSWORD: 'secret',
				PORT: 'not_a_number'
			});

			expect(mockExit).toHaveBeenCalledWith(1);

			var errorCalls = mockError.mock.calls.map(function (c) { return c[0]; }).join(' ');
			expect(errorCalls).toContain('must be a number');

			mockExit.mockRestore();
			mockError.mockRestore();
		});

		test('converts string number to number', () => {
			var result = validate({
				DATABASE_URL: 'postgresql://localhost/test',
				API_PASSWORD: 'secret',
				PORT: '8080'
			});

			expect(result.PORT).toBe(8080);
		});

		test('exits on invalid enum value', () => {
			var mockExit = vi.spyOn(process, 'exit').mockImplementation(function () {});
			var mockError = vi.spyOn(console, 'error').mockImplementation(function () {});

			validate({
				DATABASE_URL: 'postgresql://localhost/test',
				API_PASSWORD: 'secret',
				NODE_ENV: 'staging'
			});

			expect(mockExit).toHaveBeenCalledWith(1);

			var errorCalls = mockError.mock.calls.map(function (c) { return c[0]; }).join(' ');
			expect(errorCalls).toContain('must be one of');
			expect(errorCalls).toContain('staging');

			mockExit.mockRestore();
			mockError.mockRestore();
		});

		test('accepts valid enum value', () => {
			var result = validate({
				DATABASE_URL: 'postgresql://localhost/test',
				API_PASSWORD: 'secret',
				NODE_ENV: 'production'
			});

			expect(result.NODE_ENV).toBe('production');
		});

		test('treats empty string as missing', () => {
			var mockExit = vi.spyOn(process, 'exit').mockImplementation(function () {});
			var mockError = vi.spyOn(console, 'error').mockImplementation(function () {});

			validate({
				DATABASE_URL: '',
				API_PASSWORD: 'secret'
			});

			expect(mockExit).toHaveBeenCalledWith(1);

			var errorCalls = mockError.mock.calls.map(function (c) { return c[0]; }).join(' ');
			expect(errorCalls).toContain('DATABASE_URL');

			mockExit.mockRestore();
			mockError.mockRestore();
		});
	});

	describe('loadEnvFile', () => {

		test('returns empty object for non-existent file', () => {
			var result = loadEnvFile('nonexistent.env');
			expect(result).toEqual({});
		});

		test('parses key=value pairs', () => {
			var fs = require('fs');
			var tmpFile = path.join(config.root, '.env.test.tmp');
			fs.writeFileSync(tmpFile, 'KEY1=value1\nKEY2=value2\n');

			var result = loadEnvFile('.env.test.tmp');
			expect(result.KEY1).toBe('value1');
			expect(result.KEY2).toBe('value2');

			fs.unlinkSync(tmpFile);
		});

		test('strips quotes from values', () => {
			var fs = require('fs');
			var tmpFile = path.join(config.root, '.env.test.tmp');
			fs.writeFileSync(tmpFile, 'KEY1="quoted"\nKEY2=\'single\'\n');

			var result = loadEnvFile('.env.test.tmp');
			expect(result.KEY1).toBe('quoted');
			expect(result.KEY2).toBe('single');

			fs.unlinkSync(tmpFile);
		});

		test('skips comments and empty lines', () => {
			var fs = require('fs');
			var tmpFile = path.join(config.root, '.env.test.tmp');
			fs.writeFileSync(tmpFile, '# comment\n\nKEY1=value1\n# another comment\n');

			var result = loadEnvFile('.env.test.tmp');
			expect(result.KEY1).toBe('value1');
			expect(Object.keys(result)).toHaveLength(1);

			fs.unlinkSync(tmpFile);
		});

		test('skips lines without equals sign', () => {
			var fs = require('fs');
			var tmpFile = path.join(config.root, '.env.test.tmp');
			fs.writeFileSync(tmpFile, 'NOEQUALSSIGN\nKEY1=value1\n');

			var result = loadEnvFile('.env.test.tmp');
			expect(result.KEY1).toBe('value1');
			expect(Object.keys(result)).toHaveLength(1);

			fs.unlinkSync(tmpFile);
		});
	});

	describe('exported config', () => {

		test('has all required fields', () => {
			expect(config.db).toBeDefined();
			expect(config.password).toBeDefined();
			expect(config.port).toBeDefined();
			expect(config.env).toBeDefined();
			expect(config.root).toBeDefined();
			expect(config.app.name).toBe('coupon-as-service');
		});

		test('exposes configSchema', () => {
			expect(config.configSchema).toBeDefined();
			expect(config.configSchema.DATABASE_URL.required).toBe(true);
			expect(config.configSchema.API_PASSWORD.required).toBe(true);
			expect(config.configSchema.PORT.default).toBe(3014);
		});
	});
});
