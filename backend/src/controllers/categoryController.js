const { adminClient } = require('../services/supabase');

const list = async (req, res) => {
  const { data, error } = await adminClient.from('categories').select('*').order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

const create = async (req, res) => {
  const { name } = req.body;
  const { data, error } = await adminClient.from('categories').insert({ name }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
};

const update = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const { data, error } = await adminClient.from('categories').update({ name }).eq('id', id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Category not found.' });
  res.json(data);
};

const remove = async (req, res) => {
  const { id } = req.params;
  const { error } = await adminClient.from('categories').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Category deleted.' });
};

module.exports = { list, create, update, remove };
