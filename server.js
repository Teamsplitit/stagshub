const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = process.env.PORT || 3000;
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    });

    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Attach io to global object so API routes can access it
    global.io = io;

    io.on("connection", (socket) => {
        socket.on("join-group", (groupId) => {
            if (groupId) {
                socket.join(`group:${groupId}`);
            }
        });

        socket.on("join-section", (sectionId) => {
            if (sectionId) {
                socket.join(`section:${sectionId}`);
            }
        });

        socket.on("join-user", (userId) => {
            if (userId) {
                socket.join(`user:${userId}`);
            }
        });
    });

    httpServer.listen(port, () => {
        console.log(`> Ready on http://localhost:${port}`);
    });
});
