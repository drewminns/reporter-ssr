module.exports = html => `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel='stylesheet' href='/global.css'>
    <link rel='stylesheet' href='/bundle.css'>
    <title></title>
  </head>
  <body>
    <div id="app">${html}</div>
    <script src="/bundle.js"></script>
  </body>
</html>`;
