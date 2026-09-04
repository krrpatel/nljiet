import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const configuredSiteUrl = String(import.meta.env.VITE_SITE_URL || '').trim().replace(/\/+$/, '');
const publicSiteUrl = () => configuredSiteUrl || window.location.origin;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

// Keep the app renderable when local secrets have not been configured yet.
// Auth/data calls return a clear configuration error instead of crashing the bundle.
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'local-development-key');
const table = n => n.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
const sortColumn = value => value?.replace('created_date', 'created_at');
const credentials = (value, password) => typeof value === 'object' && value !== null
  ? value
  : { email: value, password };

const serverEntity = async (name, method = 'GET', query = '', payload) => {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  const response = await fetch(`/api/entities/${table(name)}${query}`, {
    method,
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.message || 'Request failed');
  return data;
};

const entity = name => ({
  async list(sort, limit) {
    const query = new URLSearchParams();
    if (sort) query.set('sort', sortColumn(sort));
    if (limit) query.set('limit', limit);
    return serverEntity(name, 'GET', `?${query}`);
  },
  async filter(filters, sort, limit) {
    const query = new URLSearchParams({ filters: JSON.stringify(filters || {}) });
    if (sort) query.set('sort', sortColumn(sort));
    if (limit) query.set('limit', limit);
    return serverEntity(name, 'GET', `?${query}`);
  },
  async create(row) { return serverEntity(name, 'POST', '', row); },
  async update(id, row) { return serverEntity(name, 'PATCH', `/${id}`, row); },
  async delete(id) { return serverEntity(name, 'DELETE', `/${id}`); },
  async deleteMany(filters) { return serverEntity(name, 'DELETE', `?filters=${encodeURIComponent(JSON.stringify(filters || {}))}`); },
  async bulkCreate(rows) { return serverEntity(name, 'POST', '/bulk', rows); },
});

const fn = async (name, data) => {
  const response = await fetch(`/api/functions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const output = await response.json();
  if (!response.ok) {
    const error = new Error(output.error || 'Request failed');
    error.response = { data: output };
    throw error;
  }
  return { data: output };
};

export const api = {
  entities: new Proxy({}, { get: (_, name) => entity(name) }),
  auth: {
    me: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        const authError = new Error('Authentication required');
        authError.status = 401;
        throw authError;
      }
      return user;
    },
    loginViaEmailPassword: async (email, password) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart the app.');
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { ...data, access_token: data.session?.access_token };
    },
    register: async (value, password) => {
      const { email, password: secret, enrollmentNumber } = credentials(value, password);
      const { data, error } = await supabase.auth.signUp({
        email,
        password: secret,
        options: { data: { enrollment_number: enrollmentNumber || null } },
      });
      if (error) throw error;
      return data;
    },
    resetPasswordRequest: email => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${publicSiteUrl()}/reset-password` }),
    resetPassword: (_, password) => supabase.auth.updateUser({ password }),
    logout: () => supabase.auth.signOut(),
    redirectToLogin: () => window.location.assign('/login'),
    setToken: () => {},
  },
  functions: { invoke: fn },
  integrations: {
    Core: {
      UploadFile: async ({ file, folder }) => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = '';
        for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
        const response = await fetch('/api/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, type: file.type, data: btoa(binary), folder }),
        });
        const output = await response.json();
        if (!response.ok) throw new Error(output.error || 'Upload failed');
        return output;
      },
      InvokeLLM: data => fn('llm', data),
      DeleteFile: async url => {
        const response = await fetch('/api/uploads/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        if (!response.ok) throw new Error('File delete failed');
      },
      DeleteFilesByFolder: async ({ folder }) => {
        const response = await fetch('/api/uploads/delete-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder }),
        });
        const output = await response.json();
        if (!response.ok) throw new Error(output.error || 'File cleanup failed');
        return output;
      },
    },
  },
  app: { getPublicSettings: async () => ({ id: 'supabase-portal', public_settings: {} }) },
};
