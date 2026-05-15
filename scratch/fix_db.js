const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db.json');

try {
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    let updatedCount = 0;

    if (data.stock && Array.isArray(data.stock)) {
        data.stock = data.stock.map(item => {
            const price = parseFloat(item.price);
            if (isNaN(price) || price <= 0) {
                if (item.status !== 'borrador') {
                    item.status = 'borrador';
                    updatedCount++;
                }
            }
            return item;
        });
    }

    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Successfully updated ${updatedCount} items to 'borrador' status.`);
} catch (err) {
    console.error('Error fixing database:', err);
}
