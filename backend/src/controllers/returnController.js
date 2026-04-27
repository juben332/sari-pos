const { adminClient } = require('../services/supabase');

const generateRef = () => `RET-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const create = async (req, res) => {
  const { transaction_id, items, reason, refund_method, notes } = req.body;
  const processed_by = req.user.id;

  // Verify transaction exists and is completed
  const { data: txn, error: txnErr } = await adminClient
    .from('transactions')
    .select('id, status, transaction_items(*)')
    .eq('id', transaction_id)
    .single();

  if (txnErr || !txn) return res.status(404).json({ error: 'Transaction not found.' });
  if (txn.status === 'voided') return res.status(400).json({ error: 'Cannot return items from a voided transaction.' });

  const txnItemMap = Object.fromEntries(txn.transaction_items.map(i => [i.id, i]));

  // Validate return items
  let refund_amount = 0;
  const returnLines = [];

  for (const item of items) {
    const txnItem = txnItemMap[item.transaction_item_id];
    if (!txnItem) return res.status(400).json({ error: `Transaction item ${item.transaction_item_id} not found.` });
    if (item.quantity > txnItem.quantity) {
      return res.status(400).json({ error: `Return quantity exceeds original for item ${txnItem.product_name}.` });
    }
    const lineRefund = txnItem.unit_price * item.quantity;
    refund_amount += lineRefund;
    returnLines.push({
      transaction_item_id: item.transaction_item_id,
      product_id: txnItem.product_id,
      product_name: txnItem.product_name,
      quantity: item.quantity,
      unit_price: txnItem.unit_price,
      subtotal: lineRefund,
    });
  }

  const reference_no = generateRef();

  const { data: ret, error: retErr } = await adminClient
    .from('returns')
    .insert({ reference_no, transaction_id, processed_by, reason, refund_method, refund_amount, notes })
    .select()
    .single();

  if (retErr) return res.status(500).json({ error: retErr.message });

  const { error: itemsErr } = await adminClient
    .from('return_items')
    .insert(returnLines.map(l => ({ ...l, return_id: ret.id })));

  if (itemsErr) return res.status(500).json({ error: itemsErr.message });

  // Restore stock
  for (const line of returnLines) {
    if (!line.product_id) continue;
    const { data: product } = await adminClient
      .from('products').select('stock').eq('id', line.product_id).single();
    if (product) {
      const newStock = product.stock + line.quantity;
      await adminClient.from('products').update({ stock: newStock }).eq('id', line.product_id);
      await adminClient.from('stock_movements').insert({
        product_id: line.product_id,
        type: 'return',
        quantity_change: line.quantity,
        stock_before: product.stock,
        stock_after: newStock,
        reference_id: ret.id,
        performed_by: processed_by,
      });
    }
  }

  res.status(201).json({ ...ret, items: returnLines });
};

const list = async (req, res) => {
  const { from, to, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let query = adminClient
    .from('returns')
    .select('*, profiles(full_name), return_items(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + parseInt(limit) - 1);

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, total: count, page: parseInt(page), limit: parseInt(limit) });
};

const getOne = async (req, res) => {
  const { id } = req.params;
  const { data, error } = await adminClient
    .from('returns')
    .select('*, profiles(full_name), return_items(*)')
    .eq('id', id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Return not found.' });
  res.json(data);
};

module.exports = { create, list, getOne };
