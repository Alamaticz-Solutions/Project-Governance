---
name: bpm-bpmn-export
description: >
  Use this skill whenever the user asks to generate, create, export, or produce
  a BPMN file (.bpmn) for any business process, capability, or workflow —
  regardless of industry or department — especially for import into a process
  repository such as BlueDolphin, Signavio, Camunda, or any BPMN 2.0-compatible
  tool. Triggers include: "generate a BPMN file", "create a .bpmn for
  BlueDolphin", "export this process as BPMN", "I want to import this into
  [tool]", "make a BPMN 2.0 file for this process", "create a domain-level
  BPMN", "expand this sub-process into BPMN", "model this workflow in BPMN",
  or any request to produce machine-readable BPMN XML. Always use this skill
  before writing any .bpmn XML — even for processes that seem simple — to
  ensure structural validity, correct namespace usage, and tool compatibility.
  Do NOT use this skill for producing SVG or visual diagrams. For PDS Health
  ID-specific lane names and process ID conventions, also read
  references/pds-health-id.md in this skill folder.
---

# BPM BPMN Export Skill

Produces valid BPMN 2.0 XML files (.bpmn) for any business process,
compatible with bpmn-js, BlueDolphin, Signavio, Camunda, and other
BPMN 2.0-compliant tools.

---

## File Format Standard

Always use this exact namespace and header structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_[ProcessName]"
  targetNamespace="http://bpmn.io/schema/bpmn"
  exporter="bpmn-js (https://demo.bpmn.io)"
  exporterVersion="12.0.0">
