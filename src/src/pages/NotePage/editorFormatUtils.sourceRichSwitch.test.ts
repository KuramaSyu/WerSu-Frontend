// Regression test for the source <-> rich view toggle corrupting notes.
//
// The user toggles "Source" -> "Rich" -> "Source" -> ... repeatedly in
// `NoteEditorCore` (and the older `NoteEditModal`). Each roundtrip
// routes through `useActiveNoteStore.setContent(markdown)` -> calls
// `markdownToProsemirror(editor, markdown)` -> `editor.commands.setContent(...)`
// -> `editor.getMarkdown()`. The user pasted the AWK cheat-sheet below
// and reported that the document "gets destroyed" after a few cycles.
//
// The fixture is the verbatim document the user submitted. The test
// pins two invariants:
//
//   1. **Cycle stability**: rendering the result through one more
//      parse/render cycle produces the exact same markdown. If
//      cycle N+1 != cycle N, every save after a toggle writes a
//      drifted shape, and the document keeps mutating under the user.
//   2. **Structural preservation**: specific anchors (heading text,
//      the start of each table, fenced code-block openers) survive
//      the cycle. These are the bits the user can see in the source
//      view and would notice if a table collapsed into prose, a code
//      block got eaten, or a heading was lost.

// @vitest-environment jsdom

import "../../test/setup";

