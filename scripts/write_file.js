const fs = require("fs");
const path = require("path");
const target = process.argv[2];
const b64 = process.argv[3];
const fullPath = path.resolve(process.cwd(), target);
fs.mkdirSync(path.dirname(fullPath), { recursive: true });
fs.writeFileSync(fullPath, Buffer.from(b64, "base64").toString("utf-8"));
console.log("Successfully wrote: " + target);
