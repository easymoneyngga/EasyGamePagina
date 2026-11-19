# GameOver

Tienda estática de videojuegos con catálogo, búsqueda, filtros, carrito e inventario de demostración.

## Uso

- Abre `Home.html` para explorar el catálogo y agregar juegos; iniciar sesión no es obligatorio.
- `Cart.html` contiene el carrito y la confirmación de compra de demostración.
- Desde **Iniciar sesión** puedes crear una cuenta de usuario o entrar con el rol administrador.
- El registro solo crea cuentas de usuario. Para probar el rol administrador, usa `admin` / `gameover-admin` en el formulario de inicio de sesión.
- `Inventory.html` es el panel separado para consultar, agregar, editar y eliminar juegos; requiere una sesión admin.
- Al agregar o editar un juego se puede subir una portada JPG, PNG o WebP de hasta 5 MB. La imagen se optimiza y se guarda en el almacenamiento local de este navegador; no se envía a un servidor.
- Cada producto tiene un mínimo de existencias y un stock objetivo. El panel alerta cuando llega al mínimo, sugiere cuánto reponer y permite registrar la recepción para recuperar el objetivo.
- Carrito, cuentas e inventario se guardan en el almacenamiento local del navegador. La compra es una simulación y descuenta existencias.

## Limitaciones de seguridad

Este proyecto no tiene servidor. Las alertas solo aparecen al abrir el panel de inventario y los datos se guardan en este navegador; no hay notificaciones externas ni sincronización entre dispositivos. Los roles y datos del navegador son solo demostrativos: el código y las credenciales de administrador están disponibles para quien pueda inspeccionar la página y el almacenamiento local puede alterarse. Para proteger cuentas e inventario en producción se necesita autenticación y autorización del lado del servidor, además de una base de datos. No se procesan pagos reales.
