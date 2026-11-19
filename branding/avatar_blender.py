"""Sohow 3D profile images rendered in Blender (Cycles).

Usage: blender -b --factory-startup -P avatar_blender.py -- OUT_PNG cube|owl [SAMPLES]
Renders with a transparent film + shadow catcher; the solid background colour is
composited afterwards so the soft shadow sits on it.
"""
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT, KIND = argv[0], argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 96

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def mat(name, color, rough=0.5, bump=0.0, bump_scale=30.0, stretch=(1, 1, 1), voronoi=False, **kw):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*srgb(color), 1)
    b.inputs["Roughness"].default_value = rough
    for k, v in kw.items():
        b.inputs[k].default_value = v
    if bump:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = stretch
        nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
        if voronoi:
            tx = nt.nodes.new("ShaderNodeTexVoronoi")
            out = tx.outputs["Distance"]
        else:
            tx = nt.nodes.new("ShaderNodeTexNoise")
            tx.inputs["Detail"].default_value = 8
            out = tx.outputs["Fac"]
        tx.inputs["Scale"].default_value = bump_scale
        nt.links.new(mp.outputs["Vector"], tx.inputs["Vector"])
        bp = nt.nodes.new("ShaderNodeBump")
        bp.inputs["Strength"].default_value = bump
        nt.links.new(out, bp.inputs["Height"])
        nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


def smooth(o, levels=2):
    for p in o.data.polygons:
        p.use_smooth = True
    if levels:
        md = o.modifiers.new("sub", "SUBSURF")
        md.levels = md.render_levels = levels
    return o


def bevel(o, w=0.03, seg=3):
    md = o.modifiers.new("bev", "BEVEL")
    md.width = w
    md.segments = seg
    return o


def box(name, loc, size, m, bev=0.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bev:
        bevel(o, bev, 3)
    o.data.materials.append(m)
    return o


def sphere(name, loc, r, m, scale=(1, 1, 1), sub=1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=r, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    o.data.materials.append(m)
    smooth(o, sub)
    return o


def rnd(i, k):
    s = math.sin(i * 91.7 + k * 13.3) * 9999.1
    return s - math.floor(s)


def shadow_catcher(z):
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, z))
    p = bpy.context.active_object
    p.is_shadow_catcher = True
    return p


