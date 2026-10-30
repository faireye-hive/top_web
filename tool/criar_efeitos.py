#!/usr/bin/env python3
"""Converte os efeitos de cena do Client (.par + .eff) para um catálogo Three.js.

O yaw do .obj (tipo 1, short/100 em radianos) não é o yaw das casas.
No modelo RectPlane, já deitado no XZ do Three, ele vira rotation.z = -yaw.
O deslocamento do emissor usa rotateHorizontal, que no Three é rotation.y = -yaw.

Exemplo:
    python3 criar_efeitos.py ~/DEV/TOP2/TalesOfPirateDX9/Client
    python3 criar_efeitos.py Client --ids 1 3 13
"""
import argparse, json, math, shutil, struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
SAMPLES = 8
# D3DBLEND: ONE=2 é aditivo. O runtime aplica o fator; aqui só guardamos o inteiro.


def rot_z(x, y, z, theta):
    c, s = math.cos(theta), math.sin(theta)
    return (x * c - y * s, x * s + y * c, z)


def rot_y(x, y, z, phi):
    c, s = math.cos(phi), math.sin(phi)
    return (x * c + z * s, y, -x * s + z * c)


def rotate_horizontal(x, z, yaw):
    c, s = math.cos(yaw), math.sin(yaw)
    return (x * c - z * s, x * s + z * c)


def check_frames():
    """O mesmo número que o Object3D do Three precisa produzir."""
    yaw = math.pi / 2
    # RectPlane no XZ: rotation.z = -yaw leva o +X local a (0, -1, 0).
    x, y, z = rot_z(1, 0, 0, -yaw)
    assert abs(x) < 1e-6 and abs(y + 1) < 1e-6 and abs(z) < 1e-6, (x, y, z)
    # Deslocamento: rotateHorizontal(1, 0, π/2) = (0, 1) e rotation.y = -yaw.
    ox, oy, oz = rot_y(1, 0, 0, -yaw)
    hx, hz = rotate_horizontal(1, 0, yaw)
    assert abs(oy) < 1e-6 and abs(ox - hx) < 1e-6 and abs(oz - hz) < 1e-6, (ox, oy, oz, hx, hz)
    assert abs(hx) < 1e-6 and abs(hz - 1) < 1e-6


class Reader:
    def __init__(self, data):
        self.data = data
        self.pos = 0

    def need(self, n):
        if self.pos + n > len(self.data):
            raise EOFError(f'fim aos {self.pos}, pedi {n}, restam {len(self.data) - self.pos}')

    def u8(self):
        self.need(1)
        v = self.data[self.pos]
        self.pos += 1
        return v

    def u16(self):
        self.need(2)
        v = struct.unpack_from('<H', self.data, self.pos)[0]
        self.pos += 2
        return v

    def i32(self):
        self.need(4)
        v = struct.unpack_from('<i', self.data, self.pos)[0]
        self.pos += 4
        return v

    def u32(self):
        self.need(4)
        v = struct.unpack_from('<I', self.data, self.pos)[0]
        self.pos += 4
        return v

    def f32(self, raw=False):
        self.need(4)
        v = struct.unpack_from('<f', self.data, self.pos)[0]
        self.pos += 4
        if not raw and not math.isfinite(v):
            raise ValueError(f'float inválido em {self.pos - 4}')
        return v

    def vec(self, n, raw=False):
        return [self.f32(raw) for _ in range(n)]

    def name32(self):
        self.need(32)
        raw = self.data[self.pos:self.pos + 32]
        self.pos += 32
        if 0 not in raw:
            raise ValueError('nome sem terminador')
        return raw.split(b'\0', 1)[0].decode('latin1', 'replace')

    def skip(self, n):
        self.need(n)
        self.pos += n

    def flag(self):
        v = self.u8()
        if v > 1:
            raise ValueError(f'flag {v}')
        return v != 0


