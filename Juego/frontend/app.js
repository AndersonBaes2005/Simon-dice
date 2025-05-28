const API_URL = "http://localhost:5000/juego"; // Cambia según tu URL del backend
// Arrays para almacenar las secuencias del juego y del usuario
let gameseq = [];
let userseq = [];

// Variables para los elementos del DOM (colores)
let red = document.querySelector(".red");
let yellow = document.querySelector(".yellow");
let pink = document.querySelector(".pink");
let orange = document.querySelector(".orange");
let blue = document.querySelector(".blue");
let purple = document.querySelector(".purple");
let green = document.querySelector(".green");
let brown = document.querySelector(".brown");
let cyan = document.querySelector(".cyan");
let teal = document.querySelector(".teal");
let gray = document.querySelectorAll(".gray");
let black = document.querySelectorAll(".black");
const startButton = document.getElementById('startButton');
let monedas = 5;

//Resive el usuario del login mediante localStorage y lo muestra en el modal
document.addEventListener('DOMContentLoaded', function() {
    // 1. Obtener el usuario de la URL o localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const userFromURL = urlParams.get('user');
    const username = userFromURL || localStorage.getItem('username') || 'Invitado';

    if (username && username !== 'Invitado') {
        fetch('/get-monedas', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json' // <-- Agrega esto
            },
            credentials: 'include' // <-- Esto es clave para sesiones y se utiliza para enviar cookies
        })
        .then(res => {
            const contentType = res.headers.get('content-type');
            if (res.status === 401) {
                // Si no hay sesión, redirige al registro
                window.location.replace("http://localhost:5000/registro");
                return Promise.reject('No autenticado');
            }
            if (contentType && contentType.includes('application/json')) {
                return res.json();
            } else {
                throw new Error('Respuesta no es JSON');
            }
        })
        .then(data => {
            if (data.success) {
                monedas = data.monedas;
                localStorage.setItem('monedas', monedas);
                if (monedas <= 0) {
                    // Deshabilitar el juego si no tiene monedas
                    startButton.disabled = true;
                    document.querySelectorAll('.btns').forEach(btn => {
                        btn.style.pointerEvents = 'none';
                        btn.style.opacity = '0.5';
                    });
                }
            }
        });
    }
    
    if (userFromURL) {
        localStorage.setItem('username', userFromURL); // Guardar para futuras visitas
    }

    // 2. Mostrar el modal de confirmación o el nombre directamente
    if (username && username !== 'Invitado') {
        mostrarConfirmacionUsuario(username); // Mostrar modal de confirmación
    } else {
        mostrarNombreUsuario('Invitado'); // Mostrar como invitado
    }

    const startButton = document.getElementById('startButton');
    startButton.addEventListener('click', startOrRestartGame);

    // 4. Configurar botones del juego 
    document.querySelectorAll('.btns').forEach(btn => {
        btn.addEventListener('click', buttonpress);
    });

   // 5. Configurar el botón de cerrar sesión
    document.getElementById('logoutButton').addEventListener('click', function() {
        fetch('/logout', {
            method: 'POST',
            headers: {// este código le dice al servidor (o a quien reciba esta información) que los datos que se están enviando o esperando están estructurados como un objeto JSON.
                'Content-Type': 'application/json' 
            },
        })
        .then(response =>  {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return response.json();
            } else {
                throw new Error('Respuesta no es JSON');
            }
        })
        .then(data => {
            if (data.success) {
                localStorage.removeItem('username');
                window.location.replace("http://localhost:5000/registro"); // Usar replace en vez de href y esto evita que el usuario vuelva a la página anterior al hacer clic en "Atrás"
             } else {
                console.error('Error al cerrar sesión:', data.message);
                alert('Error al cerrar sesión');
            }
        })
        .catch(error => { // Adjunta una devolución de llamada solo por el rechazo de la promesa.
            console.error('Error al cerrar sesión:', error);
            alert('Error de red al cerrar sesión');
        });
    });


    // 5. Función para mostrar el nombre en la interfaz
    function mostrarNombreUsuario(nombre) {
        const nombreUsuarioTexto = document.getElementById('nombreUsuarioTexto');
        if (nombreUsuarioTexto) {
            nombreUsuarioTexto.textContent = nombre;
        }
    }

    // 6. Función para mostrar el modal de confirmación
    function mostrarConfirmacionUsuario(username) {
        const modal = document.getElementById('confirmModal');
        const confirmUsername = document.getElementById('confirmUsername');
        
        if (modal && confirmUsername) {
            confirmUsername.textContent = username;
            modal.style.display = 'block';

            // Botón "Confirmar"
            document.getElementById('confirmUser').onclick = function() {
                modal.style.display = 'none';
                mostrarNombreUsuario(username);
            };

            // Botón "Salir"
            document.getElementById('cancelUser').onclick = function() {
                modal.style.display = 'none';
                localStorage.removeItem('username');
                window.location.href = "http://localhost:5000/registro"; // Cambiar ${port} a 5000
            };
        }
    }
});



// Variables de estado del juego
let game = false; // Indica si el juego está en curso
let level = 0;    // Nivel actual del juego
let h2 = document.querySelector("h2"); // Elemento para mostrar el nivel
// Array de colores disponibles y variables de puntuación
let colours = ["red", "orange", "blue", "yellow", "pink", "purple", "green", "brown", "cyan", "teal", "gray", "black"];
let score = 0;
let highscore = document.querySelector("h3"); // Elemento para mostrar la puntuación más alta
highscore.textContent = 0;

