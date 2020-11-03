"use strict";

const fs = require("fs");

const configBase = {
    user: "User",
    repository: "Repository"
};

fs.writeFileSync("./config.json", JSON.stringify(configBase));
console.log("Successfully created (or overrode) config.json with the base configuration.");
