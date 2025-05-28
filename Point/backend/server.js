require('dotenv').config({ path: './backend/.env' }); // Asegúrate de que esto esté al principio de tu archivo


const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config();

const app = express();
const port = process.env.PORT || 3000; // Usa un puerto diferente

// Middleware para parsear JSON y URL-encoded bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir archivos estáticos desde la carpeta "frontend"
app.use(express.static(path.join(__dirname, '../frontend')));

// Conexión a la base de datos
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise();

// Ruta para obtener los datos de los usuarios ordenados por puntos
app.get('/puntajes', async (req, res) => {
    try {
        // Obtener los usuarios ordenados por puntos de mayor a menor
        const [rows] = await pool.query('SELECT nombre, nivel, puntos FROM usersjuego ORDER BY puntos DESC');

        res.json({ success: true, puntajes: rows });
    } catch (error) {
        console.error('Error al obtener los puntajes:', error);
        res.status(500).json({ success: false, message: 'Error al obtener los puntajes' });
    }
});

// Ruta para servir el archivo Puntaje.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'Puntaje.html'));
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor de puntajes corriendo en http://localhost:${port}`);
});