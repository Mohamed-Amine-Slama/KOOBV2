# 3D Model Attribution

| Object | Source model | Author | License | URL |
|---|---|---|---|---|
| Bean | Coffee bean - PBR | fervinas | CC Attribution (CC-BY 4.0) | https://sketchfab.com/3d-models/coffee-bean-pbr-ac5f051f20fa4912bfe100d6ae98ef82 |
| Portafilter | Portafilter | denisdaxton | CC Attribution (CC-BY 4.0) | https://sketchfab.com/3d-models/portafilter-9722f769b44d4bc0b8f65582b09d3da6 |
| Glass | Tall Glass | DavideFon | CC Attribution (CC-BY 4.0) | https://sketchfab.com/3d-models/tall-glass-f978e6f36d5040a89053029bbad94b62 |

Cup, Lid, Liquid, Steam: original work, created in Blender for KOOB (branded paper cup
with a separate black lid; the sticker artwork is the KOOB brand logo). The earlier
ceramic Cup + Saucer are retired but recoverable from git history. The Glass is no
longer shown by the scroll choreography but still ships in the props GLB.

## Notes on modification (derivative works, per CC-BY terms)

- **Bean**: kept the model's original PBR albedo/roughness/normal texture set (reads as a
  quality roasted bean, ~#635246 average tone — same family as the brand's roast palette);
  consolidated import hierarchy into a single object, scaled to ~12mm, origin set to bounds
  center.
- **Portafilter**: re-materialed. Replaced the model's original texture-based material with
  three brand-palette Principled BSDFs assigned by geometry position along the handle axis:
  handle `#111411` (rough 0.5), a thin gold accent collar `#c8a96e` (metallic 1.0, rough 0.25 —
  matches the cup's `GoldRim` material), and a brushed-steel basket (metallic 0.9, rough 0.35).
  Consolidated import hierarchy into a single object, scaled to 25cm, origin set to bounds
  center.
- **Glass**: re-materialed with a glass Principled BSDF (Transmission Weight 1.0, Roughness
  0.05, IOR 1.45) for `KHR_materials_transmission` on glTF export. The source model's outer and
  inner shell meshes (double-wall hollow glass geometry) were joined into one object, scaled to
  15cm, origin set to bounds center.

All three are attributed here and in the site footer per CC-BY 4.0 (attribution required; no
non-commercial or no-derivatives restriction — all licenses confirmed as plain CC Attribution
before use, matching the requirement for a commercial site with re-materialed derivatives).
