
function mdToHtml(md) {
  const lines = md.split("\n");
  const out = [];
  let i = 0;

  function inlineFormat(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(#[^)]+\)/g, "$1") // strip internal anchor links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  }

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Heading ### or ####
    const hMatch = line.match(/^(#{3,4})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      out.push(`<h${level}>${inlineFormat(hMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      const bqLines = [];
      while (i < lines.length && (lines[i].startsWith(">") || (lines[i].trim() && bqLines.length))) {
        if (lines[i].startsWith(">")) {
          bqLines.push(lines[i].replace(/^>\s?/, ""));
        } else {
          bqLines.push(lines[i]);
        }
        i++;
      }
      out.push(`<p class="sm-note">${inlineFormat(bqLines.join(" "))}</p>`);
      continue;
    }

    // Table
    if (line.includes("|") && lines[i + 1] && lines[i + 1].includes("|") && lines[i + 1].includes("-")) {
      const tableLines = [];
      while (i < lines.length && lines[i].includes("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2) {
        const headerCells = tableLines[0].split("|").filter((c, idx, arr) => idx > 0 && idx < arr.length - 1).map((c) => c.trim());
        const alignCells = tableLines[1].split("|").filter((c, idx, arr) => idx > 0 && idx < arr.length - 1).map((c) => {
          c = c.trim();
          if (c.startsWith(":") && c.endsWith(":")) return ' style="text-align: center;"';
          if (c.endsWith(":")) return ' style="text-align: right;"';
          return "";
        });

        let tHtml = '<div class="table-scroll"><table>\n<thead>\n<tr>\n';
        headerCells.forEach((c, idx) => {
          tHtml += `<th${alignCells[idx] || ""}>${inlineFormat(c)}</th>\n`;
        });
        tHtml += "</tr>\n</thead>\n<tbody>\n";

        for (let r = 2; r < tableLines.length; r++) {
          const rowCells = tableLines[r].split("|").filter((c, idx, arr) => idx > 0 && idx < arr.length - 1).map((c) => c.trim());
          tHtml += "<tr>\n";
          rowCells.forEach((c, idx) => {
            tHtml += `<td${alignCells[idx] || ""}>${inlineFormat(c)}</td>\n`;
          });
          tHtml += "</tr>\n";
        }
        tHtml += "</tbody>\n</table></div>";
        out.push(tHtml);
        continue;
      }
    }

    // Bullet list (- )
    if (/^\s*-\s+/.test(line)) {
      const listItems = [];
      while (i < lines.length && (/^\s*-\s+/.test(lines[i]) || (/^\s{2,}/.test(lines[i]) && listItems.length))) {
        if (/^\s*-\s+/.test(lines[i])) {
          listItems.push(lines[i].replace(/^\s*-\s+/, ""));
        } else {
          listItems[listItems.length - 1] += " " + lines[i].trim();
        }
        i++;
      }
      let ulHtml = '<ul class="rec-list">\n';
      listItems.forEach((item) => {
        ulHtml += `<li>${inlineFormat(item)}</li>\n`;
      });
      ulHtml += "</ul>";
      out.push(ulHtml);
      continue;
    }

    // Ordered list (1. )
    if (/^\s*\d+\.\s+/.test(line)) {
      const listItems = [];
      while (i < lines.length && (/^\s*\d+\.\s+/.test(lines[i]) || (/^\s{2,}/.test(lines[i]) && listItems.length))) {
        if (/^\s*\d+\.\s+/.test(lines[i])) {
          listItems.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        } else {
          listItems[listItems.length - 1] += " " + lines[i].trim();
        }
        i++;
      }
      let olHtml = '<ol type="1">\n';
      listItems.forEach((item) => {
        olHtml += `<li>${inlineFormat(item)}</li>\n`;
      });
      olHtml += "</ol>";
      out.push(olHtml);
      continue;
    }

    // Regular paragraph
    const pLines = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith("#") && !lines[i].startsWith(">") && !lines[i].includes("|") && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
      pLines.push(lines[i].trim());
      i++;
    }
    if (pLines.length) {
      out.push(`<p>${inlineFormat(pLines.join(" "))}</p>`);
    }
  }

  return out.join("\n");
}

module.exports = { mdToHtml };

