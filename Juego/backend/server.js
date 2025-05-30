require('dotenv').config({ path: './backend/.env' });
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session'); // Importa express-session
const MySQLStore = require('express-mysql-session')(session);
const cors = require('cors');
const bcrypt = require('bcrypt');
const validator = require('validator');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20');
// Middleware para verificar si el usuario está autenticado 
const { OAuth2Client } = require('google-auth-library');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
// Mapa para intentos fallidos y bloqueo temporal (en memoria)
const loginAttempts = {}; // se usa para almacenar los intentos de inicio de sesión
const MAX_ATTEMPTS = 5; // número máximo de intentos
const BLOCK_TIME = 5 * 60 * 1000; // 5 minutos en ms

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Configuración de CORS
// Permitir solicitudes CORS desde el frontend
app.use(cors({
    origin: 'http://localhost:5000',
    credentials: true
}));

// Conexión a la base de datos (si no la tienes ya)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise(); // Se agrega .promise() para usar promesas

// Configuración de la sesión con MySQL
const sessionStore = new MySQLStore({
    host: process.env.DB_HOST,
    port: 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});

// Configuración de la sesión
app.use(session({
    secret: process.env.SESSION_SECRET || 'SUbpuPv-Y0hZnzS0hAOHz9rrMEcTb011NIjAhtfQnwI',
    resave: false, // se utiliza false para evitar guardar la sesión si no ha habido cambios
    saveUninitialized: false, // no guardar sesiones no inicializadas
    store: sessionStore, // <-- Aquí
    cookie: { secure: false, sameSite: 'lax' } // Cambia secure a true si usas HTTPS
}));

// inicializar passport
app.use(passport.initialize());
app.use(passport.session());

// Serializacion de usuario
passport.serializeUser((user, done) => {
    done(null, user);
});
passport.deserializeUser((user, done) =>{
    done(null, user);
});


// configuracion de la estrategia de google
// Se usa para autenticar con Google
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:5000/auth/google/callback"
}, async (acessToken, refreshToken, profile, done) => {

    const correo = profile.emails[0].value; // Obtener el correo electrónico del perfil
    const nombre = profile.displayName; // Obtener el nombre de usuario del perfil

    const [rows] = await pool.query('SELECT * FROM usersjuego WHERE correo = ?', [correo]);

    if (rows.length === 0){
        await pool.query('INSERT INTO usersjuego (nombre, correo, password) VALUES (?, ?, ?)', [nombre, correo, 'google_oauth']);
    }

    // Guardar en la sesion
    return done(null, {id: profile.id, username: nombre, correo});

}));

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Middleware para deshabilitar caché en rutas protegidas
const noCache = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
};

// Middleware para verificar si el usuario está autenticado
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    } else {
        // Si la petición es AJAX o espera JSON, responde con JSON
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            return res.status(401).json({ success: false, message: 'No autenticado' });
        }
        // Si es una petición normal, redirige
        res.redirect('http://localhost:5000/registro');
    }
};


// Ruta para autenticar con Google y obtener el token
// Esta ruta es para recibir el token de Google desde el frontend
app.post('/auth/google/token', async (req, res) => {
    const { credential } = req.body;
    if (!credential) {
        return res.status(400).json({ success: false, message: 'Token no recibido' });
    }

    try {
        // Verifica el token
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();

        // Aquí puedes usar el email como username
        const correo = payload.email;
        const nombre = payload.name;
        const picture = payload.picture;

        let [rows] = await pool.query('SELECT * FROM usersjuego WHERE correo = ?', [correo]);
        if (rows.length === 0) {
            await pool.query('INSERT INTO usersjuego (nombre, correo, password, monedas) VALUES (?, ?, ?, ?)', [nombre, correo, 'google_oauth', 5]);
        }

        // Crea la sesión
        req.session.userId = payload.sub; // ID único de Google
        req.session.username = nombre; // Para mostrar
        req.session.correo = correo; // Para identificar
        req.session.picture = picture;

        res.json({ success: true, message: 'Autenticación exitosa' });
    } catch (error) {
        console.error('Error validando token de Google:', error);
        res.status(401).json({ success: false, message: 'Token inválido' });
    }
});

app.get('/get-user', (req, res) => {
    res.json({
        success: true,
        username: req.session.username,
        name: req.session.name || req.session.username,
        picture: req.session.picture || null
    })
});

// iniciar autenticacion con google
app.get('/auth/google', passport.authenticate('google', {scope:['profile', 'email']}));

// callback de google
app.get('/auth/google/callback', passport.authenticate('google', {failureRedirect: '/registro'}), (req, res) => {
    // Guardar usuario en la sesion
    req.session.userId = req.user.id;
    req.session.username = req.user.username;
    res.redirect('/'); // Redirigir a la página principal del juego
});

