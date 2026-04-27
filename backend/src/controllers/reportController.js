const { adminClient } = require('../services/supabase');

const sales = async (req, res) => {
  const { from, to } = req.query;

  let query = adminClient
    .from('transactions')
    .select('id, total, discount_amount, created_at, status')
    .eq('status', 'completed');

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data: transactions, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const totalSales = transactions.reduce((sum, t) => sum + parseFloat(t.total), 0);
  const totalDiscount = transactions.reduce((sum, t) => sum + parseFloat(t.discount_amount), 0);
  const count = transactions.length;

  res.json({ count, total_sales: totalSales, total_discount: totalDiscount, transactions });
};

const topProducts = async (req, res) => {
  const { from, to, limit = 10 } = req.query;

  let query = adminClient
    .from('transaction_items')
    .select('product_id, product_name, quantity, subtotal, transactions!inner(created_at, status)')
    .eq('transactions.status', 'completed');

  if (from) query = query.gte('transactions.created_at', from);
  if (to) query = query.lte('transactions.created_at', to);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Aggregate by product
  const map = {};
  for (const item of data) {
    const key = item.product_id || item.product_name;
    if (!map[key]) map[key] = { product_id: item.product_id, product_name: item.product_name, qty_sold: 0, revenue: 0 };
    map[key].qty_sold += item.quantity;
    map[key].revenue += parseFloat(item.subtotal);
  }

  const sorted = Object.values(map).sort((a, b) => b.qty_sold - a.qty_sold).slice(0, parseInt(limit));
  res.json(sorted);
};

const stockMovements = async (req, res) => {
  const { product_id, type, from, to, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let query = adminClient
    .from('stock_movements')
    .select('*, products(name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + parseInt(limit) - 1);

  if (product_id) query = query.eq('product_id', product_id);
  if (type) query = query.eq('type', type);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, total: count, page: parseInt(page), limit: parseInt(limit) });
};

const summary = async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [txnRes, productRes, lowStockRes, returnRes] = await Promise.all([
    adminClient.from('transactions').select('total').eq('status', 'completed').gte('created_at', today.toISOString()),
    adminClient.from('products').select('id', { count: 'exact' }).eq('is_active', true),
    adminClient.from('products').select('id, name, stock, low_stock_threshold').eq('is_active', true),
    adminClient.from('returns').select('refund_amount').gte('created_at', today.toISOString()),
  ]);

  const todaySales = (txnRes.data || []).reduce((s, t) => s + parseFloat(t.total), 0);
  const todayRefunds = (returnRes.data || []).reduce((s, r) => s + parseFloat(r.refund_amount), 0);
  const lowStock = (lowStockRes.data || []).filter(p => p.stock <= p.low_stock_threshold);

  res.json({
    today_sales: todaySales,
    today_transactions: txnRes.data?.length || 0,
    today_refunds: todayRefunds,
    total_products: productRes.count || 0,
    low_stock_count: lowStock.length,
    low_stock_items: lowStock,
  });
};

module.exports = { sales, topProducts, stockMovements, summary };
