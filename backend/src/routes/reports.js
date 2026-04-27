const router = require('express').Router();
const ctrl = require('../controllers/reportController');
const auth = require('../middleware/auth');

router.get('/summary', auth, ctrl.summary);
router.get('/sales', auth, ctrl.sales);
router.get('/top-products', auth, ctrl.topProducts);
router.get('/stock-movements', auth, ctrl.stockMovements);

module.exports = router;
