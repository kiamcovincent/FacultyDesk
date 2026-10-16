
require('dotenv').config();

const supabase = require('./config/supabase');

async function testSupabase() {
  try {
    const { data, error } = await supabase
      .from('teachers')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Supabase API error:', error.message);
      console.error('Error code:', error.code);
      return;
    }

    console.log('Supabase API connection successful.');
    console.log('Teachers table is accessible.');
    console.log('Rows returned:', data.length);
  } catch (error) {
    console.error('Connection test failed:', error.message);
  }
}

testSupabase();
