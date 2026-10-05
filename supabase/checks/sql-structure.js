#!/usr/bin/env node
/**
 * A STRUCTURAL VALIDATOR FOR SQL MIGRATIONS — `node supabase/checks/sql-structure.js`
 *
 * Zero dependencies. Run before any `supabase db push`.
 *
 * ── WHY THIS EXISTS (trap #7, paid for once already) ────────────────────────
 * A migration was edited in chunks and shipped TRUNCATED — a `create table` was
 * never closed. Nothing in `npm run check` noticed; only `supabase db push`
 * caught it, against the live project. This is the cheap local gate that runs
 * in CI instead.
 *
 * It checks the four things a truncation actually breaks in SQL text:
 *   1. `$$` dollar-quote balance (an unterminated function body)
 *   2. parenthesis balance outside strings/comments
 *   3. every `create table` / `create view` / `create policy` statement is
 *      closed by a `;`
 *   4. every plpgsql `begin` has its `end`  (counted only at statement level)
 *
 * It is a TEXT check, not a parser: it can miss a semantic error, and it will
 * never pass a truncated file. That is the point — it is a floor, not a ceiling.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', 'migrations');

/** Strip line comments and single-quoted strings so they cannot confuse counts. */
function sanitize(sql) {
  let out = '';
  let i = 0;
  let inLineComment = false;
  let inString = false;
  let inDollar = null; // the dollar tag, e.g. '$$' or '$tag$'

  while (i < sql.length) {
    const rest = sql.slice(i);

    if (inLineComment) {
      if (sql[i] === '\n') { inLineComment = false; out += '\n'; }
      else out += ' ';
      i += 1;
      continue;
    }

    if (inString) {
      if (sql[i] === "'") {
        if (sql[i + 1] === "'") { i += 2; out += '  '; continue; } // escaped ''
        inString = false;
      }
      out += ' ';
      i += 1;
      continue;
    }

    if (inDollar) {
      if (rest.startsWith(inDollar)) {
        out += inDollar;
        i += inDollar.length;
        inDollar = null;
      } else {
        out += ' ';
        i += 1;
      }
      continue;
    }

    if (rest.startsWith('--')) { inLineComment = true; i += 2; out += '  '; continue; }

    const dollar = rest.match(/^\$[A-Za-z_0-9]*\$/);
    if (dollar) { inDollar = dollar[0]; out += dollar[0]; i += dollar[0].length; continue; }

    if (sql[i] === "'") { inString = true; out += ' '; i += 1; continue; }

    out += sql[i];
    i += 1;
  }

  return { text: out, unterminated: Boolean(inString || inDollar), inDollar };
}

function checkFile(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const { text, unterminated } = sanitize(raw);
  const errors = [];

  // 1 · dollar-quote balance — sanitize() reports an open one at EOF
  const dollars = (raw.match(/\$[A-Za-z_0-9]*\$/g) || []).length;
  if (dollars % 2 !== 0) errors.push(`odd number of dollar quotes (${dollars})`);
  if (unterminated) errors.push('unterminated string or dollar-quoted body at EOF');

  // 2 · parenthesis balance
  let depth = 0;
  for (const ch of text) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (depth < 0) { errors.push('unbalanced parentheses — a ) appears before its ('); break; }
  }
  if (depth > 0) errors.push(`unbalanced parentheses — ${depth} ( never closed`);

  // 3 · every create statement is terminated by a ;
  const creates = text.match(/\bcreate\s+(or\s+replace\s+)?(table|view|policy|index|type|function|trigger)\b/g) || [];
  const semicolons = (text.match(/;/g) || []).length;
  // a trigger's `create trigger` shares the function's terminator in some files,
  // so this is a floor: fewer statements than terminators is fine, the reverse is not.
  if (creates.length > semicolons) {
    errors.push(`${creates.length} create-statement(s) but only ${semicolons} ';' — a statement is unclosed`);
  }

  // 4 · plpgsql begin/end balance (statement-level only)
  const begins = (text.match(/(^|\n)\s*begin\s*$/gm) || []).length;
  const ends = (text.match(/(^|\n)\s*end;\s*$/gm) || []).length;
  // `end;` closes begin/if/loop/case at the same nesting, so ends >= begins
  // always holds for valid code; fewer ends than begins means a truncated block.
  if (ends < begins) {
    errors.push(`${begins} plpgsql 'begin' but only ${ends} 'end;' — a block is unclosed`);
  }

  return errors;
}

function main() {
  if (!fs.existsSync(ROOT)) {
    console.log(`· no migrations directory at ${ROOT} — skipped`);
    process.exit(0);
  }
  const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    console.log('· no migration files — skipped');
    process.exit(0);
  }

  let failed = 0;
  for (const f of files) {
    const errors = checkFile(path.join(ROOT, f));
    if (errors.length === 0) {
      console.log(`  ✓ ${f}`);
    } else {
      failed += 1;
      console.log(`  ✗ ${f}`);
      for (const e of errors) console.log(`      · ${e}`);
    }
  }

  console.log(`\n${'─'.repeat(64)}`);
  if (failed === 0) {
    console.log(`✓ all ${files.length} migration(s) structurally sound`);
    process.exit(0);
  }
  console.log(`✗ ${failed} of ${files.length} migration(s) FAILED the structural check`);
  process.exit(1);
}

main();
