"""Detailed procedural camel (one blended metaball body) — hero render + GLB export.

Usage: blender -b --factory-startup -P camel_hero.py -- OUT_PNG OUT_GLB [SAMPLES] [SCALE%]
Camel faces +X, ground at Z=0, about 2.7 units tall at the head.
"""
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT_PNG, OUT_GLB = argv[0], argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
SCALE = int(argv[3]) if len(argv) > 3 else 50

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


# ------------------------------------------------------------ fur material (colour variation + fuzz)
def fur_material():
    m = bpy.data.materials.new("fur")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.85
    b.inputs["Sheen Weight"].default_value = 0.25
    b.inputs["Sheen Roughness"].default_value = 0.4
    b.inputs["Sheen Tint"].default_value = (*srgb("#ffe2b0"), 1)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    # darker on top / hump, lighter belly + legs: use object Z
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    e = ramp.color_ramp.elements
    e[0].position = 0.25
    e[0].color = (*srgb("#a8733a"), 1)   # legs / lower
    e[1].position = 0.95
    e[1].color = (*srgb("#6a3a16"), 1)   # back / hump
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.0
    mr.inputs["From Max"].default_value = 2.6
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"])
    # blotchy variation
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 3.0
    noise.inputs["Detail"].default_value = 6
    mixc = nt.nodes.new("ShaderNodeMix")
    mixc.data_type = "RGBA"
    mixc.inputs["Factor"].default_value = 0.18
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    nt.links.new(ramp.outputs["Color"], mixc.inputs["A"])
    mixc.inputs["B"].default_value = (*srgb("#8a5a2c"), 1)
    nt.links.new(noise.outputs["Fac"], mixc.inputs["Factor"])
    nt.links.new(mixc.outputs["Result"], b.inputs["Base Color"])
    # fine fur bump (streaky)
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1, 1, 0.25)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    fn = nt.nodes.new("ShaderNodeTexNoise")
    fn.inputs["Scale"].default_value = 160
    fn.inputs["Detail"].default_value = 8
    nt.links.new(mp.outputs["Vector"], fn.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    nt.links.new(fn.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def simple(name, color, rough=0.5, **kw):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*srgb(color), 1)
    b.inputs["Roughness"].default_value = rough
    for k, v in kw.items():
        b.inputs[k].default_value = v
    return m


FUR = fur_material()
DARK = simple("pads", "#4a3322", 0.7)
EYE = simple("eye", "#0d0806", 0.05, **{"Coat Weight": 1.0})
LASH = simple("lash", "#2a1a10", 0.6)
NOSE = simple("nostril", "#1f130b", 0.9)

# ------------------------------------------------------------ metaball body
mb = bpy.data.metaballs.new("camel_mb")
mb.resolution = mb.render_resolution = 0.022
mb.threshold = 0.6
mbo = bpy.data.objects.new("camel_mbobj", mb)
col.objects.link(mbo)


def ball(co, size, stiff=2.0, kind="ELLIPSOID", rot=None):
    el = mb.elements.new(type=kind)
    el.co = co
    if kind == "BALL":
        el.radius = size[0] * 1.45  # metaball surface sits inside the radius
    else:
        el.radius = 1.45
        el.size_x, el.size_y, el.size_z = size
    el.stiffness = stiff
    if rot:
        el.rotation = rot


def chain(p0, p1, r0, r1, n, stiff=2.2):
    p0, p1 = Vector(p0), Vector(p1)
    for i in range(n):
        u = i / (n - 1)
        r = r0 + (r1 - r0) * u
        ball(tuple(p0.lerp(p1, u)), (r, r, r), stiff, "BALL")


# torso: barrel chest + body + rump + belly
ball((0.55, 0, 1.72), (0.48, 0.38, 0.45))   # chest / shoulders
ball((0.0, 0, 1.74), (0.62, 0.40, 0.40))    # body
ball((-0.55, 0, 1.76), (0.42, 0.36, 0.40))  # rump
ball((0.05, 0, 1.48), (0.62, 0.34, 0.22))   # belly
ball((0.62, 0, 1.38), (0.2, 0.22, 0.16))    # chest callus/pad
# single hump (dromedary)
ball((-0.05, 0, 2.18), (0.42, 0.30, 0.32))
ball((-0.05, 0, 2.38), (0.24, 0.2, 0.18))

# neck: S-curve, thick at base, rising forward then up
neck = [((0.9, 0, 1.85), 0.22), ((1.18, 0, 1.78), 0.19), ((1.42, 0, 1.92), 0.16), ((1.55, 0, 2.18), 0.14),
        ((1.6, 0, 2.42), 0.125), ((1.66, 0, 2.6), 0.12)]
for i in range(len(neck) - 1):
    (a, ra), (b, rb) = neck[i], neck[i + 1]
    chain(a, b, ra, rb, 8, 1.8)

# head: skull, long snout, droopy lips
ball((1.78, 0, 2.7), (0.17, 0.13, 0.14))          # skull
ball((1.98, 0, 2.66), (0.17, 0.10, 0.10))         # muzzle
ball((2.12, 0, 2.6), (0.10, 0.085, 0.085))        # snout tip
ball((2.1, 0, 2.53), (0.09, 0.07, 0.045))         # upper lip
ball((2.04, 0, 2.5), (0.08, 0.055, 0.04))         # lower lip (droopy)
for s in (1, -1):
    ball((1.72, 0.09 * s, 2.76), (0.07, 0.05, 0.06))  # brow ridges

# legs: long, knobbly knees, thin shins, wide pads
legs = [(0.62, 0.2), (0.62, -0.2), (-0.62, 0.2), (-0.62, -0.2)]
for x, y in legs:
    front = x > 0
    hip = (x, y * 0.85, 1.55)
    knee = (x + (0.02 if front else -0.06), y, 0.82)
    ankle = (x + (0.0 if front else 0.03), y, 0.2)
    chain(hip, knee, 0.15 if front else 0.18, 0.075, 16, 1.6)
    ball(knee, (0.085, 0.08, 0.09), 2.4, "BALL")       # knobbly knee
    chain(knee, ankle, 0.062, 0.05, 16, 1.6)
    ball((ankle[0] + 0.02, y, 0.12), (0.07, 0.065, 0.07), 2.2, "BALL")  # fetlock

# tail
chain((-0.95, 0, 1.82), (-1.03, 0, 1.3), 0.05, 0.03, 12, 1.6)

dg = bpy.context.evaluated_depsgraph_get()
me = bpy.data.meshes.new_from_object(mbo.evaluated_get(dg))
bpy.data.objects.remove(mbo)
camel = bpy.data.objects.new("camel", me)
col.objects.link(camel)
for p in me.polygons:
    p.use_smooth = True
me.materials.append(FUR)
cs = camel.modifiers.new("smooth", "CORRECTIVE_SMOOTH")
cs.iterations = 6

parts = [camel]


def add(o, m):
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = True
    parts.append(o)
    return o


# padded feet (wide, flat, two toes)
for x, y in legs:
    for t in (0.045, -0.045):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1, location=(x + 0.07, y + t, 0.05))
        o = bpy.context.active_object
        o.scale = (0.12, 0.065, 0.05)
        add(o, DARK)
