import fetch from 'node-fetch';
import fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf-8');
const tokenMatch = envFile.match(/VITE_TAMTREND_SHOPIFY_CLIENT_SECRET=([^\r\n]+)/);
let token = tokenMatch ? tokenMatch[1].trim() : '';

const graphqlUrl = 'https://tamtrend.myshopify.com/admin/api/2024-01/graphql.json';
const headers = { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token };

async function test() {
  const query = `query { draftOrders(first: 1) { edges { node { id name } } } }`;
  const res = await fetch(graphqlUrl, { method: 'POST', headers, body: JSON.stringify({ query }) });
  const data = await res.json();
  const id = data.data.draftOrders.edges[0].node.id;
  console.log('Testing with Draft Order:', id);

  const mutation = `
    mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
      draftOrderUpdate(id: $id, input: $input) {
        draftOrder {
          id
          shippingLine { title custom originalPrice shippingRateHandle }
        }
        userErrors { field message }
      }
    }
  `;

  const input = {
    shippingLine: {
      title: 'Livrare Rapida',
      price: '21.00'
    }
  };

  const mRes = await fetch(graphqlUrl, { method: 'POST', headers, body: JSON.stringify({ query: mutation, variables: { id, input } }) });
  const mData = await mRes.json();
  console.log('Update response (price):', JSON.stringify(mData, null, 2));
}

test().catch(console.error);
