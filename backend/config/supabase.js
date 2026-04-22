const { createClient } = require('@supabase/supabase-js');

const { env, featureFlags } = require('./env');

let supabase = null;

const supabaseStatus = {
  enabled: false,
  mode: 'disabled',
  message: 'Supabase Storage is not configured. Artifact storage fallback will be used.',
};

if (featureFlags.supabaseStorage) {
  try {
    supabase = createClient(env.supabaseUrl, env.supabaseSecretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    supabaseStatus.enabled = true;
    supabaseStatus.mode = 'supabase';
    supabaseStatus.message = 'Supabase Storage is configured.';
  } catch (error) {
    supabase = null;
    supabaseStatus.enabled = false;
    supabaseStatus.mode = 'fallback';
    supabaseStatus.message = `Supabase Storage initialization failed: ${error.message}`;
  }
}

module.exports = {
  supabase,
  supabaseStatus,
};
