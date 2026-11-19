(function () {
    "use strict";

    var storageKey = "gameover-store-products-v1";
    var cartStorageKey = "gameover-store-cart-v1";
    var defaultReorderPoint = 5;
    var defaultTargetStock = 10;
    var categories = {
        "Acción": true,
        "Carreras": true,
        "Deportes": true,
        "Aventura": true
    };
    var images = {
        "p25.jpg": true,
        "p26.jpg": true,
        "p27.jpg": true,
        "p48.jpg": true,
        "p49.webp": true,
        "p46.jpg": true,
        "p45.webp": true,
        "p50.jpg": true
    };
    var initialProducts = [
        { id: "forza-horizon-5", name: "Forza Horizon 5", developer: "Playground Games", category: "Carreras", price: 59.99, stock: 12, image: "p25.jpg" },
        { id: "red-dead-redemption-2", name: "Red Dead Redemption 2", developer: "Rockstar Games", category: "Aventura", price: 39.99, stock: 8, image: "p26.jpg" },
        { id: "fifa-22", name: "FIFA 22", developer: "EA Sports", category: "Deportes", price: 29.99, stock: 5, image: "p27.jpg" },
        { id: "horizon-zero-dawn", name: "Horizon Zero Dawn", developer: "Guerrilla Games", category: "Acción", price: 24.99, stock: 7, image: "p48.jpg" },
        { id: "grand-theft-auto-v", name: "Grand Theft Auto V", developer: "Rockstar Games", category: "Acción", price: 19.99, stock: 10, image: "p49.webp" },
        { id: "f1-22", name: "F1 22", developer: "Codemasters", category: "Carreras", price: 49.99, stock: 4, image: "p46.jpg" },
        { id: "fortnite", name: "Fortnite", developer: "Epic Games", category: "Acción", price: 0, stock: 20, image: "p45.webp" },
        { id: "outriders", name: "Outriders", developer: "People Can Fly", category: "Acción", price: 21.99, stock: 6, image: "p50.jpg" }
    ];
    var products = [];
    var cart = new Map();
    var searchMode = "game";
    var storageAvailable = true;
    var editingImage = "";
    var uploadedProductImage = "";
    var imageReadInProgress = false;
    var imageReadToken = 0;
    var storeSection = document.querySelector(".storefront");
    var inventoryPage = document.getElementById("inventory-page");
    var productGrid = document.getElementById("product-grid");
    var cartItems = document.getElementById("cart-items");
    var storeMessage = document.getElementById("store-message");
    var inventoryMessage = document.getElementById("inventory-message");
    var currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" });

    function setMessage(element, message, isError) {
        element.textContent = message;
        element.classList.toggle("store-message--error", Boolean(isError));
    }

    function isAdmin() {
        var session = window.GameOverAuth.getSession();
        return Boolean(session && session.role === "admin");
    }

    function notify(message, isError) {
        var target = inventoryPage ? inventoryMessage : storeMessage;
        if (target) {
            setMessage(target, message, isError);
        }
    }

    function validProduct(product) {
        return product &&
            typeof product.id === "string" &&
            typeof product.name === "string" &&
            typeof product.developer === "string" &&
            categories[product.category] === true &&
            Number.isFinite(Number(product.price)) &&
            Number(product.price) >= 0 &&
            Number.isInteger(Number(product.stock)) &&
            Number(product.stock) >= 0 &&
            Number.isInteger(Number(product.reorderPoint)) &&
            Number(product.reorderPoint) >= 0 &&
            Number.isInteger(Number(product.targetStock)) &&
            Number(product.targetStock) > Number(product.reorderPoint) &&
            (images[product.image] === true || validUploadedImage(product.image));
    }

    function addStockDefaults(product) {
        var changed = false;
        if (!Object.prototype.hasOwnProperty.call(product, "reorderPoint")) {
            product.reorderPoint = defaultReorderPoint;
            changed = true;
        }
        if (!Object.prototype.hasOwnProperty.call(product, "targetStock")) {
            product.targetStock = Math.max(defaultTargetStock, Number(product.reorderPoint) + 1);
            changed = true;
        }
        return changed;
    }

    function validUploadedImage(image) {
        return typeof image === "string" &&
            image.length <= 2 * 1024 * 1024 &&
            /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image);
    }

    function saveProducts() {
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(products));
            storageAvailable = true;
            return true;
        } catch (error) {
            storageAvailable = false;
            notify("No se pudo guardar el inventario en este navegador. Los cambios solo estarán disponibles mientras esta página siga abierta.", true);
            return false;
        }
    }

    function loadProducts() {
        try {
            var saved = window.localStorage.getItem(storageKey);
            if (saved === null) {
                products = initialProducts.slice();
                products.forEach(addStockDefaults);
                saveProducts();
                return;
            }

            var parsed = JSON.parse(saved);
            if (!Array.isArray(parsed)) {
                throw new Error("El inventario guardado no tiene un formato válido.");
            }
            var migrated = parsed.reduce(function (changed, product) {
                return addStockDefaults(product) || changed;
            }, false);
            if (!parsed.every(validProduct)) {
                throw new Error("El inventario guardado no tiene un formato válido.");
            }
            products = parsed;
            if (migrated) {
                saveProducts();
            }
        } catch (error) {
            products = initialProducts.slice();
            storageAvailable = false;
            notify("No se pudo leer el inventario guardado. Se muestran datos de demostración y los cambios no se conservarán.", true);
        }
    }

    function saveCart() {
        try {
            window.localStorage.setItem(cartStorageKey, JSON.stringify(Array.from(cart.entries())));
            return true;
        } catch (error) {
            storageAvailable = false;
            notify("No se pudo guardar el carrito en este navegador. El carrito solo estará disponible mientras esta página siga abierta.", true);
            return false;
        }
    }

    function loadCart() {
        try {
            var saved = window.localStorage.getItem(cartStorageKey);
            if (saved === null) {
                return;
            }

            var parsed = JSON.parse(saved);
            if (!Array.isArray(parsed)) {
                throw new Error("El carrito guardado no tiene un formato válido.");
            }

            parsed.forEach(function (entry) {
                if (!Array.isArray(entry) || entry.length !== 2 ||
                    typeof entry[0] !== "string" ||
                    !Number.isInteger(entry[1]) || entry[1] < 1) {
                    throw new Error("El carrito guardado contiene datos inválidos.");
                }
                var product = products.find(function (item) { return item.id === entry[0]; });
                if (!product || entry[1] > product.stock) {
                    throw new Error("El carrito guardado contiene un producto o una cantidad no disponible.");
                }
                cart.set(entry[0], entry[1]);
            });
        } catch (error) {
            cart.clear();
            storageAvailable = false;
            notify("No se pudo cargar el carrito guardado. Se inició un carrito vacío.", true);
        }
    }

    function productImage(product) {
        if (validUploadedImage(product.image)) {
            return product.image;
        }
        var image = images[product.image] ? product.image : "p25.jpg";
        return "assets/img/" + image;
    }

    function makeButton(text, className, action, productId) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = text;
        button.dataset.action = action;
        button.dataset.productId = productId;
        return button;
    }

    function renderProducts() {
        if (!productGrid) {
            return;
        }
        var query = document.getElementById("store-search-input").value.trim().toLocaleLowerCase();
        var category = document.getElementById("category-filter").value;
        var sort = document.getElementById("sort-products").value;
        var visibleProducts = products.filter(function (product) {
            var field = searchMode === "developer" ? product.developer : product.name;
            return field.toLocaleLowerCase().indexOf(query) !== -1 &&
                (!category || product.category === category);
        });

        if (sort === "name") {
            visibleProducts.sort(function (a, b) { return a.name.localeCompare(b.name); });
        } else if (sort === "price-low") {
            visibleProducts.sort(function (a, b) { return Number(a.price) - Number(b.price); });
        } else if (sort === "price-high") {
            visibleProducts.sort(function (a, b) { return Number(b.price) - Number(a.price); });
        }

        productGrid.replaceChildren();
        if (visibleProducts.length === 0) {
            var empty = document.createElement("p");
            empty.className = "store-empty";
            empty.textContent = "No encontramos videojuegos con esos filtros.";
            productGrid.appendChild(empty);
            return;
        }

        visibleProducts.forEach(function (product) {
            var card = document.createElement("article");
            card.className = "store-product";

            var image = document.createElement("div");
            image.className = "store-product__image";
            image.setAttribute("role", "img");
            image.setAttribute("aria-label", "Portada de " + product.name);
            image.style.backgroundImage = "url('" + productImage(product) + "')";

            var body = document.createElement("div");
            body.className = "store-product__body";
            var tag = document.createElement("span");
            tag.className = "store-product__category";
            tag.textContent = product.category;

            var title = document.createElement("h3");
            title.textContent = product.name;
            var developer = document.createElement("p");
            developer.className = "store-product__developer";
            developer.textContent = product.developer;
            var stock = document.createElement("p");
            stock.className = "store-product__stock";
            stock.textContent = product.stock > 0 ? "Disponibles: " + product.stock : "Agotado";

            var footer = document.createElement("div");
            footer.className = "store-product__footer";
            var price = document.createElement("span");
            price.className = "store-product__price";
            price.textContent = product.price === 0 ? "Gratis" : currency.format(Number(product.price));
            var inCart = cart.get(product.id) || 0;
            var addButton = makeButton("Agregar", "store-button", "add", product.id);
            addButton.disabled = product.stock <= inCart;
            footer.append(price, addButton);
            body.append(tag, title, developer, stock, footer);
            card.append(image, body);
            productGrid.appendChild(card);
        });
    }

    function renderCart() {
        var totalQuantity = 0;
        var totalPrice = 0;
        if (cartItems) {
            cartItems.replaceChildren();
        }

        cart.forEach(function (quantity, id) {
            var product = products.find(function (item) { return item.id === id; });
            if (!product) {
                return;
            }
            totalQuantity += quantity;
            totalPrice += Number(product.price) * quantity;
            if (!cartItems) {
                return;
            }

            var row = document.createElement("div");
            row.className = "cart-item";
            var name = document.createElement("span");
            name.className = "cart-item__name";
            name.textContent = product.name;
            var controls = document.createElement("div");
            controls.className = "cart-item__controls";
            controls.append(
                makeButton("-", "cart-item__decrease", "decrease", id)
            );
            var count = document.createElement("span");
            count.textContent = String(quantity);
            var increase = makeButton("+", "cart-item__increase", "increase", id);
            increase.disabled = quantity >= product.stock;
            controls.append(count, increase);
            var remove = makeButton("Quitar", "cart-item__remove", "remove", id);
            row.append(name, controls, remove);
            cartItems.appendChild(row);
        });

        if (cartItems && totalQuantity === 0) {
            var empty = document.createElement("p");
            empty.textContent = "Aún no agregas juegos.";
            cartItems.appendChild(empty);
        }
        var cartCount = document.getElementById("cart-count");
        var headerCartCount = document.getElementById("header-cart-count");
        var cartTotal = document.getElementById("cart-total");
        var checkoutButton = document.getElementById("checkout-button");
        if (cartCount) {
            cartCount.textContent = String(totalQuantity);
        }
        if (headerCartCount) {
            headerCartCount.textContent = String(totalQuantity);
        }
        if (cartTotal) {
            cartTotal.textContent = currency.format(totalPrice);
        }
        if (checkoutButton) {
            checkoutButton.disabled = totalQuantity === 0;
        }
    }

    function renderInventory() {
        var tableBody = document.getElementById("inventory-table-body");
        var alertList = document.getElementById("inventory-alert-list");
        if (!tableBody) {
            return;
        }
        if (!isAdmin()) {
            tableBody.replaceChildren();
            alertList.replaceChildren();
            document.getElementById("inventory-product-count").textContent = "0";
            document.getElementById("inventory-stock-count").textContent = "0";
            document.getElementById("inventory-low-count").textContent = "0";
            document.getElementById("inventory-out-count").textContent = "0";
            return;
        }
        var stockCount = 0;
        var lowCount = 0;
        var outCount = 0;
        tableBody.replaceChildren();
        alertList.replaceChildren();

        var productsNeedingRestock = products.filter(function (product) {
            return Number(product.stock) <= Number(product.reorderPoint);
        }).sort(function (first, second) {
            return Number(first.stock) - Number(second.stock) ||
                first.name.localeCompare(second.name, "es");
        });

        if (productsNeedingRestock.length === 0) {
            var clearMessage = document.createElement("p");
            clearMessage.className = "inventory-alert inventory-alert--clear";
            clearMessage.textContent = "Todos los productos están por encima de su mínimo de alerta.";
            alertList.appendChild(clearMessage);
        }

        productsNeedingRestock.forEach(function (product) {
            var stock = Number(product.stock);
            var target = Number(product.targetStock);
            var quantityToRestock = target - stock;
            var alert = document.createElement("article");
            alert.className = stock === 0 ? "inventory-alert inventory-alert--critical" : "inventory-alert";

            var details = document.createElement("div");
            details.className = "inventory-alert__details";
            var name = document.createElement("h3");
            name.textContent = product.name;
            var description = document.createElement("p");
            description.textContent = stock === 0
                ? "Agotado. Objetivo: " + target + " unidades."
                : "Quedan " + stock + " (mínimo: " + product.reorderPoint + "). Objetivo: " + target + ".";
            details.append(name, description);
            alert.append(
                details,
                makeButton(
                    "Registrar recepción (+" + quantityToRestock + ")",
                    "store-button inventory-alert__button",
                    "restock",
                    product.id
                )
            );
            alertList.appendChild(alert);
        });

        products.forEach(function (product) {
            var availableStock = Number(product.stock);
            var reorderPoint = Number(product.reorderPoint);
            stockCount += availableStock;
            if (availableStock <= reorderPoint) {
                lowCount += 1;
            }
            if (availableStock === 0) {
                outCount += 1;
            }

            var row = document.createElement("tr");
            var productCell = document.createElement("td");
            var productInfo = document.createElement("div");
            productInfo.className = "inventory-table__product";
            var image = document.createElement("img");
            image.src = productImage(product);
            image.alt = "";
            var name = document.createElement("span");
            name.textContent = product.name;
            productInfo.append(image, name);
            productCell.appendChild(productInfo);

            var category = document.createElement("td");
            category.textContent = product.category;
            var price = document.createElement("td");
            price.textContent = currency.format(Number(product.price));
            var stock = document.createElement("td");
            stock.textContent = String(availableStock);
            if (availableStock === 0) {
                stock.className = "stock-status--empty";
                stock.textContent += " (agotado)";
            } else if (availableStock <= reorderPoint) {
                stock.className = "stock-status--low";
                stock.textContent += " (reponer)";
            }
            var minimum = document.createElement("td");
            minimum.textContent = String(reorderPoint);
            var target = document.createElement("td");
            target.textContent = String(product.targetStock);
            var status = document.createElement("td");
            status.className = availableStock === 0
                ? "stock-status--empty"
                : availableStock <= reorderPoint
                    ? "stock-status--low"
                    : "stock-status--ok";
            status.textContent = availableStock === 0
                ? "Agotado"
                : availableStock <= reorderPoint
                    ? "Reponer"
                    : "Suficiente";
            var actions = document.createElement("td");
            actions.append(
                makeButton("Editar", "inventory-edit", "edit", product.id),
                document.createTextNode(" "),
                makeButton("Eliminar", "inventory-delete", "delete", product.id)
            );
            row.append(productCell, category, price, stock, minimum, target, status, actions);
            tableBody.appendChild(row);
        });

        document.getElementById("inventory-product-count").textContent = String(products.length);
        document.getElementById("inventory-stock-count").textContent = String(stockCount);
        document.getElementById("inventory-low-count").textContent = String(lowCount);
        document.getElementById("inventory-out-count").textContent = String(outCount);
    }

    function renderAll() {
        renderProducts();
        renderCart();
        renderInventory();
    }

    function requestAdminAccess() {
        if (!isAdmin()) {
            window.location.href = "Login.html?admin=1";
        }
    }

    function resetProductForm() {
        document.getElementById("product-form").reset();
        document.getElementById("product-id").value = "";
        document.getElementById("product-form-title").textContent = "Agregar videojuego";
        document.getElementById("save-product-button").textContent = "Guardar producto";
        document.getElementById("cancel-edit-button").hidden = true;
        document.getElementById("save-product-button").disabled = false;
        document.getElementById("product-image-preview").hidden = true;
        document.getElementById("product-image-preview").removeAttribute("src");
        imageReadToken += 1;
        editingImage = "";
        uploadedProductImage = "";
        imageReadInProgress = false;
    }

    function startEditing(product) {
        document.getElementById("product-id").value = product.id;
        document.getElementById("product-name").value = product.name;
        document.getElementById("product-developer").value = product.developer;
        document.getElementById("product-category").value = product.category;
        document.getElementById("product-price").value = product.price;
        document.getElementById("product-stock").value = product.stock;
        document.getElementById("product-reorder-point").value = product.reorderPoint;
        document.getElementById("product-target-stock").value = product.targetStock;
        document.getElementById("product-image").value = images[product.image] ? product.image : "";
        document.getElementById("product-image-file").value = "";
        document.getElementById("product-image-preview").src = productImage(product);
        document.getElementById("product-image-preview").hidden = false;
        imageReadToken += 1;
        imageReadInProgress = false;
        document.getElementById("save-product-button").disabled = false;
        document.getElementById("product-form-title").textContent = "Editar videojuego";
        document.getElementById("save-product-button").textContent = "Guardar cambios";
        document.getElementById("cancel-edit-button").hidden = false;
        editingImage = product.image;
        uploadedProductImage = "";
        document.getElementById("product-name").focus();
    }

    function processProductImage(file, callback) {
        if (!file) {
            callback("");
            return;
        }
        var allowedTypes = {
            "image/jpeg": true,
            "image/png": true,
            "image/webp": true
        };
        if (!allowedTypes[file.type]) {
            callback("", "Elige una imagen JPG, PNG o WebP.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            callback("", "La imagen supera el límite de 5 MB.");
            return;
        }

        var reader = new FileReader();
        reader.onerror = function () {
            callback("", "No se pudo leer el archivo de imagen.");
        };
        reader.onload = function () {
            var source = new Image();
            source.onerror = function () {
                callback("", "El archivo seleccionado no es una imagen válida.");
            };
            source.onload = function () {
                var maxWidth = 900;
                var maxHeight = 1200;
                var scale = Math.min(1, maxWidth / source.naturalWidth, maxHeight / source.naturalHeight);
                var canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
                canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
                var context = canvas.getContext("2d");
                if (!context) {
                    callback("", "El navegador no pudo procesar la imagen.");
                    return;
                }
                context.fillStyle = "#fff";
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.drawImage(source, 0, 0, canvas.width, canvas.height);
                try {
                    var imageData = canvas.toDataURL("image/jpeg", 0.82);
                    if (!validUploadedImage(imageData)) {
                        callback("", "No se pudo comprimir la imagen. Prueba con otro archivo.");
                        return;
                    }
                    callback(imageData);
                } catch (error) {
                    callback("", "No se pudo procesar la imagen seleccionada.");
                }
            };
            source.src = reader.result;
        };
        reader.readAsDataURL(file);
    }

    function changeCart(action, id) {
        var product = products.find(function (item) { return item.id === id; });
        if (!product) {
            notify("Este videojuego ya no está disponible.", true);
            return;
        }
        var quantity = cart.get(id) || 0;
        if (action === "add" || action === "increase") {
            if (quantity >= product.stock) {
                notify("No hay suficientes existencias de " + product.name + ".", true);
                return;
            }
            cart.set(id, quantity + 1);
        } else if (action === "decrease") {
            if (quantity <= 1) {
                cart.delete(id);
            } else {
                cart.set(id, quantity - 1);
            }
        } else if (action === "remove") {
            cart.delete(id);
        }
        var saved = saveCart();
        renderAll();
        if (saved && storeMessage) {
            setMessage(storeMessage, "", false);
        }
    }

    var searchForm = document.getElementById("store-search-form");
    if (searchForm) {
        searchForm.addEventListener("submit", function (event) {
            event.preventDefault();
            renderProducts();
            storeSection.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        document.getElementById("store-search-input").addEventListener("input", renderProducts);
        document.getElementById("category-filter").addEventListener("change", renderProducts);
        document.getElementById("sort-products").addEventListener("change", renderProducts);
    }

    if (productGrid) {
        productGrid.addEventListener("click", function (event) {
            var button = event.target.closest("button[data-action='add']");
            if (button) {
                changeCart("add", button.dataset.productId);
            }
        });
    }
    if (cartItems) {
        cartItems.addEventListener("click", function (event) {
            var button = event.target.closest("button[data-action]");
            if (button) {
                changeCart(button.dataset.action, button.dataset.productId);
            }
        });
    }

    var checkoutButton = document.getElementById("checkout-button");
    if (checkoutButton) {
        checkoutButton.addEventListener("click", function () {
            if (cart.size === 0) {
                return;
            }
            var unavailable = [];
            cart.forEach(function (quantity, id) {
                var product = products.find(function (item) { return item.id === id; });
                if (!product || product.stock < quantity) {
                    unavailable.push(product ? product.name : id);
                }
            });
            if (unavailable.length) {
                notify("Existencias insuficientes para: " + unavailable.join(", ") + ". Revisa tu carrito.", true);
                renderAll();
                return;
            }
            if (!window.confirm("¿Confirmas esta compra de demostración? No se realizará ningún pago.")) {
                return;
            }
            products = products.map(function (product) {
                return Object.assign({}, product, { stock: Number(product.stock) - (cart.get(product.id) || 0) });
            });
            cart.clear();
            var inventorySaved = saveProducts();
            var cartSaved = saveCart();
            renderAll();
            var saved = inventorySaved && cartSaved;
            notify(saved ? "Compra registrada. El inventario se actualizó." : "Compra registrada solo durante esta sesión; no se pudo guardar el inventario o el carrito.", !saved);
        });
    }

    var productForm = document.getElementById("product-form");
    if (productForm) {
        var imageFileInput = document.getElementById("product-image-file");
        var imagePreview = document.getElementById("product-image-preview");
        var saveProductButton = document.getElementById("save-product-button");
        imageFileInput.addEventListener("change", function () {
            imageReadToken += 1;
            var requestToken = imageReadToken;
            var file = imageFileInput.files[0];
            uploadedProductImage = "";
            if (!file) {
                imageReadInProgress = false;
                saveProductButton.disabled = false;
                imagePreview.hidden = !editingImage;
                if (editingImage) {
                    imagePreview.src = productImage({ image: editingImage });
                } else {
                    imagePreview.removeAttribute("src");
                }
                return;
            }

            imageReadInProgress = true;
            saveProductButton.disabled = true;
            processProductImage(file, function (imageData, error) {
                if (requestToken !== imageReadToken) {
                    return;
                }
                imageReadInProgress = false;
                saveProductButton.disabled = false;
                if (error) {
                    imageFileInput.value = "";
                    imagePreview.hidden = !editingImage;
                    if (editingImage) {
                        imagePreview.src = productImage({ image: editingImage });
                    } else {
                        imagePreview.removeAttribute("src");
                    }
                    notify(error, true);
                    return;
                }
                uploadedProductImage = imageData;
                imagePreview.src = imageData;
                imagePreview.hidden = false;
                notify("Portada lista para guardar.", false);
            });
        });

        productForm.addEventListener("submit", function (event) {
            event.preventDefault();
            if (!isAdmin()) {
                requestAdminAccess();
                return;
            }
            if (imageReadInProgress) {
                notify("Espera a que termine el procesamiento de la portada.", true);
                return;
            }
            var id = document.getElementById("product-id").value;
            var product = {
                id: id || ("game-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
                name: document.getElementById("product-name").value.trim(),
                developer: document.getElementById("product-developer").value.trim(),
                category: document.getElementById("product-category").value,
                price: Number(document.getElementById("product-price").value),
                stock: Number(document.getElementById("product-stock").value),
                reorderPoint: Number(document.getElementById("product-reorder-point").value),
                targetStock: Number(document.getElementById("product-target-stock").value),
                image: uploadedProductImage || document.getElementById("product-image").value || editingImage
            };
            if (!product.name || !product.developer || !validProduct(product)) {
                notify("Revisa los datos: el objetivo debe ser mayor al mínimo y debes elegir una portada o subir una imagen.", true);
                return;
            }
            var existingIndex = products.findIndex(function (item) { return item.id === id; });
            var previousProducts = products.slice();
            if (existingIndex === -1) {
                products.push(product);
            } else {
                products[existingIndex] = product;
            }
            if (!saveProducts()) {
                products = previousProducts;
                renderAll();
                return;
            }
            notify(existingIndex === -1 ? "Videojuego agregado al catálogo." : "Cambios guardados.", false);
            resetProductForm();
            renderAll();
        });
        document.getElementById("cancel-edit-button").addEventListener("click", resetProductForm);
    }

    function registerRestock(product) {
        var quantity = Number(product.targetStock) - Number(product.stock);
        if (quantity <= 0) {
            notify(product.name + " ya alcanzó su stock objetivo.", true);
            return;
        }
        var previousStock = product.stock;
        product.stock = Number(product.stock) + quantity;
        if (!saveProducts()) {
            product.stock = previousStock;
            renderAll();
            return;
        }
        renderAll();
        notify("Recepción registrada: +" + quantity + " unidades de " + product.name + ". Nuevo stock: " + product.stock + ".", false);
    }

    if (inventoryPage) {
        inventoryPage.addEventListener("click", function (event) {
            if (!isAdmin()) {
                requestAdminAccess();
                return;
            }
            var button = event.target.closest("button[data-action]");
            if (!button || !inventoryPage.contains(button)) {
                return;
            }
            var product = products.find(function (item) { return item.id === button.dataset.productId; });
            if (!product) {
                notify("No se encontró el videojuego seleccionado.", true);
                return;
            }
            if (button.dataset.action === "edit") {
                startEditing(product);
                return;
            }
            if (button.dataset.action === "restock") {
                registerRestock(product);
                return;
            }
            if (button.dataset.action === "delete" && window.confirm("¿Eliminar " + product.name + " del inventario?")) {
                products = products.filter(function (item) { return item.id !== product.id; });
                cart.delete(product.id);
                var inventorySaved = saveProducts();
                var cartSaved = saveCart();
                renderAll();
                var saved = inventorySaved && cartSaved;
                notify(saved ? "Videojuego eliminado." : "Videojuego eliminado solo durante esta sesión; no se pudo guardar el inventario o el carrito.", !saved);
            }
        });
    }

    var logoutButton = document.getElementById("logout-button");
    if (logoutButton) {
        logoutButton.addEventListener("click", function () {
            window.GameOverAuth.signOut();
            window.location.href = "Home.html";
        });
    }

    var searchToggle = document.querySelector(".main-btn");
    var searchOptions = document.querySelector(".search-description");
    if (searchToggle && searchOptions) {
        searchToggle.addEventListener("click", function () {
            var isOpen = searchToggle.getAttribute("aria-expanded") === "true";
            searchToggle.setAttribute("aria-expanded", String(!isOpen));
            searchOptions.style.display = isOpen ? "none" : "block";
        });
        searchOptions.addEventListener("click", function (event) {
            var option = event.target.closest("li[data-search-mode]");
            if (!option) {
                return;
            }
            searchMode = option.dataset.searchMode;
            document.querySelector(".search-large").textContent = searchMode === "developer" ? "Desarrollador" : "Juego";
            document.getElementById("store-search-input").placeholder = searchMode === "developer" ? "Buscar desarrollador" : "Buscar videojuegos";
            searchToggle.setAttribute("aria-expanded", "false");
            searchOptions.style.display = "none";
            renderProducts();
        });
    }

    window.addEventListener("storage", function (event) {
        if (event.key === storageKey) {
            if (event.newValue === null) {
                products = initialProducts.slice();
            } else {
                try {
                    var updated = JSON.parse(event.newValue);
                    if (!Array.isArray(updated) || !updated.every(validProduct)) {
                        throw new Error("El inventario actualizado no tiene un formato válido.");
                    }
                    products = updated;
                    cart.forEach(function (quantity, id) {
                        var product = products.find(function (item) { return item.id === id; });
                        if (!product || quantity > product.stock) {
                            cart.delete(id);
                        }
                    });
                    saveCart();
                } catch (error) {
                    notify("Otra pestaña guardó un inventario inválido; se conserva la vista actual.", true);
                    return;
                }
            }
            renderAll();
            notify("El inventario se actualizó desde otra pestaña.", false);
        } else if (event.key === cartStorageKey) {
            if (event.newValue === null) {
                cart.clear();
            } else {
                try {
                    var savedCart = JSON.parse(event.newValue);
                    if (!Array.isArray(savedCart)) {
                        throw new Error("El carrito actualizado no tiene un formato válido.");
                    }
                    var updatedCart = new Map();
                    savedCart.forEach(function (entry) {
                        var product = Array.isArray(entry) && products.find(function (item) {
                            return item.id === entry[0];
                        });
                        if (!product || !Number.isInteger(entry[1]) || entry[1] < 1 || entry[1] > product.stock) {
                            throw new Error("El carrito actualizado contiene datos inválidos.");
                        }
                        updatedCart.set(entry[0], entry[1]);
                    });
                    cart = updatedCart;
                } catch (error) {
                    notify("Otra pestaña guardó un carrito inválido; se conserva el carrito actual.", true);
                    return;
                }
            }
            renderAll();
            notify("El carrito se actualizó desde otra pestaña.", false);
        }
    });

    if (inventoryPage && !isAdmin()) {
        window.location.replace("Login.html?admin=1");
        return;
    }
    if (inventoryPage) {
        inventoryPage.hidden = false;
    }

    loadProducts();
    loadCart();
    renderAll();
    if (!storageAvailable) {
        var storageWarning = (storeMessage && storeMessage.textContent) ||
            (inventoryMessage && inventoryMessage.textContent);
        if (storageWarning) {
            if (storeMessage) {
                setMessage(storeMessage, storageWarning, true);
            }
            if (inventoryMessage) {
                setMessage(inventoryMessage, storageWarning, true);
            }
        }
    }
}());
