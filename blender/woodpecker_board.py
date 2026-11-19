"""Render the woodpecker storyboard panels with Blender (Cycles, CPU).

Usage:
  blender -b --factory-startup -P woodpecker_board.py -- OUT_DIR [SCALE_PERCENT] [SAMPLES] [PANELS]

Coordinates below are written in the same "Y-up" layout as the Remotion
version (x right, y up, z toward camera) and converted with V() to
Blender's Z-up world, so camera framings match between the two boards.
"""
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "/tmp/board"
SCALE = int(argv[1]) if len(argv) > 1 else 100
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
PANELS = [int(p) for p in argv[3].split(",")] if len(argv) > 3 else list(range(1, 10))


def V(x, y, z):
    """Y-up (three.js style) -> Blender Z-up."""
    return Vector((x, -z, y))


# ---------------------------------------------------------------- reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection


def link(obj):
    col.objects.link(obj)
    return obj


# ---------------------------------------------------------------- materials
def principled(name, color, rough=0.5, **kw):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    for k, v in kw.items():
        b.inputs[k].default_value = v
    return m


def hexrgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def add_bump(m, scale, strength, stretch=(1, 1, 1), kind="noise", detail=6.0):
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = stretch
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    if kind == "noise":
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Detail"].default_value = detail
        out = tex.outputs["Fac"]
    else:
        tex = nt.nodes.new("ShaderNodeTexVoronoi")
        tex.feature = "DISTANCE_TO_EDGE"
        out = tex.outputs["Distance"]
    tex.inputs["Scale"].default_value = scale
    nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    nt.links.new(out, bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return tex


def emission(name, color, strength=2.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*color, 1)
    e.inputs["Strength"].default_value = strength
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(e.outputs[0], o.inputs[0])
    return m


def xray_mat(name, color, alpha=0.25):
    """Fresnel-edged see-through shell: transparent centre, glowing rim."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.35
    ramp = nt.nodes.new("ShaderNodeMapRange")
    ramp.inputs["To Min"].default_value = 0.05
    ramp.inputs["To Max"].default_value = alpha * 3
    nt.links.new(lw.outputs["Facing"], ramp.inputs["Value"])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    em.inputs["Strength"].default_value = 1.6
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(ramp.outputs["Result"], mix.inputs["Fac"])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(mix.outputs[0], o.inputs[0])
    return m


M = {}
M["feather"] = principled("feather", hexrgb("#121216"), 0.5, **{"Sheen Weight": 0.25, "Sheen Roughness": 0.35})
add_bump(M["feather"], 60, 0.25, stretch=(1, 1, 3))
M["wing"] = principled("wing", hexrgb("#17171c"), 0.45, **{"Sheen Weight": 0.3})
add_bump(M["wing"], 45, 0.35, stretch=(1, 1, 5))
M["white"] = principled("white", hexrgb("#efebe3"), 0.6, **{"Sheen Weight": 0.4})
add_bump(M["white"], 70, 0.2)
M["crest"] = principled("crest", hexrgb("#d8202a"), 0.5, **{"Sheen Weight": 0.8, "Subsurface Weight": 0.15})
add_bump(M["crest"], 55, 0.4, stretch=(1, 1, 4))
M["beak"] = principled("beak", hexrgb("#5c5f63"), 0.3, **{"Coat Weight": 0.4})
add_bump(M["beak"], 25, 0.08, stretch=(6, 1, 1))
M["eye"] = principled("eye", (0.004, 0.004, 0.006), 0.05, **{"Coat Weight": 1.0})
M["eyering"] = principled("eyering", hexrgb("#d9d4c7"), 0.4)
M["foot"] = principled("foot", hexrgb("#3c3e44"), 0.45)
M["bark"] = principled("bark", hexrgb("#7a5a40"), 0.92)
add_bump(M["bark"], 4.0, 0.9, stretch=(1, 1, 0.12), kind="voronoi")
M["barkhole"] = principled("barkhole", hexrgb("#1e140c"), 1.0)
M["chip"] = principled("chip", hexrgb("#d2ad82"), 0.85)
M["bgtrunk"] = principled("bgtrunk", hexrgb("#6f7d70"), 1.0)
M["leaves"] = principled("leaves", hexrgb("#86a27a"), 0.9)
M["xray"] = xray_mat("xray", hexrgb("#8fd0ff"))
M["ghost"] = xray_mat("ghost", hexrgb("#8fd0ff"), alpha=0.18)
M["brain"] = principled("brain", hexrgb("#ff8fb1"), 0.4, **{"Emission Color": (*hexrgb("#ff8fb1"), 1), "Emission Strength": 0.6, "Subsurface Weight": 0.4})
M["tongue"] = emission("tongue", hexrgb("#ff7a1a"), 3.0)
M["keratin"] = principled("keratin", hexrgb("#ffd23f"), 0.2, **{"Emission Color": (*hexrgb("#ffd23f"), 1), "Emission Strength": 1.2, "Alpha": 0.55})
M["glow"] = emission("glow", hexrgb("#fff3c4"), 8.0)
M["arrow"] = emission("arrow", (1, 1, 1), 2.5)
M["membrane"] = principled("membrane", hexrgb("#e9eef5"), 0.25, **{"Alpha": 0.55})


# ---------------------------------------------------------------- primitives
def smooth(obj, levels=2):
    for p in obj.data.polygons:
        p.use_smooth = True
    if levels:
        mod = obj.modifiers.new("sub", "SUBSURF")
        mod.levels = mod.render_levels = levels
    return obj


def ellipsoid(name, pos, r, mat, rot=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    o.location = V(*pos)
    o.scale = (r[0], r[2], r[1])  # y-up radii -> z-up
    o.rotation_euler = (rot[0], -rot[2], rot[1])
    o.data.materials.append(mat)
    smooth(o, 1)
    if parent:
        o.parent = parent
    return o


def cone(name, pos, radius, depth, mat, rot=(0, 0, 0), verts=24, parent=None, r2=0.0):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=radius, radius2=r2, depth=depth, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    o.location = V(*pos)
    o.rotation_euler = rot
    o.data.materials.append(mat)
    if parent:
        o.parent = parent
    return o


def empty(name, pos):
    e = bpy.data.objects.new(name, None)
    e.location = V(*pos)
    return link(e)


def metaball_mesh(name, elements, mat, resolution=0.03):
    mb = bpy.data.metaballs.new(name + "_mb")
    mb.resolution = mb.render_resolution = resolution
    mb.threshold = 0.6
    obj = link(bpy.data.objects.new(name + "_mbobj", mb))
    for pos, r, stiff in elements:
        el = mb.elements.new(type="ELLIPSOID")
        el.co = V(*pos)
        el.radius = 1.0
        el.size_x, el.size_y, el.size_z = r[0], r[2], r[1]
        el.stiffness = stiff
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    bpy.data.objects.remove(obj)
    o = link(bpy.data.objects.new(name, me))
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat)
    return o


# ---------------------------------------------------------------- tree
# open cylinder built directly: 192 around x 240 rings (~46k verts)
NU, NV, H = 192, 240, 24.0
verts = [(math.cos(i / NU * math.tau), math.sin(i / NU * math.tau), -H / 2 + j / (NV - 1) * H)
         for j in range(NV) for i in range(NU)]
faces = [(j * NU + i, j * NU + (i + 1) % NU, (j + 1) * NU + (i + 1) % NU, (j + 1) * NU + i)
         for j in range(NV - 1) for i in range(NU)]
me = bpy.data.meshes.new("trunk")
me.from_pydata(verts, [], faces)
trunk = link(bpy.data.objects.new("trunk", me))
stretch = empty("bark_coords", (0, 0, 0))
stretch.scale = (0.35, 0.35, 4.0)
tex = bpy.data.textures.new("barktex", type="VORONOI")
tex.noise_scale = 0.35
tex.distance_metric = "DISTANCE"
disp = trunk.modifiers.new("bark", "DISPLACE")
disp.texture = tex
disp.texture_coords = "OBJECT"
disp.texture_coords_object = stretch
disp.strength = 0.09
disp.mid_level = 0.5
smooth(trunk, 0)
trunk.data.materials.append(M["bark"])
# peck hole
hole = cone("hole", (0.96, 0.88, 0), 0.1, 0.05, M["barkhole"], rot=(0, math.pi / 2, 0), verts=24, r2=0.09)

# background forest (kept far so depth of field melts it)
for i in range(22):
    f = (math.sin(i * 12.9898) * 43758.5453) % 1
    f2 = (math.sin(i * 78.233) * 12345.678) % 1
    x, z = (f - 0.5) * 70, -16 - f2 * 30
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.4 + f * 0.6, depth=40, location=V(x, 0, z))
    bpy.context.active_object.data.materials.append(M["bgtrunk"])
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=3.2, location=V(x, 6 + i % 5, z))
    bpy.context.active_object.data.materials.append(M["leaves"])

# ---------------------------------------------------------------- woodpecker
BIRD = Vector((1.55, 0, 0))  # y-up offset, applied by building in local coords + root empty
root = empty("bird_root", (1.55, 0, 0))


def B(x, y, z):  # bird-local y-up -> local blender
    return (x, y, z)


body = metaball_mesh(
    "body",
    [
        ((0, 0, 0), (0.37, 0.72, 0.36), 2.0),
        ((-0.06, 0.35, 0), (0.3, 0.35, 0.3), 2.0),
        ((0.06, -0.45, 0), (0.26, 0.35, 0.26), 2.0),
    ],
    M["feather"],
)
body.parent = root
for s in (1, -1):
    ellipsoid(f"flank{s}", (-0.13, 0.32, 0.25 * s), (0.07, 0.36, 0.1), M["white"], rot=(0, 0, 0.25), parent=root)
    ellipsoid(f"wing{s}", (0.14, -0.05, 0.27 * s), (0.25, 0.55, 0.09), M["wing"], rot=(0, 0, -0.12), parent=root)
    ellipsoid(f"wingbar{s}", (0.05, 0.22, 0.33 * s), (0.12, 0.05, 0.03), M["white"], rot=(0, 0, -0.5), parent=root)
wings = [o for o in bpy.data.objects if o.name.startswith("wing")]

# stiff tail feathers: tapered, pivot at base
tail_pivot = empty("tail_pivot", (0, 0, 0))
tail_pivot.parent = root
tail_pivot.location = V(0.05, -0.65, 0)
tail_pivot.rotation_euler = (0, 0.55, 0)  # y-up rot z(-0.55) -> blender rot y(+0.55)
for i, z in enumerate((-0.09, 0, 0.09)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    t = bpy.context.active_object
    t.scale = (0.06, 0.15, 1.0)
    t.location = (0, -z, -0.52)
    t.parent = tail_pivot
    t.data.materials.append(M["feather"])
    tp = t.modifiers.new("taper", "SIMPLE_DEFORM")
    tp.deform_method = "TAPER"
    tp.factor = -0.45
    smooth(t, 1)

# feet: two toes forward, two back
for s in (0.15, -0.15):
    for i, a in enumerate((0.6, 0.2, -2.2, -2.6)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.022, depth=0.2, location=(0, 0, 0))
        toe = bpy.context.active_object
        toe.parent = root
        toe.location = V(-0.42, -0.45, s + (i % 2) * 0.04 - 0.02)
        toe.rotation_euler = (0, -a, 0)
        toe.data.materials.append(M["foot"])
        smooth(toe, 1)

# head group pivots at the neck
neck_pivot = empty("neck_pivot", (0, 0.6, 0))
neck_pivot.parent = root
head_space = empty("head_space", (0, -0.6, 0))
head_space.parent = neck_pivot

head = metaball_mesh(
    "head",
    [
        ((0, 0.92, 0), (0.3, 0.28, 0.26), 2.0),
        ((-0.05, 0.66, 0), (0.22, 0.24, 0.21), 2.0),
        ((-0.2, 0.88, 0), (0.15, 0.13, 0.13), 2.0),
    ],
    M["feather"],
)
head.parent = head_space

crest = metaball_mesh(
    "crest",
    [
        ((0.0, 1.13, 0), (0.27, 0.15, 0.21), 2.0),
        ((0.15, 1.18, 0), (0.22, 0.13, 0.16), 2.0),
        ((0.28, 1.23, 0), (0.17, 0.1, 0.12), 2.0),
        ((0.39, 1.27, 0), (0.12, 0.075, 0.09), 2.5),
    ],
    M["crest"],
)
crest.parent = head_space
face = []
for s in (1, -1):
    face.append(ellipsoid(f"stripe{s}", (0.06, 0.8, 0.2 * s), (0.2, 0.04, 0.06), M["white"], rot=(0, 0, -0.35), parent=head_space))
eyes = []
lids = []
for s in (1, -1):
    ring = ellipsoid(f"eyering{s}", (-0.13, 0.96, 0.225 * s), (0.068, 0.068, 0.03), M["eyering"], parent=head_space)
    eye = ellipsoid(f"eye{s}", (-0.13, 0.96, 0.238 * s), (0.05, 0.05, 0.03), M["eye"], parent=head_space)
    lid = ellipsoid(f"lid{s}", (-0.13, 0.96, 0.24 * s), (0.072, 0.072, 0.035), M["feather"], parent=head_space)
    lid.hide_render = True
    eyes += [ring, eye]
    lids.append(lid)

membrane = ellipsoid("membrane", (-0.16, 0.965, 0.262), (0.045, 0.05, 0.01), M["membrane"], parent=head_space)

# chisel beak: 4-sided cone, flattened vertically
beak = cone("beak", (-0.52, 0.86, 0), 0.085, 0.46, M["beak"], verts=6, parent=head_space)
beak.rotation_euler = (0, -math.pi / 2, 0)
beak.scale = (0.75, 1.0, 1.0)
keratin = cone("keratin", (-0.52, 0.86, 0), 0.105, 0.5, M["keratin"], verts=6, parent=head_space)
keratin.rotation_euler = (0, -math.pi / 2, 0)
keratin.scale = (0.75, 1.0, 1.0)

# x-ray internals
skull = ellipsoid("skull", (0, 0.94, 0), (0.25, 0.23, 0.21), M["ghost"], parent=head_space)
brain = ellipsoid("brain", (0.06, 0.97, 0), (0.075, 0.062, 0.068), M["brain"], parent=head_space)
arrows = []
for i in range(6):
    a = i / 6 * math.tau
    p = (0.06 + math.cos(a) * 0.19, 0.97 + math.sin(a) * 0.19, 0.18)
    ar = cone(f"arrow{i}", p, 0.03, 0.08, M["arrow"], verts=12, parent=head_space)
    ar.rotation_euler = (0, -(a + math.pi / 2), 0)  # point toward the brain
    arrows.append(ar)

tongue_pts = [(-1.0, 0.86, 0.0), (-0.6, 0.86, 0.0), (-0.3, 0.8, 0.02), (-0.1, 0.66, 0.06), (0.18, 0.68, 0.08),
              (0.34, 0.92, 0.07), (0.22, 1.17, 0.05), (-0.06, 1.22, 0.03), (-0.28, 1.08, 0.01)]
cu = bpy.data.curves.new("tongue", "CURVE")
cu.dimensions = "3D"
cu.bevel_depth = 0.024
cu.bevel_resolution = 4
sp = cu.splines.new("NURBS")
sp.points.add(len(tongue_pts) - 1)
for pt, p in zip(sp.points, tongue_pts):
    pt.co = (*V(*p), 1)
sp.use_endpoint_u = True
sp.order_u = 4
tongue = link(bpy.data.objects.new("tongue", cu))
tongue.data.materials.append(M["tongue"])
tongue.parent = head_space

feather_head = [head, crest] + face + eyes

# ---------------------------------------------------------------- effects
chips = []
for i in range(24):
    r = lambda n: (math.sin(i * 91.7 + n * 13.3) * 9999.1) % 1
    bpy.ops.mesh.primitive_cube_add(size=1)
    c = bpy.context.active_object
    s = 0.03 + r(7) * 0.045
    c.scale = (s * 1.6, s * 0.35, s)
    c.rotation_euler = (r(4) * 6, r(5) * 6, r(6) * 6)
    c["base"] = (1.0 + r(1) * 0.9, 0.88 + (r(2) - 0.4) * 0.9, (r(3) - 0.2))
    c.data.materials.append(M["chip"])
    chips.append(c)

flash = []
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.08, location=V(1.0, 0.86, 0.15))
flash.append(bpy.context.active_object)
for i, rr in enumerate((0.2, 0.32)):
    bpy.ops.mesh.primitive_torus_add(major_radius=rr, minor_radius=0.012, location=V(1.0, 0.86, 0.15),
                                     rotation=(math.pi / 2, 0, 0))
    flash.append(bpy.context.active_object)
for f in flash:
    f.data.materials.append(M["glow"])

tripod = []
tp_pts = [(1.13, -0.45, 0.17), (1.13, -0.45, -0.17), (1.08, -1.55, 0)]
for p in tp_pts:
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.045, location=V(*p))
    tripod.append(bpy.context.active_object)
for a, b in ((0, 1), (1, 2), (2, 0)):
    pa, pb = V(*tp_pts[a]), V(*tp_pts[b])
    d = pb - pa
    bpy.ops.mesh.primitive_cylinder_add(radius=0.014, depth=d.length, location=(pa + pb) / 2)
    o = bpy.context.active_object
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    tripod.append(o)
for o in tripod:
    o.data.materials.append(M["arrow"])

# ---------------------------------------------------------------- world, light, camera
world = bpy.data.worlds.new("sky")
scene.world = world
world.use_nodes = True
wn = world.node_tree
bg = wn.nodes["Background"]
grad = wn.nodes.new("ShaderNodeTexGradient")
tc = wn.nodes.new("ShaderNodeTexCoord")
mp = wn.nodes.new("ShaderNodeMapping")
mp.inputs["Rotation"].default_value = (0, math.pi / 2, 0)
ramp = wn.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].color = (*hexrgb("#dcebf3"), 1)
ramp.color_ramp.elements[1].color = (*hexrgb("#9cc8e6"), 1)
wn.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
wn.links.new(mp.outputs["Vector"], grad.inputs["Vector"])
wn.links.new(grad.outputs["Fac"], ramp.inputs["Fac"])
wn.links.new(ramp.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 1.1

sun = bpy.data.lights.new("sun", "SUN")
sun.energy = 4.0
sun.angle = math.radians(6)
sun.color = hexrgb("#fff0d8")
sun_o = link(bpy.data.objects.new("sun", sun))
sun_o.rotation_euler = (math.radians(50), math.radians(-25), math.radians(-35))

rim = bpy.data.lights.new("rim", "AREA")
rim.energy = 250
rim.size = 3
rim.color = hexrgb("#dff0ff")
rim_o = link(bpy.data.objects.new("rim", rim))
rim_o.location = V(3.5, 3.5, -5)
rt = rim_o.constraints.new("TRACK_TO")
rt.target = root
rt.track_axis = "TRACK_NEGATIVE_Z"
rt.up_axis = "UP_Y"

cam_d = bpy.data.cameras.new("cam")
cam = link(bpy.data.objects.new("cam", cam_d))
scene.camera = cam
target = empty("cam_target", (0, 0, 0))
trk = cam.constraints.new("TRACK_TO")
trk.target = target
trk.track_axis = "TRACK_NEGATIVE_Z"
trk.up_axis = "UP_Y"
cam_d.sensor_fit = "VERTICAL"
cam_d.dof.use_dof = True
cam_d.dof.focus_object = target

# ---------------------------------------------------------------- render settings
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = SAMPLES
scene.cycles.use_adaptive_sampling = True
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 6
scene.render.resolution_x = 1080
scene.render.resolution_y = 1920
scene.render.resolution_percentage = SCALE
scene.render.image_settings.file_format = "PNG"
try:
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
except Exception:
    pass

# ---------------------------------------------------------------- panels
SCENES = {
    1: dict(cam=((2.2, 0.4, 6.0), (1.15, 0.15, 0), 34), fstop=4.0, chips=True),
    2: dict(cam=((1.45, 1.0, 2.1), (1.05, 0.88, 0), 34), fstop=2.8, chips=True, toward=True, flash=True),
    3: dict(cam=((1.8, 1.12, 1.55), (1.18, 0.88, 0), 30), fstop=2.8, keratin=True),
    4: dict(cam=((1.65, 1.05, 2.0), (1.55, 0.95, 0), 32), fstop=2.8, xray=True, arrows=True),
    5: dict(cam=((1.6, 1.05, 1.45), (1.3, 0.93, 0.15), 32), fstop=2.2, chips=True, toward=True, membrane=True),
    6: dict(cam=((3.2, -0.7, 2.6), (1.2, -0.95, 0), 32), fstop=4.0, ghost=True, tripod=True),
    7: dict(cam=((1.3, 1.0, 2.5), (1.3, 0.95, 0), 34), fstop=2.8, xray=True, tongue=True),
    8: dict(cam=((1.9, 0.95, 2.4), (1.25, 0.85, 0), 34), fstop=2.8, chips=True, flash=True),
    9: dict(cam=((2.3, 1.0, 2.9), (1.45, 0.75, 0), 34), fstop=2.8, wink=True, look=True),
}


def show(objs, on):
    for o in objs:
        o.hide_render = not on


for idx in PANELS:
    s = SCENES[idx]
    (cp, ct, fov) = s["cam"]
    cam.location = V(*cp)
    target.location = V(*ct)
    cam_d.angle_y = math.radians(fov)
    cam_d.dof.aperture_fstop = s["fstop"]

    xr = s.get("xray", False)
    gh = s.get("ghost", False)
    for o in feather_head:
        o.hide_render = xr
    head.hide_render = False
    head.data.materials[0] = M["xray"] if xr else M["feather"]
    show([skull, brain], xr)
    show(arrows, s.get("arrows", False))
    show([tongue], s.get("tongue", False))
    show([keratin], s.get("keratin", False))
    show([membrane], s.get("membrane", False))
    show(flash, s.get("flash", False))
    show(tripod, s.get("tripod", False))
    body.data.materials[0] = M["ghost"] if gh else M["feather"]
    show(wings, not gh)
    show(chips, s.get("chips", False))
    for c in chips:
        bx, by, bz = c["base"]
        c.location = V(bx, by, bz * (1.8 if s.get("toward") else 0.8))
    lids[0].hide_render = not s.get("wink", False)
    eyes_vis = not xr
    for o in eyes:
        o.hide_render = not eyes_vis
    if s.get("wink"):
        bpy.data.objects["eye1"].hide_render = True
    neck_pivot.rotation_euler = (0, 0, 1.2 if s.get("look") else 0)  # y-up rot about y == blender rot about z

    scene.render.filepath = f"{OUT}/scene{idx}.png"
    bpy.ops.render.render(write_still=True)
    print(f"PANEL {idx} done", flush=True)