// Registrar usuario con bcrypt validacion estricta y escape
app.post('/register', async (req, res) => {
    let { username, password } = req.body;

    // Validación estricta
    if (
        !username || !password ||
        !validator.isAlphanumeric(username) || // Validar que el nombre de usuario solo contenga letras y números
        !validator.isLength(username, { min: 3, max: 20 }) || // Validar longitud del nombre de usuario
        !validator.isLength(password, { min: 6, max: 50 }) // Validar longitud de la contraseña
    ) {
        return res.status(400).json({ success: false, message: 'Datos inválidos' });
    }

    username = validator.escape(username); // Escapar el nombre de usuario para evitar inyecciones SQL

    try {// Hash de la contraseña, usando bcrypt
        // Generar un hash de la contraseña
        const saltRounds = 10; // Número de rondas de sal
        const salt = await bcrypt.genSalt(saltRounds); // Generar la sal
        const hashedPassword = await bcrypt.hash(password, salt);

        // Verificar si el usuario ya existe
        const [rows] = await pool.query('SELECT * FROM usersjuego WHERE nombre = ?', [username]);
        if (rows.length > 0) {
            return res.json({ success: false, message: 'El nombre de usuario ya existe' });
        }

        // Insertar el nuevo usuario
        await pool.query('INSERT INTO usersjuego (nombre, password) VALUES (?, ?)', [username, hashedPassword]);

        res.json({ success: true, message: 'Usuario registrado exitosamente' });
    } catch (error) {
        console.error('Error al registrar el usuario:', error);
        res.status(500).json({ success: false, message: 'Error al registrar el usuario' });
    }
});
 
// Login con validacion estricta y bloqueo temporal
app.post('/login', async (req, res) => {
    let { username, password } = req.body;

    // Validación estricta
    if (
        !username || !password ||
        !validator.isAlphanumeric(username) ||
        !validator.isLength(username, { min: 3, max: 20 }) ||
        !validator.isLength(password, { min: 6, max: 50 })
    ) {
        return res.status(400).json({ success: false, message: 'Datos inválidos' });
    }

    username = validator.escape(username);

    // Bloqueo temporal por intentos fallidos
    const ip = req.ip; // Obtener la IP del cliente
    const key = `${ip}_${username}`; // Crear una clave única para cada usuario e IP
    const now = Date.now(); // Obtener el tiempo actual

    // Si el usuario está bloqueado, verifica si el tiempo de bloqueo ha pasado
    if (loginAttempts[key] && loginAttempts[key].blockedUntil > now) { 
        return res.status(429).json({ success: false, message: 'Demasiados intentos fallidos. Intenta más tarde.' });
    }

    try {
        const [rows] = await pool.query('SELECT * FROM usersjuego WHERE nombre = ?', [username]);
        if (rows.length === 0) {
            // Incrementa intentos
            loginAttempts[key] = loginAttempts[key] || { count: 0, blockedUntil: 0 }; // Inicializa intentos
            loginAttempts[key].count++; 
            if (loginAttempts[key].count >= MAX_ATTEMPTS) { // Si se alcanza el máximo de intentos // Bloquea al usuario por un tiempo
                loginAttempts[key].blockedUntil = now + BLOCK_TIME;
            }
            return res.status(401).json({ success: false, message: 'El usuario no existe.' });
        }
        const user = rows[0]; // Obtener el primer usuario encontrado
        const passwordMatch = await bcrypt.compare(password, user.password); // Comparar la contraseña ingresada con la almacenada
        if (!passwordMatch) {
            // Incrementa intentos
            loginAttempts[key] = loginAttempts[key] || { count: 0, blockedUntil: 0 };
            loginAttempts[key].count++;
            if (loginAttempts[key].count >= MAX_ATTEMPTS) {
                loginAttempts[key].blockedUntil = now + BLOCK_TIME;
            }
            return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
        }

        // Login exitoso: limpia los intentos
        delete loginAttempts[key];
        req.session.userId = user.id_jugador;
        req.session.username = user.nombre;
        res.json({ success: true, message: 'Inicio de sesión exitoso' });
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.status(500).json({ success: false, message: 'Error al iniciar sesión' });
    }
});


// Ruta para servir la página de registro
app.get('/registro', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0'); // Deshabilitar caché
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, '../frontend', 'RegisterUsuario.html'));
});

// Servir archivos estáticos desde la carpeta "frontend"
app.use(express.static(path.join(__dirname, '../frontend')));


// Ruta para servir la página principal del juego (PROTEGIDA POR AUTENTICACIÓN)
app.get('/', requireAuth, noCache, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// Ruta para actualizar el nivel y los puntos del usuario
app.post('/actualizar-puntaje', requireAuth, async (req, res) => {
    const { nivel, puntos, monedas } = req.body;

    if (!nivel || !puntos || monedas === undefined) {
        return res.status(400).json({ success: false, message: 'Datos incompletos' });
    }

    try {
        console.log('Sesión:', req.session); // <-- Agrega esto para depurar
        await pool.query('UPDATE usersjuego SET nivel = ?, puntos = ?, monedas = ? WHERE correo = ?', [nivel, puntos, monedas, req.session.correo]);
        res.json({ success: true, message: 'Puntaje actualizado exitosamente' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al actualizar el puntaje' });
    }
});

// Ruta para obtener las monedas del usuario
app.post('/get-monedas', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT monedas FROM usersjuego WHERE correo = ?', [req.session.correo]);
        if (rows.length > 0) {
            res.json({ success: true, monedas: rows[0].monedas });
        } else {
            res.json({ success: false, monedas: 0 });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener monedas' });
    }
});

// Ruta para cerrar sesión
app.post('/logout', (req, res) => {
    if (!req.session) {
        // Si no hay sesión, responde igual en JSON
        return res.json({ success: true, message: 'Sesión ya cerrada' });
    }
    req.session.destroy((err) => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
            return res.status(500).json({ success: false, message: 'Error al cerrar sesión' });
        }
        res.clearCookie('connect.sid', {path: '/'});
        res.json({ success: true, message: 'Sesión cerrada exitosamente' });
    });
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor del Juego corriendo en http://localhost:${port}/registro`);
});