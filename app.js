// Конфигурация Supabase
const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT_URL.supabase.co'; // Вставьте ваш URL Supabase
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';                 // Вставьте ваш Anon Key Supabase

// Инициализация клиента Supabase
if (typeof supabase !== 'undefined') {
  window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Хелпер для сохранения и получения прогресса пользователя
window.userData = {
  async get(key) {
    if (!window.supabaseClient) return null;
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) return null;

    const { data, error } = await window.supabaseClient
      .from('user_progress')
      .select('value')
      .eq('user_id', user.id)
      .eq('key', key)
      .maybeSingle();

    if (error || !data) return null;
    return data.value;
  },

  async set(key, value) {
    if (!window.supabaseClient) return;
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) return;

    const { error } = await window.supabaseClient
      .from('user_progress')
      .upsert({
        user_id: user.id,
        key: key,
        value: value,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,key' });

    if (error) {
      console.error('Ошибка сохранения прогресса:', error);
    }
  }
};