# eyes (big, heavy-lidded) + double row of lashes
for s in (1, -1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.042, location=(1.84, 0.115 * s, 2.73))
    add(bpy.context.active_object, EYE)
    for row in range(2):
        for k in range(9):
            a = math.radians(-50 + k * 12)
            bpy.ops.mesh.primitive_cylinder_add(vertices=4, radius=0.0035, depth=0.05 + row * 0.012,
                                                location=(1.84 + math.sin(a) * 0.045, 0.118 * s + 0.012 * s * row, 2.765 + math.cos(a) * 0.012))
            o = bpy.context.active_object
            o.rotation_euler = (math.radians(-55) * s, 0, a)
            add(o, LASH)
# ears (small, rounded, pointing back)
for s in (1, -1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=1, location=(1.68, 0.1 * s, 2.86))
    o = bpy.context.active_object
    o.scale = (0.035, 0.022, 0.06)
    o.rotation_euler = (0.3 * s, -0.7, 0)
    add(o, FUR)
# slit nostrils
for s in (1, -1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=1, location=(2.2, 0.045 * s, 2.63))
    o = bpy.context.active_object
    o.scale = (0.012, 0.008, 0.028)
    o.rotation_euler = (0, 0.4, 0.5 * s)
    add(o, NOSE)

# ------------------------------------------------------------ export GLB (camel only, before environment)
bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = camel
bpy.ops.export_scene.gltf(filepath=OUT_GLB, use_selection=True, export_apply=True, export_yup=True, export_format="GLB")
print("EXPORTED", OUT_GLB, len(me.vertices), "verts")

