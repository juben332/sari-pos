const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/categoryController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validate');

router.get('/', auth, ctrl.list);

router.post('/',
  auth, roleGuard('admin'),
  body('name').trim().notEmpty(),
  validate,
  ctrl.create
);

router.put('/:id',
  auth, roleGuard('admin'),
  param('id').isUUID(),
  body('name').trim().notEmpty(),
  validate,
  ctrl.update
);

router.delete('/:id',
  auth, roleGuard('admin'),
  param('id').isUUID(),
  validate,
  ctrl.remove
);

module.exports = router;
