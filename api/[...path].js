'use strict';
// Vercel entry point: every /api/* request is handled by the same code as the local server.
const { createHandler } = require('../server');

module.exports = createHandler();
