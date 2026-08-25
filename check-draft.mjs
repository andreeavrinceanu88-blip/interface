import fetch from 'node-fetch';
import fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf-8');
const tokenMatch = envFile.match(/VITE_TAMTREND_SHOPIFY_CLIENT_SECRET=([^\r\n]+)/);
let token = tokenMatch ? tokenMatch[1].trim() : '';

const graphqlUrl = 'https://tamtrend.myshopify.com/admin/api/2024-01/graphql.json';
const headers = { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token };

const query = `
  query {
    draftOrders(first: 5, query: "status:open") {
      edges {
        node {
          id
          name
          shippingLine {
            title
            custom
            originalPrice
            shippingRateHandle
          }
        }
      }
    }
  }
`;

fetch(graphqlUrl, { method: 'POST', headers, body: JSON.stringify({ query }) })
  .then(res => res.json())
  .then(res => console.log(JSON.stringify(res, null, 2)));
