var config = require('./config');
var app = require('./app');

console.log('coupon-as-service running on http://localhost:' + config.port);
app.listen(config.port);