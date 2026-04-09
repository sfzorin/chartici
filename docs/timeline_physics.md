# Timeline Layout Principles (Chevrons)

This document describes the current logic for placing nodes (chevrons) along the central chronological spine in "Timeline" mode.

## 1. Chevron Geometry (Responsiveness)

The system is fully responsive to standard node sizes (`XS`, `S`, `M`, `L`, `XL`). The node's geometry is structured as follows:

- **Base Dimensions:** The `getNodeDim()` function determines the base width and height depending on the selected node size.
- **Proportional Cut:** The depth of the "V-shaped" cutout (on the right at the base of the tail) is strictly tied to the current chevron's height: `Cut = Height × 0.25`.
- **Calculated Width:** `Calculated_Width = Base_Width + Cut`. This extended base width prevents text from being improperly compressed within the arrow shape.
- **Final Width:** `Final_Width = Calculated_Width + Delta`. Where `Delta` represents the actual physical extension of the chevron's total width. This compensates for the rigid grid snapping interval (20px) to preserve exact daylighting gaps.
- **Cut Angle:** Because the cutout is always exactly `0.25` of the height, **the slope angle of the edges remains mathematically identical across all scale factors**. Chevrons of different sizes (e.g., S and L) perfectly interlock into one another without any visual breaks or kinks at the joints.

## 2. Delta Sizes and Daylight Control

Since the background grid step is constant, varying the Delta allows us to fine-tune the exact visual gap (daylight) for nodes of different "calibers". The Delta **does not depend on the position or group affiliation**. Delta is a hard-coded constant specific to each defined block size.

For instance, a standard typographic and compositional rule of thumb is to maintain a constant ratio between "empty space" and the object's scale. 
If we want a visual gap (Daylight) equal to approximately 1/8 of the block's height so that whitespace proportionally scales with the blocks:

- **XS** (Height 40, Base offset 20): Ideal Daylight ~5px. Therefore **Delta = 15px** (20 - 5).
- **S** (Height 60, Base offset 20): Ideal Daylight ~8px. Therefore **Delta = 12px** (20 - 8).
- **M** (Height 80, Base offset 20): Ideal Daylight ~10px. Therefore **Delta = 10px** (20 - 10).
- **L** (Height 120, Base offset 40): Ideal Daylight ~15px. Therefore **Delta = 25px** (40 - 15).
- **XL** (Height 160, Base offset 40): Ideal Daylight ~20px. Therefore **Delta = 20px** (40 - 20).

**How it works:**
The larger the block, the longer its base "tail", so to preserve pleasing proportions we calculated Deltas such that the empty daylight gap always inherently equals exactly ~12.5% (1/8) of the chevron's height. Tiny elements huddle closer together (5px), while massive blocks push further apart (20px). This provides perfect equilibrium.

## 3. Node Positioning (Grid Snapping step)

Because the layout adheres to a 20px coordinate grid, the actual distance between nodes is measured strictly from their centers (or horizontal origins) and is always a multiple of 20 pixels. The spacing step depends on the node size and whether adjacent nodes belong to the same group or different groups (providing structural visual separation).

### A. Intra-group (Micro Step)
The distance between the centers (X-coordinates) of two adjacent chevrons that belong to the exact same `groupId`:
- For **XS**: `Calculated Width` + 20px
- For **S**: `Calculated Width` + 20px
- For **M**: `Calculated Width` + 20px
- For **L**: `Calculated Width` + 40px
- For **XL**: `Calculated Width` + 40px

### B. Inter-group (Macro Step)
The distance between the centers (X-coordinates) of two adjacent chevrons belonging to different groups (or orphans), expanded to emphasize structural separation:
- For **XS**: `Calculated Width` + 40px
- For **S**: `Calculated Width` + 40px
- For **M**: `Calculated Width` + 40px
- For **L**: `Calculated Width` + 80px
- For **XL**: `Calculated Width` + 80px
