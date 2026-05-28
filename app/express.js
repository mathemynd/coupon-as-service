var express = require('express');
var logger = require('morgan');
var bodyParser = require('body-parser');
var cors = require('cors');
var swaggerUi = require('swagger-ui-express');
var swaggerSpec = require('./swagger.json');

module.exports = function (app, config) {

	if (app.get('env') !== 'test') {
		app.use(logger('dev'));
	}
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({
		extended: true
	}));
	app.use(cors());

	app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

	var { CodedAPIError } = require('./api_errors');

	require('./routes')(app, config);

	app.use(function (req, res) {
		res.status(404).end();
	});

	app.use(function (err, req, res, next) {
		if (err instanceof CodedAPIError) {
			return res.status(err.http_response_code).json(err.getErrorResponse());
		}
		return res.status(500).json({ error_code: 'INTERNAL_ERROR', message: 'Internal server error' });
	});

};
