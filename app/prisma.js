'use strict';

var { PrismaClient } = require('@prisma/client');
var { PrismaPg } = require('@prisma/adapter-pg');
var config = require('./config');

var adapter = new PrismaPg({ connectionString: config.db });
var prisma = new PrismaClient({ adapter: adapter });

module.exports = prisma;
