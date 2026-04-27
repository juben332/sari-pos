/**
 * Authentication middleware.
 * Verifies the Supabase JWT from the Authorization header,
 * attaches the user + profile to req.user.
 */
const { adminClient } = require('../services/supabase');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT with Supabase
    const { data: { user }, error } = await adminClient.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    // Fetch profile (role, is_active)
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, full_name, role, is_active')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({ error: 'User profile not found.' });
    }

    if (!profile.is_active) {
      return res.status(403).json({ error: 'Account is deactivated. Contact admin.' });
    }

    // Attach to request for downstream use
    req.user = { ...user, ...profile, accessToken: token };
    next();
  } catch (err) {
    console.error('[auth middleware]', err.message);
    res.status(500).json({ error: 'Authentication error.' });
  }
};

module.exports = auth;
