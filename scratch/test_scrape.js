const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const releaseId = 249504; // Daft Punk - Discovery
  const url = `https://www.discogs.com/sell/release/${releaseId}`;
  
  console.log(`Fetching: ${url}`);
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    console.log(`Status: ${response.status}`);
    const $ = cheerio.load(response.data);
    const title = $('title').text();
    console.log(`Page Title: ${title}`);
    
    // Check if we can find listings
    const listingsCount = $('.shortcut_navigable').length;
    console.log(`Number of listings found: ${listingsCount}`);
    
    // Let's print some text from the first listing if found
    if (listingsCount > 0) {
      const firstListing = $('.shortcut_navigable').first();
      const seller = firstListing.find('.seller_info a').first().text();
      const price = firstListing.find('.price').first().text().trim();
      console.log(`First seller: ${seller}, Price: ${price}`);
    } else {
      console.log('No listings elements (.shortcut_navigable) found in HTML.');
    }
  } catch (error) {
    console.error('Error fetching:', error.message);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response headers:`, error.response.headers);
    }
  }
}

test();