# ------------------------------------------------------------------ DIORAMA CUBE
def build_cube():
    S = 2.0  # cube width
    layers = [  # (name, thickness, colour, bump, voronoi)
        ("water", 0.42, "#2f8fe0", 0.0, False),
        ("gravel", 0.38, "#9a9188", 0.0, False),
        ("clay", 0.42, "#a8683a", 0.5, False),
        ("soil", 0.46, "#6b4227", 0.6, False),
    ]
    z = 0.0
    for name, h, colr, bmp, vor in layers:
        if name == "water":
            m = mat(name, colr, 0.08, **{"Transmission Weight": 0.55, "IOR": 1.33, "Emission Color": (*srgb("#2f8fe0"), 1), "Emission Strength": 0.25})
        else:
            m = mat(name, colr, 0.9, bump=bmp, bump_scale=18)
        box(name, (0, 0, z + h / 2), (S, S, h), m, bev=0.015)
        z += h
    # gravel pebbles poking out of the visible faces
    peb = [mat(f"peb{i}", c, 0.7) for i, c in enumerate(["#c9c2b8", "#7d756d", "#b3a99d", "#5f5a55"])]
    zg0, zg1 = 0.42, 0.80
    for i in range(70):
        face = i % 2
        u = (rnd(i, 1) - 0.5) * (S - 0.12)
        zz = zg0 + 0.04 + rnd(i, 2) * (zg1 - zg0 - 0.08)
        r = 0.035 + rnd(i, 3) * 0.05
        loc = (S / 2, u, zz) if face == 0 else (u, -S / 2, zz)
        sphere(f"pebble{i}", loc, r, peb[i % 4], scale=(1, 1, 0.75), sub=1)
    # rocks in the clay/soil layers
    rock = mat("rock", "#8c8780", 0.8, bump=0.4, bump_scale=10)
    for i in range(14):
        face = i % 2
        u = (rnd(i, 4) - 0.5) * (S - 0.3)
        zz = 0.9 + rnd(i, 5) * 0.75
        r = 0.06 + rnd(i, 6) * 0.08
        loc = (S / 2, u, zz) if face == 0 else (u, -S / 2, zz)
        sphere(f"rock{i}", loc, r, rock, scale=(1.2, 1, 0.8), sub=1)
    # grass slab with stripes
    top = z
    g = mat("grass", "#4caf3a", 0.8, bump=0.6, bump_scale=120, stretch=(1, 1, 0.2))
    nt = g.node_tree
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 1.2
    wave.wave_profile = "SAW"
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    ramp.color_ramp.elements[0].color = (*srgb("#3f9e31"), 1)
    ramp.color_ramp.elements[1].position = 0.5
    ramp.color_ramp.elements[1].color = (*srgb("#5cc548"), 1)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(tc.outputs["Object"], wave.inputs["Vector"])
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    box("grass", (0, 0, top + 0.09), (S + 0.06, S + 0.06, 0.18), g, bev=0.05)
    top += 0.18
    # little tree
    bark = mat("bark", "#7a5032", 0.85, bump=0.5, bump_scale=40, stretch=(1, 1, 0.15))
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.09, depth=0.7, location=(-0.25, 0.3, top + 0.35))
    trunk = bpy.context.active_object
    trunk.data.materials.append(bark)
    smooth(trunk, 1)
    leaf = mat("leaf", "#2f9e44", 0.75, bump=0.5, bump_scale=25, **{"Subsurface Weight": 0.2})
    for i, (dx, dy, dz, r) in enumerate([(0, 0, 0.95, 0.42), (0.25, 0.1, 0.8, 0.3), (-0.22, -0.12, 0.82, 0.3), (0.05, -0.2, 1.15, 0.28), (-0.05, 0.22, 1.1, 0.26)]):
        sphere(f"leaf{i}", (-0.25 + dx, 0.3 + dy, top + dz), r, leaf, sub=2)
    # roots drawn down the front cut face (y = -S/2) from the tree position
    root_m = mat("root", "#8a5a36", 0.8)
    for k, (x0, x1) in enumerate([(-0.3, -0.75), (-0.22, 0.1), (-0.28, -0.35)]):
        cu = bpy.data.curves.new(f"root{k}", "CURVE")
        cu.dimensions = "3D"
        cu.bevel_depth = 0.022 - k * 0.004
        sp = cu.splines.new("BEZIER")
        sp.bezier_points.add(2)
        pts = [(x0, -S / 2 - 0.005, top - 0.2), ((x0 + x1) / 2 + 0.1, -S / 2 - 0.005, top - 0.55), (x1, -S / 2 - 0.005, top - 0.95 - k * 0.12)]
        for bp, p in zip(sp.bezier_points, pts):
            bp.co = p
            bp.handle_left_type = bp.handle_right_type = "AUTO"
        o = bpy.data.objects.new(f"root{k}", cu)
        col.objects.link(o)
        o.data.materials.append(root_m)
    # flowers + small rocks on the grass
    pet = mat("petal", "#ffffff", 0.5)
    ctr = mat("centre", "#ffd23f", 0.5)
    for i, (x, y) in enumerate([(0.55, -0.55), (0.7, 0.2), (0.25, -0.75), (-0.7, -0.6)]):
        sphere(f"fl{i}", (x, y, top + 0.04), 0.045, ctr, sub=1)
        for k in range(5):
            a = k / 5 * math.tau
            sphere(f"pt{i}{k}", (x + math.cos(a) * 0.05, y + math.sin(a) * 0.05, top + 0.03), 0.032, pet, scale=(1, 1, 0.4), sub=1)
    sphere("grassrock", (0.45, 0.6, top + 0.02), 0.11, rock, scale=(1.3, 1, 0.7), sub=1)
    shadow_catcher(0.0)
    # isometric-ish orthographic camera
    cam_d = bpy.data.cameras.new("cam")
    cam_d.type = "ORTHO"
    cam_d.ortho_scale = 4.7
    cam = bpy.data.objects.new("cam", cam_d)
    col.objects.link(cam)
    cam.location = (7.0, -7.0, 6.4)
    tgt = bpy.data.objects.new("tgt", None)
    col.objects.link(tgt)
    tgt.location = (0, 0, 1.05)
    c = cam.constraints.new("TRACK_TO")
    c.target = tgt
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"
    scene.camera = cam


