"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = __importDefault(require("./server"));
const port = process.env.PORT;
console.log("Starting app...");
(0, server_1.default)()
    .then((app) => {
    app.listen(port, () => {
        console.log(`Example app listening at http://localhost:${port}`);
    });
})
    .catch((error) => {
    console.error("Failed to start app:", error);
});
