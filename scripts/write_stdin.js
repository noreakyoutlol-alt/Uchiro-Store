const fs = require("fs");
const path = require("path");
const target = process.argv[2];
const fullPath = path.resolve(process.cwd(), target);
fs.mkdirSync(path.dirname(fullPath), { recursive: true });
let data = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => { data += chunk; });
process.stdin.on("end", () => {
    fs.writeFileSync(fullPath, data, "utf8");
    console.log("Wrote " + target + " (" + Buffer.byteLength(data) + " bytes)");
});
