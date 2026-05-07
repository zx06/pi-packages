import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSafeCommand, checkCommand } from "../src/safety.js";

describe("isSafeCommand", () => {
  describe("safe read-only commands", () => {
    const safe = [
      "cat file.txt",
      "head -n 10 file.txt",
      "tail -f log.txt",
      "less file.txt",
      "more file.txt",
      "grep -r pattern .",
      "rg pattern",
      "fd name",
      "find . -name '*.ts'",
      "ls -la",
      "pwd",
      "tree -L 2",
      "echo hello",
      "printf '%s' hello",
      "wc -l file.txt",
      "sort file.txt",
      "uniq file.txt",
      "diff a.txt b.txt",
      "jq '.key' file.json",
      "sed -n '1,10p' file.txt",
      "awk '{print $1}' file.txt",
      "cut -d: -f1 file.txt",
      "tr a b",
      "xargs echo",
      "column -t file.txt",
      "file file.txt",
      "stat file.txt",
      "du -sh .",
      "df -h",
      "which node",
      "whereis python",
      "type ls",
      "env",
      "printenv PATH",
      "uname -a",
      "whoami",
      "id",
      "date",
      "uptime",
      "ps aux",
      "git status",
      "git log --oneline",
      "git diff",
      "git show HEAD",
      "git branch",
      "git ls-files",
      "npm list",
      "npm outdated",
      "npm view react",
      "curl https://example.com",
      "bat file.txt",
    ];

    for (const cmd of safe) {
      it(`allows: ${cmd}`, () => {
        assert.equal(isSafeCommand(cmd), true, `Expected safe: ${cmd}`);
      });
    }
  });

  describe("destructive commands blocked", () => {
    const blocked = [
      "rm -rf /",
      "rm file.txt",
      "rmdir dir",
      "mv a b",
      "cp a b",
      "mkdir dir",
      "touch file.txt",
      "chmod 777 file.txt",
      "chown root file.txt",
      "ln -s a b",
      "tee file.txt",
      "truncate -s 0 file.txt",
      "dd if=/dev/zero of=file",
      "echo hello > file.txt",
      "echo hello >> file.txt",
      "npm install express",
      "npm uninstall express",
      "yarn add react",
      "pip install requests",
      "apt-get install vim",
      "brew install git",
      "git add .",
      "git commit -m msg",
      "git push",
      "git pull",
      "git merge branch",
      "git rebase main",
      "git reset --hard",
      "git checkout branch",
      "git stash",
      "sudo ls",
      "kill 1234",
      "pkill node",
      "vim file.txt",
      "nano file.txt",
      "code .",
    ];

    for (const cmd of blocked) {
      it(`blocks: ${cmd}`, () => {
        assert.equal(isSafeCommand(cmd), false, `Expected blocked: ${cmd}`);
      });
    }
  });
});

describe("checkCommand", () => {
  describe("shell construct blocking", () => {
    it("blocks semicolons", () => {
      const result = checkCommand("ls ; rm -rf /");
      assert.equal(result.safe, false);
      assert.ok(result.reason?.includes("shell constructs"));
    });

    it("blocks ampersand chaining", () => {
      const result = checkCommand("cat file && rm file");
      assert.equal(result.safe, false);
      assert.ok(result.reason?.includes("shell constructs"));
    });

    it("blocks backticks", () => {
      const result = checkCommand("cat `whoami`");
      assert.equal(result.safe, false);
      assert.ok(result.reason?.includes("shell constructs"));
    });

    it("blocks embedded newlines", () => {
      const result = checkCommand("ls\nrm -rf /");
      assert.equal(result.safe, false);
      assert.ok(result.reason?.includes("shell constructs"));
    });
  });

  describe("redirect blocking", () => {
    it("blocks stdout redirect", () => {
      const result = checkCommand("echo hello > file.txt");
      assert.equal(result.safe, false);
      assert.ok(result.reason?.includes("redirect"));
    });

    it("blocks append redirect", () => {
      const result = checkCommand("echo hello >> file.txt");
      assert.equal(result.safe, false);
      assert.ok(result.reason?.includes("redirect"));
    });
  });

  describe("pipe safety", () => {
    it("blocks pipe to rm", () => {
      const result = checkCommand("echo file | rm");
      assert.equal(result.safe, false);
      assert.ok(result.reason?.includes("pipe"));
    });

    it("blocks pipe to sudo", () => {
      const result = checkCommand("echo cmd | sudo bash");
      assert.equal(result.safe, false);
      assert.ok(result.reason?.includes("pipe"));
    });

    it("allows pipe to safe command", () => {
      const result = checkCommand("cat file | grep pattern");
      assert.equal(result.safe, true);
    });
  });

  describe("destructive commands", () => {
    it("gives destructive reason", () => {
      const result = checkCommand("rm -rf /");
      assert.equal(result.safe, false);
      assert.ok(result.reason?.includes("destructive"));
    });
  });

  describe("unknown commands", () => {
    it("blocks unknown commands", () => {
      const result = checkCommand("some-unknown-tool --do-stuff");
      assert.equal(result.safe, false);
      assert.ok(result.reason?.includes("allowlist"));
    });
  });
});
