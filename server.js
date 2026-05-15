const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
// Render asigna el puerto automáticamente vía variable de entorno
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Las rutas /api son interceptadas por el frontend (firebase-init.js)
app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'Cloud active', 
        environment: process.env.NODE_ENV || 'development' 
    });
});

// Redirigir cualquier otra ruta al index.html (útil para SPAs)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`==========================================`);
    console.log(`💿 Vinyl Stock Manager | Cloud Edition`);
    console.log(`🚀 Corriendo en el puerto: ${PORT}`);
    console.log(`==========================================`);
});

