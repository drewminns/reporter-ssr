const router = require('express').Router();

require('./routes/posts')(router);

module.exports = router;