// Función para iniciar o reiniciar el juego
function startOrRestartGame() {
    if (monedas <= 0) {
        return; // No permitir jugar si no hay intentos
    }else 
    if(!game) {
        game = true; // Inicia el juego
        level = 0;   // Reinicia el nivel
        gameseq = []; // Reinicia la secuencia del juego
        userseq = []; // Reinicia la secuencia del usuario
        levelup();   // Comienza el primer nivel
        startButton.textContent = "Reiniciar Juego"; // Cambia el texto del botón
    } else {
        // Si el juego ya está en curso, reinícialo
        game = false;
        startButton.textContent = "Iniciar Juego"; // Cambia el texto del botón
        h2.textContent = "¡Presiona el botón para empezar!"; // Muestra un mensaje
    }
}

// Asigna el evento al botón
startButton.addEventListener('click', startOrRestartGame);

// Función para hacer parpadear un botón (color)
function flash(btn) {
    btn.classList.add("flash"); // Añade la clase "flash" para el efecto visual
    setTimeout(function () {
        btn.classList.remove("flash"); // Remueve la clase después de 250ms
    }, 250);
}

// Función para hacer parpadear un botón cuando el usuario hace clic
function userflash(btn) {
    btn.classList.add("userflash"); // Añade la clase "userflash" para el efecto visual
    setTimeout(function () {
        btn.classList.remove("userflash"); // Remueve la clase después de 250ms
    }, 250);
}

// Función para avanzar al siguiente nivel
function levelup() {
    userseq = []; // Reinicia la secuencia del usuario
    level++;      // Incrementa el nivel
    h2.textContent = `Nivel ${level}`; // Actualiza el texto del nivel

    // Selecciona un color aleatorio y lo añade a la secuencia del juego
    let rand = Math.floor(Math.random() * 12);
    let randindex = colours[rand];
    let randcolour = document.querySelector(`.${randindex}`);
    gameseq.push(randindex); // Añade el color a la secuencia del juego
    console.log(gameseq);    // Muestra la secuencia en la consola (para depuración)
    flash(randcolour);       // Hace parpadear el color seleccionado
}

// Función que se ejecuta cuando el usuario hace clic en un botón
function buttonpress() {
    if (!game) {
        // Si el juego no ha comenzado, no hacer nada o mostrar un mensaje
        h2.textContent = "¡Presiona el boton para empezar!";
        return; // Salir de la función sin hacer nada más
    }

    let btn = this;
    let colour = btn.getAttribute("id"); // Obtiene el color del botón presionado
    userseq.push(colour);                // Añade el color a la secuencia del usuario
    userflash(btn);                      // Hace parpadear el botón
    checkass(userseq.length - 1);        // Verifica si la secuencia del usuario es correcta
}

// Asigna el evento de clic a todos los botones del juego
let allbtns = document.querySelectorAll(".btns");
for (btn of allbtns) {
    btn.addEventListener("click", buttonpress);
    console.log(btn); // Muestra el botón en la consola (para depuración)
}

// Función para verificar si la secuencia del usuario coincide con la del juego
function checkass(index) {
    if (gameseq[index] == userseq[index]) {
        // Si la secuencia coincide y está completa, avanza al siguiente nivel
        if (gameseq.length == userseq.length) {
            setTimeout(levelup, 1000); // Espera 1 segundo antes de avanzar
        }
    } else {
        // Si la secuencia no coincide, termina el juego
        highscore.textContent = Math.max(highscore.textContent, level - 1); // Actualiza la puntuación más alta
        h2.textContent = `¡Juego terminado! Tu puntaje fue: " ${level - 1} ". Presiona el boton para empezar de nuevo`;
        h2.style.fontFamily = "Arial, sans-serif"; // Cambia la fuente del mensaje
        setTimeout(gameover, 1000); // Espera 1 segundo antes de reiniciar el juego
    }
}

// Función para reiniciar el juego
function gameover() {
    monedas--;
    localStorage.setItem('monedas', monedas);

    // Actualiza las monedas en la base de datos
    const nivelActual = level;
    const puntosActuales = level - 1;
    actualizarPuntaje(nivelActual, puntosActuales, monedas);

    if (monedas <= 0) {
        // Mostrar modal de fin de juego
        const modalSalir = document.getElementById('Modalsalir');
        modalSalir.style.display = 'block';

        // Configurar botón Salir (igual que cerrar sesión)
        document.getElementById('SalirUser').onclick = function() {
            localStorage.removeItem('username');
            localStorage.removeItem('monedas');
            fetch('/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            .then(() => window.location.replace("http://localhost:5000/registro"));
        };

        // Deshabilitar el juego completamente
        game = false;
        startButton.disabled = true;
        document.querySelectorAll('.btns').forEach(btn => {
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.5';
        });
    } else {
        // Código normal de gameover para intentos restantes
        game = false;
        userseq = [];
        gameseq = [];
        const nivelActual = level;
        const puntosActuales = level - 1;

        actualizarPuntaje(nivelActual, puntosActuales);

        h2.innerText = `¡Perdiste! Te quedan ${monedas} intentos. Puntaje: ${puntosActuales}`;
        startButton.textContent = "Reintentar";
    }
}

   
// Modifica actualizarPuntaje para aceptar monedas
function actualizarPuntaje(nivel, puntos, monedas) {
    const nombreUsuario = localStorage.getItem('username') || 'Invitado';

    fetch('/actualizar-puntaje', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: nombreUsuario, nivel, puntos, monedas }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Puntaje actualizado exitosamente');
        } else {
            console.error('Error al actualizar el puntaje:', data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}