def decode_eff(data):
    """legacy_eff::decode. Aceita parâmetros de modelo não finitos e sobra no fim."""
    r = Reader(data)
    version = r.u32()
    if version < 1 or version > 7:
        raise ValueError(f'versão eff {version}')
    technique = r.i32()
    use_path = r.flag()
    path = r.name32()
    use_sound = r.flag()
    sound = r.name32()
    rotating = r.flag()
    rotation = r.vec(3)
    rotation_speed = r.f32()
    sub_count = r.i32()
    if sub_count < 0 or sub_count > 64:
        raise ValueError(f'subefeitos {sub_count}')
    parts = []
    for _ in range(sub_count):
        part = {
            'name': r.name32(),
            'type': r.i32(),
            'src': r.i32(),
            'dst': r.i32(),
        }
        length = r.f32()
        if length < 0 or length > 3600:
            raise ValueError('duração')
        frames = r.u16()
        if frames < 1 or frames > 512:
            raise ValueError(f'quadros {frames}')
        times = [r.f32() for _ in range(frames)]
        sizes = [r.vec(3) for _ in range(frames)]
        angles = [r.vec(3) for _ in range(frames)]
        positions = [r.vec(3) for _ in range(frames)]
        colors = [r.vec(4) for _ in range(frames)]
        part['keys'] = [
            {'d': times[i], 's': sizes[i], 'a': angles[i], 'p': positions[i], 'c': colors[i]}
            for i in range(frames)
        ]
        uv_vertices = r.u16()
        uv_count = r.u16()
        part['coordFrameTime'] = r.f32()
        if uv_vertices > 4096 or uv_count > 512 or part['coordFrameTime'] < 0:
            raise ValueError('uv')
        if uv_vertices == 4 and uv_count > 0:
            part['uv'] = [[r.vec(2) for _ in range(4)] for _ in range(uv_count)]
        elif 3 <= uv_vertices <= 128 and uv_count > 0:
            part['meshUV'] = [[r.vec(2) for _ in range(uv_vertices)] for _ in range(uv_count)]
        else:
            r.skip(uv_vertices * uv_count * 8)
        tex_count = r.u16()
        part['regionFrameTime'] = r.f32()
        if tex_count > 512 or part['regionFrameTime'] < 0:
            raise ValueError('regiões')
        part['texture'] = r.name32()
        if uv_vertices == 4 and tex_count > 0:
            part['regions'] = [[r.vec(2) for _ in range(4)] for _ in range(tex_count)]
        elif 3 <= uv_vertices <= 128 and tex_count > 0:
            part['meshRegions'] = [[r.vec(2) for _ in range(uv_vertices)] for _ in range(tex_count)]
        else:
            r.skip(tex_count * uv_vertices * 8)
        part['model'] = r.name32()
        part['billboard'] = r.flag()
        r.i32()  # scratch
        if version > 1:
            part['segments'] = r.i32()
            part['modelParams'] = r.vec(3, raw=True)
        if version > 2:
            tex_frames = r.u16()
            part['textureFrameTime'] = r.f32()
            if tex_frames > 512 or part['textureFrameTime'] < 0:
                raise ValueError('quadros de textura')
            part['frames'] = [r.name32() for _ in range(tex_frames)]
            r.f32()
        else:
            part['frames'] = []
            part['textureFrameTime'] = 0
        part['animatedParams'] = []
        if version > 3:
            use_param = r.i32()
            if use_param < 0 or use_param > 1:
                raise ValueError('useParam')
            if use_param:
                for _ in range(frames):
                    part['animatedParams'].append({'segments':r.i32(),'params':r.vec(3)})
        if version > 4:
            r.flag()
            r.vec(4)
        if version > 5:
            r.flag()
        if version > 6:
            r.flag()
        parts.append(part)
    return {
        'version': version,
        'technique': technique,
        'rotating': rotating,
        'rotation': rotation,
        'rotationSpeed': rotation_speed,
        'path': path if use_path else '',
        'sound': sound if use_sound else '',
        'parts': parts,
        'trailing': len(data) - r.pos,
    }


def skip_path(r):
    count = r.i32()
    r.f32()
    if count < 0 or count > 8192:
        raise ValueError(f'caminho com {count} pontos')
    r.skip(count * 12)
    if count > 1:
        r.skip((count - 1) * 24)


