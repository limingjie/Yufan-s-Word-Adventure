const fs = require("fs");
const path = "js/lib/garden3d.js";
const s = fs.readFileSync(path, "utf8");
let line = 1,
    col = 0;
let stack = [];
let inString = null;
let inComment = null;
for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const prev = s[i - 1];
    if (ch === "\n") {
        line++;
        col = 0;
    } else col++;
    if (inComment) {
        if (inComment === "line" && ch === "\n") inComment = null;
        else if (inComment === "block" && prev === "*" && ch === "/") inComment = null;
        continue;
    }
    if (inString) {
        if (ch === "\\") {
            i++;
            continue;
        }
        if (inString === "`") {
            if (ch === "`") inString = null;
            continue;
        }
        if (ch === inString) inString = null;
        continue;
    }
    if (ch === "/" && s[i + 1] === "/") {
        inComment = "line";
        continue;
    }
    if (ch === "/" && s[i + 1] === "*") {
        inComment = "block";
        continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
        inString = ch;
        continue;
    }
    if (ch === "(" || ch === "{" || ch === "[") stack.push({ ch, line, col, i });
    if (ch === ")" || ch === "}" || ch === "]") {
        const top = stack.pop();
        const expect = { "(": ")", "{": "}", "[": "]" }[top?.ch];
        if (!top || expect !== ch) {
            console.log("MISMATCH", ch, "at", line, col, "top=", top);
            const start = Math.max(0, i - 80);
            const end = Math.min(s.length, i + 80);
            console.log("CONTEXT:\n", s.slice(start, end));
            process.exit(1);
        }
    }
}
console.log("STACK_LEN", stack.length);
if (stack.length) console.log("TOP_UNCLOSED", stack[stack.length - 1]);
