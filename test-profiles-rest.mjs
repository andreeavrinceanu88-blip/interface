
import fs from 'fs';
import fetch from 'node-fetch';

const envFile = fs.readFileSync('.env', 'utf-8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = envFile.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/);
const url = urlMatch ? urlMatch[1].trim() : '';
const key = keyMatch ? keyMatch[1].trim() : '';

async function test() {
  const res = await fetch(\\/rest/v1/profiles?select=*\, {
    headers: {
      'apikey': key,
      'Authorization': \Bearer \\
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

test().catch(console.error);

