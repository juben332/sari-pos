const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/returnController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

router.get('/', auth, ctrl.list);
router.get('/:id', auth, param('id').isUUID(), validate, ctrl.getOne);

router.post('/',
  auth,
  body('transaction_id').isUUID(),
  body('items').isArray({ min: 1 }),
  body('items.*.transaction_item_id').isUUID(),
  body('items.*.quantity').isInt({ min: 1 }),
  body('reason').trim().notEmpty(),
  body('refund_method').isIn(['cash', 'store_credit', 'exchange']),
  validate,
  ctrl.create
);

module.exports = router;
