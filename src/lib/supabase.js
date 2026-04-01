import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://qnnqnfitlaffcadtunuk.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFubnFuZml0bGFmZmNhZHR1bnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODk5NjIsImV4cCI6MjA5MDU2NTk2Mn0.ZFQjIWNtjGOLLIz5L17IMd0RPcsJr7wmphwCFcmW23M';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
