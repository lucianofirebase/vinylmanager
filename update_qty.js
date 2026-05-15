const fs = require('fs');
const path = 'db.json';

try {
    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    if (data.stock && Array.isArray(data.stock)) {
        data.stock = data.stock.map(item => {
            if (item.qty === undefined || item.qty === null) {
                item.qty = 1;
            }
            return item;
        });
        fs.writeFileSync(path, JSON.stringify(data, null, 2));
        console.log('Sincronización completada: Todos los discos tienen qty: 1');
    } else {
        console.log('No se encontró el array "stock" o está vacío.');
    }
} catch (err) {
    console.error('Error al actualizar db.json:', err);
}