```

**No vendor extensions. No additional namespaces. No custom attributes.**
The `exporter` attribute must always be `bpmn-js (https://demo.bpmn.io)`
version `12.0.0`. This signature triggers bpmn-js-compatible rendering in
BlueDolphin and most other tools.

---

## Element Type Mapping

Map business process concepts to BPMN elements as follows:

| Process concept | BPMN element | Notes |
|---|---|---|
| Process triggered by external message or request | `<bpmn:startEvent>` with `<bpmn:messageEventDefinition>` | Use message start for externally triggered processes |
| Process triggered internally or by timer | `<bpmn:startEvent>` (plain) or with `<bpmn:timerEventDefinition>` | Plain start for ad hoc; timer for scheduled |
| Task performed by a person | `<bpmn:userTask>` | Default for human work |
| Task performed by a system automatically | `<bpmn:serviceTask>` | Use when no human intervention occurs |
| Task that could be either, or is ambiguous | `<bpmn:task>` | Abstract task; use when fidelity is unknown |
| Reusable or separately documented sub-process | `<bpmn:callActivity calledElement="Process_[Name]">` | calledElement ID must match target process ID exactly |
| Exclusive decision — one path taken | `<bpmn:exclusiveGateway>` | XOR; use for if/else branches |
| Parallel split — all paths taken simultaneously | `<bpmn:parallelGateway>` | AND; use when multiple tracks run concurrently |
| Inclusive decision — one or more paths taken | `<bpmn:inclusiveGateway>` | OR; use when combinations of paths are possible |
| Process ends normally | `<bpmn:endEvent>` (plain) | No inner element needed for simple termination |
| Process ends with a message sent | `<bpmn:endEvent>` with `<bpmn:messageEventDefinition>` | Use when end triggers external notification |
| Communication between pools | `<bpmn:messageFlow>` in collaboration | Cross-pool only; never within a single pool |

### Gateway Selection Guide

Choose the gateway type that matches the real-world decision logic:

**Exclusive (XOR) — `<bpmn:exclusiveGateway>`**
Exactly one outgoing path is taken. Use for binary decisions (yes/no, approved/rejected) and mutually exclusive conditions. Most common gateway type in practice.

**Parallel (AND) — `<bpmn:parallelGateway>`**
All outgoing paths are taken simultaneously. Use when independent work streams begin at the same point (e.g., notify stakeholders AND begin content build in parallel). Always pair with a joining parallel gateway downstream.

**Inclusive (OR) — `<bpmn:inclusiveGateway>`**
One or more outgoing paths are taken depending on conditions. Use when combinations are possible (e.g., route to print AND/OR PDSConnect AND/OR LMS depending on content type). More complex to model — prefer XOR or AND when the logic is clear enough.

---

## Collaboration and Pool Structure

### Single-pool process (most departmental SOPs)
```xml
<bpmn:collaboration id="Collaboration_[Name]">
  <bpmn:participant id="Participant_[Name]" name="[Department or Team Name]"
    processRef="Process_[Name]"/>
</bpmn:collaboration>
<bpmn:process id="Process_[Name]" name="[Process Label]" isExecutable="false">
  <bpmn:laneSet id="LaneSet_[Name]">
    <bpmn:lane id="Lane_[RoleName]" name="[Role Display Name]">
      <bpmn:flowNodeRef>[element IDs]</bpmn:flowNodeRef>
    </bpmn:lane>
  </bpmn:laneSet>
  <!-- elements and flows -->
</bpmn:process>
```

### Two-pool process (internal process with external actors)
Add a second collapsed participant for external actors, vendors, or other
departments that interact with the process but are not modeled internally:
```xml
<bpmn:participant id="Participant_External"
  name="External Actors ([list roles])"/>
```
Use `<bpmn:messageFlow>` for all cross-pool communication.
The external participant has **no `processRef`** — it is a black-box pool.

### Lane naming conventions
- Name lanes after **roles**, not departments or individuals
- Use display names with spaces (not underscores) in the `name` attribute
- Use consistent IDs across files in the same engagement: `Lane_[RoleName]`
- Establish a lane name register at the start of each engagement and reuse
  it across all process files — this enables consistent rendering and
  cross-diagram navigation in the repository

For PDS Health ID-specific lane names and process ID conventions,
read `references/pds-health-id.md`.

### Process ID naming convention
Process IDs must be unique within the repository and stable across files.
Use the pattern `Process_[DescriptiveName]` in PascalCase with no spaces.

Establish a process ID register at the start of each engagement listing
every planned process file and its ID. This prevents broken `calledElement`
references when call activities are added before the target file exists.

---

## Collapsed Sub-Process Convention

For reusable or separately documented processes, use `<bpmn:callActivity>`:

```xml
<bpmn:callActivity id="Activity_[Name]"
  name="[Display label — describe the sub-process in plain language]"
  calledElement="Process_[TargetProcessID]">
  <bpmn:incoming>Flow_[in]</bpmn:incoming>
  <bpmn:outgoing>Flow_[out]</bpmn:outgoing>
</bpmn:callActivity>
```

The `calledElement` value must exactly match the `id` of the
`<bpmn:process>` in the target .bpmn file. This enables cross-diagram
navigation in the repository tool.

**If the target file does not yet exist**, note it as a broken link
and flag it for resolution. Do not guess or invent a calledElement ID.

---

## DI Coordinate Standards

Always include a full `<bpmndi:BPMNDiagram>` section with layout coordinates.
Most tools respect imported DI coordinates and will render the diagram
as laid out rather than auto-arranging elements.

### Pool and lane dimensions
| Process scale | Pool width | Height per lane |
|---|---|---|
| Small (2–3 lanes) | 2500–3500 | 250–350 px each |
| Medium (3–4 lanes) | 3000–4000 | 300–400 px each |
| Large / domain map (5+ lanes) | 5000–5500 | 400–560 px each |

Pool outer rect: `x=61, y=0` — start here as a consistent convention.
Lane header width: 30px; element content starts at `x=121`.
Lane header rect: `x=91, y=[lane_y], width=[pool_width-30], height=[lane_height]`.

### Element dimensions and spacing
| Element | Width | Height | Notes |
|---|---|---|---|
| Start / end event | 36 | 36 | Circle; x/y = top-left of bounding box |
| User task / service task / task | 132–160 | 80–84 | Standard task rectangle |
| Call activity | 132–160 | 80–84 | Same as task; rendered with sub-process marker |
| Exclusive / parallel / inclusive gateway | 50 | 50 | Diamond; x/y = top-left |
| Pool participant shape | [pool_w] | [pool_h] | `isHorizontal="true"` |
| Lane shape | [pool_w - 30] | [lane_h] | `isHorizontal="true"` |

Minimum horizontal gap between elements: 60px.
Minimum vertical gap between rows: 40px.

### Label bounds
Add `<bpmndi:BPMNLabel>` with `<dc:Bounds>` for start/end events and gateways:
```xml
<bpmndi:BPMNLabel>
  <dc:Bounds x="[x - half_label_width]" y="[element_y + element_h + 5]"
    width="[label_width]" height="[label_height]"/>
</bpmndi:BPMNLabel>
```

---

## Sequence Flow Naming

Label flows only when they carry conditional meaning (gateway branches).
Unconditional flows between tasks do not need labels.

```xml
<bpmn:sequenceFlow id="Flow_[Source]_[Target]" name="Yes — approved"
  sourceRef="Gateway_[Name]" targetRef="Activity_[Name]"/>
```

**Flow ID convention:** `Flow_[SourceID]_[TargetID]`
**DI edge ID convention:** Append `_di` to the flow ID.

---

## Validation

After writing the file, always validate with this Python script before
presenting the output:

```python
import xml.etree.ElementTree as ET
tree = ET.parse('<output_path>')
root = tree.getroot()
ns = {'bpmn': 'http://www.omg.org/spec/BPMN/20100524/MODEL'}

# Check lane refs resolve
lane_refs = {r.text for r in root.findall('.//bpmn:lane/bpmn:flowNodeRef', ns)}
all_ids = {el.attrib['id'] for el in root.iter() if 'id' in el.attrib}
missing = lane_refs - all_ids
print(f'Unresolved lane refs: {missing or "None — OK"}')

# Check flow source/target refs
broken = []
for f in root.findall('.//bpmn:sequenceFlow', ns):
    for a in ('sourceRef', 'targetRef'):
        v = f.attrib.get(a, '')
        if v not in all_ids:
            broken.append(f'{f.attrib["id"]} {a}={v}')
print(f'Broken flow refs: {broken or "None — OK"}')

# Check callActivity calledElement references are noted
call_activities = root.findall('.//bpmn:callActivity', ns)
print(f'Call activities found: {len(call_activities)}')
for ca in call_activities:
    print(f'  {ca.attrib["id"]} -> calledElement: {ca.attrib.get("calledElement", "MISSING")}')
```

Fix all errors before presenting the file.

---

## Output and Presentation

1. Write the .bpmn file to `/mnt/user-data/outputs/[ProcessName].bpmn`
2. Run the validation script
3. Report element counts: Tasks (by type), CallActivities, Gateways (by type), SequenceFlows, MessageFlows
4. Present via `present_files`
5. Note any cross-diagram links (calledElement references) and which target file each expects
6. Flag any broken links where the target file does not yet exist

---

## Tool-Specific Notes

### BlueDolphin (bpmn-js based)
- Respects DI coordinates on import — elements render where placed
- `<bpmn:callActivity>` renders with a sub-process marker; cross-diagram
  navigation depends on repository linking by process ID after import
- `<bpmn:messageFlow>` renders as a dashed line between pools
- The exporter signature (`bpmn-js 12.0.0`) triggers correct rendering
- Import files individually; cross-diagram linking is configured in the
  repository after all files are imported

### Camunda / Camunda Platform 8
- Supports service tasks with implementation attributes; add
  `camunda:` namespace extensions only if the user explicitly requests them
- Without extensions, the base BPMN 2.0 file imports cleanly

### Signavio
- Generally compatible with the base format; Signavio may auto-arrange
  elements if DI coordinates are not fully specified

---

## Common Errors to Avoid

| Error | Fix |
|---|---|
| Lane ref with no matching element | Every ID in `<bpmn:flowNodeRef>` must exist as an element `id` |
| Broken sequence flow | Every `sourceRef`/`targetRef` must match an existing element `id` |
| Missing DI shape for element | Every element in the process needs a matching `<bpmndi:BPMNShape>` |
| Missing DI edge for flow | Every sequence/message flow needs a matching `<bpmndi:BPMNEdge>` |
| Overlapping elements | Check x + width < next element x; minimum 20px gap |
| Text overflow in tool | Shorten task labels; tools wrap at ~20 chars for standard task width |
| Broken calledElement reference | calledElement value must exactly match the target process `id` |
| Parallel gateway with no join | Every parallel split must have a corresponding parallel join downstream |
| messageFlow inside a single pool | messageFlow is for cross-pool communication only; use sequenceFlow within a pool |

---

## Practitioner Notes

*This section records engagement-specific conventions and lessons learned.
Each entry is tagged by project. For full process ID registers and lane
name tables, read the corresponding file in references/.*

---

### Project 1 — PDS Health ID, 2026
Full lane name table and process ID register:
→ Read `references/pds-health-id.md`

**Key lessons from this engagement:**
- Establish a process ID register before writing any BPMN — broken
  calledElement links are easier to prevent than to fix across 11 files
- The DI coordinate standards above were validated against BlueDolphin
  import behavior on this project; treat them as confirmed defaults
- All tasks in the ID department BPMN files use `<bpmn:userTask>` —
  no automated service tasks exist in the current process state
- Parallel gateways were not needed for this engagement; all decisions
  were XOR. Inclusive gateways appear in one file (deployment routing)
