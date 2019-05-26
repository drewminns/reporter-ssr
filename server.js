const path = require('path');
const express = require('express');
const chalk = require('chalk');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const template = require('./config/template');
const { PORT } = require('./config/environment');
const app = require('./public/App.js');
const routes = require('./api');

const log = console.log;

const server = express();

if (process.env.NODE_ENV === 'production') {
  server.use(morgan('short'));
} else {
  server.use(morgan('dev'));
}
server.use(bodyParser.json());
server.use(bodyParser.urlencoded({ extended: false }));
server.use(express.static(path.join(__dirname, 'public')));

// Delivers all API routes
server.use('/api', routes);

// Renders Front End Application
server.get('*', (req, res) => {
  const { html } = app.render({ url: req.url });
  res.write(template(html));
  res.end();
});

server.listen(PORT, () =>
  log(chalk.bgGreen.black(` Running on port ${PORT} `)),
);
