import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://ocqycgchathxdbpfpypdzh.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcXljZ2NhdHhkYnBmZnB4ZHZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NjcxODksImV4cCI6MjEwNzA0MzE4OX0.ZmE5XI1LZdnZ3LagFDhcqaLqh-u3T8dtIFyBTHYzDOw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 無 session 時踢回登入頁，回傳 session
export async function requireAdmin(loginPage = 'login.html') {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
        location.replace(loginPage);
        return null;
    }
    return data.session;
}

export async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
}

export async function logoutAndGo(loginPage = 'login.html') {
    await supabase.auth.signOut();
    location.replace(loginPage);
}
