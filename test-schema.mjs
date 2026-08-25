import fetch from 'node-fetch';
import fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf-8');
const tokenMatch = envFile.match(/VITE_TAMTREND_SHOPIFY_CLIENT_SECRET=([^\r\n]+)/);
let token = tokenMatch ? tokenMatch[1].trim() : '';

const graphqlUrl = 'https://tamtrend.myshopify.com/admin/api/2024-01/graphql.json';
const headers = { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token };

async function test() {
  const query = `
    query {
      __type(name: "DraftOrderLineItemInput") {
        inputFields { name type { name kind ofType { name kind } } }
      }
    }
  `;
  const res = await fetch(graphqlUrl, { method: 'POST', headers, body: JSON.stringify({ query }) });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

test().catch(console.error);
