const router = require('express').Router();
const { body } = require('express-validator');
const { login, refresh, me, logout } = require('../controllers/authController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

router.post('/login',
  body('email').isEmail(),
  body('password').notEmpty(),
  validate,
  login
);

router.post('/refresh',
  body('refresh_token').notEmpty(),
  validate,
  refresh
);

router.get('/me', auth, me);
router.post('/logout', auth, logout);

module.exports = router;