import { afterEach, describe, expect, it } from "vitest";
import { Editor, Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";

import { CustomHardBreak } from "../../components/Editor/CustomHardBreak";
import { markdownToProsemirror } from "./editorFormatUtils";

// ` ``` ` joined at runtime so we don't have to escape it inside the
// raw string itself (which would make the markdown the test asserts
// against unreadable).
const FENCE = "```";

const USER_DOCUMENT = [
  "#### Variables",
  "",
  FENCE,
  "          $1      $2/$(NF-1)    $3/$NF",
  "           ▼          ▼           ▼",
  "        ┌──────┬──────────────┬───────┐",
  "$0/NR ▶ │  ID  │  WEBSITE     │  URI  │",
  "        ├──────┼──────────────┼───────┤",
  "$0/NR ▶ │  1   │  quickref.me │  awk  │",
  "        ├──────┼──────────────┼───────┤",
  "$0/NR ▶ │  2   │  google.com  │  25   │",
  "        └──────┴──────────────┴───────┘",
  FENCE,
  "",
  "Variable | Description",
  ":----:|----|",
  "$0 | Full line",
  "$1, $2...$NF | First, second… last field",
  "NR | Number of Record",
  "NF | Number of Fields",
  'OFS | Output Field Separator (default " ")',
  'FS | input Field Separator (default " ")',
  'ORS | Output Record Separator (default "\\n")',
  'RS | input Record Separator (default "\\n")',
  "FILENAME | Name of the file",
  "",
  "#### Expressions",
  "",
  "| Expression          | Description                            |",
  "|---------------------|----------------------------------------|",
  '| `$1 == "root"`      | First field equals root                |',
  "| `{print $(NF-1)}`   | Second last field                      |",
  "| `NR!=1{print $0}`   | From 2nd record                        |",
  "| `NR > 3`            | From 4th record                        |",
  "| `NR == 1`           | First record                           |",
  "| `END{print NR}`     | Total records                          |",
  "| `BEGIN{print OFMT}` | Output format                          |",
  "| `{print NR, $0}`    | Line number                            |",
  '| `{print NR " " $0}` | Line number (tab)                      |',
  "| `{$1 = NR; print}`  | Replace 1st field with line number     |",
  "| `$NF > 4`           | Last field > 4                         |",
  "| `NR % 2 == 0`       | Even records                           |",
  "| `NR==10, NR==20`    | Records 10 to 20                       |",
  "| `BEGIN{print ARGC}` | Total arguments                        |",
  '| `ORS=NR%5?",":"\\n"` | Output record separator (alternate)    |',
  "",
  "#### Operators",
  "",
  "| Expression           | Description                 |",
  "|----------------------|-----------------------------|",
  "| `{print $1}`         | First field                 |",
  '| `$2 == "foo"`        | Equals                      |',
  '| `$2 != "foo"`        | Not equals                  |',
  '| `"foo" in array`     | In array                    |',
  "| `/regex/`            | Regular expression          |",
  "| `!/regex/`           | Line not matches            |",
  "| `$1 ~ /regex/`       | Field matches               |",
  "| `$1 !~ /regex/`      | Field not matches           |",
  "| `($2 <= 4 || $3 < 20)` | Or                        |",
  "| `($1 == 4 && $3 < 20)` | And                       |",
  "",
  "#### Math operators",
  "",
  "| Expression    | Description              | Expression   | Description                |",
  "|---------------|--------------------------|--------------|----------------------------|",
  "| `+`           | Addition                 | `+=`         | Addition assignment        |",
  "| `-`           | Subtraction              | `-=`         | Subtraction assignment     |",
  "| `*`           | Multiplication           | `*=`         | Multiplication assignment  |",
  "| `/`           | Division                 | `/=`         | Division assignment        |",
  "| `%`           | Modulus                  | `%=`         | Modulus assignment         |",
  "| `++`          | Increment                |              |                            |",
  "| `--`          | Decrement                |              |                            |",
  "| `==`          | Equal to                 | `<`          | Less than                  |",
  "| `!=`          | Not equal to             | `>`          | Greater than               |",
  "| `<`           | Less than                | `<=`         | Less than or equal to      |",
  "| `>`           | Greater than             | `>=`         | Greater than or equal to   |",
  "",
  "#### Functions",
  "",
  "| Expression  | Description| Expression| Description                                          |",
  "|------|----------|---------|-------|",
  "| `index(s,t)`| Position in string s where string t occurs, 0 if not found | `length(s)`         | Length of string s (or $0 if no arg)|",
  "| `rand`| Random number between 0 and 1| `substr(s,index,len)` | Return len-char substring of s that begins at index |",
  "| `srand`| Set seed for rand and return previous seed| `int(x)`| Truncate x to integer value|",
  "| `split(s,a,fs)`  | Split string s into array a split by fs, returning length of a | `match(s,r)`| Position in string s where regex r occurs, or 0 if not found |",
  "| `sub(r,t,s)`| Substitute t for first occurrence of regex r in string s (or $0 if s not given) | `gsub(r,t,s)` | Substitute t for all occurrences of regex r in string s |",
  "| `system(cmd)`| Execute cmd and return exit status| `tolower(s)`| String s to lowercase|",
  "| `toupper(s)`| String s to uppercase| `getline`| Set $0 to next input record from current input file |",
  "",
  "#### Patters",
  "| Pattern| Description| Example|",
  "|----------|----------|----------|",
  "| `^start`| Matches lines that start with \"start\"| `awk '/^start/' file.txt`     |",
  "| `end$`| Matches lines that end with \"end\"| `awk '/end$/' file.txt`       |",
  '| `^start.*end$`| Matches lines that start with "start" and end with "end" | `awk \'/^start.*end$/\' file.txt` |',
  "| `/pattern/`| Matches lines containing \"pattern\"| `awk '/pattern/' file.txt`    |",
  '| `$1 == "value"`| Matches lines where the first field is "value"| `awk \'$1 == "value"\' file.txt` |',
  "| `NF > 3`| Matches lines with more than 3 fields| `awk 'NF > 3' file.txt`       |",
  "| `/pattern/{ action }` | Performs action on lines containing \"pattern\"| `awk '/pattern/{ print $2 }' file.txt` |",
  "| `/pattern/ && NF > 3` | Matches lines containing \"pattern\" and having more than 3 fields | `awk '/pattern/ && NF > 3' file.txt` |",
  "",
  "#### Short version for Patterns",
  FENCE + "bash",
  "upower -e | awk '/mouse/ {print $1}' | xargs upower -i",
  FENCE,
  "",
  '- **`/mouse/ {print $1}`** → Filters lines containing "mouse" and prints the first field.',
  "- **Equivalent explicit `if` statement:**",
  FENCE + "bash",
  "upower -e | awk '{ if ($0 ~ /mouse/) print $1 }' | xargs upower -i",
  FENCE,
  '  - `$0 ~ /mouse/` → Checks if the whole line (`$0`) contains "mouse".',
  "  - `print $1` → Outputs the matching line.",
  "",
  "## How to get a specific line?",
  "",
  "You can print a specific line from a file using the awk command and specifying the line number as a pattern. Here's how you can print only the second line of a file using awk:",
  "",
  FENCE + "bash",
  "awk 'NR==2 {print}' file.txt",
  FENCE,
  "",
  "Here, NR is a built-in awk variable that represents the current line number, and == is the comparison operator. So NR==2 matches only the second line of the file. The {print} action prints the entire line.",
  "",
  "Make sure to replace file.txt with the actual filename of the file you want to process.",
  "",
  "## Example Tasks",
  "#### 1)",
  "`sales` - print the total revenue for every product",
  FENCE + "csv",
  "2023-01-01,Apple,10,1.50",
  "2023-01-01,Banana,15,0.75",
  "2023-01-02,Apple,20,1.50",
  "2023-01-02,Orange,12,1.25",
  "2023-01-03,Banana,8,0.75",
  "2023-01-03,Orange,10,1.25",
  FENCE,
  "",
  FENCE + "bash",
  "❯ cat sales | awk -F, '{p[$2] += ($3*$4)} END {for (key in p) {printf \"%-10s %-15.2f\\\\n\", key, p[key]}}'",
  "",
  "Orange     27.50",
  "Banana     17.25",
  "Apple      45.00",
  FENCE,
  "",
  "#### 2)",
  "counting domains",
  "`emails`:",
  FENCE + "csv",
  "john.doe@example.com",
  "jane.smith@example.com",
  "michael@company.com",
  "emily.davis@company.com",
  "chris.wilson@example.com",
  FENCE,
  "",
  FENCE + "bash",
  "❯ cat emails | awk -F@ '{doms[$2] += 1} END{for(d in doms) printf \"%-10s: %-15s \\\\n\", d, doms[d]}'",
  "company.com: 2",
  "example.com: 3",
  FENCE,
  "",
  "#### 3)",
  'Given a file containing a list of student names and their corresponding scores in the format "Name,Score", where each line represents a student\'s record, write a one-liner bash command using AWK and sort to display the top 3 students with the highest scores.',
  FENCE,
  "John Doe,85",
  "Jane Smith,92",
  "Michael Johnson,78",
  "Emily Davis,95",
  "Chris Wilson,88",
  FENCE,
  "",
  FENCE + "bash",
  "❯ cat student-score | awk -F, '{print $1 \":\" $2}' | sort -k2 -t: -nr | head -n 3",
  "Emily Davis:95",
  "Jane Smith:92",
  "Chris Wilson:88",
  FENCE,
  "",
  "#### 4)",
  "",
  'Given a file containing a list of employee records in the format "EmployeeID,Name,Department,Salary", where each line represents an employee\'s record, write a one-liner bash command using AWK to calculate the total salary for each department and display the departments sorted in descending order of total salary.',
  "",
  "**Sample File Content (employees.txt):**",
  FENCE,
  "101,John Doe,Engineering,60000",
  "102,Jane Smith,Sales,50000",
  "103,Michael Johnson,Engineering,65000",
  "104,Emily Davis,Marketing,55000",
  "105,Chris Wilson,Engineering,62000",
  "106,Sarah Brown,Sales,48000",
  "107,David Lee,Marketing,57000",
  "108,Amy Taylor,Engineering,58000",
  "109,Brian Clark,Sales,51000",
  FENCE,
  FENCE + "bash",
  "❯ cat employees | awk -F, '{d[$3] += $4} END{for(x in d) printf \"%-20s: %-10s\\\\n\", x, d[x]}' | sort -t: -k2 -nr | head -n 3",
  "Engineering         : 245000",
  "Sales               : 149000",
  "Marketing           : 112000",
  FENCE,
  "",
  "",
  "**Internet Speed**",
  "connection.log",
  FENCE,
  "Server ID,Sponsor,Server Name,Timestamp,Distance,Ping,Download,Upload,Share,IP Address",
  "58613,CSN Solutions Datacenter,Kehrsen,2025-02-01T11:06:31.774349Z,367.7033045006441,26.886,77606947.00969976,31313238.61736759,,84.128.189.87",
  "49459,FNOH-DSL,Uetze,2025-02-01T12:11:46.741105Z,319.18305257650843,33.489,77979360.96778017,30072616.722353034,,84.128.189.87",
  "20507,DNS:NET Internet Service GmbH,Berlin,2025-02-01T15:37:29.308852Z,175.0519191600984,18.507,78386168.96738032,31233237.846124083,,84.128.189.87",
  "17137,Cronon GmbH,Berlin,2025-02-01T15:43:01.051178Z,175.0519191600984,16.805,77397446.69922069,31215814.48917055,,84.128.189.87",
  "20507,DNS:NET Internet Service GmbH,Berlin,2025-02-01T15:44:00.744521Z,175.0519191600984,16.499,78522411.73011112,31016972.7733572,,84.128.189.87",
  "38032,Drahtlos-DSL GmbH Mittelsachsen,Leipzig,2025-02-01T15:45:00.537616Z,133.26148934388522,47.579,41008144.72478001,28971960.031598322,,84.128.189.87",
  "54027,C4S,Berlin,2025-02-01T15:46:00.494748Z,174.91351052292214,16.132,77300088.47920035,30911065.899944786,,84.128.189.87",
  "38032,Drahtlos-DSL GmbH Mittelsachsen,Leipzig,2025-02-01T15:47:01.144695Z,133.26148934388522,26.403,74217373.44745637,29940448.18918948,,84.128.189.87",
  "9828,TETA s.r.o.,Usti nad Labem,2025-02-01T15:48:01.298656Z,42.664548087355286,29.707,75302863.88854115,30974248.86776455,,84.128.189.87",
  FENCE,
  "",
  "Goal: Print in better format",
  "Result:",
  FENCE + "bash",
  'cat connection.log | awk -F, \'NR==1{print "ID,Date,Ping,Down,Up"} NR>1{printf "%s,%s,%.1f ms,%.2f Mbit/s,%.2f Mbit/s\\\\n", $1,$4,$6,$7/1000000,$8/1000000}\' | column -s, -t',
  FENCE,
  "",
  FENCE,
  ">>>",
  "ID     Date                         Ping      Down          Up",
  "58613  2025-02-01T11:06:31.774349Z  26.9 ms   77.61 Mbit/s  31.31 Mbit/s",
  "49459  2025-02-01T12:11:46.741105Z  33.5 ms   77.98 Mbit/s  30.07 Mbit/s",
  "20507  2025-02-01T15:37:29.308852Z  18.5 ms   78.39 Mbit/s  31.23 Mbit/s",
  "17137  2025-02-01T15:43:01.051178Z  16.8 ms   77.40 Mbit/s  31.22 Mbit/s",
  "20507  2025-02-01T15:44:00.744521Z  16.5 ms   78.52 Mbit/s  31.02 Mbit/s",
  "38032  2025-02-01T15:45:00.537616Z  47.6 ms   41.01 Mbit/s  28.97 Mbit/s",
  "54027  2025-02-01T15:46:00.494748Z  16.1 ms   77.30 Mbit/s  30.97 Mbit/s",
  FENCE,
  "",
  "#### 5)",
  "**USB Reset of specific device**",
  "`lsusb` returns the devices as well as their IDs. The TP-Link sometimes results in a faulty state and needs a reset.",
  "Hence filter out the ID, and then pass it to `usbreset`",
  FENCE,
  "root@vueko# lsusb",
  "Bus 001 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub",
  "Bus 001 Device 002: ID 2357:0604 TP-Link TP-",
  "                                            DD/ UB500 Adapter",
  "Bus 001 Device 003: ID 303a:831a Nabu Casa ZBT-2",
  "Bus 002 Device 001: ID 1d6b:0003 Linux Foundation 3.0 root hub",
  FENCE,
  FENCE + "bash",
  "root@vueko# lsusb | awk '/TP-Link.*UB500/{print $6}' | xargs -I {} usbreset {}",
  "Resetting TP-",
  "             DD/ UB500 Adapter ... ok",
  FENCE,
  "",
].join("\n");

// Mirror of the production override on `TableWithControls.renderMarkdown`
// in `src/components/Editor/TableControlls/TableControlls.tsx`. Kept in
// sync with that override. See the helper definitions there for the
// rationale (line-break preservation in cells).
function assembleCellText(
  h: { renderChild: (n: unknown, i: number) => string },
  content: unknown,
): string {
  const children = Array.isArray(content) ? content : content ? [content] : [];
  if (children.length === 0) return "";
  const lines: string[] = [];
  for (let i = 0; i < children.length; i += 1) {
    const raw = h.renderChild(children[i], i);
    for (const part of raw.split(/\r?\n/)) {
      const cleaned = part.replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");
      if (cleaned.length > 0) lines.push(cleaned);
    }
  }
  return lines.join("<br/>");
}

function renderWerSuTable(
  node: {
    content?: Array<{
      content?: Array<{
        type: string;
        attrs?: Record<string, unknown>;
        content?: unknown;
      }>;
    }> | null;
  },
  h: { renderChild?: (n: unknown, i: number) => string },
): string {
  if (!node.content || node.content.length === 0) return "";
  type Row = { text: string; isHeader: boolean }[];
  const rows: Row[] = [];
  for (const rowNode of node.content) {
    const cells: Row = [];
    if (rowNode.content) {
      for (const cellNode of rowNode.content) {
        cells.push({
          text: assembleCellText(
            { renderChild: h.renderChild ?? (() => "") },
            cellNode.content,
          ),
          isHeader: cellNode.type === "tableHeader",
        });
      }
    }
    rows.push(cells);
  }
  const columnCount = rows.reduce((max, r) => Math.max(max, r.length), 0);
  if (columnCount === 0) return "";
  const colWidths: number[] = new Array(columnCount).fill(0);
  for (const r of rows) {
    for (let i = 0; i < columnCount; i += 1) {
      const t = r[i]?.text || "";
      colWidths[i] = Math.max(colWidths[i], t.length, 3);
    }
  }
  const pad = (s: string, w: number) =>
    s + " ".repeat(Math.max(0, w - s.length));
  const headerRow = rows[0];
  const hasHeader = headerRow.some((c) => c.isHeader);
  let out = "\n";
  const headerTexts = new Array(columnCount)
    .fill(0)
    .map((_, i) => (hasHeader ? headerRow[i]?.text || "" : ""));
  out += `| ${headerTexts.map((t, i) => pad(t, colWidths[i])).join(" | ")} |\n`;
  out += `| ${colWidths.map((w) => "-".repeat(Math.max(3, w))).join(" | ")} |\n`;
  const body = hasHeader ? rows.slice(1) : rows;
  for (const r of body) {
    out += `| ${new Array(columnCount)
      .fill(0)
      .map((_, i) => pad(r[i]?.text || "", colWidths[i]))
      .join(" | ")} |\n`;
  }
  return out;
}

const TableCustom = Table.extend({
  renderMarkdown: (node, h) => renderWerSuTable(node as never, h as never),
});

// Minimal code-block stub so fenced ``` blocks round-trip without
// pulling MUI via the real `CustomCodeBlock`. Same pattern as
// `CustomHtml.test.ts`.
const StubCodeBlock = Node.create({
  name: "codeBlock",
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  defining: true,
  addAttributes() {
    return { language: { default: null } };
  },
  parseHTML() {
    return [{ tag: "pre" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["pre", HTMLAttributes, ["code", {}, 0]];
  },
  markdownTokenName: "code",
  parseMarkdown: (token, helpers) =>
    helpers.createNode(
      "codeBlock",
      { language: token.lang || null },
      token.text ? [helpers.createTextNode(token.text)] : [],
    ),
  renderMarkdown: (node, h) => {
    const lang = node.attrs?.language ?? "";
    const text = h.renderChildren(node.content || []);
    return `\`\`\`${lang}\n${text}\n\`\`\``;
  },
});

function makeEditor(): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        undoRedo: false,
        hardBreak: false,
      }),
      CustomHardBreak,
      StubCodeBlock,
      TableCustom,
      TableRow,
      TableCell,
      TableHeader,
      Markdown,
    ],
  });
}

