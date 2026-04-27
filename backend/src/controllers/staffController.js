const { adminClient } = require('../services/supabase');

const list = async (req, res) => {
  const { data, error } = await adminClient
    .from('profiles')
    .select('id, full_name, role, is_active, created_at')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

const create = async (req, res) => {
  const { email, password, full_name, role } = req.body;

  // Create auth user
  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authErr) return res.status(400).json({ error: authErr.message });

  // Create profile
  const { data: profile, error: profileErr } = await adminClient
    .from('profiles')
    .insert({ id: authData.user.id, full_name, role: role || 'cashier' })
    .select()
    .single();

  if (profileErr) {
    await adminClient.auth.admin.deleteUser(authData.user.id);
    return res.status(500).json({ error: profileErr.message });
  }

  res.status(201).json(profile);
};

const update = async (req, res) => {
  const { id } = req.params;
  const { full_name, role, is_active } = req.body;

  const updates = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (role !== undefined) updates.role = role;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data, error } = await adminClient
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Staff member not found.' });
  res.json(data);
};

const resetPassword = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  const { error } = await adminClient.auth.admin.updateUserById(id, { password });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Password updated.' });
};

module.exports = { list, create, update, resetPassword };
