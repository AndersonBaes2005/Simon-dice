// Función para obtener y mostrar los puntajes
function obtenerPuntajes() {
    fetch('/puntajes')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const tabla = document.getElementById('tablaPuntajes').getElementsByTagName('tbody')[0];
                tabla.innerHTML = ''; // Limpiar la tabla antes de llenarla

                // Llenar la tabla con los datos
                data.puntajes.forEach((puntaje, index) => {
                    const fila = tabla.insertRow();
                    const celdaPosicion = fila.insertCell(0);
                    const celdaNombre = fila.insertCell(1);
                    const celdaNivel = fila.insertCell(2);
                    const celdaPuntos = fila.insertCell(3);

                    celdaPosicion.textContent = index + 1;
                    celdaNombre.textContent = puntaje.nombre;
                    celdaNivel.textContent = puntaje.nivel;
                    celdaPuntos.textContent = puntaje.puntos;
                });
            } else {
                console.error('Error al obtener los puntajes:', data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// Llamar a la función para obtener los puntajes al cargar la página
window.onload = () => {
    obtenerPuntajes(); // Cargar los puntajes inicialmente

    // Actualizar la tabla automáticamente cada 5 segundos
    setInterval(obtenerPuntajes, 5000);
};