def decode_par(data):
    r = Reader(data)
    version = r.u32()
    if version < 2 or version > 15:
        raise ValueError(f'versão par {version}')
    name = r.name32()
    part_num = r.i32()
    if part_num < 0 or part_num > 64:
        raise ValueError(f'sistemas {part_num}')
    length = r.f32() if version >= 3 else 0
    systems = []
    for _ in range(part_num):
        sys = {'type': r.i32(), 'name': r.name32(), 'count': r.i32()}
        sys['texture'] = r.name32()
        sys['model'] = r.name32()
        sys['range'] = r.vec(3)
        frames = r.u16()
        if frames > 512:
            raise ValueError('quadros par')
        sys['sizes'] = [r.f32() for _ in range(frames)]
        sys['angles'] = [r.vec(3) for _ in range(frames)]
        sys['colors'] = [r.vec(4) for _ in range(frames)]
        sys['billboard'] = r.u8() != 0
        sys['src'] = r.i32()
        sys['dst'] = r.i32()
        sys['minFilter'] = r.i32()
        sys['magFilter'] = r.i32()
        sys['life'] = r.f32()
        sys['vel'] = r.f32()
        sys['dir'] = r.vec(3)
        sys['accel'] = r.vec(3)
        sys['step'] = r.f32()
        sys['offset'] = [0, 0, 0]
        sys['delay'] = 0
        sys['play'] = length if version < 6 else 0
        sys['roadom'] = 4 if sys['type'] in (1, 2, 16) else 2
        model_range = False
        if version > 3:
            model_range = r.u8() != 0
            r.name32()
        if version > 4:
            sys['offset'] = r.vec(3)
        if version > 5:
            sys['delay'] = r.f32()
            sys['play'] = r.f32()
        sys['path'] = None
        if version > 8:
            if r.u8():
                count=r.i32();speed=r.f32()
                points=[r.vec(3) for _ in range(count)]
                segments=[{'dir':r.vec(3),'distance':r.vec(3)[0]} for _ in range(max(0,count-1))]
                sys['path']={'speed':speed,'points':points,'segments':segments}
        if version > 9:
            r.u8()
        if version > 10:
            sys['hitEffect']=r.name32()
        if version > 11 and model_range:
            points = r.u16()
            if points > 4096:
                raise ValueError(f'faixa de modelo {points}')
            r.skip(points * 12)
        if version > 12:
            sys['roadom'] = r.i32()
        if version > 13:
            sys['modelDirection']=bool(r.u8())
        if version > 14:
            sys['mediayEff']=bool(r.u8())
        systems.append(sys)
    extra = '';strip_defs=[]
    if version >= 7 and r.pos + 4 <= len(data):
        strips = r.i32()
        if strips:
            for _ in range(strips):
                strip_defs.append({'maxLength':r.i32(),'dummyA':r.i32(),'dummyB':r.i32(),'color':r.vec(4),'life':r.f32(),'step':r.f32(),'texture':r.name32(),'src':r.i32(),'dst':r.i32()})
    return {'version': version, 'name': name, 'length': length, 'systems': systems, 'strips':strip_defs,'extra': extra, 'at': r.pos, 'size': len(data)}


def sample_track(values, stride, channel, t):
    if stride <= 0 or len(values) < stride or len(values) % stride:
        return 0
    t = min(1, max(0, t))
    frames = len(values) // stride
    cursor = t * frames
    first = min(frames - 1, int(cursor))
    second = min(frames - 1, first + 1)
    a = values[first * stride + channel]
    b = values[second * stride + channel]
    if not math.isfinite(a) or not math.isfinite(b):
        return 0
    return a + (b - a) * (cursor - first)


def eff_duration(keys):
    total = 0
    for key in keys:
        if not math.isfinite(key['d']) or key['d'] < 0:
            return 0
        total += key['d']
    return total if total <= 3600 else 0


