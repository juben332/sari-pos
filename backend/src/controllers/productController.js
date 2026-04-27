const { adminClient } = require('../services/supabase');

const list = async (req, res) => {
  const { category_id, search, low_stock } = req.query;
  let query = adminClient
    .from('products')
    .select('*, categories(name)')
    .eq('is_active', true)
    .order('name');

  if (category_id) query = query.eq('category_id', category_id);
  if (search) query = query.ilike('name', `%${search}%`);
  if (low_stock === 'true') query = query.lte('stock', adminClient.raw('low_stock_threshold'));

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

const getOne = async (req, res) => {
  const { id } = req.params;
  const { data, error } = await adminClient
    .from('products')
    .select('*, categories(name)')
    .eq('id', id)
    .eq('is_active', true)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Product not found.' });
  res.json(data);
};

const getByBarcode = async (req, res) => {
  const { barcode } = req.params;
  const { data, error } = await adminClient
    .from('products')
    .select('*, categories(name)')
    .eq('barcode', barcode)
    .eq('is_active', true)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Product not found.' });
  res.json(data);
};

const create = async (req, res) => {
  const { name, category_id, barcode, price, cost_price, stock, low_stock_threshold } = req.body;
  const { data, error } = await adminClient
    .from('products')
    .insert({ name, category_id, barcode, price, cost_price, stock, low_stock_threshold })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
};

const update = async (req, res) => {
  const { id } = req.params;
  const fields = req.body;
  delete fields.id;
  const { data, error } = await adminClient
    .from('products')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Product not found.' });
  res.json(data);
};

const remove = async (req, res) => {
  const { id } = req.params;
  const { error } = await adminClient.from('products').update({ is_active: false }).eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Product deactivated.' });
};

const listLowStock = async (req, res) => {
  const { data, error } = await adminClient
    .from('products')
    .select('*, categories(name)')
    .eq('is_active', true)
    .order('stock');
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data.filter(p => p.stock <= p.low_stock_threshold));
};

module.exports = { list, getOne, getByBarcode, create, update, remove, listLowStock };
