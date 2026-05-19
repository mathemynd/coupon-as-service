'use strict';

var mongoose = require('mongoose'),
	Schema = mongoose.Schema;

var DiscountSchema = new Schema({
	user: { type: String, required: true },
	code: { type: String, required: true },
	start: { type: Date, default: Date.now }
});

//DiscountSchema.index({ user: 1, code: 1 }, { unique: true })

mongoose.model('Discount', DiscountSchema);