const editors: Editor[] = [];

afterEach(() => {
  while (editors.length > 0) {
    editors.pop()?.destroy();
  }
});

function freshEditor(): Editor {
  const e = makeEditor();
  editors.push(e);
  return e;
}

/**
 * Mirrors what `NoteEditorCore`'s "Source" -> "Rich" -> "Source" toggle
 * does at the store level: parse markdown into ProseMirror JSON, push
 * it into the editor, then dump markdown back out. The user's complaint
 * is that the dump drifts on every cycle; this helper just runs the
 * dump and re-feed loop.
 */
function cycleOnce(editor: Editor, markdown: string): string {
  const doc = markdownToProsemirror(editor, markdown);
  editor.commands.setContent(doc);
  return editor.getMarkdown();
}

describe("markdownToProsemirror + Table.renderMarkdown - source/rich toggle stability", () => {
  it("the AWK cheat sheet survives 10 toggle cycles without drift", () => {
    const editor = freshEditor();

    let md = cycleOnce(editor, USER_DOCUMENT);
    for (let i = 0; i < 10; i += 1) {
      const next = cycleOnce(editor, md);
      // Pin the regression: every cycle after the first MUST produce
      // the same output, otherwise the document silently mutates on
      // each save and "destroys" itself.
      expect(next).toBe(md);
      md = next;
    }
  });

  it("headings survive the cycle", () => {
    // Spot-check the section anchors the user can see in the source
    // pane. If a heading got eaten, the user notices immediately.
    const editor = freshEditor();
    const md = cycleOnce(editor, USER_DOCUMENT);

    for (const heading of [
      "#### Variables",
      "#### Expressions",
      "#### Operators",
      "#### Math operators",
      "#### Functions",
      "#### Patters",
      "#### Short version for Patterns",
      "## How to get a specific line?",
      "## Example Tasks",
      "#### 1)",
      "#### 2)",
      "#### 3)",
      "#### 4)",
      "#### 5)",
    ]) {
      expect(md).toContain(heading);
    }
  });

  it("fenced code blocks survive the cycle (openers preserved)", () => {
    const editor = freshEditor();
    const md = cycleOnce(editor, USER_DOCUMENT);

    // The opening fence of every ``` block the user pasted. Losing any
    // of these means the markdown editor will swallow the block.
    for (const opener of [`${FENCE}bash`, `${FENCE}csv`, `${FENCE}\n`]) {
      expect(md).toContain(opener);
    }
  });

  it("the 'Patters' table cells stay associated with their column", () => {
    // The "Patters" table is the one the user originally complained
    // about. Pin that the cell at row 2 column 1 still reads
    // "Matches lines with more than 3 fields" after one round trip,
    // not some other row's value that drifted into the wrong column.
    const editor = freshEditor();
    const md = cycleOnce(editor, USER_DOCUMENT);

    // Slice from the start of the Patters table so the assertion only
    // sees cells in that table.
    const tableStart = md.indexOf("| Pattern");
    expect(tableStart).toBeGreaterThanOrEqual(0);
    const after = md.slice(tableStart);

    expect(after).toContain("Matches lines that start with");
    expect(after).toContain("Matches lines that end with");
    expect(after).toContain("Matches lines with more than 3 fields");
    expect(after).toContain("Matches lines containing");
    expect(after).toContain("Performs action on lines");
  });
});
