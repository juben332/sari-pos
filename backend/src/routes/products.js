const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/productController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validate');

router.get('/', auth, ctrl.list);
router.get('/low-stock', auth, ctrl.listLowStock);
router.get('/barcode/:barcode', auth, ctrl.getByBarcode);
router.get('/:id', auth, param('id').isUUID(), validate, ctrl.getOne);

router.post('/',
  auth, roleGuard('admin'),
  body('name').trim().notEmpty(),
  body('price').isFloat({ min: 0 }),
  body('cost_price').optional().isFloat({ min: 0 }),
  body('stock').optional().isInt({ min: 0 }),
  body('low_stock_threshold').optional().isInt({ min: 0 }),
  validate,
  ctrl.create
);

router.put('/:id',
  auth, roleGuard('admin'),
  param('id').isUUID(),
  body('price').optional().isFloat({ min: 0 }),
  body('cost_price').optional().isFloat({ min: 0 }),
  body('stock').optional().isInt({ min: 0 }),
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
