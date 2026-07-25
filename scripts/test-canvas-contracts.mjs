import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canvasPerspective, canvasPerspectives, layoutCanvas, validateCanvasDocument, validateRecordSet } from "../canvas/src/domain.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const recordSet = {
  schemaVersion: 1,
  id: "example-records",
  revision: "example-1",
  records: [
    { id: "REC-01", kind: "capability", title: "Review one outcome", source: { label: "Source", href: "content.html#rec-01" } },
    { id: "REC-02", kind: "capability", title: "Review another outcome" },
  ],
};
const document = {
  schemaVersion: 1,
  id: "example-canvas",
  title: "Example canvas",
  mode: "readonly",
  recordSources: [{ id: "example-records", path: "data/example-records.json" }],
  groups: [
    { id: "view-home", title: "Home view", tone: "aqua", order: 1 },
    { id: "section-status", title: "Status", parentId: "view-home", order: 1 },
  ],
  placements: [
    { id: "placement-1", groupId: "section-status", recordRef: { sourceId: "example-records", recordId: "REC-01" } },
    { id: "placement-2", groupId: "section-status", recordRef: { sourceId: "example-records", recordId: "REC-01" } },
    { id: "placement-3", groupId: "view-home", recordRef: { sourceId: "example-records", recordId: "REC-02" } },
  ],
};
const recordSets = new Map([[recordSet.id, recordSet]]);

assert.deepEqual(validateRecordSet(recordSet), []);
assert.deepEqual(validateCanvasDocument(document, recordSets), []);
assert.equal(layoutCanvas(document, recordSets).length, 5, "Two groups and three placements should render.");
assert.equal(document.placements.filter((placement) => placement.recordRef.recordId === "REC-01").length, 2, "A record may appear in multiple groups.");
assert.equal(canvasPerspectives(document).length, 1, "Legacy documents expose one normalized perspective.");

const sizingRecordSet = {
  schemaVersion: 1,
  id: "sizing-records",
  revision: "sizing-1",
  records: [
    { id: "S-01", kind: "note", title: "Short" },
    { id: "S-02", kind: "note", title: "A considerably longer record statement that has to wrap onto several lines inside its own card", eyebrow: "Organizer" },
  ],
};
const sizingDocument = {
  schemaVersion: 1,
  id: "sizing-canvas",
  title: "Sizing canvas",
  mode: "readonly",
  recordSources: [{ id: "sizing-records", path: "sizing-records.json" }],
  groups: [{ id: "sizing-group", title: "Group" }],
  placements: [
    { id: "sizing-placement-1", groupId: "sizing-group", recordRef: { sourceId: "sizing-records", recordId: "S-01" }, order: 1 },
    { id: "sizing-placement-2", groupId: "sizing-group", recordRef: { sourceId: "sizing-records", recordId: "S-02" }, order: 2 },
  ],
};
const sizingRecordSets = new Map([[sizingRecordSet.id, sizingRecordSet]]);
assert.deepEqual(validateRecordSet(sizingRecordSet), []);
assert.deepEqual(validateCanvasDocument(sizingDocument, sizingRecordSets), []);
const sizingNodes = layoutCanvas(sizingDocument, sizingRecordSets);
const shortCard = sizingNodes.find((node) => node.id === "sizing-placement-1");
const longCard = sizingNodes.find((node) => node.id === "sizing-placement-2");
const sizingGroup = sizingNodes.find((node) => node.id === "sizing-group");
assert.ok(shortCard.style.width < longCard.style.width, "Each card hugs its own text width.");
assert.ok(longCard.style.height > shortCard.style.height, "A wrapped title grows only its own card height.");
assert.ok(sizingGroup.style.width >= longCard.style.width, "A group hugs its widest card.");
assert.ok(
  sizingGroup.style.height < shortCard.style.height + longCard.style.height + 120,
  "Packed cards must not reserve a uniform row height for every card.",
);
const overlapping = shortCard.position.x < longCard.position.x + longCard.style.width
  && longCard.position.x < shortCard.position.x + shortCard.style.width
  && shortCard.position.y < longCard.position.y + longCard.style.height
  && longCard.position.y < shortCard.position.y + shortCard.style.height;
