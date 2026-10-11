"use client";
/* eslint-disable @next/next/no-img-element */
import { useMemo } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { initials } from "@/features/portfolio/public";
import {
  hierarchyLevels,
  levelLabel,
  titleOverlaps,
  type Person,
} from "./contracts";
import styles from "./relationships.module.css";
type ContactNode = Node<
  { person: Person; overlap: boolean; onSelect: () => void },
  "contact"
>;
function ContactCard({ data }: NodeProps<ContactNode>) {
  const { person, overlap } = data;
  return (
    <button
      type="button"
      onClick={data.onSelect}
      className={`nodrag nopan ${styles.person} ${person.reviewRequired ? styles.warning : ""}`}
    >
      <Handle type="target" position={Position.Top}>
        <img src="/design/411-50673-imgTargetHandle.svg" alt="" />
      </Handle>
      <p className="eyebrow">{levelLabel(person.hierarchyLevel)}</p>
      <div className="row">
        <span className="monogram">{initials(person.name)}</span>
        <div>
          <strong>{person.name}</strong>
          <p className="muted">{person.title ?? "No title"}</p>
        </div>
      </div>
      <small>
        {person.placementSource === "manual"
          ? "Manual placement"
          : "Auto-placed"}
        {overlap && " · Title overlap"}
        {person.reviewRequired && " · Needs review"}
      </small>
      <small>Added {new Date(person.createdAt).toLocaleDateString()}</small>
      <Handle type="source" position={Position.Bottom}>
        <img src="/design/411-50673-imgTargetHandle.svg" alt="" />
      </Handle>
    </button>
  );
}
const nodeTypes = { contact: ContactCard };
export function OrganizationChart({
  people,
  search,
  onSelect,
}: {
  people: Person[];
  search: string;
  onSelect: (id: string) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const overlaps = new Set(titleOverlaps(people).map((p) => p.id));
    const groups = [...hierarchyLevels, null].map((level) =>
      people.filter((person) => person.hierarchyLevel === level),
    );
    const nodes: ContactNode[] = groups.flatMap((group, rank) =>
      group.map((person, col) => ({
        id: person.id,
        type: "contact",
        position: { x: col * 260, y: rank * 210 },
        data: {
          person,
          overlap: overlaps.has(person.id),
          onSelect: () => onSelect(person.id),
        },
        ariaLabel: `${person.name}, ${person.title ?? "No title"}, ${levelLabel(person.hierarchyLevel)}. Press Enter to open contact.`,
        style: {
          opacity:
            search &&
            !`${person.name} ${person.title}`
              .toLowerCase()
              .includes(search.toLowerCase())
              ? 0.25
              : 1,
        },
      })),
    );
    const ids = new Set(people.map((p) => p.id));
    return {
      nodes,
      edges: people.flatMap((p) =>
        p.reportsToPersonId && ids.has(p.reportsToPersonId)
          ? [
              {
                id: `reports:${p.id}`,
                source: p.reportsToPersonId,
                target: p.id,
                type: "smoothstep",
                style: { stroke: "#49688d", strokeWidth: 1.5 },
                ariaLabel: `Saved reports-to link for ${p.name}`,
              },
            ]
          : [],
      ),
    };
  }, [people, search, onSelect]);
  return (
    <div className={styles.chart} aria-label="Organization chart">
      <ReactFlow<ContactNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        elementsSelectable={true}
        nodesFocusable={false}
        fitView
        fitViewOptions={{ maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={1.5}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
