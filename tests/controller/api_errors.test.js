'use strict';

var { Prisma } = require('@prisma/client');
var { CodedAPIError, ERRORS } = require('../../app/api_errors');

describe('CodedAPIError', () => {

	describe('constructor', () => {

		test('1. creates error from tuple', () => {
			var err = new CodedAPIError(ERRORS.COUPON_NOT_FOUND);
			expect(err).toBeInstanceOf(Error);
			expect(err).toBeInstanceOf(CodedAPIError);
			expect(err.http_response_code).toBe(404);
			expect(err.error_code).toBe('COUPON_NOT_FOUND');
			expect(err.message).toBe('Coupon not found');
		});

		test('2. appends extra_details to message', () => {
			var err = new CodedAPIError(ERRORS.COUPON_NOT_FOUND, 'Code: SUMMER20');
			expect(err.error_code).toBe('COUPON_NOT_FOUND');
			expect(err.message).toBe('Coupon not found. Code: SUMMER20');
		});
	});

	describe('getErrorResponse', () => {

		test('3. returns error_code and message', () => {
			var err = new CodedAPIError(ERRORS.UNAUTHORIZED);
			expect(err.getErrorResponse()).toEqual({ error_code: 'UNAUTHORIZED', message: 'Unauthorized' });
		});
	});

	describe('handleError', () => {

		test('4. passes through CodedAPIError unchanged', () => {
			var original = new CodedAPIError(ERRORS.COUPON_NOT_FOUND);
			var result = CodedAPIError.handleError(original);
			expect(result).toBe(original);
		});

		test('5. maps P2002 to COUPON_ALREADY_EXISTS', () => {
			var prismaErr = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '7.0.0' });
			var result = CodedAPIError.handleError(prismaErr);
			expect(result).toBeInstanceOf(CodedAPIError);
			expect(result.error_code).toBe('COUPON_ALREADY_EXISTS');
		});

		test('6. maps P2025 to COUPON_NOT_FOUND', () => {
			var prismaErr = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.0.0' });
			var result = CodedAPIError.handleError(prismaErr);
			expect(result.error_code).toBe('COUPON_NOT_FOUND');
		});

		test('7. maps P2000 to COUPON_INVALID_INPUT', () => {
			var prismaErr = new Prisma.PrismaClientKnownRequestError('Value too long', { code: 'P2000', clientVersion: '7.0.0' });
			var result = CodedAPIError.handleError(prismaErr);
			expect(result.error_code).toBe('COUPON_INVALID_INPUT');
		});

		test('8. maps unknown Prisma code to INTERNAL_ERROR', () => {
			var prismaErr = new Prisma.PrismaClientKnownRequestError('Foreign key failed', { code: 'P2003', clientVersion: '7.0.0' });
			var result = CodedAPIError.handleError(prismaErr);
			expect(result.error_code).toBe('INTERNAL_ERROR');
		});

		test('9. maps non-Prisma error to INTERNAL_ERROR', () => {
			var result = CodedAPIError.handleError(new Error('random failure'));
			expect(result.error_code).toBe('INTERNAL_ERROR');
		});
	});
});