def sample_eff(keys, seconds):
    n = len(keys)
    if n == 0:
        return None
    if n == 1 or eff_duration(keys) <= 1e-7:
        return keys[0]
    at = seconds % eff_duration(keys) if eff_duration(keys) > 0 else 0
    cursor = 0
    for i, key in enumerate(keys):
        end = cursor + key['d']
        if key['d'] > 1e-7 and at < end - 1e-7:
            nxt = keys[(i + 1) % n]
            frac = (at - cursor) / key['d']
            def mix(a, b):
                return [a[j] + (b[j] - a[j]) * frac for j in range(len(a))]
            return {
                's': mix(key['s'], nxt['s']),
                'c': mix(key['c'], nxt['c']),
                'p': mix(key['p'], nxt['p']),
                'a': mix(key['a'], nxt['a']),
            }
        cursor = end
    return keys[-1]


def clamp(v, lo, hi):
    if not math.isfinite(v):
        return lo
    return max(lo, min(hi, v))


def round_list(values, nd=4):
    return [round(float(v), nd) for v in values]


def uv_rect(quad):
    """Quatro UVs na ordem do RectPlane → retângulo (u0, v0, u1, v1) do atributo 0..1."""
    if not quad or len(quad) < 4:
        return [0, 0, 1, 1]
    return [round(quad[1][0], 4), round(quad[1][1], 4), round(quad[2][0], 4), round(quad[0][1], 4)]