assert.equal(overlapping, false, "Packed cards must never overlap.");

const multiPerspectiveDocument = {
  ...document,
  groups: undefined,
  placements: undefined,
  presentation: undefined,
  defaultPerspectiveId: "by-view",
  perspectives: [
    { id: "by-view", title: "By view", groups: document.groups, placements: document.placements, presentation: document.presentation },
    { id: "by-owner", title: "By owner", groups: [{ id: "owner-product", title: "Product" }], placements: document.placements.map((placement, index) => ({ ...placement, id: `owner-placement-${index}`, groupId: "owner-product" })) },
  ],
};
delete multiPerspectiveDocument.groups;
delete multiPerspectiveDocument.placements;
delete multiPerspectiveDocument.presentation;
assert.deepEqual(validateCanvasDocument(multiPerspectiveDocument, recordSets), []);
assert.equal(canvasPerspectives(multiPerspectiveDocument).length, 2);
assert.equal(canvasPerspective(multiPerspectiveDocument, "by-owner").title, "By owner");
assert.equal(layoutCanvas(multiPerspectiveDocument, recordSets, "by-owner").length, 4, "Selected perspective should control layout nodes.");

const mutations = [
  ["duplicate records", { ...recordSet, records: [...recordSet.records, recordSet.records[0]] }, validateRecordSet, /duplicates REC-01/],
  ["editable mode", { ...document, mode: "local-draft" }, (value) => validateCanvasDocument(value, recordSets), /readonly only/],
  ["missing group", { ...document, placements: [{ ...document.placements[0], groupId: "missing" }] }, (value) => validateCanvasDocument(value, recordSets), /does not resolve: missing/],
  ["missing record", { ...document, placements: [{ ...document.placements[0], recordRef: { sourceId: "example-records", recordId: "missing" } }] }, (value) => validateCanvasDocument(value, recordSets), /does not resolve: missing/],
  ["unsafe source path", { ...document, recordSources: [{ id: "example-records", path: "../outside.json" }] }, (value) => validateCanvasDocument(value, recordSets), /normalized host-relative path/],
  ["group cycle", { ...document, groups: [{ id: "one", title: "One", parentId: "two" }, { id: "two", title: "Two", parentId: "one" }] }, (value) => validateCanvasDocument(value, recordSets), /containment cycle/],
  ["unknown default perspective", { ...multiPerspectiveDocument, defaultPerspectiveId: "missing" }, (value) => validateCanvasDocument(value, recordSets), /does not resolve: missing/],
  ["mixed perspective shapes", { ...document, defaultPerspectiveId: "by-view", perspectives: multiPerspectiveDocument.perspectives }, (value) => validateCanvasDocument(value, recordSets), /cannot be combined/],
];

for (const [name, value, validate, pattern] of mutations) {
  assert.match(validate(value).map((error) => `${error.path}: ${error.message}`).join("\n"), pattern, name);
}

const demoRecordSet = JSON.parse(fs.readFileSync(path.join(packageRoot, "demo", "structured-records.canvas.records.json"), "utf8"));
const demoDocument = JSON.parse(fs.readFileSync(path.join(packageRoot, "demo", "structured-information.canvas.json"), "utf8"));
const demoRecordSets = new Map([[demoRecordSet.id, demoRecordSet]]);
assert.deepEqual(validateRecordSet(demoRecordSet), [], "Generic demo Record Set must validate");
assert.deepEqual(validateCanvasDocument(demoDocument, demoRecordSets), [], "Generic demo Canvas Document must validate");
assert.equal(canvasPerspective(demoDocument, "by-stage").placements.filter((placement) => placement.recordRef.recordId === "DEMO-RECORD-02").length, 2, "Generic demo must prove repeated placements");
assert.equal(canvasPerspectives(demoDocument).length, 2, "Generic demo must prove perspective switching");

console.log(`Slate Canvas contract tests passed (${16 + mutations.length} cases).`);