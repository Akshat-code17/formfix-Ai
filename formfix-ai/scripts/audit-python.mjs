import fs from "node:fs";
const pins = [
  ...fs
    .readFileSync("services/document/requirements.lock", "utf8")
    .matchAll(/^([a-zA-Z0-9_.-]+)==([^\s;]+)/gm),
].map((m) => ({ name: m[1], version: m[2] }));
const checked = [];
for (const pin of pins) {
  const r = await fetch(
    `https://pypi.org/pypi/${pin.name}/${pin.version}/json`,
  );
  if (!r.ok) throw new Error(`Cannot audit ${pin.name}: ${r.status}`);
  const j = await r.json();
  checked.push({
    ...pin,
    advisories: (j.vulnerabilities ?? [])
      .filter((v) => !v.withdrawn)
      .map((v) => ({ id: v.id, fixedIn: v.fixed_in, link: v.link })),
  });
}
const report = {
  checkedAt: new Date().toISOString(),
  source: "PyPI release JSON vulnerability metadata",
  packages: checked,
};
fs.writeFileSync(
  "docs/python-dependency-audit.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    {
      checked: checked.length,
      flagged: checked.filter((p) => p.advisories.length),
    },
    null,
    2,
  ),
);
