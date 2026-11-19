(function () {
    "use strict";

    var usersKey = "gameover-store-users-v1";
    var sessionKey = "gameover-store-session-v1";
    var adminUsername = "admin";
    var adminPassword = "gameover-admin";

    function readUsers() {
        var saved = window.localStorage.getItem(usersKey);
        if (saved === null) {
            return [];
        }
        var users = JSON.parse(saved);
        if (!Array.isArray(users) || !users.every(function (user) {
            return user && typeof user.username === "string" &&
                typeof user.email === "string" && typeof user.salt === "string" &&
                typeof user.passwordHash === "string";
        })) {
            throw new Error("Las cuentas guardadas tienen un formato inválido.");
        }
        return users;
    }

    function encodeBytes(bytes) {
        var binary = "";
        bytes.forEach(function (byte) {
            binary += String.fromCharCode(byte);
        });
        return window.btoa(binary);
    }

    function hashPassword(password, salt) {
        if (!window.crypto || !window.crypto.subtle || !window.TextEncoder) {
            return Promise.reject(new Error("Este navegador no permite proteger las contraseñas de las cuentas."));
        }
        return window.crypto.subtle.importKey(
            "raw",
            new window.TextEncoder().encode(password),
            "PBKDF2",
            false,
            ["deriveBits"]
        ).then(function (key) {
            return window.crypto.subtle.deriveBits({
                name: "PBKDF2",
                salt: new window.TextEncoder().encode(salt),
                iterations: 120000,
                hash: "SHA-256"
            }, key, 256);
        }).then(function (derivedKey) {
            return encodeBytes(new Uint8Array(derivedKey));
        });
    }

    function createSession(username, role) {
        var session = { username: username, role: role };
        window.sessionStorage.setItem(sessionKey, JSON.stringify(session));
        return session;
    }

    function getSession() {
        try {
            var value = window.sessionStorage.getItem(sessionKey);
            if (!value) {
                return null;
            }
            var session = JSON.parse(value);
            if (!session || typeof session.username !== "string" ||
                (session.role !== "user" && session.role !== "admin")) {
                throw new Error("La sesión guardada tiene un formato inválido.");
            }
            return session;
        } catch (error) {
            window.sessionStorage.removeItem(sessionKey);
            return null;
        }
    }

    function signIn(username, password) {
        var normalizedUsername = username.trim().toLocaleLowerCase();
        if (normalizedUsername === adminUsername) {
            if (password !== adminPassword) {
                return Promise.reject(new Error("Usuario o contraseña incorrectos."));
            }
            return Promise.resolve(createSession(adminUsername, "admin"));
        }

        var users;
        try {
            users = readUsers();
        } catch (error) {
            return Promise.reject(error);
        }
        var user = users.find(function (item) {
            return item.username.toLocaleLowerCase() === normalizedUsername;
        });
        if (!user) {
            return Promise.reject(new Error("Usuario o contraseña incorrectos."));
        }
        return hashPassword(password, user.salt).then(function (passwordHash) {
            if (passwordHash !== user.passwordHash) {
                throw new Error("Usuario o contraseña incorrectos.");
            }
            return createSession(user.username, "user");
        });
    }

    function register(username, email, password) {
        var normalizedUsername = username.trim();
        var normalizedEmail = email.trim().toLocaleLowerCase();
        if (!/^[a-zA-Z0-9._-]{3,30}$/.test(normalizedUsername)) {
            return Promise.reject(new Error("El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo."));
        }
        if (normalizedUsername.toLocaleLowerCase() === adminUsername) {
            return Promise.reject(new Error("Ese nombre de usuario está reservado."));
        }
        if (password.length < 8) {
            return Promise.reject(new Error("La contraseña debe tener al menos 8 caracteres."));
        }

        var users;
        try {
            users = readUsers();
        } catch (error) {
            return Promise.reject(error);
        }
        if (users.some(function (user) {
            return user.username.toLocaleLowerCase() === normalizedUsername.toLocaleLowerCase() ||
                user.email.toLocaleLowerCase() === normalizedEmail;
        })) {
            return Promise.reject(new Error("Ya existe una cuenta con ese usuario o correo."));
        }
        if (!window.crypto || !window.crypto.getRandomValues) {
            return Promise.reject(new Error("Este navegador no permite crear una contraseña protegida."));
        }

        var saltBytes = new Uint8Array(16);
        window.crypto.getRandomValues(saltBytes);
        var salt = encodeBytes(saltBytes);
        return hashPassword(password, salt).then(function (passwordHash) {
            users.push({
                username: normalizedUsername,
                email: normalizedEmail,
                salt: salt,
                passwordHash: passwordHash
            });
            window.localStorage.setItem(usersKey, JSON.stringify(users));
            return createSession(normalizedUsername, "user");
        });
    }

    function signOut() {
        window.sessionStorage.removeItem(sessionKey);
    }

    function updateHomeControls() {
        var loginLink = document.getElementById("login-link");
        var logoutButton = document.getElementById("logout-button");
        var inventoryLink = document.getElementById("inventory-nav-link");
        if (!loginLink || !logoutButton || !inventoryLink) {
            return;
        }
        var session = getSession();
        loginLink.hidden = Boolean(session);
        logoutButton.hidden = !session;
        if (session) {
            logoutButton.textContent = "SALIR (" + session.role.toLocaleUpperCase() + ")";
        }
        inventoryLink.hidden = !session || session.role !== "admin";
        inventoryLink.href = "Inventory.html";
    }

    function toggleForm() {
        var section = document.querySelector("main > section");
        var container = document.querySelector(".container");
        container.classList.toggle("active");
        section.classList.toggle("active");
    }

    var loginForm = document.getElementById("login-form");
    var registerForm = document.getElementById("register-form");
    if (loginForm) {
        var adminRequested = new URLSearchParams(window.location.search).get("admin") === "1";
        if (adminRequested) {
            document.getElementById("login-description").textContent =
                "Inicia sesión con una cuenta de administrador para consultar y modificar inventario.";
        }

        loginForm.addEventListener("submit", function (event) {
            event.preventDefault();
            var username = document.getElementById("login-username").value;
            var password = document.getElementById("login-password").value;
            var message = document.getElementById("login-message");
            message.textContent = "";
            if (adminRequested && username.trim().toLocaleLowerCase() !== adminUsername) {
                message.textContent = "El inventario requiere una cuenta de administrador.";
                return;
            }
            signIn(username, password).then(function (session) {
                if (adminRequested && session.role !== "admin") {
                    signOut();
                    throw new Error("El inventario requiere una cuenta de administrador.");
                }
                window.location.href = session.role === "admin" ? "Inventory.html" : "Home.html";
            }).catch(function (error) {
                message.textContent = error.message || "No se pudo iniciar sesión.";
            });
        });
    }

    if (registerForm) {
        registerForm.addEventListener("submit", function (event) {
            event.preventDefault();
            var password = document.getElementById("register-password").value;
            var confirmation = document.getElementById("register-confirm-password").value;
            var message = document.getElementById("register-message");
            message.textContent = "";
            if (password !== confirmation) {
                message.textContent = "Las contraseñas no coinciden.";
                return;
            }
            register(
                document.getElementById("register-username").value,
                document.getElementById("register-email").value,
                password
            ).then(function () {
                window.location.href = "Home.html";
            }).catch(function (error) {
                message.textContent = error.message || "No se pudo crear la cuenta.";
            });
        });
    }

    document.querySelectorAll("[data-toggle]").forEach(function (link) {
        link.addEventListener("click", function (event) {
            event.preventDefault();
            toggleForm();
        });
    });

    window.GameOverAuth = {
        getSession: getSession,
        signOut: signOut,
        updateHomeControls: updateHomeControls
    };
    updateHomeControls();
}());
