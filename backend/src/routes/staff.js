const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/staffController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validate');

router.get('/', auth, roleGuard('admin'), ctrl.list);

router.post('/',
  auth, roleGuard('admin'),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('full_name').trim().notEmpty(),
  body('role').optional().isIn(['admin', 'cashier']),
  validate,
  ctrl.create
);

router.put('/:id',
  auth, roleGuard('admin'),
  param('id').isUUID(),
  body('role').optional().isIn(['admin', 'cashier']),
  body('is_active').optional().isBoolean(),
  validate,
  ctrl.update
);

router.patch('/:id/password',
  auth, roleGuard('admin'),
  param('id').isUUID(),
  body('password').isLength({ min: 6 }),
  validate,
  ctrl.resetPassword
);

module.exports = router;
