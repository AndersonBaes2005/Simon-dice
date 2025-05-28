const API_URL = "http://localhost:5000"; // Cambia según tu URL del backend

// Función para mostrar el formulario de registro
function showRegister() {
    document.getElementById('login').style.display = 'none';
    document.getElementById('register').style.display = 'block';
}

// Función para mostrar el formulario de login
function showLogin() {
    document.getElementById('register').style.display = 'none';
    document.getElementById('login').style.display = 'block';
}

// Registro de usuario
document.getElementById('registerForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerPasswordConfirm').value;

    if (password !== confirmPassword) {
        document.getElementById('registerMessage').textContent = "Las contraseñas no coinciden.";
        return;
    }
    // Verifica si el nombre de usuario ya existe
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        // Si el registro es exitoso, redirige al login
        if (response.ok) {
            document.getElementById('registerMessage').textContent = data.message;
            showLogin();
        } else {
            document.getElementById('registerMessage').textContent = data.message;
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('registerMessage').textContent = "Error al registrar usuario";
    }
});

document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    // Verifica si el nombre de usuario y la contraseña son válidos
    fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json()) // Convierte la respuesta a JSON y .then la maneja
    .then(data => { // Maneja la respuesta JSON
        if (data.success) {
            localStorage.setItem('username', username); // Guarda el nombre de usuario en localStorage

            // Ahora pide las monedas
            fetch('/get-monedas', {
                method: 'POST',
                headers: { // Agrega los encabezados necesarios
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include'
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    monedas = data.monedas; // Asigna las monedas obtenidas a la variable
                    localStorage.setItem('monedas', monedas);
                    // Redirige al juego junto con el nombre de usuario
                    window.location.href = `http://localhost:5000/?user=${encodeURIComponent(username)}`; 
                }
            });
        } else {
            document.getElementById('loginMessage').textContent = data.message;
        }
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('loginMessage').textContent = "Error al iniciar sesión";
    });
});