# ------------------------------------------------------------------ OWL MASCOT
def build_owl():
    feather = mat("owlbody", "#b0703c", 0.6, bump=0.35, bump_scale=60, **{"Sheen Weight": 0.4})
    belly = mat("belly", "#f3e3c6", 0.65, bump=0.3, bump_scale=70, **{"Sheen Weight": 0.3})
    face = mat("face", "#f8efe0", 0.6)
    dark = mat("dark", "#7b4a26", 0.6, bump=0.3, bump_scale=60)
    eye_w = mat("eyew", "#ffffff", 0.2)
    iris = mat("iris", "#ffb21f", 0.25, **{"Emission Color": (*srgb("#ffb21f"), 1), "Emission Strength": 0.15})
    pupil = mat("pupil", "#111114", 0.08, **{"Coat Weight": 1.0})
    beak = mat("beak", "#f39a1e", 0.35)
    foot = mat("foot", "#f39a1e", 0.45)

    # body as metaball blend
    mb = bpy.data.metaballs.new("owl_mb")
    mb.resolution = mb.render_resolution = 0.03
    ob = bpy.data.objects.new("owl_mbobj", mb)
    col.objects.link(ob)
    for co, sz in [((0, 0, 0.75), (0.55, 0.5, 0.62)), ((0, 0, 1.45), (0.52, 0.48, 0.46)), ((0, 0, 1.1), (0.5, 0.46, 0.4))]:
        el = mb.elements.new(type="ELLIPSOID")
        el.co = co
        el.radius = 1
        el.size_x, el.size_y, el.size_z = sz
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    body = bpy.data.objects.new("owl", me)
    col.objects.link(body)
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(feather)

    sphere("belly", (0, -0.28, 0.78), 0.5, belly, scale=(0.78, 0.55, 0.95), sub=2)
    # facial discs + big eyes (front is -y)
    for s in (1, -1):
        sphere(f"disc{s}", (0.2 * s, -0.36, 1.5), 0.26, face, scale=(1, 0.45, 1), sub=2)
        sphere(f"eyew{s}", (0.2 * s, -0.47, 1.52), 0.17, eye_w, scale=(1, 0.5, 1), sub=2)
        sphere(f"iris{s}", (0.2 * s, -0.53, 1.52), 0.12, iris, scale=(1, 0.4, 1), sub=2)
        sphere(f"pupil{s}", (0.2 * s - 0.01 * s, -0.575, 1.52), 0.075, pupil, scale=(1, 0.35, 1), sub=2)
        sphere(f"hl{s}", (0.2 * s + 0.035, -0.61, 1.57), 0.022, eye_w, sub=1)
        # ear tufts
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.12, depth=0.32, location=(0.32 * s, -0.05, 1.9))
        tuft = bpy.context.active_object
        tuft.rotation_euler = (0.15, -0.45 * s, 0)
        tuft.data.materials.append(dark)
        smooth(tuft, 1)
        # wings
        sphere(f"wing{s}", (0.5 * s, 0.02, 0.95), 0.45, dark, scale=(0.32, 0.6, 1.05), sub=2)
        bpy.context.active_object.rotation_euler = (0, 0.18 * s, 0)
        # feet: three toes
        for k in (-1, 0, 1):
            sphere(f"toe{s}{k}", (0.2 * s + 0.07 * k, -0.18 - 0.05 * abs(k) * 0, 0.05), 0.07, foot, scale=(0.55, 1.3, 0.55), sub=1)
    # beak
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.08, depth=0.2, location=(0, -0.55, 1.36))
    bk = bpy.context.active_object
    bk.rotation_euler = (math.radians(105), 0, 0)
    bk.data.materials.append(beak)
    smooth(bk, 1)
    # brow feathers for a curious expression (one raised)
    for s, tilt in ((1, 0.35), (-1, -0.12)):
        sphere(f"brow{s}", (0.2 * s, -0.5, 1.74 + (0.03 if s == 1 else 0)), 0.15, dark, scale=(1, 0.3, 0.25), sub=1)
        bpy.context.active_object.rotation_euler = (0, tilt, 0)
    shadow_catcher(0.0)
    cam_d = bpy.data.cameras.new("cam")
    cam_d.lens = 70
    cam = bpy.data.objects.new("cam", cam_d)
    col.objects.link(cam)
    cam.location = (2.4, -6.2, 2.5)
    tgt = bpy.data.objects.new("tgt", None)
    col.objects.link(tgt)
    tgt.location = (0, 0, 1.0)
    c = cam.constraints.new("TRACK_TO")
    c.target = tgt
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"
    scene.camera = cam


(build_cube if KIND == "cube" else build_owl)()

# ------------------------------------------------------------------ light + render
world = bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (*srgb("#dfefff"), 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
sun = bpy.data.lights.new("sun", "SUN")
sun.energy = 3.6
sun.angle = math.radians(12)
so = bpy.data.objects.new("sun", sun)
col.objects.link(so)
so.rotation_euler = (math.radians(40), math.radians(18), math.radians(25))
fill = bpy.data.lights.new("fill", "AREA")
fill.energy = 300
fill.size = 4
fo = bpy.data.objects.new("fill", fill)
col.objects.link(fo)
fo.location = (-5, -4, 4)
fo.rotation_euler = (math.radians(55), 0, math.radians(-50))

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = 800
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
try:
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
except Exception:
    pass
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("RENDERED", OUT)
