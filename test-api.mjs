import fetch from 'node-fetch';

const apiUrl = 'https://metricdash-blip.vercel.app/api/shopify-sync'; 
// wait, the production URL is metricdash.vercel.app? No, let's use the local API if we run `npm run dev`, or we can just run the test on the live API if we know the domain. 
// I'll just check the vercel deployment URL from earlier logs:
// "Cloning github.com/andreeavrinceanu88-blip/interface"
// It's probably https://interface-sage-mu.vercel.app or something.

// But wait, I can just mock the Shopify graphql mutation manually using the real GraphQL endpoint if I had the token.
