const fs = require('fs');

async function main() {
  const url = 'https://firestore.googleapis.com/v1/projects/vinylstockmanager/databases/(default)/documents/users/814AYsK682cNCjFzHIRvCGCFWSA2/stock?pageSize=300';
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('Failed to fetch:', res.status, res.statusText);
      return;
    }
    const data = await res.json();
    if (!data.documents) {
      console.log('No documents found.');
      return;
    }
    console.log(`Found ${data.documents.length} documents.`);
    const items = data.documents.map(doc => {
      const fields = doc.fields || {};
      const artist = fields.artist ? fields.artist.stringValue : '';
      const title = fields.title ? fields.title.stringValue : '';
      const label = fields.label ? fields.label.stringValue : '';
      const id = doc.name.split('/').pop();
      return { id, artist, title, label };
    });
    
    // Sort and format as a table
    console.table(items);
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
