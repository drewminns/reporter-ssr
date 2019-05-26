const PROD = process.env.NODE_ENV === 'production';
module.exports = PROD ? require('./prod.js') : require('./dev.js');
