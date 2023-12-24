import * as fs from "fs";
import * as path from "path";
import { diff } from "jest-diff";

type Transformer = (code: string, filename: string) => Promise<string> | string;

/**
 * Looks in a fixtures dir for .ts files, transforms them according to the
 * passed transformer, and compares the output to the expected output in the
 * `.expected` file.
 */
export default class TestRunner {
  _write: boolean;
  _fixturesDir: string;
  _testFixtures: string[] = [];
  _otherFiles: Set<string> = new Set();
  _skip: Set<string> = new Set();
  _failureCount = 0;
  _transformer: Transformer;

  constructor(
    fixturesDir: string,
    write: boolean,
    filter: string | null,
    testFilePattern: RegExp,
    ignoreFilePattern: RegExp | null,
    transformer: Transformer,
  ) {
    this._write = write;
    this._fixturesDir = fixturesDir;
    this._transformer = transformer;
    const filterRegex = filter != null ? new RegExp(filter) : null;
    for (const fileName of readdirSyncRecursive(fixturesDir)) {
      if (testFilePattern.test(fileName)) {
        this._testFixtures.push(fileName);
        const filePath = path.join(fixturesDir, fileName);
        if (filterRegex != null && !filePath.match(filterRegex)) {
          this._skip.add(fileName);
        }
      } else if (!ignoreFilePattern || !ignoreFilePattern.test(fileName)) {
        this._otherFiles.add(fileName);
      }
    }
  }

  // Returns true if the test passed
  async run(): Promise<boolean> {
    for (const fixture of this._testFixtures) {
      if (!this._skip.has(fixture)) {
        await this._testFixture(fixture);
      }
    }
    console.log("");

    if (this._failureCount > 0) {
      console.log(
        `${this._failureCount} failures found. Run with --write to update fixtures`,
      );
      return false;
    } else {
      console.log("All tests passed!");
    }

    if (this._otherFiles.size > 0) {
      if (this._write) {
        for (const fileName of this._otherFiles) {
          console.log("DELETED: " + fileName);
          fs.unlinkSync(path.join(this._fixturesDir, fileName));
        }
      } else {
        console.log("Unexpected files found:");
        for (const fileName of this._otherFiles) {
          console.log(" - " + fileName);
        }
        console.log("Run with --write to deleted unexpected files");
        return false;
      }
    }
    return true;
  }

  async _testFixture(fixture: string) {
    const expectedFileName = fixture + ".expected";
    const expectedFilePath = path.join(this._fixturesDir, expectedFileName);

    if (this._otherFiles.has(expectedFileName)) {
      this._otherFiles.delete(expectedFileName);
    }

    const fixturePath = path.join(this._fixturesDir, fixture);
    const displayName = path.relative(this._fixturesDir, fixturePath);
    const fixtureContent = fs.readFileSync(fixturePath, "utf-8");
    const output = await this.transform(fixtureContent, fixture);

    function stripTypescriptVersionAndSourceLocation(text: string): string {
      return text.replace(
        /^\s+node_modules\/\.pnpm\/typescript(@\d+.\d+.\d+)\/node_modules\/typescript\/.+\.(?:t|j)s(:\d+:\d+)$\s+(\d+)\s+/gm,
        (match, capturedVersion, capturedSrcLocation, capturedLineNumber) =>
          match
            .replace(capturedVersion, "")
            .replace(capturedSrcLocation, "")
            .replace(capturedLineNumber, ""),
      );
    }

    const actualOutput =
      stripTypescriptVersionAndSourceLocation(`-----------------
INPUT
----------------- 
${fixtureContent}
-----------------
OUTPUT
-----------------
${output}`);

    const processedOutput =
      stripTypescriptVersionAndSourceLocation(actualOutput);

    const snapshots: readonly string[] = (() => {
      const contents = fs.readFileSync(expectedFilePath, "utf-8");
      try {
        return JSON.parse(contents);
      } catch (_) {
        return [contents];
      }
    })().map(stripTypescriptVersionAndSourceLocation);

    let lastRecordedSnapshot = "";
    for (const snapshot of snapshots) {
      if (processedOutput === (lastRecordedSnapshot = snapshot)) {
        console.log("OK: " + displayName);
        return;
      }
    }

    if (this._write) {
      if (snapshots.length === 1) {
        fs.writeFileSync(expectedFilePath, actualOutput, "utf-8");
        console.error("UPDATED: " + displayName);
      } else {
        fs.writeFileSync(
          expectedFilePath,
          JSON.stringify(snapshots.concat(actualOutput)),
          "utf-8",
        );
        console.error("ADDED: " + displayName);
      }
    } else {
      this._failureCount++;
      console.error("FAILURE: " + displayName);
      console.log(
        diff(lastRecordedSnapshot, actualOutput, {
          aAnnotation: "Last recorded snapshot",
        }),
      );
    }
  }

  async transform(code: string, filename: string): Promise<string> {
    try {
      return await this._transformer(code, filename);
    } catch (e) {
      console.error(e);
      return e.message;
    }
  }
}

function readdirSyncRecursive(dir: string): string[] {
  const files: string[] = [];
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      for (const f of readdirSyncRecursive(filePath)) {
        files.push(path.join(file, f));
      }
    } else {
      files.push(file);
    }
  }
  return files;
}
