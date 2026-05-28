'use strict';

var { Prisma } = require('@prisma/client');

class CodedAPIError extends Error {
	constructor(error, extra_details) {
		var message = extra_details ? error[2] + '. ' + extra_details : error[2];
		super(message);
		this.http_response_code = error[0];
		this.error_code = error[1];
	}

	getErrorResponse() {
		return { error_code: this.error_code, message: this.message };
	}

	static handleError(err) {
		return err instanceof CodedAPIError ? err : CodedAPIError.#fromPrisma(err);
	}

	static #fromPrisma(err) {
		if (err instanceof Prisma.PrismaClientKnownRequestError) {
			switch (err.code) {
				case 'P2002':
					return new CodedAPIError(ERRORS.COUPON_ALREADY_EXISTS);
				case 'P2025':
					return new CodedAPIError(ERRORS.COUPON_NOT_FOUND);
				case 'P2000':
					return new CodedAPIError(ERRORS.COUPON_INVALID_INPUT);
				default:
					return new CodedAPIError(ERRORS.INTERNAL_ERROR);
			}
		}
		return new CodedAPIError(ERRORS.INTERNAL_ERROR);
	}
}

var ERRORS = {
	UNAUTHORIZED:                   [401, 'UNAUTHORIZED', 'Unauthorized'],

	COUPON_INVALID_INPUT:           [400, 'COUPON_INVALID_INPUT', 'Invalid input'],
	COUPON_INVALID_CODE_FORMAT:     [400, 'COUPON_INVALID_CODE_FORMAT', 'Code must be alphanumeric only'],
	COUPON_MISSING_USAGE_TYPE:      [400, 'COUPON_MISSING_USAGE_TYPE', 'coupon_usage_type is required'],
	COUPON_INVALID_USAGE_TYPE:      [400, 'COUPON_INVALID_USAGE_TYPE', 'coupon_usage_type must be one of: single_use, multi_use, unlimited'],
	COUPON_INVALID_STATUS:          [400, 'COUPON_INVALID_STATUS', 'status must be one of: draft, active, retired'],
	COUPON_INVALID_MAX_REDEMPTIONS: [400, 'COUPON_INVALID_MAX_REDEMPTIONS', 'max_redemptions is required and must be > 0 for multi_use coupons'],
	COUPON_INVALID_DATE_RANGE:      [400, 'COUPON_INVALID_DATE_RANGE', 'start_date must be before end_date'],

	COUPON_UPDATE_BLOCKED:          [400, 'COUPON_UPDATE_BLOCKED', 'Cannot modify this field after coupon has been redeemed'],
	COUPON_INVALID_END_DATE:        [400, 'COUPON_INVALID_END_DATE', 'end_date cannot be before the latest redemption date'],
	COUPON_INVALID_STATUS_TRANSITION: [400, 'COUPON_INVALID_STATUS_TRANSITION', 'Only active to retired transition is allowed after redemption'],

	COUPON_NOT_FOUND:               [404, 'COUPON_NOT_FOUND', 'Coupon not found'],
	COUPON_ALREADY_EXISTS:          [409, 'COUPON_ALREADY_EXISTS', 'Coupon already exists'],

	COUPON_NOT_ACTIVE:              [400, 'COUPON_NOT_ACTIVE', 'Coupon is not active'],
	COUPON_NOT_YET_VALID:           [400, 'COUPON_NOT_YET_VALID', 'Coupon is not yet valid'],
	COUPON_EXPIRED:                 [400, 'COUPON_EXPIRED', 'Coupon has expired'],
	COUPON_ALREADY_REDEEMED:        [400, 'COUPON_ALREADY_REDEEMED', 'Coupon has already been redeemed'],
	COUPON_MAX_REDEMPTIONS:         [400, 'COUPON_MAX_REDEMPTIONS', 'Coupon has reached maximum redemptions'],

	COUPON_INVALID_REDEMPTION_ID:   [400, 'COUPON_INVALID_REDEMPTION_ID', 'Invalid redemption id'],
	COUPON_REDEMPTION_NOT_FOUND:    [404, 'COUPON_REDEMPTION_NOT_FOUND', 'Redemption not found'],

	INTERNAL_ERROR:                 [500, 'INTERNAL_ERROR', 'Internal server error'],
};

module.exports = { CodedAPIError, ERRORS };
