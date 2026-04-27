const { adminClient } = require('../services/supabase');

const login = async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await adminClient.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: 'Invalid email or password.' });

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, full_name, role, is_active')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) return res.status(401).json({ error: 'Profile not found.' });
  if (!profile.is_active) return res.status(403).json({ error: 'Account is deactivated. Contact admin.' });

  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: profile,
  });
};

const refresh = async (req, res) => {
  const { refresh_token } = req.body;
  const { data, error } = await adminClient.auth.refreshSession({ refresh_token });
  if (error) return res.status(401).json({ error: 'Invalid or expired refresh token.' });
  res.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
};

const me = async (req, res) => {
  res.json({
    id: req.user.id,
    full_name: req.user.full_name,
    role: req.user.role,
  });
};

const logout = async (req, res) => {
  await adminClient.auth.admin.signOut(req.user.accessToken).catch(() => {});
  res.json({ message: 'Logged out.' });
};

module.exports = { login, refresh, me, logout };