# ------------------------------------------------------------ environment
bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, 0))
ground = bpy.context.active_object
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.subdivide(number_cuts=200)
bpy.ops.object.mode_set(mode="OBJECT")
tex = bpy.data.textures.new("dunes", type="CLOUDS")
tex.noise_scale = 25
d = ground.modifiers.new("dunes", "DISPLACE")
d.texture = tex
d.strength = 7
d.mid_level = 0.45
for p in ground.data.polygons:
    p.use_smooth = True
sand = simple("sand", "#e2b064", 0.95)
nt = sand.node_tree
ripple = nt.nodes.new("ShaderNodeTexWave")
ripple.inputs["Scale"].default_value = 4
ripple.inputs["Distortion"].default_value = 3
bp = nt.nodes.new("ShaderNodeBump")
bp.inputs["Strength"].default_value = 0.25
nt.links.new(ripple.outputs["Fac"], bp.inputs["Height"])
nt.links.new(bp.outputs["Normal"], nt.nodes["Principled BSDF"].inputs["Normal"])
ground.data.materials.append(sand)
# keep the stage flat under the camel
vg = ground.vertex_groups.new(name="far")
for v in ground.data.vertices:
    r = math.hypot(v.co.x, v.co.y)
    vg.add([v.index], min(1.0, max(0.0, (r - 8) / 30)), "REPLACE")
d.vertex_group = "far"

world = bpy.data.worlds.new("sky")
scene.world = world
world.use_nodes = True
sky = world.node_tree.nodes.new("ShaderNodeTexSky")
sky.sky_type = "NISHITA" if hasattr(sky, "sky_type") and "NISHITA" in [i.identifier for i in sky.bl_rna.properties["sky_type"].enum_items] else sky.sky_type
try:
    sky.sun_elevation = math.radians(28)
    sky.sun_rotation = math.radians(140)
except Exception:
    pass
world.node_tree.links.new(sky.outputs["Color"], world.node_tree.nodes["Background"].inputs["Color"])
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.05

sun = bpy.data.lights.new("sun", "SUN")
sun.energy = 3.8
sun.angle = math.radians(3)
sun.color = srgb("#fff0d6")
so = bpy.data.objects.new("sun", sun)
col.objects.link(so)
so.rotation_euler = (math.radians(55), 0, math.radians(140))

cam_d = bpy.data.cameras.new("cam")
cam_d.lens = 60
cam_d.dof.use_dof = True
cam_d.dof.aperture_fstop = 4.0
cam = bpy.data.objects.new("cam", cam_d)
col.objects.link(cam)
cam.location = (6.6, -7.4, 1.5)
tgt = bpy.data.objects.new("tgt", None)
col.objects.link(tgt)
tgt.location = (0.7, 0, 1.5)
c = cam.constraints.new("TRACK_TO")
c.target = tgt
c.track_axis = "TRACK_NEGATIVE_Z"
c.up_axis = "UP_Y"
cam_d.dof.focus_object = tgt
scene.camera = cam

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1080, 1920
scene.render.resolution_percentage = SCALE
try:
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Punchy"
except Exception:
    pass
scene.render.filepath = OUT_PNG
bpy.ops.render.render(write_still=True)
print("RENDERED", OUT_PNG)
