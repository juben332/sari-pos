const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/transactionController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validate');

router.get('/', auth, ctrl.list);
router.get('/:id', auth, param('id').isUUID(), validate, ctrl.getOne);

router.post('/',
  auth,
  body('items').isArray({ min: 1 }),
  body('items.*.product_id').isUUID(),
  body('items.*.quantity').isInt({ min: 1 }),
  body('cash_tendered').isFloat({ min: 0 }),
  body('discount_type').optional().isIn(['none', 'senior', 'pwd', 'employee']),
  validate,
  ctrl.create
);

router.patch('/:id/void',
  auth, roleGuard('admin'),
  param('id').isUUID(),
  validate,
  ctrl.voidTransaction
);

module.exports = router;
