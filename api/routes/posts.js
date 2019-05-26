const posts = require('../controllers/posts');

module.exports = router => {
  router.get('/posts', posts.getAll);
};
