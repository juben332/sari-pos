const { adminClient } = require('../services/supabase');

const generateRef = () => `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const create = async (req, res) => {
  const { items, discount_type, cash_tendered } = req.body;
  const cashier_id = req.user.id;

  // Validate items and fetch current products
  const productIds = items.map(i => i.product_id);
  const { data: products, error: prodErr } = await adminClient
    .from('products')
    .select('id, name, price, stock, is_active')
    .in('id', productIds);

  if (prodErr) return res.status(500).json({ error: prodErr.message });

  const productMap = Object.fromEntries(products.map(p => [p.id, p]));

  for (const item of items) {
    const product = productMap[item.product_id];
    if (!product || !product.is_active) {
      return res.status(400).json({ error: `Product ${item.product_id} not found or inactive.` });
    }
    if (product.stock < item.quantity) {
      return res.status(400).json({ error: `Insufficient stock for "${product.name}".` });
    }
  }

  // Calculate totals
  let subtotal = 0;
  const lineItems = items.map(item => {
    const product = productMap[item.product_id];
    const lineSubtotal = product.price * item.quantity;
    subtotal += lineSubtotal;
    return {
      product_id: item.product_id,
      product_name: product.name,
      unit_price: product.price,
      quantity: item.quantity,
      subtotal: lineSubtotal,
    };
  });

  const discountRate = discount_type === 'senior' || discount_type === 'pwd' ? 0.20
    : discount_type === 'employee' ? 0.10 : 0;
  const discount_amount = parseFloat((subtotal * discountRate).toFixed(2));
  const total = parseFloat((subtotal - discount_amount).toFixed(2));
  const change_due = parseFloat((cash_tendered - total).toFixed(2));

  if (change_due < 0) {
    return res.status(400).json({ error: 'Cash tendered is less than total.' });
  }

  const reference_no = generateRef();

  // Insert transaction
  const { data: txn, error: txnErr } = await adminClient
    .from('transactions')
    .insert({
      reference_no,
      cashier_id,
      subtotal,
      discount_type: discount_type || 'none',
      discount_amount,
      total,
      cash_tendered,
      change_due,
    })
    .select()
    .single();

  if (txnErr) return res.status(500).json({ error: txnErr.message });

  // Insert line items
  const { error: itemsErr } = await adminClient
    .from('transaction_items')
    .insert(lineItems.map(li => ({ ...li, transaction_id: txn.id })));

  if (itemsErr) return res.status(500).json({ error: itemsErr.message });

  // Deduct stock and log movements
  for (const item of items) {
    const product = productMap[item.product_id];
    const newStock = product.stock - item.quantity;

    await adminClient
      .from('products')
      .update({ stock: newStock })
      .eq('id', item.product_id);

    await adminClient.from('stock_movements').insert({
      product_id: item.product_id,
      type: 'sale',
      quantity_change: -item.quantity,
      stock_before: product.stock,
      stock_after: newStock,
      reference_id: txn.id,
      performed_by: cashier_id,
    });
  }

  res.status(201).json({ ...txn, items: lineItems });
};

const list = async (req, res) => {
  const { from, to, cashier_id, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let query = adminClient
    .from('transactions')
    .select('*, profiles(full_name), transaction_items(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + parseInt(limit) - 1);

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);
  if (cashier_id) query = query.eq('cashier_id', cashier_id);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, total: count, page: parseInt(page), limit: parseInt(limit) });
};

const getOne = async (req, res) => {
  const { id } = req.params;
  const { data, error } = await adminClient
    .from('transactions')
    .select('*, profiles(full_name), transaction_items(*)')
    .eq('id', id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Transaction not found.' });
  res.json(data);
};

const voidTransaction = async (req, res) => {
  const { id } = req.params;

  const { data: txn, error: txnErr } = await adminClient
    .from('transactions')
    .select('*, transaction_items(*)')
    .eq('id', id)
    .single();

  if (txnErr || !txn) return res.status(404).json({ error: 'Transaction not found.' });
  if (txn.status === 'voided') return res.status(400).json({ error: 'Transaction already voided.' });

  // Restore stock
  for (const item of txn.transaction_items) {
    const { data: product } = await adminClient
      .from('products')
      .select('stock')
      .eq('id', item.product_id)
      .single();

    if (product) {
      const newStock = product.stock + item.quantity;
      await adminClient.from('products').update({ stock: newStock }).eq('id', item.product_id);
      await adminClient.from('stock_movements').insert({
        product_id: item.product_id,
        type: 'adjustment',
        quantity_change: item.quantity,
        stock_before: product.stock,
        stock_after: newStock,
        reference_id: id,
        performed_by: req.user.id,
        note: 'Transaction voided',
      });
    }
  }

  const { data, error } = await adminClient
    .from('transactions')
    .update({ status: 'voided' })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

module.exports = { create, list, getOne, voidTransaction };