def effect_uvs(part):
    regions = part.get('regions') or []
    frames = part.get('uv') or []
    if len(regions) > 1:
        step = max(1, len(regions) // 8)
        picked = regions[::step][:8]
        time = part.get('regionFrameTime') or 0.12
        return [uv_rect(q) for q in picked], round(float(time), 4), True
    if len(frames) > 1:
        time = part.get('coordFrameTime') or 1
        return [uv_rect(q) for q in frames[:4]], round(float(time), 4), False
    if regions:
        return [uv_rect(regions[0])], 0, True
    if frames:
        return [uv_rect(frames[0])], 0, True
    return [[0, 0, 1, 1]], 0, True


def build_part(system, eff_part, texture, mask_black):
    """Uma camada desenhável. Tamanho é a largura cheia no Three, não o meio-lado."""
    life = system['life'] if system['life'] > 1e-3 else 1
    par_scale_frozen = system['sizes'][0] if system['sizes'] else 1
    if not math.isfinite(par_scale_frozen):
        par_scale_frozen = 1
    loop = eff_duration(eff_part['keys']) if eff_part else life
    if loop <= 1e-4:
        loop = life
    model = eff_part['model'] if eff_part else system['model']
    billboard = bool(system['billboard'] or (eff_part and eff_part['billboard']))
    # Rect é um plano em pé: a altura histórica é size.z (o feixe de luz).
    vertical = (not billboard) and model == 'Rect'
    sizes, colors, offsets = [], [], []
    spins = []
    max_alpha = 0
    max_size = 0
    for i in range(SAMPLES):
        t = i / (SAMPLES - 1)
        if system['type'] == 6:
            par_size = par_scale_frozen
            par_color = system['colors'][0] if system['colors'] else [1, 1, 1, 1]
        else:
            flat = system['sizes']
            par_size = sample_track(flat, 1, 0, t) if flat else 1
            cols = [c for color in system['colors'] for c in color]
            par_color = [sample_track(cols, 4, ch, t) for ch in range(4)] if cols else [1, 1, 1, 1]
        if eff_part:
            key = sample_eff(eff_part['keys'], t * (eff_duration(eff_part['keys']) or 0))
            sx = key['s'][0] * par_size
            sy = (key['s'][2] if vertical else key['s'][1]) * par_size
            color = [clamp(key['c'][ch] * par_color[ch], 0, 1) for ch in range(4)]
            # (x, y, z-up) → local Three (x, altura, z) antes do yaw.
            off = [key['p'][0] * par_size, key['p'][2] * par_size, key['p'][1] * par_size]
            spins.append(key['a'][2])
        else:
            sx = sy = par_size
            color = [clamp(par_color[ch], 0, 1) for ch in range(4)]
            off = [0, 0, 0]
            spins.append(0)
        sizes.append([round(sx, 4), round(sy, 4)])
        colors.append([round(c, 4) for c in color])
        offsets.append(round_list(off))
        max_alpha = max(max_alpha, color[3])
        max_size = max(max_size, abs(sx), abs(sy))
    if max_alpha < 0.02 or max_size < 0.02:
        return None
    uvs, uv_time, uv_snap = effect_uvs(eff_part) if eff_part else ([[0, 0, 1, 1]], 0, True)
    spin = spins[len(spins) // 2]
    if max(spins) - min(spins) > 0.05:
        spin = spins[len(spins) // 2]
    return {
        'billboard': billboard,
        'shape': 'billboard' if billboard else ('rect' if vertical else 'plane'),
        'model': model,
        'texture': texture,
        'maskBlack': bool(mask_black),
        'src': int(eff_part['src'] if eff_part else system['src']),
        'dst': int(eff_part['dst'] if eff_part else system['dst']),
        'life': round(loop if eff_part else life, 4),
        'count': max(1, int(system['count'])),
        'range': round_list(system['range']),
        'dir': round_list(system['dir']),
        'accel': round_list(system['accel']),
        'vel': round(float(system['vel']), 4),
        'step': round(float(system['step']), 4),
        'roadom': int(system['roadom']) if system['roadom'] else 2,
        'motion': system['type'] in (1, 2, 3),
        'spin': round(float(spin), 4),
        'size': sizes,
        'color': colors,
        'off': offsets,
        'uv': uvs,
        'uvTime': uv_time,
        'uvSnap': uv_snap,
    }


def safe_stem(name):
    base = Path(name.replace('\\', '/')).name.strip()
    if not base or base in ('.', '..') or '/' in base or '\\' in base:
        return ''
    return Path(base).stem


def index_textures(client):
    found = {}
    root = client / 'texture' / 'effect'
    if not root.is_dir():
        return found
    for path in root.iterdir():
        if path.is_file():
            found[path.name.lower()] = path
    return found


def resolve_texture(index, name):
    stem = safe_stem(name)
    if not stem:
        return None
    for candidate in (f'{stem}.tga.png', f'{stem}.png', f'{stem}.tga', name.lower()):
        hit = index.get(candidate.lower())
        if hit:
            return hit
    return None


def mask_black(path):
    try:
        from PIL import Image
        image = Image.open(path)
        if image.mode == 'P':
            image = image.convert('RGBA')
        if 'A' not in image.getbands():
            return True
        lo, hi = image.getchannel('A').getextrema()
        return lo > 200
    except Exception:
        return False


def copy_texture(src, dest_dir):
    dest_dir.mkdir(parents=True, exist_ok=True)
    stem = safe_stem(src.name)
    # bd.tga.png → bd.png. TGA cru vira PNG se o Pillow abrir.
    if src.name.lower().endswith('.tga') and not src.name.lower().endswith('.tga.png'):
        dest = dest_dir / f'{stem}.png'
        try:
            from PIL import Image
            Image.open(src).save(dest)
            return dest.name
        except Exception:
            return ''
    dest = dest_dir / f'{stem}.png'
    if src.resolve() != dest.resolve():
        shutil.copyfile(src, dest)
    return dest.name


def load_table(client):
    path = client / 'scripts' / 'table' / 'sceneffectinfo.txt'
    table = {}
    for line in path.read_text('latin1').splitlines():
        if not line.strip() or line.startswith('//'):
            continue
        cols = line.split('\t')
        if len(cols) < 2 or not cols[0].strip().lstrip('-').isdigit():
            continue
        table[int(cols[0])] = {'file': cols[1].strip(), 'name': cols[2].strip() if len(cols) > 2 else cols[1].strip()}
    return table


def wanted_ids(client, explicit):
    if explicit:
        return explicit
    objects = HERE / 'assets' / 'objects.json'
    if not objects.is_file():
        return [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 95]
    ids = set()
    for rec in json.loads(objects.read_text()):
        if len(rec) > 3 and rec[3] == 1:
            ids.add(int(rec[2]))
    return sorted(ids)


def find_file(client, folder, name):
    direct = client / folder / name
    if direct.is_file():
        return direct
    low = name.lower()
    root = client / folder
    if root.is_dir():
        for path in root.iterdir():
            if path.name.lower() == low:
                return path
    return None


def convert(client, ids, dest):
    check_frames()
    table = load_table(client)
    textures = index_textures(client)
    tex_dir = dest / 'textures'
    copied = {}
    catalog = {'yawModel': 'rotation.z = -yaw', 'yawOffset': 'rotation.y = -yaw', 'effects': {}}
    missing = []
    for ident in ids:
        row = table.get(ident)
        if not row:
            print(f'id {ident}: sem linha em sceneffectinfo')
            missing.append(ident)
            continue
        par_path = find_file(client, 'effect', row['file'])
        if not par_path:
            print(f'id {ident}: {row["file"]} ausente')
            missing.append(ident)
            continue
        try:
            par = decode_par(par_path.read_bytes())
        except Exception as exc:
            print(f'id {ident}: falha em {row["file"]}: {exc}')
            missing.append(ident)
            continue
        layers = []
        for sys in par['systems']:
            model = sys['model']
            eff = None
            if model.lower().endswith('.eff'):
                eff_path = find_file(client, 'effect', model)
                if not eff_path:
                    print(f'id {ident}: modelo {model} ausente')
                    continue
                try:
                    eff = decode_eff(eff_path.read_bytes())
                except Exception as exc:
                    print(f'id {ident}: falha em {model}: {exc}')
                    continue
                if eff['trailing']:
                    print(f'id {ident}: {model} sobrou {eff["trailing"]} bytes; camadas lidas={len(eff["parts"])}')
            parts = eff['parts'] if eff else [None]
            for part in parts:
                names = []
                if part:
                    names.append(part['texture'])
                    names.extend(part.get('frames') or [])
                else:
                    names.append(sys['texture'])
                tex_name = ''
                for candidate in names:
                    src = resolve_texture(textures, candidate)
                    if not src:
                        continue
                    tex_name = copied.get(src)
                    if not tex_name:
                        tex_name = copy_texture(src, tex_dir)
                        copied[src] = tex_name
                    if tex_name:
                        break
                if not tex_name:
                    print(f'id {ident}: sem textura ({names[:2]})')
                    continue
                if part and part['model'] not in ('RectPlane', 'Rect', 'Triangle', 'TrianglePlane', ''):
                    print(f'id {ident}: modelo {part["model"]} ainda não vira quad')
                    continue
                layer = build_part(sys, part, tex_name, mask_black(tex_dir / tex_name))
                if layer:
                    layer['type'] = sys['type']
                    layers.append(layer)
        if not layers:
            print(f'id {ident}: {row["file"]} sem camada visível')
            continue
        catalog['effects'][str(ident)] = {'name': row['name'], 'file': row['file'], 'parts': layers}
        brief = []
        for layer in layers:
            mid = layer['size'][len(layer['size']) // 2]
            brief.append(f't{layer["type"]} {"cam" if layer["billboard"] else "chão"} n={layer["count"]} {mid[0]:.2f}×{mid[1]:.2f} a={layer["color"][len(layer["color"])//2][3]:.2f} {layer["texture"]}')
        print(f'id {ident:3} {row["file"]:16} {par["name"]!r:12} {"; ".join(brief)}')
    dest.mkdir(parents=True, exist_ok=True)
    out = dest / 'catalog.json'
    out.write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')))
    print(f'\nCatálogo: {out} ({out.stat().st_size} bytes), texturas {len(copied)}, faltas {missing}')
    return 0 if catalog['effects'] else 1


def main():
    parser = argparse.ArgumentParser(description='Converte efeitos de cena .par/.eff para o cliente Three.js')
    parser.add_argument('client', type=Path, help='Pasta Client original')
    parser.add_argument('--ids', type=int, nargs='*', help='IDs de sceneffectinfo. Padrão: os tipo 1 de assets/objects.json')
    parser.add_argument('--destino', type=Path, default=HERE / 'assets' / 'effects')
    args = parser.parse_args()
    client = args.client.expanduser().resolve()
    if not (client / 'effect').is_dir():
        parser.error('Client/effect não encontrado')
    ids = wanted_ids(client, args.ids)
    return convert(client, ids, args.destino.expanduser().resolve())


if __name__ == '__main__':
    raise SystemExit(main())
